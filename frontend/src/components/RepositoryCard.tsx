import { FolderGit2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { relativeTime } from "@/lib/relativeTime";
import type { Project } from "@/types/project";

export function RepositoryCard({ project }: { project: Project }) {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => navigate(`/projects/${project.id}`)}
      className="cursor-pointer p-4 transition-colors hover:border-hairline-strong"
    >
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded border border-hairline bg-panel-raised text-muted-foreground">
          <FolderGit2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{project.repo_full_name}</p>
          <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span>{project.default_branch}</span>
            <span>·</span>
            <span>{project.indexed_at ? `Indexed ${relativeTime(project.indexed_at)}` : "Not indexed yet"}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
