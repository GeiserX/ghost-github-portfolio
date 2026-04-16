# AGENTS.md - AI Agent Instructions for ghost-github-portfolio

> ⚠️ **IMPORTANT**: Do NOT update this file unless the user explicitly says to. Only the user can authorize changes to AGENTS.md.

> 📦 **RELEASE REMINDER**: npm publishing and Docker push are handled by GitHub Actions on tag push (`v*`). Do NOT run `npm publish` locally. Do NOT create git tags manually. Push a tag and the workflow handles npm + Docker Hub + GitHub Release.

> 🔒 **SECURITY WARNING**: This repository is PUBLIC at [github.com/GeiserX/ghost-github-portfolio](https://github.com/GeiserX/ghost-github-portfolio). **NEVER commit secrets, API keys, Ghost admin tokens, or any sensitive data.** All secrets must go through:
> - GitHub Secrets (for CI/CD and GitHub Action inputs)
> - Environment variables (`GHOST_GITHUB_TOKEN`, `GHOST_ADMIN_API_KEY`)
> - Local `config.yml` (gitignored)

---

## Project Overview

**ghost-github-portfolio** is a CLI tool, Docker image, and GitHub Action that auto-syncs GitHub repositories to a Ghost CMS portfolio page. It fetches repos via the GitHub REST API, sorts by stars, generates HTML cards with dynamic banners and shields.io badges, and updates a Ghost page via the Admin API using the lexical editor format.

- **npm**: `ghost-github-portfolio`
- **Docker Hub**: `drumsergio/ghost-github-portfolio`
- **Repository**: https://github.com/GeiserX/ghost-github-portfolio
- **License**: GPL-3.0

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| TypeScript | Language (strict mode, ES2022, NodeNext) |
| Node.js 18+ | Runtime (native `fetch`, `crypto`) |
| Commander | CLI framework |
| YAML | Config file parsing |
| Vitest | Test framework |
| Docker | Multi-stage Alpine container |
| GitHub Actions | CI (Node 18/20/22 matrix), Release (npm + Docker + GH Release) |

**Zero external HTTP dependencies** - uses only Node.js native `fetch` and `crypto`. No axios, no node-fetch, no jsonwebtoken.

---

## Architecture

```
src/
├── index.ts       # CLI entry point (commander: sync + init commands)
├── config.ts      # YAML config loader, defaults, env var overrides, validation
├── github.ts      # GitHub REST API: fetch all repos (paginated), sort client-side, detect banners via HEAD
├── ghost.ts       # Ghost Admin API: JWT generation (HS256), fetch page, update page (lexical format)
├── generator.ts   # HTML card generation: banners, badges, footer, lexical document builder
└── types.ts       # TypeScript interfaces: Config, GitHubRepo, LexicalDocument, CustomBadge
```

### Key Design Decisions

1. **Client-side star sorting**: GitHub REST API `/users/{user}/repos` does NOT support `sort=stars`. All pages are fetched, then sorted in memory. Do NOT add `sort=stars` to the API URL - it is an invalid parameter that causes unpredictable ordering.

2. **`GHOST_GITHUB_TOKEN` only**: The env var is intentionally NOT `GITHUB_TOKEN`. The standard `GITHUB_TOKEN` env var is often set by CI runners or `gh` CLI and may hold tokens with wrong scopes. Using a dedicated name avoids accidental token pickup.

3. **Ghost lexical format**: Ghost uses lexical (NOT mobiledoc) for its editor. The document is a JSON AST with `html` nodes and `horizontalrule` nodes. See `types.ts` for the schema.

4. **JWT authentication**: Ghost Admin API uses HS256 JWT with the key ID in the `kid` header field. The secret is hex-decoded. Tokens expire in 5 minutes. Implementation is in `ghost.ts` using only `node:crypto`.

5. **Banner detection**: Checks multiple candidate paths via HEAD requests to `raw.githubusercontent.com`. Config overrides take priority, then default path, then candidates list. All checks are parallel per repo.

6. **Dynamic badges**: All shields.io badges are live URLs — stars, forks, Docker pulls update on every page view without re-running the tool. Only the page structure (which repos, order, banners) requires re-syncing.

---

## CI/CD

### Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Push to main, PRs | Build + lint + test on Node 18/20/22; Docker build + verify |
| `release.yml` | Tag push `v*` | npm publish, Docker multi-arch build (amd64+arm64) to Docker Hub, GitHub Release |
| `stale.yml` | Daily schedule | Auto-close stale issues (14d stale + 14d close) |

### Release Process

```bash
# 1. Bump version in package.json
npm version minor --no-git-tag-version   # or patch/major

# 2. Commit
git add package.json package-lock.json
git commit -m "feat: description of changes"

# 3. Create and push tag
git tag v1.1.0
git push origin main --tags

# 4. release.yml handles: npm publish + Docker push + GH Release
```

**NEVER** run `npm publish` locally or create GitHub Releases manually.

---

## Code Conventions

### General Rules
- TypeScript strict mode (`strict: true` in tsconfig)
- ESM modules (`"type": "module"` in package.json)
- All imports use `.js` extension (NodeNext resolution)
- No external HTTP libraries — native `fetch` only
- No JWT libraries — manual HS256 via `node:crypto`
- Tests use Vitest with `.test.ts` suffix
- Config file is YAML (not JSON, not TOML)

### File Naming
- Source: `src/*.ts` (flat structure, no nested directories)
- Tests: `src/*.test.ts` (co-located with source)
- Config: `config.yml` (gitignored, user-provided)

### Error Handling
- Throw descriptive `Error` with context (API status, body preview)
- CLI catches at top level and exits with code 1
- No silent failures — banner detection returns `null` on failure, but HTTP errors throw

### HTML Generation
- All user-provided strings go through `escapeHtml()` (XSS prevention)
- Badges use shields.io dynamic URLs (not static SVGs)
- Cards use inline styles (Ghost strips `<style>` blocks and classes)
- Ghost lexical format requires specific node types — do NOT invent new node types

---

## Config Schema

The config YAML has three top-level keys:

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
  maxRepos: 50
  includeForked: false
  badgeStyle: for-the-badge
  showBanner: true
  centerContent: true
  defaultBannerPath: docs/images/banner.svg
  bannerPaths: {}      # repo-name: path overrides
  excludeRepos: []
  repos: {}            # Per-repo overrides (description, dockerImage, badges, techStack, keyFeatures)
  footer:
    showStats: true
    showViewAll: true
```

---

## Testing

```bash
npm test              # Run all tests (vitest)
npm run test:watch    # Watch mode
```

### Test Files
- `src/config.test.ts` — Config loading, defaults, validation errors
- `src/generator.test.ts` — Card generation, badges, banners, centering, escaping, footer, lexical structure
- `src/ghost.test.ts` — JWT structure, header kid, payload aud, signature verification

### What to Test
- Config validation (missing fields throw descriptive errors)
- Badge generation for all types (stars, forks, license, docker, website, awesome-list, custom)
- HTML escaping of user-provided content
- Lexical document structure matches Ghost's expected format
- Banner URL construction with overrides

---

## Docker

Multi-stage build:
1. **Builder**: `node:22-alpine`, `npm ci`, `tsc`
2. **Runtime**: `node:22-alpine`, production deps only, copies `dist/`

```bash
# Build
docker build -t ghost-github-portfolio .

# Run
docker run --rm -v /path/to/config.yml:/config/config.yml ghost-github-portfolio
```

Entrypoint is `node dist/index.js`, default CMD is `sync --config /config/config.yml`.

---

## GitHub Action

Composite action that installs Node 22, builds from source, and runs sync. Inputs:
- `config-path` (default: `config.yml`)
- `ghost-url`, `ghost-admin-api-key`, `ghost-page-slug` (override config)
- `github-username`, `min-stars`

---

## Common Pitfalls

1. **Ghost redirects to canonical URL**: Ghost 301-redirects all API requests to its configured canonical URL. Always use the public Ghost URL, not localhost.
2. **`updated_at` concurrency**: Ghost uses optimistic concurrency. The PUT request must include the current `updated_at` from a fresh GET. Stale values cause 409 errors.
3. **GitHub pagination**: The API returns max 100 repos per page. Must loop until `repos.length < perPage`. Never assume a single page is enough.
4. **Inline styles only**: Ghost strips CSS classes and `<style>` tags. All styling must use inline `style=""` attributes.
5. **Banner HEAD requests**: `raw.githubusercontent.com` returns 404 for missing files — no error page. HEAD requests are cheap and reliable for detection.

---

## Checklist for AI Agents

Before completing a task, verify:

- [ ] TypeScript compiles without errors (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] No secrets in code or config files
- [ ] HTML output uses `escapeHtml()` for user content
- [ ] Ghost lexical format is valid (html + horizontalrule nodes only)
- [ ] Changes work with Node 18, 20, and 22
- [ ] Docker build succeeds
- [ ] README updated if public API changed

---

*Generated by [LynxPrompt](https://lynxprompt.com) CLI*
