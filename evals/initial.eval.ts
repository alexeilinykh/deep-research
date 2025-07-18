import { evalite, createScorer } from "evalite";
import { askDeepSearch } from "~/deep-search";
import { factualityModel } from "~/model";
import { generateObject } from "ai";
import { z } from "zod";
import type { Message } from "ai";

const checkFactuality = async (opts: {
  question: string;
  groundTruth: string;
  submission: string;
}) => {
  const { object } = await generateObject({
    model: factualityModel,
    /**
     * Prompt taken from autoevals:
     *
     * {@link https://github.com/braintrustdata/autoevals/blob/5aa20a0a9eb8fc9e07e9e5722ebf71c68d082f32/templates/factuality.yaml}
     */
    prompt: `
      You are comparing a submitted answer to an expert answer on a given question. Here is the data:
      [BEGIN DATA]
      ************
      [Question]: ${opts.question}
      ************
      [Expert]: ${opts.groundTruth}
      ************
      [Submission]: ${opts.submission}
      ************
      [END DATA]

      Compare the factual content of the submitted answer with the expert answer. Ignore any differences in style, grammar, or punctuation.
      The submitted answer may either be a subset or superset of the expert answer, or it may conflict with it. Determine which case applies. Answer the question by selecting one of the following options:
      (A) The submitted answer is a subset of the expert answer and is fully consistent with it.
      (B) The submitted answer is a superset of the expert answer and is fully consistent with it.
      (C) The submitted answer contains all the same details as the expert answer.
      (D) There is a disagreement between the submitted answer and the expert answer.
      (E) The answers differ, but these differences don't matter from the perspective of factuality.
    `,
    schema: z.object({
      answer: z.enum(["A", "B", "C", "D", "E"]).describe("Your selection."),
      rationale: z
        .string()
        .describe("Why you chose this answer. Be very detailed."),
    }),
  });

  /**
   * LLM's are well documented at being poor at generating
   */
  const scores = {
    A: 0.4,
    B: 0.6,
    C: 1,
    D: 0,
    E: 1,
  };

  return {
    score: scores[object.answer],
    metadata: {
      rationale: object.rationale,
    },
  };
};

// This is the scorer that can be passed into the scorers in Evalite
const Factuality = createScorer<Message[], string, string>({
  name: "Factuality",
  scorer: async ({ input, expected, output }) => {
    // Extract the question from the last user message
    const lastUserMessage = input.filter((msg) => msg.role === "user").pop();
    const question = lastUserMessage?.content || "";

    return checkFactuality({
      question: question,
      groundTruth: expected!,
      submission: output,
    });
  },
});

