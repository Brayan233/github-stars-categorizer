/**
 * Gemini AI service with retry logic and PostHog analytics
 */

import { GoogleGenAI as NativeGoogleGenAI } from "@google/genai";
import { GoogleGenAI as PostHogGoogleGenAI } from "@posthog/ai";
import pRetry from "p-retry";
import { PostHog } from "posthog-node";
import { v4 as uuidv4 } from "uuid";
import { CATEGORIES } from "../config.js";
import { config } from "../lib/config.js";
import { GeminiAPIError, isRetryableError } from "../lib/errors.js";
import type { CategorizationResult, GitHubRepo } from "../types.js";

interface GeminiResponse {
  categorization: CategorizationResult;
  groundingChunks: number;
  tokensUsed: number;
}

export class GeminiService {
  private client: PostHogGoogleGenAI | NativeGoogleGenAI;
  private model: string;
  private posthog: PostHog | null = null;

  constructor() {
    const cfg = config();
    this.model = cfg.GEMINI_MODEL;

    // Initialize PostHog if configured
    if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST) {
      this.posthog = new PostHog(
        process.env.POSTHOG_API_KEY,
        { host: process.env.POSTHOG_HOST }
      );

      // Use PostHog wrapper for automatic event capture
      this.client = new PostHogGoogleGenAI({
        apiKey: cfg.GEMINI_API_KEY,
        posthog: this.posthog,
      });
    } else {
      // Use native client without analytics
      this.client = new NativeGoogleGenAI({ apiKey: cfg.GEMINI_API_KEY });
    }
  }

  async categorize(repo: GitHubRepo): Promise<GeminiResponse> {
    const cfg = config();
    const prompt = this.buildPrompt(repo);

    try {
      const response = await pRetry(
        async () => {
          try {
            // Generate a proper UUID for the trace ID
            const traceId = uuidv4();

            // Call Gemini with PostHog enrichment properties
            const result = await this.client.models.generateContent({
              model: this.model,
              contents: prompt,
              config: {
                thinkingConfig: { thinkingBudget: 0 }, // Disable for speed (Flash)
              },
              // PostHog enrichment (only used if PostHog wrapper is active)
              posthogDistinctId: "Brayaninho", // Consistent user identity
              posthogTraceId: traceId, // UUID for trace grouping
              posthogProperties: {
                repo: repo.full_name,
                language: repo.language,
                topics: repo.topics,
              },
            } as any); // Type assertion needed for PostHog properties

            const text = result.text || "{}";
            const categorization = this.parseResponse(text);
            const groundingChunks =
              // @ts-expect-error - groundingMetadata not in SDK types yet
              result.groundingMetadata?.groundingChunks?.length ?? 0;
            const tokensUsed = result.usageMetadata?.totalTokenCount ?? 0;

            if (this.posthog) {
              this.posthog.capture({
                distinctId: "Brayaninho", // Same user identity
                event: "$ai_generation_enriched",
                properties: {
                  $ai_trace_id: traceId, // Link to the same trace
                  repo: repo.full_name,
                  category: categorization.category,
                  confidence: categorization.confidence,
                  groundingChunks,
                },
              });
            }

            return {
              categorization,
              groundingChunks,
              tokensUsed,
            };
          } catch (error) {
            throw new GeminiAPIError(
              `Gemini API error: ${this.getErrorMessage(error)}`,
              this.extractErrorCode(error),
              isRetryableError(error),
              error
            );
          }
        },
        {
          retries: cfg.RETRY_MAX_ATTEMPTS,
          minTimeout: cfg.RETRY_DELAY_MS,
          maxTimeout: cfg.RETRY_DELAY_MS * 2,
          factor: 1.1,
          randomize: true,
          onFailedAttempt: (error) => {
            if (error.message.includes("GeminiAPIError") && !isRetryableError(error)) {
              throw error;
            }
          },
        }
      );

      return response;
    } catch (error) {
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.posthog) {
      await this.posthog.shutdown();
    }
  }

  private buildPrompt(repo: GitHubRepo): string {
    const categoryList = CATEGORIES.map(
      (cat) => `- ${cat.emoji} ${cat.name}: ${cat.description}`
    ).join("\n");

    return `Categorize this GitHub repository into EXACTLY ONE category based on its PRIMARY purpose.

Repository: ${repo.full_name}
Description: ${repo.description || "No description"}
Language: ${repo.language || "Unknown"}
Topics: ${repo.topics.join(", ") || "None"}

Available categories:
${categoryList}

Guidelines:
- Focus on the PRIMARY purpose, not secondary features
- "Learning Resources" includes: awesome lists, tutorials, algorithm collections, cheatsheets
- "Databases & Auth" includes: ORMs (Prisma), auth libraries (NextAuth), databases (Neon)
- "Utilities & Libraries" includes: general utilities (Ramda), type libraries (type-fest), converters
- "Other Tools" is a fallback for repos that truly don't fit elsewhere

Return ONLY valid JSON:
{"category": "Category Name", "confidence": 85, "reasoning": "Brief explanation"}

JSON Response:`;
  }

  private parseResponse(text: string): CategorizationResult {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new GeminiAPIError("No JSON found in response", undefined, true);
    }

    const categorization: CategorizationResult = JSON.parse(jsonMatch[0]);

    if (
      !categorization?.category ||
      typeof categorization.category !== "string" ||
      categorization.category.trim() === ""
    ) {
      throw new GeminiAPIError("Empty or invalid category in response", 503, true);
    }

    // Match category name (handle emoji prefix)
    const categoryName = categorization.category.trim();
    const matchedCategory = CATEGORIES.find(
      (cat) =>
        cat.name === categoryName ||
        `${cat.emoji} ${cat.name}` === categoryName ||
        categoryName.includes(cat.name)
    );

    if (matchedCategory) {
      categorization.category = matchedCategory.name;
    } else {
      categorization.category = "Other Tools";
      categorization.reasoning = `Original: ${categoryName}. Fallback to Other Tools.`;
    }

    return categorization;
  }

  private extractErrorCode(error: unknown): number | undefined {
    const apiError = error as {
      status?: number;
      error?: { code?: number };
    };
    return apiError.status || apiError.error?.code;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
