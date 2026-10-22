'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from './errors';

export type RequestState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: T };

/** Load once per `key` (null = do not load). Aborts on unmount or key change; `reload` retries. */
export function useRequest<T>(load: (signal: AbortSignal) => Promise<T>, key: string | null) {
  const [state, setState] = useState<RequestState<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (key === null) return;
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    loadRef.current(ctrl.signal).then(
      (data) => {
        if (!ctrl.signal.aborted) setState({ status: 'ready', data });
      },
      (e) => {
        if (!ctrl.signal.aborted) setState({ status: 'error', error: toApiError(e) });
      },
    );
    return () => ctrl.abort();
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setState({ status: 'ready', data }), []);
  return { state, reload, setData };
}
