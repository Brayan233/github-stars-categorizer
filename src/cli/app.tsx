import { Box, Text } from 'ink';
import { config } from '../lib/config.js';
import { AnalysisProgress } from './components/AnalysisProgress.js';
import { ErrorBox } from './components/ErrorBox.js';
import { Header } from './components/Header.js';
import { StatsTable } from './components/StatsTable.js';
import { useAnalysis } from './hooks/useAnalysis.js';

export interface AppProps {
  flags: {
    skipCache: boolean;
    dryRun: boolean;
    limit?: number;
    keepLists: boolean;
    fast?: boolean;
    model?: string;
  };
}

export function App({ flags }: AppProps) {
  const cfg = config();
  
  const state = useAnalysis(flags);

  // Override model if needed
  const model = flags.fast
    ? 'gemini-2.5-flash'
    : flags.model || cfg.GEMINI_MODEL;

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        model={model}
        concurrency={cfg.CATEGORIZER_CONCURRENCY}
        cacheTTL={cfg.CACHE_MAX_AGE_HOURS}
      />

      {state.phase === 'error' && state.error && (
        <ErrorBox error={state.error} />
      )}

      {state.phase === 'fetching' && (
        <Text color="cyan">📦 Fetching starred repositories...</Text>
      )}

      {state.phase === 'analyzing' && state.fetchSource && (
        <Box flexDirection="column">
          <Text dimColor>
            {state.fetchSource === 'github'
              ? '✓ Fetched from GitHub API'
              : '✓ Loaded from cache'}
            {' '}({state.repoCount} {state.repoCount === 1 ? 'repo' : 'repos'})
          </Text>
          <Box marginTop={1}>
            <Text bold color="cyan">
              🔍 Analyzing repositories...
            </Text>
          </Box>
          <AnalysisProgress
            current={state.progress.current}
            total={state.progress.total}
            repo={state.progress.repo}
            cached={state.progress.cached}
            category={state.progress.category}
            confidence={state.progress.confidence}
          />
        </Box>
      )}

      {state.phase === 'reporting' && (
        <Text color="cyan">📊 Generating reports...</Text>
      )}

      {state.phase === 'syncing' && !flags.dryRun && (
        <Text color="cyan">🔗 Syncing to GitHub Lists...</Text>
      )}

      {state.phase === 'done' && state.results && state.stats && (
        <Box flexDirection="column">
          <Text bold color="green">
            ✓ Analysis complete!
          </Text>
          <StatsTable results={state.results} stats={state.stats} />
          
          {flags.dryRun && (
            <Box marginTop={1} padding={1} borderStyle="round" borderColor="yellow">
              <Text color="yellow">
                🏃 Dry run mode - GitHub Lists were not updated
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
