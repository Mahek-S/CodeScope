import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/services/search";
import type { SearchResponse } from "@/types/search";

/**
 * Search only runs once `query` is non-empty -- the caller is expected to
 * debounce keystrokes before passing them in (see pages/Search.tsx).
 *
 * While the backend reports status !== "ready" (still indexing), this
 * polls every 4s so the page transitions to real results on its own once
 * embedding generation finishes, instead of showing a stale "indexing…"
 * message forever until the user retypes their query.
 */
export function useSearch(projectId: string | undefined, query: string, limit = 15) {
  return useQuery({
    queryKey: ["search", projectId, query, limit] as const,
    queryFn: () => searchApi.search(projectId!, query, limit),
    enabled: Boolean(projectId) && query.trim().length > 0,
    // Re-searching the same term a moment later should hit cache, not
    // re-embed the query on the backend -- except while still indexing,
    // where refetchInterval below overrides this to keep polling.
    staleTime: 30_000,
    refetchInterval: (query) => {
      const data = query.state.data as SearchResponse | undefined;
      return data && data.status !== "ready" ? 4_000 : false;
    },
  });
}