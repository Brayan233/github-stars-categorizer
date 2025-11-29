/**
 * GitHub API service for fetching repos and managing lists
 */

import { execa } from "execa";
import PQueue from "p-queue";
import { CATEGORIES } from "../config.js";
import { GitHubAPIError } from "../lib/errors.js";
import type { AnalysisResult, GitHubList, GitHubRepo } from "../types.js";

export class GitHubService {
  private queue: PQueue;

  constructor() {
    // Conservative rate limiting to avoid GitHub's secondary mutation limits (180/min)
    this.queue = new PQueue({
      intervalCap: 2,
      interval: 1000,
      concurrency: 2,
    });
  }

  async verifyTokenScopes(): Promise<void> {
    try {
      console.log('Verifying GitHub token scopes...');
      const { stdout } = await execa("gh", [
        "api",
        "/",
        "--include",
        "--silent"
      ]);
      
      const scopesMatch = stdout.match(/x-oauth-scopes:\s*(.*)/i);
      if (scopesMatch) {
        console.log(`Current Token Scopes: ${scopesMatch[1]}`);
        if (!scopesMatch[1].includes('user')) {
          console.warn('WARNING: Token does not appear to have the "user" scope. List management may fail.');
        }
      } else {
        console.log('Could not determine token scopes from headers.');
      }
    } catch (error) {
      console.error('Failed to verify token scopes:', error);
    }
  }

  async getUsername(): Promise<string> {
    try {
      const { stdout } = await execa("gh", [
        "api",
        "user",
        "--jq",
        ".login",
      ]);

      return stdout.trim();
    } catch (error) {
      throw new GitHubAPIError("Failed to fetch username", undefined, error);
    }
  }

