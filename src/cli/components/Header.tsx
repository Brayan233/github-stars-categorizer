import { readFileSync } from 'fs';
import { Box, Text } from 'ink';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface HeaderProps {
  model?: string;
  concurrency?: number;
  cacheTTL?: number;
}

export function Header({ model, concurrency, cacheTTL }: HeaderProps) {
  // Read version from package.json (try both locations - src for dev, dist for prod)
  let version = '2.0.0'; // fallback
  try {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version;
  } catch {
    // Fallback to checking parent for production
    try {
      const packageJsonPath = join(__dirname, '..', '..', '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      version = packageJson.version;
    } catch {
      // Use fallback
    }
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        🌟 GitHub Stars Categorizer v{version}
      </Text>
      
      {model && (
        <Text dimColor>
          Model: {model}
        </Text>
      )}
      
      {concurrency && (
        <Text dimColor>
          Concurrency: {concurrency} workers
        </Text>
      )}
      
      {cacheTTL && (
        <Text dimColor>
          Cache TTL: {cacheTTL}h
        </Text>
      )}
    </Box>
  );
}
