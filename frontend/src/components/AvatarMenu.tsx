import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AvatarMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-panel-raised"
        aria-label="Account menu"
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="size-6 rounded-full border border-hairline" />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full border border-hairline-strong bg-panel-raised font-mono text-[10px]">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-40 mt-2 w-52 rounded-md border border-hairline-strong bg-popover py-1 shadow-lg"
          >
            <div className="border-b border-hairline px-3 py-2">
              <p className="truncate text-sm font-medium text-popover-foreground">{user.name}</p>
              {user.github_username && (
                <p className="truncate font-mono text-xs text-muted-foreground">@{user.github_username}</p>
              )}
            </div>
            {user.github_username && (
              <a
                href={`https://github.com/${user.github_username}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-panel-raised"
              >
                <ExternalLink className="size-3.5 text-muted-foreground" />
                View on GitHub
              </a>
            )}
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-panel-raised"
            >
              <LogOut className="size-3.5 text-muted-foreground" />
              Logout
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
