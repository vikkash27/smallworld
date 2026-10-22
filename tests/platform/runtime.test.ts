import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getPlatformPort, requireOrganizer } from "@/server/platform/public";
import type { Viewer } from "@/shared/contracts";

const viewer: Viewer = {
  id: "demo-host",
  workspaceId: "sample-workspace",
  role: "organizer",
  allowedCommunityIds: ["unicorn-mafia", "kickstart-global"],
  dataMode: "sample",
};
beforeEach(() => {
  vi.stubEnv("CONVEX_URL", "");
  vi.stubEnv("CONVEX_DEPLOY_KEY", "");
  vi.stubEnv("TOKEN_HASH_SECRET", "");
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "sample");
});
afterEach(() => vi.unstubAllEnvs());
it("provides the fixture discovery port without database or auth configuration", async () => {
  const port = getPlatformPort();
  expect(
    await port.getCandidateContexts(viewer, viewer.allowedCommunityIds),
  ).toHaveLength(3);
  expect(await port.getCommunities(viewer)).toHaveLength(12);
});
it("requires a real configured database in live mode", () => {
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live");
  expect(() => getPlatformPort()).toThrow(/Live mode requires/);
});
it("does not silently replace a misconfigured database with fixture data", () => {
  vi.stubEnv("CONVEX_URL", "http://127.0.0.1:3210");
  expect(() => getPlatformPort()).toThrow(/deployment key/);
});
it("always rejects missing sessions, including in unconfigured live mode", async () => {
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live");
  await expect(
    requireOrganizer(new Request("http://localhost/api/platform/bootstrap")),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
});
