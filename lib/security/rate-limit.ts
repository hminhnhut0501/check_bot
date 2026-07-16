type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// This is intentionally process-local for MVP; replace with a database/Redis limiter at scale.
export function enforceRateLimit(key: string, limit = 5, windowMs = 86_400_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (current.count >= limit) return { allowed: false, remaining: 0, resetAt: current.resetAt };
  current.count += 1;
  return { allowed: true, remaining: limit - current.count };
}
