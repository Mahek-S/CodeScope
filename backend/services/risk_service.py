"""
Deterministic risk scoring — no LLM involved.

Inputs:
  - fan_out: number of transitively affected files
  - core_module_touched: bool (is a flagged infra/shared file in the changed set?)
  - diff_size: total lines added + removed
  - change_frequency: how often the touched files have changed historically

Output:
  - risk_score: float 0.0 → 1.0
  - risk_level: 'low' | 'medium' | 'high'

Full implementation on Day 5.
"""

WEIGHTS = {
    "fan_out": 0.35,
    "core_module": 0.30,
    "diff_size": 0.20,
    "change_frequency": 0.15,
}

FAN_OUT_MAX = 50
DIFF_SIZE_MAX = 500


def compute_risk_score(
    fan_out: int,
    core_module_touched: bool,
    diff_size: int,
    change_frequency: float,  # normalized 0.0 → 1.0
) -> tuple[float, str]:
    """
    Returns (risk_score, risk_level).
    risk_score is a float 0.0 → 1.0.
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
