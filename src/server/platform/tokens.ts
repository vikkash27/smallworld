import { createHmac, randomBytes } from "node:crypto";
import { PlatformError } from "./errors";

export function hashToken(token: string): string {
  const secret = process.env.TOKEN_HASH_SECRET;
  if (!secret)
    throw new PlatformError(
      "PROVIDER_UNAVAILABLE",
      "Token hashing secret is missing",
    );
  return createHmac("sha256", secret).update(token).digest("hex");
}
export function newToken() {
  return randomBytes(32).toString("base64url");
}
