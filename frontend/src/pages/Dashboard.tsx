import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useOrgs } from "@/hooks/useOrgs";
import { useCrumbs } from "@/hooks/useCrumbs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";
import { CreateOrgModal } from "@/components/CreateOrgModal";
import { relativeTime } from "@/lib/relativeTime";

export function DashboardPage() {
  useCrumbs([{ label: "Dashboard" }]);
  const { data: orgs, isLoading, isError, refetch } = useOrgs();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Organizations</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Repositories are connected under an organization.</p>
        </div>
        <Button icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
          Create organization
        </Button>
      </div>

      {isLoading && <CardSkeletonGrid />}

      {isError && <ErrorState message="Couldn't load your organizations." onRetry={() => refetch()} />}

      {!isLoading && !isError && orgs && orgs.length === 0 && (
        <EmptyState
          icon={<Building2 className="size-4" />}
          title="No organizations yet"
          body="Create an organization to start connecting GitHub repositories."
          action={
            <Button icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
              Create organization
            </Button>
          }
        />
      )}

      {!isLoading && !isError && orgs && orgs.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Card
              key={org.id}
              onClick={() => navigate(`/orgs/${org.id}/projects`)}
              className="cursor-pointer p-4 transition-colors hover:border-hairline-strong"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded border border-hairline bg-panel-raised text-muted-foreground">
                  <Building2 className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{org.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">Created {relativeTime(org.created_at)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateOrgModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
