import ReactMarkdown, { type Components } from "react-markdown";
import type { Message } from "ai";
import { ReasoningSteps } from "./reasoning-steps";
import type { OurMessageAnnotation } from "~/get-next-action";

export type MessagePart = NonNullable<Message["parts"]>[number];

interface ChatMessageProps {
  parts: MessagePart[];
  role: string;
  userName: string;
  annotations: OurMessageAnnotation[];
}

const components: Components = {
  // Override default elements with custom styling
  p: ({ children }) => <p className="mb-4 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""}`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-700 p-4">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

const ToolInvocation = ({
  part,
}: {
  part: Extract<MessagePart, { type: "tool-invocation" }>;
}) => {
  const { toolInvocation } = part;
  return (
    <div className="rounded bg-gray-700 p-2">
      <p className="text-sm text-blue-400">Tool: {toolInvocation.toolName}</p>
      <p className="mb-1 text-xs text-gray-400">
        State: {toolInvocation.state ?? "call"}
      </p>
      <pre className="mb-2 text-xs text-gray-300">
        Args: {JSON.stringify(toolInvocation.args, null, 2)}
      </pre>
      {"result" in toolInvocation && toolInvocation.result !== undefined && (
        <pre className="text-xs text-green-300">
          Result: {JSON.stringify(toolInvocation.result, null, 2)}
        </pre>
      )}
    </div>
  );
};

export const ChatMessage = ({
  parts,
  role,
  userName,
  annotations = [],
}: ChatMessageProps) => {
  const isAI = role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI ? "bg-gray-800 text-gray-300" : "bg-gray-900 text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        {/* Show reasoning steps only for AI messages */}
        {isAI && <ReasoningSteps annotations={annotations} />}

        <div className="prose prose-invert max-w-none">
          {parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return <Markdown key={index}>{part.text}</Markdown>;
              case "tool-invocation":
                return <ToolInvocation key={index} part={part} />;
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
};
