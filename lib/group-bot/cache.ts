type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const groupPolicyCache = new Map<string, CacheEntry<unknown>>();

export function getCachedValue<T>(key: string): T | null {
  const entry = groupPolicyCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    groupPolicyCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  groupPolicyCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateCachedValue(key: string) {
  groupPolicyCache.delete(key);
}

