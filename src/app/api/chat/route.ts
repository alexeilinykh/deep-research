import type { Message } from "ai";
import { createDataStreamResponse, appendResponseMessages } from "ai";
import { auth } from "~/server/auth/";
import { checkRateLimit, recordRequest } from "~/server/rate-limit";
import {
  checkRateLimit as checkGlobalRateLimit,
  recordRateLimit,
  type RateLimitConfig,
} from "~/server/global-rate-limit";
import { upsertChat } from "~/server/db/queries";
import { db } from "~/server/db";
import { chats } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { streamFromDeepSearch } from "~/deep-search";
import type { OurMessageAnnotation } from "~/get-next-action";

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

  // Create Langfuse trace with user information (will update sessionId later)
  const trace = langfuse.trace({
    name: "chat",
    userId: userId,
  });

  // Global rate limit: allow 1 request per 5 seconds for testing
  const globalRateLimitConfig: RateLimitConfig = {
    maxRequests: 100,
    maxRetries: 2,
    windowMs: 60_000, // 5 seconds
    keyPrefix: "global",
  };

  // Check the global rate limit
  const globalRateLimitSpan = trace.span({
    name: "check-global-rate-limit",
    input: {
      config: globalRateLimitConfig,
    },
  });

  const globalRateLimitCheck = await checkGlobalRateLimit(
    globalRateLimitConfig,
  );

  if (!globalRateLimitCheck.allowed) {
    console.log("Global rate limit exceeded, waiting...");
    const isAllowed = await globalRateLimitCheck.retry();
    // If the rate limit is still exceeded after retrying, we'll continue anyway
    // since the requirements ask to wait rather than return 429
    if (!isAllowed) {
      return new Response("Rate limit exceeded", {
        status: 429,
      });
    }
  }

  // Record the global rate limit request
  await recordRateLimit(globalRateLimitConfig);

  globalRateLimitSpan.end({
    output: {
      success: true,
      allowed: globalRateLimitCheck.allowed,
      remaining: globalRateLimitCheck.remaining,
      totalHits: globalRateLimitCheck.totalHits,
    },
  });

  // Rate limit: allow 100 requests per day for non-admins
  const rateLimitSpan = trace.span({
    name: "check-rate-limit",
    input: {
      userId: userId,
    },
  });

  const canRequest = await checkRateLimit(userId);
  if (!canRequest) {
    rateLimitSpan.end({
      output: {
        success: false,
        canRequest: false,
      },
    });
    return new Response("Too Many Requests", { status: 429 });
  }

  rateLimitSpan.end({
    output: {
      success: true,
      canRequest: true,
    },
  });

  // Record the request
  const recordRequestSpan = trace.span({
    name: "record-request",
    input: {
      userId: userId,
    },
  });

  await recordRequest(userId);

  recordRequestSpan.end({
    output: {
      success: true,
    },
  });

  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId: string;
    isNewChat?: boolean;
  };

  const { messages, chatId, isNewChat = false } = body;

  let currentChatId = chatId;
  if (isNewChat) {
    const upsertChatSpan = trace.span({
      name: "upsert-chat-new",
      input: {
        userId: session.user.id,
        chatId: currentChatId,
        title: messages[messages.length - 1]!.content.slice(0, 50) + "...",
        messagesCount: messages.length,
      },
    });

    await upsertChat({
      userId: session.user.id,
      chatId: currentChatId,
      title: messages[messages.length - 1]!.content.slice(0, 50) + "...",
      messages: messages, // Only save the user's message initially
    });

    upsertChatSpan.end({
      output: {
        success: true,
        chatId: currentChatId,
      },
    });
  } else {
    // Verify the chat belongs to the user
    const findChatSpan = trace.span({
      name: "find-chat-by-id",
      input: {
        chatId: currentChatId,
        userId: session.user.id,
      },
    });

    const chat = await db.query.chats.findFirst({
      where: eq(chats.id, currentChatId),
    });

    if (!chat || chat.userId !== session.user.id) {
      findChatSpan.end({
        output: {
          success: false,
          error: "Chat not found or unauthorized",
        },
      });
      return new Response("Chat not found or unauthorized", { status: 404 });
    }

    findChatSpan.end({
      output: {
        success: true,
        chatId: chat.id,
        userId: chat.userId,
      },
    });
  }

  // Update trace with the sessionId now that we have the chatId
  trace.update({
    sessionId: currentChatId,
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

      // Collect annotations in memory
      const annotations: OurMessageAnnotation[] = [];

      const writeMessageAnnotation = (annotation: OurMessageAnnotation) => {
        // Save the annotation in-memory
        annotations.push(annotation);
        // Send it to the client
        dataStream.writeMessageAnnotation(annotation as any);
      };

      const result = await streamFromDeepSearch({
        messages,
        telemetry: {
          isEnabled: true,
          functionId: `agent`,
          metadata: {
            langfuseTraceId: trace.id,
          },
        },
        writeMessageAnnotation,
        onFinish: async ({ response }) => {
          const responseMessages = response.messages;

          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages,
          });

          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (!lastMessage) {
            return;
          }

          lastMessage.annotations = annotations as any;

          // Update the chat with all messages including the AI response
          const updateChatSpan = trace.span({
            name: "upsert-chat-final",
            input: {
              userId,
              chatId: currentChatId,
              title: lastMessage.content.slice(0, 50) + "...",
              messagesCount: updatedMessages.length,
            },
          });

          await upsertChat({
            userId,
            chatId: currentChatId,
            title: lastMessage.content.slice(0, 50) + "...",
            messages: updatedMessages,
          });

          updateChatSpan.end({
            output: {
              success: true,
              chatId: currentChatId,
              finalMessagesCount: updatedMessages.length,
            },
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
