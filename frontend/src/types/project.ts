export type Project = {
  id: string;
  org_id: string;
  name: string;
  github_repo_id: number;
  repo_full_name: string;
  repo_url: string;
  default_branch: string;
  webhook_id: number | null;
  indexed_at: string | null;
  created_at: string;
};

// Shape returned by GET /orgs/{org_id}/github-repos -- backend/services/github_service.py::list_user_repos
export type GithubRepo = {
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
};


// GET /projects/{project_id}/affected-files?files=a,b,c -- backend/routers/projects.py::get_affected_files
// A standalone "what would this touch" preview -- separate from a full Analysis,
// which additionally computes a risk score and an LLM explanation.
export type AffectedFilesResult = {
  changed_files: string[];
  directly_affected: string[];
  transitively_affected: string[];
};