import { generateObject } from "ai";
import { model } from "~/model";
import { z } from "zod";
import { SystemContext } from "./system-context";

// Schema for the query rewriter output
export const queryRewriterSchema = z.object({
  plan: z
    .string()
    .describe(
      "A detailed strategic research plan that outlines the logical progression of information needed, identifies dependencies, and considers multiple angles. This should be a comprehensive analysis of what needs to be researched and why.",
    ),
  queries: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe(
      "A numbered list of 3-5 sequential search queries that progress logically from foundational to specific information. Each query should be specific, focused, written in natural language, and build upon each other.",
    ),
});

export type QueryRewriterResult = z.infer<typeof queryRewriterSchema>;

export const rewriteQueries = async (
  context: SystemContext,
  langfuseTraceId?: string,
): Promise<QueryRewriterResult> => {
  // Get the conversation history and current user question from context
  const conversationHistory = context.getMessageHistory();
  const userQuestion = context.getCurrentUserQuestion();
  const locationContext = context.getLocationContext();
  const searchHistory = context.getSearchHistory();
  const latestFeedback = context.getLatestFeedback();

  const result = await generateObject({
    model,
    schema: queryRewriterSchema,
    ...(langfuseTraceId && {
      experimental_telemetry: {
        isEnabled: true,
        functionId: "query-rewriter",
        metadata: {
          langfuseTraceId: langfuseTraceId,
        },
      },
    }),
    prompt: `You are a strategic research planner with expertise in breaking down complex questions into logical search steps. Your primary role is to create a detailed research plan before generating any search queries.

First, analyze the question thoroughly:
- Break down the core components and key concepts
- Identify any implicit assumptions or context needed
- Consider what foundational knowledge might be required
- Think about potential information gaps that need filling

Then, develop a strategic research plan that:
- Outlines the logical progression of information needed
- Identifies dependencies between different pieces of information
- Considers multiple angles or perspectives that might be relevant
- Anticipates potential dead-ends or areas needing clarification

Finally, translate this plan into a numbered list of 3-5 sequential search queries that:
- Are specific and focused (avoid broad queries that return general information)
- Are written in natural language without Boolean operators (no AND/OR)
- Progress logically from foundational to specific information
- Build upon each other in a meaningful way

Remember that initial queries can be exploratory - they help establish baseline information or verify assumptions before proceeding to more targeted searches. Each query should serve a specific purpose in your overall research plan.

${locationContext}
CONVERSATION HISTORY:
${conversationHistory}

CURRENT USER QUESTION: "${userQuestion}"

PREVIOUS SEARCH HISTORY:
${searchHistory || "No previous searches performed."}

EVALUATOR FEEDBACK:
${latestFeedback || "No previous feedback available."}

Based on the conversation history, previous searches, and especially the evaluator feedback, create a comprehensive research plan and generate the next set of search queries needed to address the specific information gaps identified by the evaluator.`,
  });

  // Report usage to context
  if (result.usage) {
    context.reportUsage("query-rewriter", result.usage);
  }

  return result.object;
};
