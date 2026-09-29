import type { Config, GitHubRepo, LexicalDocument } from "./types.js";

export const MAX_DESCRIPTION_LENGTH = 140;

// Abbreviations that end in a period without ending the sentence.
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|approx|incl|inc|ltd|dr|mr|ms|st)$/i;

/**
 * Turn a GitHub description into one short line: emoji and :shortcodes:
 * removed, em and en dashes turned into commas, first sentence only,
 * at most 140 characters.
 */
export function cleanDescription(
  text: string,
  max = MAX_DESCRIPTION_LENGTH,
): string {
  let s = text
    .replace(/:(?=[a-z0-9_+-]*[a-z])[a-z0-9_+-]+:/g, " ")
    .replace(/(?![©®™])\p{Extended_Pictographic}/gu, " ")
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍️⃣]/gu, "")
    .replace(/\s*[\u2013\u2014]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,(?=[,.;:!?])/g, "")
    .replace(/^[\s,;:.-]+/, "")
    .replace(/[\s,;:-]+$/, "")
    .trim();

  for (const m of s.matchAll(/[.!?](?=\s+["'(\p{Lu}\d])/gu)) {
    const before = s.slice(0, m.index);
    if (m[0] === "." && ABBREVIATION.test(before)) continue;
    s = s.slice(0, m.index + 1);
    break;
  }

  if (s.length > max) {
    const cut = s.slice(0, max - 1);
    const space = cut.lastIndexOf(" ");
    s = (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "") + "…";
  } else if (s && !/[.!?…]$/.test(s)) {
    s += ".";
  }
  return s;
}

export function formatStars(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "star" : "stars"}`;
}

export interface SiteLink {
  url: string;
  label: string;
}

/** The card's site link: the override, else the GitHub homepage unless it points at github.com. */
export function siteLink(repo: GitHubRepo, config: Config): SiteLink | null {
  const override = config.portfolio.repos[repo.name];
  const raw = (override?.homepage ?? repo.homepage ?? "").trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "github.com" || host === "www.github.com") return null;

  return { url: raw, label: override?.siteLabel || "Site" };
}

export function repoDescription(repo: GitHubRepo, config: Config): string {
  const override = config.portfolio.repos[repo.name]?.description;
  if (override) return override;
  return repo.description ? cleanDescription(repo.description) : "";
}

export function generateCard(
  repo: GitHubRepo,
  bannerUrl: string | null,
  config: Config,
): string {
  const href = escapeHtml(repo.html_url);
  const name = escapeHtml(repo.name);

  const media = bannerUrl
    ? `<a class="pf-media" href="${href}" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(bannerUrl)}" alt="" loading="lazy"></a>`
    : `<a class="pf-media pf-tile" href="${href}" tabindex="-1" aria-hidden="true"><span>${name}</span></a>`;

  const description = repoDescription(repo, config);
  const site = siteLink(repo, config);
  const lineParts: string[] = [];
  if (description) lineParts.push(escapeHtml(description));
  if (site) {
    lineParts.push(`<a href="${escapeHtml(site.url)}">${escapeHtml(site.label)}</a>`);
  }

  const lines = [
    `<li class="pf-card">`,
    `  ${media}`,
    `  <div class="pf-head"><h3 class="pf-name"><a href="${href}">${name}</a></h3><span class="pf-stars">${formatStars(repo.stargazers_count)}</span></div>`,
  ];
  if (lineParts.length > 0) {
    lines.push(`  <p class="pf-line">${lineParts.join(" ")}</p>`);
  }
  lines.push(`</li>`);
  return lines.join("\n");
}

function portfolioStyle(columns: number): string {
  const tablet = Math.min(columns, 2);
  const rules = [
    `.pf { --pf-muted: #999; --pf-rule: #3a3f4b; --pf-tile: #21252c; }`,
    `.pf .pf-intro, .pf .pf-more { max-width: 720px; margin-left: auto; margin-right: auto; }`,
    `.pf .pf-intro { margin-top: 0; margin-bottom: 0; font-size: 1.1em; line-height: 1.6; }`,
    `.pf .pf-grid { display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); gap: 3.2rem 2.4rem; margin: 2.4em 0 0; padding: 0; list-style: none; }`,
    `.pf .pf-card { margin: 0; padding: 0; display: flex; flex-direction: column; min-width: 0; }`,
    `.pf .pf-media { display: block; border-radius: 8px; overflow: hidden; aspect-ratio: 9 / 2; text-decoration: none; }`,
    `.pf .pf-media img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; margin: 0; border-radius: 0; }`,
    `.pf .pf-tile { display: flex; align-items: center; padding: 0 7%; background: var(--pf-tile); border: 1px solid var(--pf-rule); }`,
    `.pf .pf-tile span { color: #fff; font-size: 1.45em; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; overflow-wrap: anywhere; }`,
    `.pf .pf-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1.2rem; margin: 1.2rem 0 0; }`,
    `.pf .pf-name { margin: 0; min-width: 0; font-size: 1em; font-weight: 700; line-height: 1.3; letter-spacing: -.01em; overflow-wrap: anywhere; }`,
    `.pf .pf-name a { color: #fff; text-decoration: none; }`,
    `.pf .pf-name a:hover, .pf .pf-name a:focus-visible { text-decoration: underline; }`,
    `.pf .pf-stars { flex: none; color: var(--pf-muted); font-size: .85em; font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; }`,
    `.pf .pf-line { margin: .4rem 0 0; font-size: .92em; line-height: 1.55; }`,
    `.pf .pf-line a { white-space: nowrap; }`,
    `.pf .pf-more { margin-top: 3.2em; margin-bottom: 0; color: var(--pf-muted); font-size: .95em; }`,
  ];
  if (tablet < columns) {
    rules.push(
      `@media (max-width: 1024px) {`,
      `  .pf .pf-grid.pf-cols-${columns} { grid-template-columns: repeat(${tablet}, minmax(0, 1fr)); }`,
      `}`,
    );
  }
  rules.push(
    `@media (max-width: 640px) {`,
    `  .pf .pf-grid.pf-cols-${columns} { grid-template-columns: 1fr; gap: 2.8rem; }`,
    `}`,
  );
  return `<style>\n${rules.join("\n")}\n</style>`;
}

