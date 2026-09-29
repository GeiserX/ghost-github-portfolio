# Usage

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
