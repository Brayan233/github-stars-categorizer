# 🤖 GitHub Actions Setup

> Automate your GitHub Stars categorization with daily cron jobs

## 🚀 Quick Setup

### 1. Enable GitHub Actions

The workflow file is already created at [.github/workflows/categorize-stars.yml](.github/workflows/categorize-stars.yml).

### 2. Add Secrets

Go to your repository **Settings → Secrets and variables → Actions** and add:

#### Required Secret:
- `GEMINI_API_KEY`: Your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

#### Optional Secrets (for PostHog analytics):
- `POSTHOG_API_KEY`: Your PostHog project API key (e.g., `phc_...`)
- `POSTHOG_HOST`: Your PostHog host URL (e.g., `https://us.i.posthog.com`)

**Note**: `GITHUB_TOKEN` is automatically provided by GitHub Actions (no setup needed).

### 3. Push to GitHub

```bash
git add .
git commit -m "Add GitHub Stars categorization workflow"
git push
```

### 4. Test the Workflow

Go to **Actions → Categorize GitHub Stars → Run workflow** to trigger manually.

---

## ⚙️ Configuration

### Schedule

By default, runs **daily at 2 AM UTC**:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
```

**Common cron schedules**:
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Every Sunday at midnight
- `0 0 1 * *` - First day of every month

### Performance

With Gemini Flash and 40 concurrency:
- **~12 seconds** for 200 repos (full refresh)
- **~$0.08** per run (200 repos)
- **GitHub Actions free tier**: 2,000 minutes/month = plenty for daily runs

---

## 📊 Behavior

### What happens on each run:

1. **Fetch repos** (~1s): Gets all starred repos from GitHub API
2. **Analyze** (~10s): Only analyzes NEW repos (cached analyses reused)
3. **Sync GitHub Lists** (~1s):
   - ✅ **Deletes all existing lists** (default behavior)
   - ✅ **Creates 18 fresh category lists**
   - ✅ **Assigns all repos** to correct categories

### Cache behavior:

- **Repo list cache**: 360 hours / 15 days (refetches when expired)
- **Analysis cache**: Permanent (only new repos analyzed)

### First run vs subsequent runs:

**First run (200 repos)**:
- Fetches 200 repos from GitHub
- Analyzes 200 repos with Gemini (~12s)
- Creates 18 GitHub Lists
- Assigns 200 repos

**20 days later (+10 new, -5 unstarred = 205 repos)**:
- Fetches 205 repos from GitHub
- Analyzes **only 10 new** repos (~1s) ⚡
- Reuses cache for 195 old repos
- Deletes 18 old lists
- Creates 18 fresh lists
- Assigns 205 repos

**Performance**: ~12s total (vs initial 12s)

---

## 🔒 Security

### GitHub Token Permissions

The workflow uses `GITHUB_TOKEN` with default permissions. Ensure your repository has these enabled:

**Settings → Actions → General → Workflow permissions**:
- ✅ Read and write permissions (required for GitHub Lists API)

### Rate Limits

**Gemini Flash (paid tier)**:
- 1,000 RPM (Requests Per Minute)
- 1,000,000 TPM (Tokens Per Minute)
- **With 40 concurrency**: Can process ~1,000 repos in ~30s

**GitHub API**:
- 5,000 requests/hour (plenty for fetching starred repos)

---

## 🐛 Troubleshooting

### Workflow fails with "Configuration Error"

**Error**: `GEMINI_API_KEY is required`

**Fix**: Add `GEMINI_API_KEY` to repository secrets.

### Workflow fails with "gh: command not found"

GitHub Actions comes with `gh` CLI pre-installed. This shouldn't happen. If it does, check the Ubuntu runner version.

### Lists not being updated

1. Go to **Actions** tab and view the workflow run logs
2. Ensure `GITHUB_TOKEN` has write permissions (Settings → Actions → General)
3. Check for errors in the workflow logs

### PostHog events not appearing

PostHog is optional. To enable analytics:
1. Add `POSTHOG_API_KEY` and `POSTHOG_HOST` to repository secrets
2. Check PostHog project settings for the correct API key
3. See [POSTHOG-SETUP.md](POSTHOG-SETUP.md) for detailed guide

---

## 🎯 Best Practices

### For Daily Cron:

```yaml
# Recommended schedule for daily updates
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC (off-peak hours)
```

### For Development Testing:

```bash
# Test locally before pushing
pnpm categorize --dry-run --limit=5

# Full run with confirmation
pnpm categorize
```

### Cost Optimization:

- **Gemini Flash**: ~$0.08 per 200 repos
- **Daily runs**: ~$2.40/month (30 days)
- **Weekly runs**: ~$0.56/month (save 77%)

If you don't star repos frequently, consider **weekly cron**:

```yaml
on:
  schedule:
    - cron: '0 2 * * 0'  # Every Sunday at 2 AM UTC
```

---

## ✨ Done!

Your GitHub Stars are now automatically categorized daily! 🎉

Check your lists at: [github.com/stars](https://github.com/stars)
