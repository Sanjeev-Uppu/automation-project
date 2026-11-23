
import type {
  DashboardResponse,
  ErrorBody,
  IssueFilters,
  IssuePage,
  ProjectsResponse,
  ProjectSummary,
  Readiness,
  TestingCategory,
  TestingDashboardSummary,
  TestingSyncResult,
  TestingSyncStatusResponse,
  TestingTicketPage,
  BookmarkResponse,
} from "../types/api";

const BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "";

export class ApiError extends Error {
  code: string;
  hint?: string | null;
  status: number;

  constructor(
    code: string,
    message: string,
    status = 0,
    hint?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

type Params = Record<
  string,
  string | number | boolean | undefined | null
>;

function qs(params: Params = {}): string {
  const sp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  }

  const search = sp.toString();
  return search ? `?${search}` : "";
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: {
    error?: ErrorBody;
    jira?: { error?: ErrorBody | null };
    detail?: string;
  } | null = null;

  try {
    body = await res.json();
  } catch {
    // Response was not JSON.
  }

  const error = body?.error ?? body?.jira?.error;

  if (error) {
    return new ApiError(
      error.code,
      error.message,
      res.status,
      error.hint,
    );
  }

  return new ApiError(
    "http_error",
    body?.detail ??
    `The server answered with HTTP ${res.status}.`,
    res.status,
  );
}

async function send(
  path: string,
  params: Params = {},
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(`${BASE}/api${path}${qs(params)}`, {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json",
      },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw err;
    }

    throw new ApiError(
      "network_error",
      "The dashboard could not reach its backend.",
      0,
      "Make sure the backend is running (uvicorn app.main:app) and refresh this page.",
    );
  }
}

async function get<T>(
  path: string,
  params: Params = {},
  signal?: AbortSignal,
): Promise<T> {
  const res = await send(path, params, signal);

  if (!res.ok) {
    throw await toApiError(res);
  }

  return (await res.json()) as T;
}

// -----------------------------------------------------------------------------
// Bookmark API helpers
// -----------------------------------------------------------------------------

/**
 * Read the CSRF token from the readable cookie.
 * The access token remains HttpOnly and is never accessed by JavaScript.
 */
function getCsrfToken(): string | null {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith("csrf_token="));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.substring("csrf_token=".length));
}

/**
 * Send authenticated bookmark requests.
 * GET is read-only. POST and DELETE include the CSRF token.
 */
