import { useEffect } from "react";
import { ErrorState } from "../components/ErrorState";
import { ProjectOverview } from "../components/ProjectOverview";
import { Skeleton, StatCardsSkeleton } from "../components/Skeleton";
import { useApp } from "../context/AppContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { api } from "../services/api";

export default function OverviewPage() {
  const { reportSync, projects } = useApp();
  const { data, error, loading, retry } = useAsyncData((signal, force) => api.dashboard(force, signal), []);
  useEffect(() => {
    reportSync(data?.synced_at ? { at: new Date(data.synced_at), cached: data.cached } : null);
  }, [data, reportSync]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-ink-soft">Live ticket counts from {data?.jira_site ?? "Jira"}, by project and workflow status.</p>
      </header>
      {error && <ErrorState error={error} onRetry={retry} />}
      {!data && loading && !error && (
        <div className="space-y-6" role="status" aria-label="Loading dashboard">
          {(projects?.length ? projects : [{ key: "a" }, { key: "b" }]).map((p) => (
            <div key={p.key} className="space-y-3"><Skeleton className="h-9 w-64" /><StatCardsSkeleton /><Skeleton className="h-56" /></div>
          ))}
        </div>
      )}
      {data?.projects.map((p) => <ProjectOverview key={p.key} project={p} />)}
    </div>
  );
}
