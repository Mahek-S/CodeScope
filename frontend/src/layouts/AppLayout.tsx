import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Moon, Sun, FolderGit2, Search, Plus } from "lucide-react";
import { ScopeMark } from "@/components/ScopeMark";
import { AvatarMenu } from "@/components/AvatarMenu";
import { CreateOrgModal } from "@/components/CreateOrgModal";
import { useTheme } from "@/hooks/useTheme";
import { useLastProject } from "@/hooks/useLastProject";
import { cn } from "@/lib/cn";

export type Crumb = { label: string; to?: string };
export type LayoutContext = { setCrumbs: (crumbs: Crumb[]) => void };

export function AppLayout() {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);

  return (
    <div className="flex h-screen min-h-[560px] overflow-hidden bg-background text-foreground">
      <ActivityRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={crumbs} />
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          <Outlet context={{ setCrumbs } satisfies LayoutContext} />
        </div>
      </div>
    </div>
  );
}

function ActivityRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { project } = useLastProject();
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  const isDashboard = location.pathname === "/";
  const isProject = project ? location.pathname === `/projects/${project.id}` : false;
  const isSearch = project ? location.pathname === `/projects/${project.id}/search` : false;

  return (
    <nav className="flex w-52 shrink-0 flex-col border-r border-hairline bg-panel py-3" aria-label="Primary">
      <button
        onClick={() => navigate("/")}
        className="mx-3 mb-3 flex items-center gap-2 rounded px-1.5 py-1 text-signal transition-colors hover:bg-panel-raised"
      >
        <ScopeMark className="size-6" />
        <span className="text-base font-semibold tracking-tight text-foreground">CodeScope</span>
      </button>

      <div className="flex flex-1 flex-col gap-0.5 px-2">
        <NavItem icon={LayoutGrid} label="Dashboard" active={isDashboard} onClick={() => navigate("/")} />

        <NavItem
          icon={FolderGit2}
          label={project ? project.name : "Project"}
          hint={project ? undefined : "Open a project first"}
          active={isProject}
          disabled={!project}
          onClick={() => project && navigate(`/projects/${project.id}`)}
        />

        <NavItem
          icon={Search}
          label="Search"
          hint={project ? undefined : "Open a project first"}
          active={isSearch}
          disabled={!project}
          onClick={() => project && navigate(`/projects/${project.id}/search`)}
        />

        <div className="my-2 h-px bg-hairline" />

        <NavItem icon={Plus} label="New organization" onClick={() => setCreateOrgOpen(true)} />
      </div>

      <CreateOrgModal open={createOrgOpen} onClose={() => setCreateOrgOpen(false)} />
    </nav>
  );
}

function NavItem({
  icon: Icon,
  label,
  hint,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: typeof LayoutGrid;
  label: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm transition-colors",
        disabled
          ? "cursor-not-allowed text-muted-foreground/40"
          : active
            ? "bg-panel-raised text-signal"
            : "text-muted-foreground hover:bg-panel-raised hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 truncate font-mono text-[10px] text-muted-foreground/70">{hint}</span>}
    </button>
  );
}

function TopBar({ crumbs }: { crumbs: Crumb[] }) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-hairline bg-panel px-3">
      <div className="flex min-w-0 items-center gap-1.5 font-mono text-[13px]">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/60">/</span>}
            {c.to ? (
              <button
                onClick={() => navigate(c.to!)}
                className={cn(
                  "truncate hover:text-foreground",
                  i === crumbs.length - 1 ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {c.label}
              </button>
            ) : (
              <span
                className={cn("truncate", i === crumbs.length - 1 ? "text-foreground" : "text-muted-foreground")}
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-panel-raised hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <AvatarMenu />
      </div>
    </header>
  );
}