async function bookmarkRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (method === "POST" || method === "DELETE") {
    const csrfToken = getCsrfToken();

    if (!csrfToken) {
      throw new ApiError(
        "csrf_token_missing",
        "Your security token is missing. Please refresh the page and try again.",
        403,
      );
    }

    headers["X-CSRF-Token"] = csrfToken;
  }

  let res: Response;

  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      credentials: "include",
      headers,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw err;
    }

    throw new ApiError(
      "network_error",
      "Could not connect to the backend.",
      0,
      "Make sure the backend is running and try again.",
    );
  }

  if (!res.ok) {
    throw await toApiError(res);
  }

  // DELETE endpoints may return HTTP 204 with no response body.
  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("Content-Type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// -----------------------------------------------------------------------------
// Existing Jira API parameters
// -----------------------------------------------------------------------------

export function issueParams(f: IssueFilters): Params {
  return {
    status: f.status,
    search: f.search,
    assignee: f.assignee,
    issue_type: f.issue_type,
    priority: f.priority,
    created_after: f.created_after,
    created_before: f.created_before,
    updated_after: f.updated_after,
    updated_before: f.updated_before,
    sort_by: f.sort_by,
    sort_order: f.sort_order,
  };
}

// -----------------------------------------------------------------------------
// API methods
// -----------------------------------------------------------------------------

export const api = {
  // ---------------------------------------------------------------------------
  // Existing Jira APIs
  // ---------------------------------------------------------------------------

  ready: (refresh: boolean, signal?: AbortSignal) =>
    // /ready can return 503 with a JSON body when Jira is not connected.
    send("/ready", { refresh }, signal).then(async (res) => {
      if (res.status === 200 || res.status === 503) {
        const body = (await res.json()) as Readiness;

        if (body?.status) {
          return body;
        }
      }

      throw await toApiError(res);
    }),

  projects: (refresh: boolean, signal?: AbortSignal) =>
    get<ProjectsResponse>("/projects", { refresh }, signal),

  dashboard: (refresh: boolean, signal?: AbortSignal) =>
    get<DashboardResponse>("/dashboard", { refresh }, signal),

  summary: (
    key: string,
    refresh: boolean,
    signal?: AbortSignal,
  ) =>
    get<ProjectSummary>(
      `/projects/${encodeURIComponent(key)}/summary`,
      { refresh },
      signal,
    ),

  issues: (
    key: string,
    f: IssueFilters,
    refresh: boolean,
    signal?: AbortSignal,
  ) =>
    get<IssuePage>(
      `/projects/${encodeURIComponent(key)}/issues`,
      {
        ...issueParams(f),
        page: f.page,
        page_size: f.page_size,
        refresh,
      },
      signal,
    ),

  /** Downloads every ticket matching the filters, not just the current page. */
  async exportCsv(
    key: string,
    f: IssueFilters,
  ): Promise<{ rows: number; filename: string }> {
    const res = await send(
      `/projects/${encodeURIComponent(key)}/export`,
      issueParams(f),
    );

    if (!res.ok) {
      throw await toApiError(res);
    }

    const blob = await res.blob();

    const filename =
      /filename="([^"]+)"/.exec(
        res.headers.get("Content-Disposition") ?? "",
      )?.[1] ?? `${key}-issues.csv`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    return {
      rows: Number(res.headers.get("X-Row-Count") ?? 0),
      filename,
    };
  },

  // ---------------------------------------------------------------------------
  // Testing Dashboard APIs
  // ---------------------------------------------------------------------------

  /**
   * Get Manual or Automation tickets with independent filters and pagination.
   */
  testingTickets: (
    category: TestingCategory,
    params: {
      search?: string;
      status?: string;
      priority?: string;
      created_after?: string;
      created_before?: string;
      page?: number;
      page_size?: number;
    },
    signal?: AbortSignal,
  ) =>
    get<TestingTicketPage>(
      `/testing-dashboard/${category}`,
      params,
      signal,
    ),

  /**
   * Get Manual, Automation and total ticket counts.
   */
  testingSummary: (signal?: AbortSignal) =>
    get<TestingDashboardSummary>(
      "/testing-dashboard/summary",
      {},
      signal,
    ),

  /**
   * Get synchronization status for all Jira projects.
   */
  testingSyncStatus: (signal?: AbortSignal) =>
    get<TestingSyncStatusResponse>(
      "/testing-dashboard/sync-status",
      {},
      signal,
    ),

  /**
   * Trigger Jira ticket synchronization into PostgreSQL.
   * This is a POST request, unlike the read-only GET methods above.
   */
  async syncTestingDashboard(): Promise<TestingSyncResult> {
    let res: Response;

    try {
      res = await fetch(`${BASE}/api/testing-dashboard/sync`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });
    } catch {
      throw new ApiError(
        "network_error",
        "Could not connect to the backend.",
        0,
        "Make sure the backend is running and try again.",
      );
    }

    if (!res.ok) {
      throw await toApiError(res);
    }

    return (await res.json()) as TestingSyncResult;
  },

  // ---------------------------------------------------------------------------
  // Ticket Bookmark APIs
  // ---------------------------------------------------------------------------

  /**
   * Get all tickets bookmarked by the currently authenticated user.
   */
  bookmarks: (signal?: AbortSignal) =>
    bookmarkRequest<BookmarkResponse>(
      "/bookmarks",
      "GET",
      signal,
    ),

  /**
   * Bookmark a ticket for the currently authenticated user.
   */
  addBookmark: (jiraIssueId: string) =>
    bookmarkRequest<void>(
      `/bookmarks/${encodeURIComponent(jiraIssueId)}`,
      "POST",
    ),

  /**
   * Remove a ticket from the currently authenticated user's bookmarks.
   */
  removeBookmark: (jiraIssueId: string) =>
    bookmarkRequest<void>(
      `/bookmarks/${encodeURIComponent(jiraIssueId)}`,
      "DELETE",
    ),
};
