import type {
  Config,
  GitHubRepo,
  LexicalDocument,
  CustomBadge,
} from "./types.js";

function shieldsUrl(
  label: string,
  value: string,
  color: string,
  style: string,
  logo?: string,
): string {
  const encoded = `${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}`;
  let url = `https://img.shields.io/badge/${encoded}?style=${style}`;
  if (logo) url += `&logo=${logo}&logoColor=white`;
  return url;
}

function buildBadges(repo: GitHubRepo, config: Config): string[] {
  const style = config.portfolio.badgeStyle;
  const overrides = config.portfolio.repos[repo.name];
  const badges: string[] = [];

  // Stars
  badges.push(
    `<img src="https://img.shields.io/github/stars/${repo.full_name}?style=${style}" alt="Stars">`,
  );

  // Forks
  badges.push(
    `<img src="https://img.shields.io/github/forks/${repo.full_name}?style=${style}" alt="Forks">`,
  );

  // License
  if (repo.license) {
    badges.push(
      `<img src="https://img.shields.io/github/license/${repo.full_name}?style=${style}" alt="License">`,
    );
  }

  // Docker pulls (from config override)
  const dockerImage = overrides?.dockerImage;
  if (dockerImage) {
    badges.push(
      `<a href="https://hub.docker.com/r/${dockerImage}"><img src="https://img.shields.io/docker/pulls/${dockerImage}?style=${style}" alt="Docker Pulls"></a>`,
    );
  }

  // Website badge (from GitHub homepage or config)
  const homepage = repo.homepage;
  if (
    homepage &&
    !homepage.includes("hub.docker.com") &&
    !homepage.includes("github.io")
  ) {
    const domain = new URL(homepage).hostname;
    badges.push(
      `<a href="${homepage}"><img src="${shieldsUrl("website", domain, "blue", style)}" alt="Website"></a>`,
    );
  }

  // Custom badges from config
  if (overrides?.badges) {
    for (const badge of overrides.badges) {
      badges.push(renderCustomBadge(badge, style));
    }
  }

  // Auto-detect awesome-list from topics
  if (
    repo.topics.includes("awesome-list") &&
    !overrides?.badges?.some((b) => b.type === "awesome-list")
  ) {
    badges.push(
      `<img src="${shieldsUrl("awesome", "list", "fc60a8", style, "awesomelists")}" alt="Awesome List">`,
    );
  }

  // Docs badge for GitHub Pages
  if (
    homepage?.includes("github.io") &&
    !overrides?.badges?.some((b) => b.type === "docs")
  ) {
    badges.push(
      `<a href="${homepage}"><img src="${shieldsUrl("docs", "online", "blue", style)}" alt="Docs"></a>`,
    );
  }

  return badges;
}

function renderCustomBadge(badge: CustomBadge, style: string): string {
  switch (badge.type) {
    case "website":
      return `<a href="${badge.url}"><img src="${shieldsUrl("website", badge.label ?? new URL(badge.url!).hostname, badge.color ?? "blue", style)}" alt="Website"></a>`;
    case "docker":
      return `<a href="https://hub.docker.com/r/${badge.label}"><img src="https://img.shields.io/docker/pulls/${badge.label}?style=${style}" alt="Docker Pulls"></a>`;
    case "awesome-list":
      return `<img src="${shieldsUrl("awesome", "list", badge.color ?? "fc60a8", style, "awesomelists")}" alt="Awesome List">`;
    case "platform":
      return `<img src="${shieldsUrl("platform", badge.label ?? "unknown", badge.color ?? "000", style, badge.logo)}" alt="Platform">`;
    case "docs":
      return `<a href="${badge.url}"><img src="${shieldsUrl("docs", badge.label ?? "online", badge.color ?? "blue", style)}" alt="Docs"></a>`;
    case "custom":
      return `<img src="${shieldsUrl(badge.label ?? "", badge.value ?? "", badge.color ?? "grey", style, badge.logo)}" alt="${badge.label}">`;
  }
}

