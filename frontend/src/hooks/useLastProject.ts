import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "codescope:last-project";
// Native "storage" events only fire in *other* tabs/windows, never the
// tab that made the write -- so ActivityRail and ProjectPage, each
// holding their own instance of this hook, never learned about each
// other's writes. This custom event fires in the same tab too, so
// every instance of useLastProject stays in sync with every other one.
const LOCAL_UPDATE_EVENT = "codescope:last-project-updated";

export type LastProject = { id: string; name: string };

function read(): LastProject | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as LastProject) : null;
    } catch {
        return null;
    }
}

/**
 * Most of the app's navigation is contextual (a project, an analysis) --
 * there's no single global "Search" or "Project" destination to put in
 * the sidebar. Remembering the last project the user opened gives the
 * sidebar something real to link to instead of sitting there with only
 * a Dashboard icon.
 */
export function useLastProject() {
    const [project, setProjectState] = useState<LastProject | null>(() => read());

    useEffect(() => {
        function sync() {
            setProjectState(read());
        }
        // Cross-tab writes.
        function onStorage(e: StorageEvent) {
            if (e.key === STORAGE_KEY) sync();
        }
        // Same-tab writes from any other component using this hook (e.g.
        // ProjectPage setting it while ActivityRail is mounted alongside it).
        window.addEventListener("storage", onStorage);
        window.addEventListener(LOCAL_UPDATE_EVENT, sync);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener(LOCAL_UPDATE_EVENT, sync);
        };
    }, []);

    const setProject = useCallback((next: LastProject) => {
        const current = read();
        if (current?.id === next.id && current?.name === next.name) return; // no-op, avoid redundant event churn
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setProjectState(next);
        window.dispatchEvent(new Event(LOCAL_UPDATE_EVENT));
    }, []);

    return { project, setProject };
}