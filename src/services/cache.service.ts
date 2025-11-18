/**
 * Cache service with async operations
 */

import { join } from "path";
import { config, PATHS } from "../lib/config.js";
import { fileExists, readJSON, writeJSON } from "../lib/fs-utils.js";
import type { AnalysisResult, GitHubRepo } from "../types.js";

interface CachedRepos {
  timestamp: string;
  repos: GitHubRepo[];
}

export class CacheService {
  private readonly analysisDir: string;
  private readonly reposFile: string;

  constructor() {
    this.analysisDir = PATHS.CACHE_ANALYSIS_DIR;
    this.reposFile = PATHS.CACHE_REPOS_FILE;
  }

  /**
   * Get starred repos from cache
   */
  async getStarredRepos(): Promise<GitHubRepo[] | null> {
    if (!(await this.isReposCacheValid())) {
      return null;
    }

    const cached = await readJSON<CachedRepos>(this.reposFile);
    return cached.repos;
  }

  /**
   * Save starred repos to cache
   */
  async saveStarredRepos(repos: GitHubRepo[]): Promise<void> {
    const data: CachedRepos = {
      timestamp: new Date().toISOString(),
      repos,
    };
    await writeJSON(this.reposFile, data);
  }

  /**
   * Check if repos cache is valid
   */
  async isReposCacheValid(): Promise<boolean> {
    if (!(await fileExists(this.reposFile))) {
      return false;
    }

    try {
      const cached = await readJSON<CachedRepos>(this.reposFile);
      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      const maxAge = config().CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;
      return cacheAge < maxAge;
    } catch {
      return false;
    }
  }

  /**
   * Get cache age in human-readable format
   */
  async getCacheAge(): Promise<string | null> {
    if (!(await fileExists(this.reposFile))) {
      return null;
    }

    try {
      const cached = await readJSON<CachedRepos>(this.reposFile);
      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      const hours = Math.floor(cacheAge / (60 * 60 * 1000));
      const minutes = Math.floor((cacheAge % (60 * 60 * 1000)) / (60 * 1000));
      return `${hours}h ${minutes}m`;
    } catch {
      return null;
    }
  }

  /**
   * Get analysis result from cache
   */
  async getAnalysis(repoName: string): Promise<AnalysisResult | null> {
    const path = this.getAnalysisPath(repoName);
    if (!(await fileExists(path))) {
      return null;
    }

    try {
      const result = await readJSON<AnalysisResult>(path);
      return { ...result, cached: true };
    } catch {
      return null;
    }
  }

  /**
   * Save analysis result to cache
   */
  async saveAnalysis(result: AnalysisResult): Promise<void> {
    const path = this.getAnalysisPath(result.repo.full_name);
    await writeJSON(path, result);
  }

  /**
   * Check if analysis exists in cache
   */
  async hasAnalysis(repoName: string): Promise<boolean> {
    const path = this.getAnalysisPath(repoName);
    return fileExists(path);
  }

  /**
   * Get analysis cache path
   */
  private getAnalysisPath(repoName: string): string {
    const slug = this.slugify(repoName);
    return join(this.analysisDir, `${slug}.json`);
  }

  /**
   * Slugify repo name for filename
   */
  private slugify(name: string): string {
    return name.replace(/\//g, "-").replace(/[^a-zA-Z0-9-]/g, "_");
  }
}
