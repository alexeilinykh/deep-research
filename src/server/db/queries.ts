import type { Message } from "ai";
import { db } from "~/server/db";
import { chats, messages } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: Message[];
}) => {
  const { userId, chatId, title, messages: chatMessages } = opts;

  // Check if chat exists and belongs to user
  const existingChat = await db.query.chats.findFirst({
    where: (chats, { eq, and }) =>
      and(eq(chats.id, chatId), eq(chats.userId, userId)),
  });

  if (existingChat) {
    // If chat exists but belongs to a different user, throw error
    if (existingChat.userId !== userId) {
      throw new Error("Chat ID already exists under a different user");
    }
    // Delete all existing messages
    await db.delete(messages).where(eq(messages.chatId, chatId));
  } else {
    // Create new chat
    await db.insert(chats).values({
      id: chatId,
      userId,
      title,
    });
  }

  // Insert all messages
  await db.insert(messages).values(
    chatMessages.map((message, index) => ({
      chatId,
      role: message.role,
      parts: message.parts,
      order: index,
    })),
  );

  return { id: chatId };
};

export const getChat = async (chatId: string, userId: string) => {
  const chat = await db.query.chats.findFirst({
    where: (chats, { eq, and }) =>
      and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      messages: {
        orderBy: [messages.order],
      },
    },
  });

  if (!chat) {
    return null;
  }

  // Convert database messages back to AI SDK format
  const aiMessages = chat.messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.parts,
  }));

  return {
    ...chat,
    messages: aiMessages,
  };
};

export const getChats = async (userId: string) => {
  return await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.updatedAt)],
  });
};
