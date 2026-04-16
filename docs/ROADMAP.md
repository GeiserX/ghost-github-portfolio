# Roadmap

> This roadmap is aspirational and roughly prioritized. Items may shift between milestones based on community feedback and contributions.

---

## v1.1 - Polish & Reliability

- [ ] **Retry with exponential backoff** for GitHub API and Ghost API calls
- [ ] **Rate limit awareness** - detect GitHub API rate limits (60/hr unauthenticated, 5000/hr with token) and wait/warn accordingly
- [ ] **Concurrent banner detection** with configurable concurrency limit (avoid hammering GitHub for users with 100+ repos)
- [ ] **Config validation with detailed errors** - use Zod schema for config, provide line numbers and suggestions for invalid fields
- [ ] **Progress bar** for sync operations (repo fetching, banner detection, Ghost update)
- [ ] **`--output` flag** for `sync` command to write HTML/JSON to a file without Ghost API
- [ ] **Diff mode** - show what would change before updating (repo additions, removals, reordering)

---

## v1.2 - Themes & Customization

- [ ] **Built-in themes** - ship 5+ card themes out of the box:
  - `default` - current design (banners, badges, descriptions)
  - `minimal` - text-only, clean typography, no badges
  - `compact` - condensed grid layout, smaller cards
  - `dark` - dark background cards with light text (for dark Ghost themes)
  - `terminal` - monospace font, green-on-black hacker aesthetic
  - `academic` - publication-style with citation counts
- [ ] **Custom theme support** - user-provided Handlebars/Mustache templates for cards
- [ ] **Theme preview** - `ghost-github-portfolio preview --theme minimal` opens a local HTML preview in the browser
- [ ] **Custom CSS injection** - allow inline `<style>` via Ghost code injection for users who want full control
- [ ] **Card ordering options** - sort by: stars (default), recently updated, recently created, alphabetical, custom order
- [ ] **Pinned repos** - pin specific repos to the top regardless of sort order
- [ ] **Section grouping** - group repos by language, topic, or custom categories with section headers
- [ ] **Color scheme configuration** - customize badge colors, link colors, accent colors per theme

---

## v1.3 - Rich Content & Metadata

