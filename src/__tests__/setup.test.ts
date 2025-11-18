import { describe, expect, it } from 'vitest';

describe('Vitest Setup', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should have access to Node APIs', () => {
    expect(process.env).toBeDefined();
    expect(typeof process.cwd).toBe('function');
  });
});
