import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "codescope-theme";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // Skip the very first run -- index.html's inline script already
    // applied the correct class before React mounted, so re-applying
    // here would be redundant (harmless, but let's be precise about why
    // this exists: it only needs to run when the user *changes* theme).
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
