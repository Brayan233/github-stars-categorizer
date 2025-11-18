import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAnalysisResult, mockRepo } from '../../__tests__/helpers/fixtures';
import { mockConsole, stripAnsi } from '../../__tests__/helpers/test-utils';
import type { AnalyzerStats } from '../analyzer.service';
import { ReporterService } from '../reporter.service';

describe('ReporterService', () => {
  let reporter: ReporterService;
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(() => {
    reporter = new ReporterService();
    consoleMock = mockConsole();
  });

  afterEach(() => {
    consoleMock.restore();
  });

  describe('generateReport', () => {
    it('should generate report with category grouping', () => {
      const results = [
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'facebook/react' }),
          categorization: { category: 'Frontend Frameworks', confidence: 95, reasoning: 'React library' },
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'vuejs/vue' }),
          categorization: { category: 'Frontend Frameworks', confidence: 90, reasoning: 'Vue framework' },
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'openai/openai-node' }),
          categorization: { category: 'AI & LLM', confidence: 98, reasoning: 'OpenAI SDK' },
        }),
      ];

      const stats: AnalyzerStats = {
        total: 3,
        analyzed: 2,
        cached: 1,
        failed: 0,
        totalTokens: 1500,
        totalWebSearches: 3,
      };

      const report = reporter.generateReport(results, stats);

      expect(report.totalRepos).toBe(3);
      expect(report.stats).toEqual(stats);
      expect(report.categories['Frontend Frameworks'].count).toBe(2);
      expect(report.categories['AI & LLM'].count).toBe(1);
      expect(report.failedRepos).toHaveLength(0);
    });

    it('should include timestamp in report', () => {
      const results = [mockAnalysisResult()];
      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 1,
        cached: 0,
        failed: 0,
        totalTokens: 500,
        totalWebSearches: 1,
      };

      const beforeReport = Date.now();
      const report = reporter.generateReport(results, stats);
      const afterReport = Date.now();

      const reportTime = new Date(report.timestamp).getTime();
      expect(reportTime).toBeGreaterThanOrEqual(beforeReport);
      expect(reportTime).toBeLessThanOrEqual(afterReport);
    });

    it('should group repos by category correctly', () => {
      const results = [
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'repo1' }),
          categorization: { category: 'CLI & Terminal', confidence: 85, reasoning: 'CLI tool' },
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'repo2' }),
          categorization: { category: 'CLI & Terminal', confidence: 80, reasoning: 'Terminal app' },
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'repo3' }),
          categorization: { category: 'CLI & Terminal', confidence: 90, reasoning: 'Shell utility' },
        }),
      ];

      const stats: AnalyzerStats = {
        total: 3,
        analyzed: 3,
        cached: 0,
        failed: 0,
        totalTokens: 1000,
        totalWebSearches: 0,
      };

      const report = reporter.generateReport(results, stats);

      expect(report.categories['CLI & Terminal'].count).toBe(3);
      expect(report.categories['CLI & Terminal'].repos).toEqual(['repo1', 'repo2', 'repo3']);
    });

    it('should separate failed repos', () => {
      const results = [
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'success1' }),
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'failed1' }),
          categorization: { category: 'Uncategorized', confidence: 0, reasoning: 'Analysis failed' },
          failed: true,
          error: 'API timeout',
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'success2' }),
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'failed2' }),
          categorization: { category: 'Uncategorized', confidence: 0, reasoning: 'Error' },
          failed: true,
        }),
      ];

      const stats: AnalyzerStats = {
        total: 4,
        analyzed: 2,
        cached: 0,
        failed: 2,
        totalTokens: 800,
        totalWebSearches: 0,
      };

      const report = reporter.generateReport(results, stats);

      expect(report.failedRepos).toHaveLength(2);
      expect(report.failedRepos).toContain('failed1');
      expect(report.failedRepos).toContain('failed2');
      expect(report.categories['Uncategorized']).toBeUndefined(); // Failed repos not included in categories
    });

    it('should handle empty results', () => {
      const results: any[] = [];
      const stats: AnalyzerStats = {
        total: 0,
        analyzed: 0,
        cached: 0,
        failed: 0,
        totalTokens: 0,
        totalWebSearches: 0,
      };

      const report = reporter.generateReport(results, stats);

      expect(report.totalRepos).toBe(0);
      expect(Object.keys(report.categories)).toHaveLength(0);
      expect(report.failedRepos).toHaveLength(0);
    });
  });

  describe('saveSummary', () => {
    it('should save summary report to file', async () => {
      const results = [mockAnalysisResult()];
      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 1,
        cached: 0,
        failed: 0,
        totalTokens: 500,
        totalWebSearches: 1,
      };

      const report = reporter.generateReport(results, stats);
      const path = await reporter.saveSummary(report);

      expect(path).toBeDefined();
      expect(path).toContain('results/report-');
      expect(path).toContain('.json');
      expect(existsSync(path)).toBe(true);

      // Verify file contents
      const fileContent = await readFile(path, 'utf-8');
      const savedReport = JSON.parse(fileContent);
      expect(savedReport.totalRepos).toBe(1);
    });

    it('should include timestamp in filename', async () => {
      const results = [mockAnalysisResult()];
      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 1,
        cached: 0,
        failed: 0,
        totalTokens: 500,
        totalWebSearches: 1,
      };

      const report = reporter.generateReport(results, stats);
      const path = await reporter.saveSummary(report);

      // Filename should contain timestamped format
      expect(path).toMatch(/report-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });
  });

  describe('saveDetails', () => {
    it('should save detailed results to file', async () => {
      const results = [
        mockAnalysisResult({ repo: mockRepo({ full_name: 'test/repo1' }) }),
        mockAnalysisResult({ repo: mockRepo({ full_name: 'test/repo2' }) }),
      ];

      const path = await reporter.saveDetails(results);

      expect(path).toBeDefined();
      expect(path).toContain('results/detailed-');
      expect(path).toContain('.json');
      expect(existsSync(path)).toBe(true);

      // Verify file contents
      const fileContent = await readFile(path, 'utf-8');
      const savedResults = JSON.parse(fileContent);
      expect(savedResults).toHaveLength(2);
      expect(savedResults[0].repo.full_name).toBe('test/repo1');
    });
  });

  describe('printReport', () => {
    it('should print report to console', () => {
      const results = [
        mockAnalysisResult({
          repo: mockRepo({ full_name: 'owner/repo' }),
          categorization: { category: 'Frontend Frameworks', confidence: 95, reasoning: 'Test' },
        }),
      ];

      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 1,
        cached: 0,
        failed: 0,
        totalTokens: 500,
        totalWebSearches: 1,
      };

      const report = reporter.generateReport(results, stats);
      reporter.printReport(report);

      const output = consoleMock.logs.join('\n');
      const strippedOutput = stripAnsi(output);

      expect(strippedOutput).toContain('Analysis Summary');
      expect(strippedOutput).toContain('Statistics:');
      expect(strippedOutput).toContain('Total repositories: 1');
      expect(strippedOutput).toContain('Categories:');
      expect(strippedOutput).toContain('Frontend Frameworks');
    });

    it('should show failed repos section when there are failures', () => {
      const results = [
        mockAnalysisResult({ failed: true, repo: mockRepo({ full_name: 'failed/repo' }) }),
      ];

      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 0,
        cached: 0,
        failed: 1,
        totalTokens: 0,
        totalWebSearches: 0,
      };

      const report = reporter.generateReport(results, stats);
      reporter.printReport(report);

      const output = consoleMock.logs.join('\n');
      const strippedOutput = stripAnsi(output);

      expect(strippedOutput).toContain('Failed');
      expect(strippedOutput).toContain('failed/repo');
    });

    it('should not show failed section when no failures', () => {
      const results = [mockAnalysisResult()];

      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 1,
        cached: 0,
        failed: 0,
        totalTokens: 500,
        totalWebSearches: 1,
      };

      const report = reporter.generateReport(results, stats);
      reporter.printReport(report);

      const output = consoleMock.logs.join('\n');
      const strippedOutput = stripAnsi(output);

      // Should show "Failed: 0" in stats but not the failed repos section
      expect(strippedOutput).toContain('Failed:             0');
      expect(strippedOutput).not.toMatch(/⚠️.*Failed.*\(/); // No "Failed (N)" section
    });
  });

  describe('progress indicators', () => {
    it('should print progress with percentage', () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      reporter.printProgress(50, 100, 'Processing...');

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stripAnsi(stdoutSpy.mock.calls[0][0] as string);
      
      expect(output).toContain('50.0%');
      expect(output).toContain('Processing...');

      stdoutSpy.mockRestore();
    });

    it('should print progress with full completion', () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      reporter.printProgress(100, 100, 'Done!');

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stripAnsi(stdoutSpy.mock.calls[0][0] as string);
      
      expect(output).toContain('100.0%');
      expect(output).toContain('Done!');

      stdoutSpy.mockRestore();
    });

    it('should clear progress line', () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      reporter.clearProgress();

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0] as string;
      
      // Should contain carriage return and spaces
      expect(output).toContain('\r');

      stdoutSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle very long repo names in categories', () => {
      const longName = 'owner/' + 'a'.repeat(100);
      const results = [
        mockAnalysisResult({
          repo: mockRepo({ full_name: longName }),
        }),
      ];

      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 1,
        cached: 0,
        failed: 0,
        totalTokens: 500,
        totalWebSearches: 1,
      };

      const report = reporter.generateReport(results, stats);

      expect(report.categories['Frontend Frameworks'].repos[0]).toBe(longName);
    });

    it('should handle special characters in category names', () => {
      const results = [
        mockAnalysisResult({
          categorization: { category: 'AI & LLM', confidence: 95, reasoning: 'Test' },
        }),
      ];

      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 1,
        cached: 0,
        failed: 0,
        totalTokens: 500,
        totalWebSearches: 1,
      };

      const report = reporter.generateReport(results, stats);

      expect(report.categories['AI & LLM']).toBeDefined();
      expect(report.categories['AI & LLM'].count).toBe(1);
    });

    it('should handle large numbers in token count', () => {
      const results = [mockAnalysisResult()];
      const stats: AnalyzerStats = {
        total: 1,
        analyzed: 1,
        cached: 0,
        failed: 0,
        totalTokens: 1234567,
        totalWebSearches: 100,
      };

      const report = reporter.generateReport(results, stats);
      reporter.printReport(report);

      const output = consoleMock.logs.join('\n');
      const strippedOutput = stripAnsi(output);

      // Should format with thousand separators
      expect(strippedOutput).toContain('1,234,567');
    });
  });
});
