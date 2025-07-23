import { z } from "zod";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/server/scraper";
import { env } from "~/env";
import { SystemContext } from "./system-context";
import { getNextAction, type OurMessageAnnotation } from "./get-next-action";
import { answerQuestion } from "./answer-question";
import type { StreamTextResult, Message, streamText } from "ai";

export async function runAgentLoop(
  messages: Message[],
  options: {
    abortSignal?: AbortSignal;
    writeMessageAnnotation?: (annotation: OurMessageAnnotation) => void;
    langfuseTraceId?: string;
    onFinish?: Parameters<typeof streamText>[0]["onFinish"];
    locationHints?: {
      latitude?: string;
      longitude?: string;
      city?: string;
      country?: string;
    };
  } = {},
): Promise<StreamTextResult<{}, string>> {
  const {
    abortSignal,
    writeMessageAnnotation = () => {},
    langfuseTraceId,
    onFinish,
    locationHints,
  } = options;

  // A persistent container for the state of our system
  const ctx = new SystemContext(messages, locationHints);

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // We choose the next action based on the state of our system
    const nextAction = await getNextAction(ctx, langfuseTraceId);

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

      // Extract URLs from search results for scraping
      const urlsToScrape = searchResults.organic.map((result) => result.link);

      // Scrape all the URLs from the search results
      const scrapeResults = await bulkCrawlWebsites({ urls: urlsToScrape });

      // Combine search results with scraped content
      const combinedResults = searchResults.organic.map(
        (searchResult, index) => {
          const correspondingScrape = scrapeResults.results.find(
            (scrapeResult) => scrapeResult.url === searchResult.link,
          );

          const scrapedContent = correspondingScrape?.result.success
            ? correspondingScrape.result.data
            : "Content could not be scraped";

          return {
            date: searchResult.date || "No date",
            title: searchResult.title,
            url: searchResult.link,
            snippet: searchResult.snippet,
            scrapedContent,
          };
        },
      );

      // Report the combined search and scrape results to the context
      ctx.reportSearch({
        query: nextAction.query,
        results: combinedResults,
      });
    } else if (nextAction.type === "answer") {
      return answerQuestion(ctx, { langfuseTraceId, onFinish });
    }

    // Increment the step counter after each action
    ctx.incrementStep();
  }

  // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
  return answerQuestion(ctx, { isFinal: true, langfuseTraceId, onFinish });
}
