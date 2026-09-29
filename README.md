<p align="center">
  <img src="https://raw.githubusercontent.com/GeiserX/ghost-github-portfolio/main/docs/images/banner.svg" alt="Ghost GitHub Portfolio banner" width="900"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ghost-github-portfolio"><img src="https://img.shields.io/npm/v/ghost-github-portfolio?style=flat-square&logo=npm" alt="npm"></a>
  <a href="https://hub.docker.com/r/drumsergio/ghost-github-portfolio"><img src="https://img.shields.io/docker/pulls/drumsergio/ghost-github-portfolio?style=flat-square&logo=docker" alt="Docker Pulls"></a>
  <a href="https://github.com/GeiserX/ghost-github-portfolio/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/GeiserX/ghost-github-portfolio/ci.yml?style=flat-square&logo=github&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/GeiserX/ghost-github-portfolio?style=flat-square" alt="License"></a>
  <a href="https://github.com/GeiserX/ghost-github-portfolio/stargazers"><img src="https://img.shields.io/github/stars/GeiserX/ghost-github-portfolio?style=flat-square&logo=github" alt="Stars"></a>
  <a href="https://codecov.io/gh/GeiserX/ghost-github-portfolio"><img src="https://codecov.io/gh/GeiserX/ghost-github-portfolio/graph/badge.svg" alt="codecov"></a>
</p>

<p align="center"><strong>Keep a Ghost portfolio page in step with your GitHub repositories.</strong></p>

## What it does

`ghost-github-portfolio` reads your public GitHub repositories, keeps the most starred ones, and writes them to a Ghost page as a grid of cards through the Ghost Admin API. Run it on a schedule and the page follows your star counts.

The page is one Ghost html card with its own scoped style. It holds a short intro, then a card per repository, then one line that points at your GitHub profile. Each card has:

- the repository banner, or a tile with the repository name when there is no usable banner
- the name, linked to GitHub, and the star count as plain text, such as "215 stars"
- one line on what the repository does
- a "Site" link when the repository has a homepage outside github.com

The grid has three columns on desktop, two on tablets and one on phones. On themes built on Ghost's content grid, such as Alto, Source and Casper, the cards take the wide column and the text stays at reading width. The colours suit a dark theme.

[docs/preview-desktop.png](docs/preview-desktop.png) shows a real run at 1280 px wide, and [docs/preview-mobile.png](docs/preview-mobile.png) the same page on a phone. [docs/preview-config.yml](docs/preview-config.yml) is the config behind them.

## Quick start

Install it, or run it with `npx`:

```bash
npm install -g ghost-github-portfolio
```

Write an example config and edit it:

```bash
ghost-github-portfolio init
```

Get an Admin API key in Ghost under Settings, Integrations, "Add custom integration". It looks like `KEY_ID:SECRET`.

Preview the page, then sync it:

```bash
# Builds the page and writes a standalone preview. Ghost is not touched
ghost-github-portfolio sync --config config.yml --html-out preview.html

# Writes the page to Ghost
GHOST_ADMIN_API_KEY=KEY_ID:SECRET ghost-github-portfolio sync --config config.yml --verbose
```

`--dry-run` builds the page and lists each card without writing anything. `--json` prints the Ghost document instead. Both write the html card to `/tmp/ghost-portfolio-preview.html`. `--html-out <file>` also wraps it in a dark page that approximates Ghost's Alto theme, so you can open it in a browser.

## Configuration

```yaml
github:
  username: YOUR_GITHUB_USERNAME
  # token: ghp_xxx          # Optional, for higher rate limits (env: GHOST_GITHUB_TOKEN)
  excludePatterns:          # Regular expressions matched against repo names
    - "^homebrew-"

ghost:
  url: https://your-ghost-blog.com
  adminApiKey: "KEY_ID:SECRET_HEX"  # env GHOST_ADMIN_API_KEY wins over this
  pageSlug: portfolio               # Or pageId with the page's hex ID
  # originUrl: http://ghost:2368    # See "Writing through the Ghost origin"
  # hostHeader: your-ghost-blog.com

portfolio:
  minStars: 2               # Only repos with at least this many stars
  maxRepos: 20              # How many cards, counted after every filter
  columns: 3                # Cards per row on desktop, from 1 to 6
  includeForked: false
  includeArchived: false
  excludeAwesomeLists: true # Skip repos named "awesome*" or tagged "awesome-list"
  showBanner: true
  defaultBannerPath: docs/images/banner.svg
  intro: "I build things nobody asked for, one repo at a time. These are the ones that got the most stars on GitHub, with a line on what each one does."

  bannerPaths:              # Banner path per repo, tried before defaultBannerPath
    my-project: media/banner.svg

  excludeRepos:
    - .github

  repos:                    # Per-repo overrides
    my-project:
      description: "One line that replaces the GitHub description"
      homepage: https://example.com/guide/  # Replaces the GitHub homepage field
      siteLabel: Guide                      # Link text, "Site" by default
      bannerPath: assets/banner.png
      exclude: false
```

