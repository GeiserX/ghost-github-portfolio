# How it works

## The page

The page is one Ghost html card with its own scoped style. It holds a short intro, then a card per repository, then one line that points at your GitHub profile. Each card has:

- the repository banner, or a tile with the repository name when there is no usable banner
- the name, linked to GitHub, and the star count as plain text, such as "215 stars"
- one line on what the repository does
- a "Site" link when the repository has a homepage outside github.com

The grid has three columns on desktop, two on tablets and one on phones. On themes built on Ghost's content grid, such as Alto, Source and Casper, the cards take the wide column and the text stays at reading width. The colours suit a dark theme.

[preview-desktop.png](images/screenshots/preview-desktop.png) shows a real run at 1280 px wide, and [preview-mobile.png](images/screenshots/preview-mobile.png) the same page on a phone. [preview-config.yml](preview-config.yml) is the config behind them.

## The sync steps

1. Fetches every public repository the user owns from the GitHub REST API. The API cannot sort by stars, so it reads all pages and sorts locally.
2. Applies the filters, sorts by stars and keeps `maxRepos`.
3. Reads each repository's `.ghost-portfolio.yml`, if any.
4. Checks each banner as described above.
5. Builds one html card and wraps it in the Ghost lexical document format.
6. Fetches the page to get its `updated_at`, then writes the new content through the Admin API with a short-lived JWT.

## Project stats

<a href="https://github.com/GeiserX/ghost-github-portfolio/stargazers"><img src="https://img.shields.io/github/stars/GeiserX/ghost-github-portfolio?style=flat-square&logo=github" alt="Stars"></a>
