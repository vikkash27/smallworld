import type { InvitationResponse, InvitationView } from '../../shared/contracts';
import type { CirclesClient } from './client';
import { ApiError } from './errors';
import { SEARCH_PREVIEW_EMPTY, SEARCH_PREVIEW_ROBOTICS } from './fixtures';
import * as server from './mock-server';
import type { MockState } from './mock-server';

const STORAGE_KEY = 'sw-mock-circles-v1';
let memory: MockState | null = null;

/**
 * Mock state lives in localStorage so a circle created in one tab can be joined from another tab of the same
 * browser. If storage is blocked it falls back to memory for this page load.
 */
function load(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockState;
      if (parsed && Array.isArray(parsed.circles) && typeof parsed.seq === 'number') return parsed;
    }
  } catch {
    /* fall through to memory */
  }
  return memory ?? server.emptyState();
}

function save(state: MockState) {
  memory = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* memory only */
  }
}

export function resetMockState() {
  memory = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to reset */
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'mock-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fixed tokens that let every recipient state be seen without creating a circle first. */
const DEMO_VIEW: InvitationView = {
  dataMode: 'sample',
  hostDisplayName: 'Vikkash',
  invitationStatus: 'pending',
  expiresAt: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
  circle: {
    id: 'demo-circle',
    title: 'Robotics Build Circle',
    purpose: 'Help each other validate and build practical warehouse robotics.',
    status: 'forming',
    capacity: 6,
    minimumMembers: 3,
    acceptedCount: 2,
    activity: SEARCH_PREVIEW_ROBOTICS.discovery.circleDraft!.activity,
    activityConfirmed: true,
  },
};
const demoAnswers = new Map<string, InvitationResponse>();

export function createMockClient(delayMs = 250): CirclesClient {
  const run = async <T>(signal: AbortSignal | undefined, fn: (state: MockState) => T): Promise<T> => {
    await sleep(delayMs, signal);
    const state = load();
    const out = fn(state);
    save(state);
    return out;
  };
  const now = () => Date.now();

  return {
    mode: 'mock',

    async getSearchPreview(searchId, o) {
      await sleep(delayMs, o?.signal);
      if (searchId === SEARCH_PREVIEW_ROBOTICS.discovery.searchId) return structuredClone(SEARCH_PREVIEW_ROBOTICS);
      if (searchId === SEARCH_PREVIEW_EMPTY.discovery.searchId) return structuredClone(SEARCH_PREVIEW_EMPTY);
      if (searchId === 'demo-search-expired') throw new ApiError('EXPIRED', 'Search expired', { status: 410 });
      throw new ApiError('NOT_FOUND', 'Search not found', { status: 404 });
    },

    createCircle: (req, o) =>
      run(o?.signal, (s) => {
        const preview = req.searchId === SEARCH_PREVIEW_ROBOTICS.discovery.searchId ? SEARCH_PREVIEW_ROBOTICS : SEARCH_PREVIEW_EMPTY;
        return server.createCircle(s, req, preview, now(), randomToken, window.location.origin);
      }),

    listCircles: (o) => run(o?.signal, (s) => server.listCircles(s, now())),
    getCircle: (id, o) => run(o?.signal, (s) => server.getCircle(s, id, now())),
    updateActivity: (id, req, o) => run(o?.signal, (s) => server.updateActivity(s, id, req.activity, req.confirmed, now())),

    async getInvitation(token, o) {
      if (token === 'demo-ok') {
        await sleep(delayMs, o?.signal);
        const answered = demoAnswers.get(token);
        return answered ? { ...DEMO_VIEW, invitationStatus: answered.invitationStatus } : DEMO_VIEW;
      }
      if (token === 'demo-expired') {
        await sleep(delayMs, o?.signal);
        throw new ApiError('EXPIRED', 'Expired', { status: 410 });
      }
      return run(o?.signal, (s) => server.getInvitation(s, token, now()));
    },

    async respondToInvitation(token, req, o) {
      if (token === 'demo-ok') {
        await sleep(delayMs, o?.signal);
        const prior = demoAnswers.get(token);
        if (prior) return prior;
        const out: InvitationResponse = {
          invitationStatus: req.decision === 'join' ? 'accepted' : 'declined',
          circleId: 'demo-circle',
          acceptedCount: req.decision === 'join' ? 3 : 2,
          circleStatus: req.decision === 'join' ? 'active' : 'forming',
        };
        demoAnswers.set(token, out);
        return out;
      }
      return run(o?.signal, (s) => server.respond(s, token, req, now()));
    },
  };
}
