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

/** Fetch every public repo the user owns, unfiltered. */
export async function fetchAllRepos(
  config: Config,
  verbose = false,
): Promise<GitHubRepo[]> {
  const { username, token } = config.github;

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

  return allRepos;
}

export function isAwesomeList(repo: GitHubRepo): boolean {
  return (
    repo.name.toLowerCase().startsWith("awesome") ||
    repo.topics.includes("awesome-list")
  );
}

/**
 * Apply every filter, sort by stars and only then cut to maxRepos, so an
 * excluded repo never takes a slot.
 */
export function selectRepos(repos: GitHubRepo[], config: Config): GitHubRepo[] {
  const {
    minStars,
    maxRepos,
    excludeRepos,
    includeForked,
    includeArchived,
    excludeAwesomeLists,
  } = config.portfolio;
  const excludeSet = new Set(excludeRepos.map((r) => r.toLowerCase()));
  const patterns = config.github.excludePatterns.map((p) => new RegExp(p, "i"));

  return repos
    .filter((r) => r.stargazers_count >= minStars)
    .filter((r) => includeForked || !r.fork)
    .filter((r) => includeArchived || !r.archived)
    .filter((r) => !excludeSet.has(r.name.toLowerCase()))
    .filter((r) => !config.portfolio.repos[r.name]?.exclude)
    .filter((r) => !patterns.some((p) => p.test(r.name)))
    .filter((r) => !excludeAwesomeLists || !isAwesomeList(r))
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, maxRepos);
}

export interface BannerResult {
  /** URL to use in the card, or null to draw a name tile. */
  url: string | null;
  /** Why no banner is used, one entry per path tried. Empty when url is set or banners are off. */
  problems: string[];
}

/**
 * List every reference in an SVG that a browser would have to load from
 * somewhere else. Inside an `<img>` those are never loaded, so the banner
 * renders blank or broken. `#id` and `data:` references are fine.
 */
export function findExternalRefs(svg: string): string[] {
  const refs: string[] = [];
  const attr = /\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  const cssUrl = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi;
  const cssImport = /@import\s+(?:"([^"]*)"|'([^']*)')/gi;

  for (const re of [attr, cssUrl, cssImport]) {
    for (const m of svg.matchAll(re)) {
      const value = (m[1] ?? m[2] ?? m[3] ?? "").trim();
      if (value === "" || value.startsWith("#") || /^data:/i.test(value)) continue;
      refs.push(value);
    }
  }
  return [...new Set(refs)];
}

function isSvg(path: string, contentType: string | null): boolean {
  return (
    path.toLowerCase().split("?")[0].endsWith(".svg") ||
    (contentType ?? "").toLowerCase().includes("svg")
  );
}

async function checkBanner(url: string, path: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetchWithRetry(url, { redirect: "follow" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `${path}: request failed (${message})`;
  }

  if (res.status === 404) return `${path}: missing (HTTP 404)`;
  if (res.status !== 200) return `${path}: HTTP ${res.status}`;

  if (!isSvg(path, res.headers.get("content-type"))) return null;

  const refs = findExternalRefs(await res.text());
  if (refs.length > 0) {
    const shown = refs.slice(0, 3).join(", ");
    const more = refs.length > 3 ? ` and ${refs.length - 3} more` : "";
    return `${path}: not self-contained, it loads ${shown}${more}`;
  }
  return null;
}

/**
 * Pick the banner for a repo: the per-repo path first (repos.<name>.bannerPath
 * or bannerPaths.<name>), then defaultBannerPath. A banner is used only when
 * it answers 200 and, for SVG, loads nothing from outside itself.
 */
export async function resolveBanner(
  repo: GitHubRepo,
  config: Config,
): Promise<BannerResult> {
  if (!config.portfolio.showBanner) return { url: null, problems: [] };

  const override =
    config.portfolio.repos[repo.name]?.bannerPath ??
    config.portfolio.bannerPaths[repo.name];
  const paths = [
    ...new Set(
      [override, config.portfolio.defaultBannerPath].filter(
        (p): p is string => Boolean(p),
      ),
    ),
  ];

  const problems: string[] = [];
  for (const path of paths) {
    const clean = path.replace(/^\/+/, "");
    const url = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/${clean}`;
    const problem = await checkBanner(url, clean);
    if (!problem) return { url, problems: [] };
    problems.push(problem);
  }
  return { url: null, problems };
}

const PORTFOLIO_CONFIG_FILE = ".ghost-portfolio.yml";

export async function fetchPortfolioConfig(
  repo: GitHubRepo,
): Promise<RepoOverride | null> {
  const branch = repo.default_branch;
  const url = `https://raw.githubusercontent.com/${repo.full_name}/${branch}/${PORTFOLIO_CONFIG_FILE}`;

  try {
    const res = await fetchWithRetry(url, { redirect: "follow" });
    if (!res.ok) return null;

    const text = await res.text();
    const { parse } = await import("yaml");
    const data = parse(text);
    if (!data || typeof data !== "object") return null;

    const pick = (v: unknown) => (typeof v === "string" ? v : undefined);
    return {
      description: pick(data.description),
      homepage: pick(data.homepage),
      siteLabel: pick(data.siteLabel),
      bannerPath: pick(data.bannerPath),
    } satisfies RepoOverride;
  } catch {
    return null;
  }
}
