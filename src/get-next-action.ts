import { generateObject } from "ai";
import { model } from "~/model";
import { z } from "zod";
import { SystemContext } from "./system-context";

// Action types for the next action decision
export interface SearchAction {
  type: "search";
  title: string;
  reasoning: string;
  query: string;
}

export interface ScrapeAction {
  type: "scrape";
  title: string;
  reasoning: string;
  urls: string[];
}

export interface AnswerAction {
  type: "answer";
  title: string;
  reasoning: string;
}

export type Action = SearchAction | ScrapeAction | AnswerAction;

// Type for message annotations
export type OurMessageAnnotation = {
  type: "NEW_ACTION";
  action: Action;
};

// Schema for structured LLM output - avoiding z.union for better LLM compatibility
export const actionSchema = z.object({
  title: z
    .string()
    .describe(
      "The title of the action, to be displayed in the UI. Be extremely concise. 'Searching Saka's injury history', 'Checking HMRC industrial action', 'Comparing toaster ovens'",
    ),
  reasoning: z.string().describe("The reason you chose this step."),
  type: z.enum(["search", "scrape", "answer"]).describe(
    `The type of action to take.
      - 'search': Search the web for more information.
      - 'scrape': Scrape a URL.
      - 'answer': Answer the user's question and complete the loop.`,
  ),
  query: z
    .string()
    .describe("The query to search for. Required if type is 'search'.")
    .optional(),
  urls: z
    .array(z.string())
    .describe("The URLs to scrape. Required if type is 'scrape'.")
    .optional(),
});

export const getNextAction = async (
  context: SystemContext,
  userQuestion: string,
  langfuseTraceId?: string,
) => {
  const result = await generateObject({
    model,
    schema: actionSchema,
    ...(langfuseTraceId && {
      experimental_telemetry: {
        isEnabled: true,
        functionId: "get-next-action",
        metadata: {
          langfuseTraceId: langfuseTraceId,
        },
      },
    }),
    prompt: `
You are a helpful AI assistant with access to real-time web search and scraping capabilities. The current date and time is ${new Date().toLocaleString()}.

Your goal is to gather comprehensive information to answer the user's question accurately and thoroughly.

User's Question: "${userQuestion}"

Your workflow should be:
1. If you need more information, SEARCH the web for relevant, up-to-date information from diverse sources
2. If you have found relevant URLs in search results, SCRAPE those pages to get full content (4-6 URLs maximum per scrape action)
3. When you have sufficient information from multiple sources, ANSWER the user's question

Guidelines:
- Always search for current, authoritative information
- Prioritize official sources and reputable websites
- Scrape multiple diverse sources (news sites, documentation, blogs, etc.)
- Don't rely solely on search snippets - scrape pages for full content
- Only answer when you have comprehensive information from scraped sources

Current Context:

Query History:
${context.getQueryHistory() || "No queries performed yet."}

Scrape History:
${context.getScrapeHistory() || "No pages scraped yet."}

Based on the context above and the user's question, what should be the next action?
    `,
  });

  return result.object;
};
