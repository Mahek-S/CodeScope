import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";


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

export function RiskTag({ risk, label, onClick, active }: { risk: Risk; label?: string; onClick?: () => void; active?: boolean }) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-hairline bg-panel-raised px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        riskText[risk], onClick && "cursor-pointer hover:border-hairline-strong", active && "border-signal",
      )}
    >
      <RiskDot risk={risk} />
      {label ?? risk}
      {onClick && <ChevronDown className="size-3" />}
    </Comp>
  );
}
