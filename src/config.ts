import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Config, PortfolioConfig } from "./types.js";

export const DEFAULT_INTRO =
  "I build things nobody asked for, one repo at a time. These are the ones that got the most stars on GitHub, with a line on what each one does.";

export const DEFAULT_EXCLUDE_PATTERNS = ["^homebrew-"];

const DEFAULT_PORTFOLIO: PortfolioConfig = {
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
  intro: DEFAULT_INTRO,
  repos: {},
};

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function loadConfig(path: string): Config {
  const raw = readFileSync(path, "utf-8");
  const parsed = (parse(raw) ?? {}) as Record<string, unknown>;

  const github = (parsed.github ?? {}) as Record<string, unknown>;
  const ghost = (parsed.ghost ?? {}) as Record<string, unknown>;

  if (!github.username) {
    throw new Error("Config: github.username is required");
  }
  if (!ghost.url) {
    throw new Error("Config: ghost.url is required");
  }

  // The environment wins over the config file, so the key can stay out of it.
  const ghostKey =
    process.env.GHOST_ADMIN_API_KEY || (ghost.adminApiKey as string | undefined);
  if (!ghostKey) {
    throw new Error(
      "Config: ghost.adminApiKey is required (or set GHOST_ADMIN_API_KEY)",
    );
  }
  if (!ghost.pageId && !ghost.pageSlug) {
    throw new Error("Config: ghost.pageId or ghost.pageSlug is required");
  }

  // GHOST_GITHUB_TOKEN only. GITHUB_TOKEN is not used, to avoid picking up
  // unrelated tokens from the gh CLI or CI environments.
  const ghToken =
    (github.token as string | undefined) ?? process.env.GHOST_GITHUB_TOKEN;

  const excludePatterns = (github.excludePatterns ??
    DEFAULT_EXCLUDE_PATTERNS) as unknown;
  if (!Array.isArray(excludePatterns)) {
    throw new Error("Config: github.excludePatterns must be a list");
  }
  for (const pattern of excludePatterns) {
    try {
      new RegExp(String(pattern), "i");
    } catch {
      throw new Error(
        `Config: github.excludePatterns has an invalid pattern: ${pattern}`,
      );
    }
  }

  const portfolio = (parsed.portfolio ?? {}) as Partial<PortfolioConfig>;
  const merged: PortfolioConfig = {
    ...DEFAULT_PORTFOLIO,
    ...portfolio,
    bannerPaths: { ...portfolio.bannerPaths },
    repos: { ...portfolio.repos },
    excludeRepos: portfolio.excludeRepos ?? [],
  };

  if (!Number.isInteger(merged.columns) || merged.columns < 1 || merged.columns > 6) {
    throw new Error("Config: portfolio.columns must be a whole number from 1 to 6");
  }
  if (!Number.isInteger(merged.maxRepos) || merged.maxRepos < 1) {
    throw new Error("Config: portfolio.maxRepos must be a whole number above 0");
  }

  return {
    github: {
      username: github.username as string,
      token: ghToken,
      excludePatterns: excludePatterns.map(String),
    },
    ghost: {
      url: trimSlash(ghost.url as string),
      adminApiKey: ghostKey,
      pageId: ghost.pageId as string | undefined,
      pageSlug: ghost.pageSlug as string | undefined,
      originUrl: ghost.originUrl ? validateOriginUrl(ghost.originUrl as string) : undefined,
      hostHeader: ghost.hostHeader as string | undefined,
    },
    portfolio: merged,
  };
}

/** The origin route carries the Admin key in a JWT, so the scheme must be plain http: or https:. */
function validateOriginUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Config: ghost.originUrl must be a full URL such as http://ghost:2368");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Config: ghost.originUrl must start with http:// or https://");
  }
  return trimSlash(value);
}

export function generateExampleConfig(): string {
  return `# ghost-github-portfolio configuration
github:
  username: YOUR_GITHUB_USERNAME
  # token: ghp_xxx          # Optional, for higher rate limits (env: GHOST_GITHUB_TOKEN)
  excludePatterns:          # Regular expressions matched against repo names
    - "^homebrew-"

ghost:
  url: https://your-ghost-blog.com
  adminApiKey: "KEY_ID:SECRET_HEX"  # Ghost Admin > Integrations (env GHOST_ADMIN_API_KEY wins)
  pageSlug: portfolio               # Or pageId with the page's hex ID
  # originUrl: http://ghost:2368    # Send Admin API requests straight to the Ghost origin
  # hostHeader: your-ghost-blog.com # Host header for originUrl (defaults to the host of url)

portfolio:
  minStars: 2               # Only repos with at least this many stars
  maxRepos: 20              # How many cards to show, counted after every filter
  columns: 3                # Cards per row on desktop (two on tablets, one on phones)
  includeForked: false
  includeArchived: false
  excludeAwesomeLists: true # Skip repos named "awesome*" or tagged "awesome-list"
  showBanner: true          # Use the repo banner when it passes the checks, else a name tile
  defaultBannerPath: docs/images/banner.svg

  intro: "${DEFAULT_INTRO}"

  # Banner path for specific repos, tried before defaultBannerPath
  bannerPaths: {}
    # my-project: media/banner.svg

  excludeRepos:
    - .github

  # Per-repo overrides
  repos: {}
    # my-project:
    #   description: "One line that replaces the GitHub description"
    #   homepage: https://example.com/guide/  # Replaces the GitHub homepage field
    #   siteLabel: Guide                      # Link text, defaults to "Site"
    #   bannerPath: assets/banner.png
    #   exclude: false
`;
}
