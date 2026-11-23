
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
    Download,
    ChevronDown,
    FileText,
} from "lucide-react";

import { api, ApiError } from "../services/api";
import { useBookmarks } from "../hooks/useBookmarks";
import { BookmarkButton } from "../components/BookmarkButton";

import type {
    TestingCategory,
    TestingDashboardSummary,
    TestingProjectSyncStatus,
    TestingTicket,
    TestingTicketPage,
} from "../types/api";

// --------------------------------------------------
// Types
// --------------------------------------------------

interface TicketFilters {
    search: string;
    status: string;
    priority: string;
    created_after: string;
    created_before: string;
    page: number;
    page_size: number;
}

type TestingTicketWithReporter = TestingTicket & {
    reporter_name?: string | null;
};

type ReportType = "manual" | "automation" | "all";

interface ReportTicket {
    jira_key: string;
    summary: string;
    jira_created_at: string | null;
    department: string;
}

// --------------------------------------------------
// Constants
// --------------------------------------------------

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

// --------------------------------------------------
// Common helpers
// --------------------------------------------------

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

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[character];
    });
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
                <p className="text-sm font-medium text-ink-soft">
                    {title}
                </p>

                <span className="rounded-lg bg-sand-100 p-2 text-plum-900">
                    {icon}
                </span>
            </div>

            <p className="mt-3 text-3xl font-semibold text-ink">
                {value}
            </p>
        </div>
    );
}

// --------------------------------------------------
// Report generation
// --------------------------------------------------

