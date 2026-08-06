import { ArrowRight, GitFork, LockKeyhole, Radar } from "lucide-react";
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
        <div className="flex h-14 items-center gap-2.5 border-b border-hairline px-6">
          <ScopeMark className="size-7 text-signal" />
          <span className="text-xl font-semibold tracking-tight">CodeScope</span>
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden grid-paper">
          {/* Soft glow behind the lockup for depth, instead of a flat panel */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-3xl"
            style={{ background: "radial-gradient(circle, var(--signal), transparent 70%)" }}
            aria-hidden="true"
          />

          {/* Large brand lockup -- the dominant visual on this side of the
              screen, not just a small corner mark. */}
          <div className="relative mb-2 flex items-center gap-4">
            <ScopeMark className="size-16 text-signal opacity-90" />
            <span className="text-6xl font-bold tracking-tight">CodeScope</span>
          </div>

          <svg viewBox="0 0 760 420" className="relative mt-4 h-[52%] w-[82%]" aria-hidden="true">
            <g stroke="var(--hairline-strong)" strokeWidth="1" opacity="0.55">
              <path d="M100 140 L270 195 L420 115 L590 185" />
              <path d="M270 195 L360 315 L520 350" />
              <path d="M270 195 L125 310" />
              <path d="M420 115 L610 70" />
              <path d="M590 185 L650 290" />
              <path d="M360 315 L650 290" />
            </g>
            <g fontFamily="var(--font-mono)" fontSize="12" fill="var(--muted-foreground)">
              <MapNode x={100} y={140} label="parser.py" type="changed" />
              <MapNode x={270} y={195} label="graph_service.py" type="changed" />
              <MapNode x={420} y={115} label="risk_service.py" type="changed" />
              <MapNode x={590} y={185} label="embeddings.py" type="stable" />
              <MapNode x={360} y={315} label="analysis_service.py" type="affected" />
              <MapNode x={520} y={350} label="workflow.py" type="affected" />
              <MapNode x={125} y={310} label="indexing_tasks.py" type="affected" />
              <MapNode x={610} y={70} label="database.py" type="stable" />
              <MapNode x={650} y={290} label="webhooks.py" type="affected" />
            </g>
          </svg>

          <p className="relative mt-2 flex items-center gap-2 text-balance text-center text-sm leading-relaxed text-muted-foreground">
            <Radar className="size-3.5 text-signal" />
            See what a pull request touches before it ships.
          </p>
        </div>
      </section>

      <section className="relative flex w-full flex-col overflow-hidden bg-panel lg:w-[460px]">
        {/* Faint decorative texture so the form side isn't a flat, empty
            panel -- same visual language as the illustration side, just
            quieter, without reintroducing explanatory copy. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--hairline-strong) 1px, transparent 1px), linear-gradient(90deg, var(--hairline-strong) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full opacity-[0.15] blur-3xl"
          style={{ background: "radial-gradient(circle, var(--signal), transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative flex h-14 items-center gap-2.5 px-6 lg:hidden">
          <ScopeMark className="size-7 text-signal" />
          <span className="text-xl font-semibold tracking-tight">CodeScope</span>
        </div>

        <div className="relative flex flex-1 items-center px-8 sm:px-12">
          <div className="w-full rounded-lg border border-hairline bg-background/60 p-8 shadow-xl backdrop-blur-sm">
            <ScopeMark className="mb-5 size-10 text-signal" />
            <h2 className="text-2xl font-semibold tracking-tight">Know the blast radius before you merge</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Connect a GitHub repository to get started.
            </p>

            {/* Plain link, not a fetch call -- the backend owns the OAuth redirect. */}

            <a href={`${API_BASE_URL}/auth/github`}
              className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 hover:shadow-primary/30"
            >
              <GitFork className="size-4" />
              Continue with GitHub
              <ArrowRight className="ml-auto size-4" />
            </a>

            <div className="mt-6 flex items-start gap-2.5 rounded border border-hairline bg-panel p-3">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Access is read-only at the code level -- CodeScope never pushes commits.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main >
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