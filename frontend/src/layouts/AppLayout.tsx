import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Moon, Sun } from "lucide-react";
import { ScopeMark } from "@/components/ScopeMark";
import { AvatarMenu } from "@/components/AvatarMenu";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/cn";
import { PanelLeft } from "lucide-react";

export type Crumb = { label: string; to?: string };
export type LayoutContext = { setCrumbs: (crumbs: Crumb[]) => void };

export function AppLayout() {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen min-h-[560px] overflow-hidden bg-background text-foreground">
      <ActivityRail open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={crumbs} />
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          <Outlet context={{ setCrumbs } satisfies LayoutContext} />
        </div>
      </div>
    </div>
  );
}

function ActivityRail({ open, onToggle, }: {
  open: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const isDashboard = location.pathname === "/";

  return (
    <nav
      className={cn(
        "flex shrink-0 flex-col border-r border-hairline bg-panel py-3 transition-[width] duration-200 ease-in-out",
        open ? "w-52" : "w-14"
      )}
      aria-label="Primary"
    >

      <div className={cn(
        "mb-4 flex items-center",
        open ? "mx-3 gap-2" : "justify-center"
      )}>
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-panel-raised"
        >
          <PanelLeft className="size-4" />
        </button>

        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded px-1 py-1 hover:bg-panel-raised"
        >
          <ScopeMark className="size-6" />

          {open && (
            <span className="text-base font-semibold tracking-tight text-foreground">
              CodeScope
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 px-2">
        <NavItem
          icon={LayoutGrid}
          label="Dashboard"
          open={open}
          active={isDashboard}
          onClick={() => navigate("/")}
        />

      </div>
    </nav>
  );
}

function NavItem({
  icon: Icon,
  label,
  open,
  hint,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: typeof LayoutGrid;
  label: string;
  open: boolean;
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
        "flex w-full items-center rounded px-2.5 py-2 text-left text-sm transition-colors",
        open ? "gap-2.5" : "justify-center",
        disabled
          ? "cursor-not-allowed text-muted-foreground/40"
          : active
            ? "bg-panel-raised text-signal"
            : "text-muted-foreground hover:bg-panel-raised hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {open && (
        <span className="min-w-0 flex-1 truncate">
          {label}
        </span>
      )}
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
            {i > 0 && (
              <span className="text-muted-foreground/60 select-none">
                &gt;
              </span>
            )}
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