import { cn } from "@/lib/cn";

// Matches backend's analyses.risk_level: 'low' | 'medium' | 'high'
export type Risk = "high" | "medium" | "low";

const riskColor: Record<Risk, string> = {
  high: "bg-[var(--risk-high)]",
  medium: "bg-[var(--risk-med)]",
  low: "bg-[var(--risk-low)]",
};

const riskText: Record<Risk, string> = {
  high: "text-[var(--risk-high)]",
  medium: "text-[var(--risk-med)]",
  low: "text-[var(--risk-low)]",
};

export function RiskDot({ risk, className }: { risk: Risk; className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full", riskColor[risk], className)} aria-hidden="true" />;
}

export function RiskTag({ risk, label }: { risk: Risk; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-hairline bg-panel-raised px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        riskText[risk],
      )}
    >
      <RiskDot risk={risk} />
      {label ?? risk}
    </span>
  );
}
