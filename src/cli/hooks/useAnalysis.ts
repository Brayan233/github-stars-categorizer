import { useEffect, useState } from 'react';
import { config } from '../../lib/config.js';
import { AnalyzerService } from '../../services/analyzer.service.js';
import { CacheService } from '../../services/cache.service.js';
import { GitHubService } from '../../services/github.service.js';
import { ReporterService } from '../../services/reporter.service.js';
import type { AnalysisResult } from '../../types.js';

export interface AnalysisState {
  phase: 'fetching' | 'analyzing' | 'reporting' | 'syncing' | 'done' | 'error';
  results: AnalysisResult[] | null;
  stats: any | null;
  progress: {
    current: number;
    total: number;
    repo?: string;
    cached?: boolean;
    category?: string;
    confidence?: number;
  };
  error: Error | null;
  repoCount: number;
  fetchSource?: 'github' | 'cache';
}

interface AnalysisFlags {
  skipCache: boolean;
  dryRun: boolean;
  limit?: number;
  keepLists: boolean;
}

export function useAnalysis(flags: AnalysisFlags) {
  const [state, setState] = useState<AnalysisState>({
    phase: 'fetching',
    results: null,
    stats: null,
    progress: { current: 0, total: 0 },
    error: null,
    repoCount: 0,
  });

  useEffect(() => {
    const run = async () => {
      try {
        // Validate config
        config();
        
        // Initialize services
        const cache = new CacheService();
        const github = new GitHubService();
        const analyzer = new AnalyzerService();
        const reporter = new ReporterService();

        // Phase 1: Fetch repositories
        console.log('Phase 1: Fetching repositories');
        setState(prev => ({ ...prev, phase: 'fetching' }));
        
        let repos = await cache.getStarredRepos();
        let fetchedFromGitHub = false;
        
        if (!repos || flags.skipCache) {
          fetchedFromGitHub = true;
          console.log('Fetching from GitHub API...');
          repos = await github.fetchStarredRepos();
          await cache.saveStarredRepos(repos);
        } else {
          console.log('Using cached repositories');
        }

        // Apply limit if specified
        const reposToProcess = flags.limit ? repos.slice(0, flags.limit) : repos;
        
        console.log(`Processing ${reposToProcess.length} repositories`);
        
        setState(prev => ({
          ...prev,
          repoCount: reposToProcess.length,
          fetchSource: fetchedFromGitHub ? 'github' : 'cache',
          progress: { ...prev.progress, total: reposToProcess.length },
        }));

        // Phase 2: Analyze repositories
        setState(prev => ({ ...prev, phase: 'analyzing' }));
        
        console.log('DEBUG: skipCache flag =', flags.skipCache);
        
        const results = await analyzer.analyzeAll(
          reposToProcess,
          flags.skipCache,
          (progress) => {
            setState(prev => ({
              ...prev,
              progress: {
                current: progress.current,
                total: progress.total,
                repo: progress.repo,
                cached: progress.cached,
                category: progress.category,
                confidence: progress.confidence,
              },
            }));
          }
        );

        const stats = analyzer.getStats();

        // Phase 3: Generate reports
        console.log('Phase 3: Generating reports...');
        setState(prev => ({ ...prev, phase: 'reporting' }));
        
        const report = reporter.generateReport(results, stats);
        await reporter.saveSummary(report);
        await reporter.saveDetails(results);

        // Phase 4: Sync to GitHub (if not dry-run)
        if (!flags.dryRun) {
          console.log('Phase 4: Syncing to GitHub...');
          setState(prev => ({ ...prev, phase: 'syncing' }));
          
          if (!flags.keepLists) {
            await github.clearAllLists();
          }
          
          const lists = await github.createLists();
          await github.assignReposToLists(results, lists);
        }

        // Done!
        setState(prev => ({
          ...prev,
          phase: 'done',
          results,
          stats,
        }));

        // Cleanup
        await analyzer.shutdown();
        
      } catch (error) {
        setState(prev => ({
          ...prev,
          phase: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    };

    run();
  }, [flags]);

  return state;
}
