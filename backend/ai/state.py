"""
LangGraph state definition for the impact analysis workflow.
"""
from typing import TypedDict


class ImpactAnalysisState(TypedDict):
    """
    Shared state passed through the LangGraph workflow.
    Each node reads from and writes to this state.
    """
    project_id: str
    pr_number: int
    changed_files: list[str]
    diff_size: int
    directly_affected: list[str]
    transitively_affected: list[str]
    risk_score: float
    risk_level: str
    similar_bugs: list[dict]
    explanation: str
    evidence: list[str]
    potential_issues: list[str]
    heuristic_test_files: list[str]
    llm_testing_areas: list[str]
    suggested_tests: list[str]
    comment_markdown: str
    github_comment_id: int | None
    raw_llm_output: str