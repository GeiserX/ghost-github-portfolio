import type { Config, GitHubRepo, RepoOverride } from "./types.js";
import {
  fetchWithRetry,
  parseRateLimitHeaders,
  type RateLimitInfo,
} from "./http.js";

const GITHUB_API = "https://api.github.com";

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ghost-github-portfolio",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export interface FetchReposResult {
  repos: GitHubRepo[];
  rateLimit: RateLimitInfo | null;
}

export async function fetchRepos(
  config: Config,
  verbose = false,
): Promise<GitHubRepo[]> {
  const { username, token } = config.github;
  const { minStars, maxRepos, excludeRepos, includeForked } = config.portfolio;

  const allRepos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;
  let lastRateLimit: RateLimitInfo | null = null;

  const onRetry = verbose
    ? (_attempt: number, _delay: number, reason: string) =>
        console.log(`  [retry] ${reason}`)
    : undefined;

  // GitHub REST API /users/{user}/repos does not support sort=stars.
  // Fetch all pages, then sort client-side.
  while (true) {
    const url = `${GITHUB_API}/users/${username}/repos?per_page=${perPage}&page=${page}&type=owner`;
    const res = await fetchWithRetry(
      url,
      { headers: headers(token) },
      { onRetry },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }

    lastRateLimit = parseRateLimitHeaders(res);
    if (verbose && lastRateLimit) {
      console.log(
        `  [rate-limit] ${lastRateLimit.remaining}/${lastRateLimit.limit} remaining (resets ${lastRateLimit.resetAt.toISOString()})`,
      );
    }

    const repos = (await res.json()) as GitHubRepo[];
    if (repos.length === 0) break;

    allRepos.push(...repos);

    // If fewer than perPage returned, we've reached the last page
    if (repos.length < perPage) break;

    page++;
  }

  const excludeSet = new Set(excludeRepos.map((r) => r.toLowerCase()));

  return allRepos
    .filter((r) => r.stargazers_count >= minStars)
    .filter((r) => includeForked || !r.fork)
    .filter((r) => !excludeSet.has(r.name.toLowerCase()))
    .filter((r) => !config.portfolio.repos[r.name]?.exclude)
    .filter((r) => {
      if (!config.portfolio.excludeAwesomeLists) return true;
      return !r.name.toLowerCase().startsWith("awesome") && !r.topics.includes("awesome-list");
    })
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, maxRepos);
}

const BANNER_CANDIDATES = [
  "docs/images/banner.svg",
  "docs/images/banner.png",
  "media/banner.svg",
  "media/banner.png",
  "assets/banner.svg",
  "assets/banner.png",
  "banner.svg",
  "banner.png",
];

export async function detectBanner(
  repo: GitHubRepo,
  config: Config,
): Promise<string | null> {
  if (!config.portfolio.showBanner) return null;

  try {
    const { username } = config.github;
    const branch = repo.default_branch;

    // Config override for this specific repo
    const overridePath =
      config.portfolio.repos[repo.name]?.bannerPath ??
      config.portfolio.bannerPaths[repo.name];

    if (overridePath) {
      const url = `https://raw.githubusercontent.com/${username}/${repo.name}/${branch}/${overridePath}`;
      if (await urlExists(url)) return url;
    }

    // Try default path
    const defaultUrl = `https://raw.githubusercontent.com/${username}/${repo.name}/${branch}/${config.portfolio.defaultBannerPath}`;
    if (await urlExists(defaultUrl)) return defaultUrl;

    // Try candidates
    for (const candidate of BANNER_CANDIDATES) {
      if (candidate === config.portfolio.defaultBannerPath) continue;
      const url = `https://raw.githubusercontent.com/${username}/${repo.name}/${branch}/${candidate}`;
      if (await urlExists(url)) return url;
    }

    return null;
  } catch {
    // Banner detection is non-critical; skip banner on persistent errors
    return null;
  }
}

const PORTFOLIO_CONFIG_FILE = ".ghost-portfolio.yml";

export async function fetchPortfolioConfig(
  repo: GitHubRepo,
  config: Config,
): Promise<RepoOverride | null> {
  const { username } = config.github;
  const branch = repo.default_branch;
  const url = `https://raw.githubusercontent.com/${username}/${repo.name}/${branch}/${PORTFOLIO_CONFIG_FILE}`;

  try {
    const res = await fetchWithRetry(url, { redirect: "follow" });
    if (!res.ok) return null;

    const text = await res.text();
    // Dynamic import to avoid adding yaml as a runtime dep for github.ts
    // yaml is already a project dependency
    const { parse } = await import("yaml");
    const data = parse(text);
    if (!data || typeof data !== "object") return null;

    return {
      description: data.description ?? undefined,
      personalNote: data.personalNote ?? undefined,
      dockerImage: data.dockerImage ?? undefined,
      keyFeatures: Array.isArray(data.keyFeatures) ? data.keyFeatures : undefined,
      techStack: data.techStack ?? undefined,
      badges: Array.isArray(data.badges) ? data.badges : undefined,
      bannerPath: data.bannerPath ?? undefined,
    } satisfies RepoOverride;
  } catch {
    return null;
  }
}

async function urlExists(url: string): Promise<boolean> {
  const res = await fetchWithRetry(url, {
    method: "HEAD",
    redirect: "follow",
  });
  if (res.ok) return true;
  if (res.status === 404) return false;
  throw new Error(`Banner check failed for ${url}: HTTP ${res.status}`);
}
