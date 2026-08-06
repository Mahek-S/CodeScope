// Mirrors backend/schemas/analysis.py

export type RiskLevel = "low" | "medium" | "high";

// Shape of one entry inside Analysis.similar_past_bugs.items
// (see backend/services/search_service.py::find_similar_past_analyses)
export type SimilarPastBug = {
    analysis_id: string;
    pr_number: number | null;
    risk_level: RiskLevel | null;
    overlapping_files: string[];
    created_at: string | null;
};

export type ProjectSummary = {
    id: string;
    name: string;
    repo_full_name: string;
    org_id: string;
};

// GET /projects/{project_id}/analyses -- list view (AnalysisSummarySchema)
export type AnalysisSummary = {
    id: string;
    pr_number: number | null;
    trigger: "pr_opened" | "manual" | null;
    risk_level: RiskLevel | null;
    risk_score: number | null;
    created_at: string;
};

// GET /analyses/{analysis_id} -- detail view (AnalysisDetailSchema)
export type AnalysisDetail = AnalysisSummary & {
    project: ProjectSummary;
    changed_files: string[] | null;
    directly_affected: string[] | null;
    transitively_affected: string[] | null;
    similar_past_bugs: { items: SimilarPastBug[] } | null;
    suggested_tests: string[] | null;
    evidence: string[] | null;
    potential_issues: string[] | null;
    explanation: string | null;
    github_comment_id: number | null;
};

// POST /projects/{project_id}/analyses body (AnalysisTriggerSchema)
export type TriggerAnalysisPayload = {
    pr_number: number;
};

// POST /projects/{project_id}/analyses response (202 Accepted)
export type TriggerAnalysisResponse = {
    detail: string;
    task_id: string;
};