import { api } from "@/lib/api";
import type {
    AnalysisDetail,
    AnalysisSummary,
    TriggerAnalysisPayload,
    TriggerAnalysisResponse,
} from "@/types/analysis";

export const analysesApi = {
    list: (projectId: string) => api.get<AnalysisSummary[]>(`/projects/${projectId}/analyses`),
    get: (analysisId: string) => api.get<AnalysisDetail>(`/analyses/${analysisId}`),
    trigger: (projectId: string, payload: TriggerAnalysisPayload) =>
        api.post<TriggerAnalysisResponse>(`/projects/${projectId}/analyses`, payload),
};