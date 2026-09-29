# Configuration

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
