import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPoller } from '../../src/ui/circles/polling';
import type { Visibility } from '../../src/ui/circles/polling';

function fakeVisibility() {
  let visible = true;
  const subs = new Set<() => void>();
  const v: Visibility = {
    isVisible: () => visible,
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
  };
  return { v, set: (x: boolean) => { visible = x; subs.forEach((f) => f()); }, subscribers: () => subs.size };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('poller', () => {
  it('polls every interval and never overlaps requests', async () => {
    const vis = fakeVisibility();
    let active = 0, max = 0, calls = 0;
    const p = createPoller({
      intervalMs: 3000, visibility: vis.v,
      run: async () => { calls++; active++; max = Math.max(max, active); await new Promise((r) => setTimeout(r, 5000)); active--; },
    });
    p.start();
    await vi.advanceTimersByTimeAsync(30000);
    p.stop();
    expect(max).toBe(1);
    expect(calls).toBeGreaterThan(2);
  });

  it('pauses while hidden and refreshes immediately on return', async () => {
    const vis = fakeVisibility();
    let calls = 0;
    const p = createPoller({ intervalMs: 3000, visibility: vis.v, run: async () => { calls++; } });
    p.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toBe(1);
    vis.set(false);
    await vi.advanceTimersByTimeAsync(20000);
    expect(calls).toBe(1);
    vis.set(true);
    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toBe(2);
    p.stop();
  });

  it('stops cleanly: aborts in flight, clears timers, unsubscribes', async () => {
    const vis = fakeVisibility();
    let aborted = false, calls = 0;
    const p = createPoller({
      intervalMs: 3000, visibility: vis.v,
      run: (signal) => new Promise<void>((_, rej) => { calls++; signal.addEventListener('abort', () => { aborted = true; rej(new Error('abort')); }); }),
    });
    p.start();
    await vi.advanceTimersByTimeAsync(10);
    p.stop();
    expect(aborted).toBe(true);
    expect(vis.subscribers()).toBe(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls).toBe(1);
  });

  it('backs off after failures and stops on fatal errors', async () => {
    const vis = fakeVisibility();
    const times: number[] = [];
    const p = createPoller({
      intervalMs: 3000, maxBackoffMs: 12000, visibility: vis.v,
      run: async () => { times.push(Date.now()); throw new Error('boom'); },
    });
    p.start();
    await vi.advanceTimersByTimeAsync(60000);
    p.stop();
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(gaps[0]).toBe(6000);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(12000);

    let calls = 0;
    const q = createPoller({ intervalMs: 3000, visibility: vis.v, run: async () => { calls++; throw new Error('fatal'); }, onError: () => 'stop' });
    q.start();
    await vi.advanceTimersByTimeAsync(30000);
    expect(calls).toBe(1);
  });
});
