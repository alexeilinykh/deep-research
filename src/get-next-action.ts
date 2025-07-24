import { generateObject, type Message } from "ai";
import { model } from "~/model";
import { z } from "zod";
import { SystemContext } from "./system-context";

// Action types for the next action decision
export interface ContinueAction {
  type: "continue";
  title: string;
  reasoning: string;
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
      "The title of the action, to be displayed in the UI. Be extremely concise. 'Continuing research', 'Ready to answer', 'Gathering more information'",
    ),
  reasoning: z.string().describe("The reason you chose this step."),
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
You are a decision-making AI assistant. Your role is to determine whether you have sufficient information to answer the user's question comprehensively, or if you need to continue gathering more information.

${locationContext}
CONVERSATION HISTORY:
${conversationHistory}

CURRENT USER QUESTION: "${userQuestion}"

Current Research Context:
${context.getSearchHistory() || "No searches performed yet."}

Your task is simple: decide whether to CONTINUE gathering information or to ANSWER the question.

Guidelines for decision-making:
- CONTINUE if you need more current, specific, or comprehensive information
- CONTINUE if the question requires multiple perspectives or sources
- CONTINUE if you haven't found authoritative sources on key aspects
- CONTINUE if there are important details missing from your current knowledge
- ANSWER if you have comprehensive, current, and reliable information from multiple sources
- ANSWER if you have enough information to provide a thorough and accurate response
- ANSWER if continuing to search would likely yield diminishing returns

Consider the complexity of the question and the quality/depth of information you already have.

What should be the next action?
    `,
  });

  return result.object;
};
