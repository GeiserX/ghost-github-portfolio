import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { parse } from "yaml";
import { loadConfig, generateExampleConfig, DEFAULT_INTRO } from "./config.js";

const VALID_CONFIG = `
github:
  username: testuser
ghost:
  url: https://blog.example.com
  adminApiKey: "abc123:def456"
  pageSlug: portfolio
portfolio:
  minStars: 5
`;

const MINIMAL_CONFIG = `
github:
  username: testuser
ghost:
  url: https://blog.example.com
  adminApiKey: "abc123:def456"
  pageId: "abc123def456"
`;

describe("loadConfig", () => {
  const tmpPath = "/tmp/test-config.yml";
  const savedKey = process.env.GHOST_ADMIN_API_KEY;

  afterEach(() => {
    if (savedKey === undefined) delete process.env.GHOST_ADMIN_API_KEY;
    else process.env.GHOST_ADMIN_API_KEY = savedKey;
  });

  function load(yaml: string) {
    writeFileSync(tmpPath, yaml);
    try {
      return loadConfig(tmpPath);
    } finally {
      unlinkSync(tmpPath);
    }
  }

  it("lets GHOST_ADMIN_API_KEY override the config value", () => {
    process.env.GHOST_ADMIN_API_KEY = "envkey:0011";
    expect(load(VALID_CONFIG).ghost.adminApiKey).toBe("envkey:0011");
  });

  it("uses the config key when GHOST_ADMIN_API_KEY is unset or empty", () => {
    delete process.env.GHOST_ADMIN_API_KEY;
    expect(load(VALID_CONFIG).ghost.adminApiKey).toBe("abc123:def456");
    process.env.GHOST_ADMIN_API_KEY = "";
    expect(load(VALID_CONFIG).ghost.adminApiKey).toBe("abc123:def456");
  });

  it("accepts a key from the environment alone", () => {
    process.env.GHOST_ADMIN_API_KEY = "envkey:0011";
    const config = load(`github:\n  username: x\nghost:\n  url: https://x.com\n  pageSlug: p`);
    expect(config.ghost.adminApiKey).toBe("envkey:0011");
  });

  it("reads originUrl and hostHeader, trimming the slash", () => {
    const config = load(
      VALID_CONFIG.replace(
        "pageSlug: portfolio",
        "pageSlug: portfolio\n  originUrl: http://geiserback:8080/\n  hostHeader: blog.example.com",
      ),
    );
    expect(config.ghost.originUrl).toBe("http://geiserback:8080");
    expect(config.ghost.hostHeader).toBe("blog.example.com");
  });

  it("reads excludePatterns and rejects invalid ones", () => {
    const withPatterns = (p: string) =>
      VALID_CONFIG.replace("username: testuser", `username: testuser\n  excludePatterns: ${p}`);
    expect(load(withPatterns('["^test-", "-old$"]')).github.excludePatterns).toEqual(["^test-", "-old$"]);
    expect(load(withPatterns("[]")).github.excludePatterns).toEqual([]);
    expect(() => load(withPatterns('["("]'))).toThrow("invalid pattern: (");
    expect(() => load(withPatterns("nope"))).toThrow("must be a list");
  });

  it("validates columns and maxRepos", () => {
    const withPortfolio = (line: string) => VALID_CONFIG.replace("minStars: 5", line);
    expect(load(withPortfolio("columns: 2")).portfolio.columns).toBe(2);
    expect(() => load(withPortfolio("columns: 0"))).toThrow("portfolio.columns");
    expect(() => load(withPortfolio("columns: 2.5"))).toThrow("portfolio.columns");
    expect(() => load(withPortfolio("columns: 7"))).toThrow("portfolio.columns");
    expect(() => load(withPortfolio("maxRepos: 0"))).toThrow("portfolio.maxRepos");
  });

  it("keeps per-repo overrides and banner paths", () => {
    const config = load(
      VALID_CONFIG.replace(
        "minStars: 5",
        "minStars: 5\n  bannerPaths:\n    a: media/banner.svg\n  repos:\n    b:\n      siteLabel: Guide",
      ),
    );
    expect(config.portfolio.bannerPaths).toEqual({ a: "media/banner.svg" });
    expect(config.portfolio.repos.b.siteLabel).toBe("Guide");
  });

  it("throws on an empty file", () => {
    expect(() => load("")).toThrow("github.username");
  });

  it("loads a valid config with defaults", () => {
    writeFileSync(tmpPath, VALID_CONFIG);
    const config = loadConfig(tmpPath);

    expect(config.github.username).toBe("testuser");
    expect(config.ghost.url).toBe("https://blog.example.com");
    expect(config.ghost.adminApiKey).toBe("abc123:def456");
    expect(config.ghost.pageSlug).toBe("portfolio");
    expect(config.portfolio.minStars).toBe(5);
    expect(config.portfolio.maxRepos).toBe(20);
    expect(config.portfolio.columns).toBe(3);
    expect(config.portfolio.excludeAwesomeLists).toBe(true);
    expect(config.portfolio.includeArchived).toBe(false);
    expect(config.portfolio.showBanner).toBe(true);
    expect(config.portfolio.intro).toBe(DEFAULT_INTRO);
    expect(config.github.excludePatterns).toEqual(["^homebrew-"]);
    expect(config.ghost.originUrl).toBeUndefined();
    expect(config.ghost.hostHeader).toBeUndefined();

    unlinkSync(tmpPath);
  });

  it("loads minimal config with all defaults", () => {
    writeFileSync(tmpPath, MINIMAL_CONFIG);
    const config = loadConfig(tmpPath);

    expect(config.portfolio.minStars).toBe(2);
    expect(config.portfolio.excludeRepos).toEqual([]);
    expect(config.portfolio.includeForked).toBe(false);

    unlinkSync(tmpPath);
  });

  it("strips trailing slash from ghost url", () => {
    writeFileSync(
      tmpPath,
      VALID_CONFIG.replace(
        "https://blog.example.com",
        "https://blog.example.com/",
      ),
    );
    const config = loadConfig(tmpPath);
    expect(config.ghost.url).toBe("https://blog.example.com");
    unlinkSync(tmpPath);
  });

  it("throws on missing github.username", () => {
    writeFileSync(
      tmpPath,
      `ghost:\n  url: https://x.com\n  adminApiKey: "a:b"\n  pageSlug: p`,
    );
    expect(() => loadConfig(tmpPath)).toThrow("github.username");
    unlinkSync(tmpPath);
  });

  it("throws on missing ghost.url", () => {
    writeFileSync(
      tmpPath,
      `github:\n  username: x\nghost:\n  adminApiKey: "a:b"\n  pageSlug: p`,
    );
    expect(() => loadConfig(tmpPath)).toThrow("ghost.url");
    unlinkSync(tmpPath);
  });

  it("throws on missing ghost.adminApiKey", () => {
    delete process.env.GHOST_ADMIN_API_KEY;
    writeFileSync(
      tmpPath,
      `github:\n  username: x\nghost:\n  url: https://x.com\n  pageSlug: p`,
    );
    expect(() => loadConfig(tmpPath)).toThrow("ghost.adminApiKey");
    unlinkSync(tmpPath);
  });

  it("throws on missing pageId and pageSlug", () => {
    writeFileSync(
      tmpPath,
      `github:\n  username: x\nghost:\n  url: https://x.com\n  adminApiKey: "a:b"`,
    );
    expect(() => loadConfig(tmpPath)).toThrow("pageId or ghost.pageSlug");
    unlinkSync(tmpPath);
  });
});

describe("generateExampleConfig", () => {
  it("returns valid YAML content", () => {
    const config = generateExampleConfig();
    expect(config).toContain("github:");
    expect(config).toContain("ghost:");
    expect(config).toContain("portfolio:");
    expect(config).toContain("minStars:");
    expect(config).toContain("adminApiKey:");
  });

  it("parses to the documented defaults", () => {
    const parsed = parse(generateExampleConfig());
    expect(parsed.portfolio.maxRepos).toBe(20);
    expect(parsed.portfolio.columns).toBe(3);
    expect(parsed.portfolio.excludeAwesomeLists).toBe(true);
    expect(parsed.portfolio.includeArchived).toBe(false);
    expect(parsed.portfolio.intro).toBe(DEFAULT_INTRO);
    expect(parsed.github.excludePatterns).toEqual(["^homebrew-"]);
  });
});
