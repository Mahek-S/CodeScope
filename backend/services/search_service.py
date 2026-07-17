"""
Semantic search over file embeddings using pgvector.

The query string is embedded with the same model used to embed files
(see utils.embeddings), then compared against every FileNode.embedding
in the project using cosine distance. pgvector does the nearest-neighbor
work in the database -- nothing is loaded into Python to compare by hand.
"""
from sqlalchemy.orm import Session

from models.file_node import FileNode
from utils.embeddings import generate_embedding

from models.analysis import Analysis

DEFAULT_LIMIT = 10
MAX_LIMIT = 50


def search_files(
    db: Session,
    project_id,
    query: str,
    limit: int = DEFAULT_LIMIT,
) -> list[dict]:
    """
    Return the top-`limit` files in a project whose embedding is most
    similar to `query`, ordered by similarity (most similar first).

    Files that haven't been embedded yet (embedding IS NULL -- e.g. the
    embedding task hasn't run since the last index) are excluded rather
    than erroring, since a partially-embedded project is a normal state
    right after a push.
    """
    query = query.strip()
    if not query:
        return []

    limit = max(1, min(limit, MAX_LIMIT))
    query_vector = generate_embedding(query)

    distance = FileNode.embedding.cosine_distance(query_vector)

    rows = (
        db.query(FileNode.filepath, FileNode.classes, FileNode.functions, distance.label("distance"))
        .filter(FileNode.project_id == project_id)
        .filter(FileNode.embedding.isnot(None))
        .order_by(distance)
        .limit(limit)
        .all()
    )

    return [
        {
            "filepath": filepath,
            "classes": classes or [],
            "functions": functions or [],
            # pgvector's cosine_distance is already (1 - cosine_similarity),
            # so this recovers the familiar -1..1 similarity score.
            "similarity": round(1 - dist, 4),
        }
        for filepath, classes, functions, dist in rows
    ]


def find_similar_past_analyses(
    db: Session,
    project_id,
    changed_files: list[str],
    limit: int = 5,
    candidate_pool: int = 200,
) -> list[dict]:
    """
    Approximate "similar past bugs" for a PR using file embeddings.

    The `analyses` table isn't itself embedded (no vector column in the
    v1 schema) so past analyses aren't directly nearest-neighbor
    searchable. Instead: embed the changed filepaths as one query,
    find semantically similar files in the project via the same
    file-embedding index `search_files` uses, then surface past
    analyses whose changed_files overlap with those similar files. A
    change that touches code semantically similar to a past incident's
    code is a reasonable proxy for "similar past bug" without standing
    up a second embedding pipeline just for analyses.
    """
    if not changed_files:
        return []

    similar_files = search_files(db, project_id, " ".join(changed_files), limit=10)
    similar_paths = {f["filepath"] for f in similar_files} - set(changed_files)
    if not similar_paths:
        return []

    candidates = (
        db.query(Analysis)
        .filter(Analysis.project_id == project_id)
        .filter(Analysis.changed_files.isnot(None))
        .order_by(Analysis.created_at.desc())
        .limit(candidate_pool)
        .all()
    )

    matches = []
    for analysis in candidates:
        overlap = similar_paths.intersection(analysis.changed_files or [])
        if not overlap:
            continue
        matches.append(
            {
                "analysis_id": str(analysis.id),
                "pr_number": analysis.pr_number,
                "risk_level": analysis.risk_level,
                "overlapping_files": sorted(overlap),
                "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
            }
        )
        if len(matches) >= limit:
            break

    return matches