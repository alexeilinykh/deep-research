import { z } from "zod";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/server/scraper";
import { env } from "~/env";
import { SystemContext } from "./system-context";
import { getNextAction, type OurMessageAnnotation } from "./get-next-action";
import { answerQuestion } from "./answer-question";
import { summarizeURL } from "./summarize-url";
import { rewriteQueries } from "./query-rewriter";
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
    // Step 1: Generate queries using the query rewriter
    const queryRewriterResult = await rewriteQueries(ctx, langfuseTraceId);

    // Send the planning annotation to the UI
    writeMessageAnnotation({
      type: "NEW_ACTION",
      action: {
        type: "plan",
        title: "Planning research strategy",
        reasoning: queryRewriterResult.plan,
        queries: queryRewriterResult.queries,
      } as any,
    } satisfies OurMessageAnnotation);

    // Step 2: Execute all queries in parallel based on the plan
    const searchPromises = queryRewriterResult.queries.map(async (query) => {
      const searchResults = await searchSerper(
        { q: query, num: env.SEARCH_RESULTS_COUNT },
        abortSignal,
      );

      // Extract URLs from search results for scraping
      const urlsToScrape = searchResults.organic.map((result) => result.link);

      // Scrape all the URLs from the search results
      const scrapeResults = await bulkCrawlWebsites({ urls: urlsToScrape });

      // Get conversation history for summarization context
      const conversationHistory = ctx.getMessageHistory();

      // Summarize each scraped result in parallel
      const summarizationPromises = searchResults.organic.map(
        async (searchResult) => {
          const correspondingScrape = scrapeResults.results.find(
            (scrapeResult) => scrapeResult.url === searchResult.link,
          );

          const scrapedContent = correspondingScrape?.result.success
            ? correspondingScrape.result.data
            : "Content could not be scraped";

          // Only summarize if we have actual content
          if (scrapedContent === "Content could not be scraped") {
            return {
              date: searchResult.date || "No date",
              title: searchResult.title,
              url: searchResult.link,
              snippet: searchResult.snippet,
              summary: "Content could not be scraped",
            };
          }

          const summarized = await summarizeURL({
            url: searchResult.link,
            title: searchResult.title,
            snippet: searchResult.snippet,
            date: searchResult.date || "No date",
            content: scrapedContent,
            query: query,
            conversationHistory,
            langfuseTraceId,
          });

          return {
            date: summarized.date,
            title: summarized.title,
            url: summarized.url,
            snippet: summarized.snippet,
            summary: summarized.summary,
          };
        },
      );

      // Wait for all summarizations to complete for this query
      const summarizedResults = await Promise.all(summarizationPromises);

      return {
        query,
        results: summarizedResults,
      };
    });

    // Wait for all searches to complete
    const allSearchResults = await Promise.all(searchPromises);

    // Step 3: Save all search results to the context
    allSearchResults.forEach((searchResult) => {
      ctx.reportSearch(searchResult);
    });

    // Step 4: Decide whether to continue or answer based on current context
    const nextAction = await getNextAction(ctx, langfuseTraceId);

    // Send progress annotation to the UI
    writeMessageAnnotation({
      type: "NEW_ACTION",
      action: nextAction as any, // Type assertion needed due to Zod schema differences
    } satisfies OurMessageAnnotation);

    if (nextAction.type === "answer") {
      return answerQuestion(ctx, { langfuseTraceId, onFinish });
    }

    // If nextAction.type === "continue", we loop again
    // Increment the step counter after each action
    ctx.incrementStep();
  } // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
  return answerQuestion(ctx, { isFinal: true, langfuseTraceId, onFinish });
}
