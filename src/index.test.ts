import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

// Mock all external dependencies before importing
vi.mock("./config.js", () => ({
  loadConfig: vi.fn(),
  generateExampleConfig: vi.fn(),
}));

vi.mock("./github.js", () => ({
  fetchRepos: vi.fn(),
  detectBanner: vi.fn(),
  fetchPortfolioConfig: vi.fn(),
}));

vi.mock("./ghost.js", () => ({
  fetchPage: vi.fn(),
  updatePage: vi.fn(),
}));

vi.mock("./generator.js", () => ({
  generateCard: vi.fn(),
  generateFooter: vi.fn(),
  buildLexical: vi.fn(),
}));

import type { Config, GitHubRepo } from "./types.js";

function makeConfig(): Config {
  return {
    github: { username: "testuser" },
    ghost: {
      url: "https://ghost.example.com",
      adminApiKey: "key:secret",
      pageSlug: "portfolio",
    },
    portfolio: {
      minStars: 2,
      maxRepos: 50,
      excludeRepos: [],
      includeForked: false,
      excludeAwesomeLists: false,
      badgeStyle: "for-the-badge",
      showBanner: true,
      centerContent: true,
      defaultBannerPath: "docs/images/banner.svg",
      bannerPaths: {},
      repos: {},
      footer: { showStats: true, showViewAll: true },
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
    homepage: null,
    topics: [],
    language: "TypeScript",
    default_branch: "main",
    ...overrides,
  };
}

describe("CLI sync command", () => {
  let loadConfig: ReturnType<typeof vi.fn>;
  let fetchRepos: ReturnType<typeof vi.fn>;
  let detectBanner: ReturnType<typeof vi.fn>;
  let fetchPortfolioConfig: ReturnType<typeof vi.fn>;
  let fetchPage: ReturnType<typeof vi.fn>;
  let updatePage: ReturnType<typeof vi.fn>;
  let generateCard: ReturnType<typeof vi.fn>;
  let generateFooter: ReturnType<typeof vi.fn>;
  let buildLexical: ReturnType<typeof vi.fn>;

  const tmpConfig = "/tmp/test-cli-config.yml";
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(async () => {
    vi.resetModules();

    const configMod = await import("./config.js");
    const githubMod = await import("./github.js");
    const ghostMod = await import("./ghost.js");
    const generatorMod = await import("./generator.js");

    loadConfig = configMod.loadConfig as ReturnType<typeof vi.fn>;
    fetchRepos = githubMod.fetchRepos as ReturnType<typeof vi.fn>;
    detectBanner = githubMod.detectBanner as ReturnType<typeof vi.fn>;
    fetchPortfolioConfig = githubMod.fetchPortfolioConfig as ReturnType<typeof vi.fn>;
    fetchPage = ghostMod.fetchPage as ReturnType<typeof vi.fn>;
    updatePage = ghostMod.updatePage as ReturnType<typeof vi.fn>;
    generateCard = generatorMod.generateCard as ReturnType<typeof vi.fn>;
    generateFooter = generatorMod.generateFooter as ReturnType<typeof vi.fn>;
    buildLexical = generatorMod.buildLexical as ReturnType<typeof vi.fn>;

    writeFileSync(tmpConfig, "dummy: true");
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    if (existsSync(tmpConfig)) unlinkSync(tmpConfig);
    vi.restoreAllMocks();
  });

  async function runCLI(args: string[]) {
    process.argv = ["node", "index.js", ...args];
    vi.resetModules();
    // Re-import to trigger commander parse
    await import("./index.js");
    // Allow any pending async work to complete
    await new Promise((r) => setTimeout(r, 50));
  }

  it("runs sync with --dry-run and outputs preview", async () => {
    const config = makeConfig();
    const repos = [makeRepo()];

    loadConfig.mockReturnValue(config);
    fetchRepos.mockResolvedValue(repos);
    detectBanner.mockResolvedValue(null);
    fetchPortfolioConfig.mockResolvedValue(null);
    generateCard.mockReturnValue("<h2>test-repo</h2>");
    generateFooter.mockReturnValue("<h2>Footer</h2>");
    buildLexical.mockReturnValue({ root: { children: [] } });

    await runCLI(["sync", "-c", tmpConfig, "--dry-run"]);

    expect(loadConfig).toHaveBeenCalledWith(tmpConfig);
    expect(fetchRepos).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Found 1 repos"));
  });

  it("runs sync with --json and outputs JSON", async () => {
    const config = makeConfig();
    const repos = [makeRepo()];
    const lexical = { root: { children: [], direction: "ltr", format: "", indent: 0, type: "root", version: 1 } };

    loadConfig.mockReturnValue(config);
    fetchRepos.mockResolvedValue(repos);
    detectBanner.mockResolvedValue(null);
    fetchPortfolioConfig.mockResolvedValue(null);
    generateCard.mockReturnValue("<h2>test-repo</h2>");
    generateFooter.mockReturnValue(null);
    buildLexical.mockReturnValue(lexical);

    await runCLI(["sync", "-c", tmpConfig, "--json"]);

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(lexical, null, 2));
  });

  it("runs sync and updates Ghost page", async () => {
    const config = makeConfig();
    const repos = [makeRepo()];
    const page = { id: "page1", updated_at: "2024-01-01", title: "Portfolio" };
    const updatedPage = { ...page, updated_at: "2024-01-02" };
    const lexical = { root: { children: [] } };

    loadConfig.mockReturnValue(config);
    fetchRepos.mockResolvedValue(repos);
    detectBanner.mockResolvedValue("https://example.com/banner.svg");
    fetchPortfolioConfig.mockResolvedValue(null);
    generateCard.mockReturnValue("<h2>test-repo</h2>");
    generateFooter.mockReturnValue("<h2>Footer</h2>");
    buildLexical.mockReturnValue(lexical);
    fetchPage.mockResolvedValue(page);
    updatePage.mockResolvedValue(updatedPage);

    await runCLI(["sync", "-c", tmpConfig]);

    expect(fetchPage).toHaveBeenCalled();
    expect(updatePage).toHaveBeenCalledWith(config, "page1", "2024-01-01", lexical);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Portfolio updated"));
  });

  it("handles sync with zero repos found", async () => {
    const config = makeConfig();

    loadConfig.mockReturnValue(config);
    fetchRepos.mockResolvedValue([]);

    await runCLI(["sync", "-c", tmpConfig]);

    expect(consoleSpy).toHaveBeenCalledWith("No repos found. Check your config.");
  });

  it("handles sync errors gracefully", async () => {
    loadConfig.mockImplementation(() => {
      throw new Error("Config file not found");
    });

    await runCLI(["sync", "-c", "/nonexistent/path.yml"]);

    expect(errorSpy).toHaveBeenCalledWith("Error: Config file not found");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("runs sync with --verbose flag", async () => {
    const config = makeConfig();
    const repos = [makeRepo()];

    loadConfig.mockReturnValue(config);
    fetchRepos.mockResolvedValue(repos);
    detectBanner.mockResolvedValue(null);
    fetchPortfolioConfig.mockResolvedValue(null);
    generateCard.mockReturnValue("<h2>test-repo</h2>");
    generateFooter.mockReturnValue(null);
    buildLexical.mockReturnValue({ root: { children: [] } });

    await runCLI(["sync", "-c", tmpConfig, "--dry-run", "-v"]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Fetching repos"));
  });

  it("merges per-repo portfolio config from .ghost-portfolio.yml", async () => {
    const config = makeConfig();
    const repos = [makeRepo()];
    const portfolioOverride = { description: "From repo file" };

    loadConfig.mockReturnValue(config);
    fetchRepos.mockResolvedValue(repos);
    detectBanner.mockResolvedValue(null);
    fetchPortfolioConfig.mockResolvedValue(portfolioOverride);
    generateCard.mockReturnValue("<h2>test-repo</h2>");
    generateFooter.mockReturnValue(null);
    buildLexical.mockReturnValue({ root: { children: [] } });

    await runCLI(["sync", "-c", tmpConfig, "--dry-run"]);

    // The config should have been mutated with the portfolio override
    expect(config.portfolio.repos["test-repo"]).toBeDefined();
    expect(config.portfolio.repos["test-repo"].description).toBe("From repo file");
  });

  it("filters awesome lists when excludeAwesomeLists is true", async () => {
    const config = makeConfig();
    config.portfolio.excludeAwesomeLists = true;
    const repos = [
      makeRepo({ name: "awesome-spain", stargazers_count: 10, topics: ["awesome-list"] }),
      makeRepo({ name: "normal-repo", stargazers_count: 10 }),
    ];

    loadConfig.mockReturnValue(config);
    fetchRepos.mockResolvedValue(repos);
    detectBanner.mockResolvedValue(null);
    fetchPortfolioConfig.mockResolvedValue(null);
    generateCard.mockReturnValue("<h2>card</h2>");
    generateFooter.mockReturnValue(null);
    buildLexical.mockReturnValue({ root: { children: [] } });

    await runCLI(["sync", "-c", tmpConfig, "--dry-run"]);

    // generateCard should only be called for non-awesome repos
    expect(generateCard).toHaveBeenCalledTimes(1);
  });
});

describe("CLI init command", () => {
  let generateExampleConfig: ReturnType<typeof vi.fn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];
  const outputPath = "/tmp/test-init-config.yml";

  beforeEach(async () => {
    vi.resetModules();
    const configMod = await import("./config.js");
    generateExampleConfig = configMod.generateExampleConfig as ReturnType<typeof vi.fn>;
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

    expect(existsSync(outputPath)).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Example config written"));
  });
});
