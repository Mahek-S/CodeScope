"""
Deterministic risk scoring — no LLM involved.

Inputs:
  - fan_out: number of directly + transitively affected files
  - core_module_touched: bool (does the changed set touch a flagged
    infra/shared file?)
  - diff_size: total lines added + removed across the PR
  - change_frequency: how often the touched files have changed
    historically, normalized 0.0 -> 1.0

Output:
  - risk_score: float 0.0 -> 1.0
  - risk_level: 'low' | 'medium' | 'high'
"""
from sqlalchemy.orm import Session

from models.commit import Commit

WEIGHTS = {
    "fan_out": 0.35,
    "core_module": 0.30,
    "diff_size": 0.20,
    "change_frequency": 0.15,
}

FAN_OUT_MAX = 50
DIFF_SIZE_MAX = 500
CHANGE_FREQUENCY_LOOKBACK = 50  # commits

# Path fragments that mark a file as "core" infra/shared code regardless
# of what it contains. Matched as a substring so both "app/core/config.py"
# and "backend/config.py" register. Deliberately coarse for v1 — a
# per-project configurable list is a natural v2 addition.
CORE_MODULE_MARKERS = {
    "config.py",
    "database.py",
    "security.py",
    "auth.py",
    "settings.py",
    "celery_app.py",
    "__init__.py",
    "core/",
    "shared/",
    "common/",
}


def is_core_module(filepath: str) -> bool:
    """Whether a single filepath touches a known infra/shared marker."""
    normalized = filepath.replace("\\", "/")
    return any(marker in normalized for marker in CORE_MODULE_MARKERS)


def any_core_module_touched(changed_files: list[str]) -> bool:
    return any(is_core_module(f) for f in changed_files)


def compute_change_frequency(
    db: Session,
    project_id,
    filepaths: list[str],
    lookback: int = CHANGE_FREQUENCY_LOOKBACK,
) -> float:
    """
    Fraction of the project's most recent `lookback` commits that touched
    at least one of `filepaths`. A simple recency-weighted proxy for
    "how often does this code change" — good enough for a risk signal
    at v1 without a dedicated change-frequency table.
    """
    touched = set(filepaths)
    if not touched:
        return 0.0

    rows = (
        db.query(Commit.changed_files)
        .filter(Commit.project_id == project_id)
        .order_by(Commit.committed_at.desc().nullslast())
        .limit(lookback)
        .all()
    )
    if not rows:
        return 0.0

    matches = sum(1 for (changed,) in rows if changed and touched.intersection(changed))
    return round(matches / len(rows), 4)


def compute_risk_score(
    fan_out: int,
    core_module_touched: bool,
    diff_size: int,
    change_frequency: float,  # normalized 0.0 -> 1.0
) -> tuple[float, str]:
    """
    Returns (risk_score, risk_level).
    risk_score is a float 0.0 -> 1.0.
    risk_level is 'low', 'medium', or 'high'.
    """
    fan_out_score = min(fan_out / FAN_OUT_MAX, 1.0)
    core_score = 1.0 if core_module_touched else 0.0
    diff_score = min(diff_size / DIFF_SIZE_MAX, 1.0)
    freq_score = min(change_frequency, 1.0)

    risk_score = (
        fan_out_score * WEIGHTS["fan_out"]
        + core_score * WEIGHTS["core_module"]
        + diff_score * WEIGHTS["diff_size"]
        + freq_score * WEIGHTS["change_frequency"]
    )

    if risk_score >= 0.65:
        risk_level = "high"
    elif risk_score >= 0.35:
        risk_level = "medium"
    else:
        risk_level = "low"

    return round(risk_score, 4), risk_level