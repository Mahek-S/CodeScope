import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgsApi } from "@/services/orgs";

export const ORGS_QUERY_KEY = ["orgs"] as const;

export function useOrgs() {
  return useQuery({
    queryKey: ORGS_QUERY_KEY,
    queryFn: orgsApi.list,
  });
}

export function useCreateOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => orgsApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGS_QUERY_KEY });
    },
  });
}
