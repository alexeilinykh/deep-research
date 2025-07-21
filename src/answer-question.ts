import { streamText, type StreamTextResult } from "ai";
import { model } from "~/model";
import { SystemContext } from "./system-context";

export function answerQuestion(
  context: SystemContext,
  userQuestion: string,
  options: { isFinal?: boolean } = {},
): StreamTextResult<{}, string> {
  const { isFinal = false } = options;

  const systemPrompt = `You are a helpful AI assistant. Your goal is to provide accurate, comprehensive answers based on the information you have gathered.

${
  isFinal
    ? "IMPORTANT: This is your final attempt to answer the question. You may not have all the information you need, but you must provide your best possible answer based on what you have gathered so far."
    : "Based on the web searches and scraped content you have access to, provide a thorough and accurate answer to the user's question."
}

Guidelines:
- Use the information from scraped pages as your primary source
- Always cite your sources using markdown links [title](url)
- Be thorough but concise in your response
- If you found conflicting information, acknowledge it and explain the different perspectives
- If you're missing critical information, acknowledge the limitations
- Structure your answer clearly with headings if appropriate
- Never include raw URLs - always use markdown link format

Current Context:

Query History:
${context.getQueryHistory() || "No queries were performed."}

Scrape History:
${context.getScrapeHistory() || "No pages were scraped."}

User's Question: "${userQuestion}"

Please provide a comprehensive answer based on the information you have gathered.`;

  return streamText({
    model,
    prompt: systemPrompt,
  });
}
