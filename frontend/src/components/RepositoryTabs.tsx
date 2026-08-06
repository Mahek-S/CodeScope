import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";

type Props = {
    projectId: string;
    analysisId?: string; // optional
};

export function RepositoryTabs({ projectId }: Props) {
    const location = useLocation();

    const tabs = [
        {
            label: "Overview",
            href: `/projects/${projectId}`,
            active: location.pathname === `/projects/${projectId}`,
        },
        {
            label: "Search",
            href: `/projects/${projectId}/search`,
            active: location.pathname.startsWith(
                `/projects/${projectId}/search`,
            ),
        },
    ];

    return (
        <div className="mb-6 border-b border-hairline">
            <nav className="flex gap-6">
                {tabs.map((tab) => (
                    <Link
                        key={tab.label}
                        to={tab.href}
                        className={cn(
                            "border-b-2 px-1 py-3 text-sm transition-colors",
                            tab.active
                                ? "border-signal text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {tab.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}