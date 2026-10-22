import { it, expect, afterEach, vi } from "vitest";
import { handleWhatsApp } from "../../../src/server/platform/whatsapp/handlers";
import { issueSession } from "../../../src/server/platform/auth";
afterEach(() => vi.unstubAllEnvs());
function setup() {
  vi.stubEnv("SESSION_SECRET", "test-session-secret");
  vi.stubEnv("TOKEN_HASH_SECRET", "test-token-secret");
  vi.stubEnv("WHATSAPP_WORKER_TOKEN", "a".repeat(64));
  vi.stubEnv("CONVEX_URL", "");
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "sample");
}
it("requires organiser auth and rejects cross-origin connection creation", async () => {
  setup();
  const response = await handleWhatsApp(
    new Request("http://localhost/api/platform/whatsapp/connections"),
    { params: Promise.resolve({ path: ["connections"] }) },
  );
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const mutation = await handleWhatsApp(
    new Request("http://localhost/api/platform/whatsapp/connections", {
      method: "POST",
      headers: { origin: "https://other.example" },
    }),
    { params: Promise.resolve({ path: ["connections"] }) },
  );
  expect(mutation.status).toBe(403);
});
it("authenticates the worker separately and refuses real ingestion without persistent storage", async () => {
  setup();
  const context = { params: Promise.resolve({ path: ["worker"] }) };
  expect(
    (
      await handleWhatsApp(
        new Request("http://localhost/api/platform/whatsapp/worker", {
          headers: { authorization: "Bearer wrong", "x-worker-id": "worker" },
        }),
        context,
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await handleWhatsApp(
        new Request("http://localhost/api/platform/whatsapp/worker", {
          headers: {
            authorization: `Bearer ${"a".repeat(64)}`,
            "x-worker-id": "worker",
          },
        }),
        context,
      )
    ).status,
  ).toBe(503);
  const cookie = issueSession("demo-host", "sample-workspace");
  const created = await handleWhatsApp(
    new Request("http://localhost/api/platform/whatsapp/connections", {
      method: "POST",
      headers: { cookie: `sw_session=${cookie}` },
    }),
    { params: Promise.resolve({ path: ["connections"] }) },
  );
  expect(created.status).toBe(503);
});
