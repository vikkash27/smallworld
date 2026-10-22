import type {
  ActivityUpdateRequest,
  CircleDetail,
  CircleSummary,
  CreateCircleRequest,
  CreateCircleResponse,
  Id,
  InvitationResponse,
  InvitationResponseRequest,
  InvitationView,
  SearchPreviewResponse,
} from '../../shared/contracts';
import { createLiveClient } from './live-client';
import { createMockClient } from './mock-client';

export interface CallOptions {
  signal?: AbortSignal;
}

/** Everything Track D needs from the platform. Mock and live implementations return identical DTOs. */
export interface CirclesClient {
  readonly mode: 'mock' | 'live';
  getSearchPreview(searchId: Id, opts?: CallOptions): Promise<SearchPreviewResponse>;
  createCircle(req: CreateCircleRequest, opts?: CallOptions): Promise<CreateCircleResponse>;
  listCircles(opts?: CallOptions): Promise<CircleSummary[]>;
  getCircle(id: Id, opts?: CallOptions): Promise<CircleDetail>;
  updateActivity(id: Id, req: ActivityUpdateRequest, opts?: CallOptions): Promise<CircleDetail>;
  getInvitation(token: string, opts?: CallOptions): Promise<InvitationView>;
  respondToInvitation(token: string, req: InvitationResponseRequest, opts?: CallOptions): Promise<InvitationResponse>;
}

let singleton: CirclesClient | null = null;

/**
 * NEXT_PUBLIC_DATA_MODE=live selects the real API; anything else (including unset) selects mock.
 * The mode is fixed at build time and never changes at runtime: a failing live call surfaces as an error,
 * it is never quietly answered with mock data.
 */
export function getCirclesClient(): CirclesClient {
  if (!singleton) {
    singleton = process.env.NEXT_PUBLIC_DATA_MODE === 'live' ? createLiveClient() : createMockClient();
  }
  return singleton;
}
