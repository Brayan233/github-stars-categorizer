import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface AnalysisProgressProps {
  current: number;
  total: number;
  repo?: string;
  cached?: boolean;
  category?: string;
  confidence?: number;
}

export function AnalysisProgress({
  current,
  total,
  repo,
  cached,
  category,
  confidence,
}: AnalysisProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Box flexDirection="column" gap={1}>
      {/* Simple counter */}
      <Box>
        <Text dimColor>Analyzing </Text>
        <Text bold color="cyan">{current}</Text>
        <Text dimColor> of </Text>
        <Text bold color="cyan">{total}</Text>
        <Text dimColor> repos ({percentage}%)</Text>
      </Box>

      {/* Current repo with spinner */}
      {repo && (
        <Box gap={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Box flexDirection="column">
            <Text>
              {cached ? (
                <Text color="green">✓</Text>
              ) : (
                <Text color="yellow">→</Text>
              )}{' '}
              <Text dimColor>{repo}</Text>
            </Text>
            {category && (
              <Text dimColor>
                  {category} {confidence && `(${confidence}%)`}
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
