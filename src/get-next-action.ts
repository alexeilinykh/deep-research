import { generateObject, type Message } from "ai";
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

export interface AnswerAction {
  type: "answer";
  title: string;
  reasoning: string;
}

export type Action = SearchAction | AnswerAction;

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
  type: z.enum(["search", "answer"]).describe(
    `The type of action to take.
      - 'search': Search the web for information and automatically scrape the top results for detailed content.
      - 'answer': Answer the user's question and complete the loop.`,
  ),
  query: z
    .string()
    .describe("The query to search for. Required if type is 'search'.")
    .optional(),
});

export const getNextAction = async (
  context: SystemContext,
  langfuseTraceId?: string,
) => {
  // Get the conversation history and current user question from context
  const conversationHistory = context.getMessageHistory();
  const userQuestion = context.getCurrentUserQuestion();
  const locationContext = context.getLocationContext();

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
${locationContext}
CONVERSATION HISTORY:
${conversationHistory}

CURRENT USER QUESTION: "${userQuestion}"

Your workflow should be:
1. If you need more information, SEARCH the web for relevant, up-to-date information from diverse sources. The search will automatically scrape the top results to get full content.
2. When you have sufficient information from multiple sources, ANSWER the user's question

Guidelines:
- Always search for current, authoritative information
- Prioritize official sources and reputable websites
- The search action will automatically scrape multiple diverse sources (news sites, documentation, blogs, etc.)
- Don't rely solely on search snippets - the full scraped content will be available
- Only answer when you have comprehensive information from scraped sources
- IMPORTANT: Consider the full conversation history when deciding what action to take. If the user is asking a follow-up question, understand what they're referring to from the previous conversation.

Current Context:

Search History:
${context.getSearchHistory() || "No searches performed yet."}

Based on the conversation history, current context, and the user's question, what should be the next action?
    `,
  });

  return result.object;
};
