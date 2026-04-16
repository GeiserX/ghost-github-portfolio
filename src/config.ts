import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Config, PortfolioConfig } from "./types.js";

const DEFAULT_PORTFOLIO: PortfolioConfig = {
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
};

export function loadConfig(path: string): Config {
  const raw = readFileSync(path, "utf-8");
  const parsed = parse(raw) as Record<string, unknown>;

  if (!parsed.github || !(parsed.github as Record<string, unknown>).username) {
    throw new Error("Config: github.username is required");
  }
  if (!parsed.ghost || !(parsed.ghost as Record<string, unknown>).url) {
    throw new Error("Config: ghost.url is required");
  }
  if (!(parsed.ghost as Record<string, unknown>).adminApiKey) {
    throw new Error("Config: ghost.adminApiKey is required");
  }

  const ghost = parsed.ghost as Record<string, unknown>;
  if (!ghost.pageId && !ghost.pageSlug) {
    throw new Error("Config: ghost.pageId or ghost.pageSlug is required");
  }

  const github = parsed.github as Record<string, string>;
  const portfolio = (parsed.portfolio ?? {}) as Partial<PortfolioConfig>;

  // Env var overrides (GHOST_GITHUB_TOKEN only — GITHUB_TOKEN is not used to
  // avoid picking up unrelated tokens from gh CLI or CI environments)
  const ghToken = github.token ?? process.env.GHOST_GITHUB_TOKEN;
  const ghostKey =
    (ghost.adminApiKey as string) ?? process.env.GHOST_ADMIN_API_KEY;

  return {
    github: {
      username: github.username,
      token: ghToken,
    },
    ghost: {
      url: (ghost.url as string).replace(/\/$/, ""),
      adminApiKey: ghostKey,
      pageId: ghost.pageId as string | undefined,
      pageSlug: ghost.pageSlug as string | undefined,
    },
    portfolio: {
      ...DEFAULT_PORTFOLIO,
      ...portfolio,
      footer: { ...DEFAULT_PORTFOLIO.footer, ...portfolio.footer },
      bannerPaths: {
        ...DEFAULT_PORTFOLIO.bannerPaths,
        ...portfolio.bannerPaths,
      },
      repos: { ...DEFAULT_PORTFOLIO.repos, ...portfolio.repos },
    },
  };
}

export function generateExampleConfig(): string {
  return `# ghost-github-portfolio configuration
github:
  username: YOUR_GITHUB_USERNAME
  # token: ghp_xxx  # Optional: for private repos or higher rate limits (env: GHOST_GITHUB_TOKEN)

ghost:
  url: https://your-ghost-blog.com
  adminApiKey: "KEY_ID:SECRET_HEX"  # From Ghost Admin > Integrations (env: GHOST_ADMIN_API_KEY)
  pageSlug: portfolio               # Update this page (or use pageId for the hex ID)

portfolio:
  minStars: 2          # Only show repos with at least this many stars
  maxRepos: 50         # Maximum number of repos to display
  includeForked: false # Skip forked repos
  excludeAwesomeLists: false # Skip repos starting with "awesome" or tagged "awesome-list"
  badgeStyle: for-the-badge  # shields.io style: flat, flat-square, for-the-badge, plastic, social
  showBanner: true     # Show repo banner images (SVG/PNG from the repo)
  centerContent: true  # Center project names and badges

  defaultBannerPath: docs/images/banner.svg  # Default location to look for banners

  # Override banner path for specific repos
  bannerPaths:
    # awesome-spain: media/banner.svg

  excludeRepos:
    - .github          # Profile config repo
    # - my-private-project

  # Per-repo overrides
  repos: {}
    # my-project:
    #   description: "Custom description (overrides GitHub)"
    #   dockerImage: drumsergio/my-project  # Adds Docker pulls badge
    #   techStack: "Python, Docker, Redis"
    #   bannerPath: assets/banner.png
    #   badges:
    #     - type: website
    #       url: https://my-project.com
    #     - type: awesome-list
    #     - type: platform
    #       label: macOS
    #       logo: apple
    #     - type: docs
    #       url: https://docs.my-project.com
    #     - type: custom
    #       label: MCP
    #       value: Official Registry
    #       color: E6522C

  footer:
    showStats: true    # Show total stars and repo count
    showViewAll: true  # Show "View All Repositories" link
`;
}
