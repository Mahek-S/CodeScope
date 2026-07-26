import { cn } from "@/lib/cn";

export function ScopeMark({ className }: { className?: string }) {
  // Code-cartography mark: concentric scope with a ripple node.
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
      <circle cx="12" cy="12" r="5.4" stroke="currentColor" strokeWidth="1.4" opacity="0.75" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
      <path
        d="M12 2.8V6M12 18v3.2M2.8 12H6M18 12h3.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
