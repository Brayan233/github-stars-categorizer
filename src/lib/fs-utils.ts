/**
 * Async file system utilities
 */

import { mkdir, readFile, writeFile, access } from "fs/promises";
import { dirname } from "path";
import { CacheError } from "./errors.js";

/**
 * Check if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    throw new CacheError(`Failed to create directory: ${path}`, error);
  }
}

/**
 * Read JSON file
 */
export async function readJSON<T>(path: string): Promise<T> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    throw new CacheError(`Failed to read JSON file: ${path}`, error);
  }
}

/**
 * Write JSON file (with automatic directory creation)
 */
export async function writeJSON(
  path: string,
  data: unknown,
  pretty = true
): Promise<void> {
  try {
    await ensureDir(dirname(path));
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await writeFile(path, content, "utf-8");
  } catch (error) {
    throw new CacheError(`Failed to write JSON file: ${path}`, error);
  }
}

/**
 * Read JSON file with fallback
 */
export async function readJSONOrDefault<T>(
  path: string,
  defaultValue: T
): Promise<T> {
  try {
    if (!(await fileExists(path))) {
      return defaultValue;
    }
    return await readJSON<T>(path);
  } catch {
    return defaultValue;
  }
}