  async fetchStarredRepos(): Promise<GitHubRepo[]> {
    await this.verifyTokenScopes();
    try {
      console.log('Executing gh CLI command to fetch starred repos...');
      
      const result = await execa("gh", [
        "api",
        "user/starred",
        "--paginate",
        "--jq",
        ".[] | {full_name, node_id, description, language, topics, html_url}",
      ], {
        timeout: 60000, // 60 second timeout
      });

      console.log('gh CLI command completed successfully');
      console.log(`stderr: ${result.stderr || 'none'}`);
      
      const { stdout } = result;

      // Parse JSONL (each line is a JSON object)
      const repos: GitHubRepo[] = stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      console.log(`Successfully parsed ${repos.length} repositories`);
      return repos;
    } catch (error) {
      console.error('Error fetching starred repositories:');
      console.error('Error details:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw new GitHubAPIError("Failed to fetch starred repositories", undefined, error);
    }
  }

  async getAllLists(): Promise<GitHubList[]> {
    try {
      const { stdout } = await execa("gh", [
        "api",
        "graphql",
        "-f",
        "query=query { viewer { lists(first: 100) { nodes { id name description } } } }",
      ]);

      const result = JSON.parse(stdout);
      return result.data?.viewer?.lists?.nodes || [];
    } catch (error) {
      throw new GitHubAPIError("Failed to fetch GitHub Lists", undefined, error);
    }
  }

  async clearAllLists(): Promise<number> {
    console.log('Fetching existing lists to clear...');
    const lists = await this.getAllLists();
    console.log(`Found ${lists.length} lists to clear`);

    if (lists.length === 0) {
      return 0;
    }

    console.log('Deleting lists...');
    // Delete lists in parallel with rate limiting
    await Promise.all(
      lists.map((list) =>
        this.queue.add(() => this.deleteList(list.id))
      )
    );

    console.log('All lists cleared successfully');
    return lists.length;
  }

  private async deleteList(listId: string): Promise<void> {
    console.log(`Deleting list ${listId}...`);
    try {
      await this.graphqlMutation(
        `mutation DeleteList($id: ID!) {
          deleteUserList(input: { listId: $id }) {
            clientMutationId
          }
        }`,
        { id: listId }
      );
      console.log(`Deleted list ${listId}`);
    } catch (error) {
      console.error(`Failed to delete list ${listId}:`, error);
      if (error instanceof Error && error.message.includes("Resource not accessible by personal access token")) {
        console.error("HINT: This error usually means your GH_PAT is missing the 'user' scope (for Classic PATs) or the necessary permissions for managing User Lists.");
      }
      throw error;
    }
  }

  async createLists(): Promise<GitHubList[]> {
    console.log(`Creating ${CATEGORIES.length} GitHub lists...`);
    // Create lists in parallel with rate limiting
    const lists = await Promise.all(
      CATEGORIES.map((category) =>
        this.queue.add(() => this.createList(category.emoji, category.name, category.description))
      )
    );

    const createdCount = lists.filter((l) => l !== null).length;
    console.log(`Successfully created/verified ${createdCount} lists`);
    return lists.filter((list): list is GitHubList => list !== null);
  }

  private async createList(
    emoji: string,
    name: string,
    description: string
  ): Promise<GitHubList | null> {
    const fullName = `${emoji} ${name}`;
    // console.log(`Creating list: ${fullName}`);

    const result = await this.graphqlMutation(
      `mutation CreateList($name: String!, $description: String!) {
        createUserList(input: { name: $name, description: $description, isPrivate: false }) {
          list {
            id
            name
            description
          }
        }
      }`,
      { name: fullName, description }
    ) as { data?: { createUserList?: { list?: GitHubList } } };

    return result.data?.createUserList?.list || null;
  }

  async assignReposToLists(
    results: AnalysisResult[],
    lists: GitHubList[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    // Filter successful results
    const successfulResults = results.filter((r) => !r.failed);
    console.log(`Assigning ${successfulResults.length} repositories to lists...`);

    // Create category to list ID mapping
    const categoryToListId = new Map<string, string>();
    for (const list of lists) {
      const categoryName = list.name.substring(list.name.indexOf(" ") + 1);
      categoryToListId.set(categoryName, list.id);
    }

    // Group by category
    const assignments = successfulResults.map((result) => ({
      listId: categoryToListId.get(result.categorization.category),
      nodeId: result.repo.node_id,
    })).filter((a): a is { listId: string; nodeId: string } => a.listId !== undefined);

    const total = assignments.length;
    let completed = 0;

    // Batch assignments: 10 repos per GraphQL request (to avoid hitting payload limits)
    const BATCH_SIZE = 10;
    const batches: typeof assignments[] = [];
    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      batches.push(assignments.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${batches.length} batches of assignments...`);

    // Process batches with rate limiting
    await Promise.all(
      batches.map((batch) =>
        this.queue.add(async () => {
          // console.log(`Processing batch ${index + 1}/${batches.length}`);
          await this.assignReposBatch(batch);
          completed += batch.length;
          onProgress?.(completed, total);
        })
      )
    );
    
    console.log('All repositories assigned successfully');
  }

  private async assignReposBatch(
    assignments: Array<{ listId: string; nodeId: string }>
  ): Promise<void> {
    // Build a mutation with multiple operations using aliases
    const mutations = assignments
      .map((assignment, index) => {
        return `
          mutation${index}: updateUserListsForItem(input: {
            listIds: ["${assignment.listId}"]
            itemId: "${assignment.nodeId}"
          }) {
            user { id }
          }
        `;
      })
      .join("\n");

    const query = `mutation BatchAssign {
      ${mutations}
    }`;

    await this.graphqlMutation(query, {});
  }

  private async graphqlMutation(
    mutation: string,
    variables: Record<string, unknown>
  ): Promise<unknown> {
    try {
      const payload = {
        query: mutation,
        variables,
      };

      // console.log('Executing GraphQL mutation...');
      const { stdout } = await execa("gh", [
        "api",
        "graphql",
        "--input",
        "-",
      ], {
        input: JSON.stringify(payload),
        timeout: 30000, // 30 second timeout
      });

      return JSON.parse(stdout);
    } catch (error) {
      console.error('GraphQL mutation failed:', error);
      throw new GitHubAPIError("GraphQL mutation failed", undefined, error);
    }
  }
}
