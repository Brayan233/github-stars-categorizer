/**
 * Custom error types for better error handling
 */

export class CategorizerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CategorizerError";
  }
}

export class ConfigurationError extends CategorizerError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ConfigurationError";
  }
}

export class GitHubAPIError extends CategorizerError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = "GitHubAPIError";
  }
}

export class GeminiAPIError extends CategorizerError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = "GeminiAPIError";
  }
}

export class CacheError extends CategorizerError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "CacheError";
  }
}

export class AnalysisError extends CategorizerError {
  constructor(
    message: string,
    public readonly repo: string,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = "AnalysisError";
  }
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof GeminiAPIError) {
    return error.retryable;
  }

  const apiError = error as {
    status?: number;
    error?: { code?: number; status?: string };
    message?: string;
  };

  const errorCode = apiError.status || apiError.error?.code;
  const errorStatus = apiError.error?.status;
  const errorMessage = apiError.message || String(error);

  return (
    errorCode === 429 ||
    errorCode === 503 ||
    errorStatus === "UNAVAILABLE" ||
    errorMessage.includes("503") ||
    errorMessage.includes("overloaded") ||
    errorMessage.includes("UNAVAILABLE")
  );
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
