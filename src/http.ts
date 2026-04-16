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
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;

      const delay = baseDelay * Math.pow(2, attempt);
      const message =
        error instanceof Error ? error.message : String(error);
      opts?.onRetry?.(
        attempt + 1,
        delay,
        `Network error: ${message}. Retrying in ${delay}ms`,
      );
      await sleep(delay);
      continue;
    }

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

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Request to ${url} failed after ${maxRetries + 1} attempts: ${message}`,
  );
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
