import { describe, it, expect } from "vitest";
import {
  generateCard,
  generatePortfolioHtml,
  buildLexical,
  buildPreviewPage,
  wrapHtmlCard,
  cleanDescription,
  formatStars,
  siteLink,
  repoDescription,
} from "./generator.js";
import type { Config, GitHubRepo } from "./types.js";

function makeConfig(portfolio: Partial<Config["portfolio"]> = {}): Config {
  return {
    github: { username: "testuser", excludePatterns: [] },
    ghost: {
      url: "https://ghost.example.com",
      adminApiKey: "key:secret",
      pageSlug: "portfolio",
    },
    portfolio: {
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
      intro: "Intro text.",
      repos: {},
      ...portfolio,
    },
  };
}

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: "test-repo",
    full_name: "testuser/test-repo",
    html_url: "https://github.com/testuser/test-repo",
    description: "A test repository",
    stargazers_count: 42,
    forks_count: 5,
    license: { spdx_id: "GPL-3.0" },
    fork: false,
    archived: false,
    homepage: null,
    topics: [],
    language: "TypeScript",
    default_branch: "main",
    ...overrides,
  };
}

describe("cleanDescription", () => {
  it("keeps only the first sentence", () => {
    expect(cleanDescription("Backs up chats. Also has a viewer.")).toBe(
      "Backs up chats.",
    );
  });

  it("does not split on abbreviations or dotted names", () => {
    expect(
      cleanDescription("Runs anything, e.g. Docker or Node.js apps. Second."),
    ).toBe("Runs anything, e.g. Docker or Node.js apps.");
  });

  it("turns em and en dashes into commas", () => {
    expect(cleanDescription("Own your history \u2014 local backups")).toBe(
      "Own your history, local backups.",
    );
    expect(cleanDescription("Fast\u2013simple tool")).toBe("Fast, simple tool.");
  });

  it("removes emoji and shortcodes", () => {
    expect(cleanDescription("\u{1F680} Rocket fast :sparkles: tool ❤️")).toBe(
      "Rocket fast tool.",
    );
    expect(cleanDescription("Flags \u{1F1EA}\u{1F1F8} and hands \u{1F44B}\u{1F3FD} gone")).toBe(
      "Flags and hands gone.",
    );
  });

  it("keeps copyright and trademark signs", () => {
    expect(cleanDescription("Widget™ for Foo®")).toBe(
      "Widget™ for Foo®.",
    );
  });

  it("caps the length at 140 characters on a word boundary", () => {
    const long = "word ".repeat(60).trim();
    const out = cleanDescription(long);
    expect(out.length).toBeLessThanOrEqual(140);
    expect(out.endsWith("word…")).toBe(true);
  });

  it("cuts a single overlong word hard", () => {
    const out = cleanDescription("x".repeat(300));
    expect(out).toHaveLength(140);
    expect(out.endsWith("…")).toBe(true);
  });

  it("keeps existing terminal punctuation", () => {
    expect(cleanDescription("Is it done?")).toBe("Is it done?");
  });

  it("returns an empty string for emoji-only input", () => {
    expect(cleanDescription("\u{1F680}\u{1F680}")).toBe("");
  });
});

describe("formatStars", () => {
  it("writes plain text with the right plural", () => {
    expect(formatStars(215)).toBe("215 stars");
    expect(formatStars(1)).toBe("1 star");
    expect(formatStars(1234)).toBe("1,234 stars");
  });
});