function createReportHtml(
    tickets: ReportTicket[],
    title: string,
    subtitle: string,
): string {
    const generatedAt = new Date().toLocaleString();

    const manualCount = tickets.filter(
        (ticket) => ticket.department === "Manual Department",
    ).length;

    const automationCount = tickets.filter(
        (ticket) => ticket.department === "Automation Department",
    ).length;

    const tableRows = tickets
        .map((ticket, index) => {
            const departmentClass =
                ticket.department === "Manual Department"
                    ? "manual"
                    : "automation";

            return `
                <tr>
                    <td class="number-cell">${index + 1}</td>

                    <td class="ticket-cell">
                        ${escapeHtml(ticket.jira_key || "—")}
                    </td>

                    <td class="summary-cell">
                        ${escapeHtml(ticket.summary || "No issue summary")}
                    </td>

                    <td class="date-cell">
                        ${escapeHtml(formatDate(ticket.jira_created_at))}
                    </td>

                    <td class="department-cell">
                        <span class="department-badge ${departmentClass}">
                            ${escapeHtml(ticket.department)}
                        </span>
                    </td>
                </tr>
            `;
        })
        .join("");

    const emptyMessage = `
        <tr>
            <td colspan="5" class="empty-cell">
                No tickets found for this report.
            </td>
        </tr>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>${escapeHtml(title)}</title>

    <style>
        @page {
            size: A4 portrait;
            margin: 14mm 12mm 16mm 12mm;

            @bottom-left {
                content: "Testing Dashboard | Confidential";
                font-size: 8px;
                color: #81758a;
            }

            @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 8px;
                color: #81758a;
            }
        }

        * {
            box-sizing: border-box;
        }

        html {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #30213b;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            line-height: 1.5;
        }

        .report-header {
            background: #352044;
            color: #ffffff;
            padding: 22px 24px;
            border-radius: 9px;
            margin-bottom: 17px;
        }

        .brand {
            font-size: 9px;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #edc985;
            margin-bottom: 10px;
        }

        .report-title {
            font-size: 23px;
            font-weight: bold;
            line-height: 1.25;
            margin: 0 0 7px;
            color: #ffffff;
        }

        .report-subtitle {
            font-size: 10px;
            color: #e8dfea;
            margin: 0;
        }

        .generated-date {
            font-size: 9px;
            color: #f0d9a8;
            margin-top: 13px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 9px;
            margin-bottom: 17px;
        }

        .summary-card {
            padding: 12px;
            border: 1px solid #eadfcf;
            border-radius: 7px;
            background: #fff9ed;
        }

        .summary-label {
            font-size: 8px;
            color: #796b82;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            font-weight: bold;
        }

        .summary-value {
            font-size: 20px;
            font-weight: bold;
            margin-top: 5px;
            color: #352044;
        }

        .manual-value {
            color: #7650a3;
        }

        .automation-value {
            color: #bd812d;
        }

        .section-heading {
            font-size: 12px;
            font-weight: bold;
            color: #352044;
            margin: 17px 0 9px;
        }

        .report-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            border: 1px solid #e8dfd3;
        }

        .report-table thead {
            display: table-header-group;
        }

        .report-table th {
            background: #352044;
            color: #ffffff;
            padding: 10px 7px;
            text-align: left;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.35px;
            border: 1px solid #594366;
        }

        .report-table td {
            padding: 9px 7px;
            border: 1px solid #e9e0d6;
            vertical-align: top;
            overflow-wrap: anywhere;
            word-break: normal;
        }

        .report-table tbody tr:nth-child(even) {
            background: #fcf7ee;
        }

        .report-table tbody tr:nth-child(odd) {
            background: #ffffff;
        }

        .report-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .number-cell {
            width: 6%;
            text-align: center;
            color: #81758a;
            font-size: 8px;
        }

        .ticket-cell {
            width: 16%;
            font-weight: bold;
            color: #68448f;
            overflow-wrap: anywhere;
        }

        .summary-cell {
            width: 38%;
            color: #352044;
            line-height: 1.55;
            white-space: normal;
        }

        .date-cell {
            width: 19%;
            color: #62566a;
            font-size: 8px;
        }

        .department-cell {
            width: 21%;
        }

        .department-badge {
            display: inline-block;
            border-radius: 20px;
            padding: 4px 7px;
            font-size: 7px;
            font-weight: bold;
            line-height: 1.4;
        }

        .department-badge.manual {
            background: #eee5fa;
            color: #674394;
        }

        .department-badge.automation {
            background: #fff0d8;
            color: #94601c;
        }

        .empty-cell {
            text-align: center;
            padding: 30px !important;
            color: #81758a;
        }

        .report-footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e8dfd3;
            color: #81758a;
            font-size: 8px;
            text-align: center;
        }

        @media screen {
            body {
                max-width: 210mm;
                margin: 20px auto;
                padding: 15px;
                box-shadow: 0 2px 18px rgba(0,0,0,0.12);
            }
        }

        @media print {
            body {
                width: 100%;
                margin: 0;
                padding: 0;
            }

            .report-header,
            .summary-card,
            .report-table th {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>

<body>
    <header class="report-header">
        <div class="brand">Testing Dashboard | Reports</div>

        <h1 class="report-title">
            ${escapeHtml(title)}
        </h1>

        <p class="report-subtitle">
            ${escapeHtml(subtitle)}
        </p>

        <div class="generated-date">
            Generated on: ${escapeHtml(generatedAt)}
        </div>
    </header>

    <section class="summary-grid">
        <div class="summary-card">
            <div class="summary-label">Total Tickets</div>
            <div class="summary-value">${tickets.length}</div>
        </div>

        <div class="summary-card">
            <div class="summary-label">Manual Tickets</div>
            <div class="summary-value manual-value">${manualCount}</div>
        </div>

        <div class="summary-card">
            <div class="summary-label">Automation Tickets</div>
            <div class="summary-value automation-value">${automationCount}</div>
        </div>
    </section>

    <h2 class="section-heading">Ticket Details</h2>

    <table class="report-table">
        <thead>
            <tr>
                <th style="width:6%">S.No</th>
                <th style="width:16%">Ticket ID</th>
                <th style="width:38%">Issue Summary</th>
                <th style="width:19%">Created</th>
                <th style="width:21%">Department</th>
            </tr>
        </thead>

        <tbody>
            ${tableRows || emptyMessage}
        </tbody>
    </table>

    <footer class="report-footer">
        This report was generated from the Testing Dashboard.
        Ticket information reflects the latest synchronized database records.
    </footer>

    <script>
        window.addEventListener("load", function () {
            setTimeout(function () {
                window.focus();
                window.print();
            }, 500);
        });
    </script>
</body>
</html>
    `;
}

// --------------------------------------------------
// Component
// --------------------------------------------------

