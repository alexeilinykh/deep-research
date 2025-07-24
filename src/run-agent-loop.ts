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

    // Step 2: Execute all queries in parallel to get search results
    const allSearchPromises = queryRewriterResult.queries.map(async (query) => {
      const searchResults = await searchSerper(
        { q: query, num: env.SEARCH_RESULTS_COUNT },
        abortSignal,
      );
      return {
        query,
        searchResults: searchResults.organic,
      };
    });

    // Wait for all searches to complete
    const allQueryResults = await Promise.all(allSearchPromises);

    // Step 3: Collect and deduplicate all sources
    const allSources = new Map<
      string,
      {
        title: string;
        url: string;
        snippet: string;
        date?: string;
        favicon: string;
        queries: string[];
      }
    >();

    allQueryResults.forEach(({ query, searchResults }) => {
      searchResults.forEach((result) => {
        const existingSource = allSources.get(result.link);
        if (existingSource) {
          // If URL already exists, just add this query to the list
          existingSource.queries.push(query);
        } else {
          // New URL, add it to the map
          allSources.set(result.link, {
            title: result.title,
            url: result.link,
            snippet: result.snippet,
            date: result.date,
            favicon: `https://www.google.com/s2/favicons?domain=${new URL(result.link).hostname}&sz=32`,
            queries: [query],
          });
        }
      });
    });

    const uniqueSources = Array.from(allSources.values());

    // Step 4: Send single sources annotation to UI
    writeMessageAnnotation({
      type: "SOURCES_FOUND",
      title: `Found ${uniqueSources.length} unique sources`,
      sources: uniqueSources.map((source) => ({
        title: source.title,
        url: source.url,
        snippet: source.snippet,
        date: source.date,
        favicon: source.favicon,
      })),
      query: `Multiple queries: ${queryRewriterResult.queries.join(", ")}`,
    });

    // Step 5: Scrape and summarize all unique sources
    const urlsToScrape = uniqueSources.map((source) => source.url);
    const scrapeResults = await bulkCrawlWebsites({ urls: urlsToScrape });
    const conversationHistory = ctx.getMessageHistory();

    // Process each query's results for the context
    const searchResultsForContext = await Promise.all(
      allQueryResults.map(async ({ query, searchResults }) => {
        const summarizationPromises = searchResults.map(
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

        const summarizedResults = await Promise.all(summarizationPromises);
        return {
          query,
          results: summarizedResults,
        };
      }),
    );

    // Step 6: Save all search results to the context
    searchResultsForContext.forEach((searchResult) => {
      ctx.reportSearch(searchResult);
    });

    // Step 7: Evaluate whether to continue or answer based on current context
    const nextAction = await getNextAction(ctx, langfuseTraceId);

    // Store the feedback for future query rewriting (only if provided)
    if (nextAction.feedback) {
      ctx.updateFeedback(nextAction.feedback);
    }

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
