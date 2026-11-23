
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Download,
    ExternalLink,
    FileText,
    Search,
    X,
    RefreshCw,
    ClipboardList,
} from "lucide-react";

import { api, ApiError } from "../services/api";
import type { TestingTicket, TestingTicketPage } from "../types/api";
import { useBookmarks } from "../hooks/useBookmarks";
import { BookmarkButton } from "../components/BookmarkButton";

type ManualTicket = TestingTicket & {
    reporter_name?: string | null;
};

const PAGE_SIZE = 100;

function getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong. Please try again.";
}

function formatDate(value: string | null | undefined): string {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function escapeHtml(value: string | null | undefined): string {
    return (value ?? "—").replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };

        return entities[character];
    });
}

export default function ManualScriptsPage() {
    const navigate = useNavigate();
    const {
        isBookmarked,
        toggleBookmark,
        pendingIds,
        error: bookmarkError,
    } = useBookmarks();

    const [tickets, setTickets] = useState<ManualTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    // Load every page of Manual tickets from the existing API.
    const loadTickets = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError("");

        try {
            const firstPage: TestingTicketPage = await api.testingTickets(
                "manual",
                {
                    page: 1,
                    page_size: PAGE_SIZE,
                },
                signal,
            );

            const allTickets: ManualTicket[] = [
                ...(firstPage.items as ManualTicket[]),
            ];

            const totalPages = firstPage.pagination.total_pages;

            // Fetch the remaining pages so this page contains all Manual tickets.
            for (let page = 2; page <= totalPages; page += 1) {
                if (signal?.aborted) {
                    return;
                }

                const result = await api.testingTickets(
                    "manual",
                    {
                        page,
                        page_size: PAGE_SIZE,
                    },
                    signal,
                );

                allTickets.push(...(result.items as ManualTicket[]));
            }

            if (!signal?.aborted) {
                setTickets(allTickets);
            }
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                setError(getErrorMessage(err));
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        loadTickets(controller.signal);

        return () => {
            controller.abort();
        };
    }, [loadTickets]);

    // Search by ticket ID, summary, or reporter.
    const filteredTickets = useMemo(() => {
        const searchTerm = search.trim().toLowerCase();

        if (!searchTerm) {
            return tickets;
        }

        return tickets.filter((ticket) => {
            return (
                ticket.jira_key?.toLowerCase().includes(searchTerm) ||
                ticket.summary?.toLowerCase().includes(searchTerm) ||
                ticket.reporter_name?.toLowerCase().includes(searchTerm)
            );
        });
    }, [tickets, search]);

    // Close removes the ticket from this page only.
    function closeTicket(ticketId: string) {
        setTickets((previous) =>
            previous.filter(
                (ticket) => ticket.jira_issue_id !== ticketId,
            ),
        );
    }

    // Download all currently loaded, non-closed Manual tickets as a printable PDF.
    async function downloadReport() {
        if (tickets.length === 0) {
            return;
        }

        setDownloading(true);

        try {
            const rows = tickets
                .map(
                    (ticket, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHtml(ticket.jira_key)}</td>
                            <td>${escapeHtml(ticket.summary)}</td>
                            <td>${escapeHtml(formatDate(ticket.jira_created_at))}</td>
                            <td>${escapeHtml(ticket.reporter_name)}</td>
                        </tr>
                    `,
                )
                .join("");

            const reportHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8" />
                    <title>Manual Scripts Report</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 14mm;
                        }

                        * {
                            box-sizing: border-box;
                        }

                        body {
                            margin: 0;
                            color: #25212b;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 11px;
                        }

                        .header {
                            margin-bottom: 22px;
                            padding-bottom: 14px;
                            border-bottom: 2px solid #402344;
                        }

                        h1 {
                            margin: 0 0 6px;
                            color: #402344;
                            font-size: 23px;
                        }

                        .subtitle {
                            color: #77717d;
                            font-size: 11px;
                        }

                        .count {
                            margin: 14px 0;
                            font-weight: bold;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                        }

                        th {
                            padding: 10px 8px;
                            background: #402344;
                            color: #ffffff;
                            text-align: left;
                        }

                        td {
                            padding: 9px 8px;
                            border-bottom: 1px solid #e5e0e8;
                            vertical-align: top;
                            overflow-wrap: anywhere;
                        }

                        tr {
                            page-break-inside: avoid;
                        }

                        tbody tr:nth-child(even) {
                            background: #faf8fb;
                        }

                        .footer {
                            margin-top: 20px;
                            color: #77717d;
                            font-size: 9px;
                            text-align: right;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Manual Scripts Report</h1>
                        <div class="subtitle">
                            Manual testing ticket cases
                        </div>
                    </div>

                    <div class="count">
                        Total Manual Tickets: ${tickets.length}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Ticket ID</th>
                                <th>Issue Summary</th>
                                <th>Created</th>
                                <th>Created By</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>

                    <div class="footer">
                        Generated on ${escapeHtml(new Date().toLocaleString())}
                    </div>

                    <script>
                        window.onload = function () {
                            window.print();
                        };
                    </script>
                </body>
                </html>
            `;

            const reportWindow = window.open("", "_blank");

            if (!reportWindow) {
                throw new Error(
                    "The report window was blocked. Please allow pop-ups and try again.",
                );
            }

            reportWindow.document.open();
            reportWindow.document.write(reportHtml);
            reportWindow.document.close();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDownloading(false);
        }
    }

    return (
        <div className="space-y-7">
            {/* Page header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        aria-label="Back to overview"
                        className="mt-1 rounded-lg border border-line p-2 text-ink-soft transition hover:bg-cream-100 hover:text-plum-900"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>

                    <div>
                        <h1 className="text-2xl font-semibold text-ink">
                            Manual Scripts
                        </h1>

                        <p className="mt-1 text-sm text-ink-soft">
                            View and manage summaries of all Manual testing tickets.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => loadTickets()}
                        disabled={loading}
                        className="btn-secondary"
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${loading ? "animate-spin" : ""
                                }`}
                        />
                        Refresh
                    </button>

                    <button
                        type="button"
                        onClick={downloadReport}
                        disabled={downloading || tickets.length === 0}
                        className="btn-primary"
                    >
                        <Download className="h-4 w-4" />
                        {downloading ? "Preparing..." : "Download PDF"}
                    </button>
                </div>
            </div>

            {/* Summary */}
            <section className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink-soft">
                            Total Manual Tickets
                        </p>
                        <span className="rounded-lg bg-sand-100 p-2 text-plum-900">
                            <ClipboardList className="h-5 w-5" />
                        </span>
                    </div>

                    <p className="mt-3 text-3xl font-semibold text-ink">
                        {tickets.length}
                    </p>
                </div>

                <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink-soft">
                            Search Results
                        </p>
                        <span className="rounded-lg bg-sand-100 p-2 text-plum-900">
                            <Search className="h-5 w-5" />
                        </span>
                    </div>

                    <p className="mt-3 text-3xl font-semibold text-ink">
                        {filteredTickets.length}
                    </p>
                </div>
            </section>

            {/* Search */}
            <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />

                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by ticket ID, summary, or Created By..."
                        aria-label="Search Manual tickets"
                        className="w-full rounded-lg border border-line bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-plum-700 focus:ring-2 focus:ring-plum-100"
                    />
                </div>
            </section>

            {/* Bookmark error */}
            {bookmarkError && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                    {bookmarkError}
                </div>
            )}

            {/* Error */}
            {error && (
                <div
                    role="alert"
                    className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={() => setError("")}
                        aria-label="Dismiss error"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Ticket list */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-ink">
                        Manual Ticket Summaries
                    </h2>

                    <span className="rounded-full bg-sand-100 px-3 py-1 text-xs font-semibold text-plum-900">
                        {filteredTickets.length} tickets
                    </span>
                </div>

                {loading ? (
                    <div
                        role="status"
                        className="rounded-xl border border-line bg-white p-12 text-center text-sm text-ink-soft"
                    >
                        <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-plum-900" />
                        Loading Manual tickets...
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="rounded-xl border border-line bg-white p-12 text-center">
                        <FileText className="mx-auto h-9 w-9 text-ink-soft" />

                        <h3 className="mt-3 font-semibold text-ink">
                            No Manual tickets found
                        </h3>

                        <p className="mt-1 text-sm text-ink-soft">
                            {search
                                ? "Try changing your search."
                                : "There are currently no Manual tickets available."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredTickets.map((ticket) => (
                            <article
                                key={ticket.jira_issue_id}
                                className="rounded-xl border border-line bg-white p-5 shadow-sm transition hover:shadow-md"
                            >
                                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <a
                                                href={ticket.jira_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 rounded-lg bg-plum-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-plum-800"
                                            >
                                                {ticket.jira_key}
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>

                                            <span className="text-xs text-ink-soft">
                                                Created: {formatDate(ticket.jira_created_at)}
                                            </span>
                                        </div>

                                        <h3 className="mt-4 break-words text-base font-semibold leading-6 text-ink">
                                            {ticket.summary || "No summary available"}
                                        </h3>

                                        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                            <span className="text-ink-soft">
                                                Created By:
                                            </span>

                                            <span className="font-medium text-ink">
                                                {ticket.reporter_name || "—"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2 lg:pt-1">
                                        <BookmarkButton
                                            bookmarked={isBookmarked(ticket.jira_issue_id)}
                                            loading={pendingIds.includes(ticket.jira_issue_id)}
                                            onClick={() => void toggleBookmark(ticket)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                closeTicket(ticket.jira_issue_id)
                                            }
                                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                                            title="Remove this ticket from this page"
                                        >
                                            <X className="h-4 w-4" />
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
