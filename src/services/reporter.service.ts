/**
 * Report generation and formatting service
 */

import chalk from "chalk";
import { join } from "path";
import { PATHS } from "../lib/config.js";
import { writeJSON } from "../lib/fs-utils.js";
import type { AnalysisResult } from "../types.js";
import type { AnalyzerStats } from "./analyzer.service.js";

export interface Report {
  timestamp: string;
  totalRepos: number;
  categories: Record<string, { count: number; repos: string[] }>;
  stats: AnalyzerStats;
  failedRepos: string[];
}

export class ReporterService {
  /**
   * Generate report from analysis results
   */
  generateReport(results: AnalysisResult[], stats: AnalyzerStats): Report {
    const categories: Record<string, { count: number; repos: string[] }> = {};
    const failedRepos: string[] = [];

    for (const result of results) {
      if (result.failed) {
        failedRepos.push(result.repo.full_name);
        continue;
      }

      const category = result.categorization.category;
      if (!categories[category]) {
        categories[category] = { count: 0, repos: [] };
      }
      categories[category].count++;
      categories[category].repos.push(result.repo.full_name);
    }

    return {
      timestamp: new Date().toISOString(),
      totalRepos: results.length,
      categories,
      stats,
      failedRepos,
    };
  }

  /**
   * Save summary report
   */
  async saveSummary(report: Report): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = join(PATHS.RESULTS_DIR, `report-${timestamp}.json`);
    await writeJSON(path, report);
    return path;
  }

  /**
   * Save detailed results
   */
  async saveDetails(results: AnalysisResult[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = join(PATHS.RESULTS_DIR, `detailed-${timestamp}.json`);
    await writeJSON(path, results);
    return path;
  }

  /**
   * Print report to console
   */
  printReport(report: Report): void {
    console.log(chalk.bold.cyan("\n📊 Analysis Summary\n"));

    // Stats
    console.log(chalk.bold("Statistics:"));
    console.log(chalk.dim(`  Total repositories: ${report.totalRepos}`));
    console.log(chalk.dim(`  Analyzed (new):     ${report.stats.analyzed}`));
    console.log(chalk.dim(`  From cache:         ${report.stats.cached}`));
    console.log(chalk.dim(`  Failed:             ${report.stats.failed}`));
    console.log(chalk.dim(`  Total tokens:       ${report.stats.totalTokens.toLocaleString()}`));
    console.log(chalk.dim(`  Web searches:       ${report.stats.totalWebSearches}`));

    // Categories
    console.log(chalk.bold("\nCategories:"));
    const sorted = Object.entries(report.categories).sort((a, b) => b[1].count - a[1].count);

    for (const [category, data] of sorted) {
      const percentage = ((data.count / report.totalRepos) * 100).toFixed(1);
      console.log(chalk.cyan(`  ${category.padEnd(25)} ${data.count.toString().padStart(3)} (${percentage}%)`));
    }

    // Failed repos
    if (report.failedRepos.length > 0) {
      console.log(chalk.bold.red(`\n⚠️  Failed (${report.failedRepos.length}):`));
      report.failedRepos.forEach((repo) => {
        console.log(chalk.red(`  - ${repo}`));
      });
    }

    console.log("");
  }

  /**
   * Print progress line (overwrite current line)
   */
  printProgress(current: number, total: number, message: string): void {
    const percentage = ((current / total) * 100).toFixed(1);
    const bar = this.createProgressBar(current, total, 30);
    process.stdout.write(`\r${bar} ${percentage}% ${message}`.padEnd(100));
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(current: number, total: number, width: number): string {
    const filled = Math.floor((current / total) * width);
    const empty = width - filled;
    return chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(empty));
  }

  /**
   * Clear progress line
   */
  clearProgress(): void {
    process.stdout.write("\r" + " ".repeat(100) + "\r");
  }
}
