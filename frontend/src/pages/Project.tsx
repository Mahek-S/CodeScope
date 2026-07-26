import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FolderGit2,
  GitBranch,
  Radar,
  RefreshCw,
  Search as SearchIcon,
  Play,
  GitPullRequest,
} from "lucide-react";
import { useProject, useSyncProject } from "@/hooks/useProjects";
import { useAnalyses } from "@/hooks/useAnalyses";
import { useCrumbs } from "@/hooks/useCrumbs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { RiskTag } from "@/components/RiskTag";
import { RunAnalysisModal } from "@/components/RunAnalysisModal";
import { relativeTime } from "@/lib/relativeTime";
import type { RiskLevel } from "@/types/analysis";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading, isError: projectError, refetch: refetchProject } = useProject(projectId);
  const { data: analyses, isLoading: analysesLoading, isError: analysesError, refetch: refetchAnalyses } = useAnalyses(projectId);
  const syncProject = useSyncProject(projectId ?? "");
  const [runAnalysisOpen, setRunAnalysisOpen] = useState(false);

  useCrumbs([{ label: "Dashboard", to: "/" }, { label: project?.name ?? "Project" }]);

  if (!projectId) return null;

  if (projectLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ErrorState message="Couldn't load this project." onRetry={() => refetchProject()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Repo identity header */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-hairline bg-panel px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded border border-hairline bg-panel-raised text-muted-foreground">
            <FolderGit2 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{project.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{project.repo_full_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded border border-hairline bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <GitBranch className="size-3.5" /> {project.default_branch}
        </div>

        <span className="font-mono text-[11px] text-muted-foreground">
          {project.indexed_at ? `Indexed ${relativeTime(project.indexed_at)}` : "Not indexed yet"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className={syncProject.isPending ? "size-3.5 animate-spin" : "size-3.5"} />}
            disabled={syncProject.isPending}
            onClick={() => syncProject.mutate()}
          >
            {syncProject.isPending ? "Syncing…" : "Sync now"}
          </Button>
          <Button variant="secondary" icon={<SearchIcon className="size-3.5" />} onClick={() => navigate(`/projects/${projectId}/search`)}>
            Search code
          </Button>
          <Button icon={<Play className="size-3.5" />} onClick={() => setRunAnalysisOpen(true)}>
            Run analysis
          </Button>
        </div>
      </div>

      {syncProject.isSuccess && (
        <p className="mb-4 rounded border border-hairline bg-panel px-3 py-2 text-xs text-muted-foreground">
          Indexing started in the background. This page will reflect the new dependency graph once it finishes.
        </p>
      )}

      {/* Analysis history */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Analysis history</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Runs automatically when a pull request opens, or on demand above.
          </p>
        </div>
      </div>

      {analysesLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {analysesError && <ErrorState message="Couldn't load analysis history." onRetry={() => refetchAnalyses()} />}

      {!analysesLoading && !analysesError && analyses && analyses.length === 0 && (
        <EmptyState
          icon={<Radar className="size-4" />}
          title="No analyses yet"
          body="Run one manually, or open a pull request on GitHub -- CodeScope analyzes it automatically."
          action={
            <Button icon={<Play className="size-4" />} onClick={() => setRunAnalysisOpen(true)}>
              Run analysis
            </Button>
          }
        />
      )}

      {!analysesLoading && !analysesError && analyses && analyses.length > 0 && (
        <div className="overflow-hidden rounded-md border border-hairline bg-panel">
          <div className="divide-y divide-hairline/70">
            {analyses.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/analyses/${a.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-raised/60"
              >
                <GitPullRequest className="size-4 shrink-0 text-signal" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">PR #{a.pr_number ?? "—"}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {a.trigger === "pr_opened" ? "auto · PR opened" : "manual"} · {relativeTime(a.created_at)}
                  </p>
                </div>
                {a.risk_level ? (
                  <RiskTag
                    risk={a.risk_level as RiskLevel}
                    label={a.risk_score !== null ? `${a.risk_level} · ${Math.round(a.risk_score * 100)}/100` : a.risk_level}
                  />
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">pending…</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <RunAnalysisModal open={runAnalysisOpen} onClose={() => setRunAnalysisOpen(false)} projectId={projectId} />
    </div>
  );
}