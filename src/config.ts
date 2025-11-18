/**
 * Category configuration for GitHub starred repos
 */

import type { CategoryConfig } from "./types";

export const CATEGORIES: CategoryConfig[] = [
  {
    name: "AI & LLM",
    emoji: "🤖",
    description:
      "AI/LLM libraries (LangChain, LlamaIndex), vector databases, RAG frameworks, AI model APIs. NOT workflow engines that support AI agents - those are Backend.",
  },
  {
    name: "UI & Design Systems",
    emoji: "🎨",
    description:
      "Component libraries, design systems, Tailwind, Shadcn, animations",
  },
  {
    name: "Frontend Frameworks",
    emoji: "⚛️",
    description: "React, Next.js, Vue, Remix, Svelte, Deno Fresh",
  },
  {
    name: "Testing & QA",
    emoji: "🧪",
    description: "Cypress, Playwright, test frameworks, E2E tools",
  },
  {
    name: "Backend & Runtimes",
    emoji: "🚀",
    description:
      "Runtimes (Node, Deno, Bun), API frameworks, workflow/orchestration engines (Temporal, Inngest, Vercel Workflow), backend services, job queues.",
  },
  {
    name: "DevOps & Containers",
    emoji: "🐳",
    description: "Docker, Kubernetes, containers, infrastructure, deployment",
  },
  {
    name: "CLI & Terminal",
    emoji: "💻",
    description:
      "Command-line tools, shell utilities, terminal emulators, prompts",
  },
  {
    name: "Code Quality",
    emoji: "✨",
    description:
      "Linters, formatters, static analysis, Prettier, ESLint, Biome",
  },
  {
    name: "Dev Tooling",
    emoji: "🛠️",
    description:
      "Build/bundle tools (Webpack, Vite, Turbo), package managers (pnpm), monorepo tools. NOT analytics, monitoring, or product tools.",
  },
  {
    name: "Web Scraping & APIs",
    emoji: "🌐",
    description: "Web scrapers, HTTP clients, API tools, data extraction",
  },
  {
    name: "Editors & IDEs",
    emoji: "📝",
    description: "Code editors, IDEs, VSCode extensions, editor tools",
  },
  {
    name: "Media & Download",
    emoji: "📹",
    description: "Video downloaders, media tools, streaming tools",
  },
  {
    name: "Trading & Finance",
    emoji: "📈",
    description: "Trading bots, backtesting, technical analysis, finance tools",
  },
  {
    name: "Logging & Debug",
    emoji: "🔍",
    description:
      "Logging, debugging, network tools, monitoring, observability, product analytics (PostHog, Sentry, Mixpanel), APM, session recording.",
  },
  {
    name: "Databases & Auth",
    emoji: "🔐",
    description:
      "Databases (Postgres, MongoDB, Neon, Prisma), ORMs, authentication libraries (NextAuth, Better Auth), session management",
  },
  {
    name: "Learning Resources",
    emoji: "📚",
    description:
      "Awesome lists, tutorials, courses (30-Days-Of-*, You-Dont-Know-JS), algorithm collections, cheatsheets, educational repos",
  },
  {
    name: "Utilities & Libraries",
    emoji: "🧰",
    description:
      "General-purpose utilities (Ramda, Lodash), data structures, type libraries (type-fest), converters (turndown), diagram tools (Mermaid)",
  },
  {
    name: "Other Tools",
    emoji: "📦",
    description: "Security tools, browsers, system utilities, misc tools that don't fit other categories",
  },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