Filters run in this order: minimum stars, forks, archived, `excludeRepos`, per-repo `exclude`, `excludePatterns`, awesome lists. The tool sorts what is left by stars and only then cuts it to `maxRepos`, so an excluded repository never takes a slot.

A repository can also carry its own `.ghost-portfolio.yml` at the root of its default branch with `description`, `homepage`, `siteLabel` and `bannerPath`. Values in your `config.yml` win over it.

| Variable | Meaning |
|---|---|
| `GHOST_ADMIN_API_KEY` | Ghost Admin API key. Overrides `ghost.adminApiKey`, which can then be left out. |
| `GHOST_GITHUB_TOKEN` | GitHub token for higher rate limits. Used when `github.token` is not set. The generic `GITHUB_TOKEN` is ignored on purpose. |

## Descriptions and site links

A `description` in `config.yml` is used exactly as written, so that is the place for one-liners you want to keep by hand. Otherwise the tool takes the GitHub description, or the one in `.ghost-portfolio.yml`, and cleans it up:

- it keeps the first sentence only
- em and en dashes become commas
- emoji and `:shortcodes:` are removed
- it is cut to 140 characters at a word boundary

The site link comes from `homepage` in the overrides, else from the repository's homepage field. A homepage on github.com is skipped, since the name already links there.

## Banners

For each repository the tool fetches the per-repo banner path if you set one, then `defaultBannerPath`, from `raw.githubusercontent.com` on the default branch. It uses the first one that passes both checks:

1. It answers HTTP 200.
2. If it is an SVG, it is self-contained. Every `href`, `xlink:href`, `url(...)` and `@import` must point at a `#id` inside the file or at a `data:` URI. Browsers never load other files referenced by an SVG that is shown through `<img>`, so a banner that pulls in `logo.png` or a web font comes out blank or broken on the page.

When no path passes, the card gets a tile with the repository name, and the run prints a warning that names the reason so you can fix the source:

```
Warning: my-project gets a name tile: docs/images/banner.svg: not self-contained, it loads logo.png
Warning: other-project gets a name tile: docs/images/banner.svg: missing (HTTP 404)
```

To make an SVG self-contained, inline the images it references as base64 `data:` URIs, or redraw them as SVG shapes. The card shows the banner in a 9:2 box and crops it around the centre, so a 900x200 banner fits exactly.

## Writing through the Ghost origin

Some setups put a web application firewall in front of the public Ghost URL that rejects request bodies containing `<img`, which every portfolio update does. Set `ghost.originUrl` to reach Ghost directly instead, for example on the local network:

```yaml
ghost:
  url: https://your-ghost-blog.com
  originUrl: http://ghost-host:2368
  hostHeader: your-ghost-blog.com   # Defaults to the host of url
```

Admin API requests then go to `originUrl` with `Host: <hostHeader>` and `X-Forwarded-Proto: https`, so Ghost answers as it does for the public site. The token audience stays `/admin/`. The tool does not follow redirects, because a redirect would lead back through the public URL. Without `originUrl` the requests go to `url` as before.

## Running on a schedule

The Docker image runs one sync and exits. To keep it running, loop inside the container and let Docker restart it after a reboot:

```bash
docker run -d --name ghost-portfolio --restart unless-stopped \
  -v /path/to/config.yml:/config/config.yml:ro \
  --env-file /path/to/portfolio.env \
  --entrypoint sh \
  drumsergio/ghost-github-portfolio:0.4.0 \
  -c 'while true; do node dist/index.js sync --config /config/config.yml; sleep 86400; done'
```

`portfolio.env` holds `GHOST_ADMIN_API_KEY=KEY_ID:SECRET` and, if you want it, `GHOST_GITHUB_TOKEN`.

Or run it from the host's cron, once a day at 06:00:

```
0 6 * * * docker run --rm -v /path/to/config.yml:/config/config.yml:ro --env-file /path/to/portfolio.env drumsergio/ghost-github-portfolio:0.4.0
```

A GitHub Actions schedule works too, as long as the runner can reach your Ghost URL. A GitHub-hosted runner cannot reach an `originUrl` on a private network.

```yaml
name: Update portfolio

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx ghost-github-portfolio@0.4.0 sync --config config.yml --verbose
        env:
          GHOST_ADMIN_API_KEY: ${{ secrets.GHOST_ADMIN_API_KEY }}
          GHOST_GITHUB_TOKEN: ${{ github.token }}
```

Keep `config.yml` in the repository without the key, and store the key as a secret.

## How it works

1. Fetches every public repository the user owns from the GitHub REST API. The API cannot sort by stars, so it reads all pages and sorts locally.
2. Applies the filters, sorts by stars and keeps `maxRepos`.
3. Reads each repository's `.ghost-portfolio.yml`, if any.
4. Checks each banner as described above.
5. Builds one html card and wraps it in the Ghost lexical document format.
6. Fetches the page to get its `updated_at`, then writes the new content through the Admin API with a short-lived JWT.

## License

[GPL-3.0](LICENSE)
