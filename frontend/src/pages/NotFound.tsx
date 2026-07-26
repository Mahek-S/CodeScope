import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useCrumbs } from "@/hooks/useCrumbs";

export function NotFoundPage() {
  useCrumbs([{ label: "Not found" }]);
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <p className="text-sm text-foreground">This page doesn't exist.</p>
      <Button variant="secondary" onClick={() => navigate("/")}>
        Back to Dashboard
      </Button>
    </div>
  );
}
