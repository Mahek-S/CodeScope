import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import type { Crumb, LayoutContext } from "@/layouts/AppLayout";

/** Call once per page: useCrumbs([{ label: "northwind", to: "/orgs/1/projects" }, { label: "payments-core" }]) */
export function useCrumbs(crumbs: Crumb[]) {
  const { setCrumbs } = useOutletContext<LayoutContext>();
  // Stringify to avoid re-running on every render from a fresh array literal.
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    setCrumbs(crumbs);
    return () => setCrumbs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
