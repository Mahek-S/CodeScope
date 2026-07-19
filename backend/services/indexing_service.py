"""
Orchestrates repository indexing: clone the repo, AST-parse every Python
file, and rebuild the file-level dependency graph.

This is the single place that turns "a repo on disk" into FileNode +
Dependency rows. Both the manual sync endpoint and the push-event webhook
call into `index_repository` so there's exactly one indexing code path.

Embedding generation is a separate function, `generate_project_embeddings`,
run as its own Celery task after `index_repository` completes. It's kept
separate rather than folded into the AST-parsing pass because it has a
different cost profile (model inference vs. filesystem/AST work) and a
different failure mode worth retrying independently.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from models.dependency import Dependency
from models.file_node import FileNode
from models.organization import Organization
from models.project import Project
from utils.embeddings import file_summary_text, generate_embeddings_batch
from utils.git_ops import GitOpsError, clone_repository, discover_python_files
from utils.parser import (
    ParsedFile,
    build_module_index,
    import_display_names,
    parse_python_file,
    resolve_import_to_filepaths,
)

logger = logging.getLogger(__name__)


class IndexingError(Exception):
    """Raised when a repository can't be resolved, cloned, or indexed."""


def get_repo_access_token(db: Session, project: Project) -> str:
    """
    Resolve a GitHub access token usable both to clone this project's repo
    and to call the GitHub API on its behalf (posting PR comments,
    fetching PR file lists, etc.) -- one token, every GitHub interaction
    for this project goes through it.

    We use the organization creator's token: they're the one who connected
    the repo via OAuth, so their token is guaranteed to have `repo` scope
    on it. Any org admin's token would work equally well, but "creator" is
    a stable, unambiguous choice rather than "first admin found in the DB".
    """
    org = db.query(Organization).filter(Organization.id == project.org_id).first()
    if not org or not org.creator or not org.creator.access_token:
        raise IndexingError(
            f"No usable GitHub token found for project {project.id} "
            f"(org creator has no stored access token)"
        )
    return org.creator.access_token


def index_repository(db: Session, project: Project) -> dict:
    """
    Full index: clone/fetch the repo, parse every Python file, and rebuild
    the file-level dependency graph from scratch.

    Idempotent — safe to call repeatedly. FileNode rows are upserted by
    (project_id, filepath); files removed from the repo since the last
    index are deleted; dependency edges are cleared and rebuilt each run
    so renamed/removed imports never leave stale edges behind.
    """
    access_token = get_repo_access_token(db, project)

    try:
        repo_root = clone_repository(
            project.repo_full_name,
            project.default_branch,
            access_token,
        )

        python_files = discover_python_files(repo_root)
        relative_paths = {
            str(path.relative_to(repo_root))
            for path in python_files
        }

        parsed_by_path: dict[str, ParsedFile] = {}

        for file_path in python_files:
            rel_path = str(file_path.relative_to(repo_root))

            try:
                source = file_path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError) as e:
                logger.warning(
                    "Skipping unreadable file %s: %s",
                    rel_path,
                    e,
                )
                continue

            parsed_by_path[rel_path] = parse_python_file(
                rel_path,
                source,
            )

        file_node_ids = _upsert_file_nodes(
            db,
            project,
            parsed_by_path,
        )

        edge_count = _rebuild_dependencies(
            db,
            project,
            parsed_by_path,
            file_node_ids,
            relative_paths,
        )

        _delete_stale_file_nodes(
            db,
            project,
            relative_paths,
        )

        project.indexed_at = datetime.now(timezone.utc)

        db.commit()

        return {
            "files_indexed": len(parsed_by_path),
            "dependency_edges": edge_count,
        }

    except GitOpsError as e:
        db.rollback()
        raise IndexingError(str(e)) from e

    except Exception:
        db.rollback()
        raise

