import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, delay: number, reason: string) => void;
  /** Request function to use instead of the global fetch. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  const maxRetries = opts?.maxRetries ?? MAX_RETRIES;
  const baseDelay = opts?.baseDelay ?? BASE_DELAY_MS;
  const doFetch = opts?.fetchImpl ?? ((u: string, i?: RequestInit) => fetch(u, i));
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await doFetch(url, init);
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

const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);

/**
 * A minimal fetch over node:http and node:https that sends the headers it is
 * given as they are, Host included. The global fetch drops a custom Host
 * header, which the Ghost origin option depends on. It never follows
 * redirects: a redirect from the origin would lead back to the public URL.
 */
export function rawRequest(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const headers = { ...(init.headers as Record<string, string> | undefined) };
    const hostHeader = Object.entries(headers).find(
      ([k]) => k.toLowerCase() === "host",
    )?.[1];
    const isHttps = target.protocol === "https:";
    const send = isHttps ? httpsRequest : httpRequest;

    const req = send(
      target,
      {
        method: init.method ?? "GET",
        headers,
        // Present the public name for TLS too, so the origin can pick its certificate.
        ...(isHttps && hostHeader ? { servername: hostHeader.replace(/:\d+$/, "") } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("error", reject);
        res.on("end", () => {
          const out = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v === undefined) continue;
            for (const item of Array.isArray(v) ? v : [v]) out.append(k, item);
          }
          const status = res.statusCode ?? 502;
          const body = NULL_BODY_STATUS.has(status) ? null : Buffer.concat(chunks);
          resolve(new Response(body, { status, headers: out }));
        });
      },
    );
    req.setTimeout(30_000, () => req.destroy(new Error("timed out after 30s")));
    req.on("error", reject);
    if (typeof init.body === "string") req.write(init.body);
    req.end();
  });
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
