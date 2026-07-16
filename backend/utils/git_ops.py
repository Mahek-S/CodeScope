"""
Git operations for the repository indexer.

Uses the system `git` binary via subprocess rather than a library like
GitPython — shallow clone + walk-the-filesystem is all the indexer needs,
and it avoids an extra dependency for something `git` already does well.
"""

import logging
import shutil
import subprocess
from pathlib import Path

CACHE_ROOT = Path("/tmp/codescope_repos")
CACHE_ROOT.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)

# Directories we never want to walk into, even if they contain .py files.
EXCLUDED_DIRS = {
    ".git",
    "venv",
    ".venv",
    "env",
    "__pycache__",
    "node_modules",
    "site-packages",
    "dist",
    "build",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
}

CLONE_TIMEOUT_SECONDS = 120


class GitOpsError(Exception):
    """Raised when a clone or filesystem operation fails."""


def clone_repository(
    repo_full_name: str,
    branch: str,
    access_token: str,
) -> Path:
    """
    Clone the repository if it isn't cached yet; otherwise fetch the latest
    changes and reset the working tree to the requested branch.

    Returns the local repository path. The repository cache is intentionally
    persistent across indexing runs to avoid recloning on every webhook.
    """

    repo_dir = get_repo_dir(repo_full_name)

    clone_url = (
        f"https://x-access-token:{access_token}"
        f"@github.com/{repo_full_name}.git"
    )

    try:
        if repo_dir.exists():
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(repo_dir),
                    "fetch",
                    "--prune",
                    "origin",
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=CLONE_TIMEOUT_SECONDS,
            )

            subprocess.run(
                [
                    "git",
                    "-C",
                    str(repo_dir),
                    "checkout",
                    "-B",
                    branch,
                    f"origin/{branch}",
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=CLONE_TIMEOUT_SECONDS,
            )

            subprocess.run(
                [
                    "git",
                    "-C",
                    str(repo_dir),
                    "reset",
                    "--hard",
                    f"origin/{branch}",
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=CLONE_TIMEOUT_SECONDS,
            )

            subprocess.run(
                [
                    "git",
                    "-C",
                    str(repo_dir),
                    "clean",
                    "-fd",
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=CLONE_TIMEOUT_SECONDS,
            )

        else:
            subprocess.run(
                [
                    "git",
                    "clone",
                    "--depth",
                    "1",
                    "--single-branch",
                    "--branch",
                    branch,
                    clone_url,
                    str(repo_dir),
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=CLONE_TIMEOUT_SECONDS,
            )

    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "").replace(access_token, "***")
        raise GitOpsError(
            f"Git operation failed for {repo_full_name}@{branch}: {stderr}"
        ) from e

    except subprocess.TimeoutExpired as e:
        raise GitOpsError(
            f"Git operation timed out after {CLONE_TIMEOUT_SECONDS}s"
        ) from e

    return repo_dir


def cleanup_repo_cache(repo_full_name: str):
    repo = get_repo_dir(repo_full_name)
    shutil.rmtree(repo, ignore_errors=True)


def discover_python_files(repo_root: Path) -> list[Path]:
    """Walk the repo, returning all .py files outside excluded directories."""
    return [
        path
        for path in repo_root.rglob("*.py")
        if not any(part in EXCLUDED_DIRS for part in path.parts)
    ]


def get_repo_dir(repo_full_name: str) -> Path:
    safe = repo_full_name.replace("/", "__")
    return CACHE_ROOT / safe