describe("siteLink", () => {
  it("uses a non-GitHub homepage with the default label", () => {
    const link = siteLink(makeRepo({ homepage: "https://pumperly.com" }), makeConfig());
    expect(link).toEqual({ url: "https://pumperly.com", label: "Site" });
  });

  it("skips github.com homepages", () => {
    expect(
      siteLink(makeRepo({ homepage: "https://github.com/testuser/x" }), makeConfig()),
    ).toBeNull();
  });

  it("keeps GitHub Pages sites", () => {
    expect(
      siteLink(makeRepo({ homepage: "https://testuser.github.io/x/" }), makeConfig())?.url,
    ).toBe("https://testuser.github.io/x/");
  });

  it("skips empty, invalid and non-http homepages", () => {
    expect(siteLink(makeRepo({ homepage: "" }), makeConfig())).toBeNull();
    expect(siteLink(makeRepo({ homepage: "not a url" }), makeConfig())).toBeNull();
    expect(siteLink(makeRepo({ homepage: "javascript:alert(1)" }), makeConfig())).toBeNull();
  });

  it("applies the per-repo homepage and label override", () => {
    const config = makeConfig({
      repos: {
        "test-repo": { homepage: "https://blog.example.com/guide/", siteLabel: "Guide" },
      },
    });
    expect(siteLink(makeRepo({ homepage: "https://github.com/x" }), config)).toEqual({
      url: "https://blog.example.com/guide/",
      label: "Guide",
    });
  });
});

describe("repoDescription", () => {
  it("prefers the config override verbatim", () => {
    const config = makeConfig({
      repos: { "test-repo": { description: "Curated. Two sentences stay." } },
    });
    expect(repoDescription(makeRepo(), config)).toBe("Curated. Two sentences stay.");
  });

  it("cleans the GitHub description otherwise", () => {
    expect(
      repoDescription(makeRepo({ description: "Tool \u2014 fast. More." }), makeConfig()),
    ).toBe("Tool, fast.");
  });

  it("returns empty when there is no description", () => {
    expect(repoDescription(makeRepo({ description: null }), makeConfig())).toBe("");
  });
});