evalite("Deep Search Eval", {
  data: async (): Promise<{ input: Message[]; expected: string }[]> => {
    return [
      // Basic questions requiring recent knowledge
      {
        input: [
          {
            id: "1",
            role: "user",
            content: "What is the latest version of TypeScript?",
          },
        ],
        expected: "The current TypeScript version is 5.8",
      },
      {
        input: [
          {
            id: "2",
            role: "user",
            content: "What are the main features of Next.js 15?",
          },
        ],
        expected: `@next/codemod CLI: Easily upgrade to the latest Next.js and React versions.
Async Request APIs (Breaking): Incremental step towards a simplified rendering and caching model.
Caching Semantics (Breaking): fetch requests, GET Route Handlers, and client navigations are no longer cached by default.
React 19 Support: Support for React 19, React Compiler (Experimental), and hydration error improvements.
Turbopack Dev (Stable): Performance and stability improvements.
Static Indicator: New visual indicator shows static routes during development.
unstable_after API (Experimental): Execute code after a response finishes streaming.
instrumentation.js API (Stable): New API for server lifecycle observability.
Enhanced Forms (next/form): Enhance HTML forms with client-side navigation.
next.config: TypeScript support for next.config.ts.
Self-hosting Improvements: More control over Cache-Control headers.
Server Actions Security: Unguessable endpoints and removal of unused actions.
Bundling External Packages (Stable): New config options for App and Pages Router.
ESLint 9 Support: Added support for ESLint 9.
Development and Build Performance: Improved build times and Faster Fast Refresh.`,
      },
      {
        input: [
          {
            id: "3",
            role: "user",
            content:
              "When was Vite 6 released and what are its key improvements over Vite 5?",
          },
        ],
        expected:
          "Vite 6 was released in December 2024. Key improvements include: Environment API for better SSR support, improved dependency optimization, enhanced plugin ecosystem, better performance for large projects, and modernized build pipeline with updated Rollup integration.",
      },
      {
        input: [
          {
            id: "4",
            role: "user",
            content:
              "What is the current status of the TC39 proposal for the Pipeline Operator in JavaScript?",
          },
        ],
        expected:
          "The Pipeline Operator proposal is currently at Stage 2 in the TC39 process. The proposal uses the |> syntax and has been actively discussed with various syntax alternatives being considered, including F# style and Hack style pipelines.",
      },
      {
        input: [
          {
            id: "5",
            role: "user",
            content: "What are the breaking changes in ESLint 9?",
          },
        ],
        expected:
          "ESLint 9 breaking changes include: flat config is now the default configuration format, removal of deprecated rules and formatters, Node.js 18+ requirement, removal of legacy CLI options, and changes to the plugin loading mechanism.",
      },
      // Multi-hop reasoning questions
      {
        input: [
          {
            id: "6",
            role: "user",
            content:
              "Which JavaScript framework had the most significant performance improvements in 2024, and how do those improvements compare to the performance gains React achieved with its concurrent features in 2022?",
          },
        ],
        expected:
          "Svelte 5 had the most significant performance improvements in 2024 with its new reactivity system (runes) providing up to 3x faster updates. React's concurrent features in 2022 (Suspense, concurrent rendering) provided different benefits focused on user experience and responsiveness rather than raw performance, with improvements in perceived performance and better handling of updates.",
      },
      {
        input: [
          {
            id: "7",
            role: "user",
            content:
              "If I'm migrating from Webpack 4 to the latest build tools in 2025, what would be the migration path considering bundle size, build speed, and ecosystem compatibility, and which tools would give me the best ROI?",
          },
        ],
        expected:
          "For migrating from Webpack 4 in 2025: Vite 6 offers the best ROI with 10-100x faster dev builds, smaller bundle sizes through better tree-shaking, and excellent ecosystem compatibility. Alternative path: Webpack 5 → Turbopack (if using Next.js) or esbuild for maximum build speed. Consider Rollup for libraries. Vite provides the smoothest migration with minimal config changes while delivering significant performance gains.",
      },
      {
        input: [
          {
            id: "8",
            role: "user",
            content:
              "What are the compatibility requirements between TypeScript 5.8, Node.js 22, and the latest versions of popular frameworks like Next.js 15, and are there any known issues when using them together?",
          },
        ],
        expected:
          "TypeScript 5.8 is compatible with Node.js 22 and Next.js 15. Next.js 15 officially supports TypeScript 5.6+ and Node.js 18.18+. Known considerations: ensure @types/node matches Node.js 22, some TypeScript 5.8 strict mode changes may require code updates, and Next.js 15's React 19 support works well with TypeScript 5.8's improved JSX handling.",
      },
      {
        input: [
          {
            id: "9",
            role: "user",
            content:
              "Considering the current state of JavaScript runtimes in 2025, if I need to deploy a server-side application that uses the latest ES2024 features and requires the best performance, which runtime should I choose and why, comparing Node.js, Deno, and Bun across performance, ecosystem, and feature support?",
          },
        ],
        expected:
          "For server-side deployment in 2025 with ES2024 features: Bun 1.1+ offers the best performance (3-4x faster than Node.js for many workloads) and native ES2024 support. Node.js 22+ has the largest ecosystem and production stability. Deno 2.0+ provides excellent TypeScript support and security model. Choose Bun for greenfield projects prioritizing performance, Node.js for complex ecosystem dependencies, or Deno for TypeScript-first applications with security requirements.",
      },
    ];
  },
  task: async (input) => {
    return askDeepSearch(input);
  },
  scorers: [
    {
      name: "Contains Links",
      description: "Checks if the output contains any markdown links.",
      scorer: ({ output }) => {
        // Check for markdown link syntax: [text](url)
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
        const containsLinks = markdownLinkRegex.test(output);

        return containsLinks ? 1 : 0;
      },
    },
    Factuality,
  ],
});
