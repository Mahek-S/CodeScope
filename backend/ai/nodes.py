"""
LangGraph node functions for the impact analysis workflow.

Each node is a (near-)pure function of ImpactAnalysisState: it reads
whatever keys it needs and returns a merged copy with its own keys
populated. Nodes that need the database open their own short-lived
SessionLocal rather than receiving one injected -- there's no
request-scoped FastAPI session here, since this graph also runs from
inside a Celery worker (see workers/analysis_tasks.py), so each node
follows the same "open, use, close" pattern already used elsewhere in
workers/.
"""
from __future__ import annotations

import logging

from database import SessionLocal
from ai.llm_client import call_llm, parse_llm_response
from ai.prompts import IMPACT_ANALYSIS_SYSTEM_PROMPT, IMPACT_ANALYSIS_USER_TEMPLATE
from ai.state import ImpactAnalysisState
from services import graph_service, risk_service, search_service

from models.project import Project
from services.github_service import GitHubService
from services.indexing_service import get_repo_access_token

logger = logging.getLogger(__name__)


async def load_changed_files(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 1: changed_files (and diff_size) are already populated in state
    by analysis_service.trigger_analysis before the graph is invoked --
    resolving them requires a GitHub API call, which happens once at the
    entrypoint rather than being repeated here. This node just validates.
    """
    if not state.get("changed_files"):
        logger.warning(
            "No changed files for project %s PR #%s -- analysis will be a no-op",
            state.get("project_id"), state.get("pr_number"),
        )
    return state


async def traverse_dependency_graph(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 2: BFS over the reverse-dependency graph to find every file
    affected by the changed files (direct + transitive).
    """
    db = SessionLocal()
    try:
        directly_affected, transitively_affected = graph_service.find_affected_files(
            db, state["project_id"], state["changed_files"]
        )
    finally:
        db.close()

    return {
        **state,
        "directly_affected": directly_affected,
        "transitively_affected": transitively_affected,
    }


async def compute_risk_score(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 3: Deterministic risk scoring -- no LLM involved. Combines
    fan-out (from Node 2), whether a core/infra module was touched, the
    PR's diff size (resolved up front by analysis_service), and how
    often the touched files have historically changed.
    """
    db = SessionLocal()
    try:
        change_frequency = risk_service.compute_change_frequency(
            db, state["project_id"], state["changed_files"]
        )
    finally:
        db.close()

    fan_out = len(state["directly_affected"]) + len(state["transitively_affected"])
    core_module_touched = risk_service.any_core_module_touched(state["changed_files"])

    risk_score, risk_level = risk_service.compute_risk_score(
        fan_out=fan_out,
        core_module_touched=core_module_touched,
        diff_size=state.get("diff_size", 0),
        change_frequency=change_frequency,
    )

    return {**state, "risk_score": risk_score, "risk_level": risk_level}


async def retrieve_similar_bugs(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 4: pgvector similarity search for past analyses that touched
    semantically similar files. See search_service.find_similar_past_analyses
    for why this goes through file embeddings rather than a dedicated
    analysis-embedding column (the schema doesn't have one at v1).
    """
    db = SessionLocal()
    try:
        similar_bugs = search_service.find_similar_past_analyses(
            db, state["project_id"], state["changed_files"]
        )
    finally:
        db.close()

    return {**state, "similar_bugs": similar_bugs}


async def build_context(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 5: Assemble structured context for the LLM.

    There's nothing to compute here -- llm_reasoning formats state
    straight into the prompt template -- but the node is kept as its own
    graph step (rather than folded into llm_reasoning) so the workflow's
    shape matches the documented 8-node design and each step stays
    independently testable/loggable.
    """
    return state


async def llm_reasoning(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 6: Send the deterministic results to the LLM. The LLM explains
    the risk score and suggests tests -- it never sees an unscored
    change and is explicitly instructed not to override the score (see
    ai/prompts.IMPACT_ANALYSIS_SYSTEM_PROMPT).
    """
    prompt = IMPACT_ANALYSIS_USER_TEMPLATE.format(
        pr_number=state.get("pr_number", "-"),
        risk_level=state["risk_level"],
        risk_score=state["risk_score"],
        changed_files=_bullet_list(state["changed_files"]),
        directly_affected=_bullet_list(state["directly_affected"]),
        transitively_affected=_bullet_list(state["transitively_affected"]),
        similar_bugs=_format_similar_bugs(state["similar_bugs"]),
    )

    raw_output = ""
    try:
        raw_output = await call_llm(IMPACT_ANALYSIS_SYSTEM_PROMPT, prompt)
        logger.info("=" * 60)
        logger.info("RAW LLM RESPONSE:")
        logger.info(raw_output)
        logger.info("=" * 60)
    except Exception as e:
        # A failed LLM call degrades the analysis (no explanation) rather
        # than failing it outright -- the deterministic risk score and
        # affected-files list are still useful on their own.
        logger.error(
            "LLM reasoning failed for project %s PR #%s: %s",
            state["project_id"], state.get("pr_number"), e,
        )
    

    explanation, llm_testing_areas = parse_llm_response(raw_output) 
    logger.info("Parsed explanation: %s", explanation)
    logger.info("Testing areas: %s", llm_testing_areas)

    db = SessionLocal()
    try:
        heuristic_test_files = graph_service.suggest_test_files(
            db,
            state["project_id"],
            state["changed_files"] + state["directly_affected"],
        )
    finally:
        db.close()

    suggested_tests = sorted(set(llm_testing_areas) | set(heuristic_test_files))[:10]

    return {
        **state,
        "explanation": explanation or "No explanation available for this analysis.",
        "heuristic_test_files": heuristic_test_files,
        "llm_testing_areas": llm_testing_areas,
        "suggested_tests": suggested_tests,
        "raw_llm_output": raw_output,
    }


async def format_output(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """Node 7: Build the GitHub-facing markdown comment body."""
    return {**state, "comment_markdown": _build_pr_comment_markdown(state)}


async def post_github_comment(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 8: Post the formatted comment via the GitHub API.

    A failure here degrades the same way an LLM failure does: the
    analysis is already computed and still gets persisted by
    analysis_service regardless of whether the comment posts, so this
    logs and returns github_comment_id=None rather than raising and
    losing a fully-computed analysis over a GitHub API hiccup.
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == state["project_id"]).first()
        if not project:
            logger.warning("Cannot post PR comment: project %s not found", state["project_id"])
            return {**state, "github_comment_id": None}

        access_token = get_repo_access_token(db, project)
        github = GitHubService(access_token)
        comment_id = github.post_pr_comment(
            project.repo_full_name, state["pr_number"], state["comment_markdown"]
        )
    except Exception as e:
        logger.error(
            "Failed to post PR comment for project %s PR #%s: %s",
            state["project_id"], state.get("pr_number"), e,
        )
        return {**state, "github_comment_id": None}
    finally:
        db.close()

    return {**state, "github_comment_id": comment_id}


_RISK_BADGES = {"low": "🟢", "medium": "🟡", "high": "🔴"}


def _build_pr_comment_markdown(state: ImpactAnalysisState) -> str:
    risk_level = state["risk_level"]
    badge = _RISK_BADGES.get(risk_level, "⚪")
    score_pct = round(state["risk_score"] * 100)

    lines = [
        "## CodeScope Impact Analysis",
        "",
        "| Risk | Score |",
        "|------|-------|",
        f"| {badge} **{risk_level.upper()}** | {score_pct}/100 |",
        "",
        "### Changed Files",
        _bullet_list(state["changed_files"]),
        "",
        "### Directly Affected",
        _bullet_list(state["directly_affected"]),
        "",
        "### Transitively Affected",
        _bullet_list(state["transitively_affected"]),
        "",
        "### Suggested Tests",
        _bullet_list(state.get("suggested_tests", [])),
        "",
        "### Why?",
        state.get("explanation") or "No explanation available for this analysis.",
    ]

    similar_bugs = state.get("similar_bugs") or []
    if similar_bugs:
        lines += [
            "",
            "<details>",
            "<summary>Similar historical changes</summary>",
            "",
        ]
        for bug in similar_bugs[:3]:
            overlap = ", ".join(bug.get("overlapping_files", [])[:3])
            lines.append(
                f"- PR #{bug.get('pr_number', '?')} "
                f"({bug.get('risk_level', 'unknown')} risk) — touched: {overlap}"
            )
        lines += ["", "</details>"]

    lines += [
        "",
        "---",
        "*Posted automatically by CodeScope — the risk score above is "
        "computed deterministically before the LLM explains it; the LLM "
        "does not set or override the score.*",
    ]

    return "\n".join(lines)


def _bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "(none)"


def _format_similar_bugs(bugs: list[dict]) -> str:
    if not bugs:
        return "(no similar past analyses found)"

    lines = []
    for bug in bugs:
        overlap = ", ".join(bug.get("overlapping_files", [])[:3])
        lines.append(
            f"- PR #{bug.get('pr_number', '?')} "
            f"({bug.get('risk_level', 'unknown')} risk) -- touched: {overlap}"
        )
    return "\n".join(lines)