import { streamText, type Message, type TelemetrySettings } from "ai";
import { model } from "~/model";
import { searchSerper } from "~/serper";
import { z } from "zod";
import { bulkCrawlWebsites } from "~/server/scraper";

export const streamFromDeepSearch = (opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
}) => {
  const now = new Date();
  const nowString =
    now.toLocaleString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) + " UTC";

  return streamText({
    model,
    messages: opts.messages,
    maxSteps: 10,
    system: `You are a helpful AI assistant with access to real-time web search capabilities. The current date and time is ${nowString}. when answering questions:

1. Always search the web for up-to-date information when relevant
2. ALWAYS format URLs as markdown links using the format [title](url)
3. Be thorough but concise in your responses
4. If you're unsure about something, search the web to verify
5. When providing information, always include the source where you found it using markdown links
6. Never include raw URLs - always use markdown link format
7. When users ask for up-to-date information, use the current date to provide context about how recent the information is

Remember to use the searchWeb tool whenever you need to find current information.
`,
    tools: {
      searchWeb: {
        parameters: z.object({
          query: z.string().describe("The query to search the web for"),
        }),
        execute: async ({ query }, { abortSignal }) => {
          const results = await searchSerper(
            { q: query, num: 10 },
            abortSignal,
          );

          // Include published date if available
          return results.organic.map((result) => ({
            title: result.title,
            link: result.link,
            snippet: result.snippet,
            date: result.date || null,
          }));
        },
      },
      scrapePages: {
        parameters: z.object({
          urls: z.array(z.string()).describe("The URLs to scrape"),
        }),
        execute: async ({ urls }, { abortSignal }) => {
          const results = await bulkCrawlWebsites({ urls });

          if (!results.success) {
            return {
              error: results.error,
              results: results.results.map(({ url, result }) => ({
                url,
                success: result.success,
                data: result.success ? result.data : result.error,
              })),
            };
          }

          return {
            results: results.results.map(({ url, result }) => ({
              url,
              success: result.success,
              data: result.data,
            })),
          };
        },
      },
    },
    onFinish: opts.onFinish,
    experimental_telemetry: opts.telemetry,
  });
};

export async function askDeepSearch(messages: Message[]) {
  const result = streamFromDeepSearch({
    messages,
    onFinish: () => {}, // just a stub
    telemetry: {
      isEnabled: false,
    },
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
