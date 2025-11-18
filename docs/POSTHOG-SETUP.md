# 📊 PostHog Analytics Setup

> Track LLM performance and debug issues with automatic analytics

PostHog is integrated using the official `@posthog/ai` wrapper to automatically capture Gemini API performance metrics — completely optional.

## ⚡ Quick Setup

### 1. Get PostHog Credentials

1. Sign up at [PostHog Cloud](https://app.posthog.com/signup) or use your existing account
2. Create a new project or select an existing one
3. Go to **Project Settings** → **Project API Key**
4. Copy your:
   - **Project API Key** (starts with `phc_...`)
   - **Host URL** (usually `https://us.i.posthog.com` or `https://eu.i.posthog.com`)

### 2. Add to `.env`

```bash
# Add these to your .env file
POSTHOG_API_KEY=phc_your_api_key_here
POSTHOG_HOST=https://us.i.posthog.com  # or https://eu.i.posthog.com
```

### 3. Run Your Tool

```bash
# PostHog will automatically enable when credentials are present
pnpm categorize --limit=10 --dry-run --skip-cache
```

You'll see: `📊 PostHog analytics enabled - https://us.i.posthog.com`

## 🔧 How It Works

This tool uses the official PostHog integration approach:
- **`@posthog/ai`**: Wraps the Google Gen AI SDK to automatically capture `$ai_generation` events
- **No manual tracking**: Events are captured automatically with every Gemini API call
- **Enriched data**: Custom properties (repo name, language, topics, category, confidence) are added to each event

---

## 📈 What Gets Tracked

PostHog automatically captures two types of events:

### 1. `$ai_generation` (Automatic)
Captured automatically by the `@posthog/ai` wrapper for every Gemini API call:

| Property | Description |
|----------|-------------|
| `$ai_model` | Model used (e.g., `gemini-2.5-pro`) |
| `$ai_latency` | API call latency in seconds |
| `$ai_input_tokens` | Input tokens used |
| `$ai_output_tokens` | Output tokens used |
| `$ai_total_cost_usd` | Estimated cost in USD |
| `$ai_input` | Input messages/prompts |
| `$ai_output_choices` | LLM response choices |
| `repo` | Repository being analyzed (custom property) |
| `language` | Programming language (custom property) |
| `topics` | Repository topics (custom property) |

### 2. `$ai_generation_enriched` (Custom)
Additional event with categorization results:

| Property | Description |
|----------|-------------|
| `repo` | Repository name |
| `category` | Assigned category |
| `confidence` | Confidence score (0-100) |
| `groundingChunks` | Number of web searches performed |

---

## 🐛 Debugging Performance

### View Your Events

1. Go to **PostHog** → **Activity** → **Events**
2. Filter by event: `$ai_generation`
3. View individual events to see:
   - Exact latency per request
   - Which repos took longest
   - Token usage patterns
   - Grounding/web search frequency

### Create Insights

**Latency Distribution:**
```
Event: $ai_generation
Visualization: Distribution
Property: $ai_latency
```

**Slowest Repositories:**
```
Event: $ai_generation
Visualization: Table
Group by: repo
Sort by: Average $ai_latency (descending)
```

**Token Usage Over Time:**
```
Event: $ai_generation
Visualization: Line chart
Y-axis: Sum of $ai_input_tokens
```

---

## 💡 Example Insights

### Finding Slow Requests

In PostHog, create an insight:

```
Event: $ai_generation
Filter: $ai_latency > 10  (requests over 10 seconds)
Group by: repo
```

This shows which repositories consistently take longest to analyze.

### Token Usage by Category

```
Event: $ai_generation
Visualization: Bar chart
Group by: category
Y-axis: Average $ai_input_tokens
```

See which categories require the most complex prompts/analysis.

---

## 🎯 Cost Tracking (Optional)

You can calculate Gemini costs and add them to PostHog:

**Gemini 2.5 Pro Pricing** (as of 2025):
- Input: $1.25 per 1M tokens
- Output: $5.00 per 1M tokens

The cost calculation is already in the code but set to 0. Update if needed in [gemini.service.ts](src/services/gemini.service.ts#L76):

```typescript
$ai_total_cost_usd: (tokensUsed / 1000000) * 1.25  // Rough estimate
```

---

## 🔒 Privacy

PostHog tracking is:
- ✅ **Optional** - Only enabled if you add credentials
- ✅ **Transparent** - All tracked data is visible in code
- ✅ **Self-hostable** - You can run your own PostHog instance

To disable, simply remove or comment out:
```bash
# POSTHOG_API_KEY=...
# POSTHOG_HOST=...
```

---

## 🆚 PostHog Integration Approach

This tool uses PostHog's **official LLM analytics integration**:

| Aspect | Details |
|--------|---------|
| **Package** | `@posthog/ai` - Official PostHog wrapper for Google Gen AI |
| **Setup** | Simple - just pass PostHog client to GoogleGenAI constructor |
| **Tracking** | Automatic - `$ai_generation` events captured for every API call |
| **Enrichment** | Custom properties added via `posthogProperties` parameter |
| **Privacy** | Optional - only enabled when credentials are provided |

See [PostHog LLM Analytics Docs](https://posthog.com/docs/ai-engineering/llm-analytics) for more details.

---

## 📚 Resources

- [PostHog Dashboard](https://app.posthog.com)
- [PostHog LLM Analytics Docs](https://posthog.com/docs/ai-engineering/llm-analytics)
- [PostHog Node SDK](https://posthog.com/docs/libraries/node)

---

Happy debugging! 📊
