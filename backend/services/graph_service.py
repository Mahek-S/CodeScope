"""
Dependency graph traversal — finds every file affected by a set of
changed files.

The `dependencies` table stores edges as "source imports target". Impact
flows the other way: if target changes, source is affected. So we build
a reverse-adjacency map (target -> [files that import it]) and BFS
outward from the changed files.
"""
from pathlib import Path

from sqlalchemy.orm import Session, aliased

from models.dependency import Dependency
from models.file_node import FileNode


def build_reverse_adjacency(db: Session, project_id) -> dict[str, set[str]]:
    """
    Map: filepath -> set of filepaths that import it.

    This is the "who imports me" direction, which is what we need to
    walk outward from a changed file to find everything it impacts.
    """
    source_file = aliased(FileNode)
    target_file = aliased(FileNode)

    rows = (
        db.query(source_file.filepath, target_file.filepath)
        .select_from(Dependency)
        .join(source_file, Dependency.source_file_id == source_file.id)
        .join(target_file, Dependency.target_file_id == target_file.id)
        .filter(Dependency.project_id == project_id)
        .all()
    )

    reverse_adjacency: dict[str, set[str]] = {}
    for source_path, target_path in rows:
        reverse_adjacency.setdefault(target_path, set()).add(source_path)
    return reverse_adjacency


def find_affected_files(
    db: Session, project_id, changed_files: list[str]
) -> tuple[list[str], list[str]]:
    """
    BFS over the reverse-dependency graph starting from changed_files.

    Returns (directly_affected, transitively_affected):
      - directly_affected: files that import a changed file
      - transitively_affected: files reachable only through a chain of
        two or more hops (excludes changed_files and directly_affected)
    """
    reverse_adjacency = build_reverse_adjacency(db, project_id)
    changed_set = set(changed_files)

    directly_affected: set[str] = set()
    for changed_file in changed_files:
        directly_affected |= reverse_adjacency.get(changed_file, set())
    directly_affected -= changed_set

    visited = changed_set | directly_affected
    frontier = set(directly_affected)
    transitively_affected: set[str] = set()

    while frontier:
        next_frontier: set[str] = set()
        for file in frontier:
            for dependent in reverse_adjacency.get(file, set()):
                if dependent not in visited:
                    next_frontier.add(dependent)
        transitively_affected |= next_frontier
        visited |= next_frontier
        frontier = next_frontier

    return sorted(directly_affected), sorted(transitively_affected)



def suggest_test_files(
    db: Session, project_id, related_files: list[str]
) -> list[str]:
    """
    Heuristic test-file suggestion: any indexed file that looks like a
    test (path contains "test") and shares a name stem with one of the
    changed/affected files.

    This runs alongside — not instead of — the LLM's own test
    suggestions in ai/nodes.llm_reasoning. It catches the obvious
    "test_foo.py exists for foo.py" case deterministically, even if the
    LLM's suggestion misses it.
    """
    if not related_files:
        return []

    candidate_rows = (
        db.query(FileNode.filepath)
        .filter(FileNode.project_id == project_id)
        .filter(FileNode.filepath.ilike("%test%"))
        .all()
    )
    test_paths = [row[0] for row in candidate_rows]
    if not test_paths:
        return []

    stems = {
        Path(f).stem.removeprefix("test_").removesuffix("_test")
        for f in related_files
    }
    stems.discard("")

    matched = {
        test_path
        for test_path in test_paths
        if any(stem in test_path for stem in stems)
    }
    return sorted(matched)