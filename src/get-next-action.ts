import { generateObject, type Message } from "ai";
import { model } from "~/model";
import { z } from "zod";
import { SystemContext } from "./system-context";

// Action types for the next action decision
export interface ContinueAction {
  type: "continue";
  title: string;
  reasoning: string;
  feedback: string;
}

export interface AnswerAction {
  type: "answer";
  title: string;
  reasoning: string;
}

export interface PlanAction {
  type: "plan";
  title: string;
  reasoning: string;
  queries: string[];
}

export type Action = ContinueAction | AnswerAction | PlanAction;

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
      "The title of the action, to be displayed in the UI. Be extremely concise. 'Evaluating information gaps', 'Ready to answer', 'Information assessment complete'",
    ),
  reasoning: z.string().describe("The reason you chose this step."),
  feedback: z
    .string()
    .optional()
    .describe(
      "Detailed analysis of what information is available, what gaps exist, and why you're continuing the search. This feedback will be used to improve future searches. Be specific about missing information, quality of sources, and areas that need clarification. Only required when type is 'continue'.",
    ),
  type: z.enum(["continue", "answer"]).describe(
    `The type of action to take.
      - 'continue': Continue gathering more information before answering.
      - 'answer': You have sufficient information to answer the user's question.`,
  ),
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
You are a research query optimizer. Your task is to analyze search results against the original research goal and either decide to answer the question or to search for more information.

PROCESS:
1. Identify ALL information explicitly requested in the original research goal
2. Analyze what specific information has been successfully retrieved in the search results
3. Identify ALL information gaps between what was requested and what was found
4. For entity-specific gaps: Create targeted feedback for each missing attribute of identified entities
5. For general knowledge gaps: Create focused feedback to find the missing conceptual information

${locationContext}
CONVERSATION HISTORY:
${conversationHistory}

CURRENT USER QUESTION: "${userQuestion}"

Current Research Context:
${context.getSearchHistory() || "No searches performed yet."}

EVALUATION CRITERIA:
- CONTINUE if critical information is missing that would prevent a comprehensive answer
- CONTINUE if sources are not authoritative enough for the question's importance
- CONTINUE if the question has multiple aspects that haven't been fully explored
- CONTINUE if recent developments or updates might affect the answer
- ANSWER if you have comprehensive, reliable information that addresses all aspects of the question
- ANSWER if additional searches would likely yield diminishing returns

IMPORTANT: Only provide feedback when choosing 'continue'. When choosing 'answer', feedback is not needed.

When choosing 'continue', in your feedback be specific about:
- What information you have found and its quality
- What specific gaps exist and why they matter
- What types of sources or information would fill these gaps
- How confident you are in the current information

Provide your assessment of the current information state and next action.
    `,
  });

  return result.object;
};
