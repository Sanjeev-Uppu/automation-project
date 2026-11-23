
import { Star } from "lucide-react";

interface BookmarkButtonProps {
    bookmarked: boolean;
    loading?: boolean;
    onClick: () => void;
}

export function BookmarkButton({
    bookmarked,
    loading = false,
    onClick,
}: BookmarkButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            aria-label={
                bookmarked
                    ? "Remove ticket from bookmarks"
                    : "Add ticket to bookmarks"
            }
            aria-pressed={bookmarked}
            title={
                bookmarked
                    ? "Remove bookmark"
                    : "Bookmark ticket"
            }
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${bookmarked
                    ? "text-amber-500 hover:bg-amber-50"
                    : "text-ink-soft hover:bg-cream-100 hover:text-amber-500"
                }`}
        >
            <Star
                className={`h-5 w-5 ${bookmarked ? "fill-current" : ""
                    } ${loading ? "animate-pulse" : ""}`}
            />
        </button>
    );
}
