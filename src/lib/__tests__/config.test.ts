import { afterEach, describe, expect, it } from 'vitest';
import { mockEnv } from '../../__tests__/helpers/test-utils';
import { config, DEFAULTS, getConfig, PATHS } from '../config';

describe('config', () => {
  let cleanupEnv: (() => void) | null = null;

  afterEach(() => {
    // Clean up environment mocks
    if (cleanupEnv) {
      cleanupEnv();
      cleanupEnv = null;
    }
  });

  describe('getConfig', () => {
    it('should validate and return config with valid GEMINI_API_KEY', () => {
      cleanupEnv = mockEnv({
        GEMINI_API_KEY: 'test-api-key-123',
      });

      const cfg = getConfig();

      expect(cfg.GEMINI_API_KEY).toBe('test-api-key-123');
      expect(cfg.CACHE_MAX_AGE_HOURS).toBe(360); // default
      expect(cfg.CATEGORIZER_CONCURRENCY).toBe(40); // default
      expect(cfg.GEMINI_MODEL).toBe('gemini-2.5-flash'); // default
    });

    it('should throw error when GEMINI_API_KEY is missing', () => {
      cleanupEnv = mockEnv({
        GEMINI_API_KEY: '',
      });

      expect(() => getConfig()).toThrow('Configuration validation failed');
      expect(() => getConfig()).toThrow('GEMINI_API_KEY is required');
    });

    it('should use default values for optional config', () => {
      cleanupEnv = mockEnv({
        GEMINI_API_KEY: 'test-key',
      });

      const cfg = getConfig();

      expect(cfg.CACHE_MAX_AGE_HOURS).toBe(DEFAULTS.CACHE_MAX_AGE_HOURS);
      expect(cfg.CATEGORIZER_CONCURRENCY).toBe(DEFAULTS.CONCURRENCY);
      expect(cfg.GEMINI_MODEL).toBe(DEFAULTS.GEMINI_MODEL);
      expect(cfg.RETRY_DELAY_MS).toBe(DEFAULTS.RETRY_DELAY_MS);
      expect(cfg.RETRY_MAX_ATTEMPTS).toBe(DEFAULTS.RETRY_MAX_ATTEMPTS);
    });

    it('should coerce string numbers to integers', () => {
      cleanupEnv = mockEnv({
        GEMINI_API_KEY: 'test-key',
        CACHE_MAX_AGE_HOURS: '24',
        CATEGORIZER_CONCURRENCY: '10',
        RETRY_DELAY_MS: '500',
        RETRY_MAX_ATTEMPTS: '3',
      });

      const cfg = getConfig();

      expect(cfg.CACHE_MAX_AGE_HOURS).toBe(24);
      expect(cfg.CATEGORIZER_CONCURRENCY).toBe(10);
      expect(cfg.RETRY_DELAY_MS).toBe(500);
      expect(cfg.RETRY_MAX_ATTEMPTS).toBe(3);
    });

    it('should accept custom GEMINI_MODEL', () => {
      cleanupEnv = mockEnv({
        GEMINI_API_KEY: 'test-key',
        GEMINI_MODEL: 'gemini-2.5-pro',
      });

      const cfg = getConfig();

      expect(cfg.GEMINI_MODEL).toBe('gemini-2.5-pro');
    });

    it('should throw error on invalid number values', () => {
      cleanupEnv = mockEnv({
        GEMINI_API_KEY: 'test-key',
        CACHE_MAX_AGE_HOURS: '-1', // negative number
      });

      expect(() => getConfig()).toThrow();
    });
  });

  describe('config singleton', () => {
    it('should cache config instance', () => {
      cleanupEnv = mockEnv({
        GEMINI_API_KEY: 'test-key',
      });

      const cfg1 = config();
      const cfg2 = config();

      // Should return same instance
      expect(cfg1).toBe(cfg2);
    });
  });

  describe('PATHS constant', () => {
    it('should export correct paths', () => {
      expect(PATHS.CACHE_DIR).toBe('cache');
      expect(PATHS.CACHE_ANALYSIS_DIR).toBe('cache/analysis');
      expect(PATHS.CACHE_REPOS_FILE).toBe('cache/starred-repos.json');
      expect(PATHS.RESULTS_DIR).toBe('results');
    });
  });

  describe('DEFAULTS constant', () => {
    it('should export correct default values', () => {
      expect(DEFAULTS.CONCURRENCY).toBe(40);
      expect(DEFAULTS.CACHE_MAX_AGE_HOURS).toBe(360);
      expect(DEFAULTS.RETRY_DELAY_MS).toBe(1000);
      expect(DEFAULTS.RETRY_MAX_ATTEMPTS).toBe(5);
      expect(DEFAULTS.GEMINI_MODEL).toBe('gemini-2.5-flash');
    });
  });
});
