import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

// `Authorization: Bearer <secret>`, compared in constant time. Hashing
// both sides first makes the comparison length-independent too.
export const isAuthorized = (header: string | null, secret: string) => {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(secret));
};
