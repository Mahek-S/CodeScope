// Mirrors backend/schemas/user.py::CurrentUserSchema exactly.
export type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  github_username: string | null;
};
