<p align="center">
  <img src="https://raw.githubusercontent.com/GeiserX/ghost-github-portfolio/main/docs/images/banner.svg" alt="Ghost GitHub Portfolio banner" width="900"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ghost-github-portfolio"><img src="https://img.shields.io/npm/v/ghost-github-portfolio?style=flat-square&logo=npm" alt="npm"></a>
  <a href="https://hub.docker.com/r/drumsergio/ghost-github-portfolio"><img src="https://img.shields.io/docker/pulls/drumsergio/ghost-github-portfolio?style=flat-square&logo=docker" alt="Docker Pulls"></a>
  <a href="https://github.com/GeiserX/ghost-github-portfolio/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/GeiserX/ghost-github-portfolio/ci.yml?style=flat-square&logo=github&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/GeiserX/ghost-github-portfolio?style=flat-square" alt="License"></a>
  <a href="https://codecov.io/gh/GeiserX/ghost-github-portfolio"><img src="https://codecov.io/gh/GeiserX/ghost-github-portfolio/graph/badge.svg" alt="codecov"></a>
</p>

<p align="center"><strong>Keep a Ghost portfolio page in step with your GitHub repositories.</strong></p>

`ghost-github-portfolio` reads your public GitHub repositories, keeps the most starred ones, and writes them to a Ghost page as a grid of cards through the Ghost Admin API. Run it on a schedule and the page follows your star counts.

<p align="center"><img src="https://raw.githubusercontent.com/GeiserX/ghost-github-portfolio/main/docs/preview-desktop.png" alt="Portfolio page preview" width="900"/></p>

## Features

- One Ghost html card with its own scoped style: an intro, a card per repository, and a line pointing at your GitHub profile.
- Each card has the repository banner (or a name tile), the name and star count, one line on what it does, and a "Site" link.
- Three columns on desktop, two on tablets, one on phones; wide cards on Alto, Source and Casper.
- Filters by stars, forks, archived, name patterns and awesome lists, then cuts to `maxRepos`.
- Per-repo overrides in `config.yml` or in a `.ghost-portfolio.yml` inside each repository.
- Checks that each SVG banner is self-contained, and warns when it falls back to a name tile.
- Can write through the Ghost origin when a firewall blocks `<img` in request bodies.
- `--dry-run`, `--json` and `--html-out` previews that never touch Ghost.

## Quick start

```bash
npm install -g ghost-github-portfolio
ghost-github-portfolio init
GHOST_ADMIN_API_KEY=KEY_ID:SECRET ghost-github-portfolio sync --config config.yml --verbose
```

Get the Admin API key in Ghost under Settings, Integrations, "Add custom integration". [Usage](https://github.com/GeiserX/ghost-github-portfolio/blob/main/docs/usage.md) shows how to preview before writing.

## Documentation

- [Usage](https://github.com/GeiserX/ghost-github-portfolio/blob/main/docs/usage.md): install, init, preview and sync
- [Configuration](https://github.com/GeiserX/ghost-github-portfolio/blob/main/docs/configuration.md): `config.yml`, filters, environment variables, descriptions, banners, writing through the Ghost origin
- [Running on a schedule](https://github.com/GeiserX/ghost-github-portfolio/blob/main/docs/scheduling.md): Docker loop, cron, GitHub Actions
- [How it works](https://github.com/GeiserX/ghost-github-portfolio/blob/main/docs/how-it-works.md): the page layout and the sync steps
- [Roadmap](https://github.com/GeiserX/ghost-github-portfolio/blob/main/docs/ROADMAP.md)

## License

[GPL-3.0](LICENSE)
