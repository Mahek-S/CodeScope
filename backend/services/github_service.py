"""
PyGithub wrapper for all GitHub API interactions.
"""
import httpx
from github import Github
from config import settings

GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE = "https://api.github.com"


class GitHubService:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.client = Github(access_token)

    ## OAuth
    # These run before we have a token/instance at all, so they stay static.

    @staticmethod
    async def exchange_code_for_token(code: str) -> str:
        """Exchange OAuth callback code for a GitHub access token."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GITHUB_OAUTH_TOKEN_URL,
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        if "access_token" not in data:
            raise ValueError(f"GitHub OAuth exchange failed: {data}")
        return data["access_token"]

    @staticmethod
    async def fetch_github_user(access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            return resp.json()

    ## Repository Operations
    # These require an authenticated instance, so they use self.client.

    def get_user(self):
        return self.client.get_user()

    def get_repository(self, repo_full_name: str):
        """Return the raw PyGithub Repository object."""
        return self.client.get_repo(repo_full_name)

    def get_repo(self, repo_full_name: str) -> dict:
        """Return a plain dict summary of a repo (for API responses)."""
        repo = self.get_repository(repo_full_name)
        return {
            "id": repo.id,
            "full_name": repo.full_name,
            "html_url": repo.html_url,
            "default_branch": repo.default_branch,
        }

    def list_user_repos(self) -> list[dict]:
        """List repos the authenticated user has access to."""
        return [
            {
                "full_name": repo.full_name,
                "html_url": repo.html_url,
                "default_branch": repo.default_branch,
                "private": repo.private,
            }
            for repo in self.get_user().get_repos()
        ]

    ## Webhooks

    def create_repo_webhook(self, repo_full_name: str, webhook_url: str, secret: str) -> int:
        """Create a webhook on the repo for push + pull_request events. Returns webhook ID."""
        repo = self.get_repository(repo_full_name)
        hook = repo.create_hook(
            name="web",
            config={
                "url": webhook_url,
                "content_type": "json",
                "secret": secret,
            },
            events=["push", "pull_request"],
            active=True,
        )
        return hook.id

    ## Pull Requests

    def get_pull_request(self, repo_full_name: str, pr_number: int):
        repo = self.get_repository(repo_full_name)
        return repo.get_pull(pr_number)

    def get_pr_files(self, repo_full_name: str, pr_number: int) -> list:
        """
        Return the raw PyGithub File objects for a PR, fetched once.
        Callers that need both filenames and diff stats (e.g.
        analysis_service) should use this directly rather than calling
        get_pr_changed_files + get_pr_diff_size separately, which would
        hit the GitHub API twice for the same data.
        """
        pr = self.get_pull_request(repo_full_name, pr_number)
        return list(pr.get_files())


    def get_pr_changed_files(self, repo_full_name: str, pr_number: int) -> list[str]:
        return [f.filename for f in self.get_pr_files(repo_full_name, pr_number)]


    def get_pr_diff_size(self, repo_full_name: str, pr_number: int) -> int:
        """Total lines added + removed across the PR — a risk-scoring input."""
        return sum(f.additions + f.deletions for f in self.get_pr_files(repo_full_name, pr_number))

    
    def post_pr_comment(self, repo_full_name: str, pr_number: int, body: str) -> int:
        """Post a comment on a PR and return the comment ID."""
        pr = self.get_pull_request(repo_full_name, pr_number)
        comment = pr.create_issue_comment(body)
        return comment.id