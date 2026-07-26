import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useGithubRepos, useCreateProject } from "@/hooks/useProjects";
import { Lock, Globe } from "lucide-react";

export function ConnectRepositoryModal({
  open,
  onClose,
  orgId,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
}) {
  const [repoFullName, setRepoFullName] = useState("");
  const [name, setName] = useState("");

  const { data: repos, isLoading: reposLoading, isError: reposError } = useGithubRepos(orgId, open);
  const createProject = useCreateProject(orgId);
  const navigate = useNavigate();

  const selectedRepo = repos?.find((r) => r.full_name === repoFullName);

  function handleRepoChange(fullName: string) {
    setRepoFullName(fullName);
    // Default the project name to the repo name, editable after.
    if (!name || name === repoFullName.split("/")[1]) {
      setName(fullName.split("/")[1] ?? "");
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedRepo || !name.trim()) return;

    createProject.mutate(
      {
        name: name.trim(),
        repo_full_name: selectedRepo.full_name,
        repo_url: selectedRepo.html_url,
        default_branch: selectedRepo.default_branch,
      },
      {
        onSuccess: (project) => {
          reset();
          onClose();
          navigate(`/projects/${project.id}`);
        },
      },
    );
  }

  function reset() {
    setRepoFullName("");
    setName("");
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Connect repository"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">GitHub repository</label>

          {reposLoading && <p className="text-sm text-muted-foreground">Loading your repositories…</p>}
          {reposError && <p className="text-sm text-[var(--risk-high)]">Couldn't load repositories from GitHub.</p>}

          {repos && repos.length === 0 && (
            <p className="text-sm text-muted-foreground">No repositories found on your GitHub account.</p>
          )}

          {repos && repos.length > 0 && (
            <select
              value={repoFullName}
              onChange={(e) => handleRepoChange(e.target.value)}
              className="h-9 w-full rounded border border-hairline bg-background px-2.5 text-sm text-foreground outline-none focus:border-signal"
            >
              <option value="" disabled>
                Select a repository…
              </option>
              {repos.map((repo) => (
                <option key={repo.full_name} value={repo.full_name}>
                  {repo.full_name}
                </option>
              ))}
            </select>
          )}

          {selectedRepo && (
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              {selectedRepo.private ? <Lock className="size-3" /> : <Globe className="size-3" />}
              {selectedRepo.private ? "Private" : "Public"} · default branch{" "}
              <span className="text-foreground">{selectedRepo.default_branch}</span>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="project-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Project name
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="payments-core"
            className="h-9 w-full rounded border border-hairline bg-background px-3 text-sm text-foreground outline-none focus:border-signal"
          />
        </div>

        {createProject.isError && (
          <p className="text-xs text-[var(--risk-high)]">
            Couldn't connect this repository. Check that CodeScope has access and try again.
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!selectedRepo || !name.trim() || createProject.isPending}>
            {createProject.isPending ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
