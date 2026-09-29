# Running on a schedule

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
