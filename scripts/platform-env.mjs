import { readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export async function loadPlatformEnv() {
  let content = await readFile(".env.local", "utf8").catch(() => "");
  const env = Object.fromEntries(
    content
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const index = line.indexOf("=");
        return [
          line.slice(0, index),
          line.slice(index + 1).replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
  const updates = {};
  const deployment = env.CONVEX_DEPLOYMENT;
  if (deployment && !env.CONVEX_DEPLOY_KEY) {
    const [kind, name] = deployment.split(":");
    if (
      (kind === "anonymous" || kind === "local") &&
      name &&
      /^[a-zA-Z0-9_-]+$/.test(name)
    ) {
      const config = JSON.parse(
        await readFile(
          join(
            homedir(),
            ".convex",
            kind === "anonymous"
              ? "anonymous-convex-backend-state"
              : "convex-backend-state",
            name,
            "config.json",
          ),
          "utf8",
        ),
      );
      updates.CONVEX_DEPLOY_KEY = config.adminKey;
      updates.CONVEX_URL = `http://127.0.0.1:${config.ports.cloud}`;
    }
  }
  if (!env.CONVEX_URL && !updates.CONVEX_URL && env.NEXT_PUBLIC_CONVEX_URL)
    updates.CONVEX_URL = env.NEXT_PUBLIC_CONVEX_URL;
  for (const key of ["SESSION_SECRET", "TOKEN_HASH_SECRET"])
    if (!env[key]) updates[key] = randomBytes(32).toString("hex");
  if (!env.APP_BASE_URL) updates.APP_BASE_URL = "http://localhost:3000";
  if (!env.NEXT_PUBLIC_DATA_MODE || env.NEXT_PUBLIC_DATA_MODE === "mock")
    updates.NEXT_PUBLIC_DATA_MODE = "sample";
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    content = pattern.test(content)
      ? content.replace(pattern, line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  await writeFile(".env.local", content, { mode: 0o600 });
  await chmod(".env.local", 0o600);
  Object.assign(process.env, env, updates);
  return { ...env, ...updates };
}
if (process.argv[1]?.endsWith("platform-env.mjs")) {
  await loadPlatformEnv();
  console.log(
    "Synced local Convex URL/admin key and generated missing secrets in .env.local. Set ADMIN_PASSWORD before logging in.",
  );
}
