import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/services/search";

export const searchKeys = {
  query: (projectId: string, query: string) => ["search", projectId, query] as const,
};

export function useSearch(projectId: string | undefined, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: searchKeys.query(projectId ?? "", trimmed),
    queryFn: () => searchApi.search(projectId!, trimmed),
    enabled: Boolean(projectId) && trimmed.length > 0,
  });
}