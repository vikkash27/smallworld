import type {
  ApiSuccess,
  CircleDetail,
  CircleSummary,
  CreateCircleResponse,
  InvitationResponse,
  InvitationView,
  SearchPreviewResponse,
} from '../../shared/contracts';
import type { CallOptions, CirclesClient } from './client';
import { ApiError, errorFromResponse } from './errors';

const TIMEOUT_MS = 12_000;
const BASE = '/api/platform';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const bad = (what: string): never => {
  throw new ApiError('BAD_RESPONSE', `Unexpected ${what} response`);
};

function guardSummary(d: unknown): CircleSummary {
  if (!isObj(d) || typeof d.id !== 'string' || typeof d.status !== 'string' || typeof d.acceptedCount !== 'number' ||
      typeof d.capacity !== 'number' || typeof d.minimumMembers !== 'number' || !isObj(d.activity)) {
    return bad('circle');
  }
  return d as unknown as CircleSummary;
}

function guardDetail(d: unknown): CircleDetail {
  guardSummary(d);
  const o = d as Obj;
  if (!Array.isArray(o.roster) || !Array.isArray(o.invitations) || !isObj(o.host)) return bad('circle');
  return d as CircleDetail;
}

async function request<T>(method: string, path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    if (timedOut) throw new ApiError('TIMEOUT', 'Request timed out', { retryable: true });
    if (signal?.aborted) throw e;
    throw new ApiError('NETWORK', 'Network error', { retryable: true });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body (proxy error page, empty 204): handled below */
  }
  if (!res.ok) throw errorFromResponse(res.status, json);
  if (!isObj(json) || !('data' in json)) return bad('server');
  return (json as unknown as ApiSuccess<T>).data;
}

const seg = encodeURIComponent;

export function createLiveClient(): CirclesClient {
  return {
    mode: 'live',

    async getSearchPreview(searchId, o?: CallOptions) {
      const d = await request<SearchPreviewResponse>('GET', `/searches/${seg(searchId)}`, undefined, o?.signal);
      if (!isObj(d) || !isObj(d.discovery) || !Array.isArray((d.discovery as Obj).people)) return bad('search');
      return d as unknown as SearchPreviewResponse;
    },

    async createCircle(req, o) {
      const d = await request<CreateCircleResponse>('POST', '/circles', req, o?.signal);
      if (!isObj(d) || !Array.isArray(d.invitationLinks)) return bad('circle');
      guardDetail(d.circle);
      return d as unknown as CreateCircleResponse;
    },

    async listCircles(o) {
      const d = await request<CircleSummary[]>('GET', '/circles', undefined, o?.signal);
      if (!Array.isArray(d)) return bad('circle list');
      d.forEach(guardSummary);
      return d;
    },

    async getCircle(id, o) {
      return guardDetail(await request<CircleDetail>('GET', `/circles/${seg(id)}`, undefined, o?.signal));
    },

    async updateActivity(id, req, o) {
      return guardDetail(await request<CircleDetail>('PATCH', `/circles/${seg(id)}/activity`, req, o?.signal));
    },

    async getInvitation(token, o) {
      const d = await request<InvitationView>('GET', `/invitations/${seg(token)}`, undefined, o?.signal);
      if (!isObj(d) || typeof d.invitationStatus !== 'string') return bad('invitation');
      guardSummary(d.circle);
      return d as unknown as InvitationView;
    },

    async respondToInvitation(token, req, o) {
      const d = await request<InvitationResponse>('POST', `/invitations/${seg(token)}/respond`, req, o?.signal);
      if (!isObj(d) || typeof d.invitationStatus !== 'string' || typeof d.acceptedCount !== 'number') return bad('invitation');
      return d as unknown as InvitationResponse;
    },
  };
}
