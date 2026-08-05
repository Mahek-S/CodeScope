import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  FlaskConical,
  History,
  GitPullRequest,
  ChevronDown,
  ChevronUp,
  FileCode2,
} from "lucide-react";
import { useAnalysis } from "@/hooks/useAnalyses";
import { useCrumbs } from "@/hooks/useCrumbs";
import { RiskTag } from "@/components/RiskTag";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { relativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/cn";
import type { RiskLevel } from "@/types/analysis";

type DrawerTab = "explanation" | "tests" | "similar";

export function AnalysisPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const { data: analysis, isLoading, isError, refetch } = useAnalysis(analysisId);

  useCrumbs([{ label: "Dashboard", to: "/" }, { label: analysis ? `PR #${analysis.pr_number ?? "—"}` : "Analysis" }]);

  const [selected, setSelected] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("explanation");

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-4 h-8 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !analysis) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ErrorState message="Couldn't load this analysis." onRetry={() => refetch()} />
      </div>
    );
  }

  const changedFiles = analysis.changed_files ?? [];
  const directlyAffected = analysis.directly_affected ?? [];
  const transitivelyAffected = analysis.transitively_affected ?? [];
  const suggestedTests = analysis.suggested_tests ?? [];
  const similarBugs = analysis.similar_past_bugs?.items ?? [];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* PR context strip -- everything about the PR itself lives here,
          one line, so nothing below needs to repeat it. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-hairline bg-panel px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-panel-raised hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <GitPullRequest className="size-4 text-signal" />
        <span className="text-sm font-medium text-foreground">PR #{analysis.pr_number ?? "—"}</span>
        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
          {analysis.trigger === "pr_opened" ? "auto" : "manual"} · {relativeTime(analysis.created_at)}
        </span>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden items-center gap-4 font-mono text-[11px] text-muted-foreground md:flex">
            <span>{changedFiles.length} changed</span>
            <span>{directlyAffected.length} direct</span>
            <span>{transitivelyAffected.length} transitive</span>
          </div>
          {analysis.risk_level && (
            <RiskTag
              risk={analysis.risk_level as RiskLevel}
              label={`${analysis.risk_level} risk${analysis.risk_score !== null ? ` · ${Math.round(analysis.risk_score * 100)}/100` : ""
                }`}
            />
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* LEFT RAIL -- one continuous file list, grouped by distance
            from the change instead of three separately-chromed panels. */}
        <aside className="hidden w-64 shrink-0 flex-col overflow-auto border-r border-hairline bg-panel scroll-thin lg:flex">
          <FileGroup title="Changed" count={changedFiles.length} files={changedFiles} selected={selected} onSelect={setSelected} accent="text-signal" />
          <FileGroup title="Directly affected" count={directlyAffected.length} files={directlyAffected} selected={selected} onSelect={setSelected} accent="text-[var(--risk-med)]" />
          <FileGroup title="Transitively affected" count={transitivelyAffected.length} files={transitivelyAffected} selected={selected} onSelect={setSelected} accent="text-muted-foreground" />
        </aside>

        {/* CENTER -- graph + evidence drawer */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <DependencyGraph
              changedFiles={changedFiles}
              directlyAffected={directlyAffected}
              transitivelyAffected={transitivelyAffected}
              selected={selected}
              onSelectFile={setSelected}
            />
          </div>

          <div className="flex shrink-0 flex-col border-t border-hairline bg-panel">
            <button
              onClick={() => setDrawerOpen((o) => !o)}
              className="flex items-center gap-2 border-b border-hairline px-4 py-2 text-left"
            >
              {drawerOpen ? (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronUp className="size-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">Why this risk level?</span>
              {analysis.github_comment_id && (
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  Posted to GitHub as comment #{analysis.github_comment_id}
                </span>
              )}
            </button>

            {drawerOpen && (
              <>
                <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
                  <DrawerTabButton icon={Sparkles} label="Explanation" active={drawerTab === "explanation"} onClick={() => setDrawerTab("explanation")} />
                  <DrawerTabButton icon={FlaskConical} label="Suggested tests" count={suggestedTests.length} active={drawerTab === "tests"} onClick={() => setDrawerTab("tests")} />
                  <DrawerTabButton icon={History} label="Similar past bugs" count={similarBugs.length} active={drawerTab === "similar"} onClick={() => setDrawerTab("similar")} />
                </div>
                <div className="h-56 overflow-auto scroll-thin">
                  {drawerTab === "explanation" && <ExplanationPanel text={analysis.explanation} />}
                  {drawerTab === "tests" && <TestsPanel tests={suggestedTests} />}
                  {drawerTab === "similar" && (
                    <SimilarBugsPanel bugs={similarBugs} onOpen={(id) => navigate(`/analyses/${id}`)} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileGroup({
  title,
  count,
  files,
  selected,
  onSelect,
  accent,
}: {
  title: string;
  count: number;
  files: string[];
  selected: string | null;
  onSelect: (path: string) => void;
  accent: string;
}) {
  if (count === 0) return null;
  return (
    <div className="border-b border-hairline/60 py-2">
      <p className={cn("px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-wide", accent)}>
        {title} <span className="text-muted-foreground">({count})</span>
      </p>
      {files.map((f) => (
        <FileRow key={f} path={f} active={selected === f} onClick={() => onSelect(f)} />
      ))}
    </div>
  );
}

function FileRow({ path, active, onClick }: { path: string; active: boolean; onClick: () => void }) {
  const parts = path.split("/");
  const name = parts.pop();
  const dir = parts.length ? parts.join("/") + "/" : "";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors",
        active ? "bg-panel-raised" : "hover:bg-panel-raised/60",
      )}
    >
      <span className="truncate font-mono text-[12px]">
        <span className="text-muted-foreground">{dir}</span>
        <span className="text-foreground">{name}</span>
      </span>
    </button>
  );
}

function DrawerTabButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs transition-colors",
        active ? "bg-panel-raised text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-3.5", active && "text-signal")} />
      {label}
      {count !== undefined && count > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full border border-hairline px-1 font-mono text-[9px] text-muted-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

function ExplanationPanel({ text }: { text: string | null }) {
  if (!text) return <EmptyEvidence text="No explanation available for this analysis." />;
  return <p className="px-5 py-4 text-sm leading-relaxed text-foreground">{text}</p>;
}

function TestsPanel({ tests }: { tests: string[] }) {
  if (tests.length === 0) return <EmptyEvidence text="No suggested tests for this change." />;
  return (
    <div className="divide-y divide-hairline/60">
      {tests.map((t) => (
        <div key={t} className="flex items-center gap-2.5 px-4 py-2">
          <FlaskConical className="size-3.5 shrink-0 text-[var(--risk-med)]" />
          <span className="truncate font-mono text-xs text-foreground">{t}</span>
        </div>
      ))}
    </div>
  );
}

function SimilarBugsPanel({
  bugs,
  onOpen,
}: {
  bugs: {
    analysis_id: string;
    pr_number: number | null;
    risk_level: RiskLevel | null;
    overlapping_files: string[];
    created_at: string | null;
  }[];
  onOpen: (analysisId: string) => void;
}) {
  if (bugs.length === 0) return <EmptyEvidence text="No similar past analyses found." />;
  return (
    <div className="divide-y divide-hairline/60">
      {bugs.map((bug) => (
        <button
          key={bug.analysis_id}
          onClick={() => onOpen(bug.analysis_id)}
          className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-panel-raised/60"
        >
          <History className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">
              PR #{bug.pr_number ?? "—"}{" "}
              {bug.risk_level && <span className="text-muted-foreground">· {bug.risk_level} risk</span>}
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              overlap: {bug.overlapping_files.slice(0, 3).join(", ") || "—"}
            </p>
          </div>
          {bug.created_at && (
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{relativeTime(bug.created_at)}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function EmptyEvidence({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-2 px-4 text-center font-mono text-[11px] text-muted-foreground">
      <FileCode2 className="size-3.5" />
      {text}
    </div>
  );
}