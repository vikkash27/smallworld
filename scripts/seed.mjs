import { createHmac, randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { loadPlatformEnv } from "./platform-env.mjs";
const env = await loadPlatformEnv();
if (!env.CONVEX_URL || !env.CONVEX_DEPLOY_KEY)
  throw new Error("Start npx convex dev --local first");
const token = randomBytes(32).toString("base64url");
const contributionTokenHash = createHmac("sha256", env.TOKEN_HASH_SECRET)
  .update(token)
  .digest("hex");
const client = new ConvexHttpClient(env.CONVEX_URL);
client.setAdminAuth(env.CONVEX_DEPLOY_KEY);
await client.mutation(makeFunctionReference("seed:run"), {
  contributionTokenHash,
});
console.log(
  "Seeded directory, organizer, fictional members/evidence/search and isolated live workspace.",
);
console.log(
  `Contribution capability (24 hours; only shown here): ${env.APP_BASE_URL}/contribute/${token}`,
);
