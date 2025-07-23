import {
  streamText,
  smoothStream,
  type StreamTextResult,
  type Message,
} from "ai";
import { model } from "~/model";
import { SystemContext } from "./system-context";
import { markdownJoinerTransform } from "./markdown-joiner";

export function answerQuestion(
  context: SystemContext,
  options: {
    isFinal?: boolean;
    langfuseTraceId?: string;
    onFinish?: Parameters<typeof streamText>[0]["onFinish"];
  } = {},
): StreamTextResult<{}, string> {
  const { isFinal = false, langfuseTraceId, onFinish } = options;

  // Get the conversation history and current user question from context
  const conversationHistory = context.getMessageHistory();
  const userQuestion = context.getCurrentUserQuestion();

  const systemPrompt = `You are a helpful AI assistant. Your goal is to provide accurate, comprehensive answers based on the information you have gathered.

${
  isFinal
    ? "IMPORTANT: This is your final attempt to answer the question. You may not have all the information you need, but you must provide your best possible answer based on what you have gathered so far."
    : "Based on the web searches and scraped content you have access to, provide a thorough and accurate answer to the user's question."
}

CONVERSATION HISTORY:
${conversationHistory}

CURRENT USER QUESTION: "${userQuestion}"

Guidelines:
- Use the information from scraped pages as your primary source
- Always cite your sources using markdown links [title](url)
- Be thorough but concise in your response
- If you found conflicting information, acknowledge it and explain the different perspectives
- If you're missing critical information, acknowledge the limitations
- Structure your answer clearly with headings if appropriate
- Never include raw URLs - always use markdown link format
- IMPORTANT: Consider the full conversation history when crafting your answer. If the user is asking a follow-up question, make sure to reference and build upon the previous conversation context.

Current Context:

Query History:
${context.getQueryHistory() || "No queries were performed."}

Scrape History:
${context.getScrapeHistory() || "No pages were scraped."}

Please provide a comprehensive answer based on the conversation history and the information you have gathered.`;

  return streamText({
    model,
    prompt: systemPrompt,
    onFinish,
    ...(langfuseTraceId && {
      experimental_telemetry: {
        isEnabled: true,
        functionId: "answer-question",
        metadata: {
          langfuseTraceId: langfuseTraceId,
        },
      },
    }),
    experimental_transform: [
      smoothStream({
        delayInMs: 50,
        chunking: "word",
      }),
      markdownJoinerTransform(),
    ],
  });
}
