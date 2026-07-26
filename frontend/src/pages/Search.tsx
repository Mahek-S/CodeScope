import { useState } from "react";
import { useParams } from "react-router-dom";
import { FileCode2, Search as SearchIcon, ScanSearch } from "lucide-react";
import { useCrumbs } from "@/hooks/useCrumbs";
import { useProject } from "@/hooks/useProjects";
import { useSearch } from "@/hooks/useSearch";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

export function SearchPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);

  useCrumbs([
    { label: "Dashboard", to: "/" },
    { label: project?.name ?? "Project", to: projectId ? `/projects/${projectId}` : undefined },
    { label: "Search" },
  ]);

  const { data, isLoading, isFetching, isError, refetch } = useSearch(projectId, debouncedQuery);

  const hasQuery = debouncedQuery.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Semantic search</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Search {project?.name ?? "this repository"} by meaning, not just filename -- e.g. "payment processing" or
          "retry logic".
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

      {hasQuery && !isLoading && !isError && data && data.results.length === 0 && (
        <EmptyState
          icon={<FileCode2 className="size-4" />}
          title="No matching files"
          body="Try a different phrase, or confirm the repository has finished indexing."
        />
      )}

      {hasQuery && !isLoading && !isError && data && data.results.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.results.map((result) => (
            <SearchResultRow key={result.filepath} filepath={result.filepath} classes={result.classes} functions={result.functions} similarity={result.similarity} />
          ))}
        </div>
      )}
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
          <FileCode2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
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