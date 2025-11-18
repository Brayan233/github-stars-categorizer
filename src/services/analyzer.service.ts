/**
 * Repository analyzer with smart concurrency and streaming
 */

import PQueue from "p-queue";
import { config } from "../lib/config.js";
import { getErrorMessage } from "../lib/errors.js";
import type { AnalysisResult, GitHubRepo } from "../types.js";
import { CacheService } from "./cache.service.js";
import { GeminiService } from "./gemini.service.js";

export interface AnalyzerStats {
  total: number;
  analyzed: number;
  cached: number;
  failed: number;
  totalTokens: number;
  totalWebSearches: number;
}

export interface AnalyzerProgress {
  current: number;
  total: number;
  repo: string;
  cached: boolean;
  category?: string;
  confidence?: number;
  elapsedMs?: number;
  tokensUsed?: number;
}

export class AnalyzerService {
  private cache: CacheService;
  private gemini: GeminiService;
  private queue: PQueue;
  private stats: AnalyzerStats = {
    total: 0,
    analyzed: 0,
    cached: 0,
    failed: 0,
    totalTokens: 0,
    totalWebSearches: 0,
  };

  constructor(
    gemini: GeminiService = new GeminiService(),
    cache: CacheService = new CacheService()
  ) {
    this.gemini = gemini;
    this.cache = cache;

    const cfg = config();
    this.queue = new PQueue({
      concurrency: cfg.CATEGORIZER_CONCURRENCY,
      // No interval-based rate limiting - let Gemini's natural limits + p-retry handle it
      // This allows requests to go through immediately without artificial delays
    });
  }

  /**
   * Analyze all repositories with streaming progress
   */
  async analyzeAll(
    repos: GitHubRepo[],
    skipCache = false,
    onProgress?: (progress: AnalyzerProgress) => void
  ): Promise<AnalysisResult[]> {
    this.stats.total = repos.length;
    const results: AnalysisResult[] = [];
    let completed = 0;

    // Process all repos in parallel with queue managing concurrency
    await Promise.all(
      repos.map(async (repo) => {
        const result = await this.queue.add(async () => {
          const startTime = Date.now();

          try {
            // Check cache first
            if (!skipCache) {
              const cached = await this.cache.getAnalysis(repo.full_name);
              if (cached) {
                this.stats.cached++;
                completed++;
                onProgress?.({
                  current: completed,
                  total: this.stats.total,
                  repo: repo.full_name,
                  cached: true,
                  category: cached.categorization.category,
                  confidence: cached.categorization.confidence,
                });
                return cached;
              }
            }

            // Analyze with Gemini
            const { categorization, groundingChunks, tokensUsed } =
              await this.gemini.categorize(repo);

            this.stats.analyzed++;
            this.stats.totalTokens += tokensUsed;
            this.stats.totalWebSearches += groundingChunks;

            const result: AnalysisResult = {
              repo,
              categorization,
              webSearchCalls: groundingChunks,
              cached: false,
              timestamp: new Date().toISOString(),
            };

            // Save to cache
            await this.cache.saveAnalysis(result);

            completed++;
            const elapsedMs = Date.now() - startTime;

            onProgress?.({
              current: completed,
              total: this.stats.total,
              repo: repo.full_name,
              cached: false,
              category: categorization.category,
              confidence: categorization.confidence,
              elapsedMs,
              tokensUsed,
            });

            return result;
          } catch (error) {
            this.stats.failed++;
            const errorMsg = getErrorMessage(error);

            completed++;
            onProgress?.({
              current: completed,
              total: this.stats.total,
              repo: repo.full_name,
              cached: false,
            });

            return {
              repo,
              categorization: {
                category: "Uncategorized",
                confidence: 0,
                reasoning: `Analysis failed: ${errorMsg}`,
              },
              webSearchCalls: 0,
              cached: false,
              timestamp: new Date().toISOString(),
              failed: true,
              error: errorMsg,
            } satisfies AnalysisResult;
          }
        });

        if (result) {
          results.push(result);
        }
      })
    );

    return results;
  }

  /**
   * Get analysis statistics
   */
  getStats(): AnalyzerStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      total: 0,
      analyzed: 0,
      cached: 0,
      failed: 0,
      totalTokens: 0,
      totalWebSearches: 0,
    };
  }

  /**
   * Shutdown and flush analytics
   */
  async shutdown(): Promise<void> {
    await this.gemini.shutdown();
  }
}
