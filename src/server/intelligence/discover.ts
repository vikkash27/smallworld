import type {
  CandidateContext,
  Community,
  DiscoverRequest,
  DiscoverResponse,
  Evidence,
  PlatformPort,
  Viewer,
} from "../../shared/contracts";
import { draftCircle } from "./circle/draft";
import { ProviderUnavailableError } from "./errors";
import { matchBaseline } from "./match/baseline";
import type { CogneeTransport } from "./memory/cognee";
import { retrieveEvidence } from "./memory/retrieve";
import type { OpenAIRerankClient } from "./validate/openai";
import { MAX_PEOPLE, validateRerank, type AllowedCommunity } from "./validate/rerank";

export class DiscoverInputError extends Error {
  readonly code: "BAD_INPUT" | "FORBIDDEN";
  readonly retryable = false;

  constructor(code: "BAD_INPUT" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "DiscoverInputError";
    this.code = code;
  }
}

const MODES = new Set<DiscoverRequest["mode"]>(["connections", "speaker"]);

export async function discover(args: {
  viewer: Viewer;
  request: DiscoverRequest;
  port: PlatformPort;
  transport: CogneeTransport;
  reranker: OpenAIRerankClient;
  signal: AbortSignal;
  indexed?: Set<string>;
  pause?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<DiscoverResponse> {
  const request = parseRequest(args.request);
  const communityIds = scopedCommunityIds(args.viewer, request.communityIds);

  const [candidates, communities] = await Promise.all([
    args.port.getCandidateContexts(args.viewer, communityIds),
    args.port.getCommunities(args.viewer),
  ]);

  const memory = await retrieveEvidence({
    goal: request.goal,
    communityIds,
    candidates,
    transport: args.transport,
    signal: args.signal,
    indexed: args.indexed,
    pause: args.pause,
  });

  const matched = matchBaseline({
    goal: request.goal,
    mode: request.mode,
    viewer: args.viewer,
    communityIds,
    candidates,
    communities,
    restrictToEvidenceIds: memory.backend === "cognee" ? new Set(memory.evidenceIds) : null,
  });

  const allowedMemberIds = new Set(matched.modelInputMemberIds);
  const validationContext = {
    candidates: candidates.filter((candidate) => allowedMemberIds.has(candidate.member.id)),
    communities: allowedCommunities(communities),
    allowedMemberIds,
  };

  let raw: unknown;
  if (args.reranker.configured) {
    raw = await args.reranker.rerank(
      JSON.stringify(modelPayload(matched.modelInputMemberIds, candidates, communities)),
      args.signal,
    );
  } else {
    raw = {
      people: matched.hits.slice(0, MAX_PEOPLE).map((hit) => ({
        memberId: hit.memberId,
        fitType: hit.fitType,
        reason: hit.reason,
        evidenceIds: hit.evidenceIds,
        caveats: [],
      })),
      communities: matched.communities.map((community) => ({
        communityId: community.communityId,
        reason: community.reason,
      })),
    };
  }

  const validated = validateRerank(raw, validationContext);
  const people = validated.people;
  const circleDraft = draftCircle(request.goal, people);
  const status = people.length === 0 ? "empty" : "ready";
  const result = {
    dataMode: args.viewer.dataMode,
    retrievalBackend: memory.backend,
    status,
    people,
    communities: validated.communities,
    circleDraft,
    message: status === "empty" ? "No grounded people matched this goal." : null,
  } as const;

  const saved = await args.port.saveSearch(args.viewer, {
    goal: request.goal,
    communityIds,
    result,
  });

  return { searchId: saved.id, ...result };
}

function parseRequest(request: DiscoverRequest): DiscoverRequest {
  if (!request || typeof request.goal !== "string" || request.goal.trim().length === 0) {
    throw new DiscoverInputError("BAD_INPUT", "Goal is required.");
  }
  if (!Array.isArray(request.communityIds) || request.communityIds.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new DiscoverInputError("BAD_INPUT", "Community ids must be strings.");
  }
  if (!MODES.has(request.mode)) {
    throw new DiscoverInputError("BAD_INPUT", "Mode must be connections or speaker.");
  }
  return { goal: request.goal.trim(), communityIds: request.communityIds, mode: request.mode };
}

function scopedCommunityIds(viewer: Viewer, requested: readonly string[]): string[] {
  const allowed = new Set(viewer.allowedCommunityIds);
  if (requested.length === 0) return [...viewer.allowedCommunityIds];
  const outside = requested.filter((id) => !allowed.has(id));
  if (outside.length > 0) {
    throw new DiscoverInputError("FORBIDDEN", "A requested community is outside this viewer's scope.");
  }
  return [...requested];
}

function allowedCommunities(communities: readonly Community[]): AllowedCommunity[] {
  return communities.map((community) => ({
    communityId: community.id,
    description: community.description,
    focusTags: community.focusTags,
    sourceUrl: community.metadataSourceUrl,
  }));
}

/** Model input is ids and supplied text only. Names are not sent, so the model cannot merge people by label. */
function modelPayload(
  memberIds: readonly string[],
  candidates: readonly CandidateContext[],
  communities: readonly Community[],
): unknown {
  const allowed = new Set(memberIds);
  return {
    people: candidates
      .filter((candidate) => allowed.has(candidate.member.id))
      .map((candidate) => ({
        memberId: candidate.member.id,
        availability: candidate.currentAvailability,
        evidence: candidate.signals.flatMap((signal) =>
          signal.evidence.map((item) => evidencePayload(item, signal.statement)),
        ),
      })),
    communities: communities
      .filter((community) => community.description !== null || community.focusTags.length > 0)
      .map((community) => ({
        communityId: community.id,
        description: community.description,
        focusTags: community.focusTags,
      })),
  };
}

function evidencePayload(item: Evidence, statement: string): unknown {
  return {
    evidenceId: item.id,
    signalId: item.signalId,
    kind: item.kind,
    summary: item.summary,
    excerpt: item.excerpt,
    statement,
  };
}

export function isProviderUnavailable(error: unknown): error is ProviderUnavailableError {
  return error instanceof ProviderUnavailableError;
}
