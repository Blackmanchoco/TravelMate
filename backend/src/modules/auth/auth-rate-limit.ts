type LoginOutcome = "success" | "failure" | "neutral";

export type AuthRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type LoginBucket = {
  windowStart: number;
  failures: number;
  pending: number;
};

type RegistrationBucket = {
  windowStart: number;
  requests: number;
};

type RateLimitOptions = {
  enabled: boolean;
  loginMaxFailures: number;
  loginWindowMs: number;
  registrationMaxRequests: number;
  registrationWindowMs: number;
};

const MAX_TRACKED_KEYS = 10_000;

function retryAfterSeconds(windowStart: number, windowMs: number, now: number) {
  return Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
}

function removeExpired<T extends { windowStart: number }>(
  buckets: Map<string, T>,
  windowMs: number,
  now: number,
  hasPending: (bucket: T) => boolean = () => false,
) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= windowMs && !hasPending(bucket)) {
      buckets.delete(key);
    }
  }
}

function capacityRetryAfter<T extends { windowStart: number }>(
  buckets: Map<string, T>,
  windowMs: number,
  now: number,
): AuthRateLimitDecision {
  let earliestExpiry = now + windowMs;
  for (const bucket of buckets.values()) {
    earliestExpiry = Math.min(earliestExpiry, bucket.windowStart + windowMs);
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((earliestExpiry - now) / 1000)),
  };
}

export function createAuthRateLimiter(options: RateLimitOptions) {
  const loginBuckets = new Map<string, LoginBucket>();
  const registrationBuckets = new Map<string, RegistrationBucket>();

  function loginKey(ip: string, email: string) {
    return JSON.stringify([ip, email.trim().toLowerCase()]);
  }

  function getLoginBucket(key: string, now: number) {
    const current = loginBuckets.get(key);
    if (current && now - current.windowStart < options.loginWindowMs) {
      return current;
    }
    if (current?.pending) {
      current.windowStart = now;
      current.failures = 0;
      return current;
    }
    if (current) loginBuckets.delete(key);

    removeExpired(loginBuckets, options.loginWindowMs, now, bucket => bucket.pending > 0);
    if (loginBuckets.size >= MAX_TRACKED_KEYS) return undefined;
    const bucket = { windowStart: now, failures: 0, pending: 0 };
    loginBuckets.set(key, bucket);
    return bucket;
  }

  function getRegistrationBucket(ip: string, now: number) {
    const current = registrationBuckets.get(ip);
    if (current && now - current.windowStart < options.registrationWindowMs) {
      return current;
    }
    if (current) registrationBuckets.delete(ip);

    removeExpired(registrationBuckets, options.registrationWindowMs, now);
    if (registrationBuckets.size >= MAX_TRACKED_KEYS) return undefined;
    const bucket = { windowStart: now, requests: 0 };
    registrationBuckets.set(ip, bucket);
    return bucket;
  }

  return {
    beginLogin(ip: string, email: string): AuthRateLimitDecision {
      if (!options.enabled) return { allowed: true };
      const now = Date.now();
      const key = loginKey(ip, email);
      const bucket = getLoginBucket(key, now);
      if (!bucket) return capacityRetryAfter(loginBuckets, options.loginWindowMs, now);
      if (bucket.failures + bucket.pending >= options.loginMaxFailures) {
        return {
          allowed: false,
          retryAfterSeconds: retryAfterSeconds(bucket.windowStart, options.loginWindowMs, now),
        };
      }
      bucket.pending += 1;
      return { allowed: true };
    },

    finishLogin(ip: string, email: string, outcome: LoginOutcome) {
      if (!options.enabled) return;
      const key = loginKey(ip, email);
      const bucket = loginBuckets.get(key);
      if (!bucket) return;
      const now = Date.now();
      bucket.pending = Math.max(0, bucket.pending - 1);

      if (outcome === "success") {
        bucket.windowStart = now;
        bucket.failures = 0;
        if (bucket.pending === 0) loginBuckets.delete(key);
        return;
      }

      if (outcome === "failure") {
        if (now - bucket.windowStart >= options.loginWindowMs) {
          bucket.windowStart = now;
          bucket.failures = 0;
        }
        bucket.failures += 1;
      } else if (bucket.pending === 0 && bucket.failures === 0) {
        loginBuckets.delete(key);
      }
    },

    consumeRegistration(ip: string): AuthRateLimitDecision {
      if (!options.enabled) return { allowed: true };
      const now = Date.now();
      const bucket = getRegistrationBucket(ip, now);
      if (!bucket) return capacityRetryAfter(registrationBuckets, options.registrationWindowMs, now);
      if (bucket.requests >= options.registrationMaxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: retryAfterSeconds(bucket.windowStart, options.registrationWindowMs, now),
        };
      }
      bucket.requests += 1;
      return { allowed: true };
    },
  };
}

function readPositiveInteger(name: string, fallback: number) {
  const configured = process.env[name];
  if (configured === undefined || configured.trim() === "") return fallback;
  const value = Number(configured);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readEnabled() {
  const configured = process.env.AUTH_RATE_LIMITS_ENABLED?.trim().toLowerCase();
  if (configured === undefined || configured === "") return process.env.NODE_ENV !== "test";
  if (configured === "true") return true;
  if (configured === "false") return false;
  throw new Error("AUTH_RATE_LIMITS_ENABLED must be true or false.");
}

export const authRateLimiter = createAuthRateLimiter({
  enabled: readEnabled(),
  loginMaxFailures: readPositiveInteger("AUTH_LOGIN_MAX_FAILURES", 10),
  loginWindowMs: readPositiveInteger("AUTH_LOGIN_WINDOW_MS", 10 * 60 * 1000),
  registrationMaxRequests: readPositiveInteger("AUTH_REGISTER_MAX_REQUESTS", 100),
  registrationWindowMs: readPositiveInteger("AUTH_REGISTER_WINDOW_MS", 10 * 60 * 1000),
});
