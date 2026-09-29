import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";

// Mock the network-facing modules; the generator runs for real.
vi.mock("./config.js", () => ({
  loadConfig: vi.fn(),
  generateExampleConfig: vi.fn(),
}));

vi.mock("./github.js", () => ({
  fetchAllRepos: vi.fn(),
  selectRepos: vi.fn(),
  resolveBanner: vi.fn(),
  fetchPortfolioConfig: vi.fn(),
}));

vi.mock("./ghost.js", () => ({
  fetchPage: vi.fn(),
  updatePage: vi.fn(),
}));

import type { Config, GitHubRepo } from "./types.js";

function makeConfig(): Config {
  return {
    github: { username: "testuser", excludePatterns: [] },
    ghost: {
      url: "https://ghost.example.com",
      adminApiKey: "key:secret",
      pageSlug: "portfolio",
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
      intro: "Intro.",
      repos: {},
    },
  };
}

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: "test-repo",
    full_name: "testuser/test-repo",
    html_url: "https://github.com/testuser/test-repo",
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

type Mock = ReturnType<typeof vi.fn>;

describe("CLI sync command", () => {
  let loadConfig: Mock;
  let fetchAllRepos: Mock;
  let selectRepos: Mock;
  let resolveBanner: Mock;
  let fetchPortfolioConfig: Mock;
  let fetchPage: Mock;
  let updatePage: Mock;

  const tmpConfig = "/tmp/test-cli-config.yml";
  const htmlOut = "/tmp/test-cli-preview.html";
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(async () => {
    vi.resetModules();

    const configMod = await import("./config.js");
    const githubMod = await import("./github.js");
    const ghostMod = await import("./ghost.js");

    loadConfig = configMod.loadConfig as Mock;
    fetchAllRepos = githubMod.fetchAllRepos as Mock;
    selectRepos = githubMod.selectRepos as Mock;
    resolveBanner = githubMod.resolveBanner as Mock;
    fetchPortfolioConfig = githubMod.fetchPortfolioConfig as Mock;
    fetchPage = ghostMod.fetchPage as Mock;
    updatePage = ghostMod.updatePage as Mock;

    resolveBanner.mockResolvedValue({ url: null, problems: [] });
    fetchPortfolioConfig.mockResolvedValue(null);

    writeFileSync(tmpConfig, "dummy: true");
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
    for (const f of [tmpConfig, htmlOut]) if (existsSync(f)) unlinkSync(f);
  });

  async function runCLI(args: string[]) {
    process.argv = ["node", "index.js", ...args];
    vi.resetModules();
    await import("./index.js");
    await new Promise((r) => setTimeout(r, 50));
  }

  function logged(): string {
    return consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
  }

  it("runs a dry run and lists banners and tiles", async () => {
    const repos = [makeRepo({ name: "a" }), makeRepo({ name: "b" })];
    loadConfig.mockReturnValue(makeConfig());
    fetchAllRepos.mockResolvedValue([...repos, makeRepo({ name: "c" })]);
    selectRepos.mockReturnValue(repos);
    resolveBanner
      .mockResolvedValueOnce({ url: "https://x/banner.svg", problems: [] })
      .mockResolvedValueOnce({ url: null, problems: ["docs/images/banner.svg: missing (HTTP 404)"] });

    await runCLI(["sync", "-c", tmpConfig, "--dry-run"]);

    expect(loadConfig).toHaveBeenCalledWith(tmpConfig);
    expect(logged()).toContain("Found 3 public repos, showing 2");
    expect(logged()).toContain("a (10 stars) [banner]");
    expect(logged()).toContain("b (10 stars) [tile]");
    expect(warnSpy).toHaveBeenCalledWith(
      "Warning: b gets a name tile: docs/images/banner.svg: missing (HTTP 404)",
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(updatePage).not.toHaveBeenCalled();
    const card = readFileSync("/tmp/ghost-portfolio-preview.html", "utf-8");
    expect(card.startsWith("<!--kg-card-begin: html-->")).toBe(true);
    expect(card.match(/<li class="pf-card">/g)).toHaveLength(2);
  });

  it("prints the lexical JSON with one html card", async () => {
    loadConfig.mockReturnValue(makeConfig());
    fetchAllRepos.mockResolvedValue([makeRepo()]);
    selectRepos.mockReturnValue([makeRepo()]);

    await runCLI(["sync", "-c", tmpConfig, "--json"]);

    const out = consoleSpy.mock.calls.map((c) => c[0]).find((s) => String(s).startsWith("{"));
    const doc = JSON.parse(String(out));
    expect(doc.root.children).toHaveLength(1);
    expect(doc.root.children[0].type).toBe("html");
    expect(doc.root.children[0].html).toContain('<ul class="pf-grid pf-cols-3">');
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("writes a preview page with --html-out and does not touch Ghost", async () => {
    loadConfig.mockReturnValue(makeConfig());
    fetchAllRepos.mockResolvedValue([makeRepo()]);
    selectRepos.mockReturnValue([makeRepo()]);

    await runCLI(["sync", "-c", tmpConfig, "--html-out", htmlOut]);

    const page = readFileSync(htmlOut, "utf-8");
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain('<li class="pf-card">');
    expect(fetchPage).not.toHaveBeenCalled();
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("updates the Ghost page with a single html card", async () => {
    const config = makeConfig();
    const page = { id: "page1", updated_at: "2024-01-01", title: "Portfolio" };
    loadConfig.mockReturnValue(config);
    fetchAllRepos.mockResolvedValue([makeRepo()]);
    selectRepos.mockReturnValue([makeRepo()]);
    resolveBanner.mockResolvedValue({ url: "https://x/banner.svg", problems: [] });
    fetchPage.mockResolvedValue(page);
    updatePage.mockResolvedValue({ ...page, updated_at: "2024-01-02" });

    await runCLI(["sync", "-c", tmpConfig]);

    expect(updatePage).toHaveBeenCalledTimes(1);
    const [cfg, id, updatedAt, lexical] = updatePage.mock.calls[0];
    expect(cfg).toBe(config);
    expect(id).toBe("page1");
    expect(updatedAt).toBe("2024-01-01");
    expect(lexical.root.children).toHaveLength(1);
    expect(lexical.root.children[0].html).toContain('<img src="https://x/banner.svg"');
    expect(logged()).toContain("Portfolio updated: Portfolio");
    expect(logged()).toContain("1 banners, 0 tiles");
  });

  it("handles zero repos", async () => {
    loadConfig.mockReturnValue(makeConfig());
    fetchAllRepos.mockResolvedValue([]);
    selectRepos.mockReturnValue([]);

    await runCLI(["sync", "-c", tmpConfig]);

    expect(consoleSpy).toHaveBeenCalledWith("No repos found. Check your config.");
    expect(resolveBanner).not.toHaveBeenCalled();
  });

  it("handles errors with exit code 1", async () => {
    loadConfig.mockImplementation(() => {
      throw new Error("Config file not found");
    });

    await runCLI(["sync", "-c", "/nonexistent/path.yml"]);

    expect(errorSpy).toHaveBeenCalledWith("Error: Config file not found");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs progress with --verbose", async () => {
    loadConfig.mockReturnValue(makeConfig());
    fetchAllRepos.mockResolvedValue([makeRepo()]);
    selectRepos.mockReturnValue([makeRepo()]);
    fetchPortfolioConfig.mockResolvedValue({ description: "From file" });

    await runCLI(["sync", "-c", tmpConfig, "--dry-run", "-v"]);

    expect(logged()).toContain("Fetching repos");
    expect(logged()).toContain("test-repo: loaded .ghost-portfolio.yml");
    expect(logged()).toContain("Checking banners");
  });

  it("merges .ghost-portfolio.yml under config.yml and before the banner check", async () => {
    const config = makeConfig();
    config.portfolio.repos["test-repo"] = { description: "From config" };
    loadConfig.mockReturnValue(config);
    fetchAllRepos.mockResolvedValue([makeRepo()]);
    selectRepos.mockReturnValue([makeRepo()]);
    fetchPortfolioConfig.mockResolvedValue({
      description: "From repo file",
      bannerPath: "media/banner.svg",
      homepage: undefined,
    });
    let bannerPathAtCheck: string | undefined;
    resolveBanner.mockImplementation(async (_repo, cfg: Config) => {
      bannerPathAtCheck = cfg.portfolio.repos["test-repo"].bannerPath;
      return { url: null, problems: [] };
    });

    await runCLI(["sync", "-c", tmpConfig, "--dry-run"]);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(resolveBanner).toHaveBeenCalledTimes(1);
    expect(bannerPathAtCheck).toBe("media/banner.svg");
    expect(config.portfolio.repos["test-repo"]).toEqual({
      description: "From config",
      bannerPath: "media/banner.svg",
    });
  });

  it("cleans a .ghost-portfolio.yml description like a GitHub one", async () => {
    const repo = makeRepo({ description: "GitHub text" });
    loadConfig.mockReturnValue(makeConfig());
    fetchAllRepos.mockResolvedValue([repo]);
    selectRepos.mockReturnValue([repo]);
    fetchPortfolioConfig.mockResolvedValue({
      description: "Manage docs through Telegram \u2014 upload and tag. A second sentence.",
    });

    await runCLI(["sync", "-c", tmpConfig, "--json"]);

    const out = consoleSpy.mock.calls.map((c) => c[0]).find((s) => String(s).startsWith("{"));
    const html = JSON.parse(String(out)).root.children[0].html;
    expect(html).toContain('<p class="pf-line">Manage docs through Telegram, upload and tag.</p>');
    expect(html).not.toContain("GitHub text");
  });
});

describe("CLI init command", () => {
  let generateExampleConfig: Mock;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];
  const outputPath = "/tmp/test-init-config.yml";

  beforeEach(async () => {
    vi.resetModules();
    const configMod = await import("./config.js");
    generateExampleConfig = configMod.generateExampleConfig as Mock;
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
    consoleSpy.mockRestore();
    if (existsSync(outputPath)) unlinkSync(outputPath);
    vi.restoreAllMocks();
  });

  it("generates example config to specified output", async () => {
    generateExampleConfig.mockReturnValue("github:\n  username: test\n");

    process.argv = ["node", "index.js", "init", "-o", outputPath];
    vi.resetModules();
    await import("./index.js");
    await new Promise((r) => setTimeout(r, 50));

    expect(readFileSync(outputPath, "utf-8")).toBe("github:\n  username: test\n");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Example config written"));
  });
});
