import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-hairline bg-panel px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full border border-hairline bg-panel-raised text-[var(--risk-high)]">
        <AlertTriangle className="size-4" />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">{message ?? "Couldn't load this. Please try again."}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
