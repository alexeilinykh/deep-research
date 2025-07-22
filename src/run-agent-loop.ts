import { z } from "zod";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/server/scraper";
import { env } from "~/env";
import { SystemContext } from "./system-context";
import { getNextAction, type OurMessageAnnotation } from "./get-next-action";
import { answerQuestion } from "./answer-question";
import type { StreamTextResult } from "ai";

export async function runAgentLoop(
  userQuestion: string,
  options: {
    abortSignal?: AbortSignal;
    writeMessageAnnotation?: (annotation: OurMessageAnnotation) => void;
    langfuseTraceId?: string;
  } = {},
): Promise<StreamTextResult<{}, string>> {
  const {
    abortSignal,
    writeMessageAnnotation = () => {},
    langfuseTraceId,
  } = options;
  // A persistent container for the state of our system
  const ctx = new SystemContext();

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // We choose the next action based on the state of our system
    const nextAction = await getNextAction(ctx, userQuestion, langfuseTraceId);

    // Send progress annotation to the UI
    writeMessageAnnotation({
      type: "NEW_ACTION",
      action: nextAction as any, // Type assertion needed due to Zod schema differences
    } satisfies OurMessageAnnotation);

    // We execute the action and update the state of our system
    if (nextAction.type === "search") {
      if (!nextAction.query) {
        throw new Error("Search action requires a query");
      }

      const searchResults = await searchSerper(
        { q: nextAction.query, num: env.SEARCH_RESULTS_COUNT },
        abortSignal,
      );

      // Report the search results to the context
      ctx.reportQueries([
        {
          query: nextAction.query,
          results: searchResults.organic.map((result) => ({
            date: result.date || "No date",
            title: result.title,
            url: result.link,
            snippet: result.snippet,
          })),
        },
      ]);
    } else if (nextAction.type === "scrape") {
      if (!nextAction.urls || nextAction.urls.length === 0) {
        throw new Error("Scrape action requires URLs");
      }

      const scrapeResults = await bulkCrawlWebsites({ urls: nextAction.urls });

      // Report the scrape results to the context
      if (scrapeResults.success) {
        ctx.reportScrapes(
          scrapeResults.results.map((result) => ({
            url: result.url,
            result: result.result.data,
          })),
        );
      } else {
        // Handle partial success case - only report successful scrapes
        ctx.reportScrapes(
          scrapeResults.results
            .filter((result) => result.result.success)
            .map((result) => ({
              url: result.url,
              result: (result.result as any).data,
            })),
        );
      }
    } else if (nextAction.type === "answer") {
      return answerQuestion(ctx, userQuestion, { langfuseTraceId });
    }

    // Increment the step counter after each action
    ctx.incrementStep();
  }

  // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
  return answerQuestion(ctx, userQuestion, { isFinal: true, langfuseTraceId });
}
