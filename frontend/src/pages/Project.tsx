import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FolderGit2,
  GitBranch,
  Radar,
  RefreshCw,
  Search as SearchIcon,
  Play,
  GitPullRequest,
  CheckCircle2,
} from "lucide-react";
import { useProject, useSyncProject } from "@/hooks/useProjects";
import { useAnalyses } from "@/hooks/useAnalyses";
import { useCrumbs } from "@/hooks/useCrumbs";
import { useLastProject } from "@/hooks/useLastProject";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { RiskTag } from "@/components/RiskTag";
import { RunAnalysisModal } from "@/components/RunAnalysisModal";
import { relativeTime } from "@/lib/relativeTime";
import type { RiskLevel } from "@/types/analysis";

type SyncBanner = "idle" | "indexing" | "done";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // syncBanner drives both the "still indexing" polling AND the banner
  // text below -- previously the banner was tied to syncProject.isSuccess,
  // which only reflects "the sync request was accepted" and never resets,
  // so it kept saying "indexing…" long after indexing had actually
  // finished. Now it's cleared the moment we actually observe
  // indexed_at move past the timestamp it had when sync was clicked.
  const [syncBanner, setSyncBanner] = useState<SyncBanner>("idle");
  const preSyncIndexedAt = useRef<string | null>(null);

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    refetch: refetchProject,
  } = useProject(projectId, { poll: syncBanner === "indexing" });
  const { data: analyses, isLoading: analysesLoading, isError: analysesError, refetch: refetchAnalyses } = useAnalyses(projectId);
  const syncProject = useSyncProject(projectId ?? "");
  const [runAnalysisOpen, setRunAnalysisOpen] = useState(false);
  const { setProject: setLastProject } = useLastProject();

  useCrumbs([{ label: "Dashboard", to: "/" }, { label: project?.name ?? "Project" }]);

  useEffect(() => {
    if (project) setLastProject({ id: project.id, name: project.name });
    // setLastProject is stable (useCallback), only re-run when the project changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Detect real completion: once indexed_at advances past whatever it was
  // right before we clicked Sync, indexing has actually finished.
  useEffect(() => {
    if (syncBanner !== "indexing" || !project) return;
    if (project.indexed_at && project.indexed_at !== preSyncIndexedAt.current) {
      setSyncBanner("done");
      const timer = setTimeout(() => setSyncBanner("idle"), 4_000);
      return () => clearTimeout(timer);
    }
  }, [project, syncBanner]);

  function handleSync() {
    preSyncIndexedAt.current = project?.indexed_at ?? null;
    setSyncBanner("indexing");
    syncProject.mutate();
  }

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
            icon={<RefreshCw className={syncBanner === "indexing" ? "size-3.5 animate-spin" : "size-3.5"} />}
            disabled={syncBanner === "indexing"}
            onClick={handleSync}
          >
            {syncBanner === "indexing" ? "Syncing…" : "Sync now"}
          </Button>
          <Button variant="secondary" icon={<SearchIcon className="size-3.5" />} onClick={() => navigate(`/projects/${projectId}/search`)}>
            Search code
          </Button>
          <Button icon={<Play className="size-3.5" />} onClick={() => setRunAnalysisOpen(true)}>
            Run analysis
          </Button>
        </div>
      </div>

      {syncBanner === "indexing" && (
        <p className="mb-4 flex items-center gap-2 rounded border border-hairline bg-panel px-3 py-2 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5 shrink-0 animate-spin text-signal" />
          Indexing in progress -- parsing files, building the dependency graph, and generating embeddings. This
          page updates automatically once it's done.
        </p>
      )}
      {syncBanner === "done" && (
        <p className="mb-4 flex items-center gap-2 rounded border border-hairline bg-panel px-3 py-2 text-xs text-[var(--risk-low)]">
          <CheckCircle2 className="size-3.5 shrink-0" />
          Indexing complete -- search and dependency data are up to date.
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