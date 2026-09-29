#!/usr/bin/env node

import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { loadConfig, generateExampleConfig } from "./config.js";
import {
  fetchAllRepos,
  selectRepos,
  resolveBanner,
  fetchPortfolioConfig,
} from "./github.js";
import { fetchPage, updatePage } from "./ghost.js";
import {
  generateCard,
  generatePortfolioHtml,
  buildLexical,
  buildPreviewPage,
  wrapHtmlCard,
} from "./generator.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const program = new Command();

program
  .name("ghost-github-portfolio")
  .description(
    "Write your most starred GitHub repositories to a Ghost page as a grid of cards, through the Ghost Admin API.",
  )
  .version(version);

program
  .command("sync")
  .description("Sync GitHub repos to your Ghost portfolio page")
  .requiredOption("-c, --config <path>", "Path to config YAML file")
  .option("--dry-run", "Build the page without updating Ghost")
  .option("--json", "Print the lexical JSON (implies --dry-run)")
  .option(
    "--html-out <file>",
    "Write a standalone preview page of the card (implies --dry-run)",
  )
  .option("-v, --verbose", "Show detailed progress")
  .action(async (opts) => {
    try {
      const config = loadConfig(opts.config);
      const verbose = opts.verbose || false;
      const dryRun = opts.dryRun || opts.json || Boolean(opts.htmlOut);

      if (verbose)
        console.log(
          `Fetching repos for ${config.github.username} (min ${config.portfolio.minStars} stars)...`,
        );
      const allRepos = await fetchAllRepos(config, verbose);
      const repos = selectRepos(allRepos, config);

      console.log(
        `Found ${allRepos.length} public repos, showing ${repos.length}`,
      );

      if (repos.length === 0) {
        console.log("No repos found. Check your config.");
        return;
      }

      // Per-repo .ghost-portfolio.yml: the file gives defaults, config.yml wins.
      // Its description stands in for the GitHub one and is cleaned the same
      // way; only a description in config.yml is used verbatim.
      if (verbose) console.log("Fetching portfolio configs...");
      await Promise.all(
        repos.map(async (repo) => {
          const portfolioConfig = await fetchPortfolioConfig(repo);
          if (!portfolioConfig) return;
          const { description, ...fileOverrides } = portfolioConfig;
          if (description) repo.description = description;
          const existing = config.portfolio.repos[repo.name] ?? {};
          config.portfolio.repos[repo.name] = {
            ...Object.fromEntries(
              Object.entries(fileOverrides).filter(([, v]) => v !== undefined),
            ),
            ...Object.fromEntries(
              Object.entries(existing).filter(([, v]) => v !== undefined),
            ),
          };
          if (verbose) console.log(`  ${repo.name}: loaded .ghost-portfolio.yml`);
        }),
      );

      if (verbose) console.log("Checking banners...");
      const banners = await Promise.all(
        repos.map((repo) => resolveBanner(repo, config)),
      );
      repos.forEach((repo, i) => {
        const { problems } = banners[i];
        if (problems.length > 0) {
          console.warn(
            `Warning: ${repo.name} gets a name tile: ${problems.join("; ")}`,
          );
        }
      });

      const cards = repos.map((repo, i) =>
        generateCard(repo, banners[i].url, config),
      );
      const html = generatePortfolioHtml(
        { cards, totalRepos: allRepos.length },
        config,
      );
      const lexical = buildLexical(html);

      if (opts.json) {
        console.log(JSON.stringify(lexical, null, 2));
        return;
      }

      if (dryRun) {
        console.log("\n--- DRY RUN ---\n");
        repos.forEach((repo, i) => {
          console.log(
            `${repo.name} (${repo.stargazers_count} stars) ${banners[i].url ? "[banner]" : "[tile]"}`,
          );
        });
        console.log(`\nTotal cards: ${cards.length}`);

        const cardPath = "/tmp/ghost-portfolio-preview.html";
        writeFileSync(cardPath, wrapHtmlCard(html));
        console.log(`\nHtml card written to ${cardPath}`);
        if (opts.htmlOut) {
          writeFileSync(opts.htmlOut, buildPreviewPage(html));
          console.log(`Preview page written to ${opts.htmlOut}`);
        }
        return;
      }

      if (verbose) console.log("Fetching Ghost page...");
      const page = await fetchPage(config);
      if (verbose) console.log(`  Page: ${page.title} (${page.id})`);

      if (verbose) console.log("Updating Ghost page...");
      const updated = await updatePage(config, page.id, page.updated_at, lexical);

      console.log(`Portfolio updated: ${updated.title}`);
      console.log(`  ${repos.length} projects displayed`);
      console.log(`  ${banners.filter((b) => b.url).length} banners, ${banners.filter((b) => !b.url).length} tiles`);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Generate an example config file")
  .option("-o, --output <path>", "Output path", "config.yml")
  .action((opts) => {
    writeFileSync(opts.output, generateExampleConfig());
    console.log(`Example config written to ${opts.output}`);
    console.log("Edit the file with your GitHub username and Ghost API key.");
  });

program.parse();
