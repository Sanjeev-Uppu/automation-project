import {
    useEffect,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";

import {
    RefreshCw,
    Search,
    FilterX,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    ClipboardList,
    Bot,
    ListChecks,
} from "lucide-react";

import { api, ApiError } from "../services/api";
import type {
    TestingCategory,
    TestingDashboardSummary,
    TestingProjectSyncStatus,
    TestingTicket,
    TestingTicketPage,
} from "../types/api";

interface TicketFilters {
    search: string;
    status: string;
    priority: string;
    created_after: string;
    created_before: string;
    page: number;
    page_size: number;
}

const emptyFilters: TicketFilters = {
    search: "",
    status: "",
    priority: "",
    created_after: "",
    created_before: "",
    page: 1,
    page_size: 25,
};

const initialFilters: Record<TestingCategory, TicketFilters> = {
    manual: { ...emptyFilters },
    automation: { ...emptyFilters },
};

function errorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error) return error.message;
    return "Something went wrong. Please try again.";
}

function formatDate(value: string | null): string {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
}

function SummaryCard({
    title,
    value,
    icon,
}: {
    title: string;
    value: number;
    icon: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink-soft">{title}</p>
                <span className="rounded-lg bg-sand-100 p-2 text-plum-900">
                    {icon}
                </span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
        </div>
    );
}

