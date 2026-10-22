import { it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EncryptedSessionStore } from "../../../workers/whatsapp/src/session-store";
it("encrypts session material, survives restart and detects the wrong key", async () => {
  const root = await mkdtemp(join(tmpdir(), "sw-wa-"));
  try {
    const store = new EncryptedSessionStore(root, Buffer.alloc(32, 7));
    await store.write("connection", "private-session-secret");
    expect(
      (await readFile(join(root, "connection.enc"))).includes(
        Buffer.from("private-session-secret"),
      ),
    ).toBe(false);
    expect(
      await new EncryptedSessionStore(root, Buffer.alloc(32, 7)).read(
        "connection",
      ),
    ).toBe("private-session-secret");
    await expect(
      new EncryptedSessionStore(root, Buffer.alloc(32, 8)).read("connection"),
    ).rejects.toThrow();
    await store.remove("connection");
    expect(await store.read("connection")).toBeNull();
    await expect(store.write("../escape", "secret")).rejects.toThrow(
      /identifier/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("keeps credentials when provider logout fails and erases them only after logout", async () => {
  const { logoutAndErase } = await import(
    "../../../workers/whatsapp/src/session-store"
  );
  const root = await mkdtemp(join(tmpdir(), "sw-wa-logout-"));
  try {
    const store = new EncryptedSessionStore(root, Buffer.alloc(32, 7));
    await store.write("connection", "credentials");
    await expect(
      logoutAndErase(store, "connection", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(await store.read("connection")).toBe("credentials");
    await logoutAndErase(store, "connection", async () => {});
    expect(await store.read("connection")).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
