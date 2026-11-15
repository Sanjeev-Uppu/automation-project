// Fixtures below exist ONLY for isolated tests; the app itself never ships mock data.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ApiError } from "../services/api";
import type { DashboardResponse, Issue, IssueFilters, IssuePage, ProjectSummary } from "../types/api";

const m = vi.hoisted(() => ({
  ready: vi.fn(), projects: vi.fn(), dashboard: vi.fn(), summary: vi.fn(), issues: vi.fn(), exportCsv: vi.fn(),
}));
vi.mock("../services/api", async (orig) => ({ ...(await orig<typeof import("../services/api")>()), api: m }));

const meta = { fetched_at: "2026-01-02T03:04:05Z", cached: false, ttl_seconds: 60 };
const summaryFor = (key: string, name: string, counts: [string, string, number][]): ProjectSummary => ({
  key, name, url: `https://acme.test/browse/${key}`, total: counts.reduce((a, c) => a + c[2], 0),
  statuses: counts.map(([n, category, count]) => ({ id: n, name: n, category, category_name: category, count })),
  issue_types: [{ id: "1", name: "Bug", count: 3 }], priorities: [{ id: "1", name: "High", count: 2 }],
  assignees: [{ account_id: "acc1", display_name: "Alice", count: 2 }], unassigned: 1, meta,
});
const SUMMARIES: Record<string, ProjectSummary> = {
  TDF: summaryFor("TDF", "Tech Debt Fund", [["Open", "new", 4], ["Closed", "done", 3], ["Waiting on vendor", "indeterminate", 2]]),
  BE: summaryFor("BE", "Backend", [["Open", "new", 7], ["Resolved", "done", 5]]),
};
const issue = (key: string, status = "Open"): Issue => ({
  id: key, key, url: `https://acme.test/browse/${key}`, summary: `Summary ${key}`,
  status: { id: "1", name: status, category: "new" }, assignee: null, reporter: { account_id: "r", display_name: "Rita" },
  issue_type: { id: "1", name: "Bug" }, priority: { id: "1", name: "High" },
  created: "2025-01-02T10:00:00Z", updated: "2025-02-03T10:00:00Z",
});
const page = (items: Issue[], f: IssueFilters, total = items.length): IssuePage => ({
  items, jql: "x", meta,
  pagination: { page: f.page, page_size: f.page_size, total, total_pages: Math.max(1, Math.ceil(total / f.page_size)),
    has_next: f.page * f.page_size < total, has_prev: f.page > 1 },
});

beforeEach(() => {
  vi.clearAllMocks();
  m.ready.mockResolvedValue({ status: "ready", jira: { connected: true, site: "acme.test", account: "Test User", checked_at: meta.fetched_at, error: null } });
  m.projects.mockResolvedValue({ jira_site: "acme.test", projects: [
    { key: "TDF", name: "Tech Debt Fund", url: "u", ok: true, error: null },
    { key: "BE", name: "Backend", url: "u", ok: true, error: null }] });
  m.dashboard.mockResolvedValue({ jira_site: "acme.test", synced_at: meta.fetched_at, cached: false, projects: [
    { key: "TDF", url: "u", ok: true, summary: SUMMARIES.TDF, error: null },
    { key: "BE", url: "u", ok: true, summary: SUMMARIES.BE, error: null }] } satisfies DashboardResponse);
  m.summary.mockImplementation(async (key: string) => SUMMARIES[key]);
  m.issues.mockImplementation(async (key: string, f: IssueFilters) =>
    page([issue(`${key}-1`, f.status || "Open"), issue(`${key}-2`, f.status || "Open")], f, 60));
  m.exportCsv.mockResolvedValue({ rows: 60, filename: "TDF-issues.csv" });
});

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

describe("Overview", () => {
  it("shows both projects with statuses discovered from the API", async () => {
    renderAt("/");
    const tdf = await screen.findByRole("region", { name: "Tech Debt Fund project" });
    expect(within(tdf).getAllByText("Waiting on vendor").length).toBeGreaterThanOrEqual(2); // card + bar: a status the app has never heard of
    expect(within(tdf).getByText("Total tickets").closest("div")).toHaveTextContent("9");
    const be = screen.getByRole("region", { name: "Backend project" });
    expect(within(be).getAllByText("Resolved").length).toBeGreaterThanOrEqual(2);
    expect(within(be).getByText("Total tickets").closest("div")).toHaveTextContent("12");
    expect(await screen.findByText(/Connected to Jira/)).toBeInTheDocument();
    expect(screen.getByText(/Last synced/)).toBeInTheDocument();
  });

  it("shows a visible error for a failing project instead of zeros", async () => {
    const d = await m.dashboard();
    d.projects[1] = { key: "BE", url: "u", ok: false, summary: null, error: { code: "jira_forbidden", message: "Your Jira account is not allowed to read this data." } };
    m.dashboard.mockResolvedValue(d);
    renderAt("/");
    expect(await screen.findByRole("alert")).toHaveTextContent("No permission to read this Jira data");
    expect(screen.getByRole("region", { name: "Tech Debt Fund project" })).toBeInTheDocument();
  });

  it("explains missing credentials", async () => {
    m.dashboard.mockRejectedValue(new ApiError("jira_not_configured", "JIRA_API_TOKEN is not set", 503, "Edit backend/.env"));
    renderAt("/");
    expect(await screen.findByText("Jira is not configured yet")).toBeInTheDocument();
    expect(screen.getByText("Edit backend/.env")).toBeInTheDocument();
  });
});

