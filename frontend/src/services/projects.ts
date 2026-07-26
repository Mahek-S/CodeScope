import { api } from "@/lib/api";
import type { AffectedFilesResult, GithubRepo, Project } from "@/types/project";

export type CreateProjectPayload = {
  name: string;
  repo_full_name: string;
  repo_url: string;
  default_branch?: string;
};

export const projectsApi = {
  listGithubRepos: (orgId: string) => api.get<GithubRepo[]>(`/orgs/${orgId}/github-repos`),
  list: (orgId: string) => api.get<Project[]>(`/orgs/${orgId}/projects`),
  create: (orgId: string, payload: CreateProjectPayload) =>
    api.post<Project>(`/orgs/${orgId}/projects`, payload),
  get: (projectId: string) => api.get<Project>(`/projects/${projectId}`),
  sync: (projectId: string) =>
    api.post<{ detail: string; task_id: string }>(`/projects/${projectId}/sync`),
  getAffectedFiles: (projectId: string, files: string[]) =>
    api.get<AffectedFilesResult>(
      `/projects/${projectId}/affected-files?files=${encodeURIComponent(files.join(","))}`,
    ),
};
