import type {
  ActivityUpdateRequest,
  BootstrapResponse,
  CircleDetail,
  CircleSummary,
  ContributionRequest,
  ContributionResponse,
  CreateCircleRequest,
  InvitationResponse,
  InvitationResponseRequest,
  InvitationView,
  PlatformPort,
  Viewer,
} from "@/shared/contracts";
import type { InvitationToken } from "../../../convex/platform_model";
import type { Row } from "../../../convex/platform_store";

export interface PlatformService extends PlatformPort {
  getWorkspace(id: string): Promise<Row<"workspaces"> | null>;
  bootstrap(viewer: Viewer): Promise<BootstrapResponse>;
  createCircle(
    viewer: Viewer,
    input: CreateCircleRequest,
    tokens: InvitationToken[],
  ): Promise<CircleDetail>;
  listCircles(viewer: Viewer): Promise<CircleSummary[]>;
  circleDetail(viewer: Viewer, id: string): Promise<CircleDetail>;
  updateActivity(
    viewer: Viewer,
    id: string,
    input: ActivityUpdateRequest,
  ): Promise<CircleDetail>;
  invitationView(hash: string): Promise<InvitationView>;
  respond(
    hash: string,
    input: InvitationResponseRequest,
  ): Promise<InvitationResponse>;
  contribute(
    input: ContributionRequest,
    hash: string,
  ): Promise<ContributionResponse>;
  reset(viewer: Viewer): Promise<{ reset: true }>;
}
