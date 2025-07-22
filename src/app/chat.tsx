"use client";

import { ChatMessage } from "~/components/chat-message";
import { SignInModal } from "~/components/sign-in-modal";
import { useChat } from "@ai-sdk/react";
import { Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNewChatCreated } from "~/lib/utils";
import type { Message } from "ai";
import { StickToBottom } from "use-stick-to-bottom";

interface ChatProps {
  userName: string;
  isAuthenticated: boolean;
  chatId: string;
  isNewChat: boolean;
  initialMessages?: Message[];
}

export const ChatPage = ({
  userName,
  isAuthenticated,
  chatId,
  isNewChat,
  initialMessages = [],
}: ChatProps) => {
  const router = useRouter();
  const { messages, input, handleInputChange, handleSubmit, isLoading, data } =
    useChat({
      initialMessages,
      body: {
        chatId,
        isNewChat,
      },
    });
  const [isSignInModalOpen, setSignInModalOpen] = useState(false);

  // Handle new chat creation redirect
  useEffect(() => {
    const lastDataItem = data?.[data.length - 1];

    if (lastDataItem && isNewChatCreated(lastDataItem)) {
      router.push(`?id=${lastDataItem.chatId}`);
    }
  }, [data, router]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setSignInModalOpen(true);
      return;
    }
    handleSubmit(e);
  };

  return (
    <>
      <div className="flex flex-1 flex-col">
        <StickToBottom
          className="relative mx-auto w-full max-w-[65ch] flex-1 overflow-auto [&>div]:scrollbar-thin [&>div]:scrollbar-track-gray-800 [&>div]:scrollbar-thumb-gray-600 [&>div]:hover:scrollbar-thumb-gray-500"
          resize="smooth"
          initial="smooth"
        >
          <StickToBottom.Content
            className="p-4"
            role="log"
            aria-label="Chat messages"
          >
            {messages.map((message, index) => (
              <ChatMessage
                key={index}
                parts={message.parts}
                role={message.role}
                userName={userName}
                annotations={message.annotations as any}
              />
            ))}
          </StickToBottom.Content>
        </StickToBottom>

        <div className="border-t border-gray-700">
          <form
            onSubmit={handleFormSubmit}
            className="mx-auto max-w-[65ch] p-4"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Say something..."
                autoFocus
                aria-label="Chat input"
                className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-gray-200 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:hover:bg-gray-700"
              >
                {isLoading ? <Loader className="size-4" /> : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />
    </>
  );
};
