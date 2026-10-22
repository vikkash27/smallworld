/** Small World v1 — freeze after bootstrap. C applies agreed changes only. */
export type Id = string;
export type ISODate = string;
export type DataMode = 'sample' | 'live';
export type CommunityStatus = 'listed' | 'participating' | 'connected';
export type SignalKind = 'building' | 'seeking' | 'offering' | 'stated_experience' | 'interest' | 'availability';
export type SignalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type CircleStatus = 'draft' | 'forming' | 'active' | 'archived';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
export type FitType = 'experience' | 'complementary_need' | 'collaborator' | 'peer' | 'speaker';
export type ErrorCode = 'BAD_INPUT' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'EXPIRED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE';
export interface ApiSuccess<T> { data: T; requestId: string }
export interface ApiFailure { error: { code: ErrorCode; message: string; retryable: boolean }; requestId: string }
/** Obtained only from the server guard. Never accept a viewer supplied by a client. */
export interface Viewer { id: Id; workspaceId: Id; role: 'organizer'; allowedCommunityIds: Id[]; dataMode: DataMode }
export interface Community {
  id: Id; name: string; description: string | null; focusTags: string[];
  publicUrl: string; metadataSourceUrl: string; metadataVerifiedAt: ISODate;
  status: CommunityStatus;
}
export interface MemberSummary { id: Id; displayName: string; initials: string; communityIds: Id[] }
/** Already authorised for the current viewer. Public invitations must never include this DTO. */
export interface Evidence {
  id: Id; signalId: Id; kind: SignalKind; summary: string;
  excerpt: string | null; sourceLabel: string; occurredAt: ISODate | null;
  sourceUrl: string | null; evidenceClass: 'explicit' | 'inferred';
}
export interface PersonRecommendation {
  member: MemberSummary; fitType: FitType; reason: string;
  evidence: Evidence[]; caveats: string[];
  availability: 'stated_available' | 'unknown';
}
export interface CommunityFit { communityId: Id; reason: string; sourceUrl: string }
export interface Activity {
  title: string; description: string;
  proposedStartsAt: ISODate | null; timezone: 'Europe/London';
  location: string | null;
}
export interface CircleDraft {
  title: string; purpose: string; activity: Activity;
  proposedMemberIds: Id[]; capacity: number; minimumMembers: number;
}
export interface DiscoverRequest { goal: string; communityIds: Id[]; mode: 'connections' | 'speaker' }
export interface DiscoverResponse {
  searchId: Id; dataMode: DataMode; retrievalBackend: 'cognee' | 'local'; status: 'ready' | 'empty';
  people: PersonRecommendation[]; communities: CommunityFit[];
  circleDraft: CircleDraft | null; message: string | null;
}
export interface BootstrapResponse {
  viewer: { displayName: string; initials: string };
  dataMode: DataMode; allowedCommunityIds: Id[]; communities: Community[];
}
export interface SearchPreviewResponse { goal: string; discovery: DiscoverResponse }
export interface CreateCircleRequest {
  searchId: Id; selectedMemberIds: Id[];
  title: string; purpose: string; activity: Activity;
  capacity: number; minimumMembers: number;
}
/** Only the creator sees pending names and token links. */
export interface InvitationSummary { id: Id; member: MemberSummary; status: InvitationStatus; expiresAt: ISODate }
export interface RosterMember { id: Id; displayName: string | null; initials: string | null; role: 'host' | 'member'; showOnRoster: boolean }
export interface CircleSummary {
  id: Id; title: string; purpose: string; status: CircleStatus;
  capacity: number; minimumMembers: number;
  acceptedCount: number; activity: Activity; activityConfirmed: boolean;
}
export interface CircleDetail extends CircleSummary {
  host: MemberSummary; communityIds: Id[];
  roster: RosterMember[]; invitations: InvitationSummary[];
}
export interface CreateCircleResponse {
  circle: CircleDetail;
  /** Creation-only response. Do not persist raw tokens in logs or list responses. */
  invitationLinks: { invitationId: Id; memberId: Id; url: string }[];
}
export interface InvitationView {
  dataMode: DataMode;
  circle: CircleSummary;
  hostDisplayName: string;
  /** Names of other invitees and private evidence deliberately omitted. */
  invitationStatus: InvitationStatus; expiresAt: ISODate;
}
export interface InvitationResponseRequest { decision: 'join' | 'decline'; showOnRoster: boolean }
export interface InvitationResponse {
  invitationStatus: 'accepted' | 'declined'; circleId: Id;
  acceptedCount: number; circleStatus: CircleStatus;
}
export interface ActivityUpdateRequest { activity: Activity; confirmed: boolean }
export interface ContributionRequest {
  token: string; displayName: string;
  building: string; offering: string; seeking: string;
  availability: string | null;
  permittedCommunityIds: Id[];
  consentToDiscovery: boolean;
}
export interface ContributionResponse { id: Id; status: 'pending' }
/** Server-only context record; Platform C permission-filters before supplying B. */
export interface ApprovedSignal {
  id: Id; kind: SignalKind; topic: string; statement: string;
  evidence: Evidence[]; validUntil: ISODate | null;
}
export interface CandidateContext {
  member: MemberSummary;
  signals: ApprovedSignal[];
  currentAvailability: 'stated_available' | 'unknown' | 'unavailable';
}
export interface SavedSearch {
  id: Id; viewerId: Id; workspaceId: Id; expiresAt: ISODate;
  goal: string; communityIds: Id[];
  result: Omit<DiscoverResponse, 'searchId'>;
}
export interface SaveSearchInput {
  goal: string; communityIds: Id[]; result: Omit<DiscoverResponse, 'searchId'>;
}
/** B depends on this interface, not Supabase. C owns its implementation. */
export interface PlatformPort {
  getCandidateContexts(viewer: Viewer, communityIds: Id[]): Promise<CandidateContext[]>;
  getCommunities(viewer: Viewer): Promise<Community[]>;
  saveSearch(viewer: Viewer, input: SaveSearchInput): Promise<SavedSearch>;
  readSearch(viewer: Viewer, searchId: Id): Promise<SavedSearch | null>;
}
/** Expected exports from src/server/platform/public.ts:
 * requireOrganizer(request: Request): Promise<Viewer>
 * getPlatformPort(): PlatformPort
 * Throw a typed auth error mapped to the shared envelope; never return a dummy viewer in live mode.
 */
