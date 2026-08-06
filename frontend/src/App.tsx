import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { ProjectsPage } from "@/pages/Projects";
import { ProjectPage } from "@/pages/Project";
import { AnalysisPage } from "@/pages/Analysis";
import { SearchPage } from "@/pages/Search";
import { NotFoundPage } from "@/pages/NotFound";
import { AppLayout } from "@/layouts/AppLayout";
import { ScopeMark } from "@/components/ScopeMark";

export default function App() {
  const { status } = useAuth();
  const navigate = useNavigate();

  // Bug fix: logging out only swapped which component rendered -- it
  // never touched the URL, so logging out from e.g. /analyses/xyz left
  // the browser's address bar on /analyses/xyz while the login page was
  // showing. Reset the URL the moment we transition to unauthenticated,
  // so a page refresh (or the next login) starts from a clean slate.
  useEffect(() => {
    if (status === "unauthenticated" && window.location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [status, navigate]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <ScopeMark className="size-6 animate-pulse text-signal" />
      </main>
    );
  }

  if (status === "unauthenticated") {
    // No client-side auth-guard logic needed beyond this single check --
    // every route renders Login until /auth/me succeeds.
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orgs/:orgId/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/projects/:projectId/search" element={<SearchPage />} />
        <Route path="/analyses/:analysisId" element={<AnalysisPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}