export default function TestingDashboardPage() {
    const {
        isBookmarked,
        toggleBookmark,
        pendingIds,
        error: bookmarkError,
    } = useBookmarks();

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
    const [downloading, setDownloading] = useState(false);

    const [error, setError] = useState("");
    const [syncMessage, setSyncMessage] = useState("");
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

    const filters = draftFilters[category];
    const activeFilters = appliedFilters[category];

    // --------------------------------------------------
    // Dashboard data loading
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Ticket loading
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Filter actions
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Fetch every matching ticket for report generation
    // --------------------------------------------------

    async function fetchAllTickets(
        selectedCategory: TestingCategory,
        selectedFilters: TicketFilters,
    ): Promise<TestingTicket[]> {
        const firstPage = await api.testingTickets(
            selectedCategory,
            {
                search: selectedFilters.search,
                status: selectedFilters.status,
                priority: selectedFilters.priority,
                created_after: selectedFilters.created_after,
                created_before: selectedFilters.created_before,
                page: 1,
                page_size: 25,
            },
        );

        const allTickets: TestingTicket[] = [...firstPage.items];

        const totalPages = firstPage.pagination.total_pages;

        for (let page = 2; page <= totalPages; page++) {
            const result = await api.testingTickets(
                selectedCategory,
                {
                    search: selectedFilters.search,
                    status: selectedFilters.status,
                    priority: selectedFilters.priority,
                    created_after: selectedFilters.created_after,
                    created_before: selectedFilters.created_before,
                    page,
                    page_size: 25,
                },
            );

            allTickets.push(...result.items);
        }

        return allTickets;
    }

    // --------------------------------------------------
    // Generate and print A4 PDF report
    // --------------------------------------------------

    async function downloadReport(
        reportType: ReportType,
        useCurrentFilters: boolean,
    ) {
        // Open the window immediately to avoid popup blocking.
        const reportWindow = window.open("", "_blank");

        if (!reportWindow) {
            setError(
                "The report window was blocked. Please allow pop-ups and try again.",
            );
            return;
        }

        setDownloading(true);
        setError("");
        setDownloadMenuOpen(false);

        reportWindow.document.write(`
            <html>
                <head><title>Preparing report...</title></head>
                <body style="font-family:Arial;padding:40px;color:#352044">
                    <h2>Preparing your report...</h2>
                    <p>Please wait while we collect all matching tickets.</p>
                </body>
            </html>
        `);

        try {
            const categories: TestingCategory[] =
                reportType === "all"
                    ? ["manual", "automation"]
                    : [reportType];

            const reportTickets: ReportTicket[] = [];

            for (const selectedCategory of categories) {
                const selectedFilters =
                    useCurrentFilters &&
                        selectedCategory === category
                        ? activeFilters
                        : emptyFilters;

                const tickets = await fetchAllTickets(
                    selectedCategory,
                    selectedFilters,
                );

                const department =
                    selectedCategory === "manual"
                        ? "Manual Department"
                        : "Automation Department";

                for (const ticket of tickets) {
                    reportTickets.push({
                        jira_key: ticket.jira_key,
                        summary: ticket.summary || "",
                        jira_created_at: ticket.jira_created_at,
                        department,
                    });
                }
            }

            const reportTitle =
                reportType === "all"
                    ? "Manual & Automation Tickets Report"
                    : reportType === "manual"
                        ? "Manual Tickets Report"
                        : "Automation Tickets Report";

            const subtitle = useCurrentFilters
                ? `Filtered ${category === "manual" ? "Manual" : "Automation"} Department Report`
                : "Complete Testing Department Report";

            const html = createReportHtml(
                reportTickets,
                reportTitle,
                subtitle,
            );

            reportWindow.document.open();
            reportWindow.document.write(html);
            reportWindow.document.close();
        } catch (err) {
            reportWindow.close();
            setError(
                `Unable to generate report: ${errorMessage(err)}`,
            );
        } finally {
            setDownloading(false);
        }
    }

    // --------------------------------------------------
    // Jira synchronization
    // --------------------------------------------------

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

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <div className="space-y-7">
            {/* Page header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">
                        Testing Dashboard
                    </h1>

                    <p className="mt-1 text-sm text-ink-soft">
                        View and manage Manual and Automation testing tickets.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Main report dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() =>
                                setDownloadMenuOpen((previous) => !previous)
                            }
                            disabled={downloading}
                            aria-expanded={downloadMenuOpen}
                            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-plum-900 shadow-sm transition hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download className="h-4 w-4" />

                            {downloading
                                ? "Preparing..."
                                : "Download Reports"}

                            <ChevronDown
                                className={`h-4 w-4 transition-transform ${downloadMenuOpen ? "rotate-180" : ""
                                    }`}
                            />
                        </button>

                        {downloadMenuOpen && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Close download menu"
                                    className="fixed inset-0 z-10 cursor-default"
                                    onClick={() => setDownloadMenuOpen(false)}
                                />

                                <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
                                    <div className="border-b border-line bg-cream-100 px-4 py-3">
                                        <p className="text-sm font-semibold text-plum-900">
                                            Download Reports
                                        </p>

                                        <p className="mt-1 text-xs text-ink-soft">
                                            Choose the report you want to generate.
                                        </p>
                                    </div>

                                    <div className="p-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                downloadReport("manual", false)
                                            }
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-ink transition hover:bg-cream-100"
                                        >
                                            <span className="rounded-lg bg-purple-100 p-2 text-purple-800">
                                                <FileText className="h-4 w-4" />
                                            </span>

                                            <span>
                                                <span className="block font-semibold">
                                                    Manual Tickets Report
                                                </span>

                                                <span className="mt-1 block text-xs text-ink-soft">
                                                    All manual department tickets
                                                </span>
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                downloadReport("automation", false)
                                            }
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-ink transition hover:bg-cream-100"
                                        >
                                            <span className="rounded-lg bg-amber-100 p-2 text-amber-800">
                                                <FileText className="h-4 w-4" />
                                            </span>

                                            <span>
                                                <span className="block font-semibold">
                                                    Automation Tickets Report
                                                </span>

                                                <span className="mt-1 block text-xs text-ink-soft">
                                                    All automation department tickets
                                                </span>
                                            </span>
                                        </button>

                                        <div className="my-1 border-t border-line" />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                downloadReport("all", false)
                                            }
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-ink transition hover:bg-cream-100"
                                        >
                                            <span className="rounded-lg bg-plum-100 p-2 text-plum-900">
                                                <ClipboardList className="h-4 w-4" />
                                            </span>

                                            <span>
                                                <span className="block font-semibold">
                                                    Manual and Automation Tickets Report
                                                </span>

                                                <span className="mt-1 block text-xs text-ink-soft">
                                                    Combined department report
                                                </span>
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Jira synchronization */}
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
            </div>

            {/* Bookmark error message */}
            {bookmarkError && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                    {bookmarkError}
                </div>
            )}

            {/* Error message */}
            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            {/* Sync message */}
            {syncMessage && (
                <div
                    role="status"
                    className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                >
                    {syncMessage}
                </div>
            )}

            {/* Summary cards */}
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

            {/* Ticket section */}
            <section className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-sm">

                {/* Department tabs */}
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

                {/* Filters */}
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

                        {/* Download currently filtered department report */}
                        <button
                            type="button"
                            onClick={() =>
                                downloadReport(category, true)
                            }
                            disabled={downloading || loading}
                            className="inline-flex items-center gap-2 rounded-lg border border-plum-200 bg-plum-50 px-3 py-2 text-sm font-semibold text-plum-900 transition hover:bg-plum-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download className="h-4 w-4" />

                            {downloading
                                ? "Preparing..."
                                : "Download Filtered"}
                        </button>
                    </div>
                </form>

                {/* Ticket table */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-left text-sm">
                        <thead className="border-b border-line bg-cream-100 text-ink-soft">
                            <tr>
                                <th className="px-3 py-3 font-medium">Ticket</th>
                                <th className="px-3 py-3 font-medium">Summary</th>
                                <th className="px-3 py-3 font-medium">Project</th>
                                <th className="px-3 py-3 font-medium">Status</th>
                                <th className="px-3 py-3 font-medium">Priority</th>
                                <th className="px-3 py-3 font-medium">Assignee</th>
                                <th className="px-3 py-3 font-medium">Created By</th>
                                <th className="px-3 py-3 font-medium">Created</th>
                                <th className="px-3 py-3 text-center font-medium">Bookmark</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-line">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-3 py-10 text-center text-ink-soft"
                                    >
                                        Loading tickets...
                                    </td>
                                </tr>
                            ) : ticketPage?.items.length ? (
                                ticketPage.items.map((ticket: TestingTicket) => {
                                    const ticketWithReporter =
                                        ticket as TestingTicketWithReporter;

                                    return (
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

                                            <td className="px-3 py-3">
                                                {ticket.project_key}
                                            </td>

                                            <td className="px-3 py-3">
                                                {ticket.status || "—"}
                                            </td>

                                            <td className="px-3 py-3">
                                                {ticket.priority || "—"}
                                            </td>

                                            <td className="px-3 py-3">
                                                {ticket.assignee_name || "Unassigned"}
                                            </td>

                                            <td className="px-3 py-3">
                                                {ticketWithReporter.reporter_name || "—"}
                                            </td>

                                            <td className="px-3 py-3">
                                                {formatDate(ticket.jira_created_at)}
                                            </td>

                                            <td className="px-3 py-3 text-center">
                                                <BookmarkButton
                                                    bookmarked={isBookmarked(ticket.jira_issue_id)}
                                                    loading={pendingIds.includes(ticket.jira_issue_id)}
                                                    onClick={() => void toggleBookmark(ticket)}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-3 py-10 text-center text-ink-soft"
                                    >
                                        No {category} tickets found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
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

            {/* Project synchronization status */}
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

                                        <td className="px-3 py-3">
                                            {item.status}
                                        </td>

                                        <td className="px-3 py-3">
                                            {item.total_indexed}
                                        </td>

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
