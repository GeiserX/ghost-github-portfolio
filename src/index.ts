#!/usr/bin/env node

import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { loadConfig, generateExampleConfig } from "./config.js";
import { fetchRepos, detectBanner, fetchPortfolioConfig } from "./github.js";
import { fetchPage, updatePage } from "./ghost.js";
import { generateCard, generateFooter, buildLexical } from "./generator.js";

const program = new Command();

program
  .name("ghost-github-portfolio")
  .description(
    "Auto-sync GitHub repositories to a Ghost CMS portfolio page. Fetches repos, sorts by stars, generates cards with banners and badges, and updates Ghost via the Admin API.",
  )
  .version("0.2.0");

program
  .command("sync")
  .description("Sync GitHub repos to your Ghost portfolio page")
  .requiredOption("-c, --config <path>", "Path to config YAML file")
  .option("--dry-run", "Output generated HTML without updating Ghost")
  .option("--json", "Output raw lexical JSON (implies --dry-run)")
  .option("-v, --verbose", "Show detailed progress")
  .action(async (opts) => {
    try {
      const config = loadConfig(opts.config);
      const verbose = opts.verbose || false;
      const dryRun = opts.dryRun || opts.json || false;

      // Fetch repos
      if (verbose)
        console.log(
          `Fetching repos for ${config.github.username} (min ${config.portfolio.minStars} stars)...`,
        );
      const repos = await fetchRepos(config);
      console.log(
        `Found ${repos.length} repos matching criteria (${config.portfolio.minStars}+ stars)`,
      );

      if (repos.length === 0) {
        console.log("No repos found. Check your config.");
        return;
      }

      // Detect banners (parallel)
      if (verbose) console.log("Detecting banner images...");
      const bannerResults = await Promise.all(
        repos.map(async (repo) => {
          const banner = await detectBanner(repo, config);
          if (verbose) {
            console.log(
              `  ${repo.name}: ${banner ? "found" : "no banner"}`,
            );
          }
          return { repo, banner };
        }),
      );

      // Fetch per-repo portfolio configs (.ghost-portfolio.yml)
      if (verbose) console.log("Fetching portfolio configs...");
      await Promise.all(
        repos.map(async (repo) => {
          const portfolioConfig = await fetchPortfolioConfig(repo, config);
          if (portfolioConfig) {
            // Merge: per-repo file provides defaults, config.yml overrides
            const existing = config.portfolio.repos[repo.name] ?? {};
            config.portfolio.repos[repo.name] = {
              ...portfolioConfig,
              ...Object.fromEntries(
                Object.entries(existing).filter(([, v]) => v !== undefined),
              ),
            };
            if (verbose) console.log(`  ${repo.name}: loaded .ghost-portfolio.yml`);
          }
        }),
      );

      // Generate cards
      const cards = bannerResults.map(({ repo, banner }) =>
        generateCard(repo, banner, config),
      );

      const footer = generateFooter(repos, config);
      const lexical = buildLexical(cards, footer);

      if (opts.json) {
        console.log(JSON.stringify(lexical, null, 2));
        return;
      }

      if (dryRun) {
        console.log("\n--- DRY RUN: Generated HTML ---\n");
        for (const { repo, banner } of bannerResults) {
          console.log(
            `${repo.name} (${repo.stargazers_count} stars) ${banner ? "[banner]" : "[no banner]"}`,
          );
        }
        console.log(`\nTotal cards: ${cards.length}`);
        console.log(
          `Total stars: ${repos.reduce((s, r) => s + r.stargazers_count, 0)}`,
        );

        // Write to temp file for inspection
        const tmpPath = "/tmp/ghost-portfolio-preview.html";
        const htmlPreview = cards.join("\n<br>\n");
        writeFileSync(tmpPath, htmlPreview);
        console.log(`\nPreview written to ${tmpPath}`);
        return;
      }

      // Fetch current page
      if (verbose) console.log("Fetching Ghost page...");
      const page = await fetchPage(config);
      if (verbose)
        console.log(`  Page: ${page.title} (${page.id})`);

      // Update page
      if (verbose) console.log("Updating Ghost page...");
      const updated = await updatePage(config, page.id, page.updated_at, lexical);

      console.log(`Portfolio updated: ${updated.title}`);
      console.log(`  ${repos.length} projects displayed`);
      console.log(
        `  ${repos.reduce((s, r) => s + r.stargazers_count, 0)} total stars`,
      );
      console.log(
        `  ${bannerResults.filter((b) => b.banner).length} banners loaded`,
      );
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
