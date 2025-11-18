#!/usr/bin/env node
/**
 * Modern CLI with Commander.js
 */

// IMPORTANT: Instrumentation must be imported first
import "./instrumentation.js";

import chalk from "chalk";
import { Command } from "commander";
import { config } from "./lib/config.js";
import { ConfigurationError } from "./lib/errors.js";
import { AnalyzerService } from "./services/analyzer.service.js";
import { CacheService } from "./services/cache.service.js";
import { GitHubService } from "./services/github.service.js";
import { ReporterService } from "./services/reporter.service.js";

const program = new Command();

interface CLIOptions {
  keepLists: boolean;
  skipCache: boolean;
  dryRun: boolean;
  limit?: number;
  model?: string;
  fast: boolean;
}

program
  .name("categorize-stars")
  .description("Intelligent GitHub starred repository categorization using AI")
  .version("2.0.0")
  .option("--keep-lists", "Keep existing GitHub Lists (default: clear and recreate)")
  .option("-s, --skip-cache", "Skip cache and re-analyze all repositories")
  .option("-d, --dry-run", "Analyze repositories without updating GitHub Lists")
  .option("-l, --limit <number>", "Limit number of repositories to process", parseInt)
  .option("-m, --model <model>", "Gemini model to use (e.g., gemini-2.5-pro, gemini-2.5-flash)")
  .option("-f, --fast", "Use fast model (gemini-2.5-flash)")
  .action(async (options: CLIOptions) => {
    let analyzer: AnalyzerService | null = null;
    try {
      const result = await run(options);
      analyzer = result.analyzer;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        console.error(chalk.red("\n❌ Configuration Error:"));
        console.error(chalk.red(error.message));
        process.exit(1);
      }

      console.error(chalk.red("\n❌ Error:"), error);
      process.exit(1);
    } finally {
      // Always flush PostHog events before exit
      if (analyzer) {
        await analyzer.shutdown();
      }
    }
  });

async function run(options: CLIOptions): Promise<{ analyzer: AnalyzerService }> {
  // Load and validate config
  const cfg = config();

  // Override model if specified
  if (options.fast) {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
  } else if (options.model) {
    process.env.GEMINI_MODEL = options.model;
  }

  console.log(chalk.bold.cyan("\n🌟 GitHub Stars Categorizer v2.0\n"));
  console.log(chalk.dim(`Model: ${process.env.GEMINI_MODEL || cfg.GEMINI_MODEL}`));
  console.log(chalk.dim(`Concurrency: ${cfg.CATEGORIZER_CONCURRENCY} workers`));
  console.log(chalk.dim(`Cache TTL: ${cfg.CACHE_MAX_AGE_HOURS}h\n`));

  // Initialize services
  const cache = new CacheService();
  const github = new GitHubService();
  const analyzer = new AnalyzerService();
  const reporter = new ReporterService();

  // Step 1: Fetch repositories
  console.log(chalk.bold("📦 Fetching starred repositories..."));

  let repos = await cache.getStarredRepos();

  if (!repos || options.skipCache) {
    console.log(chalk.dim("  Fetching from GitHub API..."));
    repos = await github.fetchStarredRepos();
    await cache.saveStarredRepos(repos);
    console.log(chalk.green(`  ✓ Fetched ${repos.length} repositories`));
  } else {
    const age = await cache.getCacheAge();
    console.log(chalk.green(`  ✓ Loaded ${repos.length} repositories from cache (${age} old)`));
  }

  // Apply limit if specified
  const reposToProcess = options.limit ? repos.slice(0, options.limit) : repos;
  if (options.limit) {
    console.log(chalk.yellow(`  ⚠ Processing first ${options.limit} repositories only\n`));
  } else {
    console.log("");
  }

  // Step 2: Analyze repositories
  console.log(chalk.bold("🔍 Analyzing repositories...\n"));

  const results = await analyzer.analyzeAll(
    reposToProcess,
    options.skipCache,
    (progress) => {
      const cached = progress.cached ? chalk.dim("[CACHED]") : chalk.cyan("[ANALYZING]");
      const category = progress.category
        ? chalk.green(`→ ${progress.category} (${progress.confidence}%)`)
        : "";
      const time = progress.elapsedMs
        ? chalk.dim(`${(progress.elapsedMs / 1000).toFixed(2)}s`)
        : "";
      const tokens = progress.tokensUsed
        ? chalk.dim(`· ${progress.tokensUsed} tokens`)
        : "";

      reporter.clearProgress();
      console.log(
        `${cached} ${progress.repo.padEnd(50)} ${category} ${time} ${tokens}`
      );
    }
  );

  reporter.clearProgress();
  console.log(chalk.green(`\n✓ Analyzed ${results.length} repositories\n`));

  // Step 3: Generate reports
  console.log(chalk.bold("📊 Generating reports...\n"));

  const stats = analyzer.getStats();
  const report = reporter.generateReport(results, stats);

  const summaryPath = await reporter.saveSummary(report);
  const detailsPath = await reporter.saveDetails(results);

  console.log(chalk.green("✓ Reports saved:"));
  console.log(chalk.dim(`  Summary: ${summaryPath}`));
  console.log(chalk.dim(`  Details: ${detailsPath}`));

  reporter.printReport(report);

  // Step 4: Update GitHub Lists
  if (options.dryRun) {
    console.log(chalk.yellow("🏃 Dry run mode - skipping GitHub List updates\n"));
    return { analyzer };
  }

  // Clear lists by default (unless --keep-lists is specified)
  const shouldClearLists = !options.keepLists;
  if (shouldClearLists) {
    console.log(chalk.bold("\n🗑️  Clearing existing GitHub Lists..."));
    const deleted = await github.clearAllLists();
    console.log(chalk.green(`  ✓ Deleted ${deleted} lists\n`));
  }

  // Create lists
  console.log(chalk.bold("📝 Creating GitHub Lists..."));
  const lists = await github.createLists();
  console.log(chalk.green(`  ✓ Created ${lists.length} lists\n`));

  // Assign repos
  console.log(chalk.bold("🔗 Assigning repositories to lists..."));
  let assignedCount = 0;

  await github.assignReposToLists(results, lists, (current, total) => {
    assignedCount = current;
    reporter.printProgress(current, total, `Assigning ${current}/${total}...`);
  });

  reporter.clearProgress();
  console.log(chalk.green(`  ✓ Assigned ${assignedCount} repositories\n`));

  // Get username and show stars URL
  const username = await github.getUsername();
  const starsUrl = `https://github.com/${username}?tab=stars`;

  console.log(chalk.bold.green("✨ Done! Check your GitHub Stars Lists:"));
  console.log(chalk.cyan(`   ${starsUrl}\n`));

  return { analyzer };
}

// Run CLI
program.parse();
