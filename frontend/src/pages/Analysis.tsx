import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileDiff,
  ShieldAlert,
  Sparkles,
  FlaskConical,
  History,
  GitPullRequest,
  PanelBottomClose,
  PanelBottomOpen,
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
type FileKind = "changed" | "direct" | "transitive";

export function AnalysisPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const { data: analysis, isLoading, isError, refetch } = useAnalysis(analysisId);

  useCrumbs([{ label: "Dashboard", to: "/" }, { label: analysis ? `PR #${analysis.pr_number ?? "—"}` : "Analysis" }]);

  const [selected, setSelected] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("explanation");

  const changedFiles = analysis?.changed_files ?? [];
  const directlyAffected = analysis?.directly_affected ?? [];
  const transitivelyAffected = analysis?.transitively_affected ?? [];
  const suggestedTests = analysis?.suggested_tests ?? [];
  const similarBugs = analysis?.similar_past_bugs?.items ?? [];

  const kindOf = useMemo(() => {
    const map = new Map<string, FileKind>();
    (analysis?.changed_files ?? []).forEach((f) => map.set(f, "changed"));
    (analysis?.directly_affected ?? []).forEach((f) => map.set(f, "direct"));
    (analysis?.transitively_affected ?? []).forEach((f) => map.set(f, "transitive"));
    return map;
  }, [analysis]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ minHeight: "calc(100vh - 44px)" }}>
      {/* PR context strip */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-panel px-4 py-2">
        <button
          onClick={() => navigate(-1)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-panel-raised hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <GitPullRequest className="size-4 text-signal" />
        <span className="font-mono text-[13px] text-foreground">#{analysis.pr_number ?? "—"}</span>
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {analysis.trigger === "pr_opened" ? "auto · PR opened" : "manual"}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">{relativeTime(analysis.created_at)}</span>
        <div className="ml-auto flex items-center gap-3">
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
        {/* LEFT RAIL — changed & affected files */}
        <aside className="hidden w-72 shrink-0 flex-col overflow-auto border-r border-hairline bg-panel scroll-thin lg:flex">
          <RailHeader icon={FileDiff} title="Changed files" meta={String(changedFiles.length)} />
          <div className="flex flex-col">
            {changedFiles.length === 0 && <RailEmpty text="No changed files recorded." />}
            {changedFiles.map((f) => (
              <FileRow key={f} path={f} active={selected === f} onClick={() => setSelected(f)} />
            ))}
          </div>

          <RailHeader icon={ShieldAlert} title="Directly affected" meta={String(directlyAffected.length)} />
          <div className="flex flex-col">
            {directlyAffected.length === 0 && <RailEmpty text="No downstream files affected." />}
            {directlyAffected.map((f) => (
              <FileRow key={f} path={f} active={selected === f} onClick={() => setSelected(f)} />
            ))}
          </div>

          {transitivelyAffected.length > 0 && (
            <>
              <RailHeader icon={ShieldAlert} title="Transitively affected" meta={String(transitivelyAffected.length)} />
              <div className="flex flex-col">
                {transitivelyAffected.map((f) => (
                  <FileRow key={f} path={f} active={selected === f} onClick={() => setSelected(f)} />
                ))}
              </div>
            </>
          )}
        </aside>

        {/* CENTER — dependency graph */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-hairline bg-panel px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Dependency graph</span>
            {selected && (
              <span className="ml-2 flex items-center gap-1.5 truncate rounded border border-hairline bg-background px-2 py-0.5 font-mono text-[11px] text-foreground">
                {selected.split("/").pop()}
              </span>
            )}
            <button
              onClick={() => setDrawerOpen((o) => !o)}
              className="ml-auto flex items-center gap-1.5 rounded border border-hairline px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {drawerOpen ? <PanelBottomClose className="size-3.5" /> : <PanelBottomOpen className="size-3.5" />}
              {drawerOpen ? "Collapse evidence" : "Expand evidence"}
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <DependencyGraph
              changedFiles={changedFiles}
              directlyAffected={directlyAffected}
              transitivelyAffected={transitivelyAffected}
              selected={selected}
              onSelectFile={setSelected}
            />
          </div>

          {drawerOpen && (
            <div className="flex h-52 shrink-0 flex-col border-t border-hairline bg-panel">
              <div className="flex shrink-0 items-center border-b border-hairline">
                <DrawerTabButton
                  icon={Sparkles}
                  label="AI explanation"
                  active={drawerTab === "explanation"}
                  onClick={() => setDrawerTab("explanation")}
                />
                <DrawerTabButton
                  icon={FlaskConical}
                  label="Suggested tests"
                  count={suggestedTests.length}
                  active={drawerTab === "tests"}
                  onClick={() => setDrawerTab("tests")}
                />
                <DrawerTabButton
                  icon={History}
                  label="Similar past bugs"
                  count={similarBugs.length}
                  active={drawerTab === "similar"}
                  onClick={() => setDrawerTab("similar")}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-auto scroll-thin">
                {drawerTab === "explanation" && <ExplanationPanel text={analysis.explanation} />}
                {drawerTab === "tests" && <TestsPanel tests={suggestedTests} />}
                {drawerTab === "similar" && <SimilarBugsPanel bugs={similarBugs} onOpen={(id) => navigate(`/analyses/${id}`)} />}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT RAIL — impact summary */}
        <aside className="hidden w-72 shrink-0 flex-col overflow-auto border-l border-hairline bg-panel scroll-thin xl:flex">
          <RailHeader icon={ShieldAlert} title="Impact summary" />
          <div className="grid grid-cols-3 gap-2 border-b border-hairline px-4 py-3">
            <Stat label="Changed" value={String(changedFiles.length)} />
            <Stat label="Direct" value={String(directlyAffected.length)} />
            <Stat label="Transitive" value={String(transitivelyAffected.length)} />
          </div>

          {selected && (
            <div className="border-b border-hairline px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Selected file</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{selected}</p>
              <span className="mt-1.5 inline-block font-mono text-[10px] uppercase text-signal">
                {kindOf.get(selected) ?? "unknown"}
              </span>
            </div>
          )}

          {analysis.github_comment_id && (
            <div className="px-4 py-3">
              <p className="font-mono text-[10px] text-muted-foreground">
                Posted as a PR comment on GitHub (comment #{analysis.github_comment_id}).
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function RailHeader({ icon: Icon, title, meta }: { icon: typeof FileDiff; title: string; meta?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-hairline bg-panel-raised/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5" />
      <span className="text-foreground/80">{title}</span>
      {meta && (
        <span className="ml-auto flex size-4 items-center justify-center rounded-full border border-hairline text-[9px] text-muted-foreground">
          {meta}
        </span>
      )}
    </div>
  );
}

function RailEmpty({ text }: { text: string }) {
  return <p className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{text}</p>;
}

function FileRow({ path, active, onClick }: { path: string; active: boolean; onClick: () => void }) {
  const parts = path.split("/");
  const name = parts.pop();
  const dir = parts.length ? parts.join("/") + "/" : "";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-0.5 border-b border-hairline/50 px-3 py-2 text-left transition-colors",
        active ? "bg-panel-raised" : "hover:bg-panel-raised/60",
      )}
    >
      <span className="truncate font-mono text-xs">
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
        "relative flex items-center gap-2 px-3 py-2 text-xs transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-3.5", active && "text-signal")} />
      {label}
      {count !== undefined && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full border border-hairline px-1 font-mono text-[9px] text-muted-foreground">
          {count}
        </span>
      )}
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-signal" />}
    </button>
  );
}

function ExplanationPanel({ text }: { text: string | null }) {
  if (!text) {
    return <EmptyEvidence text="No explanation available for this analysis." />;
  }
  return <p className="px-4 py-3 text-[13px] leading-relaxed text-foreground">{text}</p>;
}

function TestsPanel({ tests }: { tests: string[] }) {
  if (tests.length === 0) {
    return <EmptyEvidence text="No suggested tests for this change." />;
  }
  return (
    <div className="divide-y divide-hairline/60">
      {tests.map((t) => (
        <div key={t} className="flex items-center gap-2.5 px-4 py-2.5">
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
  if (bugs.length === 0) {
    return <EmptyEvidence text="No similar past analyses found." />;
  }
  return (
    <div className="divide-y divide-hairline/60">
      {bugs.map((bug) => (
        <button
          key={bug.analysis_id}
          onClick={() => onOpen(bug.analysis_id)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-panel-raised/60"
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
    <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[11px] text-muted-foreground">
      {text}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
    </div>
  );
}