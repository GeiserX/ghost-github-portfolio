import { describe, it, expect } from "vitest";
import {
  generateCard,
  generateFooter,
  buildLexical,
} from "./generator.js";
import type { Config, GitHubRepo } from "./types.js";

const mockConfig: Config = {
  github: { username: "testuser" },
  ghost: {
    url: "https://blog.example.com",
    adminApiKey: "abc:def",
    pageSlug: "portfolio",
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
  },
};

const mockRepo: GitHubRepo = {
  name: "test-repo",
  full_name: "testuser/test-repo",
  html_url: "https://github.com/testuser/test-repo",
  description: "A test repository",
  stargazers_count: 42,
  forks_count: 5,
  license: { spdx_id: "GPL-3.0" },
  fork: false,
  homepage: null,
  topics: ["docker", "typescript"],
  language: "TypeScript",
  default_branch: "main",
};

describe("generateCard", () => {
  it("generates HTML with title and badges", () => {
    const html = generateCard(mockRepo, null, mockConfig);

    expect(html).toContain("test-repo");
    expect(html).toContain("github.com/testuser/test-repo");
    expect(html).toContain("img.shields.io/github/stars");
    expect(html).toContain("img.shields.io/github/forks");
    expect(html).toContain("img.shields.io/github/license");
    expect(html).toContain("A test repository");
    expect(html).toContain("<hr>");
  });

  it("includes banner when provided", () => {
    const banner = "https://raw.githubusercontent.com/testuser/test-repo/main/docs/images/banner.svg";
    const html = generateCard(mockRepo, banner, mockConfig);

    expect(html).toContain(banner);
    expect(html).toContain("banner");
    expect(html).toContain("border-radius:8px");
  });

  it("centers content when configured", () => {
    const html = generateCard(mockRepo, null, mockConfig);

    expect(html).toContain("text-align:center");
    expect(html).toContain("justify-content:center");
  });

  it("does not center when disabled", () => {
    const config = {
      ...mockConfig,
      portfolio: { ...mockConfig.portfolio, centerContent: false },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).not.toContain("text-align:center");
  });

  it("uses custom description from config override", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: { "test-repo": { description: "Custom desc" } },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("Custom desc");
    expect(html).not.toContain("A test repository");
  });

  it("adds docker badge from config", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: { "test-repo": { dockerImage: "drumsergio/test-repo" } },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("docker/pulls/drumsergio/test-repo");
    expect(html).toContain("hub.docker.com");
  });

  it("adds website badge from homepage", () => {
    const repo = { ...mockRepo, homepage: "https://test-repo.com" };
    const html = generateCard(repo, null, mockConfig);

    expect(html).toContain("test-repo.com");
    expect(html).toContain("website");
  });

  it("auto-detects awesome-list badge from topics", () => {
    const repo = { ...mockRepo, topics: ["awesome-list"] };
    const html = generateCard(repo, null, mockConfig);

    expect(html).toContain("awesome");
    expect(html).toContain("awesomelists");
  });

  it("infers tech stack from language and topics", () => {
    const html = generateCard(mockRepo, null, mockConfig);

    expect(html).toContain("TypeScript");
    expect(html).toContain("Docker");
  });

  it("escapes HTML in description", () => {
    const repo = {
      ...mockRepo,
      description: "Uses <script> & \"quotes\"",
    };
    const html = generateCard(repo, null, mockConfig);

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;quotes&quot;");
  });
});

describe("generateFooter", () => {
  it("generates stats footer", () => {
    const footer = generateFooter([mockRepo], mockConfig);

    expect(footer).toContain("GitHub Stats");
    expect(footer).toContain("42+");
    expect(footer).toContain("View All Repositories");
  });

  it("returns null when both options disabled", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        footer: { showStats: false, showViewAll: false },
      },
    };
    const footer = generateFooter([mockRepo], config);

    expect(footer).toBeNull();
  });
});

describe("buildLexical", () => {
  it("builds valid lexical document structure", () => {
    const doc = buildLexical(["<h3>Test</h3>"], "<h2>Footer</h2>");

    expect(doc.root.type).toBe("root");
    expect(doc.root.version).toBe(1);
    expect(doc.root.direction).toBe("ltr");
    expect(doc.root.children).toHaveLength(3); // hr + card + footer
    expect(doc.root.children[0].type).toBe("horizontalrule");
    expect(doc.root.children[1].type).toBe("html");
    expect(doc.root.children[2].type).toBe("html");
  });

  it("omits footer when null", () => {
    const doc = buildLexical(["<h3>Test</h3>"], null);

    expect(doc.root.children).toHaveLength(2); // hr + card
  });
});
