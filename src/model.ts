import { google } from "@ai-sdk/google";
import { env } from "~/env.js";

// Ensure API key is available before creating the model
if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.warn(
    "⚠️  GOOGLE_GENERATIVE_AI_API_KEY is not set. Please add it to your .env file.",
  );
}

export const model = google("gemini-2.0-flash-001");

export const factualityModel = google("gemini-1.5-flash");
