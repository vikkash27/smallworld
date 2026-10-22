import { describe, expect, it, vi } from "vitest";
import type { PlatformPort } from "../../src/shared/contracts";
import {
  ROBOTICS_GOAL,
  amara,
  documentedWarehouseCommunity,
  injectionOnly,
  nameOnlyRoboticsClub,
  privateOtherCommunity,
  roboticsCandidates,
  sampleViewer,
  unavailableRobotics,
  unrelatedCommunity,
} from "../../src/server/intelligence/fixtures";
import { discover } from "../../src/server/intelligence/discover";
import { ProviderUnavailableError } from "../../src/server/intelligence/errors";
import { handleDiscover } from "../../src/server/intelligence/http";
import type { CogneeTransport } from "../../src/server/intelligence/memory/cognee";
import { createMemoryPlatformPort } from "../../src/server/intelligence/testing/memory-port";
import type { OpenAIRerankClient } from "../../src/server/intelligence/validate/openai";

const signal = () => new AbortController().signal;

const localTransport: CogneeTransport = {
  configured: false,
  remember: async () => ({ ok: false, status: 0, retryable: false }),
  recall: async () => ({ ok: false, status: 0, retryable: false }),
};

const unconfiguredReranker: OpenAIRerankClient = {
  configured: false,
  async rerank() {
    throw new Error("rerank should not be called");
  },
};

function portWith(candidates = roboticsCandidates) {
  return createMemoryPlatformPort({
    candidates,
    communities: [documentedWarehouseCommunity, nameOnlyRoboticsClub, unrelatedCommunity],
  });
}

