import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analysesApi } from "@/services/analyses";
import type { TriggerAnalysisPayload } from "@/types/analysis";

export const analysisKeys = {
    list: (projectId: string) => ["analyses", "project", projectId] as const,
    detail: (analysisId: string) => ["analyses", "detail", analysisId] as const,
};

export function useAnalyses(projectId: string | undefined) {
    return useQuery({
        queryKey: analysisKeys.list(projectId ?? ""),
        queryFn: () => analysesApi.list(projectId!),
        enabled: Boolean(projectId),
        // A running analysis can complete in the background -- poll gently
        // rather than making the user manually refresh the list.
        refetchInterval: 15_000,
    });
}

export function useAnalysis(analysisId: string | undefined) {
    return useQuery({
        queryKey: analysisKeys.detail(analysisId ?? ""),
        queryFn: () => analysesApi.get(analysisId!),
        enabled: Boolean(analysisId),
    });
}

export function useTriggerAnalysis(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: TriggerAnalysisPayload) => analysesApi.trigger(projectId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analysisKeys.list(projectId) });
        },
    });
}