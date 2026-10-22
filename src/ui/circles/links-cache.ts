import type { CreateCircleResponse } from '../../shared/contracts';

export type InvitationLink = CreateCircleResponse['invitationLinks'][number];

/**
 * The API returns raw invitation URLs exactly once, at creation. We keep them for this browser tab only
 * (sessionStorage, never localStorage) so the creator can still copy them after the redirect to the circle page.
 * Closing the tab discards them. Always wrapped: storage can be blocked or unavailable.
 */
const key = (circleId: string) => `sw-circle-links:${circleId}`;

export function saveLinks(circleId: string, links: InvitationLink[]): void {
  try {
    sessionStorage.setItem(key(circleId), JSON.stringify(links));
  } catch {
    /* storage unavailable: links stay visible only on the page that created them */
  }
}

export function loadLinks(circleId: string): InvitationLink[] {
  try {
    const raw = sessionStorage.getItem(key(circleId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is InvitationLink =>
        typeof l === 'object' && l !== null &&
        typeof (l as InvitationLink).invitationId === 'string' &&
        typeof (l as InvitationLink).memberId === 'string' &&
        typeof (l as InvitationLink).url === 'string',
    );
  } catch {
    return [];
  }
}