describe("discover", () => {
  it("returns the grounded robotics people, a concrete circle, and saves the snapshot", async () => {
    const port = portWith();
    const result = await discover({
      viewer: sampleViewer,
      request: { goal: ROBOTICS_GOAL, communityIds: ["unicorn-mafia", "kickstart-global"], mode: "connections" },
      port,
      transport: localTransport,
      reranker: unconfiguredReranker,
      signal: signal(),
    });

    expect(result.searchId).toBe("search-1");
    expect(result.retrievalBackend).toBe("local");
    expect(result.status).toBe("ready");
    expect(result.people.map((person) => person.member.id)).toEqual(["demo-amara", "demo-leo", "demo-nina"]);
    expect(result.people.every((person) => person.availability === "unknown")).toBe(true);
    expect(result.people.every((person) => person.caveats.includes("Current availability needs confirmation."))).toBe(true);
    expect(result.communities.map((community) => community.communityId)).toEqual(["documented-warehouse"]);
    expect(result.circleDraft?.proposedMemberIds).toEqual(["demo-amara", "demo-leo", "demo-nina"]);
    expect(result.circleDraft?.capacity).toBe(6);
    expect(result.circleDraft?.activity.proposedStartsAt).toBeNull();
    expect(result.circleDraft?.purpose).not.toMatch(/agreed to join|will join|confirmed members/i);
    expect(port.saved).toHaveLength(1);
    expect(port.saved[0]?.result.people).toHaveLength(3);
  });

  it("does not send private or unavailable people to the model", async () => {
    let payload = "";
    const reranker: OpenAIRerankClient = {
      configured: true,
      async rerank(userPayload) {
        payload = userPayload;
        return {
          people: [
            {
              memberId: "demo-amara",
              fitType: "experience",
              reason: "Spent two years deploying robots in fulfilment centres.",
              evidenceIds: ["demo-evidence-amara"],
              caveats: [],
            },
            {
              memberId: "demo-private",
              fitType: "experience",
              reason: "Deploys warehouse robotics every week.",
              evidenceIds: ["demo-evidence-private"],
              caveats: [],
            },
          ],
          communities: [],
        };
      },
    };

    const result = await discover({
      viewer: sampleViewer,
      request: { goal: ROBOTICS_GOAL, communityIds: ["unicorn-mafia", "kickstart-global"], mode: "connections" },
      port: portWith([amara, privateOtherCommunity, unavailableRobotics, injectionOnly]),
      transport: localTransport,
      reranker,
      signal: signal(),
    });

    expect(payload).not.toContain("demo-private");
    expect(payload).not.toContain("demo-unavailable");
    expect(payload).not.toContain("Ignore previous instructions");
    expect(result.people.map((person) => person.member.id)).toEqual(["demo-amara"]);
    expect(result.circleDraft?.proposedMemberIds).toEqual(["demo-amara"]);
  });

  it("does not save a search when the model provider fails", async () => {
    const port = portWith();
    const reranker: OpenAIRerankClient = {
      configured: true,
      async rerank() {
        throw new ProviderUnavailableError("OpenAI responded with status 429", true);
      },
    };
    await expect(
      discover({
        viewer: sampleViewer,
        request: { goal: ROBOTICS_GOAL, communityIds: ["unicorn-mafia"], mode: "connections" },
        port,
        transport: localTransport,
        reranker,
        signal: signal(),
      }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(port.saved).toHaveLength(0);
  });

  it("saves an empty result when nothing grounds the goal", async () => {
    const port = portWith();
    const result = await discover({
      viewer: sampleViewer,
      request: { goal: "sourdough starter maintenance", communityIds: ["unicorn-mafia"], mode: "connections" },
      port,
      transport: localTransport,
      reranker: unconfiguredReranker,
      signal: signal(),
    });
    expect(result.status).toBe("empty");
    expect(result.people).toEqual([]);
    expect(result.circleDraft).toBeNull();
    expect(result.message).toBe("No grounded people matched this goal.");
    expect(port.saved).toHaveLength(1);
  });

  it("rejects a community outside the viewer before reading candidates", async () => {
    const getCandidateContexts = vi.fn<PlatformPort["getCandidateContexts"]>();
    const port: PlatformPort = {
      getCandidateContexts,
      async getCommunities() {
        return [];
      },
      async saveSearch() {
        throw new Error("should not save");
      },
      async readSearch() {
        return null;
      },
    };
    await expect(
      discover({
        viewer: sampleViewer,
        request: { goal: ROBOTICS_GOAL, communityIds: ["night-office"], mode: "connections" },
        port,
        transport: localTransport,
        reranker: unconfiguredReranker,
        signal: signal(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getCandidateContexts).not.toHaveBeenCalled();
  });
});

describe("discover route handler", () => {
  it("returns the shared success envelope without calling a provider", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const port = portWith();
    const response = await handleDiscover(
      new Request("http://localhost/api/intelligence/discover", {
        method: "POST",
        body: JSON.stringify({
          goal: ROBOTICS_GOAL,
          communityIds: ["unicorn-mafia", "kickstart-global"],
          mode: "connections",
        }),
      }),
      {
        env: {},
        fetchImpl,
        requireOrganizer: async () => sampleViewer,
        getPlatformPort: () => port,
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.people).toHaveLength(3);
    expect(body.data.retrievalBackend).toBe("local");
    expect(typeof body.requestId).toBe("string");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await handleDiscover(new Request("http://localhost/api/intelligence/discover", { method: "POST", body: "{" }), {
      env: {},
      requireOrganizer: async () => sampleViewer,
      getPlatformPort: () => portWith(),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("BAD_INPUT");
    expect(body.error.retryable).toBe(false);
  });

  it("returns 503 when OpenAI is configured and the provider fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("quota", { status: 429 }));
    const response = await handleDiscover(
      new Request("http://localhost/api/intelligence/discover", {
        method: "POST",
        body: JSON.stringify({ goal: ROBOTICS_GOAL, communityIds: ["unicorn-mafia"], mode: "connections" }),
      }),
      {
        env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-6.1-sol" },
        fetchImpl,
        requireOrganizer: async () => sampleViewer,
        getPlatformPort: () => portWith(),
      },
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
    expect(JSON.stringify(body)).not.toContain("test-key");
  });
});
