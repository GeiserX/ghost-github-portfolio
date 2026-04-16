const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, delay: number, reason: string) => void;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  const maxRetries = opts?.maxRetries ?? MAX_RETRIES;
  const baseDelay = opts?.baseDelay ?? BASE_DELAY_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);

    // Rate limit handling (GitHub API)
    if (res.status === 403 || res.status === 429) {
      const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
      const rateLimitReset = res.headers.get("x-ratelimit-reset");

      if (rateLimitRemaining === "0" && rateLimitReset) {
        const resetTime = parseInt(rateLimitReset, 10) * 1000;
        const waitMs = Math.max(resetTime - Date.now(), 0);

        if (waitMs > 0 && waitMs < 120_000 && attempt < maxRetries) {
          const waitSec = Math.ceil(waitMs / 1000);
          opts?.onRetry?.(
            attempt + 1,
            waitMs,
            `Rate limited. Waiting ${waitSec}s for reset`,
          );
          await sleep(waitMs);
          continue;
        }
      }
    }

    // Retry on server errors
    if (res.status >= 500 && attempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, attempt);
      opts?.onRetry?.(
        attempt + 1,
        delay,
        `Server error ${res.status}. Retrying in ${delay}ms`,
      );
      await sleep(delay);
      continue;
    }

    return res;
  }

  // Unreachable, but TypeScript needs it
  throw new Error(`Failed after ${maxRetries} retries`);
}

export function parseRateLimitHeaders(res: Response): RateLimitInfo | null {
  const limit = res.headers.get("x-ratelimit-limit");
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");

  if (!limit || !remaining || !reset) return null;

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    resetAt: new Date(parseInt(reset, 10) * 1000),
  };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
