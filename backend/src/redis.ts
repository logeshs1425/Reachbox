import Redis from "ioredis";
import { config } from "./config.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

export function hourWindowKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  return `${y}${m}${d}${h}`;
}

export function msUntilNextHour(from: Date = new Date()): number {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return Math.max(1000, next.getTime() - from.getTime());
}

const RATE_NOTIFY_KEY = "rate-limit-notify";

export async function tryAcquireSendSlot(params: {
  senderEmail: string;
  globalLimit: number;
  senderLimit: number;
}): Promise<
  | { ok: true }
  | { ok: false; reason: "global" | "sender"; retryAfterMs: number }
> {
  const window = hourWindowKey();
  const globalKey = `rate:global:${window}`;
  const senderKey = `rate:sender:${params.senderEmail}:${window}`;

  const pipe = redis.pipeline();
  pipe.incr(globalKey);
  pipe.expire(globalKey, 7200);
  pipe.incr(senderKey);
  pipe.expire(senderKey, 7200);
  const results = await pipe.exec();
  const globalCount = Number(results?.[0]?.[1] ?? 0);
  const senderCount = Number(results?.[2]?.[1] ?? 0);

  if (globalCount > params.globalLimit) {
    await redis.decr(globalKey);
    if (senderCount > 0) await redis.decr(senderKey);
    return { ok: false, reason: "global", retryAfterMs: msUntilNextHour() };
  }

  if (senderCount > params.senderLimit) {
    await redis.decr(globalKey);
    await redis.decr(senderKey);
    return { ok: false, reason: "sender", retryAfterMs: msUntilNextHour() };
  }

  return { ok: true };
}

export async function releaseSendSlot(senderEmail: string): Promise<void> {
  const window = hourWindowKey();
  await redis.decr(`rate:global:${window}`);
  await redis.decr(`rate:sender:${senderEmail}:${window}`);
}

export async function shouldNotifyRateLimit(
  userId: string,
  senderEmail: string,
  reason: "global" | "sender"
): Promise<boolean> {
  const window = hourWindowKey();
  const key = `${RATE_NOTIFY_KEY}:${userId}:${senderEmail}:${reason}:${window}`;
  const set = await redis.set(key, "1", "EX", 7200, "NX");
  return set === "OK";
}
