import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config, GitHubRepo } from "./types.js";
import {
  fetchAllRepos,
  selectRepos,
  isAwesomeList,
  findExternalRefs,
  resolveBanner,
  fetchPortfolioConfig,
} from "./github.js";

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
    archived: false,
    homepage: null,
    topics: [],
    language: "TypeScript",
    default_branch: "main",
    ...overrides,
  };
}

function makeConfig(
  portfolio: Partial<Config["portfolio"]> = {},
  github: Partial<Config["github"]> = {},
): Config {
  return {
    github: { username: "testuser", excludePatterns: [], ...github },
    ghost: {
      url: "https://ghost.example.com",
      adminApiKey: "key:secret",
      pageSlug: "portfolio",
    },
    portfolio: {
      minStars: 2,
      maxRepos: 50,
      columns: 3,
      excludeRepos: [],
      includeForked: false,
      includeArchived: false,
      excludeAwesomeLists: false,
      showBanner: true,
      defaultBannerPath: "docs/images/banner.svg",
      bannerPaths: {},
      intro: "",
      repos: {},
      ...portfolio,
    },
  };
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
  global.fetch = mockFetch;
});

function jsonPage(repos: GitHubRepo[], headers = new Headers()) {
  return { ok: true, status: 200, json: async () => repos, headers };
}

function textResponse(status: number, body = "", contentType = "text/plain") {
  return new Response(status === 204 ? null : body, {
    status,
    headers: { "content-type": contentType },
  });
}

describe("fetchAllRepos", () => {
  it("returns every repo unfiltered", async () => {
    const repos = [
      makeRepo({ name: "a", stargazers_count: 0 }),
      makeRepo({ name: "b", fork: true }),
      makeRepo({ name: "c", archived: true }),
    ];
    mockFetch.mockResolvedValueOnce(jsonPage(repos));

    const result = await fetchAllRepos(makeConfig());
    expect(result.map((r) => r.name)).toEqual(["a", "b", "c"]);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.github.com/users/testuser/repos?per_page=100&page=1&type=owner",
    );
  });

  it("paginates when a page is full", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => makeRepo({ name: `repo-${i}` }));
    const page2 = [makeRepo({ name: "repo-100" })];
    mockFetch.mockResolvedValueOnce(jsonPage(page1)).mockResolvedValueOnce(jsonPage(page2));

    const result = await fetchAllRepos(makeConfig());
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(101);
  });

  it("stops on an empty page", async () => {
    mockFetch.mockResolvedValueOnce(jsonPage([]));
    expect(await fetchAllRepos(makeConfig())).toEqual([]);
  });

  it("sends the token when configured", async () => {
    mockFetch.mockResolvedValueOnce(jsonPage([]));
    await fetchAllRepos(makeConfig({}, { token: "ghp_test" }));
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer ghp_test");
  });

  it("throws on GitHub API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "rate limited",
      headers: new Headers(),
    });
    await expect(fetchAllRepos(makeConfig())).rejects.toThrow("GitHub API error 403");
  });

  it("logs rate limit info when verbose", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const resetTime = Math.floor(Date.now() / 1000) + 3600;
    mockFetch.mockResolvedValueOnce(
      jsonPage(
        [makeRepo()],
        new Headers({
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "59",
          "x-ratelimit-reset": String(resetTime),
        }),
      ),
    );

    await fetchAllRepos(makeConfig(), true);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[rate-limit]"));
    consoleSpy.mockRestore();
  });
});

