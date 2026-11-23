
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../services/api";
import type { TestingTicket } from "../types/api";

interface UseBookmarksResult {
    bookmarks: TestingTicket[];
    loading: boolean;
    error: string;
    pendingIds: string[];
    isBookmarked: (jiraIssueId: string) => boolean;
    toggleBookmark: (ticket: TestingTicket) => Promise<void>;
    removeBookmark: (jiraIssueId: string) => Promise<void>;
    reload: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong. Please try again.";
}

export function useBookmarks(): UseBookmarksResult {
    const [bookmarks, setBookmarks] = useState<TestingTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pendingIds, setPendingIds] = useState<string[]>([]);

    const loadBookmarks = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError("");

        try {
            const response = await api.bookmarks(signal);

            if (!signal?.aborted) {
                setBookmarks(response.items ?? []);
            }
        } catch (err) {
            if ((err as Error).name !== "AbortError" && !signal?.aborted) {
                setError(getErrorMessage(err));
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, []);

    const reload = useCallback(async () => {
        await loadBookmarks();
    }, [loadBookmarks]);

    useEffect(() => {
        const controller = new AbortController();

        void loadBookmarks(controller.signal);

        return () => {
            controller.abort();
        };
    }, [loadBookmarks]);

    const isBookmarked = useCallback(
        (jiraIssueId: string) =>
            bookmarks.some(
                (ticket) => ticket.jira_issue_id === jiraIssueId,
            ),
        [bookmarks],
    );

    const toggleBookmark = useCallback(
        async (ticket: TestingTicket) => {
            const jiraIssueId = ticket.jira_issue_id;

            if (!jiraIssueId || pendingIds.includes(jiraIssueId)) {
                return;
            }

            setPendingIds((previous) => [...previous, jiraIssueId]);
            setError("");

            const alreadyBookmarked = bookmarks.some(
                (item) => item.jira_issue_id === jiraIssueId,
            );

            try {
                if (alreadyBookmarked) {
                    await api.removeBookmark(jiraIssueId);

                    setBookmarks((previous) =>
                        previous.filter(
                            (item) => item.jira_issue_id !== jiraIssueId,
                        ),
                    );
                } else {
                    await api.addBookmark(jiraIssueId);

                    setBookmarks((previous) => {
                        const alreadyExists = previous.some(
                            (item) => item.jira_issue_id === jiraIssueId,
                        );

                        return alreadyExists
                            ? previous
                            : [...previous, ticket];
                    });
                }
            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setPendingIds((previous) =>
                    previous.filter((id) => id !== jiraIssueId),
                );
            }
        },
        [bookmarks, pendingIds],
    );

    const removeBookmark = useCallback(
        async (jiraIssueId: string) => {
            if (!jiraIssueId || pendingIds.includes(jiraIssueId)) {
                return;
            }

            setPendingIds((previous) => [...previous, jiraIssueId]);
            setError("");

            try {
                await api.removeBookmark(jiraIssueId);

                setBookmarks((previous) =>
                    previous.filter(
                        (ticket) => ticket.jira_issue_id !== jiraIssueId,
                    ),
                );
            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setPendingIds((previous) =>
                    previous.filter((id) => id !== jiraIssueId),
                );
            }
        },
        [pendingIds],
    );

    return {
        bookmarks,
        loading,
        error,
        pendingIds,
        isBookmarked,
        toggleBookmark,
        removeBookmark,
        reload,
    };
}
