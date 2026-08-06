// Mirrors backend/services/search_service.py's STATUS_* constants
export type IndexStatus = "not_indexed" | "indexing" | "model_unavailable" | "ready";

// Mirrors the dict shape returned by backend/services/search_service.py::search_files
export type SearchResult = {
    filepath: string;
    classes: string[];
    functions: string[];
    // Cosine similarity, -1..1 (higher = more relevant)
    similarity: number;
};

// GET /projects/{project_id}/search?q=&limit= response body
export type SearchResponse = {
    query: string;
    results: SearchResult[];
    status: IndexStatus;
};