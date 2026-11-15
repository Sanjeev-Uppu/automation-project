import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../services/api";
import type { ProjectInfo, Readiness } from "../types/api";
import { toApiError } from "../utils/errors";

export interface SyncInfo { at: Date; cached: boolean }

interface AppState {
  readiness: Readiness | null;
  readinessError: ApiError | null;
  projects: ProjectInfo[] | null;
  projectsError: ApiError | null;
  jiraSite: string | null;
  refreshNonce: number;
  refreshAll: () => void;
  pending: number;
  trackLoading: (delta: 1 | -1) => void;
  lastSync: SyncInfo | null;
  reportSync: (s: SyncInfo | null) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessError, setReadinessError] = useState<ApiError | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null);
  const [projectsError, setProjectsError] = useState<ApiError | null>(null);
  const [jiraSite, setJiraSite] = useState<string | null>(null);
  const [refreshNonce, setNonce] = useState(0);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<SyncInfo | null>(null);
  const nonceSeen = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const force = nonceSeen.current !== refreshNonce;
    nonceSeen.current = refreshNonce;
    api.ready(force, ctrl.signal)
      .then((r) => { setReadiness(r); setReadinessError(null); })
      .catch((e) => { if (!ctrl.signal.aborted) setReadinessError(toApiError(e)); });
    api.projects(force, ctrl.signal)
      .then((r) => { setProjects(r.projects); setJiraSite(r.jira_site); setProjectsError(null); })
      .catch((e) => { if (!ctrl.signal.aborted) { setProjects(null); setProjectsError(toApiError(e)); } });
    return () => ctrl.abort();
  }, [refreshNonce]);

  // Keep the connection indicator honest while the tab stays open.
  useEffect(() => {
    const id = window.setInterval(() => {
      api.ready(false).then((r) => { setReadiness(r); setReadinessError(null); })
        .catch((e) => setReadinessError(toApiError(e)));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const refreshAll = useCallback(() => setNonce((n) => n + 1), []);
  const trackLoading = useCallback((d: 1 | -1) => setPending((p) => Math.max(0, p + d)), []);

  const value = useMemo<AppState>(
    () => ({
      readiness, readinessError, projects, projectsError, jiraSite, refreshNonce, refreshAll,
      pending, trackLoading, lastSync, reportSync: setLastSync,
    }),
    [readiness, readinessError, projects, projectsError, jiraSite, refreshNonce, refreshAll, pending, trackLoading, lastSync],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
