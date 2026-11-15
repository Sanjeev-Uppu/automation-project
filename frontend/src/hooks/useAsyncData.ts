import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import type { ApiError } from "../services/api";
import { toApiError } from "../utils/errors";

interface State<T> { data: T | null; error: ApiError | null; loading: boolean }

/**
 * Runs `fetcher` whenever `deps` change, cancelling the previous request.
 * - `force` is true when the user pressed Refresh (backend then bypasses its cache).
 * - Previous data stays visible while reloading, but is dropped on error so a failure
 *   is never hidden behind stale numbers.
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal, force: boolean) => Promise<T>,
  deps: unknown[],
) {
  const { refreshNonce, trackLoading } = useApp();
  const seenNonce = useRef(refreshNonce);
  const [retryTick, setRetryTick] = useState(0);
  const forceNext = useRef(false);
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const ctrl = new AbortController();
    const force = seenNonce.current !== refreshNonce || forceNext.current;
    seenNonce.current = refreshNonce;
    forceNext.current = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    trackLoading(1);
    fetcher(ctrl.signal, force)
      .then((data) => { if (!ctrl.signal.aborted) setState({ data, error: null, loading: false }); })
      .catch((e) => {
        if (ctrl.signal.aborted || (e as Error).name === "AbortError") return;
        setState({ data: null, error: toApiError(e), loading: false });
      })
      .finally(() => trackLoading(-1));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshNonce, retryTick]);

  const retry = useCallback(() => { forceNext.current = true; setRetryTick((t) => t + 1); }, []);
  return { ...state, retry };
}
