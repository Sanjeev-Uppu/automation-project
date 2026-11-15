import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { Filters } from "../components/Filters";
import { IssueTable } from "../components/IssueTable";
import { Pagination } from "../components/Pagination";
import { StatCardsSkeleton } from "../components/Skeleton";
import { StatCard } from "../components/StatCard";
import { useApp } from "../context/AppContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { api } from "../services/api";
import { DEFAULT_FILTERS, IssueFilters, SortBy } from "../types/api";
import { colorMap } from "../utils/colors";
import { toApiError } from "../utils/errors";
import { formatNumber } from "../utils/format";

const FILTER_KEYS: (keyof IssueFilters)[] = [
  "status", "search", "assignee", "issue_type", "priority",
  "created_after", "created_before", "updated_after", "updated_before",
];

function Explorer({ projectKey }: { projectKey: string }) {
  const { reportSync, refreshAll, pending } = useApp();
  const [filters, setFilters] = useState<IssueFilters>(DEFAULT_FILTERS);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const summary = useAsyncData((signal, force) => api.summary(projectKey, force, signal), [projectKey]);
  const issues = useAsyncData(
    (signal, force) => api.issues(projectKey, filters, force, signal),
    [projectKey, JSON.stringify(filters)],
  );

  useEffect(() => {
    const m = issues.data?.meta;
    reportSync(m ? { at: new Date(m.fetched_at), cached: m.cached } : null);
  }, [issues.data, reportSync]);

  const change = useCallback((patch: Partial<IssueFilters>) => {
    setFilters((f) => ({ ...f, ...patch, page: "page" in patch ? (patch.page as number) : 1 }));
  }, []);
  const reset = useCallback(() => setFilters((f) => ({ ...DEFAULT_FILTERS, page_size: f.page_size })), []);
  const dirty = FILTER_KEYS.some((k) => filters[k] !== DEFAULT_FILTERS[k]);
  const colors = useMemo(() => colorMap(summary.data?.statuses ?? []), [summary.data]);

  const onSort = (by: SortBy) =>
    change(filters.sort_by === by ? { sort_order: filters.sort_order === "asc" ? "desc" : "asc" } : { sort_by: by, sort_order: "desc" });

  const exportCsv = async () => {
    setExporting(true); setNotice(null);
    try {
      const r = await api.exportCsv(projectKey, filters);
      setNotice({ ok: true, text: `Exported ${formatNumber(r.rows)} tickets to ${r.filename}.` });
    } catch (e) {
      setNotice({ ok: false, text: toApiError(e).message });
    } finally { setExporting(false); }
  };

  const s = summary.data;
  const total = issues.data?.pagination.total;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{s?.name ?? projectKey}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
            <span>Project key <strong className="text-ink">{projectKey}</strong></span>
            {s && <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-plum-700">Open in Jira <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={refreshAll} disabled={pending > 0}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </button>
          <button type="button" className="btn-primary" onClick={exportCsv} disabled={exporting || !issues.data || issues.data.pagination.total === 0}>
            <Download className="h-4 w-4" aria-hidden="true" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </header>

      {notice && <p role="status" className={`rounded-lg px-4 py-2 text-sm ${notice.ok ? "bg-sand-100 text-sand-700" : "bg-plum-50 text-plum-800"}`}>{notice.text}</p>}

      {summary.error ? <ErrorState error={summary.error} onRetry={summary.retry} compact /> : !s ? <StatCardsSkeleton /> : (
        <section aria-label="Status totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total tickets" count={s.total} emphasis active={!filters.status} onClick={() => change({ status: "" })} />
          {s.statuses.map((st) => (
            <StatCard key={st.name} label={st.name} count={st.count} total={s.total} color={colors[st.name]}
              active={filters.status === st.name} onClick={() => change({ status: filters.status === st.name ? "" : st.name })} />
          ))}
        </section>
      )}

      <Filters value={filters} summary={s} onChange={change} onReset={reset} dirty={dirty} />

      <section aria-label="Tickets" className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p aria-live="polite" className="text-sm font-medium">
            {total === undefined ? (issues.loading ? "Loading tickets…" : "") : `${formatNumber(total)} ${total === 1 ? "ticket matches" : "tickets match"}`}
          </p>
        </div>
        {issues.error ? (
          <div className="p-4"><ErrorState error={issues.error} onRetry={issues.retry} compact /></div>
        ) : (
          <>
            <IssueTable items={issues.data?.items ?? null} loading={issues.loading} sortBy={filters.sort_by}
              sortOrder={filters.sort_order} onSort={onSort} onReset={reset} pageSize={filters.page_size} />
            {issues.data && issues.data.pagination.total > 0 && (
              <Pagination p={issues.data.pagination} disabled={issues.loading} onPage={(n) => change({ page: n })}
                onSize={(n) => change({ page_size: n })} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function ProjectPage() {
  const { key = "" } = useParams();
  const { projects } = useApp();
  const upper = key.toUpperCase();
  if (projects && !projects.some((p) => p.key === upper)) return <Navigate to="/" replace />;
  return <Explorer key={upper} projectKey={upper} />;
}
