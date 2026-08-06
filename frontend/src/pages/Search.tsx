import { useState } from "react";
import { useParams } from "react-router-dom";
import { FolderGit2, Search as SearchIcon, ScanSearch, Loader2, AlertTriangle } from "lucide-react";
import { useCrumbs } from "@/hooks/useCrumbs";
import { useProject } from "@/hooks/useProjects";
import { useSearch } from "@/hooks/useSearch";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { RepositoryTabs } from "@/components/RepositoryTabs";
import { cn } from "@/lib/cn";

export function SearchPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);

  useCrumbs([
    { label: "Dashboard", to: "/" },
    {
      label: "Repositories",
      to: `/orgs/${project.org_id}/projects`,
    },
    {
      label: project.name,
      to: `/projects/${project.id}`,
    },
    { label: "Search" },
  ]);

  const { data, isLoading, isFetching, isError, refetch } = useSearch(projectId, debouncedQuery);

  const hasQuery = debouncedQuery.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 rounded-md border border-hairline bg-panel px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded border border-hairline bg-panel-raised text-muted-foreground">
            <FolderGit2 className="size-4" />
          </span>

          <div>
            <p className="text-sm font-medium text-foreground">
              {project?.name}
            </p>

            <p className="font-mono text-[11px] text-muted-foreground">
              {project?.repo_full_name}
            </p>
          </div>
        </div>
      </div>
      <RepositoryTabs projectId={projectId!} />
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">
          Code Search
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Search this repository using semantic similarity.
        </p>
      </div>
      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find files related to…"
          className="h-11 w-full rounded-md border border-hairline bg-panel pl-10 pr-3 text-sm text-foreground outline-none focus:border-signal"
        />
        {isFetching && !isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
            searching…
          </span>
        )}
      </div>

      {!hasQuery && (
        <EmptyState
          icon={<ScanSearch className="size-4" />}
          title="Start typing to search"
          body="Results are ranked by embedding similarity over each file's imports, classes, and functions."
        />
      )}

      {hasQuery && isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {hasQuery && isError && <ErrorState message="Search failed. Try again." onRetry={() => refetch()} />}

      {hasQuery && !isLoading && !isError && data && data.status !== "ready" && (
        <IndexStatusState status={data.status} />
      )}

      {hasQuery && !isLoading && !isError && data && data.status === "ready" && data.results.length === 0 && (
        <EmptyState
          icon={<FolderGit2 className="size-4" />}
          title="No matching files"
          body="Try a different phrase -- nothing in this repository matched closely enough."
        />
      )}

      {hasQuery && !isLoading && !isError && data && data.status === "ready" && data.results.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.results.map((result) => (
            <SearchResultRow key={result.filepath} filepath={result.filepath} classes={result.classes} functions={result.functions} similarity={result.similarity} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Distinguishes "nothing to search yet" (project never synced, or files
 * are indexed but embeddings haven't caught up yet) from a genuine empty
 * result set -- previously both looked identical (an empty results
 * array), which made search on a freshly-created project look broken
 * rather than just early.
 */
function IndexStatusState({ status }: { status: "not_indexed" | "indexing" | "model_unavailable" }) {
  if (status === "not_indexed") {
    return (
      <EmptyState
        icon={<ScanSearch className="size-4" />}
        title="This project hasn't been indexed yet"
        body="Sync the repository from the project page first -- search needs at least one completed index."
      />
    );
  }

  if (status === "model_unavailable") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-hairline bg-panel px-6 py-10 text-center">
        <AlertTriangle className="size-5 text-[var(--risk-med)]" />
        <div>
          <p className="text-sm font-medium text-foreground">Search is temporarily unavailable</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            The embedding model couldn't load on the server. This is a backend issue, not something wrong with
            your project -- try again shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-hairline bg-panel px-6 py-10 text-center">
      <Loader2 className="size-5 animate-spin text-signal" />
      <div>
        <p className="text-sm font-medium text-foreground">Indexing project…</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Files are parsed and embeddings are still being generated. This usually takes a minute or two after a
          sync -- search will start returning results as soon as it's done.
        </p>
      </div>
    </div>
  );
}

function SearchResultRow({
  filepath,
  classes,
  functions,
  similarity,
}: {
  filepath: string;
  classes: string[];
  functions: string[];
  similarity: number;
}) {
  const percent = Math.round(Math.max(0, Math.min(1, similarity)) * 100);
  const parts = filepath.split("/");
  const name = parts.pop();
  const dir = parts.length ? parts.join("/") + "/" : "";

  return (
    <div className="rounded-md border border-hairline bg-panel p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <FolderGit2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm">
              <span className="text-muted-foreground">{dir}</span>
              <span className="text-foreground">{name}</span>
            </p>
            {(classes.length > 0 || functions.length > 0) && (
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                {classes.slice(0, 3).join(", ")}
                {classes.length > 0 && functions.length > 0 ? " · " : ""}
                {functions.slice(0, 4).join(", ")}
              </p>
            )}
          </div>
        </div>
        <SimilarityBadge percent={percent} />
      </div>
    </div>
  );
}

function SimilarityBadge({ percent }: { percent: number }) {
  const tone = percent >= 70 ? "text-[var(--risk-low)]" : percent >= 40 ? "text-[var(--risk-med)]" : "text-muted-foreground";
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="h-1 w-14 overflow-hidden rounded-full bg-panel-raised">
        <div className={cn("h-full rounded-full bg-current", tone)} style={{ width: `${percent}%` }} />
      </div>
      <span className={cn("w-9 text-right font-mono text-[11px] tabular-nums", tone)}>{percent}%</span>
    </div>
  );
}