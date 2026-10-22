import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference, type DefaultFunctionArgs } from "convex/server";
import { MemoryStore } from "../port.fixture";
import { PlatformError } from "../errors";
import * as model from "../../../../convex/whatsapp/model";
// The fixture store is intentionally process-local. Real connections must use Convex.
let store = new MemoryStore();
let queue: Promise<unknown> = Promise.resolve();
export async function whatsappCall<K extends keyof typeof model>(
  method: K,
  ...args: Parameters<(typeof model)[K]> extends [unknown, ...infer A]
    ? A
    : never
): Promise<Awaited<ReturnType<(typeof model)[K]>>> {
  if (process.env.CONVEX_URL) {
    if (!process.env.CONVEX_DEPLOY_KEY)
      throw new PlatformError(
        "PROVIDER_UNAVAILABLE",
        "Convex deployment key is missing",
      );
    const client = new ConvexHttpClient(process.env.CONVEX_URL);
    (
      client as ConvexHttpClient & { setAdminAuth(key: string): void }
    ).setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
    const names: Record<keyof typeof model, string[]> = {
      list: ["viewer", "now"],
      detail: ["viewer", "id", "now"],
      create: ["viewer", "id", "now"],
      select: ["viewer", "id", "input", "now"],
      control: ["viewer", "id", "action", "now"],
      claim: ["workerId", "now"],
      event: ["workerId", "input", "now"],
    };
    const input = Object.fromEntries(
      names[method].map((n, i) => [n, args[i]]),
    ) as DefaultFunctionArgs;
    const path = `whatsapp/functions:${method}`;
    if (method === "list" || method === "detail")
      return client.query(makeFunctionReference<"query">(path), input);
    return client.mutation(makeFunctionReference<"mutation">(path), input);
  }
  if (process.env.NEXT_PUBLIC_DATA_MODE === "live")
    throw new PlatformError(
      "PROVIDER_UNAVAILABLE",
      "WhatsApp requires Convex in live mode",
    );
  const run = queue.then(async () => {
    const draft = store.clone();
    const fn = model[method] as (...a: unknown[]) => Promise<unknown>;
    const result = await fn(draft, ...args);
    store = draft;
    return result;
  });
  queue = run.catch(() => undefined);
  return run as Promise<Awaited<ReturnType<(typeof model)[K]>>>;
}
