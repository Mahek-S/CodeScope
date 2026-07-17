"""
sentence-transformers wrapper for generating file-level embeddings.
Model: all-MiniLM-L6-v2 -- 384-dimensional, fast, runs locally.

All model-loading lives here and nowhere else. SentenceTransformer is
expensive to construct (loads weights off disk), so the model is created
once per worker process via lru_cache and reused for every embedding
call after that. Callers (indexing_service, search_service) never touch
the model directly -- they only call generate_embedding /
generate_embeddings_batch, so swapping the underlying model later is a
one-file change.
"""
from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

EMBEDDING_DIM = 384  # must match FileNode.embedding's Vector(384) column


@lru_cache(maxsize=1)
def _get_model() -> "SentenceTransformer":
    """Load the model once and cache it for the lifetime of the worker process."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def generate_embedding(text: str) -> list[float]:
    """Generate a 384-dim embedding for a single text input."""
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts (more efficient than looping)."""
    if not texts:
        return []
    model = _get_model()
    vectors = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return [v.tolist() for v in vectors]


def file_summary_text(
    filepath: str,
    classes: list[str],
    functions: list[str],
    imports: list[str] | None = None,
    constants: list[str] | None = None,
    docstring: str | None = None,
) -> str:
    """
    Build a short textual summary of a file for embedding.

    Still structural metadata, not file content -- but classes/functions
    alone leave many infra and config files (celery_app.py, config.py)
    with an almost-empty summary, since they define neither. Imports,
    top-level constants (REDIS_URL, DATABASE_URL, ...), and the module
    docstring are cheap to include and are exactly where a file like that
    actually states its purpose.
    """
    parts = [f"File: {filepath}"]
    if docstring:
        first_line = docstring.strip().splitlines()[0]
        parts.append(f"Description: {first_line}")
    if imports:
        parts.append(f"Imports: {', '.join(imports)}")
    if constants:
        parts.append(f"Constants: {', '.join(constants)}")
    if classes:
        parts.append(f"Classes: {', '.join(classes)}")
    if functions:
        parts.append(f"Functions: {', '.join(functions)}")
    return " | ".join(parts)