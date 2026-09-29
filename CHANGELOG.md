# Changelog

## 0.4.0

### Breaking

- The page is now one Ghost html card with a scoped style: a short intro, a grid of cards and one closing line that points at the GitHub profile. The grid has three columns on desktop, two on tablets and one on phones. Each card has the banner or a name tile, the name linked to GitHub, one line of description, the star count as plain text and an optional site link.
- Removed from the output: the shields.io badges, forks, licence, Docker pulls, personal notes, key features, tech stack, the "GitHub Stats" footer and the horizontal rules. The config keys `badgeStyle`, `centerContent` and `footer` and the per-repo keys `personalNote`, `dockerImage`, `badges`, `keyFeatures` and `techStack` no longer do anything.
- New defaults: `maxRepos` drops from 50 to 20, `excludeAwesomeLists` turns on, archived repositories are skipped, and `github.excludePatterns` skips `^homebrew-` names.
- Banner detection no longer guesses among eight paths. It tries the per-repo path, then `defaultBannerPath`.

### Added

- `portfolio.columns`, desktop columns from 1 to 6.
- `portfolio.intro`, the paragraph above the grid.
- `github.excludePatterns`, regular expressions that skip repositories by name.
- `portfolio.includeArchived`. Archived repositories are skipped by default.
- Per-repo `homepage` and `siteLabel` overrides for the site link, also read from `.ghost-portfolio.yml`.
- Banner checks. A banner is used only when it answers HTTP 200 and, for SVG, loads nothing from outside itself. Otherwise the card gets a name tile and the run prints a warning with the reason.
- Description cleanup for GitHub descriptions: first sentence only, dashes turned into commas, emoji removed, at most 140 characters. A `description` in `config.yml` is still used as written.
- `ghost.originUrl` and `ghost.hostHeader`, to write through the Ghost origin with the public Host header when a firewall in front of the public URL rejects the update.
- `sync --html-out <file>`, which writes a standalone preview page and does not touch Ghost.

### Fixed

- `maxRepos` now applies after every filter, so excluded repositories and awesome lists no longer take slots.
- `GHOST_ADMIN_API_KEY` now overrides `ghost.adminApiKey`, as the README said it did. The config key can be left out when the variable is set.
- `--version` reports the version from `package.json`.
