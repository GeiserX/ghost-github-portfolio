export interface Config {
  github: {
    username: string;
    token?: string;
    /** Regular expressions (case-insensitive) matched against repo names to skip. */
    excludePatterns: string[];
  };
  ghost: {
    url: string;
    adminApiKey: string;
    pageId?: string;
    pageSlug?: string;
    /** Send Admin API requests here instead of `url` (for example a LAN origin behind a WAF). */
    originUrl?: string;
    /** Host header sent with `originUrl` requests. Defaults to the host of `url`. */
    hostHeader?: string;
  };
  portfolio: PortfolioConfig;
}

export interface PortfolioConfig {
  minStars: number;
  maxRepos: number;
  columns: number;
  excludeRepos: string[];
  includeForked: boolean;
  includeArchived: boolean;
  excludeAwesomeLists: boolean;
  showBanner: boolean;
  defaultBannerPath: string;
  bannerPaths: Record<string, string>;
  intro: string;
  repos: Record<string, RepoOverride>;
}

export interface RepoOverride {
  bannerPath?: string;
  description?: string;
  /** Site link for the card. Overrides the GitHub homepage field. */
  homepage?: string;
  /** Link text for the site link. Defaults to "Site". */
  siteLabel?: string;
  exclude?: boolean;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  license: { spdx_id: string } | null;
  fork: boolean;
  archived: boolean;
  homepage: string | null;
  topics: string[];
  language: string | null;
  default_branch: string;
}

export interface LexicalDocument {
  root: {
    children: LexicalNode[];
    direction: string;
    format: string;
    indent: number;
    type: string;
    version: number;
  };
}

export type LexicalNode = HtmlNode;

export interface HtmlNode {
  type: "html";
  version: number;
  html: string;
}
