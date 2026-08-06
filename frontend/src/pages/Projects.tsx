import { useState } from "react";
import { useParams } from "react-router-dom";
import { GitFork, Plus } from "lucide-react";
import { useOrgs } from "@/hooks/useOrgs";
import { useProjects } from "@/hooks/useProjects";
import { useCrumbs } from "@/hooks/useCrumbs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";
import { RepositoryCard } from "@/components/RepositoryCard";
import { ConnectRepositoryModal } from "@/components/ConnectRepositoryModal";

export function ProjectsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { data: orgs } = useOrgs();
  const org = orgs?.find((o) => o.id === orgId);

  useCrumbs([
    { label: "Dashboard", to: "/" },
    { label: org?.name ?? "Organization" },
    { label: "Repositories" },
  ]);

  const { data: projects, isLoading, isError, refetch } = useProjects(orgId);
  const [connectOpen, setConnectOpen] = useState(false);

  if (!orgId) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Repositories</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{org?.name ?? "Organization"}</p>
        </div>
        <Button icon={<Plus className="size-4" />} onClick={() => setConnectOpen(true)}>
          Connect repository
        </Button>
      </div>

      {isLoading && <CardSkeletonGrid />}

      {isError && <ErrorState message="Couldn't load repositories for this organization." onRetry={() => refetch()} />}

      {!isLoading && !isError && projects && projects.length === 0 && (
        <EmptyState
          icon={<GitFork className="size-4" />}
          title="No repositories connected"
          body="Connect a GitHub repository to start indexing and generating impact analyses."
          action={
            <Button icon={<Plus className="size-4" />} onClick={() => setConnectOpen(true)}>
              Connect repository
            </Button>
          }
        />
      )}

      {!isLoading && !isError && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <RepositoryCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ConnectRepositoryModal open={connectOpen} onClose={() => setConnectOpen(false)} orgId={orgId} />
    </div>
  );
}