describe("Project explorer", () => {
  it("switches projects from the sidebar and loads that project's data", async () => {
    const user = userEvent.setup();
    renderAt("/projects/TDF");
    expect(await screen.findByRole("heading", { name: "Tech Debt Fund" })).toBeInTheDocument();
    expect(await screen.findByText("TDF-1")).toBeInTheDocument();
    await user.click(within(screen.getAllByRole("navigation", { name: "Main" })[0]).getByRole("link", { name: /Backend/ }));
    expect(await screen.findByRole("heading", { name: "Backend" })).toBeInTheDocument();
    expect(await screen.findByText("BE-1")).toBeInTheDocument();
    expect(screen.queryByText("TDF-1")).not.toBeInTheDocument();
    expect(m.issues).toHaveBeenLastCalledWith("BE", expect.anything(), false, expect.anything());
  });

  it("filters by exact status chosen from the dropdown and from the status cards", async () => {
    const user = userEvent.setup();
    renderAt("/projects/TDF");
    await screen.findByText("TDF-1");
    const select = screen.getByLabelText("Status");
    expect(within(select).getByRole("option", { name: "Waiting on vendor (2)" })).toBeInTheDocument();
    await user.selectOptions(select, "Closed");
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF", expect.objectContaining({ status: "Closed", page: 1 }), false, expect.anything()));
    await waitFor(() => expect(screen.getAllByText("Closed").length).toBeGreaterThan(1));
    await user.click(screen.getByRole("button", { name: /Waiting on vendor/ }));
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF", expect.objectContaining({ status: "Waiting on vendor" }), false, expect.anything()));
  });

  it("combines search with other filters and resets everything", async () => {
    const user = userEvent.setup();
    renderAt("/projects/TDF");
    await screen.findByText("TDF-1");
    await user.selectOptions(screen.getByLabelText("Priority"), "High");
    await user.type(screen.getByLabelText("Search ticket ID or summary"), "login");
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF",
      expect.objectContaining({ search: "login", priority: "High" }), false, expect.anything()));
    await user.click(screen.getByRole("button", { name: /Reset filters/ }));
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF",
      expect.objectContaining({ search: "", priority: "", status: "" }), false, expect.anything()));
    expect(screen.getByLabelText("Search ticket ID or summary")).toHaveValue("");
  });

  it("sorts by created and updated dates", async () => {
    const user = userEvent.setup();
    renderAt("/projects/TDF");
    await screen.findByText("TDF-1");
    await user.click(screen.getByRole("button", { name: /Created/ }));
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF", expect.objectContaining({ sort_by: "created", sort_order: "asc" }), false, expect.anything()));
    await user.click(screen.getByRole("button", { name: /Updated/ }));
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF", expect.objectContaining({ sort_by: "updated", sort_order: "desc" }), false, expect.anything()));
  });

  it("paginates on the server and returns to page 1 when page size changes", async () => {
    const user = userEvent.setup();
    renderAt("/projects/TDF");
    await screen.findByText("TDF-1");
    expect(screen.getByText(/Showing 1–25 of 60/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF", expect.objectContaining({ page: 2 }), false, expect.anything()));
    await user.selectOptions(screen.getByLabelText("Rows"), "50");
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF", expect.objectContaining({ page: 1, page_size: 50 }), false, expect.anything()));
  });

  it("links tickets to the real Jira URL in a new tab", async () => {
    renderAt("/projects/TDF");
    const link = await screen.findByRole("link", { name: "TDF-1" });
    expect(link).toHaveAttribute("href", "https://acme.test/browse/TDF-1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("exports the CSV for the current filters, not just the visible page", async () => {
    const user = userEvent.setup();
    renderAt("/projects/TDF");
    await screen.findByText("TDF-1");
    await user.selectOptions(screen.getByLabelText("Status"), "Closed");
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF", expect.objectContaining({ status: "Closed" }), false, expect.anything()));
    await user.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() => expect(m.exportCsv).toHaveBeenCalledWith("TDF", expect.objectContaining({ status: "Closed" })));
    expect(await screen.findByText(/Exported 60 tickets/)).toBeInTheDocument();
  });

  it("shows the empty state and the result count", async () => {
    m.issues.mockImplementation(async (_k: string, f: IssueFilters) => page([], f));
    renderAt("/projects/TDF");
    expect(await screen.findByText("No tickets match these filters")).toBeInTheDocument();
    expect(screen.getByText("0 tickets match")).toBeInTheDocument();
  });

  it("shows an error and retries, never leaving stale rows on screen", async () => {
    const user = userEvent.setup();
    renderAt("/projects/TDF");
    await screen.findByText("TDF-1");
    m.issues.mockRejectedValueOnce(new ApiError("jira_unavailable", "Jira is temporarily unavailable (HTTP 503)."));
    await user.selectOptions(screen.getByLabelText("Status"), "Closed");
    const alert = await screen.findByText("Jira is temporarily unavailable (HTTP 503).");
    expect(alert).toBeInTheDocument();
    expect(screen.queryByText("TDF-1")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Try again/ })[0]);
    expect(await screen.findByText("TDF-1")).toBeInTheDocument();
  });

  it("refresh asks the backend to bypass its cache", async () => {
    const user = userEvent.setup();
    renderAt("/projects/TDF");
    await screen.findByText("TDF-1");
    await user.click(screen.getAllByRole("button", { name: /Refresh/ })[0]);
    await waitFor(() => expect(m.issues).toHaveBeenLastCalledWith("TDF", expect.anything(), true, expect.anything()));
    await waitFor(() => expect(m.summary).toHaveBeenLastCalledWith("TDF", true, expect.anything()));
  });
});
