import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Strip ANSI color codes from string for testing console output
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001B\[[0-9;]*m/g, '');
}

/**
 * Mock environment variables for a test
 * Returns a cleanup function to restore original values
 */
export function mockEnv(vars: Record<string, string>): () => void {
  const originalValues: Record<string, string | undefined> = {};
  
  // Save original values and set new ones
  for (const [key, value] of Object.entries(vars)) {
    originalValues[key] = process.env[key];
    process.env[key] = value;
  }
  
  // Return cleanup function
  return () => {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

/**
 * Create a temporary directory for testing
 * Directory is automatically cleaned up after test
 */
export function createTempDir(): { path: string; cleanup: () => void } {
  const tempPath = mkdtempSync(join(tmpdir(), 'vitest-'));
  
  return {
    path: tempPath,
    cleanup: () => {
      try {
        rmSync(tempPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    },
  };
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock console methods and capture output
 */
export function mockConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.log = (...args) => {
    logs.push(args.map(String).join(' '));
  };
  
  console.error = (...args) => {
    errors.push(args.map(String).join(' '));
  };
  
  console.warn = (...args) => {
    warns.push(args.map(String).join(' '));
  };
  
  return {
    logs,
    errors,
    warns,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}
