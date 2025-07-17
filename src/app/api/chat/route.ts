import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  appendResponseMessages,
} from "ai";
import { model } from "~/model";
import { auth } from "~/server/auth/";
import { searchSerper } from "~/serper";
import { z } from "zod";
import { checkRateLimit, recordRequest } from "~/server/rate-limit";
import { upsertChat } from "~/server/db/queries";
import { db } from "~/server/db";
import { chats } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { bulkCrawlWebsites } from "~/server/scraper";

const langfuse = new Langfuse({
  environment: env.NODE_ENV,
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Use user id from session
  const userId = session.user.id;

  // Rate limit: allow 100 requests per day for non-admins
  const canRequest = await checkRateLimit(userId);
  if (!canRequest) {
    return new Response("Too Many Requests", { status: 429 });
  }

  // Record the request
  await recordRequest(userId);

  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId: string;
    isNewChat?: boolean;
  };

  const { messages, chatId, isNewChat = false } = body;

  let currentChatId = chatId;
  if (isNewChat) {
    await upsertChat({
      userId: session.user.id,
      chatId: currentChatId,
      title: messages[messages.length - 1]!.content.slice(0, 50) + "...",
      messages: messages, // Only save the user's message initially
    });
  } else {
    // Verify the chat belongs to the user
    const chat = await db.query.chats.findFirst({
      where: eq(chats.id, currentChatId),
    });
    if (!chat || chat.userId !== session.user.id) {
      return new Response("Chat not found or unauthorized", { status: 404 });
    }
  }

  // Create Langfuse trace with session and user information
  const trace = langfuse.trace({
    sessionId: currentChatId,
    name: "chat",
    userId: session.user.id,
  });

  return createDataStreamResponse({
    execute: async (dataStream) => {
      // If this is a new chat, send the chat ID to the frontend
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: currentChatId,
        });
      }

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
      const result = streamText({
        model,
        messages,
        experimental_telemetry: {
          isEnabled: true,
          functionId: `agent`,
          metadata: {
            langfuseTraceId: trace.id,
          },
        },
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
        system: `ou are a helpful AI assistant with access to real-time web search capabilities. The current date and time is ${nowString}. when answering questions:

1. Always search the web for up-to-date information when relevant
2. ALWAYS format URLs as markdown links using the format [title](url)
3. Be thorough but concise in your responses
4. If you're unsure about something, search the web to verify
5. When providing information, always include the source where you found it using markdown links
6. Never include raw URLs - always use markdown link format
7. When users ask for up-to-date information, use the current date to provide context about how recent the information is

Remember to use the searchWeb tool whenever you need to find current information.
`,
        maxSteps: 10,
        onFinish: async ({ text, finishReason, usage, response }) => {
          const responseMessages = response.messages;

          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages,
          });

          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) {
            return;
          }

          // Update the chat with all messages including the AI response
          await upsertChat({
            userId,
            chatId: currentChatId,
            title: lastMessage.content.slice(0, 50) + "...",
            messages: updatedMessages,
          });

          // Flush the trace to Langfuse
          await langfuse.flushAsync();
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occurred!";
    },
  });
}
