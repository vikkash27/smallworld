import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/ui/circles/errors';
import { createLiveClient } from '../../src/ui/circles/live-client';

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) =>
  vi.stubGlobal('fetch', vi.fn((u: string, i: RequestInit) => impl(u, i)));

afterEach(() => vi.unstubAllGlobals());

async function failure(p: Promise<unknown>): Promise<ApiError> {
  try { await p; } catch (e) { return e as ApiError; }
  throw new Error('expected failure');
}

describe('live client', () => {
  it('maps the shared error envelope', async () => {
    stubFetch(() => json(410, { error: { code: 'EXPIRED', message: 'gone', retryable: false }, requestId: 'r1' }));
    const e = await failure(createLiveClient().getInvitation('abc'));
    expect(e.code).toBe('EXPIRED');
    expect(e.requestId).toBe('r1');
    expect(e.status).toBe(410);
  });

  it('falls back to the HTTP status when the body is not an envelope (proxy error page)', async () => {
    stubFetch(() => Promise.resolve(new Response('<html>Bad gateway</html>', { status: 503 })));
    expect((await failure(createLiveClient().listCircles())).code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('reports a network failure as NETWORK, not a crash', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));
    expect((await failure(createLiveClient().listCircles())).code).toBe('NETWORK');
  });

  it('rejects a 200 whose shape the UI cannot use instead of rendering garbage', async () => {
    stubFetch(() => json(200, { data: { id: 'c1' }, requestId: 'r' }));
    expect((await failure(createLiveClient().getCircle('c1'))).code).toBe('BAD_RESPONSE');
  });

  it('encodes path segments and sends JSON with same-origin credentials', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    stubFetch((url, init) => { calls.push({ url, init }); return json(200, { data: { invitationStatus: 'accepted', circleId: 'c', acceptedCount: 2, circleStatus: 'forming' }, requestId: 'r' }); });
    await createLiveClient().respondToInvitation('a/b c', { decision: 'join', showOnRoster: false });
    expect(calls[0].url).toBe('/api/platform/invitations/a%2Fb%20c/respond');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.credentials).toBe('same-origin');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ decision: 'join', showOnRoster: false });
  });

  it('never silently substitutes mock data when live fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('offline')));
    await expect(createLiveClient().getSearchPreview('demo-search-robotics')).rejects.toBeInstanceOf(ApiError);
  });
});
