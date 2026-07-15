"""
sentence-transformers wrapper for generating file-level embeddings.
Model: all-MiniLM-L6-v2 — 384-dimensional, fast, runs locally.
Full implementation on Day 4.
"""
from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def _get_model() -> "SentenceTransformer":
    """Load the model once and cache it for the lifetime of the worker process."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def embed_text(text: str) -> list[float]:
    """Generate a 384-dim embedding for a single text input."""
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts (more efficient than looping)."""
    model = _get_model()
    vectors = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return [v.tolist() for v in vectors]


def file_summary_text(filepath: str, classes: list[str], functions: list[str]) -> str:
    """
    Build a short textual summary of a file for embedding.
    Combines filepath + class names + function names so the vector
    captures structural meaning, not just file content.
    """
    parts = [f"File: {filepath}"]
    if classes:
        parts.append(f"Classes: {', '.join(classes)}")
    if functions:
        parts.append(f"Functions: {', '.join(functions)}")
    return " | ".join(parts)
