# CLAUDE.md — Ghost GitHub Portfolio

## Overview
Writes a Ghost page with the owner's top GitHub repositories by stars: one html card with scoped CSS holding a responsive grid (3, 2, 1 columns) of banner tiles, name, one-line description, star count and optional Site link. Since 0.4.0 there are no badges, no footer and no stats block.

## Tech Stack
- TypeScript (strict mode, ES2022, NodeNext, ESM)
- Node.js 18+ (native `fetch`, `crypto` — zero external HTTP dependencies)
- Commander (CLI framework)
- YAML (config file parsing)
- Vitest (test framework)
- Docker (multi-stage Alpine container, image: `drumsergio/ghost-github-portfolio`)
- GitHub Actions CI (Node 18/20/22 matrix), Release (npm + Docker + GH Release)
- Ghost Admin API (lexical editor format, HS256 JWT auth)

## Development
```bash
npm install
npm run dev          # run with tsx
npm run build        # compile TypeScript
npm run test         # vitest run
npm run test:watch   # vitest watch mode
npm run lint         # tsc --noEmit
```

## Architecture
```
src/
├── index.ts       # CLI entry point (commander: sync + init commands)
├── config.ts      # YAML config loader, defaults, env var overrides, validation
├── github.ts      # GitHub REST API: fetch all repos (paginated), sort client-side, filter, validate banners (200 + self-contained SVG)
├── ghost.ts       # Ghost Admin API: JWT generation (HS256), fetch page, update page (lexical format)
├── generator.ts   # The single html card: intro, grid of tiles, closing line; lexical document builder
├── http.ts        # rawRequest over node:http/https for the origin route (fetch drops a custom Host header)
└── types.ts       # TypeScript interfaces: Config, GitHubRepo, LexicalDocument, CustomBadge
```

Other files:
- `dist/` — compiled output (CLI entrypoint)
- `docs/` — documentation and images
- `action.yml` — GitHub Action definition
- `Dockerfile` — multi-stage container build
- `vitest.config.ts` — test configuration

## Key Rules
- Never hardcode Ghost API credentials; use config.yml or environment variables
- Docker images published to Docker Hub with semver tags (never `:latest`)
- Ghost page content uses lexical format (not mobiledoc)
- Supports dry-run mode for previewing changes without writing to Ghost
- `GHOST_GITHUB_TOKEN` is the env var (NOT `GITHUB_TOKEN` — avoids accidental CI token pickup)

## Design Decisions

1. **Client-side star sorting**: GitHub REST API `/users/{user}/repos` does NOT support `sort=stars`. All pages are fetched, then sorted in memory. Do NOT add `sort=stars` to the API URL.
2. **Ghost lexical format**: The document is a JSON AST with `html` nodes and `horizontalrule` nodes. Do NOT invent new node types.
3. **JWT authentication**: Ghost Admin API uses HS256 JWT with key ID in `kid` header. Secret is hex-decoded. Tokens expire in 5 minutes. Implemented via `node:crypto` only.
4. **Banner validation**: the per-repo `bannerPaths` entry, else `defaultBannerPath`, fetched from `raw.githubusercontent.com`; used only if it answers 200 and, for SVG, has no relative or external `href`/`url()` reference (browsers never load those inside an `<img>`). Otherwise a typographic tile of the same 9:2 shape, and a warning naming the reason.
5. **No badges, no stats**: removed in 0.4.0 on purpose. Stars are plain text and refresh when the tool runs.
6. **One html card with a scoped `<style>`**: Ghost keeps `<style>` inside an html card (`<!--kg-card-begin: html-->`), class prefix `pf-`. The card sits in the theme's wide column.
7. **Origin route**: `ghost.originUrl` + `ghost.hostHeader` send Admin API requests to the container directly with `Host: <hostHeader>` and `X-Forwarded-Proto: https`, because the WAF in front of the public URL (Coraza in Caddy) rejects bodies containing `<img`. Implemented with `node:http` because `fetch` silently drops a custom Host header.
8. **Descriptions**: a `description` in config.yml is used verbatim; GitHub descriptions and per-repo `.ghost-portfolio.yml` lines are cut to the first sentence, dashes become commas, emoji are removed, 140 characters max.

