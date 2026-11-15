
import {
  LayoutDashboard,
  Menu,
  RefreshCw,
  X,
  FolderKanban,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useApp } from "../context/AppContext";
import { formatTime } from "../utils/format";

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
    ? "bg-sand-500 text-plum-900"
    : "text-cream-200 hover:bg-white/10"
  }`;

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { projects, refreshAll, pending, lastSync } = useApp();
  const busy = pending > 0;

  const nav = (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="font-display text-2xl font-semibold tracking-tight text-cream-100">
        Auto Project
      </div>

      <nav aria-label="Main" className="space-y-1">
        <NavLink
          to="/"
          end
          className={link}
          onClick={() => setOpen(false)}
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Overview
        </NavLink>

        <NavLink
          to="/testing-dashboard"
          className={link}
          onClick={() => setOpen(false)}
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Testing Dashboard
        </NavLink>

        {projects?.map((p) => (
          <NavLink
            key={p.key}
            to={`/projects/${p.key}`}
            className={link}
            onClick={() => setOpen(false)}
          >
            <FolderKanban
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">
              {p.name ?? p.key}
            </span>
            <span className="text-xs opacity-70">{p.key}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <ConnectionStatus />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden bg-plum-900 lg:block">
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-plum-900/60"
            onClick={() => setOpen(false)}
          />

          <aside className="relative h-full w-72 max-w-[85vw] bg-plum-900 shadow-pop">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute right-3 top-3 rounded-lg p-2 text-cream-200 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-cream-100/90 px-4 py-3 backdrop-blur sm:px-8">
          <button
            type="button"
            className="btn-secondary !px-2.5 lg:hidden"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <p className="ml-auto text-sm text-ink-soft" aria-live="polite">
            {lastSync ? (
              <>
                Last synced {formatTime(lastSync.at)}
                {lastSync.cached && (
                  <span className="ml-2 rounded-full bg-sand-200 px-2 py-0.5 text-xs text-sand-700">
                    cached
                  </span>
                )}
              </>
            ) : (
              "Not synced yet"
            )}
          </p>

          <button
            type="button"
            className="btn-primary"
            onClick={refreshAll}
            disabled={busy}
          >
            <RefreshCw
              className={`h-4 w-4 ${busy ? "motion-safe:animate-spin" : ""
                }`}
              aria-hidden="true"
            />
            Refresh from Jira
          </button>
        </header>

        <main className="mx-auto max-w-[88rem] px-4 py-8 sm:px-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
