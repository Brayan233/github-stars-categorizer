import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAnalysisResult, mockRepo } from "../../__tests__/helpers/fixtures";
import { GitHubService } from "../github.service";

// Mock execa for GitHub CLI calls - must be hoisted
const mockExeca = vi.hoisted(() => vi.fn());

vi.mock("execa", () => ({
  execa: mockExeca,
}));

describe("GitHubService", () => {
  let service: GitHubService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubService();
  });

  describe("getUsername", () => {
    it("should fetch GitHub username from CLI", async () => {
      mockExeca.mockResolvedValue({
        stdout: "testuser",
      });

      const username = await service.getUsername();

      expect(username).toBe("testuser");
      expect(mockExeca).toHaveBeenCalledWith("gh", [
        "api",
        "user",
        "--jq",
        ".login",
      ]);
    });

    it("should handle errors when fetching username", async () => {
      mockExeca.mockRejectedValue(new Error("gh not authenticated"));

      await expect(service.getUsername()).rejects.toThrow();
    });
  });

  describe("fetchStarredRepos", () => {
    it("should fetch starred repositories", async () => {
      // Mock JSONL format (one JSON object per line)
      const mockJsonl = [
        JSON.stringify({
          full_name: "facebook/react",
          node_id: "node123",
          description: "A JavaScript library",
          language: "JavaScript",
          topics: ["react", "ui"],
          html_url: "https://github.com/facebook/react",
        }),
        JSON.stringify({
          full_name: "vuejs/vue",
          node_id: "node456",
          description: "Progressive framework",
          language: "JavaScript",
          topics: ["vue", "framework"],
          html_url: "https://github.com/vuejs/vue",
        }),
      ].join("\n");

      mockExeca.mockResolvedValue({
        stdout: mockJsonl,
      });

      const repos = await service.fetchStarredRepos();

      expect(repos).toHaveLength(2);
      expect(repos[0].full_name).toBe("facebook/react");
      expect(repos[1].full_name).toBe("vuejs/vue");
      expect(mockExeca).toHaveBeenCalledWith(
        "gh",
        ["api", "user/starred", "--paginate", "--jq", expect.any(String)],
        { timeout: 60000 }
      );
    });

    it("should handle empty starred repos", async () => {
      mockExeca.mockResolvedValue({
        stdout: "",
      });

      const repos = await service.fetchStarredRepos();

      expect(repos).toEqual([]);
    });

    it("should handle repos with null values", async () => {
      const mockJsonl = JSON.stringify({
        full_name: "test/repo",
        node_id: "node456",
        description: null,
        language: null,
        topics: [],
        html_url: "https://github.com/test/repo",
      });

      mockExeca.mockResolvedValue({
        stdout: mockJsonl,
      });

      const repos = await service.fetchStarredRepos();

      expect(repos[0].description).toBeNull();
      expect(repos[0].language).toBeNull();
      expect(repos[0].topics).toEqual([]);
    });

    it("should filter out empty lines", async () => {
      const mockJsonl = [
        JSON.stringify({
          full_name: "repo1",
          node_id: "n1",
          description: "D1",
          language: "JS",
          topics: [],
          html_url: "url1",
        }),
        "",
        "  ",
        JSON.stringify({
          full_name: "repo2",
          node_id: "n2",
          description: "D2",
          language: "TS",
          topics: [],
          html_url: "url2",
        }),
      ].join("\n");

      mockExeca.mockResolvedValue({
        stdout: mockJsonl,
      });

      const repos = await service.fetchStarredRepos();

      expect(repos).toHaveLength(2);
    });
  });

  describe("getAllLists", () => {
    it("should fetch all GitHub lists", async () => {
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({
          data: {
            viewer: {
              lists: {
                nodes: [
                  {
                    id: "list1",
                    name: "⚛️ Frontend Frameworks",
                    description: "React, Vue, etc",
                  },
                  { id: "list2", name: "🤖 AI & LLM", description: "AI tools" },
                ],
              },
            },
          },
        }),
      });

      const lists = await service.getAllLists();

      expect(lists).toHaveLength(2);
      expect(lists[0].name).toBe("⚛️ Frontend Frameworks");
      expect(lists[1].name).toBe("🤖 AI & LLM");
    });

    it("should return empty array if no lists exist", async () => {
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({
          data: {
            viewer: {
              lists: {
                nodes: [],
              },
            },
          },
        }),
      });

      const lists = await service.getAllLists();

      expect(lists).toEqual([]);
    });

    it("should handle missing data structure", async () => {
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({}),
      });

      const lists = await service.getAllLists();

      expect(lists).toEqual([]);
    });
  });

  describe("clearAllLists", () => {
    it("should delete all existing lists", async () => {
      // First call to getAllLists
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({
          data: {
            viewer: {
              lists: {
                nodes: [
                  { id: "list1", name: "List 1", description: "Desc 1" },
                  { id: "list2", name: "List 2", description: "Desc 2" },
                ],
              },
            },
          },
        }),
      });

      // Subsequent calls for delete mutations
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({}),
      });

      const deletedCount = await service.clearAllLists();

      expect(deletedCount).toBe(2);
      // Should have made 1 call to get lists + 2 calls to delete
      expect(mockExeca).toHaveBeenCalledTimes(3);
    });

    it("should return 0 if no lists exist", async () => {
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({
          data: {
            viewer: {
              lists: {
                nodes: [],
              },
            },
          },
        }),
      });

      const deletedCount = await service.clearAllLists();

      expect(deletedCount).toBe(0);
      expect(mockExeca).toHaveBeenCalledTimes(1); // Only the getAllLists call
    });
  });

  describe("createLists", () => {
    it("should create lists for all categories", async () => {
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({
          data: {
            createUserList: {
              list: {
                id: "list123",
                name: "⚛️ Frontend Frameworks",
                description: "React, Vue, Angular, etc.",
              },
            },
          },
        }),
      });

      const lists = await service.createLists();

      expect(lists.length).toBeGreaterThan(0);
      expect(mockExeca).toHaveBeenCalled();
    });

    it("should filter out null responses", async () => {
      // Some succeed, some fail
      mockExeca
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            data: {
              createUserList: {
                list: { id: "list1", name: "List 1", description: "Desc 1" },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({}), // Missing data
        });

      const lists = await service.createLists();

      // Should only include successful creations
      expect(lists.every((list) => list.id)).toBe(true);
    });
  });

  describe("assignReposToLists", () => {
    it("should assign repos to their categorized lists", async () => {
      const results = [
        mockAnalysisResult({
          repo: mockRepo({ full_name: "facebook/react", node_id: "node1" }),
          categorization: {
            category: "Frontend Frameworks",
            confidence: 95,
            reasoning: "React",
          },
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: "vuejs/vue", node_id: "node2" }),
          categorization: {
            category: "Frontend Frameworks",
            confidence: 90,
            reasoning: "Vue",
          },
        }),
      ];

      const lists = [
        {
          id: "list123",
          name: "⚛️ Frontend Frameworks",
          description: "Frameworks",
        },
      ];

      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({}),
      });

      await service.assignReposToLists(results, lists);

      // Should have made at least one GraphQL mutation
      expect(mockExeca).toHaveBeenCalled();
    });

    it("should skip failed results", async () => {
      const results = [
        mockAnalysisResult({
          repo: mockRepo({ full_name: "success/repo", node_id: "node1" }),
          categorization: {
            category: "Frontend Frameworks",
            confidence: 95,
            reasoning: "Good",
          },
          failed: false,
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: "failed/repo", node_id: "node2" }),
          categorization: {
            category: "Uncategorized",
            confidence: 0,
            reasoning: "Failed",
          },
          failed: true,
        }),
      ];

      const lists = [
        {
          id: "list123",
          name: "⚛️ Frontend Frameworks",
          description: "Frameworks",
        },
      ];

      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({}),
      });

      await service.assignReposToLists(results, lists);

      // Should process but skip failed results
      expect(mockExeca).toHaveBeenCalled();
    });

    it("should call progress callback", async () => {
      const results = [
        mockAnalysisResult({
          repo: mockRepo({ full_name: "repo1", node_id: "node1" }),
        }),
        mockAnalysisResult({
          repo: mockRepo({ full_name: "repo2", node_id: "node2" }),
        }),
      ];

      const lists = [
        {
          id: "list123",
          name: "⚛️ Frontend Frameworks",
          description: "Frameworks",
        },
      ];

      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({}),
      });

      const progressCallback = vi.fn();
      await service.assignReposToLists(results, lists, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });

    it("should handle empty results", async () => {
      const results: any[] = [];
      const lists: any[] = [];

      await service.assignReposToLists(results, lists);

      // Should not make any API calls for empty data
      expect(mockExeca).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should throw GitHubAPIError on fetch failure", async () => {
      mockExeca.mockRejectedValue(new Error("Network error"));

      await expect(service.fetchStarredRepos()).rejects.toThrow(
        "Failed to fetch starred repositories"
      );
    });

    it("should throw GitHubAPIError on GraphQL errors", async () => {
      mockExeca.mockRejectedValue({
        stderr: "GraphQL error: Rate limit exceeded",
      });

      await expect(service.getAllLists()).rejects.toThrow();
    });

    it("should retry on GitHub secondary rate limit and succeed", async () => {
      // First call (attempt 1) -> rejected with secondary rate limit
      // Second call (retry) -> succeeds
      mockExeca
        .mockRejectedValueOnce({
          stderr:
            "gh: You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)",
          stdout: JSON.stringify({
            documentation_url: "https://example",
            message: "You have exceeded a secondary rate limit.",
          }),
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ data: { success: true } }),
        });

      // Call the private method via casting (tests can access private members this way)
      const result = await (service as any).graphqlMutation(
        "mutation Test { dummy }",
        {}
      );

      expect(result).toEqual({ data: { success: true } });
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });
  });
});
