import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { generateJwt, fetchPage, updatePage, adminUrl } from "./ghost.js";
import type { Config } from "./types.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = mockFetch;
});

function makeConfig(overrides: Partial<Config["ghost"]> = {}): Config {
  return {
    github: { username: "testuser", excludePatterns: [] },
    ghost: {
      url: "https://ghost.example.com",
      adminApiKey: "keyid:aabbccdd",
      pageSlug: "portfolio",
      ...overrides,
    },
    portfolio: {
      minStars: 2,
      maxRepos: 20,
      columns: 3,
      excludeRepos: [],
      includeForked: false,
      includeArchived: false,
      excludeAwesomeLists: true,
      showBanner: true,
      defaultBannerPath: "docs/images/banner.svg",
      bannerPaths: {},
      intro: "",
      repos: {},
    },
  };
}

describe("Ghost JWT generation", () => {
  it("generates a valid 3-part JWT", () => {
    const jwt = generateJwt("keyid123:aabbccdd");

    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
  });

  it("encodes correct header with kid", () => {
    const jwt = generateJwt("mykey:aabbccdd");
    const header = JSON.parse(
      Buffer.from(jwt.split(".")[0], "base64url").toString(),
    );

    expect(header.alg).toBe("HS256");
    expect(header.kid).toBe("mykey");
    expect(header.typ).toBe("JWT");
  });

  it("encodes payload with aud /admin/", () => {
    const jwt = generateJwt("mykey:aabbccdd");
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    );

    expect(payload.aud).toBe("/admin/");
    expect(payload.exp).toBe(payload.iat + 300);
  });

  it("signature is verifiable", () => {
    const secretHex = "aabbccdd";
    const jwt = generateJwt(`mykey:${secretHex}`);
    const [header, payload, signature] = jwt.split(".");

    const expected = createHmac("sha256", Buffer.from(secretHex, "hex"))
      .update(`${header}.${payload}`)
      .digest("base64url")
      .replace(/=+$/, "");

    expect(signature).toBe(expected);
  });

  it("throws on invalid API key format", () => {
    expect(() => generateJwt("invalid-no-colon")).toThrow(
      'Invalid Ghost Admin API key format. Expected "KEY_ID:SECRET_HEX"',
    );
  });
});

describe("fetchPage", () => {
  it("fetches page by pageId", async () => {
    const page = { id: "abc123", updated_at: "2024-01-01", title: "Portfolio", lexical: "{}" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pages: [page] }),
    });

    const config = makeConfig({ pageId: "abc123", pageSlug: undefined });
    const result = await fetchPage(config);

    expect(result).toEqual(page);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/pages/abc123/");
  });

  it("fetches page by pageSlug when no pageId", async () => {
    const page = { id: "xyz789", updated_at: "2024-01-01", title: "Portfolio", lexical: "{}" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pages: [page] }),
    });

    const config = makeConfig({ pageId: undefined, pageSlug: "portfolio" });
    const result = await fetchPage(config);

    expect(result).toEqual(page);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/pages/slug/portfolio/");
  });

  it("throws on Ghost API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "Not found",
    });

    const config = makeConfig();
    await expect(fetchPage(config)).rejects.toThrow("Ghost API error 404: Not found");
  });
});

describe("updatePage", () => {
  it("sends PUT with lexical body and returns updated page", async () => {
    const updatedPage = { id: "abc123", updated_at: "2024-01-02", title: "Portfolio", lexical: "{}" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pages: [updatedPage] }),
    });

    const config = makeConfig();
    const lexical = {
      root: { children: [], direction: "ltr", format: "", indent: 0, type: "root", version: 1 },
    };
    const result = await updatePage(config, "abc123", "2024-01-01", lexical);

    expect(result).toEqual(updatedPage);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain("/pages/abc123/");
    expect(calledInit.method).toBe("PUT");
    const body = JSON.parse(calledInit.body);
    expect(body.pages[0].updated_at).toBe("2024-01-01");
    expect(body.pages[0].lexical).toBe(JSON.stringify(lexical));
  });

  it("throws on Ghost update error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => "Validation error",
    });

    const config = makeConfig();
    const lexical = {
      root: { children: [], direction: "ltr", format: "", indent: 0, type: "root", version: 1 },
    };
    await expect(updatePage(config, "abc123", "2024-01-01", lexical)).rejects.toThrow(
      "Ghost update error 422: Validation error",
    );
  });
});

describe("origin URL routing", () => {
  interface Seen {
    method?: string;
    url?: string;
    headers: IncomingHttpHeaders;
    body: string;
  }
  let server: Server;
  let origin: string;
  let seen: Seen[];
  let reply: { status: number; body: string; headers?: Record<string, string> };

  beforeEach(async () => {
    seen = [];
    reply = {
      status: 200,
      body: JSON.stringify({ pages: [{ id: "p1", updated_at: "u2", title: "Portfolio", lexical: "{}" }] }),
    };
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ method: req.method, url: req.url, headers: req.headers, body });
        res.writeHead(reply.status, { "content-type": "application/json", ...reply.headers });
        res.end(reply.body);
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  const lexical = {
    root: { children: [], direction: "ltr", format: "", indent: 0, type: "root", version: 1 },
  };

  it("uses the public URL when originUrl is not set", () => {
    expect(adminUrl(makeConfig(), "pages/x/")).toBe(
      "https://ghost.example.com/ghost/api/admin/pages/x/",
    );
  });

  it("sends the PUT to the origin with Host and X-Forwarded-Proto", async () => {
    const config = makeConfig({ originUrl: origin, hostHeader: "blog.example.com" });
    const result = await updatePage(config, "p1", "u1", lexical);

    expect(result.id).toBe("p1");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe("PUT");
    expect(seen[0].url).toBe("/ghost/api/admin/pages/p1/");
    expect(seen[0].headers.host).toBe("blog.example.com");
    expect(seen[0].headers["x-forwarded-proto"]).toBe("https");
    expect(seen[0].headers.authorization).toMatch(/^Ghost /);
    expect(JSON.parse(seen[0].body).pages[0].updated_at).toBe("u1");

    const jwt = String(seen[0].headers.authorization).slice("Ghost ".length);
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    expect(payload.aud).toBe("/admin/");
  });

  it("defaults the Host header to the host of ghost.url", async () => {
    const config = makeConfig({ originUrl: origin, pageSlug: "portfolio" });
    await fetchPage(config);
    expect(seen[0].method).toBe("GET");
    expect(seen[0].url).toBe("/ghost/api/admin/pages/slug/portfolio/");
    expect(seen[0].headers.host).toBe("ghost.example.com");
  });

  it("does not follow a redirect from the origin", async () => {
    reply = { status: 301, body: "moved", headers: { location: "https://ghost.example.com/ghost/api/admin/pages/p1/" } };
    const config = makeConfig({ originUrl: origin });
    await expect(fetchPage(config)).rejects.toThrow("Ghost API error 301: moved");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("surfaces an origin error body", async () => {
    reply = { status: 403, body: "blocked" };
    const config = makeConfig({ originUrl: origin });
    await expect(updatePage(config, "p1", "u1", lexical)).rejects.toThrow(
      "Ghost update error 403: blocked",
    );
  });
});
