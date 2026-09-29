import { Redis } from "ioredis";
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
  const senderKey = `rate:sender:${Buffer.from(params.senderEmail.toLowerCase()).toString("hex")}:${window}`;
  // Reserve both limits atomically so concurrent workers cannot oversubscribe.
  const result = await redis.eval(
    `local globalCount = tonumber(redis.call('GET', KEYS[1]) or '0')
     local senderCount = tonumber(redis.call('GET', KEYS[2]) or '0')
     if globalCount >= tonumber(ARGV[1]) then return 1 end
     if senderCount >= tonumber(ARGV[2]) then return 2 end
     globalCount = redis.call('INCR', KEYS[1])
     senderCount = redis.call('INCR', KEYS[2])
     if globalCount == 1 then redis.call('EXPIRE', KEYS[1], 7200) end
     if senderCount == 1 then redis.call('EXPIRE', KEYS[2], 7200) end
     return 0`,
    2,
    globalKey,
    senderKey,
    params.globalLimit,
    params.senderLimit
  );
  if (result === 1) return { ok: false, reason: "global", retryAfterMs: msUntilNextHour() };
  if (result === 2) return { ok: false, reason: "sender", retryAfterMs: msUntilNextHour() };
  return { ok: true };
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
