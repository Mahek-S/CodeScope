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