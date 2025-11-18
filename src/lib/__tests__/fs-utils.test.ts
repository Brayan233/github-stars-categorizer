import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDir } from '../../__tests__/helpers/test-utils';
import { CacheError } from '../errors';
import { ensureDir, fileExists, readJSON, readJSONOrDefault, writeJSON } from '../fs-utils';

describe('fs-utils', () => {
  let tempDir: { path: string; cleanup: () => void };

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    tempDir.cleanup();
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(tempDir.path, 'test.json');
      await writeJSON(filePath, { test: true });

      const exists = await fileExists(filePath);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const filePath = join(tempDir.path, 'nonexistent.json');

      const exists = await fileExists(filePath);

      expect(exists).toBe(false);
    });

    it('should return true for existing directory', async () => {
      const exists = await fileExists(tempDir.path);

      expect(exists).toBe(true);
    });
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', async () => {
      const dirPath = join(tempDir.path, 'newdir');

      await ensureDir(dirPath);

      const exists = await fileExists(dirPath);
      expect(exists).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      const dirPath = join(tempDir.path, 'level1', 'level2', 'level3');

      await ensureDir(dirPath);

      const exists = await fileExists(dirPath);
      expect(exists).toBe(true);
    });

    it('should not throw error if directory already exists', async () => {
      const dirPath = join(tempDir.path, 'existing');
      await ensureDir(dirPath);

      // Should not throw
      await expect(ensureDir(dirPath)).resolves.toBeUndefined();
    });
  });

  describe('readJSON', () => {
    it('should read and parse JSON file', async () => {
      const filePath = join(tempDir.path, 'data.json');
      const data = { name: 'test', count: 42 };
      await writeJSON(filePath, data);

      const result = await readJSON<typeof data>(filePath);

      expect(result).toEqual(data);
    });

    it('should throw CacheError for non-existent file', async () => {
      const filePath = join(tempDir.path, 'missing.json');

      await expect(readJSON(filePath)).rejects.toThrow(CacheError);
      await expect(readJSON(filePath)).rejects.toThrow('Failed to read JSON file');
    });

    it('should throw CacheError for malformed JSON', async () => {
      const filePath = join(tempDir.path, 'invalid.json');
      const { writeFile } = await import('fs/promises');
      await writeFile(filePath, 'not valid json', 'utf-8');

      await expect(readJSON(filePath)).rejects.toThrow(CacheError);
    });
  });

  describe('writeJSON', () => {
    it('should write JSON file with pretty print by default', async () => {
      const filePath = join(tempDir.path, 'output.json');
      const data = { test: 'value', nested: { key: 42 } };

      await writeJSON(filePath, data);

      const { readFile } = await import('fs/promises');
      const content = await readFile(filePath, 'utf-8');
      
      expect(content).toContain('\n'); // Pretty printed (actual newline)
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should write compact JSON when pretty=false', async () => {
      const filePath = join(tempDir.path, 'compact.json');
      const data = { test: 'value' };

      await writeJSON(filePath, data, false);

      const { readFile } = await import('fs/promises');
      const content = await readFile(filePath, 'utf-8');
      
      expect(content).not.toContain('\n');
      expect(content).toBe(JSON.stringify(data));
    });

    it('should auto-create parent directories', async () => {
      const filePath = join(tempDir.path, 'nested', 'deep', 'file.json');
      const data = { created: true };

      await writeJSON(filePath, data);

      const exists = await fileExists(filePath);
      expect(exists).toBe(true);
      
      const result = await readJSON(filePath);
      expect(result).toEqual(data);
    });

    it('should handle arrays and primitives', async () => {
      const filePath = join(tempDir.path, 'array.json');
      const data = [1, 2, 3, 'test'];

      await writeJSON(filePath, data);

      const result = await readJSON(filePath);
      expect(result).toEqual(data);
    });
  });

  describe('readJSONOrDefault', () => {
    it('should return file contents if file exists', async () => {
      const filePath = join(tempDir.path, 'exists.json');
      const data = { value: 123 };
      await writeJSON(filePath, data);

      const result = await readJSONOrDefault(filePath, { value: 0 });

      expect(result).toEqual(data);
    });

    it('should return default value if file does not exist', async () => {
      const filePath = join(tempDir.path, 'missing.json');
      const defaultValue = { default: true };

      const result = await readJSONOrDefault(filePath, defaultValue);

      expect(result).toEqual(defaultValue);
    });

    it('should return default value on read error', async () => {
      const filePath = join(tempDir.path, 'invalid.json');
      const { writeFile } = await import('fs/promises');
      await writeFile(filePath, 'invalid json', 'utf-8');
      const defaultValue = { fallback: true };

      const result = await readJSONOrDefault(filePath, defaultValue);

      expect(result).toEqual(defaultValue);
    });

    it('should work with different types', async () => {
      const filePath = join(tempDir.path, 'array.json');
      const defaultValue: number[] = [1, 2, 3];

      const result = await readJSONOrDefault(filePath, defaultValue);

      expect(result).toEqual(defaultValue);
    });
  });
});
