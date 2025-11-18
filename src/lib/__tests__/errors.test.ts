import { describe, expect, it } from 'vitest';
import {
    AnalysisError,
    CacheError,
    CategorizerError,
    ConfigurationError,
    GeminiAPIError,
    getErrorMessage,
    GitHubAPIError,
    isRetryableError,
} from '../errors';

describe('errors', () => {
  describe('Error Classes', () => {
    it('should create CategorizerError with message and cause', () => {
      const cause = new Error('Original error');
      const error = new CategorizerError('Test error', cause);

      expect(error.name).toBe('CategorizerError');
      expect(error.message).toBe('Test error');
      expect(error.cause).toBe(cause);
      expect(error instanceof Error).toBe(true);
    });

    it('should create ConfigurationError', () => {
      const error = new ConfigurationError('Config missing');

      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Config missing');
      expect(error instanceof CategorizerError).toBe(true);
    });

    it('should create GitHubAPIError with status code', () => {
      const error = new GitHubAPIError('API failed', 404);

      expect(error.name).toBe('GitHubAPIError');
      expect(error.message).toBe('API failed');
      expect(error.statusCode).toBe(404);
    });

    it('should create GeminiAPIError with retryable flag', () => {
      const error = new GeminiAPIError('Rate limited', 429, true);

      expect(error.name).toBe('GeminiAPIError');
      expect(error.message).toBe('Rate limited');
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
    });

    it('should create CacheError', () => {
      const error = new CacheError('Cache write failed');

      expect(error.name).toBe('CacheError');
      expect(error.message).toBe('Cache write failed');
    });

    it('should create AnalysisError with repo name', () => {
      const error = new AnalysisError('Analysis failed', 'owner/repo');

      expect(error.name).toBe('AnalysisError');
      expect(error.message).toBe('Analysis failed');
      expect(error.repo).toBe('owner/repo');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for 429 status code', () => {
      const error = { status: 429 };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 503 status code', () => {
      const error = { status: 503 };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for UNAVAILABLE status', () => {
      const error = { error: { status: 'UNAVAILABLE' } };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for GeminiAPIError with retryable=true', () => {
      const error = new GeminiAPIError('Test', 503, true);

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for GeminiAPIError with retryable=false', () => {
      const error = new GeminiAPIError('Test', 400, false);

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 401 status code', () => {
      const error = { status: 401 };

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 400 status code', () => {
      const error = { status: 400 };

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for error message containing "503"', () => {
      const error = new Error('Service returned 503 error');

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for error message containing "overloaded"', () => {
      const error = { message: 'Server is overloaded' };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for error message containing "UNAVAILABLE"', () => {
      const error = { message: 'Service UNAVAILABLE' };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new Error('Invalid request');

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message');

      const message = getErrorMessage(error);

      expect(message).toBe('Test error message');
    });

    it('should convert string to string', () => {
      const message = getErrorMessage('Plain string error');

      expect(message).toBe('Plain string error');
    });

    it('should convert number to string', () => {
      const message = getErrorMessage(404);

      expect(message).toBe('404');
    });

    it('should convert object to string', () => {
      const error = { code: 'ERR_FAILED' };

      const message = getErrorMessage(error);

      expect(message).toBe('[object Object]');
    });

    it('should handle null and undefined', () => {
      expect(getErrorMessage(null)).toBe('null');
      expect(getErrorMessage(undefined)).toBe('undefined');
    });
  });
});
