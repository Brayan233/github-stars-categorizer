import { Box, Text } from 'ink';
import { CategorizerError } from '../errors.js';

interface ErrorBoxProps {
  error: Error | CategorizerError;
}

export function ErrorBox({ error }: ErrorBoxProps) {
  const isCategorizerError = error instanceof CategorizerError;
  
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="red">
      <Box marginBottom={1}>
        <Text bold color="red">
          ❌ Error{isCategorizerError && ` (${error.code})`}
        </Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text>{error.message}</Text>
      </Box>
      
      {isCategorizerError && error.actionable && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">
            💡 How to fix:
          </Text>
          <Text>{error.actionable}</Text>
        </Box>
      )}
      
      {process.env.DEBUG && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Stack trace:</Text>
          <Text dimColor>{error.stack}</Text>
        </Box>
      )}
    </Box>
  );
}
