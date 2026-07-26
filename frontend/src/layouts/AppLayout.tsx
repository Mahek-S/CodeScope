import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, Moon, Sun } from "lucide-react";
import { ScopeMark } from "@/components/ScopeMark";
import { AvatarMenu } from "@/components/AvatarMenu";
import { useTheme } from "@/hooks/useTheme";
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
        <div className="flex-1 overflow-y-auto scroll-thin">
          <Outlet context={{ setCrumbs } satisfies LayoutContext} />
        </div>
      </div>
    </div>
  );
}

function ActivityRail() {
  const navigate = useNavigate();
  return (
    <nav className="flex w-14 flex-col items-center border-r border-hairline bg-panel py-3" aria-label="Primary">
      <button
        onClick={() => navigate("/")}
        className="mb-2 flex size-9 items-center justify-center rounded text-signal transition-colors hover:bg-panel-raised"
        aria-label="CodeScope home"
      >
        <ScopeMark className="size-6" />
      </button>
      <div className="mb-3 h-px w-6 bg-hairline" />
      <div className="flex flex-1 flex-col items-center gap-1">
        <button
          onClick={() => navigate("/")}
          className="group relative flex size-9 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-panel-raised hover:text-foreground"
          aria-label="Dashboard"
        >
          <LayoutGrid className="size-[18px]" />
          <span className="pointer-events-none absolute left-11 z-30 hidden whitespace-nowrap rounded border border-hairline bg-popover px-2 py-1 text-xs text-popover-foreground group-hover:block">
            Dashboard
          </span>
        </button>
      </div>
    </nav>
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
