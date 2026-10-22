export interface Visibility {
  isVisible(): boolean;
  subscribe(onChange: () => void): () => void;
}

export interface PollerOptions {
  intervalMs: number;
  maxBackoffMs?: number;
  run: (signal: AbortSignal) => Promise<void>;
  /** Return 'stop' for errors that retrying cannot fix (401/403/404). Default: retry with backoff. */
  onError?: (error: unknown) => 'retry' | 'stop';
  visibility: Visibility;
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
}

export interface Poller {
  start(): void;
  stop(): void;
}

export const documentVisibility: Visibility = {
  isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  subscribe: (cb) => {
    document.addEventListener('visibilitychange', cb);
    return () => document.removeEventListener('visibilitychange', cb);
  },
};

/**
 * Sequential poller: the next request is scheduled only after the previous one settles, so requests
 * never overlap. Pauses while the tab is hidden, refreshes immediately on return, backs off on failure,
 * and aborts any in-flight request when stopped.
 */
export function createPoller(o: PollerOptions): Poller {
  const timers = o.timers ?? {
    set: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clear: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
  const maxBackoff = o.maxBackoffMs ?? 15000;
  let stopped = true;
  let timer: unknown = null;
  let inFlight: AbortController | null = null;
  let failures = 0;
  let unsubscribe: (() => void) | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      timers.clear(timer);
      timer = null;
    }
  };

  const delay = () => (failures === 0 ? o.intervalMs : Math.min(o.intervalMs * 2 ** failures, maxBackoff));

  const schedule = () => {
    clearTimer();
    if (stopped || !o.visibility.isVisible()) return;
    timer = timers.set(() => void tick(), delay());
  };

  const tick = async () => {
    timer = null;
    if (stopped || inFlight || !o.visibility.isVisible()) return;
    const ctrl = new AbortController();
    inFlight = ctrl;
    try {
      await o.run(ctrl.signal);
      failures = 0;
    } catch (e) {
      if (ctrl.signal.aborted) return;
      failures += 1;
      if (o.onError?.(e) === 'stop') {
        stop();
        return;
      }
    } finally {
      if (inFlight === ctrl) inFlight = null;
    }
    schedule();
  };

  const onVisibility = () => {
    if (stopped) return;
    clearTimer();
    if (o.visibility.isVisible() && !inFlight) void tick();
  };

  function stop() {
    stopped = true;
    clearTimer();
    inFlight?.abort();
    inFlight = null;
    unsubscribe?.();
    unsubscribe = null;
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      failures = 0;
      unsubscribe = o.visibility.subscribe(onVisibility);
      if (o.visibility.isVisible()) void tick();
    },
    stop,
  };
}
