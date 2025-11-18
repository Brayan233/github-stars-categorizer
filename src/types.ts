/**
 * Type definitions for GitHub Stars Categorizer
 */

export interface GitHubRepo {
  full_name: string;
  node_id: string;
  description: string | null;
  language: string | null;
  topics: string[];
  html_url: string;
}

export interface CategorizationResult {
  category: string;
  confidence: number;
  reasoning: string;
}

export interface AnalysisResult {
  repo: GitHubRepo;
  categorization: CategorizationResult;
  webSearchCalls: number;
  cached: boolean;
  timestamp: string;
  failed?: boolean;
  error?: string;
}

export interface CategoryConfig {
  name: string;
  emoji: string;
  description: string;
}

export interface GitHubList {
  id: string;
  name: string;
  description: string;
}

export interface FinalReport {
  timestamp: string;
  totalRepos: number;
  categories: {
    [category: string]: {
      count: number;
      repos: string[];
    };
  };
  cacheHits: number;
  cacheMisses: number;
  githubCalls: number;
  geminiCalls: number;
  webSearchCalls: number;
  failedRepos?: Array<{ name: string; error: string }>;
}
