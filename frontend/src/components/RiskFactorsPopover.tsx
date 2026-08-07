import type { RiskFactor } from "@/types/analysis";

export function RiskFactorsPopover({ factors, onClose }: { factors: RiskFactor[]; onClose: () => void }) {
    return (
        <div className="absolute right-3 top-11 z-20 w-72 rounded-md border border-hairline-strong bg-popover p-3 shadow-lg">
            <p className="mb-2 text-xs font-medium text-popover-foreground">Why this score?</p>
            {factors.map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-sm">
                    <span className={f.triggered ? "text-[var(--risk-med)]" : "text-muted-foreground"}>
                        {f.triggered ? "✓" : "–"}
                    </span>
                    <span className="text-popover-foreground">{f.label}</span>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">+{f.impact}</span>
                </div>
            ))}
        </div>
    );
}