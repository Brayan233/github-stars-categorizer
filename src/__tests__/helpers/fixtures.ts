import type { AnalysisResult, CategorizationResult, GitHubRepo } from '../../types';

/**
 * Create a mock GitHub repository with default values
 */
export function mockRepo(overrides?: Partial<GitHubRepo>): GitHubRepo {
  return {
    full_name: 'facebook/react',
    node_id: 'MDEwOlJlcG9zaXRvcnkyMzA5Njk1OQ==',
    description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    language: 'JavaScript',
    topics: ['react', 'javascript', 'frontend', 'ui'],
    html_url: 'https://github.com/facebook/react',
    ...overrides,
  };
}

/**
 * Create a mock analysis result with default values
 */
export function mockAnalysisResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    repo: mockRepo(),
    categorization: {
      category: 'Frontend Frameworks',
      confidence: 95,
      reasoning: 'React is a popular frontend framework for building user interfaces',
    },
    webSearchCalls: 0,
    cached: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock categorization result
 */
export function mockCategorization(category: string, confidence = 90): CategorizationResult {
  return {
    category,
    confidence,
    reasoning: `Repository belongs to ${category}`,
  };
}

/**
 * Create a mock Gemini API response (JSON string)
 */
export function mockGeminiResponse(category: string, confidence = 90): string {
  return JSON.stringify({
    category,
    confidence,
    reasoning: `This repository is best categorized as ${category}`,
  });
}

/**
 * Create a mock Gemini API response with reasoning
 */
export function mockGeminiResponseWithReasoning(
  category: string,
  confidence: number,
  reasoning: string
): string {
  return JSON.stringify({
    category,
    confidence,
    reasoning,
  });
}

/**
 * Create multiple mock repos for batch testing
 */
export function mockRepos(count: number): GitHubRepo[] {
  return Array.from({ length: count }, (_, i) => mockRepo({
    full_name: `owner/repo-${i}`,
    node_id: `node_${i}`,
    description: `Description for repo ${i}`,
  }));
}
