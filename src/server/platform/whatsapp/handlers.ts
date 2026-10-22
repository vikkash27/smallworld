import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireOrganizer } from "../auth";
import { PlatformError } from "../errors";
import { endpoint, body } from "../http";
import { whatsappCall } from "./service";
import {
  eventSchema,
  selectionSchema,
} from "../../../../convex/whatsapp/contracts";

type Context = { params: Promise<{ path?: string[] }> };
function worker(request: Request) {
  const secret = process.env.WHATSAPP_WORKER_TOKEN;
  if (!secret || secret.length < 32)
    throw new PlatformError(
      "PROVIDER_UNAVAILABLE",
      "WhatsApp worker is not configured",
    );
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(secret),
    b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new PlatformError(
      "UNAUTHENTICATED",
      "Worker authentication required",
    );
  return z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .parse(request.headers.get("x-worker-id"));
}
export function handleWhatsApp(request: Request, context: Context) {
  return endpoint(request, async () => {
    const path = (await context.params).path ?? [];
    if (path.length === 1 && path[0] === "worker") {
      const workerId = worker(request);
      // Session credentials may persist locally during the spike. Durable real chat import requires Convex.
      if (!process.env.CONVEX_URL)
        throw new PlatformError(
          "PROVIDER_UNAVAILABLE",
          "Configure Convex before connecting a real WhatsApp account",
        );
      if (request.method === "GET")
        return whatsappCall("claim", workerId, Date.now());
      if (request.method === "POST")
        return whatsappCall(
          "event",
          workerId,
          await body(request, eventSchema),
          Date.now(),
        );
    }
    const viewer = await requireOrganizer(request);
    if (path[0] !== "connections")
      throw new PlatformError("NOT_FOUND", "Route not found");
    if (path.length === 1) {
      if (request.method === "GET")
        return {
          connections: await whatsappCall("list", viewer, Date.now()),
          workerConfigured: Boolean(
            process.env.WHATSAPP_WORKER_TOKEN && process.env.CONVEX_URL,
          ),
          persistent: Boolean(process.env.CONVEX_URL),
        };
      if (request.method === "POST") {
        if (
          (process.env.WHATSAPP_WORKER_TOKEN?.length ?? 0) < 32 ||
          !process.env.CONVEX_URL
        )
          throw new PlatformError(
            "PROVIDER_UNAVAILABLE",
            "Configure the WhatsApp worker and Convex before pairing",
          );
        return whatsappCall("create", viewer, randomUUID(), Date.now());
      }
    }
    const id = z.string().uuid().parse(path[1]);
    if (path.length === 2 && request.method === "GET")
      return whatsappCall("detail", viewer, id, Date.now());
    if (path.length === 2 && request.method === "DELETE")
      return whatsappCall("control", viewer, id, "disconnect", Date.now());
    if (
      path.length === 3 &&
      path[2] === "selection" &&
      request.method === "PUT"
    )
      return whatsappCall(
        "select",
        viewer,
        id,
        await body(request, selectionSchema),
        Date.now(),
      );
    if (path.length === 3 && path[2] === "sync" && request.method === "GET")
      return whatsappCall("detail", viewer, id, Date.now());
    if (
      path.length === 3 &&
      request.method === "POST" &&
      (path[2] === "pause" || path[2] === "resume")
    )
      return whatsappCall("control", viewer, id, path[2], Date.now());
    throw new PlatformError("NOT_FOUND", "Route not found");
  });
}