describe("selectRepos", () => {
  it("sorts by stars descending", () => {
    const result = selectRepos(
      [
        makeRepo({ name: "low", stargazers_count: 3 }),
        makeRepo({ name: "high", stargazers_count: 100 }),
        makeRepo({ name: "mid", stargazers_count: 20 }),
      ],
      makeConfig(),
    );
    expect(result.map((r) => r.name)).toEqual(["high", "mid", "low"]);
  });

  it("filters repos below minStars", () => {
    const result = selectRepos(
      [makeRepo({ name: "above", stargazers_count: 5 }), makeRepo({ name: "below", stargazers_count: 1 })],
      makeConfig(),
    );
    expect(result.map((r) => r.name)).toEqual(["above"]);
  });

  it("excludes forks unless includeForked", () => {
    const repos = [makeRepo({ name: "original" }), makeRepo({ name: "forked", fork: true })];
    expect(selectRepos(repos, makeConfig()).map((r) => r.name)).toEqual(["original"]);
    expect(selectRepos(repos, makeConfig({ includeForked: true }))).toHaveLength(2);
  });

  it("excludes archived repos unless includeArchived", () => {
    const repos = [makeRepo({ name: "live" }), makeRepo({ name: "old", archived: true })];
    expect(selectRepos(repos, makeConfig()).map((r) => r.name)).toEqual(["live"]);
    expect(selectRepos(repos, makeConfig({ includeArchived: true }))).toHaveLength(2);
  });

  it("excludes repos in excludeRepos (case-insensitive) and with exclude override", () => {
    const result = selectRepos(
      [makeRepo({ name: "keep-me" }), makeRepo({ name: ".github" }), makeRepo({ name: "hidden" })],
      makeConfig({ excludeRepos: [".GitHub"], repos: { hidden: { exclude: true } } }),
    );
    expect(result.map((r) => r.name)).toEqual(["keep-me"]);
  });

  it("excludes names matching github.excludePatterns", () => {
    const result = selectRepos(
      [makeRepo({ name: "homebrew-tap" }), makeRepo({ name: "Homebrew-Other" }), makeRepo({ name: "app" })],
      makeConfig({}, { excludePatterns: ["^homebrew-"] }),
    );
    expect(result.map((r) => r.name)).toEqual(["app"]);
  });

  it("excludes awesome lists when excludeAwesomeLists is set", () => {
    const repos = [
      makeRepo({ name: "awesome-spain" }),
      makeRepo({ name: "tagged", topics: ["awesome-list"] }),
      makeRepo({ name: "normal" }),
    ];
    expect(selectRepos(repos, makeConfig({ excludeAwesomeLists: true })).map((r) => r.name)).toEqual(["normal"]);
    expect(selectRepos(repos, makeConfig())).toHaveLength(3);
  });

  it("applies maxRepos after every filter", () => {
    // The five most starred repos are all filtered out; they must not use up slots.
    const repos = [
      makeRepo({ name: "awesome-a", stargazers_count: 900 }),
      makeRepo({ name: "excluded", stargazers_count: 800 }),
      makeRepo({ name: "old", stargazers_count: 700, archived: true }),
      makeRepo({ name: "homebrew-tap", stargazers_count: 600 }),
      makeRepo({ name: "forked", stargazers_count: 500, fork: true }),
      ...Array.from({ length: 5 }, (_, i) => makeRepo({ name: `keep-${i}`, stargazers_count: 100 - i })),
    ];
    const result = selectRepos(
      repos,
      makeConfig(
        { maxRepos: 3, excludeAwesomeLists: true, excludeRepos: ["excluded"] },
        { excludePatterns: ["^homebrew-"] },
      ),
    );
    expect(result.map((r) => r.name)).toEqual(["keep-0", "keep-1", "keep-2"]);
  });
});

describe("isAwesomeList", () => {
  it("matches by name prefix or topic", () => {
    expect(isAwesomeList(makeRepo({ name: "Awesome-X" }))).toBe(true);
    expect(isAwesomeList(makeRepo({ topics: ["awesome-list"] }))).toBe(true);
    expect(isAwesomeList(makeRepo())).toBe(false);
  });
});

const SELF_CONTAINED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 900 200">
  <defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs>
  <rect width="900" height="200" fill="url(#g)"/>
  <use href="#g"/><use xlink:href='#g'/>
  <image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/>
  <style>@font-face { src: url("data:font/woff2;base64,AAAA"); }</style>
</svg>`;

const RELATIVE_HREF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 200">
  <image href="logo.png" width="100" height="100"/>
</svg>`;

