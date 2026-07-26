import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useTriggerAnalysis } from "@/hooks/useAnalyses";

export function RunAnalysisModal({
    open,
    onClose,
    projectId,
}: {
    open: boolean;
    onClose: () => void;
    projectId: string;
}) {
    const [prNumber, setPrNumber] = useState("");
    const triggerAnalysis = useTriggerAnalysis(projectId);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const parsed = Number(prNumber);
        if (!Number.isInteger(parsed) || parsed <= 0) return;

        triggerAnalysis.mutate(
            { pr_number: parsed },
            {
                onSuccess: () => {
                    setPrNumber("");
                    onClose();
                },
            },
        );
    }

    return (
        <Modal
            open={open}
            onClose={() => {
                setPrNumber("");
                onClose();
            }}
            title="Run impact analysis"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                    <label htmlFor="pr-number" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Pull request number
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">#</span>
                        <input
                            id="pr-number"
                            autoFocus
                            inputMode="numeric"
                            value={prNumber}
                            onChange={(e) => setPrNumber(e.target.value.replace(/\D/g, ""))}
                            placeholder="4821"
                            className="h-9 w-full rounded border border-hairline bg-background px-3 text-sm text-foreground outline-none focus:border-signal"
                        />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        Runs the same pipeline as the automatic PR-opened trigger: graph traversal, risk
                        scoring, and LLM explanation. The PR must already be open on GitHub.
                    </p>
                </div>

                {triggerAnalysis.isError && (
                    <p className="text-xs text-[var(--risk-high)]">
                        Couldn't start analysis. Check the PR number and try again.
                    </p>
                )}

                <div className="mt-1 flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={!prNumber || triggerAnalysis.isPending}>
                        {triggerAnalysis.isPending ? "Starting…" : "Run analysis"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}