import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fetchWithRetry, parseRateLimitHeaders, rawRequest } from "./http.js";

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

  it("retries on network errors (fetch rejection)", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
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
    expect(onRetry.mock.calls[0][2]).toContain("Network error");
  });

  it("throws descriptive error when network errors exhaust retries", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      fetchWithRetry("https://example.com", {}, { maxRetries: 2, baseDelay: 1 }),
    ).rejects.toThrow("Request to https://example.com failed after 3 attempts: ECONNREFUSED");

    expect(mockFetch).toHaveBeenCalledTimes(3);
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

describe("fetchWithRetry fetchImpl", () => {
  it("uses the given request function instead of the global fetch", async () => {
    const impl = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await fetchWithRetry("https://example.com", { method: "PUT" }, { fetchImpl: impl });
    expect(await res.text()).toBe("ok");
    expect(impl).toHaveBeenCalledWith("https://example.com", { method: "PUT" });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("rawRequest", () => {
  async function withServer(
    handler: Parameters<typeof createServer>[1],
    run: (base: string) => Promise<void>,
  ) {
    const server: Server = createServer(handler);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
      await new Promise((r) => server.close(r));
    }
  }

  it("sends a custom Host header, method and body", async () => {
    let got: { host?: string; method?: string; body: string } = { body: "" };
    await withServer(
      (req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          got = { host: req.headers.host, method: req.method, body };
          res.setHeader("set-cookie", ["a=1", "b=2"]);
          res.end("done");
        });
      },
      async (base) => {
        const res = await rawRequest(`${base}/x`, {
          method: "POST",
          headers: { Host: "blog.example.com" },
          body: "payload",
        });
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("done");
        expect(res.headers.get("set-cookie")).toContain("a=1");
      },
    );
    expect(got).toEqual({ host: "blog.example.com", method: "POST", body: "payload" });
  });

  it("handles a response with no body", async () => {
    await withServer(
      (_req, res) => {
        res.writeHead(204);
        res.end();
      },
      async (base) => {
        const res = await rawRequest(`${base}/`);
        expect(res.status).toBe(204);
        expect(await res.text()).toBe("");
      },
    );
  });

  it("rejects when the connection fails", async () => {
    await expect(rawRequest("http://127.0.0.1:1/")).rejects.toThrow();
  });
});
