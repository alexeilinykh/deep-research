import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  SearchIcon,
  LinkIcon,
  BrainIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  CalendarIcon,
} from "lucide-react";
import type { OurMessageAnnotation, SourceInfo } from "~/get-next-action";

export const ReasoningSteps = ({
  annotations,
}: {
  annotations: OurMessageAnnotation[];
}) => {
  const [closedStep, setClosedStep] = useState<number | null>(null);

  if (annotations.length === 0) return null;

  const getAnnotationTitle = (annotation: OurMessageAnnotation) => {
    if (annotation.type === "NEW_ACTION") {
      return annotation.action.title;
    } else if (annotation.type === "SOURCES_FOUND") {
      return annotation.title;
    }
    return "Unknown";
  };

  const getStepIcon = (annotation: OurMessageAnnotation) => {
    if (annotation.type === "NEW_ACTION") {
      if (annotation.action.type === "plan") return BrainIcon;
      if (annotation.action.type === "continue") return SearchIcon;
      if (annotation.action.type === "answer") return LinkIcon;
    } else if (annotation.type === "SOURCES_FOUND") {
      return ExternalLinkIcon;
    }
    return SearchIcon;
  };

  return (
    <div className="mb-4 w-full">
      <ul className="space-y-1">
        {annotations.map((annotation, index) => {
          const isOpen = closedStep !== index;
          const IconComponent = getStepIcon(annotation);
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
                {getAnnotationTitle(annotation)}
              </button>
              <div className={`${isOpen ? "mt-1" : "hidden"}`}>
                {isOpen && (
                  <div className="px-2 py-1">
                    {annotation.type === "NEW_ACTION" && (
                      <>
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
                      </>
                    )}
                    {annotation.type === "SOURCES_FOUND" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <ExternalLinkIcon className="size-4" />
                          <span>Query: "{annotation.query}"</span>
                        </div>
                        <div className="ml-6 grid gap-2 md:grid-cols-2">
                          {annotation.sources.map((source, idx) => (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:bg-gray-750 group block rounded-lg border border-gray-700 bg-gray-800 p-3 transition-colors hover:border-gray-600"
                            >
                              <div className="flex items-start gap-3">
                                {source.favicon && (
                                  <img
                                    src={source.favicon}
                                    alt=""
                                    className="mt-1 h-4 w-4 flex-shrink-0"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <h4 className="line-clamp-2 text-sm font-medium text-gray-200 group-hover:text-white">
                                    {source.title}
                                  </h4>
                                  <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                                    {source.snippet}
                                  </p>
                                  {source.date && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                                      <CalendarIcon className="size-3" />
                                      <span>{source.date}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
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
