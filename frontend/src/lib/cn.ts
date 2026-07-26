/**
 * Minimal className joiner. We don't pull in clsx/tailwind-merge for
 * one function -- this covers every case we actually hit (conditional
 * classes, no conflicting-utility resolution needed since we don't
 * generate class lists dynamically enough to collide).
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