export interface PortfolioInput {
  /** Card HTML from generateCard, in display order. */
  cards: string[];
  /** Number of public repositories the user owns, used for the closing line. */
  totalRepos: number;
}

/**
 * The whole page as the HTML of one Ghost html card. The `kg-width-wide`
 * class lets themes built on Ghost's content grid (Alto, Source, Casper)
 * give the cards the wide column; the text stays at reading width.
 */
export function generatePortfolioHtml(
  input: PortfolioInput,
  config: Config,
): string {
  const { columns, intro } = config.portfolio;
  const user = escapeHtml(config.github.username);
  const profile = `<a href="https://github.com/${user}">github.com/${user}</a>`;
  const others = input.totalRepos - input.cards.length;
  const more =
    others > 0
      ? `The other ${others.toLocaleString("en-US")} public ${others === 1 ? "repository is" : "repositories are"} on ${profile}.`
      : `More on ${profile}.`;

  const parts = [`<div class="pf kg-width-wide">`, portfolioStyle(columns)];
  if (intro.trim()) {
    parts.push(`<p class="pf-intro">${escapeHtml(intro.trim())}</p>`);
  }
  parts.push(`<ul class="pf-grid pf-cols-${columns}">`, ...input.cards, `</ul>`);
  parts.push(`<p class="pf-more">${more}</p>`, `</div>`);
  return parts.join("\n");
}

export function buildLexical(html: string): LexicalDocument {
  return {
    root: {
      children: [{ type: "html", version: 1, html }],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

/** The html card as Ghost renders it, with its begin and end markers. */
export function wrapHtmlCard(html: string): string {
  return `<!--kg-card-begin: html-->\n${html}\n<!--kg-card-end: html-->`;
}

/**
 * A standalone dark page that approximates Ghost's Alto theme in dark mode
 * (content grid, widths, the .gh-content rules that reach into an html
 * card), for checking the output in a browser before syncing.
 */
export function buildPreviewPage(html: string, title = "Portfolio"): string {
  const t = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} (preview)</title>
<style>
:root { --ghost-accent-color: #FF1A75; --gap: 3.6rem; }
* { box-sizing: border-box; }
html { font-size: 62.5%; background: #282c35; }
body { margin: 0; background: #282c35; color: #ccc; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 1.6rem; line-height: 1.6; -webkit-font-smoothing: antialiased; }
.article-header { width: min(720px, 100% - var(--gap) * 2); margin: 60px auto 0; text-align: center; }
.post-title { margin: 0; color: #fff; font-size: 3.6rem; font-weight: 800; line-height: 1.15; letter-spacing: -.02em; }
.gh-canvas { --main: min(720px, 100% - var(--gap) * 2); --wide: minmax(0, calc((1200px - 720px) / 2)); --full: minmax(var(--gap), 1fr); display: grid; grid-template-columns: [full-start] var(--full) [wide-start] var(--wide) [main-start] var(--main) [main-end] var(--wide) [wide-end] var(--full) [full-end]; }
.gh-canvas > * { grid-column: main; }
.gh-canvas > .kg-width-wide { grid-column: wide; }
.gh-content { margin-top: 5.6rem; margin-bottom: 12rem; font-size: 1.7rem; word-break: break-word; }
.gh-content > * { margin-top: 0; margin-bottom: 0; }
.gh-content > * + * { margin-top: 1.6em; }
.gh-content h3 { font-size: 1.4em; }
.gh-content a { color: var(--ghost-accent-color); text-decoration: underline; word-break: break-word; }
.gh-content ul { padding-left: 2.8rem; }
.gh-content li + li { margin-top: .8rem; }
@media (max-width: 767px) { :root { --gap: 2rem; } .post-title { font-size: 3.2rem; } .article-header { margin-top: 40px; } .gh-content { margin-top: 4rem; } }
</style>
</head>
<body>
<main>
<article>
<header class="article-header"><h1 class="post-title">${t}</h1></header>
<div class="gh-content gh-canvas">
${wrapHtmlCard(html)}
</div>
</article>
</main>
</body>
</html>
`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
