import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/services/auth";
import { ApiError } from "@/lib/api";

export const CURRENT_USER_QUERY_KEY = ["currentUser"] as const;

/**
 * Wraps GET /auth/me in a query. This is the ONLY auth check in the
 * app -- App.tsx gates the whole tree on the result, no page does its
 * own check. A 401 is expected (logged-out state), not an error to
 * retry, so it's treated as "no user" rather than surfaced as a fetch
 * failure.
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
  });

  const logout = async () => {
    await authApi.logout();
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
    // Drop every other cached resource too -- the next login could be
    // a different GitHub account with different orgs/projects.
    queryClient.clear();
  };

  const status: "loading" | "authenticated" | "unauthenticated" = query.isLoading
    ? "loading"
    : query.data
      ? "authenticated"
      : "unauthenticated";

  return { user: query.data ?? null, status, logout };
}
