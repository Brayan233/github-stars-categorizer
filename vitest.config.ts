import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use global test APIs (describe, it, expect) without imports
    globals: true,
    
    // Node environment for service testing
    environment: 'node',
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/__tests__/**',
        '**/dist/**',
        '**/cache/**',
        '**/results/**',
        'src/cli.ts', // CLI entry point - tested via integration
        'src/instrumentation.ts', // Observability setup
      ],
      // Coverage thresholds
      thresholds: {
        lines: 79,      // Current: 79.93% - GeminiService intentionally not unit tested
        functions: 84,  // Current: 84.61%
        branches: 50,   // Current: 52.68% - lower due to error handling paths
        statements: 79, // Current: 80.19%
      },
    },
    
    // Test file patterns
    include: ['src/**/*.{test,spec}.ts'],
    
    // Timeout for async tests (10 seconds)
    testTimeout: 10000,
  },
});
