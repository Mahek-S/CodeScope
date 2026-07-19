"""
LangGraph workflow definition for impact analysis.
"""
from langgraph.graph import END, StateGraph

from ai.nodes import (
    build_context,
    compute_risk_score,
    format_output,
    load_changed_files,
    llm_reasoning,
    retrieve_similar_bugs,
    traverse_dependency_graph,
    post_github_comment
)
from ai.state import ImpactAnalysisState


def build_impact_analysis_graph() -> StateGraph:
    """
    Construct and compile the LangGraph state machine.

    Day 5 graph shape (deterministic infra -> LLM synthesis, JSON out --
    no GitHub posting yet):

    load_changed_files
      -> traverse_dependency_graph
      -> compute_risk_score
      -> retrieve_similar_bugs
      -> build_context
      -> llm_reasoning
      -> format_output
      -> END

    ai/nodes.post_github_comment is implemented but intentionally left
    out of this graph -- it gets appended between format_output and END
    on Day 6, once services/analysis_service also handles storing the
    resulting GitHub comment ID.
    """
    graph = StateGraph(ImpactAnalysisState)

    graph.add_node("load_changed_files", load_changed_files)
    graph.add_node("traverse_dependency_graph", traverse_dependency_graph)
    graph.add_node("compute_risk_score", compute_risk_score)
    graph.add_node("retrieve_similar_bugs", retrieve_similar_bugs)
    graph.add_node("build_context", build_context)
    graph.add_node("llm_reasoning", llm_reasoning)
    graph.add_node("format_output", format_output)
    graph.add_node("post_github_comment", post_github_comment)

    graph.set_entry_point("load_changed_files")
    graph.add_edge("load_changed_files", "traverse_dependency_graph")
    graph.add_edge("traverse_dependency_graph", "compute_risk_score")
    graph.add_edge("compute_risk_score", "retrieve_similar_bugs")
    graph.add_edge("retrieve_similar_bugs", "build_context")
    graph.add_edge("build_context", "llm_reasoning")
    graph.add_edge("llm_reasoning", "format_output")
    graph.add_edge("format_output", "post_github_comment")
    graph.add_edge("post_github_comment", END)

    return graph.compile()


# Module-level compiled graph instance -- reused across tasks
impact_analysis_graph = build_impact_analysis_graph()