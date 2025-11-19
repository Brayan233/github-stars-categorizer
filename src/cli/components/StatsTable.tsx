import { Box, Text } from 'ink';
import type { AnalysisResult } from '../../types.js';

interface StatsTableProps {
  results: AnalysisResult[];
  stats: {
    total: number;
    analyzed: number;
    cached: number;
    failed: number;
    totalTokens: number;
    totalWebSearches: number;
  };
}

export function StatsTable({ results, stats }: StatsTableProps) {
  // Group by category
  const categories = results.reduce((acc, result) => {
    const cat = result.categorization.category;
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b - a);

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="cyan">
        📊 Analysis Summary
      </Text>

      <Box flexDirection="column" marginY={1}>
        <Text bold>Statistics:</Text>
        <Text>  Total repositories: {stats.total}</Text>
        <Text>  Analyzed (new):     {stats.analyzed}</Text>
        <Text>  From cache:         {stats.cached}</Text>
        <Text>  Failed:             {stats.failed}</Text>
        <Text>  Total tokens:       {stats.totalTokens.toLocaleString()}</Text>
        <Text>  Web searches:       {stats.totalWebSearches}</Text>
      </Box>

      {sortedCategories.length > 0 && (
        <Box flexDirection="column" marginY={1}>
          <Text bold>Categories:</Text>
          {sortedCategories.map(([category, count]) => {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            return (
              <Text key={category}>
                  {category.padEnd(30)} {count.toString().padStart(3)} ({percentage}%)
              </Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
