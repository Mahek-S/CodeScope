"""
sentence-transformers wrapper for generating file-level embeddings.
Model: all-MiniLM-L6-v2 -- 384-dimensional, fast, runs locally.

All model-loading lives here and nowhere else. SentenceTransformer is
expensive to construct (loads weights off disk), so the model is created
once per worker process and reused for every embedding call after that.
Callers (indexing_service, search_service) never touch the model
directly -- they only call generate_embedding / generate_embeddings_batch,
so swapping the underlying model later is a one-file change.

Two bugs this module works around, both stemming from the same root
cause:

1. "Cannot copy out of meta tensor" -- newer `transformers`/`accelerate`
   builds (pulled in transitively, since neither is pinned) default some
   `from_pretrained` calls to `low_cpu_mem_usage=True`, which stages
   weights on a "meta" device before materializing them. Older
   sentence-transformers releases don't always handle that staging
   correctly and raise NotImplementedError when the model is first used.
   Fix: pass `device="cpu"` explicitly, which keeps SentenceTransformer on
   its plain (non-meta) loading path.

2. The "model reloads on every search" symptom this caused: the model was
   previously cached with a bare `@lru_cache`, which -- by design --
   never caches a raised exception. So every time construction failed
   with (1), the *next* call retried construction from scratch, logging
   another "Load pretrained SentenceTransformer" line and raising again.
   What looked like "the model keeps reloading" was actually "the model
   keeps failing to load and Python correctly refuses to cache a failure."
   Fixing (1) removes the failure; `_ModelHandle` below also makes that
   failure mode explicit and non-silent even if it ever recurs for an
   unrelated reason (OOM, disk issue, etc.), instead of an opaque retry
   loop.
"""
from __future__ import annotations

import logging
import threading
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384  # must match FileNode.embedding's Vector(384) column


class EmbeddingModelUnavailableError(RuntimeError):
    """Raised when the embedding model failed to load. Callers (the search
    endpoint, the embedding Celery task) catch this specifically and
    degrade gracefully instead of surfacing a raw 500 / retry storm."""


class _ModelHandle:
    """
    Process-local singleton around the SentenceTransformer instance.

    A plain `@lru_cache` is enough to make *successful* loads a one-time
    cost, but it does nothing for a *failed* load -- lru_cache never
    caches exceptions, so a transient failure gets silently retried on
    every subsequent call. This handle instead remembers a failure
    explicitly (`_error`) and keeps re-raising a clear
    EmbeddingModelUnavailableError from it, rather than hammering the
    (possibly still-broken) constructor again on every request.

    The lock only guards the "who does the loading" decision, not every
    call to `.encode()` -- once `_model` is set, reads are lock-free.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: "SentenceTransformer | None" = None
        self._error: Exception | None = None

    def get(self) -> "SentenceTransformer":
        if self._model is not None:
            return self._model
        if self._error is not None:
            raise EmbeddingModelUnavailableError(
                f"Embedding model '{MODEL_NAME}' failed to load: {self._error}"
            ) from self._error

        with self._lock:
            # Re-check inside the lock: another thread may have already
            # finished loading (or failing) while we were waiting.
            if self._model is not None:
                return self._model
            if self._error is not None:
                raise EmbeddingModelUnavailableError(
                    f"Embedding model '{MODEL_NAME}' failed to load: {self._error}"
                ) from self._error

            try:
                from sentence_transformers import SentenceTransformer

                logger.info("Loading embedding model %s (device=cpu)...", MODEL_NAME)
                # device="cpu" is the actual fix for the meta-tensor crash --
                # it skips the accelerate/low_cpu_mem_usage lazy-loading path
                # that newer transformers versions take by default when no
                # device is specified.
                self._model = SentenceTransformer(MODEL_NAME, device="cpu")
                logger.info("Embedding model %s loaded.", MODEL_NAME)
            except Exception as e:  # noqa: BLE001 -- deliberately broad, see class docstring
                self._error = e
                logger.error("Failed to load embedding model %s: %s", MODEL_NAME, e)
                raise EmbeddingModelUnavailableError(
                    f"Embedding model '{MODEL_NAME}' failed to load: {e}"
                ) from e

        return self._model


_handle = _ModelHandle()


def warm_up() -> None:
    """
    Force the model to load now, in the calling process, instead of
    lazily on whichever request/task happens to need it first.

    Called once at FastAPI startup (main.py lifespan) and once per
    Celery worker process (workers/celery_app.py's worker_process_init
    signal) -- see those call sites for why both need it independently.
    Safe to call more than once; a second call is a no-op (returns the
    already-cached model) or re-raises the already-cached error.
    """
    _handle.get()


def is_ready() -> bool:
    """True once the model has successfully loaded in this process."""
    return _handle._model is not None


def _get_model() -> "SentenceTransformer":
    return _handle.get()


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