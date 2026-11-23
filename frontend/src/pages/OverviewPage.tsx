import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ClipboardList, ExternalLink, Star } from "lucide-react";

import { BookmarkButton } from "../components/BookmarkButton";
import { ErrorState } from "../components/ErrorState";
import { ProjectOverview } from "../components/ProjectOverview";
import { Skeleton, StatCardsSkeleton } from "../components/Skeleton";
import { useApp } from "../context/AppContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { useBookmarks } from "../hooks/useBookmarks";
import { api } from "../services/api";

export default function OverviewPage() {
  const navigate = useNavigate();

  const { reportSync, projects } = useApp();

  const {
    data,
    error,
    loading,
    retry,
  } = useAsyncData(
    (signal, force) => api.dashboard(force, signal),
    [],
  );

  const {
    bookmarks,
    loading: bookmarksLoading,
    error: bookmarkError,
    pendingIds,
    removeBookmark,
  } = useBookmarks();

  useEffect(() => {
    reportSync(
      data?.synced_at
        ? {
          at: new Date(data.synced_at),
          cached: data.cached,
        }
        : null,
    );
  }, [data, reportSync]);

  return (
    <div className="space-y-10">
      {/* Existing Overview Header */}
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Overview
        </h1>

        <p className="mt-1 text-ink-soft">
          Live ticket counts from {data?.jira_site ?? "Jira"}, by project and workflow status.
        </p>
      </header>

      {/* Existing Manual Scripts Navigation Card */}
      <button
        type="button"
        onClick={() => navigate("/manual-scripts")}
        className="group flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-plum-300 hover:shadow-md sm:max-w-md"
      >
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-sand-100 p-3 text-plum-900 transition-colors group-hover:bg-plum-900 group-hover:text-white">
            <ClipboardList className="h-6 w-6" />
          </div>

          <div>
            <h2 className="font-semibold text-ink">
              Manual Ticket Cases
            </h2>

            <p className="mt-1 text-sm text-ink-soft">
              View all Manual testing scripts and summaries.
            </p>
          </div>
        </div>

        <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-plum-900" />
      </button>

      {/* Bookmarked Tickets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
              Bookmarked Tickets
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Tickets you have saved from Testing Dashboard and Manual Scripts.
            </p>
          </div>

          <span className="rounded-full bg-sand-100 px-3 py-1 text-xs font-semibold text-plum-900">
            {bookmarks.length} saved
          </span>
        </div>

        {bookmarkError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {bookmarkError}
          </div>
        )}

        {bookmarksLoading ? (
          <div
            role="status"
            className="rounded-xl border border-line bg-white p-8 text-center text-sm text-ink-soft"
          >
            Loading bookmarked tickets...
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="rounded-xl border border-line bg-white p-8 text-center">
            <Star className="mx-auto h-8 w-8 text-ink-soft" />
            <h3 className="mt-3 font-semibold text-ink">
              No bookmarked tickets yet
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Select the star beside a ticket in Testing Dashboard or Manual Scripts to save it here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((ticket) => (
              <article
                key={ticket.jira_issue_id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={ticket.jira_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-plum-900 hover:underline"
                    >
                      {ticket.jira_key}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    {ticket.category && (
                      <span className="rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-plum-900">
                        {ticket.category}
                      </span>
                    )}

                    {ticket.status && (
                      <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">
                        {ticket.status}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 break-words text-sm font-medium text-ink">
                    {ticket.summary || "No summary available"}
                  </p>

                  {ticket.reporter_name && (
                    <p className="mt-1 text-xs text-ink-soft">
                      Created by: {ticket.reporter_name}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center justify-end">
                  <BookmarkButton
                    bookmarked
                    loading={pendingIds.includes(ticket.jira_issue_id)}
                    onClick={() => void removeBookmark(ticket.jira_issue_id)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Existing Error Handling */}
      {error && (
        <ErrorState
          error={error}
          onRetry={retry}
        />
      )}

      {/* Existing Loading Skeletons */}
      {!data && loading && !error && (
        <div
          className="space-y-6"
          role="status"
          aria-label="Loading dashboard"
        >
          {(projects?.length
            ? projects
            : [{ key: "a" }, { key: "b" }]
          ).map((p) => (
            <div
              key={p.key}
              className="space-y-3"
            >
              <Skeleton className="h-9 w-64" />
              <StatCardsSkeleton />
              <Skeleton className="h-56" />
            </div>
          ))}
        </div>
      )}

      {/* Existing Project Overview */}
      {data?.projects.map((p) => (
        <ProjectOverview
          key={p.key}
          project={p}
        />
      ))}
    </div>
  );
}
