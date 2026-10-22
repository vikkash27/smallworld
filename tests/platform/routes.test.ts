import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "@/shared/fixtures/discover-response.sample.json";
import type {
  CreateCircleRequest,
  CreateCircleResponse,
  Viewer,
} from "@/shared/contracts";
import { FixturePort } from "@/server/platform/port.fixture";
import { hashToken } from "@/server/platform/tokens";
import { issueSession } from "@/server/platform/auth";
import { GET as bootstrap } from "@/app/api/platform/bootstrap/route";
import { GET as communities } from "@/app/api/platform/communities/route";
import { POST as session } from "@/app/api/platform/session/route";
import { GET as search } from "@/app/api/platform/searches/[id]/route";
import { POST as create, GET as list } from "@/app/api/platform/circles/route";
import { GET as circle } from "@/app/api/platform/circles/[id]/route";
import { PATCH as activity } from "@/app/api/platform/circles/[id]/activity/route";
import { GET as invitation } from "@/app/api/platform/invitations/[token]/route";
import { POST as respond } from "@/app/api/platform/invitations/[token]/respond/route";
import { POST as contribute } from "@/app/api/platform/contributions/route";
import { POST as reset } from "@/app/api/platform/demo/reset/route";

const sampleViewer: Viewer = {
  id: "demo-host",
  workspaceId: "sample-workspace",
  role: "organizer",
  allowedCommunityIds: ["unicorn-mafia", "kickstart-global"],
  dataMode: "sample",
};
const liveViewer: Viewer = {
  ...sampleViewer,
  id: "live-host",
  workspaceId: "live-workspace",
  allowedCommunityIds: [],
  dataMode: "live",
};
let port: FixturePort;
vi.mock("@/server/platform/runtime", async (original) => {
  const actual = await original<typeof import("@/server/platform/runtime")>();
  return { ...actual, getService: () => port };
});
function request(
  path: string,
  method = "GET",
  data?: unknown,
  authenticated = true,
  extra?: Record<string, string>,
) {
  return new Request(`http://localhost:3000/api/platform/${path}`, {
    method,
    headers: {
      ...(authenticated
        ? {
            Cookie: `sw_session=${issueSession(sampleViewer.id, sampleViewer.workspaceId)}`,
          }
        : {}),
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
const idContext = (id: string) => ({ params: Promise.resolve({ id }) });
const tokenContext = (token: string) => ({
  params: Promise.resolve({ token }),
});
const tokenOf = (created: CreateCircleResponse, index = 0) =>
  new URL(created.invitationLinks[index].url).pathname.split("/").pop()!;
function circleInput(
  overrides: Partial<CreateCircleRequest> = {},
): CreateCircleRequest {
  const draft = fixture.circleDraft!;
  return {
    searchId: fixture.searchId,
    selectedMemberIds: draft.proposedMemberIds.slice(0, 2),
    title: draft.title,
    purpose: draft.purpose,
    activity: draft.activity as CreateCircleRequest["activity"],
    capacity: 6,
    minimumMembers: 3,
    ...overrides,
  };
}
async function created(input = circleInput()): Promise<CreateCircleResponse> {
  const response = await create(request("circles", "POST", input));
  expect(response.status).toBe(200);
  return (await response.json()).data;
}
async function answer(
  c: CreateCircleResponse,
  index = 0,
  decision = "join",
  showOnRoster = false,
) {
  return respond(
    request("invitations/respond", "POST", { decision, showOnRoster }, false),
    tokenContext(tokenOf(c, index)),
  );
}
beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-session-secret");
  vi.stubEnv("TOKEN_HASH_SECRET", "test-token-secret");
  vi.stubEnv("ADMIN_PASSWORD", "test-password");
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "sample");
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
  port = new FixturePort(hashToken("sample-contribution-capability"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("session and envelopes", () => {
  it("requires a signed unexpired session; rejects tampering and reports request IDs", async () => {
    const invalidCookies: Record<string, string>[] = [
      {},
      { Cookie: "sw_session=garbage.signature" },
    ];
    for (const headers of invalidCookies) {
      const response = await bootstrap(
        request("bootstrap", "GET", undefined, false, headers),
      );
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe("UNAUTHENTICATED");
      expect(body.requestId).toBeTruthy();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    const old = request("bootstrap");
    vi.useFakeTimers();
    vi.advanceTimersByTime(12 * 60 * 60_000 + 1000);
    expect((await bootstrap(old)).status).toBe(401);
  });
  it("sets the protected session cookie and throttles globally despite spoofed IPs", async () => {
    vi.useFakeTimers();
    const ok = await session(
      request("session", "POST", { password: "test-password" }, false, {
        "x-forwarded-for": "192.0.2.1",
      }),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(
      /sw_session=.*HttpOnly; SameSite=Lax; Max-Age=43200/,
    );
    for (let i = 0; i < 5; i++)
      expect(
        (
          await session(
            request("session", "POST", { password: "bad" }, false, {
              "x-forwarded-for": `192.0.2.${i + 2}`,
            }),
          )
        ).status,
      ).toBe(401);
    expect(
      (
        await session(
          request("session", "POST", { password: "bad" }, false, {
            "x-forwarded-for": "198.51.100.1",
          }),
        )
      ).status,
    ).toBe(429);
    vi.advanceTimersByTime(60_000);
    expect(
      (await session(request("session", "POST", { password: "bad" }, false))).status,
    ).toBe(401);
    expect(
      (await session(request("session", "POST", { password: "test-password" }, false))).status,
    ).toBe(200);
  });
  it("clears failed login attempts on success and does not count successful logins", async () => {
    vi.useFakeTimers();
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 4; i++) {
        expect(
          (await session(request("session", "POST", { password: "bad" }, false))).status,
        ).toBe(401);
      }
      expect(
        (await session(request("session", "POST", { password: "test-password" }, false))).status,
      ).toBe(200);
    }
    for (let i = 0; i < 6; i++) {
      expect(
        (await session(request("session", "POST", { password: "test-password" }, false))).status,
      ).toBe(200);
    }
  });
  it("rejects malformed input, injected scope and cross-origin mutations", async () => {
    expect(
      (
        await session(
          new Request("http://localhost:3000/api/platform/session", {
            method: "POST",
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await create(
          request("circles", "POST", {
            ...circleInput(),
            viewerId: "someone-else",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await create(
          request("circles", "POST", circleInput(), true, {
            Origin: "https://attacker.example",
          }),
        )
      ).status,
    ).toBe(403);
  });
});

describe("directory and saved searches", () => {
  it("bootstraps all 12 communities with fictional participation and seeded host", async () => {
    const response = await bootstrap(request("bootstrap"));
    const { data } = await response.json();
    expect(data.viewer.displayName).toBe("Vikkash");
    expect(data.communities).toHaveLength(12);
    expect(data.allowedCommunityIds).toEqual(sampleViewer.allowedCommunityIds);
    expect(
      (await (await communities(request("communities"))).json()).data,
    ).toHaveLength(12);
    expect(
      (await port.getCommunities(liveViewer)).every(
        (c) => c.status === "listed",
      ),
    ).toBe(true);
    expect(await port.getCandidateContexts(liveViewer, [])).toEqual([]);
  });
  it("returns the preview but hides searches owned by other viewers, workspaces or expired", async () => {
    const ctx = idContext(fixture.searchId);
    vi.useFakeTimers();
    const reads = vi.spyOn(port, "readSearch");
    expect((await search(request("searches/id"), ctx)).status).toBe(200);
    expect(reads).toHaveBeenLastCalledWith(
      sampleViewer, fixture.searchId, Date.now(),
    );
    expect(await port.readSearch(liveViewer, fixture.searchId)).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live");
    const live = request("searches/id", "GET", undefined, false, {
      Cookie: `sw_session=${issueSession("live-host", "live-workspace")}`,
    });
    expect((await search(live, ctx)).status).toBe(404);
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "sample");
    await port.bootstrap(sampleViewer);
    vi.advanceTimersByTime(31 * 60_000);
    expect((await search(request("searches/id"), ctx)).status).toBe(404);
    expect(reads).toHaveBeenLastCalledWith(
      sampleViewer, fixture.searchId, Date.now(),
    );
  });
  it("permission-filters contexts and validates saved evidence", async () => {
    const contexts = await port.getCandidateContexts(sampleViewer, [
      "unicorn-mafia",
    ]);
    expect(contexts.map((c) => c.member.id)).toEqual(["demo-amara"]);
    await expect(
      port.getCandidateContexts(sampleViewer, ["hackradar"]),
    ).rejects.toThrow();
    const { searchId: _id, ...result } = structuredClone(fixture);
    void _id;
    result.people[0].evidence[0].excerpt = "invented";
    await expect(
      port.saveSearch(sampleViewer, {
        goal: "robotics",
        communityIds: sampleViewer.allowedCommunityIds,
        result: result as Parameters<FixturePort["saveSearch"]>[1]["result"],
      }),
    ).rejects.toThrow();
  });
});

describe("circle and invitation flow", () => {
  it("GET never joins, writes or returns private fields; raw tokens are creation-only", async () => {
    const c = await created();
    const token = tokenOf(c);
    const initial = await port.circleDetail(sampleViewer, c.circle.id);
    for (let i = 0; i < 2; i++) {
      const response = await invitation(
        request("invitations/token", "GET", undefined, false),
        tokenContext(token),
      );
      expect(response.status).toBe(200);
      const { data } = await response.json();
      expect(Object.keys(data).sort()).toEqual([
        "circle",
        "dataMode",
        "expiresAt",
        "hostDisplayName",
        "invitationStatus",
      ]);
      const serialized = JSON.stringify(data);
      for (const privateField of [
        "Amara",
        "Leo",
        "evidence",
        "excerpt",
        "roster",
        "tokenHash",
        "invitations",
      ])
        expect(serialized).not.toContain(privateField);
    }
    expect(await port.circleDetail(sampleViewer, c.circle.id)).toEqual(initial);
    const listing = await list(request("circles"));
    expect(JSON.stringify(await listing.json())).not.toContain(token);
    const detail = await circle(request("circles/id"), idContext(c.circle.id));
    expect(JSON.stringify(await detail.json())).not.toContain(token);
  });
  it("joins once, keeps roster consent separate and is idempotent", async () => {
    const c = await created();
    const first = await answer(c);
    expect(first.status).toBe(200);
    const again = await answer(c);
    expect(await again.json()).toMatchObject({
      data: { acceptedCount: 2, invitationStatus: "accepted" },
    });
    const detail = await port.circleDetail(sampleViewer, c.circle.id);
    expect(detail.roster).toHaveLength(2);
    expect(detail.roster[1]).toMatchObject({
      displayName: null,
      showOnRoster: false,
    });
    expect(detail.acceptedCount).toBe(2);
  });
  it.each(["join", "decline"])(
    "returns the original %s result after token expiry",
    async (decision) => {
      const c = await created();
      const first = await answer(c, 0, decision);
      expect(first.status).toBe(200);
      const original = (await first.json()).data;
      const detail = await port.circleDetail(sampleViewer, c.circle.id);
      vi.useFakeTimers();
      vi.advanceTimersByTime(24 * 60 * 60_000 + 1000);
      const repeated = await answer(c, 0, decision);
      expect(repeated.status).toBe(200);
      expect((await repeated.json()).data).toEqual(original);
      const after = await port.circleDetail(sampleViewer, c.circle.id);
      expect(after.roster).toEqual(detail.roster);
      expect(after.acceptedCount).toBe(detail.acceptedCount);
      expect(
        (await answer(c, 0, decision === "join" ? "decline" : "join")).status,
      ).toBe(410);
    },
  );
  it("serializes two joins competing for the final seat and returns 409", async () => {
    const c = await created(circleInput({ capacity: 2, minimumMembers: 2 }));
    const responses = await Promise.all([answer(c, 0), answer(c, 1)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await port.circleDetail(sampleViewer, c.circle.id)).acceptedCount,
    ).toBe(2);
  });
  it("lets a third invitee join an active circle with a free seat", async () => {
    const c = await created(
      circleInput({ selectedMemberIds: fixture.circleDraft!.proposedMemberIds }),
    );
    await activity(
      request("circles/id/activity", "PATCH", {
        activity: c.circle.activity,
        confirmed: true,
      }),
      idContext(c.circle.id),
    );
    expect((await answer(c, 0)).status).toBe(200);
    expect((await (await answer(c, 1)).json()).data.circleStatus).toBe("active");
    const third = await answer(c, 2);
    expect(third.status).toBe(200);
    expect((await third.json()).data).toMatchObject({
      acceptedCount: 4,
      circleStatus: "active",
      invitationStatus: "accepted",
    });
    expect(
      (await port.circleDetail(sampleViewer, c.circle.id)).roster,
    ).toHaveLength(4);
  });
  it("allows a pending invitee to decline an active circle at capacity", async () => {
    const c = await created(circleInput({ capacity: 2, minimumMembers: 2 }));
    await answer(c, 0);
    await activity(
      request("circles/id/activity", "PATCH", {
        activity: c.circle.activity,
        confirmed: true,
      }),
      idContext(c.circle.id),
    );
    expect((await answer(c, 1)).status).toBe(409);
    const declined = await answer(c, 1, "decline");
    expect(declined.status).toBe(200);
    expect((await declined.json()).data).toMatchObject({
      acceptedCount: 2,
      circleStatus: "active",
      invitationStatus: "declined",
    });
  });
  it("resolves accept/decline races once and supports idempotent declines", async () => {
    const c = await created();
    const responses = await Promise.all([
      answer(c, 0, "decline"),
      answer(c, 0, "join"),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await answer(c, 0, "decline")).status).toBe(200);
    expect(
      (await port.circleDetail(sampleViewer, c.circle.id)).acceptedCount,
    ).toBe(1);
  });
  it("returns 410 for expired invitations and 404 for unknown capabilities", async () => {
    const c = await created();
    vi.useFakeTimers();
    const reads = vi.spyOn(port, "invitationView");
    expect(
      (await invitation(
        request("invitations/token", "GET", undefined, false),
        tokenContext(tokenOf(c)),
      )).status,
    ).toBe(200);
    expect(reads).toHaveBeenLastCalledWith(hashToken(tokenOf(c)), Date.now());
    expect(
      (
        await invitation(
          request("invitations/token", "GET", undefined, false),
          tokenContext("unknown-valid-looking-token"),
        )
      ).status,
    ).toBe(404);
    vi.advanceTimersByTime(24 * 60 * 60_000 + 1000);
    expect(
      (
        await invitation(
          request("invitations/token", "GET", undefined, false),
          tokenContext(tokenOf(c)),
        )
      ).status,
    ).toBe(410);
    expect(reads).toHaveBeenLastCalledWith(hashToken(tokenOf(c)), Date.now());
    expect((await answer(c)).status).toBe(410);
  });
  it("rejects arbitrary candidate injection, repeated IDs and invalid minimum/capacity", async () => {
    for (const change of [
      { selectedMemberIds: ["arbitrary-member"] },
      { selectedMemberIds: ["demo-amara", "demo-amara"] },
      { capacity: 2, minimumMembers: 3 },
      { selectedMemberIds: [] },
    ]) {
      expect(
        (await create(request("circles", "POST", circleInput(change)))).status,
      ).toBe(400);
    }
    expect(await port.listCircles(sampleViewer)).toEqual([]);
  });
  it("requires both enough accepted members and confirmed activity, in either order", async () => {
    const c = await created();
    const updated = await activity(
      request("circles/id/activity", "PATCH", {
        activity: c.circle.activity,
        confirmed: true,
      }),
      idContext(c.circle.id),
    );
    expect((await updated.json()).data.status).toBe("forming");
    expect((await (await answer(c, 0)).json()).data.circleStatus).toBe(
      "forming",
    );
    expect(
      (await (await answer(c, 1, "join", true)).json()).data.circleStatus,
    ).toBe("active");
    expect((await answer(c, 1)).status).toBe(200);
    const second = await created();
    await answer(second, 0);
    await answer(second, 1);
    expect(
      (await port.circleDetail(sampleViewer, second.circle.id)).status,
    ).toBe("forming");
    const active = await activity(
      request("circles/id/activity", "PATCH", {
        activity: second.circle.activity,
        confirmed: true,
      }),
      idContext(second.circle.id),
    );
    expect((await active.json()).data).toMatchObject({
      status: "active",
      acceptedCount: 3,
    });
  });
  it("creator-only detail hides circles from a different workspace", async () => {
    const c = await created();
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live");
    const req = request("circles/id", "GET", undefined, false, {
      Cookie: `sw_session=${issueSession("live-host", "live-workspace")}`,
    });
    expect((await circle(req, idContext(c.circle.id))).status).toBe(404);
  });
});

describe("contribution and reset", () => {
  const contribution = () => ({
    token: "sample-contribution-capability",
    displayName: "Test Person",
    building: "A robot",
    offering: "Engineering",
    seeking: "A collaborator",
    availability: null,
    permittedCommunityIds: ["unicorn-mafia"],
    consentToDiscovery: true,
  });
  it("accepts only scoped contribution capabilities and consent; signals start pending", async () => {
    const response = await contribute(
      request("contributions", "POST", contribution(), false),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.status).toBe("pending");
    expect(
      await port.getCandidateContexts(
        sampleViewer,
        sampleViewer.allowedCommunityIds,
      ),
    ).toHaveLength(3);
    expect(
      (
        await contribute(
          request(
            "contributions",
            "POST",
            { ...contribution(), consentToDiscovery: false },
            false,
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await contribute(
          request(
            "contributions",
            "POST",
            { ...contribution(), permittedCommunityIds: ["hackradar"] },
            false,
          ),
        )
      ).status,
    ).toBe(403);
    const c = await created();
    expect(
      (
        await contribute(
          request(
            "contributions",
            "POST",
            { ...contribution(), token: tokenOf(c) },
            false,
          ),
        )
      ).status,
    ).toBe(404);
  });
  it("resets only sample records and preserves live data", async () => {
    const c = await created();
    const before = await port.bootstrap(liveViewer);
    const response = await reset(request("demo/reset", "POST"));
    expect((await response.json()).data).toEqual({ reset: true });
    expect(await port.listCircles(sampleViewer)).toEqual([]);
    expect(
      (
        await invitation(
          request("invitations/token", "GET", undefined, false),
          tokenContext(tokenOf(c)),
        )
      ).status,
    ).toBe(404);
    expect(await port.bootstrap(liveViewer)).toEqual(before);
    expect(
      await port.getCandidateContexts(
        sampleViewer,
        sampleViewer.allowedCommunityIds,
      ),
    ).toHaveLength(3);
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live");
    const live = request("demo/reset", "POST", undefined, false, {
      Cookie: `sw_session=${issueSession("live-host", "live-workspace")}`,
    });
    expect((await reset(live)).status).toBe(403);
  });
});
