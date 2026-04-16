# Roadmap

> Organized by phases, not versions. Items may shift between phases based on community feedback and contributions.

---

## Phase 1: Foundation (current)

Core reliability, testing, and polish for daily use.

- [x] CLI with `sync` and `init` commands
- [x] GitHub repo fetching with client-side star sorting
- [x] Banner detection via HEAD requests to raw.githubusercontent.com
- [x] Dynamic shields.io badges (stars, forks, license, Docker, website, awesome-list, custom)
- [x] Ghost Admin API integration with JWT auth (lexical format)
- [x] Per-repo config overrides (description, badges, tech stack, banner path)
- [x] Dry-run and JSON output modes
- [x] Docker multi-stage image
- [x] GitHub Action (composite)
- [x] CI matrix (Node 18/20/22) + Docker build verification
- [x] Retry with exponential backoff for all HTTP calls
- [x] GitHub API rate limit awareness and wait-then-retry
- [x] Export `generateJwt` for proper test imports
- [x] Tests for `github.ts` (fetch, filter, sort, pagination, banner detection)
- [x] Tests for `http.ts` (retry logic, rate limit handling)
- [x] Wire all action.yml inputs (ghost-url, page-slug, username, min-stars)
- [ ] Config validation with schema (Zod) and descriptive errors
- [ ] `--diff` flag to show what would change before updating
- [ ] Concurrent banner detection with configurable limit
- [ ] Progress output for long-running syncs
- [ ] `--output` flag to write HTML/JSON to file without Ghost

---

## Phase 2: Themes & Presentation

Multiple card layouts and visual customization.

- [ ] **Theme engine** with built-in themes:
  - `default` — current design (banners, badges, descriptions)
  - `minimal` — text-only, clean typography, no badges
  - `compact` — condensed grid layout, smaller cards
  - `dark` — dark background cards for dark Ghost themes
  - `terminal` — monospace, green-on-black hacker aesthetic
  - `academic` — publication-style with citation counts
- [ ] Custom theme support via user-provided Handlebars templates
- [ ] `ghost-github-portfolio preview --theme minimal` opens local HTML preview in browser
- [ ] Card ordering options: stars (default), recently updated, recently created, alphabetical, custom order
- [ ] Pinned repos — pin specific repos to the top regardless of sort
- [ ] Section grouping — group repos by language, topic, or custom categories with headers
- [ ] Color scheme configuration — accent colors, badge colors, link colors per theme
- [ ] Custom CSS injection via Ghost code injection for full control

---

## Phase 3: Rich Content & Metadata

Pull more data from GitHub to enrich portfolio cards.

- [ ] README excerpt extraction — first paragraph or custom section as extended description
- [ ] Language breakdown bars — per-repo language percentages as colored bars
- [ ] Last commit date — "Updated 3 days ago" on each card
- [ ] Latest release badge from GitHub Releases
- [ ] CI status badge from GitHub Actions
- [ ] Open issues/PRs count as activity metrics
- [ ] Social preview image as banner fallback when no SVG/PNG exists
- [ ] Contributor avatars — top 3-5 contributor faces per card
- [ ] Tech stack auto-detection from package.json, requirements.txt, go.mod, Dockerfile
- [ ] Contribution heatmap — GitHub-style activity graph (SVG, generated at sync time)

---

## Phase 4: Multi-Platform Output

Expand beyond Ghost to other CMS platforms and static outputs.

- [ ] **WordPress** — generate portfolio via WordPress REST API
- [ ] **Hugo / Jekyll / 11ty** — output Markdown files for static site generators
- [ ] **Notion** — sync to a Notion database via Notion API
- [ ] **Webflow** — update CMS collections via Webflow API
- [ ] **Strapi / Directus** — headless CMS portfolio via their REST APIs
- [ ] **Raw HTML** — standalone HTML file for custom integrations
- [ ] **Markdown** — README-style portfolio for GitHub profile READMEs
- [ ] **JSON feed** — structured data for custom consumers
- [ ] **RSS** — feed of portfolio changes
- [ ] Astro / Gatsby data source plugin

---

## Phase 5: AI-Powered Features

Use LLMs to make portfolios smarter and more engaging.

- [ ] AI-rewritten descriptions — consistent, engaging tone across all repos
- [ ] Auto-categorization — classify repos into groups (Web Apps, CLI Tools, Libraries, DevOps)
- [ ] Smart portfolio intro — generate "About me" paragraph from repo data
- [ ] Project highlights — pick the most impressive stats/features from each README
- [ ] SEO optimization — generate meta descriptions and structured data
- [ ] Changelog summarization — human-readable "What's New" from recent commits
- [ ] Smart tech stack — analyze repo contents for full stack detection beyond primary language

---

## Phase 6: Analytics & Insights

Track portfolio metrics and growth over time.

