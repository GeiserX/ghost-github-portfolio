import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config, GitHubRepo } from "./types.js";

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: "test-repo",
    full_name: "user/test-repo",
    html_url: "https://github.com/user/test-repo",
    description: "A test repo",
    stargazers_count: 10,
    forks_count: 2,
    license: { spdx_id: "GPL-3.0" },
    fork: false,
    homepage: null,
    topics: [],
    language: "TypeScript",
    default_branch: "main",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    github: { username: "testuser", ...overrides.github },
    ghost: {
      url: "https://ghost.example.com",
      adminApiKey: "key:secret",
      pageSlug: "portfolio",
      ...overrides.ghost,
    },
    portfolio: {
      minStars: 2,
      maxRepos: 50,
      excludeRepos: [],
      includeForked: false,
      badgeStyle: "for-the-badge",
      showBanner: true,
      centerContent: true,
      defaultBannerPath: "docs/images/banner.svg",
      bannerPaths: {},
      repos: {},
      footer: { showStats: true, showViewAll: true },
      ...overrides.portfolio,
    },
  };
}

// We test the internal logic by mocking global fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = mockFetch;
});

describe("fetchRepos", () => {
  // Dynamic import to allow fetch mock to be set up first
  async function importModule() {
    // Clear module cache to pick up fresh fetch mock
    const mod = await import("./github.js");
    return mod;
  }

  it("fetches repos and sorts by stars descending", async () => {
    const repos = [
      makeRepo({ name: "low", stargazers_count: 3 }),
      makeRepo({ name: "high", stargazers_count: 100 }),
      makeRepo({ name: "mid", stargazers_count: 20 }),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => repos,
      headers: new Headers(),
    });

    const { fetchRepos } = await importModule();
    const result = await fetchRepos(makeConfig());

    expect(result[0].name).toBe("high");
    expect(result[1].name).toBe("mid");
    expect(result[2].name).toBe("low");
  });

  it("filters repos below minStars", async () => {
    const repos = [
      makeRepo({ name: "above", stargazers_count: 5 }),
      makeRepo({ name: "below", stargazers_count: 1 }),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => repos,
      headers: new Headers(),
    });

    const { fetchRepos } = await importModule();
    const result = await fetchRepos(makeConfig());

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("above");
  });

  it("excludes forked repos when includeForked is false", async () => {
    const repos = [
      makeRepo({ name: "original", fork: false, stargazers_count: 10 }),
      makeRepo({ name: "forked", fork: true, stargazers_count: 10 }),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => repos,
      headers: new Headers(),
    });

    const { fetchRepos } = await importModule();
    const result = await fetchRepos(makeConfig());

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("original");
  });

  it("excludes repos in excludeRepos list (case-insensitive)", async () => {
    const repos = [
      makeRepo({ name: "keep-me", stargazers_count: 10 }),
      makeRepo({ name: ".github", stargazers_count: 10 }),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => repos,
      headers: new Headers(),
    });

    const { fetchRepos } = await importModule();
    const config = makeConfig({
      portfolio: {
        ...makeConfig().portfolio,
        excludeRepos: [".GitHub"],
      },
    });
    const result = await fetchRepos(config);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("keep-me");
  });

  it("respects maxRepos limit", async () => {
    const repos = Array.from({ length: 10 }, (_, i) =>
      makeRepo({ name: `repo-${i}`, stargazers_count: 100 - i }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => repos,
      headers: new Headers(),
    });

    const { fetchRepos } = await importModule();
    const config = makeConfig({
      portfolio: { ...makeConfig().portfolio, maxRepos: 3 },
    });
    const result = await fetchRepos(config);

    expect(result).toHaveLength(3);
  });

  it("paginates when first page returns perPage results", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) =>
      makeRepo({ name: `repo-${i}`, stargazers_count: 10 }),
    );
    const page2 = [makeRepo({ name: "repo-100", stargazers_count: 10 })];

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => page1, headers: new Headers() })
      .mockResolvedValueOnce({ ok: true, json: async () => page2, headers: new Headers() });

    const { fetchRepos } = await importModule();
    const config = makeConfig({
      portfolio: { ...makeConfig().portfolio, maxRepos: 200 },
    });
    const result = await fetchRepos(config);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(101);
  });

  it("throws on GitHub API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "rate limited",
      headers: new Headers(),
    });

    const { fetchRepos } = await importModule();
    await expect(fetchRepos(makeConfig())).rejects.toThrow(
      "GitHub API error 403",
    );
  });

  it("excludes repos with exclude override", async () => {
    const repos = [
      makeRepo({ name: "visible", stargazers_count: 10 }),
      makeRepo({ name: "hidden", stargazers_count: 10 }),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => repos,
      headers: new Headers(),
    });

    const { fetchRepos } = await importModule();
    const config = makeConfig({
      portfolio: {
        ...makeConfig().portfolio,
        repos: { hidden: { exclude: true } },
      },
    });
    const result = await fetchRepos(config);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("visible");
  });
});

describe("detectBanner", () => {
  async function importModule() {
    const mod = await import("./github.js");
    return mod;
  }

  it("returns null when showBanner is false", async () => {
    const { detectBanner } = await importModule();
    const config = makeConfig({
      portfolio: { ...makeConfig().portfolio, showBanner: false },
    });
    const result = await detectBanner(makeRepo(), config);
    expect(result).toBeNull();
  });

  it("uses config override bannerPath when it exists", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, headers: new Headers() });

    const { detectBanner } = await importModule();
    const config = makeConfig({
      portfolio: {
        ...makeConfig().portfolio,
        repos: { "test-repo": { bannerPath: "custom/banner.png" } },
      },
    });
    const result = await detectBanner(makeRepo(), config);

    expect(result).toContain("custom/banner.png");
  });

  it("uses bannerPaths map override", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, headers: new Headers() });

    const { detectBanner } = await importModule();
    const config = makeConfig({
      portfolio: {
        ...makeConfig().portfolio,
        bannerPaths: { "test-repo": "media/banner.svg" },
      },
    });
    const result = await detectBanner(makeRepo(), config);

    expect(result).toContain("media/banner.svg");
  });

  it("falls back to default path", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, headers: new Headers() });

    const { detectBanner } = await importModule();
    const result = await detectBanner(makeRepo(), makeConfig());

    expect(result).toContain("docs/images/banner.svg");
  });

  it("returns null when no banner found", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, headers: new Headers() });

    const { detectBanner } = await importModule();
    const result = await detectBanner(makeRepo(), makeConfig());

    expect(result).toBeNull();
  });
});