describe("findExternalRefs", () => {
  it("accepts #id and data: references", () => {
    expect(findExternalRefs(SELF_CONTAINED_SVG)).toEqual([]);
  });

  it("finds relative and external hrefs, url() and @import", () => {
    const svg = `<svg><image href="logo.png"/><image xlink:href="https://cdn.example.com/a.png"/>
      <rect fill="url('pattern.svg#p')"/><rect style="fill:url(other.svg)"/>
      <style>@import "fonts.css";</style></svg>`;
    expect(findExternalRefs(svg)).toEqual([
      "logo.png",
      "https://cdn.example.com/a.png",
      "pattern.svg#p",
      "other.svg",
      "fonts.css",
    ]);
  });

  it("does not treat the xmlns namespace as a reference", () => {
    expect(findExternalRefs('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toEqual([]);
  });
});

describe("resolveBanner", () => {
  const BANNER_URL = "https://raw.githubusercontent.com/user/test-repo/main/docs/images/banner.svg";

  it("returns nothing and fetches nothing when showBanner is false", async () => {
    const result = await resolveBanner(makeRepo(), makeConfig({ showBanner: false }));
    expect(result).toEqual({ url: null, problems: [] });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("accepts a self-contained SVG that returns 200", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(200, SELF_CONTAINED_SVG));
    const result = await resolveBanner(makeRepo(), makeConfig());
    expect(result).toEqual({ url: BANNER_URL, problems: [] });
    expect(mockFetch.mock.calls[0][0]).toBe(BANNER_URL);
  });

  it("rejects an SVG with a relative href", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(200, RELATIVE_HREF_SVG));
    const result = await resolveBanner(makeRepo(), makeConfig());
    expect(result.url).toBeNull();
    expect(result.problems).toEqual([
      "docs/images/banner.svg: not self-contained, it loads logo.png",
    ]);
  });

  it("rejects a missing banner (404)", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(404, "404: Not Found"));
    const result = await resolveBanner(makeRepo(), makeConfig());
    expect(result).toEqual({ url: null, problems: ["docs/images/banner.svg: missing (HTTP 404)"] });
  });

  it("rejects any other non-200 status", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(204));
    const result = await resolveBanner(makeRepo(), makeConfig());
    expect(result.problems).toEqual(["docs/images/banner.svg: HTTP 204"]);
  });

  it("reports a request that fails outright", async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockRejectedValue(new Error("boom"));
      const pending = resolveBanner(makeRepo(), makeConfig({ defaultBannerPath: "b.png" }));
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.url).toBeNull();
      expect(result.problems[0]).toMatch(/^b\.png: request failed \(.*boom/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a PNG without reading it as SVG", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(200, "\x89PNG", "image/png"));
    const result = await resolveBanner(makeRepo(), makeConfig({ defaultBannerPath: "media/banner.png" }));
    expect(result.url).toBe("https://raw.githubusercontent.com/user/test-repo/main/media/banner.png");
  });

  it("checks an SVG served with an SVG content type under another extension", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(200, RELATIVE_HREF_SVG, "image/svg+xml"));
    const result = await resolveBanner(makeRepo(), makeConfig({ defaultBannerPath: "banner" }));
    expect(result.url).toBeNull();
  });

  it("tries the per-repo path first, then the default", async () => {
    mockFetch
      .mockResolvedValueOnce(textResponse(404))
      .mockResolvedValueOnce(textResponse(200, SELF_CONTAINED_SVG));
    const result = await resolveBanner(
      makeRepo(),
      makeConfig({ repos: { "test-repo": { bannerPath: "/custom/banner.svg" } } }),
    );
    expect(mockFetch.mock.calls.map((c) => c[0])).toEqual([
      "https://raw.githubusercontent.com/user/test-repo/main/custom/banner.svg",
      BANNER_URL,
    ]);
    expect(result).toEqual({ url: BANNER_URL, problems: [] });
  });

  it("uses the bannerPaths map and lists every problem when all fail", async () => {
    mockFetch
      .mockResolvedValueOnce(textResponse(200, RELATIVE_HREF_SVG))
      .mockResolvedValueOnce(textResponse(404));
    const result = await resolveBanner(
      makeRepo(),
      makeConfig({ bannerPaths: { "test-repo": "media/banner.svg" } }),
    );
    expect(result.problems).toEqual([
      "media/banner.svg: not self-contained, it loads logo.png",
      "docs/images/banner.svg: missing (HTTP 404)",
    ]);
  });

  it("does not fetch the same path twice", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(404));
    await resolveBanner(
      makeRepo(),
      makeConfig({ bannerPaths: { "test-repo": "docs/images/banner.svg" } }),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("summarises many external references", async () => {
    const svg = `<svg>${[1, 2, 3, 4, 5].map((i) => `<image href="${i}.png"/>`).join("")}</svg>`;
    mockFetch.mockResolvedValueOnce(textResponse(200, svg));
    const result = await resolveBanner(makeRepo(), makeConfig());
    expect(result.problems[0]).toBe(
      "docs/images/banner.svg: not self-contained, it loads 1.png, 2.png, 3.png and 2 more",
    );
  });
});

describe("fetchPortfolioConfig", () => {
  async function importModule() {
    const mod = await import("./github.js");
    return mod;
  }

  it("returns parsed config from .ghost-portfolio.yml", async () => {
    const yamlContent = `
description: "Custom description"
homepage: "https://example.com/guide/"
siteLabel: "Guide"
bannerPath: "assets/banner.svg"
dockerImage: "user/image"
`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => yamlContent,
    });

    const { fetchPortfolioConfig } = await importModule();
    const result = await fetchPortfolioConfig(makeRepo());

    expect(result).not.toBeNull();
    expect(result).toEqual({
      description: "Custom description",
      homepage: "https://example.com/guide/",
      siteLabel: "Guide",
      bannerPath: "assets/banner.svg",
    });
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://raw.githubusercontent.com/user/test-repo/main/.ghost-portfolio.yml",
    );
  });

  it("returns null when file does not exist (404)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { fetchPortfolioConfig } = await importModule();
    const result = await fetchPortfolioConfig(makeRepo());

    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { fetchPortfolioConfig } = await importModule();
    const result = await fetchPortfolioConfig(makeRepo());

    expect(result).toBeNull();
  });

  it("returns null when YAML parses to non-object", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "just a string",
    });

    const { fetchPortfolioConfig } = await importModule();
    const result = await fetchPortfolioConfig(makeRepo());

    expect(result).toBeNull();
  });

  it("returns null when YAML parses to null", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    const { fetchPortfolioConfig } = await importModule();
    const result = await fetchPortfolioConfig(makeRepo());

    expect(result).toBeNull();
  });

  it("handles partial config with missing fields", async () => {
    const yamlContent = `
description: "Only description"
`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => yamlContent,
    });

    const { fetchPortfolioConfig } = await importModule();
    const result = await fetchPortfolioConfig(makeRepo());

    expect(result).not.toBeNull();
    expect(result!.description).toBe("Only description");
    expect(result!.homepage).toBeUndefined();
    expect(result!.bannerPath).toBeUndefined();
  });
});