- [ ] Sync history — log each run (repos added/removed, star changes) to local SQLite
- [ ] Star velocity tracking — growth trends, sparklines, "trending" badges
- [ ] `ghost-github-portfolio stats` CLI dashboard — total stars, growth rate, top repos
- [ ] Ghost page view integration — pull analytics if available
- [ ] Email notifications — alert on star milestones (10, 50, 100, 500, 1000)
- [ ] Webhook support — trigger on portfolio changes
- [ ] Monthly digest — auto-generate summary of portfolio changes
- [ ] Competitive benchmarking — compare metrics against similar GitHub users

---

## Phase 7: Organization & Team Portfolios

Support organizations, teams, and multi-source portfolios.

- [ ] GitHub Organization support — sync repos from an org
- [ ] Multi-user aggregation — combine repos from multiple GitHub users
- [ ] Team member cards with avatars, roles, and contributions
- [ ] Private repo support — configurable visibility (name only, badge only, full card)
- [ ] **GitLab** — fetch from GitLab.com or self-hosted instances
- [ ] **Gitea / Forgejo** — fetch from Gitea/Forgejo instances
- [ ] **Bitbucket** — fetch from Bitbucket Cloud
- [ ] **Codeberg** — fetch from Codeberg
- [ ] Cross-platform merge — unified portfolio from GitHub + GitLab + Gitea
- [ ] Monorepo support — show individual packages as separate cards

---

## Phase 8: Interactive Portfolio

Client-side interactivity injected into the Ghost page.

- [ ] Search & filter — JavaScript for filtering by language, topic, or text
- [ ] Sorting controls — let visitors sort by stars, date, name on the page
- [ ] Tag cloud — auto-generated topic/language cloud with filtering
- [ ] Expandable cards — click to see full README preview inline
- [ ] Star on GitHub button — direct star via GitHub OAuth
- [ ] Dark/light mode toggle — respect system preference
- [ ] Lazy-loaded banner images for long portfolios
- [ ] Subtle entrance animations on scroll

---

## Phase 9: Social Proof & Community

Showcase adoption, sponsorship, and community engagement.

- [ ] Testimonials section — curated quotes from issues, Twitter, or manual config
- [ ] "Used by" logos — company/project logos from GitHub dependents or config
- [ ] Aggregated download counts — npm + Docker + GitHub Releases + Homebrew
- [ ] Sponsor buttons — GitHub Sponsors / Buy Me a Coffee / Patreon per repo
- [ ] Community size — total contributors, forks, dependent projects
- [ ] Related blog posts — auto-link Ghost posts by matching tags/topics
- [ ] Changelog timeline — recent releases across all repos
- [ ] Discussion links — link to GitHub Discussions if enabled

---

## Phase 10: Platform & Ecosystem

Transform from CLI tool to a full platform.

- [ ] **Web dashboard** — self-hosted UI for configuring and previewing portfolios
- [ ] **SaaS offering** — hosted version with OAuth login, instant setup, no self-hosting
- [ ] Portfolio templates marketplace — community themes and card designs
- [ ] Plugin system — extensible architecture for custom badge providers, data sources, outputs
- [ ] Multi-page portfolios — split across Ghost pages by category
- [ ] Custom domain landing page — standalone portfolio site deployable to Vercel/Netlify/CF Pages
- [ ] **GitHub App** — install for automatic sync on push events (no cron needed)
- [ ] Portfolio JSON API — expose endpoint for third-party integrations
- [ ] Embeddable widget — `<script>` tag to render portfolio anywhere
- [ ] Ghost theme helper — native integration for Ghost themes
- [ ] Interactive CLI wizard — TUI for config generation and preview

---

## Phase 11: Enterprise & Scale

Multi-tenant support and enterprise features.

- [ ] Multi-tenant — single deployment serves multiple users
- [ ] SSO/SAML authentication for web dashboard
- [ ] Audit log — track sync operations, config changes, API calls
- [ ] Built-in cron scheduler — no external cron needed
- [ ] Job queue — handle concurrent syncs with queuing
- [ ] Caching layer — cache GitHub API responses to reduce rate limit usage
- [ ] CDN integration — serve banners through Cloudflare/CloudFront
- [ ] Bulk operations — sync hundreds of portfolios in one run
- [ ] Admin REST API for managing portfolio configurations
- [ ] Prometheus metrics endpoint + health checks + failure alerts

---

## Stretch Goals

- [ ] GitHub Sponsors integration — highlight sponsor-backed repos
- [ ] npm download sparklines — inline trend charts
- [ ] Conference talk links per repo
- [ ] Academic citation tracking via Semantic Scholar API
- [ ] Portfolio PDF export
- [ ] Portfolio QR code generation
- [ ] A/B testing for card layouts with engagement metrics
- [ ] i18n — multi-language portfolio generation
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] Voice-powered updates via Claude Code voice mode
