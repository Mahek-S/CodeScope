"""
LangGraph node functions for the impact analysis workflow.
Full implementation on Day 5.
"""
from ai.state import ImpactAnalysisState


async def load_changed_files(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """Node 1: Fetch changed files from DB (already in state from webhook)."""
    # TODO Day 5
    return state


async def traverse_dependency_graph(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 2: BFS/DFS over dependency edges.
    Finds all files that import the changed files (direct + transitive).
    Populates state['directly_affected'] and state['transitively_affected'].
    """
    # TODO Day 5
    return {**state, "directly_affected": [], "transitively_affected": []}


async def compute_risk_score(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 3: Deterministic risk scoring — no LLM involved.
    Populates state['risk_score'] and state['risk_level'].
    """
    # TODO Day 5
    return {**state, "risk_score": 0.0, "risk_level": "low"}


async def retrieve_similar_bugs(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 4: pgvector similarity search for past analyses.
    Populates state['similar_bugs'].
    """
    # TODO Day 5
    return {**state, "similar_bugs": []}


async def build_context(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """Node 5: Assemble structured context string for the LLM."""
    # TODO Day 5
    return state


async def llm_reasoning(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """
    Node 6: Send context to Claude/GPT.
    LLM explains the risk score — does not invent or override it.
    Populates state['explanation'], state['suggested_tests'], state['raw_llm_output'].
    """
    # TODO Day 5
    return {**state, "explanation": "", "suggested_tests": [], "raw_llm_output": ""}


async def format_output(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """Node 7: Structure final output for GitHub comment and DB storage."""
    # TODO Day 5
    return state


async def post_github_comment(state: ImpactAnalysisState) -> ImpactAnalysisState:
    """Node 8: Format markdown and post via GitHub API."""
    # TODO Day 6
    return state
