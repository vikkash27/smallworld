import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "../../../convex/_generated/api";
import type {
  ActivityUpdateRequest,
  ContributionRequest,
  CreateCircleRequest,
  InvitationResponseRequest,
  SaveSearchInput,
  Viewer,
} from "@/shared/contracts";
import type { InvitationToken } from "../../../convex/platform_model";
import type { PlatformService } from "./service";

// Admin auth supports internal references at runtime; the browser-oriented
// client types accept public references only. Preserve argument/return types.
function adminRef<
  T extends "query" | "mutation",
  A extends DefaultFunctionArgs,
  R,
>(
  ref: FunctionReference<T, "internal", A, R>,
): FunctionReference<T, "public", A, R> {
  return ref as unknown as FunctionReference<T, "public", A, R>;
}

export class ConvexPort implements PlatformService {
  private client: ConvexHttpClient;
  constructor(url: string, key: string) {
    this.client = new ConvexHttpClient(url);
    // Convex declares this internal method at runtime but omits it from the
    // browser-facing .d.ts. This client exists only in server modules.
    (
      this.client as ConvexHttpClient & { setAdminAuth(key: string): void }
    ).setAdminAuth(key);
  }
  getWorkspace(id: string) {
    return this.client.query(adminRef(internal.platform_queries.workspace), {
      id,
    });
  }
  bootstrap(viewer: Viewer) {
    return this.client.query(adminRef(internal.platform_queries.bootstrap), {
      viewer,
    });
  }
  getCommunities(viewer: Viewer) {
    return this.client.query(adminRef(internal.platform_queries.communities), {
      viewer,
    });
  }
  getCandidateContexts(viewer: Viewer, communityIds: string[]) {
    return this.client.query(adminRef(internal.platform_queries.contexts), {
      viewer,
      communityIds,
    });
  }
  saveSearch(viewer: Viewer, input: SaveSearchInput) {
    return this.client.mutation(adminRef(internal.platform_mutations.search), {
      viewer,
      input,
    });
  }
  readSearch(viewer: Viewer, id: string, now = Date.now()) {
    return this.client.query(adminRef(internal.platform_queries.search), {
      viewer,
      id,
      now,
    });
  }
  createCircle(
    viewer: Viewer,
    input: CreateCircleRequest,
    tokens: InvitationToken[],
  ) {
    return this.client.mutation(adminRef(internal.platform_mutations.circle), {
      viewer,
      input,
      tokens,
    });
  }
  listCircles(viewer: Viewer) {
    return this.client.query(adminRef(internal.platform_queries.circles), {
      viewer,
    });
  }
  circleDetail(viewer: Viewer, id: string) {
    return this.client.query(adminRef(internal.platform_queries.circle), {
      viewer,
      id,
    });
  }
  updateActivity(viewer: Viewer, id: string, input: ActivityUpdateRequest) {
    return this.client.mutation(
      adminRef(internal.platform_mutations.activity),
      { viewer, id, input },
    );
  }
  invitationView(tokenHash: string, now: number) {
    return this.client.query(adminRef(internal.platform_queries.invitation), {
      tokenHash,
      now,
    });
  }
  respond(tokenHash: string, input: InvitationResponseRequest) {
    return this.client.mutation(adminRef(internal.platform_mutations.respond), {
      tokenHash,
      input,
    });
  }
  contribute(input: ContributionRequest, tokenHash: string) {
    // Raw capability is only used by the API's hasher, never sent to persistence.
    return this.client.mutation(
      adminRef(internal.platform_mutations.contribute),
      { input: { ...input, token: "redacted-capability-token" }, tokenHash },
    );
  }
  reset(viewer: Viewer) {
    return this.client.mutation(adminRef(internal.platform_mutations.reset), {
      viewer,
    });
  }
}
