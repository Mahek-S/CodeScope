import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type CreateProjectPayload } from "@/services/projects";

export const projectKeys = {
  list: (orgId: string) => ["projects", "org", orgId] as const,
  detail: (projectId: string) => ["projects", "detail", projectId] as const,
  githubRepos: (orgId: string) => ["github-repos", orgId] as const,
};

export function useProjects(orgId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.list(orgId ?? ""),
    queryFn: () => projectsApi.list(orgId!),
    enabled: Boolean(orgId),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => projectsApi.get(projectId!),
    enabled: Boolean(projectId),
  });
}

// Only fetched when the "Connect Repository" flow is actually open --
// listing every repo the user has access to on every Projects-page
// visit would be wasteful.
export function useGithubRepos(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: projectKeys.githubRepos(orgId ?? ""),
    queryFn: () => projectsApi.listGithubRepos(orgId!),
    enabled: Boolean(orgId) && enabled,
    staleTime: 60_000,
  });
}

export function useCreateProject(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsApi.create(orgId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.list(orgId) });
    },
  });
}

export function useSyncProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsApi.sync(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}
