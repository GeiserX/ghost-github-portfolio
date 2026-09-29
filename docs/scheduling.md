# Running on a schedule

## As a GitHub Action

The repository is also a GitHub Action. It installs and builds the tool on the runner and runs `sync --config <config-path> --verbose`, with `GHOST_GITHUB_TOKEN` set to the workflow's `github.token`:

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
      - uses: GeiserX/ghost-github-portfolio@v0.4.0
        with:
          config-path: portfolio/config.yml
          ghost-admin-api-key: ${{ secrets.GHOST_ADMIN_API_KEY }}
```

`config-path` defaults to `config.yml`. The other inputs, `ghost-url`, `ghost-page-slug`, `github-username` and `min-stars`, are optional and override the matching values in the config. The runner has to reach your Ghost URL: a GitHub-hosted runner cannot reach an `originUrl` on a private network.

## Docker

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

## Cron

Or run it from the host's cron, once a day at 06:00:

```
0 6 * * * docker run --rm -v /path/to/config.yml:/config/config.yml:ro --env-file /path/to/portfolio.env drumsergio/ghost-github-portfolio:0.4.0
```

## npx in a workflow

Without the Action, a workflow can run the npm package directly. The same rule about reaching your Ghost URL applies.

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
