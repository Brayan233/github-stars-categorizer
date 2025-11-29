#!/usr/bin/env node
/**
 * Modern CLI entry point using Ink + Meow
 * Follows Node.js CLI best practices
 */

// IMPORTANT: Instrumentation must be imported first
import './instrumentation.js';

import { render } from 'ink';
import meow from 'meow';
import { App } from './cli/app.js';
import { ConfigurationError } from './cli/errors.js';
import { config } from './lib/config.js';

// Remove the '--' separator that pnpm/npm adds when passing args
// This prevents Meow from treating flags as input
const argv = process.argv.slice(2).filter(arg => arg !== '--');

const cli = meow(
  `
  Usage
    $ categorize-stars [options]

  Options
    --skip-cache, -s  Skip cache and re-analyze all repositories
    --dry-run, -d     Analyze without updating GitHub Lists
    --limit, -l       Limit number of repositories to process
    --keep-lists      Keep existing GitHub Lists (default: clear and recreate)
    --fast, -f        Use fast model (gemini-2.5-flash)
    --model, -m       Specify Gemini model (e.g., gemini-2.5-pro)
    --debug           Enable debug mode
    --help, -h        Show this help message
    --version, -v     Show version number

  Examples
    $ categorize-stars --dry-run --limit=10
    $ categorize-stars --skip-cache
    $ categorize-stars --fast
    $ categorize-stars --model gemini-2.5-pro
`,
  {
    importMeta: import.meta,
    argv, // Use our filtered argv instead of process.argv
    flags: {
      skipCache: {
        type: 'boolean',
        shortFlag: 's',
        default: false,
      },
      dryRun: {
        type: 'boolean',
        shortFlag: 'd',
        default: false,
      },
      limit: {
        type: 'number',
        shortFlag: 'l',
      },
      keepLists: {
        type: 'boolean',
        default: false,
      },
      fast: {
        type: 'boolean',
        shortFlag: 'f',
        default: false,
      },
      model: {
        type: 'string',
        shortFlag: 'm',
      },
      debug: {
        type: 'boolean',
        default: false,
      },
    },
  }
);

// Meow auto-handles --help and --version by exiting before this point
// If we reach here, run the app

// Validate config early
config();

// Enable debug mode if requested
if (cli.flags.debug) {
  process.env.DEBUG = 'categorizer:*';
}

// Override model if specified
if (cli.flags.fast) {
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
} else if (cli.flags.model) {
  process.env.GEMINI_MODEL = cli.flags.model;
}

// Debug: log environment
if (process.env.CI) {
  console.log('🔧 Running in CI environment');
}

console.log('🚀 Starting categorization...');

// Render the Ink app
const { waitUntilExit } = render(<App flags={cli.flags} />, {
  // Ensure output works in CI environments
  patchConsole: false,
});

// Wait for the app to exit and set proper exit code
waitUntilExit()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    // Error already displayed by ErrorBox component
    if (error instanceof ConfigurationError) {
      process.exit(2); // Configuration error
    }
    process.exit(1); // General error
  });