export function generateCard(
  repo: GitHubRepo,
  bannerUrl: string | null,
  config: Config,
): string {
  const overrides = config.portfolio.repos[repo.name];
  const center = config.portfolio.centerContent;
  const align = center ? ' style="text-align:center;"' : "";
  const flexJustify = center ? " justify-content:center;" : "";

  const parts: string[] = [];

  // Banner
  if (bannerUrl) {
    parts.push(
      `<a href="${repo.html_url}" rel="noreferrer"${center ? ' style="display:block; text-align:center;"' : ""}>` +
        `<img src="${bannerUrl}" alt="${repo.name} banner" style="width:100%; max-width:900px; border-radius:8px; margin-bottom:12px; display:block;${center ? " margin-left:auto; margin-right:auto;" : ""}">` +
        `</a>`,
    );
  }

  // Title
  parts.push(
    `<h2${align}><a href="${repo.html_url}" rel="noreferrer">${repo.name}</a></h2>`,
  );

  // Badges
  const badges = buildBadges(repo, config);
  parts.push(
    `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;${flexJustify}">`,
    `  ${badges.join("\n  ")}`,
    `</div>`,
  );

  // Description
  const description = overrides?.description ?? repo.description;
  if (description) {
    parts.push(`<p style="font-size:1.1em;"><em>${escapeHtml(description)}</em></p>`);
  }

  // Personal note
  if (overrides?.personalNote) {
    parts.push(`<p>${escapeHtml(overrides.personalNote)}</p>`);
  }

  // Key features (from config only)
  if (overrides?.keyFeatures?.length) {
    parts.push(`<p><strong>Key Features:</strong></p>`);
    parts.push(`<ul>`);
    for (const feature of overrides.keyFeatures) {
      parts.push(`<li>${escapeHtml(feature)}</li>`);
    }
    parts.push(`</ul>`);
  }

  // Tech stack
  const techStack = overrides?.techStack ?? inferTechStack(repo);
  if (techStack) {
    parts.push(
      `<p><strong>Tech Stack:</strong>&nbsp;${escapeHtml(techStack)}</p>`,
    );
  }

  // Separator
  parts.push(`<hr>`);

  return parts.join("\n");
}

function inferTechStack(repo: GitHubRepo): string | null {
  const languages: string[] = [];
  if (repo.language) languages.push(repo.language);

  // Add relevant topics as tech
  const techTopics = repo.topics.filter((t) =>
    [
      "docker",
      "kubernetes",
      "helm",
      "nextjs",
      "react",
      "vue",
      "svelte",
      "fastapi",
      "flask",
      "express",
      "nestjs",
      "terraform",
      "ansible",
      "mcp",
      "jellyfin",
      "telegram",
      "swift",
      "macos",
      "nodejs",
    ].includes(t.toLowerCase()),
  );

  const topicLabels = techTopics.map(
    (t) => t.charAt(0).toUpperCase() + t.slice(1),
  );
  const all = [...new Set([...languages, ...topicLabels])];

  return all.length > 0 ? all.join(", ") : null;
}

export function generateFooter(
  allRepos: GitHubRepo[],
  config: Config,
): string | null {
  if (!config.portfolio.footer.showStats && !config.portfolio.footer.showViewAll)
    return null;

  const parts: string[] = [];
  parts.push(`<h2>GitHub Stats</h2>`);

  if (config.portfolio.footer.showStats) {
    const totalStars = allRepos.reduce((s, r) => s + r.stargazers_count, 0);
    const totalRepos = allRepos.length;
    const languages = [
      ...new Set(allRepos.map((r) => r.language).filter(Boolean)),
    ];
    const focusAreas = [
      ...new Set(allRepos.flatMap((r) => r.topics).filter(Boolean)),
    ]
      .slice(0, 8)
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1));

    const lines: string[] = [];
    lines.push(`<strong>Total Stars:</strong>&nbsp;${totalStars}+`);
    lines.push(`<strong>Public Repositories:</strong>&nbsp;${totalRepos}`);
    if (languages.length > 0) {
      lines.push(`<strong>Primary Languages:</strong>&nbsp;${languages.join(", ")}`);
    }
    if (focusAreas.length > 0) {
      lines.push(`<strong>Focus Areas:</strong>&nbsp;${focusAreas.join(", ")}`);
    }
    parts.push(`<p>${lines.join("<br>")}</p>`);
  }

  if (config.portfolio.footer.showViewAll) {
    parts.push(
      `<p><a href="https://github.com/${config.github.username}?tab=repositories"><strong>View All Repositories &rarr;</strong></a></p>`,
    );
  }

  return parts.join("\n");
}

export function buildLexical(
  cards: string[],
  footer: string | null,
): LexicalDocument {
  const children: LexicalDocument["root"]["children"] = [];

  // Opening separator
  children.push({ type: "horizontalrule", version: 1 });

  // Project cards
  for (const card of cards) {
    children.push({ type: "html", version: 1, html: card });
  }

  // Footer
  if (footer) {
    children.push({ type: "html", version: 1, html: footer });
  }

  return {
    root: {
      children,
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
