export interface Config {
  github: {
    username: string;
    token?: string;
  };
  ghost: {
    url: string;
    adminApiKey: string;
    pageId?: string;
    pageSlug?: string;
  };
  portfolio: PortfolioConfig;
}

export interface PortfolioConfig {
  minStars: number;
  maxRepos: number;
  excludeRepos: string[];
  includeForked: boolean;
  excludeAwesomeLists: boolean;
  badgeStyle: string;
  showBanner: boolean;
  centerContent: boolean;
  defaultBannerPath: string;
  bannerPaths: Record<string, string>;
  repos: Record<string, RepoOverride>;
  footer: FooterConfig;
}

export interface FooterConfig {
  showStats: boolean;
  showViewAll: boolean;
}

export interface RepoOverride {
  bannerPath?: string;
  description?: string;
  personalNote?: string;
  dockerImage?: string;
  badges?: CustomBadge[];
  keyFeatures?: string[];
  techStack?: string;
  exclude?: boolean;
}

export interface CustomBadge {
  type: "website" | "docker" | "awesome-list" | "platform" | "docs" | "custom";
  url?: string;
  label?: string;
  value?: string;
  color?: string;
  logo?: string;
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

export type LexicalNode = HtmlNode | HorizontalRuleNode;

export interface HtmlNode {
  type: "html";
  version: number;
  html: string;
}

export interface HorizontalRuleNode {
  type: "horizontalrule";
  version: number;
}
