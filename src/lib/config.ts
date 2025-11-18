/**
 * Configuration management with Zod validation
 */

import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Load environment variables
loadEnv();

// Environment schema
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  CACHE_MAX_AGE_HOURS: z.coerce.number().int().positive().default(360),
  CATEGORIZER_CONCURRENCY: z.coerce.number().int().positive().default(40),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  RETRY_DELAY_MS: z.coerce.number().int().positive().default(1000),
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Parse and validate environment
export function getConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n");
    throw new Error(`Configuration validation failed:\n${errors}\n\nGet your Gemini API key from https://aistudio.google.com/apikey`);
  }

  return result.data;
}

// Singleton config instance
let cachedConfig: EnvConfig | null = null;

export function config(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = getConfig();
  }
  return cachedConfig;
}

// Constants
export const PATHS = {
  CACHE_DIR: "cache",
  CACHE_ANALYSIS_DIR: "cache/analysis",
  CACHE_REPOS_FILE: "cache/starred-repos.json",
  RESULTS_DIR: "results",
} as const;

export const DEFAULTS = {
  CONCURRENCY: 40,
  CACHE_MAX_AGE_HOURS: 360,
  RETRY_DELAY_MS: 1000,
  RETRY_MAX_ATTEMPTS: 5,
  GEMINI_MODEL: "gemini-2.5-flash",
} as const;
