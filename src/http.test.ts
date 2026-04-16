import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithRetry, parseRateLimitHeaders } from "./http.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = mockFetch;
});

describe("fetchWithRetry", () => {
  it("returns response on first success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 500 errors with exponential backoff", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers() })
      .mockResolvedValueOnce({ ok: false, status: 502, headers: new Headers() })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const onRetry = vi.fn();
    const res = await fetchWithRetry(
      "https://example.com",
      {},
      { maxRetries: 3, baseDelay: 1, onRetry },
    );

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("returns last error response when retries exhausted", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
    });

    const res = await fetchWithRetry(
      "https://example.com",
      {},
      { maxRetries: 2, baseDelay: 1 },
    );

    expect(res.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry on 4xx client errors (except rate limit)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers(),
    });

    const res = await fetchWithRetry(
      "https://example.com",
      {},
      { maxRetries: 3, baseDelay: 1 },
    );

    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("handles rate limit with x-ratelimit-reset header", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 1; // 1 second from now
    const rateLimitHeaders = new Headers({
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(resetTime),
      "x-ratelimit-limit": "60",
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: rateLimitHeaders,
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const onRetry = vi.fn();
    const res = await fetchWithRetry(
      "https://example.com",
      {},
      { maxRetries: 3, baseDelay: 1, onRetry },
    );

    expect(res.status).toBe(200);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][2]).toContain("Rate limited");
  });

  it("passes through request init options", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await fetchWithRetry("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(mockFetch).toHaveBeenCalledWith("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  });
});

describe("parseRateLimitHeaders", () => {
  it("parses valid rate limit headers", () => {
    const resetTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const res = new Response(null, {
      headers: {
        "x-ratelimit-limit": "5000",
        "x-ratelimit-remaining": "4999",
        "x-ratelimit-reset": String(resetTimestamp),
      },
    });

    const info = parseRateLimitHeaders(res);
    expect(info).not.toBeNull();
    expect(info!.limit).toBe(5000);
    expect(info!.remaining).toBe(4999);
    expect(info!.resetAt).toBeInstanceOf(Date);
  });

  it("returns null when headers are missing", () => {
    const res = new Response(null);
    expect(parseRateLimitHeaders(res)).toBeNull();
  });
});