describe("generateCard", () => {
  it("renders a banner card", () => {
    const html = generateCard(
      makeRepo({ homepage: "https://example.com" }),
      "https://raw.githubusercontent.com/testuser/test-repo/main/docs/images/banner.svg",
      makeConfig(),
    );
    expect(html).toContain('<li class="pf-card">');
    expect(html).toContain('<a class="pf-media" href="https://github.com/testuser/test-repo"');
    expect(html).toContain('<img src="https://raw.githubusercontent.com/testuser/test-repo/main/docs/images/banner.svg" alt="" loading="lazy">');
    expect(html).toContain('<h3 class="pf-name"><a href="https://github.com/testuser/test-repo">test-repo</a></h3>');
    expect(html).toContain('<span class="pf-stars">42 stars</span>');
    expect(html).toContain('<p class="pf-line">A test repository. <a href="https://example.com">Site</a></p>');
  });

  it("renders a name tile when there is no banner", () => {
    const html = generateCard(makeRepo(), null, makeConfig());
    expect(html).toContain('<a class="pf-media pf-tile"');
    expect(html).toContain("<span>test-repo</span>");
    expect(html).not.toContain("<img");
  });

  it("has no badges, forks, licence or tech stack", () => {
    const html = generateCard(makeRepo({ topics: ["docker"] }), null, makeConfig());
    expect(html).not.toContain("shields.io");
    expect(html).not.toContain("Forks");
    expect(html).not.toContain("License");
    expect(html).not.toContain("Tech Stack");
    expect(html).not.toContain("<hr");
  });

  it("omits the line when there is neither description nor site", () => {
    const html = generateCard(makeRepo({ description: null }), null, makeConfig());
    expect(html).not.toContain("pf-line");
  });

  it("escapes names, descriptions and URLs", () => {
    const config = makeConfig({
      repos: { "test-repo": { description: '<script>"x"</script>' } },
    });
    const html = generateCard(
      makeRepo({ homepage: 'https://e.com/?a="b"&c' }),
      null,
      config,
    );
    expect(html).toContain("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
    expect(html).toContain('href="https://e.com/?a=&quot;b&quot;&amp;c"');
    expect(html).not.toContain("<script>");
  });
});

describe("generatePortfolioHtml", () => {
  const cards = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      generateCard(makeRepo({ name: `r${i}` }), null, makeConfig()),
    );

  it("renders one grid with every card and the column class", () => {
    const html = generatePortfolioHtml({ cards: cards(20), totalRepos: 200 }, makeConfig());
    expect(html.match(/<li class="pf-card">/g)).toHaveLength(20);
    expect(html).toContain('<ul class="pf-grid pf-cols-3">');
    expect(html).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(html.match(/<ul /g)).toHaveLength(1);
  });

  it("drops to two columns on tablets and one on phones", () => {
    const html = generatePortfolioHtml({ cards: cards(3), totalRepos: 3 }, makeConfig());
    expect(html).toMatch(
      /@media \(max-width: 1024px\) \{\s*\.pf \.pf-grid\.pf-cols-3 \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/,
    );
    expect(html).toMatch(
      /@media \(max-width: 640px\) \{\s*\.pf \.pf-grid\.pf-cols-3 \{ grid-template-columns: 1fr;/,
    );
  });

  it("skips the tablet rule when there are two columns or fewer", () => {
    const html = generatePortfolioHtml(
      { cards: cards(2), totalRepos: 2 },
      makeConfig({ columns: 2 }),
    );
    expect(html).toContain('<ul class="pf-grid pf-cols-2">');
    expect(html).not.toContain("max-width: 1024px");
  });

  it("scopes the style with the pf- prefix and uses the wide column", () => {
    const html = generatePortfolioHtml({ cards: cards(1), totalRepos: 1 }, makeConfig());
    expect(html.startsWith('<div class="pf kg-width-wide">\n<style>')).toBe(true);
    const style = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
    const selectors = style
      .split("\n")
      .filter((l) => l.includes("{") && !l.trim().startsWith("@media"))
      .map((l) => l.trim().split("{")[0].trim());
    for (const sel of selectors) {
      expect(sel.startsWith(".pf")).toBe(true);
    }
  });

  it("renders the intro, escaped, and omits it when empty", () => {
    const html = generatePortfolioHtml(
      { cards: cards(1), totalRepos: 1 },
      makeConfig({ intro: "I <3 code." }),
    );
    expect(html).toContain('<p class="pf-intro">I &lt;3 code.</p>');
    const none = generatePortfolioHtml(
      { cards: cards(1), totalRepos: 1 },
      makeConfig({ intro: "  " }),
    );
    expect(none).not.toContain("pf-intro\">");
  });

  it("ends with one line pointing at the GitHub profile", () => {
    const html = generatePortfolioHtml({ cards: cards(20), totalRepos: 215 }, makeConfig());
    expect(html).toContain(
      '<p class="pf-more">The other 195 public repositories are on <a href="https://github.com/testuser">github.com/testuser</a>.</p>',
    );
    const one = generatePortfolioHtml({ cards: cards(1), totalRepos: 2 }, makeConfig());
    expect(one).toContain("The other 1 public repository is on");
    const all = generatePortfolioHtml({ cards: cards(2), totalRepos: 2 }, makeConfig());
    expect(all).toContain('More on <a href="https://github.com/testuser">');
  });

  it("has no stats footer, badges or rules", () => {
    const html = generatePortfolioHtml({ cards: cards(3), totalRepos: 50 }, makeConfig());
    expect(html).not.toContain("GitHub Stats");
    expect(html).not.toContain("Total Stars");
    expect(html).not.toContain("shields.io");
    expect(html).not.toContain("<hr");
  });
});

describe("buildLexical", () => {
  it("wraps the html in a single html card", () => {
    const doc = buildLexical("<div>x</div>");
    expect(doc.root.type).toBe("root");
    expect(doc.root.direction).toBe("ltr");
    expect(doc.root.children).toEqual([{ type: "html", version: 1, html: "<div>x</div>" }]);
  });
});

describe("preview", () => {
  it("wraps the card in Ghost's html card markers", () => {
    expect(wrapHtmlCard("<p>x</p>")).toBe(
      "<!--kg-card-begin: html-->\n<p>x</p>\n<!--kg-card-end: html-->",
    );
  });

  it("builds a standalone dark page around the card", () => {
    const page = buildPreviewPage("<p>card</p>", "Work & play");
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain('<div class="gh-content gh-canvas">');
    expect(page).toContain("<!--kg-card-begin: html-->\n<p>card</p>");
    expect(page).toContain("<h1 class=\"post-title\">Work &amp; play</h1>");
    expect(page).toContain(".gh-canvas > .kg-width-wide { grid-column: wide; }");
  });
});
