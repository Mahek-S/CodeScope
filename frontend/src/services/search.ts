import { api } from "@/lib/api";
import type { SearchResponse } from "@/types/search";

export const searchApi = {
    search: (projectId: string, query: string, limit = 10) =>
        api.get<SearchResponse>(
            `/projects/${projectId}/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        ),
};