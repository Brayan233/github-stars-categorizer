import { beforeEach, describe, expect, it } from 'vitest';
import { mockAnalysisResult, mockRepo } from '../../__tests__/helpers/fixtures';
import type { GitHubRepo } from '../../types';
import { CacheService } from '../cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  describe('starred repos caching', () => {
    it('should save and retrieve starred repos', async () => {
      const repos: GitHubRepo[] = [
        mockRepo({ full_name: 'facebook/react' }),
        mockRepo({ full_name: 'microsoft/typescript' }),
      ];

      await cache.saveStarredRepos(repos);
      const retrieved = await cache.getStarredRepos();

      expect(retrieved).toHaveLength(2);
      expect(retrieved?.[0].full_name).toBe('facebook/react');
      expect(retrieved?.[1].full_name).toBe('microsoft/typescript');
    });

    it('should include timestamp when saving repos', async () => {
      const repos = [mockRepo()];

      await cache.saveStarredRepos(repos);
      const retrieved = await cache.getStarredRepos();

      expect(retrieved).toBeDefined();
      
      // Verify cache age is recent (just saved)
      const age = await cache.getCacheAge();
      expect(age).toBeDefined();
      expect(age).toMatch(/^0h 0m$/);
    });

    it('should validate cache based on max age', async () => {
      const repos = [mockRepo()];
      await cache.saveStarredRepos(repos);

      const isValid = await cache.isReposCacheValid();

      expect(isValid).toBe(true);
    });
  });

  describe('cache age', () => {
    it('should return formatted cache age', async () => {
      const repos = [mockRepo()];
      await cache.saveStarredRepos(repos);

      const age = await cache.getCacheAge();

      expect(age).toBeDefined();
      expect(age).toMatch(/^\d+h \d+m$/);
    });
  });

  describe('analysis caching', () => {
    it('should save and retrieve analysis result', async () => {
      const analysis = mockAnalysisResult({
        repo: mockRepo({ full_name: 'owner/test-repo-123' }),
      });

      await cache.saveAnalysis(analysis);
      const retrieved = await cache.getAnalysis('owner/test-repo-123');

      expect(retrieved).toBeDefined();
      expect(retrieved?.repo.full_name).toBe('owner/test-repo-123');
      expect(retrieved?.categorization.category).toBe(analysis.categorization.category);
      expect(retrieved?.cached).toBe(true); // Should be marked as cached
    });

    it('should return null for non-existent analysis', async () => {
      const retrieved = await cache.getAnalysis('nonexistent/repo-never-exists-999');

      expect(retrieved).toBeNull();
    });

    it('should slugify repo names correctly', async () => {
      const analysis = mockAnalysisResult({
        repo: mockRepo({ full_name: 'owner/repo-with-dashes-test' }),
      });

      await cache.saveAnalysis(analysis);
      const retrieved = await cache.getAnalysis('owner/repo-with-dashes-test');

      expect(retrieved).toBeDefined();
      expect(retrieved?.repo.full_name).toBe('owner/repo-with-dashes-test');
    });

    it('should handle special characters in repo names', async () => {
      const analysis = mockAnalysisResult({
        repo: mockRepo({ full_name: 'owner/repo.with.dots.test' }),
      });

      await cache.saveAnalysis(analysis);
      const retrieved = await cache.getAnalysis('owner/repo.with.dots.test');

      expect(retrieved).toBeDefined();
    });

    it('should check if analysis exists', async () => {
      const analysis = mockAnalysisResult({
        repo: mockRepo({ full_name: 'owner/exists-check-test-456' }),
      });

      await cache.saveAnalysis(analysis);

      const exists = await cache.hasAnalysis('owner/exists-check-test-456');
      const notExists = await cache.hasAnalysis('owner/never-saved-missing-789');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should handle cache directory creation automatically', async () => {
      const analysis = mockAnalysisResult({
        repo: mockRepo({ full_name: 'test/auto-create-dir-test' }),
      });

      // Should auto-create directory when saving
      await expect(cache.saveAnalysis(analysis)).resolves.toBeUndefined();

      // Should be able to retrieve it
      const retrieved = await cache.getAnalysis(analysis.repo.full_name);
      expect(retrieved).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty repos array', async () => {
      await cache.saveStarredRepos([]);
      const retrieved = await cache.getStarredRepos();

      expect(retrieved).toEqual([]);
    });

    it('should handle repos with missing optional fields', async () => {
      const repos = [
        mockRepo({ description: null, language: null, topics: [] }),
      ];

      await cache.saveStarredRepos(repos);
      const retrieved = await cache.getStarredRepos();

      expect(retrieved?.[0].description).toBeNull();
      expect(retrieved?.[0].language).toBeNull();
      expect(retrieved?.[0].topics).toEqual([]);
    });

    it('should handle concurrent reads', async () => {
      const repos = [mockRepo()];
      await cache.saveStarredRepos(repos);

      // Multiple concurrent reads
      const [r1, r2, r3] = await Promise.all([
        cache.getStarredRepos(),
        cache.getStarredRepos(),
        cache.getStarredRepos(),
      ]);

      expect(r1).toEqual(r2);
      expect(r2).toEqual(r3);
    });

    it('should handle multiple different analyses', async () => {
      const analyses = [
        mockAnalysisResult({ repo: mockRepo({ full_name: 'test-owner/repo1-test' }) }),
        mockAnalysisResult({ repo: mockRepo({ full_name: 'test-owner/repo2-test' }) }),
        mockAnalysisResult({ repo: mockRepo({ full_name: 'test-owner/repo3-test' }) }),
      ];

      // Save all
      await Promise.all(analyses.map(a => cache.saveAnalysis(a)));

      // Retrieve all
      const retrieved = await Promise.all([
        cache.getAnalysis('test-owner/repo1-test'),
        cache.getAnalysis('test-owner/repo2-test'),
        cache.getAnalysis('test-owner/repo3-test'),
      ]);

      expect(retrieved[0]?.repo.full_name).toBe('test-owner/repo1-test');
      expect(retrieved[1]?.repo.full_name).toBe('test-owner/repo2-test');
      expect(retrieved[2]?.repo.full_name).toBe('test-owner/repo3-test');
    });
  });
});
