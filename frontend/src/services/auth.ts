import { api } from "@/lib/api";
import type { CurrentUser } from "@/types/user";

export const authApi = {
  me: () => api.get<CurrentUser>("/auth/me"),
  logout: () => api.post<{ detail: string }>("/auth/logout"),
};
