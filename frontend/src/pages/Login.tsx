import { ArrowRight, GitFork, LockKeyhole, Network, GitPullRequest, ScanSearch } from "lucide-react";
import { ScopeMark } from "@/components/ScopeMark";
import { API_BASE_URL } from "@/lib/api";


export function LoginPage() {
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Code map preview -- product context, not decoration */}
      <section
        className="relative hidden flex-1 border-r border-hairline lg:flex lg:flex-col"
        aria-label="CodeScope dependency map preview"
      >
        <div className="flex h-12 items-center gap-2 border-b border-hairline px-5">
          <ScopeMark className="size-5 text-signal" />
          <span className="font-mono text-sm font-medium tracking-tight">CodeScope</span>
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            code cartography
          </span>
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden grid-paper">
          <svg viewBox="0 0 760 520" className="h-[78%] w-[82%]" aria-hidden="true">
            <g stroke="var(--hairline-strong)" strokeWidth="1" opacity="0.55">
              <path d="M100 170 L270 225 L420 145 L590 215" />
              <path d="M270 225 L360 355 L520 390" />
              <path d="M270 225 L125 350" />
              <path d="M420 145 L610 95" />
              <path d="M590 215 L650 330" />
              <path d="M360 355 L650 330" />
            </g>
            <g fontFamily="var(--font-mono)" fontSize="12" fill="var(--muted-foreground)">
              <MapNode x={100} y={170} label="parser.py" type="changed" />
              <MapNode x={270} y={225} label="graph_service.py" type="changed" />
              <MapNode x={420} y={145} label="risk_service.py" type="changed" />
              <MapNode x={590} y={215} label="embeddings.py" type="stable" />
              <MapNode x={360} y={355} label="analysis_service.py" type="affected" />
              <MapNode x={520} y={390} label="workflow.py" type="affected" />
              <MapNode x={125} y={350} label="indexing_tasks.py" type="affected" />
              <MapNode x={610} y={95} label="database.py" type="stable" />
              <MapNode x={650} y={330} label="webhooks.py" type="affected" />
            </g>
          </svg>
          <div className="absolute bottom-8 left-8 max-w-sm">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-signal">Trace the change</p>
            <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight">
              See what a pull request touches before it ships.
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              CodeScope maps changed files to their dependents, tests, and past incidents -- so review starts with
              the blast radius, not the diff.
            </p>
          </div>
        </div>
      </section>

      <section className="flex w-full flex-col bg-panel lg:w-[430px]">
        <div className="flex h-12 items-center px-6 lg:hidden">
          <ScopeMark className="size-5 text-signal" />
          <span className="ml-2 font-mono text-sm font-medium">CodeScope</span>
        </div>
        <div className="flex flex-1 items-center px-8 sm:px-12">
          <div className="w-full">
            <div className="mb-8 flex size-10 items-center justify-center rounded border border-hairline-strong bg-background text-signal">
              <ScopeMark className="size-6" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Engineering workspace
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Know the blast radius before you merge</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Connect a GitHub repository and CodeScope indexes it automatically -- no manual setup, no config
              files. The first analysis is ready by the time you open your next pull request.
            </p>

            {/* Plain link, not a fetch call -- the backend owns the OAuth redirect. */}
            <a
              href={`${API_BASE_URL}/auth/github`}
              className="mt-7 flex h-10 w-full items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <GitFork className="size-4" />
              Continue with GitHub
              <ArrowRight className="ml-auto size-4" />
            </a>

            <div className="my-7 h-px bg-hairline" />

            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              What CodeScope does automatically
            </p>
            <div className="flex flex-col gap-4">
              <Permission icon={GitPullRequest} title="Watches every pull request" body="Webhook-driven, no polling or manual trigger needed" />
              <Permission icon={Network} title="Builds a live dependency graph" body="Traces imports to find what a change actually touches" />
              <Permission icon={ScanSearch} title="Explains the risk in plain English" body="A deterministic score first, then an LLM explanation of why" />
            </div>

            <div className="mt-8 flex items-start gap-2.5 rounded border border-hairline bg-background p-3">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Access is read-only at the code level -- CodeScope never pushes commits. It only writes a summary
                comment back to the pull request it analyzed.
              </p>
            </div>
          </div>
        </div>
        <footer className="flex items-center justify-between border-t border-hairline px-6 py-3 font-mono text-[10px] text-muted-foreground">
          <span>codescope</span>
          <span>v1 · Python repositories</span>
        </footer>
      </section>
    </main >
  );
}

function Permission({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Network;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded border border-hairline bg-background text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function MapNode({
  x,
  y,
  label,
  type,
}: {
  x: number;
  y: number;
  label: string;
  type: "changed" | "affected" | "stable";
}) {
  const stroke = type === "changed" ? "var(--risk-high)" : type === "affected" ? "var(--risk-med)" : "var(--hairline-strong)";
  return (
    <g transform={`translate(${x} ${y})`}>
      {type === "changed" ? (
        <rect x="-13" y="-13" width="26" height="26" rx="4" fill="var(--panel)" stroke={stroke} strokeWidth="2" />
      ) : (
        <circle r="11" fill="var(--panel)" stroke={stroke} strokeWidth="1.5" />
      )}
      <circle r="3" fill={stroke} />
      <text x="0" y="29" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}