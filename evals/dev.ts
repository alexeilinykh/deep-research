import type { Message } from "ai";

export const devData: { input: Message[]; expected: string }[] = [
  // Basic questions requiring recent knowledge - our toughest cases for development
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
  // Multi-hop reasoning questions - the most challenging
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
