import { ApiError } from "../services/api";

const TITLES: Record<string, string> = {
  jira_not_configured: "Jira is not configured yet",
  jira_auth_failed: "Jira rejected the credentials",
  jira_forbidden: "No permission to read this Jira data",
  jira_rate_limited: "Jira is rate limiting requests",
  jira_unavailable: "Jira is not reachable right now",
  network_error: "The backend is not reachable",
  project_not_configured: "Project is not configured",
  not_found: "Not found in Jira",
  invalid_parameter: "A filter value is not valid",
  invalid_query: "Jira could not run this query",
};

export const errorTitle = (e: ApiError) => TITLES[e.code] ?? "Something went wrong";
export const toApiError = (e: unknown): ApiError =>
  e instanceof ApiError ? e : new ApiError("unexpected", e instanceof Error ? e.message : "Unexpected error.");
