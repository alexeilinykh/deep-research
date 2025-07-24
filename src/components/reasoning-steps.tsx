import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { SearchIcon, LinkIcon, BrainIcon, ClipboardIcon } from "lucide-react";
import type { OurMessageAnnotation } from "~/get-next-action";

export const ReasoningSteps = ({
  annotations,
}: {
  annotations: OurMessageAnnotation[];
}) => {
  const [closedStep, setClosedStep] = useState<number | null>(null);

  if (annotations.length === 0) return null;

  return (
    <div className="mb-4 w-full">
      <ul className="space-y-1">
        {annotations.map((annotation, index) => {
          const isOpen = closedStep !== index;
          return (
            <li key={index} className="relative">
              <button
                onClick={() => setClosedStep(isOpen ? index : null)}
                className={`min-w-34 flex w-full flex-shrink-0 items-center rounded px-2 py-1 text-left text-sm transition-colors ${
                  isOpen
                    ? "bg-gray-700 text-gray-200"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                }`}
              >
                <span
                  className={`z-10 mr-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-500 text-xs font-bold ${
                    isOpen
                      ? "border-blue-400 text-white"
                      : "bg-gray-800 text-gray-300"
                  }`}
                >
                  {index + 1}
                </span>
                {annotation.action.title}
              </button>
              <div className={`${isOpen ? "mt-1" : "hidden"}`}>
                {isOpen && (
                  <div className="px-2 py-1">
                    <div className="text-sm italic text-gray-400">
                      <ReactMarkdown>
                        {annotation.action.reasoning}
                      </ReactMarkdown>
                    </div>
                    {annotation.action.type === "continue" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <SearchIcon className="size-4" />
                          <span>Evaluating information gaps</span>
                        </div>
                        {(annotation.action as any).feedback && (
                          <div className="ml-6 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <ClipboardIcon className="size-3" />
                              <span>Evaluator Feedback:</span>
                            </div>
                            <div className="rounded bg-gray-800 px-3 py-2 text-xs text-gray-300">
                              <ReactMarkdown>
                                {(annotation.action as any).feedback}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {annotation.action.type === "plan" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <BrainIcon className="size-4" />
                          <span>Research Plan Generated</span>
                        </div>
                        {(annotation.action as any).queries && (
                          <div className="ml-6 space-y-1">
                            <div className="text-xs text-gray-500">
                              Queries:
                            </div>
                            {(
                              (annotation.action as any).queries as string[]
                            ).map((query, idx) => (
                              <div
                                key={idx}
                                className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400"
                              >
                                {idx + 1}. {query}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {annotation.action.type === "answer" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <LinkIcon className="size-4" />
                          <span>Ready to provide answer</span>
                        </div>
                        {(annotation.action as any).feedback && (
                          <div className="ml-6 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <ClipboardIcon className="size-3" />
                              <span>Final Assessment:</span>
                            </div>
                            <div className="rounded bg-gray-800 px-3 py-2 text-xs text-gray-300">
                              <ReactMarkdown>
                                {(annotation.action as any).feedback}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
