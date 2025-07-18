import type { Message } from "ai";

export const ciData: { input: Message[]; expected: string }[] = [
  // Additional medium-difficulty questions for CI testing
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
];
