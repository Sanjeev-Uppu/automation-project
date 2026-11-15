
import {
  LayoutDashboard,
  Menu,
  RefreshCw,
  X,
  FolderKanban,
  ClipboardList,
  UserRound,
  ChevronDown,
  LogOut,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { ConnectionStatus } from "../components/ConnectionStatus";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { formatTime } from "../utils/format";

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
    ? "bg-sand-500 text-plum-900"
    : "text-cream-200 hover:bg-white/10"
  }`;

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { projects, refreshAll, pending, lastSync } = useApp();
  const { user, logout } = useAuth();

  const navigate = useNavigate();
  const busy = pending > 0;

  const initials = user?.full_name
    ? user.full_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
    : "U";

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setProfileOpen(false);
      navigate("/login", { replace: true });
    }
  };

  const nav = (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="font-display text-2xl font-semibold tracking-tight text-cream-100">
        Team Automation
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
      {/* Desktop sidebar */}
      <aside className="hidden bg-plum-900 lg:block">
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>

      {/* Mobile sidebar */}
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

      {/* Main content */}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-cream-100/95 px-4 py-3 backdrop-blur sm:px-8">
          {/* Mobile menu button */}
          <button
            type="button"
            className="btn-secondary !px-2.5 lg:hidden"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Sync information */}
          <p
            className="ml-auto hidden text-sm text-ink-soft sm:block"
            aria-live="polite"
          >
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

          {/* Jira refresh */}
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
            <span className="hidden sm:inline">Refresh from Jira</span>
            <span className="sm:hidden">Refresh</span>
          </button>

          {/* Profile menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
              aria-label="Open profile menu"
              className="flex items-center gap-2 rounded-xl border border-plum-900/10 bg-white px-2.5 py-2 transition hover:border-sand-500 hover:bg-sand-100"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-plum-900 text-sm font-semibold text-cream-100">
                {initials}
              </span>

              <span className="hidden max-w-32 text-left sm:block">
                <span className="block truncate text-sm font-semibold text-plum-900">
                  {user?.full_name || "My Account"}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {user?.email || ""}
                </span>
              </span>

              <ChevronDown
                className={`hidden h-4 w-4 text-plum-900 transition-transform sm:block ${profileOpen ? "rotate-180" : ""
                  }`}
              />
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close profile menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setProfileOpen(false)}
                />

                <div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-xl border border-plum-900/10 bg-white shadow-xl">
                  <div className="border-b border-line bg-cream-100 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum-900 font-semibold text-cream-100">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-plum-900">
                          {user?.full_name || "User"}
                        </p>
                        <p className="truncate text-xs text-ink-soft">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-2">
                    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-plum-900">
                      <UserRound className="h-4 w-4" />
                      <span>My Profile</span>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-soft">
                      <Settings className="h-4 w-4" />
                      <span>Account Settings</span>
                      <span className="ml-auto text-xs">Soon</span>
                    </div>

                    <div className="my-1 border-t border-line" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
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