## CI/CD and Release Process

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Push to main, PRs | Build + lint + test on Node 18/20/22; Docker build + verify |
| `release.yml` | Tag push `v*` | npm publish, Docker multi-arch build (amd64+arm64) to Docker Hub, GitHub Release |
| `stale.yml` | Daily schedule | Auto-close stale issues (14d stale + 14d close) |

```bash
# Release steps:
npm version minor --no-git-tag-version   # or patch/major
git add package.json package-lock.json
git commit -m "feat: description of changes"
git tag v1.1.0
git push origin main --tags
# release.yml handles: npm publish + Docker push + GH Release
```

**NEVER** run `npm publish` locally or create GitHub Releases manually.

## Code Conventions

- TypeScript strict mode, ESM modules (`"type": "module"`)
- All imports use `.js` extension (NodeNext resolution)
- No external HTTP libraries: native `fetch`, plus `node:http`/`node:https` for the origin route
- No JWT libraries — manual HS256 via `node:crypto`
- Tests use Vitest with `.test.ts` suffix, co-located with source
- Config file is YAML (not JSON, not TOML)
- All user-provided strings go through `escapeHtml()` (XSS prevention)

## Config Schema

```yaml
github:
  username: string     # Required
  token: string        # Optional (env: GHOST_GITHUB_TOKEN)

ghost:
  url: string          # Required (trailing slash stripped)
  adminApiKey: string  # Required, format "KEY_ID:SECRET_HEX" (env: GHOST_ADMIN_API_KEY)
  pageId: string       # One of pageId or pageSlug required
  pageSlug: string     # One of pageId or pageSlug required

portfolio:             # All optional, has defaults
  minStars: 2
  maxRepos: 20         # applied AFTER excludeAwesomeLists, excludeRepos and includeArchived
  columns: 3
  includeForked: false
  includeArchived: false
  excludeAwesomeLists: true
  excludePatterns: ["^homebrew-"]
  intro: string        # the paragraph above the grid
  showBanner: true
  defaultBannerPath: docs/images/banner.svg
  bannerPaths: {}      # repo-name: path overrides
  excludeRepos: []
  repos: {}            # Per-repo overrides (description verbatim, siteLabel, homepage)
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

Test files:
- `src/config.test.ts` — Config loading, defaults, validation errors
- `src/generator.test.ts` — Card generation, badges, banners, centering, escaping, footer, lexical structure
- `src/ghost.test.ts` — JWT structure, header kid, payload aud, signature verification

## Docker

Multi-stage build: Builder (`node:22-alpine`, `npm ci`, `tsc`) then Runtime (`node:22-alpine`, production deps only).

```bash
docker build -t ghost-github-portfolio .
docker run --rm -v /path/to/config.yml:/config/config.yml ghost-github-portfolio
```

Entrypoint: `node dist/index.js`, default CMD: `sync --config /config/config.yml`.

## GitHub Action

Composite action that installs Node 22, builds from source, and runs sync. Inputs:
- `config-path` (default: `config.yml`)
- `ghost-url`, `ghost-admin-api-key`, `ghost-page-slug` (override config)
- `github-username`, `min-stars`

## Common Pitfalls

1. **Ghost redirects to canonical URL**: use the public Ghost URL, or `originUrl` with `hostHeader` set to the canonical host.
2. **`updated_at` concurrency**: Ghost uses optimistic concurrency — PUT must include current `updated_at` from a fresh GET. Stale values cause 409 errors.
3. **GitHub pagination**: API returns max 100 repos per page. Must loop until `repos.length < perPage`.
4. **Banner checks**: `raw.githubusercontent.com` returns 404 for missing files. The SVG body is fetched to check it is self-contained.
5. **Deployment for geiser.cloud**: the scheduled workflow `.github/workflows/portfolio.yml` in `GeiserX/cv` runs this action every six hours on a GitHub-hosted runner with `portfolio/config.yml` from that repo and the key from its `GHOST_ADMIN_API_KEY` secret, through the public Admin API: geiserback's Caddy has a Coraza exclusion (rules 104/105) that skips inspection for `/ghost/api/admin/` requests carrying a `Authorization: Ghost` header. Nothing runs on a home box.

*Generated by [LynxPrompt](https://lynxprompt.com) CLI*