- [ ] **README excerpt extraction** - pull first paragraph or custom section from each repo's README as an extended description
- [ ] **Contribution graph** - embed GitHub-style contribution heatmap (SVG generated at sync time)
- [ ] **Language breakdown bars** - show per-repo language percentages as colored bars (like GitHub's repo page)
- [ ] **Last commit date** - show "Updated 3 days ago" on each card
- [ ] **Release badge** - show latest release version from GitHub Releases
- [ ] **CI status badge** - show build passing/failing from GitHub Actions
- [ ] **Open issues/PRs count** - show community activity metrics
- [ ] **Social preview image** - use repo's OpenGraph image as fallback when no banner exists
- [ ] **Contributor avatars** - show top 3-5 contributor faces on each card
- [ ] **Dependency count** - show number of dependencies as a complexity indicator

---

## v1.4 - Multi-Platform Support

- [ ] **WordPress support** - generate portfolio via WordPress REST API (posts, pages, or custom post types)
- [ ] **Hugo/Jekyll/11ty support** - output Markdown files for static site generators
- [ ] **Notion support** - sync to a Notion database via Notion API
- [ ] **Webflow support** - update Webflow CMS collections via API
- [ ] **Strapi/Directus support** - headless CMS portfolio via their REST APIs
- [ ] **Raw HTML/JSON output** - generate standalone HTML file or JSON feed for custom integrations
- [ ] **RSS feed generation** - output an RSS feed of portfolio changes
- [ ] **Markdown output** - generate a README-style portfolio (useful for GitHub profile READMEs)
- [ ] **Astro/Gatsby data source** - act as a data plugin for popular SSG frameworks

---

## v1.5 - AI-Powered Features

- [ ] **AI-generated descriptions** - use Claude/GPT to rewrite repo descriptions for portfolio context (more engaging, consistent tone)
- [ ] **Auto-categorization** - AI classifies repos into categories (Web Apps, CLI Tools, Libraries, DevOps, etc.) based on README + topics + language
- [ ] **Smart summary** - generate a portfolio introduction paragraph based on all repos ("Sergio is a full-stack developer focused on...")
- [ ] **Tech stack detection** - analyze repo contents (package.json, requirements.txt, go.mod, Dockerfile) to auto-detect full tech stack, not just primary language
- [ ] **Project highlights** - AI picks the most impressive stats/features from each repo's README to feature on the card
- [ ] **SEO optimization** - AI generates meta descriptions and structured data for the Ghost page
- [ ] **Changelog summarization** - AI summarizes recent commits into human-readable "What's New" sections

---

## v1.6 - Analytics & Insights

- [ ] **Sync history** - log each sync run (repos added/removed, star changes, errors) to a local SQLite database
- [ ] **Star velocity tracking** - track star growth over time, show trending repos with a sparkline or "trending" badge
- [ ] **Portfolio analytics dashboard** - CLI command `ghost-github-portfolio stats` showing: total stars over time, most-starred repos, star growth rate, new repos
- [ ] **Ghost page view integration** - if Ghost has analytics enabled, pull page view counts and display on dashboard
- [ ] **Email notifications** - notify when a repo crosses a star milestone (10, 50, 100, 500, 1000)
- [ ] **Webhook support** - trigger webhooks on portfolio changes (new repo added, repo removed, star milestone)
- [ ] **Competitive analysis** - compare your portfolio metrics against similar GitHub users
- [ ] **Monthly digest** - auto-generate a monthly email/page summarizing portfolio changes

---

## v2.0 - Organization & Team Portfolios

- [ ] **GitHub Organization support** - sync repos from an org, not just a user
- [ ] **Multi-user portfolios** - aggregate repos from multiple GitHub users into one page
- [ ] **Team member cards** - show team members with their avatars, roles, and repo contributions
- [ ] **Private repo support** - include private repos with configurable visibility (show name/description but no link, or badge-only)
- [ ] **GitLab support** - fetch repos from GitLab.com or self-hosted GitLab instances
- [ ] **Gitea/Forgejo support** - fetch repos from Gitea/Forgejo instances
- [ ] **Bitbucket support** - fetch repos from Bitbucket Cloud
- [ ] **Codeberg support** - fetch repos from Codeberg
- [ ] **Cross-platform merge** - combine repos from GitHub + GitLab + Gitea into one unified portfolio
- [ ] **Monorepo support** - show individual packages/projects from a monorepo as separate cards

---

## v2.1 - Interactive Portfolio

- [ ] **Search & filter** - inject JavaScript for client-side filtering by language, topic, or text search
- [ ] **Sorting controls** - let visitors sort by stars, date, name from the portfolio page itself
- [ ] **Tag cloud** - auto-generated topic/language tag cloud with filtering
- [ ] **Expandable cards** - click to expand for full README preview without leaving the page
- [ ] **Star button** - "Star on GitHub" button directly on each card (using GitHub's star API with OAuth)
- [ ] **Dark/light mode toggle** - respect user's system preference with manual override
- [ ] **Lazy-loaded images** - progressive loading for banner images on long portfolios
- [ ] **Infinite scroll** - load repos in batches as user scrolls (for 50+ repo portfolios)
- [ ] **Animation** - subtle entrance animations for cards as they scroll into view

---

## v2.2 - Social Proof & Community

- [ ] **Testimonials section** - curated quotes from GitHub issues, Twitter mentions, or manual entries
- [ ] **"Used by" logos** - show logos of companies/projects using your tools (from GitHub dependents or manual config)
- [ ] **Download/install counts** - aggregate npm downloads, Docker pulls, GitHub releases, Homebrew installs
- [ ] **Sponsor button** - show GitHub Sponsors / Buy Me a Coffee / Patreon buttons per repo
- [ ] **Community size** - show total contributors, forks, and dependent projects across all repos
- [ ] **Blog post links** - auto-link related Ghost blog posts to repos (by matching tags/topics)
- [ ] **Changelog feed** - show recent releases across all repos as a timeline
- [ ] **Discussion links** - link to GitHub Discussions if enabled on the repo

---

## v3.0 - Platform & Ecosystem

- [ ] **Web dashboard** - self-hosted web UI for configuring and previewing the portfolio (replaces YAML editing)
- [ ] **SaaS offering** - hosted version at a dedicated domain (no self-hosting required, OAuth login, instant setup)
- [ ] **Portfolio templates marketplace** - community-shared themes and card designs
- [ ] **Plugin system** - extensible architecture for custom badge providers, data sources, and output targets
- [ ] **Multi-page portfolios** - split portfolio across multiple Ghost pages (e.g., by category: "Web Apps", "CLI Tools", "Libraries")
- [ ] **Custom domain landing page** - generate a standalone portfolio site (no CMS required) deployable to Vercel/Netlify/Cloudflare Pages
- [ ] **GitHub App** - install as a GitHub App for automatic sync on push events (no cron needed)
- [ ] **Portfolio API** - expose a JSON API endpoint for third-party integrations
- [ ] **Embeddable widget** - `<script>` tag that renders the portfolio anywhere (blogs, personal sites, LinkedIn)
- [ ] **Ghost theme integration** - distribute as a Ghost theme helper that portfolios can use natively
- [ ] **CLI interactive mode** - `ghost-github-portfolio wizard` with an interactive TUI for config generation and preview

---

## v3.1 - Enterprise & Scale

- [ ] **Multi-tenant support** - single deployment serves multiple users' portfolios
- [ ] **SSO/SAML authentication** - enterprise auth for the web dashboard
- [ ] **Audit log** - track all sync operations, config changes, and API calls
- [ ] **Scheduled syncs** - built-in cron scheduler (no external cron needed)
- [ ] **Queue system** - handle multiple concurrent syncs with job queuing
- [ ] **Caching layer** - cache GitHub API responses to reduce rate limit consumption
- [ ] **CDN integration** - serve banner images through Cloudflare/CloudFront for faster loading
- [ ] **Bulk operations** - sync portfolios for hundreds of users in a single run
- [ ] **Admin API** - REST API for managing multiple portfolio configurations
- [ ] **Monitoring & alerting** - Prometheus metrics endpoint, health checks, sync failure alerts

---

## Stretch Goals

- [ ] **GitHub Sponsors integration** - highlight sponsor-backed repos with a special badge
- [ ] **npm download sparklines** - tiny inline charts showing download trends
- [ ] **Conference talk links** - auto-link conference presentations about your repos
- [ ] **Academic citation tracking** - track papers that cite your tools (via Semantic Scholar API)
- [ ] **Portfolio PDF export** - generate a printable PDF version of the portfolio
- [ ] **Portfolio QR code** - generate a QR code linking to the portfolio page
- [ ] **A/B testing** - test different card layouts and measure Ghost page engagement
- [ ] **i18n** - multi-language portfolio generation (translate badges, descriptions, footer)
- [ ] **Accessibility audit** - ensure generated HTML meets WCAG 2.1 AA standards
- [ ] **Voice-powered updates** - "Hey Claude, sync my portfolio" via Claude Code voice mode
