import { describe, it, expect } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { loadConfig, generateExampleConfig } from "./config.js";

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

  it("loads a valid config with defaults", () => {
    writeFileSync(tmpPath, VALID_CONFIG);
    const config = loadConfig(tmpPath);

    expect(config.github.username).toBe("testuser");
    expect(config.ghost.url).toBe("https://blog.example.com");
    expect(config.ghost.adminApiKey).toBe("abc123:def456");
    expect(config.ghost.pageSlug).toBe("portfolio");
    expect(config.portfolio.minStars).toBe(5);
    expect(config.portfolio.maxRepos).toBe(50);
    expect(config.portfolio.badgeStyle).toBe("for-the-badge");
    expect(config.portfolio.showBanner).toBe(true);
    expect(config.portfolio.centerContent).toBe(true);
    expect(config.portfolio.footer.showStats).toBe(true);

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
});