export default function TestingDashboardPage() {
    const [category, setCategory] =
        useState<TestingCategory>("manual");

    const [draftFilters, setDraftFilters] =
        useState<Record<TestingCategory, TicketFilters>>(
            initialFilters,
        );

    const [appliedFilters, setAppliedFilters] =
        useState<Record<TestingCategory, TicketFilters>>(
            initialFilters,
        );

    const [summary, setSummary] =
        useState<TestingDashboardSummary | null>(null);

    const [ticketPage, setTicketPage] =
        useState<TestingTicketPage | null>(null);

    const [syncStates, setSyncStates] =
        useState<TestingProjectSyncStatus[]>([]);

    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [syncMessage, setSyncMessage] = useState("");

    const filters = draftFilters[category];
    const activeFilters = appliedFilters[category];

    // Load summary and project synchronization information.
    useEffect(() => {
        const controller = new AbortController();

        async function loadDashboardInfo() {
            try {
                const [summaryResult, syncResult] = await Promise.all([
                    api.testingSummary(controller.signal),
                    api.testingSyncStatus(controller.signal),
                ]);

                setSummary(summaryResult);
                setSyncStates(syncResult.projects);
            } catch (err) {
                if ((err as Error).name !== "AbortError") {
                    setError(errorMessage(err));
                }
            }
        }

        loadDashboardInfo();

        return () => controller.abort();
    }, []);

    // Load tickets whenever the selected category or applied filters change.
    useEffect(() => {
        const controller = new AbortController();

        async function loadTickets() {
            setLoading(true);
            setError("");

            try {
                const result = await api.testingTickets(
                    category,
                    {
                        search: activeFilters.search,
                        status: activeFilters.status,
                        priority: activeFilters.priority,
                        created_after: activeFilters.created_after,
                        created_before: activeFilters.created_before,
                        page: activeFilters.page,
                        page_size: activeFilters.page_size,
                    },
                    controller.signal,
                );

                setTicketPage(result);
            } catch (err) {
                if ((err as Error).name !== "AbortError") {
                    setError(errorMessage(err));
                    setTicketPage(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadTickets();

        return () => controller.abort();
    }, [
        category,
        activeFilters.search,
        activeFilters.status,
        activeFilters.priority,
        activeFilters.created_after,
        activeFilters.created_before,
        activeFilters.page,
        activeFilters.page_size,
    ]);

    function updateFilter(
        field: keyof TicketFilters,
        value: string | number,
    ) {
        setDraftFilters((previous) => ({
            ...previous,
            [category]: {
                ...previous[category],
                [field]: value,
            },
        }));
    }

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setAppliedFilters((previous) => ({
            ...previous,
            [category]: {
                ...draftFilters[category],
                page: 1,
            },
        }));

        setDraftFilters((previous) => ({
            ...previous,
            [category]: {
                ...previous[category],
                page: 1,
            },
        }));
    }

    function clearFilters() {
        setDraftFilters((previous) => ({
            ...previous,
            [category]: { ...emptyFilters },
        }));

        setAppliedFilters((previous) => ({
            ...previous,
            [category]: { ...emptyFilters },
        }));
    }

    function changePage(page: number) {
        setDraftFilters((previous) => ({
            ...previous,
            [category]: {
                ...previous[category],
                page,
            },
        }));

        setAppliedFilters((previous) => ({
            ...previous,
            [category]: {
                ...previous[category],
                page,
            },
        }));
    }

    async function synchronizeTickets() {
        setSyncing(true);
        setError("");
        setSyncMessage("");

        try {
            const result = await api.syncTestingDashboard();

            setSyncMessage(
                `Sync ${result.status}: ${result.total_indexed} tickets indexed across ${result.projects_completed} of ${result.projects_found} projects.`,
            );

            const [summaryResult, syncResult, ticketsResult] =
                await Promise.all([
                    api.testingSummary(),
                    api.testingSyncStatus(),
                    api.testingTickets(category, {
                        ...activeFilters,
                    }),
                ]);

            setSummary(summaryResult);
            setSyncStates(syncResult.projects);
            setTicketPage(ticketsResult);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setSyncing(false);
        }
    }

    const pagination = ticketPage?.pagination;

    return (
        <div className="space-y-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">
                        Testing Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-ink-soft">
                        View and manage Manual and Automation testing tickets.
                    </p>
                </div>

                <button
                    type="button"
                    className="btn-primary"
                    onClick={synchronizeTickets}
                    disabled={syncing}
                >
                    <RefreshCw
                        className={`h-4 w-4 ${syncing ? "animate-spin" : ""
                            }`}
                    />
                    {syncing ? "Syncing..." : "Sync Jira Tickets"}
                </button>
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            {syncMessage && (
                <div
                    role="status"
                    className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                >
                    {syncMessage}
                </div>
            )}

            <section className="grid gap-4 sm:grid-cols-3">
                <SummaryCard
                    title="Total Tickets"
                    value={summary?.total ?? 0}
                    icon={<ClipboardList className="h-5 w-5" />}
                />
                <SummaryCard
                    title="Manual Testing"
                    value={summary?.manual ?? 0}
                    icon={<ListChecks className="h-5 w-5" />}
                />
                <SummaryCard
                    title="Automation Testing"
                    value={summary?.automation ?? 0}
                    icon={<Bot className="h-5 w-5" />}
                />
            </section>

            <section className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-sm">
                <div className="flex flex-wrap gap-2 border-b border-line pb-4">
                    <button
                        type="button"
                        onClick={() => setCategory("manual")}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${category === "manual"
                            ? "bg-plum-900 text-white"
                            : "bg-cream-100 text-ink-soft hover:bg-sand-100"
                            }`}
                    >
                        Manual Testing ({summary?.manual ?? 0})
                    </button>

                    <button
                        type="button"
                        onClick={() => setCategory("automation")}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${category === "automation"
                            ? "bg-plum-900 text-white"
                            : "bg-cream-100 text-ink-soft hover:bg-sand-100"
                            }`}
                    >
                        Automation Testing ({summary?.automation ?? 0})
                    </button>
                </div>

                <form
                    onSubmit={applyFilters}
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                    <input
                        type="search"
                        aria-label="Search tickets"
                        placeholder="Search ticket key or summary"
                        value={filters.search}
                        onChange={(event) =>
                            updateFilter("search", event.target.value)
                        }
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                    />

                    <input
                        type="text"
                        aria-label="Filter by status"
                        placeholder="Status (e.g. To Do)"
                        value={filters.status}
                        onChange={(event) =>
                            updateFilter("status", event.target.value)
                        }
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                    />

                    <input
                        type="text"
                        aria-label="Filter by priority"
                        placeholder="Priority (e.g. High)"
                        value={filters.priority}
                        onChange={(event) =>
                            updateFilter("priority", event.target.value)
                        }
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                    />

                    <div>
                        <label className="mb-1 block text-xs text-ink-soft">
                            Created from
                        </label>
                        <input
                            type="date"
                            value={filters.created_after}
                            onChange={(event) =>
                                updateFilter("created_after", event.target.value)
                            }
                            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs text-ink-soft">
                            Created until
                        </label>
                        <input
                            type="date"
                            value={filters.created_before}
                            onChange={(event) =>
                                updateFilter("created_before", event.target.value)
                            }
                            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                        />
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                        <button type="submit" className="btn-primary">
                            <Search className="h-4 w-4" />
                            Apply Filters
                        </button>

                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={clearFilters}
                        >
                            <FilterX className="h-4 w-4" />
                            Clear
                        </button>
                    </div>
                </form>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="border-b border-line bg-cream-100 text-ink-soft">
                            <tr>
                                <th className="px-3 py-3 font-medium">Ticket</th>
                                <th className="px-3 py-3 font-medium">Summary</th>
                                <th className="px-3 py-3 font-medium">Project</th>
                                <th className="px-3 py-3 font-medium">Status</th>
                                <th className="px-3 py-3 font-medium">Priority</th>
                                <th className="px-3 py-3 font-medium">Assignee</th>
                                <th className="px-3 py-3 font-medium">Created</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-line">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-3 py-10 text-center text-ink-soft"
                                    >
                                        Loading tickets...
                                    </td>
                                </tr>
                            ) : ticketPage?.items.length ? (
                                ticketPage.items.map((ticket: TestingTicket) => (
                                    <tr
                                        key={ticket.jira_issue_id}
                                        className="hover:bg-cream-100/70"
                                    >
                                        <td className="px-3 py-3">
                                            <a
                                                href={ticket.jira_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 font-medium text-plum-800 hover:underline"
                                            >
                                                {ticket.jira_key}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </td>

                                        <td className="max-w-xs px-3 py-3 text-ink">
                                            {ticket.summary || "—"}
                                        </td>

                                        <td className="px-3 py-3">{ticket.project_key}</td>
                                        <td className="px-3 py-3">{ticket.status || "—"}</td>
                                        <td className="px-3 py-3">{ticket.priority || "—"}</td>
                                        <td className="px-3 py-3">
                                            {ticket.assignee_name || "Unassigned"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {formatDate(ticket.jira_created_at)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-3 py-10 text-center text-ink-soft"
                                    >
                                        No {category} tickets found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-soft">
                        {pagination
                            ? `Showing ${ticketPage?.items.length ?? 0} of ${pagination.total} tickets`
                            : "No ticket results"}
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="btn-secondary !px-3"
                            disabled={!pagination?.has_prev || loading}
                            onClick={() => changePage(activeFilters.page - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </button>

                        <span className="text-sm text-ink-soft">
                            Page {pagination?.page ?? 1} of {pagination?.total_pages ?? 0}
                        </span>

                        <button
                            type="button"
                            className="btn-secondary !px-3"
                            disabled={!pagination?.has_next || loading}
                            onClick={() => changePage(activeFilters.page + 1)}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-ink">
                    Project Synchronization Status
                </h2>

                {syncStates.length === 0 ? (
                    <p className="text-sm text-ink-soft">
                        No synchronization information available.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px] text-left text-sm">
                            <thead className="border-b border-line bg-cream-100 text-ink-soft">
                                <tr>
                                    <th className="px-3 py-3 font-medium">Project</th>
                                    <th className="px-3 py-3 font-medium">Status</th>
                                    <th className="px-3 py-3 font-medium">Tickets Indexed</th>
                                    <th className="px-3 py-3 font-medium">Last Completed</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-line">
                                {syncStates.map((item) => (
                                    <tr key={item.project_key}>
                                        <td className="px-3 py-3 font-medium">
                                            {item.project_key}
                                        </td>
                                        <td className="px-3 py-3">{item.status}</td>
                                        <td className="px-3 py-3">{item.total_indexed}</td>
                                        <td className="px-3 py-3">
                                            {formatDate(item.last_completed_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
