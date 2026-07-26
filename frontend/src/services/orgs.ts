import { api } from "@/lib/api";
import type { Organization } from "@/types/organization";

export const orgsApi = {
  list: () => api.get<Organization[]>("/orgs"),
  create: (name: string) => api.post<Organization>("/orgs", { name }),
};
