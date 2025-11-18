/**
 * PostHog initialization
 * Must be imported first in the application
 */

// Load environment variables FIRST
import { config as loadEnv } from "dotenv";
loadEnv();

// Check if PostHog is configured
const posthogEnabled = Boolean(
  process.env.POSTHOG_API_KEY &&
  process.env.POSTHOG_HOST
);

if (posthogEnabled) {
  console.log("📊 PostHog analytics enabled -", process.env.POSTHOG_HOST);
} else {
  console.log("⚠️  PostHog analytics disabled (add POSTHOG_* keys to .env to enable)");
}
