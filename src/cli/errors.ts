/**
 * Custom error classes with trackable error codes
 * Following Node.js CLI best practices
 */

export class CategorizerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly actionable: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'CategorizerError';
    Error.captureStackTrace(this, this.constructor);
  }

  toString(): string {
    return `Error (${this.code}): ${this.message}\n\n✓ ${this.actionable}`;
  }
}

export class ConfigurationError extends CategorizerError {
  constructor(message: string, actionable: string) {
    super('E1000', message, actionable, 2);
    this.name = 'ConfigurationError';
  }
}

export class ApiError extends CategorizerError {
  constructor(message: string, actionable: string) {
    super('E2000', message, actionable, 1);
    this.name = 'ApiError';
  }
}

export class CacheError extends CategorizerError {
  constructor(message: string, actionable: string) {
    super('E3000', message, actionable, 1);
    this.name = 'CacheError';
  }
}

/**
 * Error code reference:
 * E1XXX - Configuration errors (exit code 2)
 * E2XXX - API errors (exit code 1)
 * E3XXX - Cache errors (exit code 1)
 * E4XXX - Analysis errors (exit code 1)
 * E5XXX - Sync errors (exit code 1)
 */