def _upsert_file_nodes(
    db: Session, project: Project, parsed_by_path: dict[str, ParsedFile]
) -> dict[str, uuid.UUID]:
    """Insert or update one FileNode per parsed file. Returns {filepath: file_node_id}."""
    now = datetime.now(timezone.utc)
    file_node_ids = {}

    for rel_path, parsed in parsed_by_path.items():
        import_names = import_display_names(parsed.imports)
        stmt = (
            pg_insert(FileNode)
            .values(
                project_id=project.id,
                filepath=rel_path,
                language="python",
                classes=parsed.classes,
                functions=parsed.functions,
                exports=parsed.exports,
                imports=import_names,
                constants=parsed.constants,
                docstring=parsed.module_docstring or None,
                content_hash=parsed.content_hash,
                last_indexed=now,
            )
            .on_conflict_do_update(
                index_elements=["project_id", "filepath"],
                set_={
                    "classes": parsed.classes,
                    "functions": parsed.functions,
                    "exports": parsed.exports,
                    "imports": import_names,
                    "constants": parsed.constants,
                    "docstring": parsed.module_docstring or None,
                    "content_hash": parsed.content_hash,
                    "last_indexed": now,
                },
            )
            .returning(FileNode.id)
        )
        file_node_ids[rel_path] = db.execute(stmt).scalar_one()

    return file_node_ids


def _rebuild_dependencies(
    db: Session,
    project: Project,
    parsed_by_path: dict[str, ParsedFile],
    file_node_ids: dict[str, uuid.UUID],
    relative_paths: set[str],
) -> int:
    """
    Clear this project's dependency edges and rebuild them from the
    current parse. A full rebuild is simple and correct — edge counts
    at V1 repo sizes are small enough that diffing isn't worth the
    added complexity.
    """
    db.query(Dependency).filter(Dependency.project_id == project.id).delete()

    module_index = build_module_index(relative_paths)

    seen_edges: set[tuple] = set()
    rows = []
    for rel_path, parsed in parsed_by_path.items():
        source_id = file_node_ids[rel_path]
        for import_rec in parsed.imports:
            target_paths = resolve_import_to_filepaths(
                import_rec,
                rel_path,
                relative_paths,
                module_index,
            )
            for target_path in target_paths:
                if not target_path or target_path == rel_path:
                    continue
                target_id = file_node_ids.get(target_path)
                if not target_id:
                    continue
                edge_key = (source_id, target_id)
                if edge_key in seen_edges:
                    continue
                seen_edges.add(edge_key)
                rows.append(
                    {
                        "project_id": project.id,
                        "source_file_id": source_id,
                        "target_file_id": target_id,
                    }
                )

    if rows:
        db.execute(
            pg_insert(Dependency)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["source_file_id", "target_file_id"])
        )

    return len(rows)


def _delete_stale_file_nodes(db: Session, project: Project, current_relative_paths: set[str]) -> None:
    """
    Remove FileNode rows for files no longer present in the repo.
    Must run after `_rebuild_dependencies`, which has already cleared
    every dependency edge for this project — so there's nothing left
    referencing these rows and no FK violation on delete.
    """
    stale = (
        db.query(FileNode)
        .filter(FileNode.project_id == project.id)
        .filter(~FileNode.filepath.in_(current_relative_paths))
        .all()
    )
    for file_node in stale:
        db.delete(file_node)


def generate_project_embeddings(db: Session, project: Project) -> dict:
    """
    (Re)generate the file-level embedding for every FileNode in a project.

    Embeddings are recomputed for the whole project on every run rather
    than diffed against `content_hash`, matching the same "full rebuild
    is simple and correct at V1 repo sizes" call made for dependency
    edges in `index_repository`. This function does not talk to git or
    parse anything — it assumes `index_repository` has already run and
    FileNode rows exist; it only turns each row into a stored vector.
    """
    file_nodes = (
        db.query(FileNode)
        .filter(FileNode.project_id == project.id)
        .all()
    )

    if not file_nodes:
        return {"files_embedded": 0}

    summaries = [
        file_summary_text(
            fn.filepath,
            fn.classes or [],
            fn.functions or [],
            imports=fn.imports or [],
            constants=fn.constants or [],
            docstring=fn.docstring,
        )
        for fn in file_nodes
    ]
    vectors = generate_embeddings_batch(summaries)

    for file_node, vector in zip(file_nodes, vectors):
        file_node.embedding = vector

    db.commit()

    return {"files_embedded": len(file_nodes)}
