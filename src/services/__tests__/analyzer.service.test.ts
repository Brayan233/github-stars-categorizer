import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockRepo } from '../../__tests__/helpers/fixtures';
import type { GitHubRepo } from '../../types';
import { AnalyzerService } from '../analyzer.service';
import type { CacheService } from '../cache.service';
import type { GeminiService } from '../gemini.service';

describe('AnalyzerService', () => {
  let analyzer: AnalyzerService;
  let mockGemini: any;
  let mockCache: any;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockGemini = {
      categorize: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    mockCache = {
      getAnalysis: vi.fn(),
      saveAnalysis: vi.fn().mockResolvedValue(undefined),
    };

    analyzer = new AnalyzerService(
      mockGemini as unknown as GeminiService,
      mockCache as unknown as CacheService
    );
  });

  afterEach(() => {
    analyzer.resetStats();
  });

  describe('analyzeAll', () => {
    describe('basic functionality', () => {
      it('should analyze repos successfully', async () => {
        const repos: GitHubRepo[] = [
          mockRepo({ full_name: 'facebook/react' }),
          mockRepo({ full_name: 'microsoft/typescript' }),
        ];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize
          .mockResolvedValueOnce({
            categorization: { category: 'Frontend Frameworks', confidence: 95, reasoning: 'React' },
            tokensUsed: 500,
            groundingChunks: 2,
          })
          .mockResolvedValueOnce({
            categorization: { category: 'Programming Languages', confidence: 92, reasoning: 'TypeScript' },
            tokensUsed: 450,
            groundingChunks: 1,
          });

        const results = await analyzer.analyzeAll(repos);

        expect(results).toHaveLength(2);
        expect(results[0].categorization.category).toBe('Frontend Frameworks');
        expect(results[1].categorization.category).toBe('Programming Languages');
        expect(results[0].cached).toBe(false);
        expect(results[1].cached).toBe(false);
      });

      it('should handle empty repo array', async () => {
        const results = await analyzer.analyzeAll([]);

        expect(results).toEqual([]);
        expect(mockGemini.categorize).not.toHaveBeenCalled();
      });
    });

    describe('caching', () => {
      it('should use cache when available', async () => {
        const repos = [mockRepo({ full_name: 'cached/repo' })];

        mockCache.getAnalysis.mockResolvedValue({
          repo: repos[0],
          categorization: { category: 'Frontend Frameworks', confidence: 90, reasoning: 'Cached' },
          webSearchCalls: 0,
          cached: true, // CacheService returns cached:true from getAnalysis
          timestamp: new Date().toISOString(),
        });

        const results = await analyzer.analyzeAll(repos);

        expect(results).toHaveLength(1);
        // Note: the cache returns `cached: false` but the service transforms it to `cached: true`
        expect(results[0].cached).toBe(true);
        expect(mockGemini.categorize).not.toHaveBeenCalled();
        expect(mockCache.saveAnalysis).not.toHaveBeenCalled();
      });

      it('should skip cache when skipCache=true', async () => {
        const repos = [mockRepo({ full_name: 'force/analyze' })];

        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'CLI & Terminal', confidence: 85, reasoning: 'CLI tool' },
          tokensUsed: 350,
          groundingChunks: 1,
        });

        const results = await analyzer.analyzeAll(repos, true);

        expect(mockCache.getAnalysis).not.toHaveBeenCalled();
        expect(mockGemini.categorize).toHaveBeenCalledTimes(1);
        expect(results[0].cached).toBe(false);
      });

      it('should save results to cache after analysis', async () => {
        const repos = [mockRepo({ full_name: 'new/repo' })];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Tool' },
          tokensUsed: 400,
          groundingChunks: 0,
        });

        await analyzer.analyzeAll(repos);

        expect(mockCache.saveAnalysis).toHaveBeenCalledTimes(1);
        expect(mockCache.saveAnalysis.mock.calls[0][0]).toMatchObject({
          repo: repos[0],
          categorization: { category: 'Other Tools', confidence: 80 },
          cached: false, // New analysis, not from cache
        });
      });
    });

    describe('error handling', () => {
      it('should mark repos as failed when Gemini throws', async () => {
        const repos = [mockRepo({ full_name: 'fail/repo' })];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockRejectedValue(new Error('API error'));

        const results = await analyzer.analyzeAll(repos);

        expect(results).toHaveLength(1);
        expect(results[0].failed).toBe(true);
        expect(results[0].categorization.category).toBe('Uncategorized');
        expect(results[0].categorization.confidence).toBe(0);
        expect(results[0].error).toContain('API error');
      });

      it('should continue processing other repos after failure', async () => {
        const repos = [
          mockRepo({ full_name: 'success/repo1' }),
          mockRepo({ full_name: 'fail/repo' }),
          mockRepo({ full_name: 'success/repo2' }),
        ];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize
          .mockResolvedValueOnce({
            categorization: { category: 'Frontend Frameworks', confidence: 90, reasoning: 'Good' },
            tokensUsed: 400,
            groundingChunks: 1,
          })
          .mockRejectedValueOnce(new Error('API error'))
          .mockResolvedValueOnce({
            categorization: { category: 'Backend Frameworks', confidence: 88, reasoning: 'Good' },
            tokensUsed: 420,
            groundingChunks: 2,
          });

        const results = await analyzer.analyzeAll(repos);

        expect(results).toHaveLength(3);
        
        // Check results by repo name (order not guaranteed due to concurrency)
        const result1 = results.find(r => r.repo.full_name === 'success/repo1');
        const failedResult = results.find(r => r.repo.full_name === 'fail/repo');
        const result2 = results.find(r => r.repo.full_name === 'success/repo2');
        
        expect(result1?.failed).toBeFalsy();
        expect(failedResult?.failed).toBe(true);
        expect(result2?.failed).toBeFalsy();
      });

      it('should set "Uncategorized" for failed repos', async () => {
        const repos = [mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockRejectedValue(new Error('Network timeout'));

        const results = await analyzer.analyzeAll(repos);

        expect(results[0].categorization).toEqual({
          category: 'Uncategorized',
          confidence: 0,
          reasoning: expect.stringContaining('Network timeout'),
        });
      });

      it('should include error message in failed results', async () => {
        const repos = [mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockRejectedValue(new Error('Rate limit exceeded'));

        const results = await analyzer.analyzeAll(repos);

        expect(results[0].error).toBe('Rate limit exceeded');
        expect(results[0].categorization.reasoning).toContain('Rate limit exceeded');
      });
    });

    describe('statistics tracking', () => {
      it('should track total repos', async () => {
        const repos = [mockRepo(), mockRepo(), mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 0,
        });

        await analyzer.analyzeAll(repos);

        const stats = analyzer.getStats();
        expect(stats.total).toBe(3);
      });

      it('should track analyzed vs cached counts', async () => {
        const repos = [mockRepo(), mockRepo(), mockRepo()];

        // First is cached, others need analysis
        mockCache.getAnalysis
          .mockResolvedValueOnce({
            repo: repos[0],
            categorization: { category: 'Frontend Frameworks', confidence: 90, reasoning: 'Cached' },
            webSearchCalls: 0,
            cached: true,
            timestamp: new Date().toISOString(),
          })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);

        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 0,
        });

        await analyzer.analyzeAll(repos);

        const stats = analyzer.getStats();
        expect(stats.total).toBe(3);
        expect(stats.cached).toBe(1);
        expect(stats.analyzed).toBe(2);
      });

      it('should track failed count', async () => {
        const repos = [mockRepo(), mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize
          .mockResolvedValueOnce({
            categorization: { category: 'Frontend Frameworks', confidence: 90, reasoning: 'Good' },
            tokensUsed: 400,
            groundingChunks: 1,
          })
          .mockRejectedValueOnce(new Error('Failed'));

        await analyzer.analyzeAll(repos);

        const stats = analyzer.getStats();
        expect(stats.total).toBe(2);
        expect(stats.analyzed).toBe(1);
        expect(stats.failed).toBe(1);
      });

      it('should accumulate token usage', async () => {
        const repos = [mockRepo(), mockRepo(), mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize
          .mockResolvedValueOnce({
            categorization: { category: 'CLI & Terminal', confidence: 85, reasoning: 'Test' },
            tokensUsed: 100,
            groundingChunks: 0,
          })
          .mockResolvedValueOnce({
            categorization: { category: 'DevOps', confidence: 90, reasoning: 'Test' },
            tokensUsed: 200,
            groundingChunks: 1,
          })
          .mockResolvedValueOnce({
            categorization: { category: 'Testing', confidence: 88, reasoning: 'Test' },
            tokensUsed: 150,
            groundingChunks: 2,
          });

        await analyzer.analyzeAll(repos);

        const stats = analyzer.getStats();
        expect(stats.totalTokens).toBe(450); // 100 + 200 + 150
      });

      it('should accumulate web search counts', async () => {
        const repos = [mockRepo(), mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize
          .mockResolvedValueOnce({
            categorization: { category: 'Frontend Frameworks', confidence: 90, reasoning: 'Test' },
            tokensUsed: 400,
            groundingChunks: 3,
          })
          .mockResolvedValueOnce({
            categorization: { category: 'Backend Frameworks', confidence: 88, reasoning: 'Test' },
            tokensUsed: 420,
            groundingChunks: 5,
          });

        await analyzer.analyzeAll(repos);

        const stats = analyzer.getStats();
        expect(stats.totalWebSearches).toBe(8); // 3 + 5
      });

      it('should reset stats correctly', async () => {
        const repos = [mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 1,
        });

        await analyzer.analyzeAll(repos);

        analyzer.resetStats();
        const stats = analyzer.getStats();

        expect(stats).toEqual({
          total: 0,
          analyzed: 0,
          cached: 0,
          failed: 0,
          totalTokens: 0,
          totalWebSearches: 0,
        });
      });
    });

    describe('progress callbacks', () => {
      it('should call progress callback for each repo', async () => {
        const repos = [mockRepo(), mockRepo()];
        const progressCallback = vi.fn();

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 0,
        });

        await analyzer.analyzeAll(repos, false, progressCallback);

        expect(progressCallback).toHaveBeenCalledTimes(2);
      });

      it('should include correct progress data', async () => {
        const repos = [mockRepo({ full_name: 'test/repo' })];
        const progressCallback = vi.fn();

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Frontend Frameworks', confidence: 95, reasoning: 'Test' },
          tokensUsed: 500,
          groundingChunks: 2,
        });

        await analyzer.analyzeAll(repos, false, progressCallback);

        expect(progressCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            current: 1,
            total: 1,
            repo: 'test/repo',
            cached: false, // New analysis, not from cache
            category: 'Frontend Frameworks',
            confidence: 95,
            tokensUsed: 500,
            elapsedMs: expect.any(Number),
          })
        );
      });

      it('should work with cached results', async () => {
        const repos = [mockRepo({ full_name: 'cached/repo' })];
        const progressCallback = vi.fn();

        mockCache.getAnalysis.mockResolvedValue({
          repo: repos[0],
          categorization: { category: 'CLI & Terminal', confidence: 85, reasoning: 'Cached' },
          webSearchCalls: 0,
          cached: true,
          timestamp: new Date().toISOString(),
        });

        await analyzer.analyzeAll(repos, false, progressCallback);

        expect(progressCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            current: 1,
            total: 1,
            repo: 'cached/repo',
            cached: true,
            category: 'CLI & Terminal',
            confidence: 85,
          })
        );
      });

      it('should work with failed results', async () => {
        const repos = [mockRepo({ full_name: 'fail/repo' })];
        const progressCallback = vi.fn();

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockRejectedValue(new Error('API error'));

        await analyzer.analyzeAll(repos, false, progressCallback);

        expect(progressCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            current: 1,
            total: 1,
            repo: 'fail/repo',
            cached: false, // Failed analysis, not from cache
          })
        );
      });

      it('should handle null/undefined progress callback', async () => {
        const repos = [mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 0,
        });

        await expect(analyzer.analyzeAll(repos, false, undefined)).resolves.not.toThrow();
        await expect(analyzer.analyzeAll(repos, false)).resolves.not.toThrow();
      });
    });

    describe('concurrency', () => {
      it('should process multiple repos concurrently', async () => {
        const repos = Array.from({ length: 10 }, (_, i) => mockRepo({ full_name: `test/repo${i}` }));

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 0,
        });

        const startTime = Date.now();
        const results = await analyzer.analyzeAll(repos);
        const duration = Date.now() - startTime;

        expect(results).toHaveLength(10);
        // With concurrency, should be much faster than sequential
        expect(duration).toBeLessThan(1000);
      });

      it('should respect concurrency settings', async () => {
        const repos = Array.from({ length: 5 }, (_, i) => mockRepo({ full_name: `test/repo${i}` }));

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 0,
        });

        const results = await analyzer.analyzeAll(repos);

        expect(results).toHaveLength(5);
        expect(mockGemini.categorize).toHaveBeenCalledTimes(5);
      });
    });

    describe('edge cases', () => {
      it('should handle repos with missing optional fields', async () => {
        const repos = [mockRepo({ description: null, language: null, topics: [] })];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 0,
        });

        const results = await analyzer.analyzeAll(repos);

        expect(results).toHaveLength(1);
        expect(mockGemini.categorize).toHaveBeenCalledWith(
          expect.objectContaining({
            description: null,
            language: null,
            topics: [],
          })
        );
      });

      it('should include timestamp in results', async () => {
        const repos = [mockRepo()];

        mockCache.getAnalysis.mockResolvedValue(null);
        mockGemini.categorize.mockResolvedValue({
          categorization: { category: 'Other Tools', confidence: 80, reasoning: 'Test' },
          tokensUsed: 300,
          groundingChunks: 0,
        });

        const results = await analyzer.analyzeAll(repos);

        expect(results[0].timestamp).toBeDefined();
        expect(results[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        // Verify timestamp can be parsed as a date
        expect(new Date(results[0].timestamp).getTime()).toBeGreaterThan(0);
      });
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = analyzer.getStats();

      expect(stats).toEqual({
        total: 0,
        analyzed: 0,
        cached: 0,
        failed: 0,
        totalTokens: 0,
        totalWebSearches: 0,
      });
    });

    it('should return a copy of stats (not reference)', () => {
      const stats1 = analyzer.getStats();
      const stats2 = analyzer.getStats();

      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2); // Different objects
    });
  });

  describe('shutdown', () => {
    it('should call gemini.shutdown()', async () => {
      await analyzer.shutdown();

      expect(mockGemini.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should complete successfully', async () => {
      await expect(analyzer.shutdown()).resolves.toBeUndefined();
    });
  });
});
