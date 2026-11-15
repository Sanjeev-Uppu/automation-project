import { useApp } from "../context/AppContext";

export function ConnectionStatus() {
  const { readiness, readinessError } = useApp();
  let state: "ok" | "bad" | "unknown" = "unknown";
  let title = "Checking Jira connection…";
  let detail = "";
  if (readinessError) { state = "bad"; title = "Backend unreachable"; detail = readinessError.message; }
  else if (readiness?.jira.connected) {
    state = "ok"; title = "Connected to Jira";
    detail = [readiness.jira.site, readiness.jira.account].filter(Boolean).join(" · ");
  } else if (readiness) {
    state = "bad"; title = "Not connected to Jira"; detail = readiness.jira.error?.message ?? "";
  }
  const color = state === "ok" ? "bg-[#6FB083]" : state === "bad" ? "bg-[#E0705F]" : "bg-sand-500";
  return (
    <div role="status" aria-live="polite" className="rounded-xl bg-white/5 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-cream-100">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />{title}
      </div>
      {detail && <p className="mt-1 break-words text-xs text-cream-300/80">{detail}</p>}
    </div>
  );
}
