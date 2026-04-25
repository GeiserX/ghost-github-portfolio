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

  it("renders personalNote from config override", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: { "test-repo": { personalNote: "My favorite project" } },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("My favorite project");
  });

  it("renders keyFeatures list from config override", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            keyFeatures: ["Feature A", "Feature B"],
          },
        },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("Key Features:");
    expect(html).toContain("<li>Feature A</li>");
    expect(html).toContain("<li>Feature B</li>");
  });

  it("uses techStack override from config", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: { "test-repo": { techStack: "Rust, WASM" } },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("Rust, WASM");
    expect(html).not.toContain("TypeScript");
  });

  it("renders custom badge type 'docker'", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            badges: [{ type: "docker" as const, label: "myuser/myimage" }],
          },
        },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("hub.docker.com/r/myuser/myimage");
    expect(html).toContain("docker/pulls/myuser/myimage");
  });

  it("renders custom badge type 'platform'", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            badges: [
              { type: "platform" as const, label: "macOS", color: "000", logo: "apple" },
            ],
          },
        },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("platform");
    expect(html).toContain("macOS");
    expect(html).toContain("apple");
  });

  it("renders custom badge type 'docs'", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            badges: [{ type: "docs" as const, url: "https://docs.example.com" }],
          },
        },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("https://docs.example.com");
    expect(html).toContain("docs");
  });

  it("renders custom badge type 'custom'", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            badges: [
              { type: "custom" as const, label: "MCP", value: "Official", color: "E6522C" },
            ],
          },
        },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("MCP");
    expect(html).toContain("Official");
    expect(html).toContain("E6522C");
  });

  it("renders custom badge type 'website' with explicit url and label", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            badges: [
              { type: "website" as const, url: "https://my-site.com", label: "MySite" },
            ],
          },
        },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("https://my-site.com");
    expect(html).toContain("MySite");
  });

  it("renders custom badge type 'awesome-list'", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            badges: [{ type: "awesome-list" as const, color: "ff0000" }],
          },
        },
      },
    };
    const html = generateCard(mockRepo, null, config);

    expect(html).toContain("awesome");
    expect(html).toContain("ff0000");
  });

  it("skips auto awesome-list badge when already in custom badges", () => {
    const repo = { ...mockRepo, topics: ["awesome-list"] };
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            badges: [{ type: "awesome-list" as const }],
          },
        },
      },
    };
    const html = generateCard(repo, null, config);

    // Should have exactly one awesome badge (from custom), not two
    const matches = html.match(/awesomelists/g);
    expect(matches).toHaveLength(1);
  });

  it("adds docs badge for github.io homepage", () => {
    const repo = { ...mockRepo, homepage: "https://testuser.github.io/test-repo" };
    const html = generateCard(repo, null, mockConfig);

    expect(html).toContain("docs");
    expect(html).toContain("testuser.github.io");
  });

  it("skips docs badge when already in custom badges", () => {
    const repo = { ...mockRepo, homepage: "https://testuser.github.io/test-repo" };
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        repos: {
          "test-repo": {
            badges: [{ type: "docs" as const, url: "https://docs.example.com" }],
          },
        },
      },
    };
    const html = generateCard(repo, null, config);

    // Custom docs badge URL should appear, not the auto-detected one
    expect(html).toContain("https://docs.example.com");
  });

  it("skips website badge for docker hub homepage", () => {
    const repo = { ...mockRepo, homepage: "https://hub.docker.com/r/myuser/myimage" };
    const html = generateCard(repo, null, mockConfig);

    expect(html).not.toContain("website");
  });

  it("skips license badge when no license", () => {
    const repo = { ...mockRepo, license: null };
    const html = generateCard(repo, null, mockConfig);

    expect(html).not.toContain("github/license");
  });

  it("returns null tech stack when no language or relevant topics", () => {
    const repo = { ...mockRepo, language: null, topics: [] };
    const html = generateCard(repo, null, mockConfig);

    expect(html).not.toContain("Tech Stack:");
  });

  it("shows no description when repo has none and no override", () => {
    const repo = { ...mockRepo, description: null };
    const html = generateCard(repo, null, mockConfig);

    expect(html).not.toContain("<em>");
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

  it("shows only viewAll link when showStats is false", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        footer: { showStats: false, showViewAll: true },
      },
    };
    const footer = generateFooter([mockRepo], config);

    expect(footer).toContain("View All Repositories");
    expect(footer).not.toContain("Total Stars");
  });

  it("shows stats without viewAll when showViewAll is false", () => {
    const config = {
      ...mockConfig,
      portfolio: {
        ...mockConfig.portfolio,
        footer: { showStats: true, showViewAll: false },
      },
    };
    const footer = generateFooter([mockRepo], config);

    expect(footer).toContain("42+");
    expect(footer).not.toContain("View All Repositories");
  });

  it("aggregates stats across multiple repos", () => {
    const repos = [
      mockRepo,
      { ...mockRepo, name: "repo2", stargazers_count: 10, language: "Python", topics: ["flask"] },
    ];
    const footer = generateFooter(repos, mockConfig);

    expect(footer).toContain("52+"); // 42 + 10
    expect(footer).toContain("2"); // 2 repos
    expect(footer).toContain("TypeScript");
    expect(footer).toContain("Python");
  });

  it("shows focus areas from topic counts", () => {
    const repos = [
      { ...mockRepo, topics: ["docker", "kubernetes"] },
      { ...mockRepo, name: "r2", topics: ["docker", "terraform"] },
    ];
    const footer = generateFooter(repos, mockConfig);

    expect(footer).toContain("Docker");
  });

  it("shows no languages line when none present", () => {
    const repos = [{ ...mockRepo, language: null, topics: [] }];
    const footer = generateFooter(repos, mockConfig);

    expect(footer).not.toContain("Primary Languages");
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
