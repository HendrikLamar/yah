const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

type AttemptRecord = {
  count: number;
  firstAttemptAt: number;
};

const attempts = new Map<string, AttemptRecord>();

export function throwIfLoginRateLimited(email: string, ipAddress?: string | null) {
  const key = buildAttemptKey(email, ipAddress);
  const record = attempts.get(key);

  if (!record) {
    return;
  }

  if (Date.now() - record.firstAttemptAt >= WINDOW_MS) {
    attempts.delete(key);
    return;
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    throw new Error("Too many login attempts. Please try again later.");
  }
}

export function registerFailedLoginAttempt(email: string, ipAddress?: string | null) {
  const key = buildAttemptKey(email, ipAddress);
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttemptAt >= WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
    return;
  }

  attempts.set(key, {
    count: record.count + 1,
    firstAttemptAt: record.firstAttemptAt,
  });
}

export function clearLoginRateLimit(email?: string, ipAddress?: string | null) {
  if (!email) {
    attempts.clear();
    return;
  }

  attempts.delete(buildAttemptKey(email, ipAddress));
}

function buildAttemptKey(email: string, ipAddress?: string | null) {
  return `${email.toLowerCase()}::${ipAddress?.trim() || "unknown-ip"}`;
}