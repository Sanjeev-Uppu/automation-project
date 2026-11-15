import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ApiError } from "../services/api";
import { errorTitle } from "../utils/errors";

export function ErrorState({ error, onRetry, compact = false }: { error: ApiError | { code: string; message: string; hint?: string | null }; onRetry?: () => void; compact?: boolean }) {
  const api = error as ApiError;
  const title = errorTitle(api);
  return (
    <div role="alert" className={`card flex gap-4 border-plum-200 bg-plum-50 ${compact ? "p-4" : "p-6"}`}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-plum-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-semibold text-plum-800">{title}</h3>
        <p className="mt-1 text-sm text-ink">{error.message}</p>
        {error.hint && <p className="mt-2 text-sm text-ink-soft">{error.hint}</p>}
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-secondary mt-4">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
