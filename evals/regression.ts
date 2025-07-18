import type { Message } from "ai";

export const regressionData: { input: Message[]; expected: string }[] = [
  // Additional questions for comprehensive regression testing
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
  {
    input: [
      {
        id: "10",
        role: "user",
        content: "What are the security improvements in Node.js 22?",
      },
    ],
    expected:
      "Node.js 22 includes enhanced security features: improved permission model, better handling of vulnerabilities in dependencies, stricter defaults for crypto operations, and enhanced protection against prototype pollution attacks.",
  },
  {
    input: [
      {
        id: "11",
        role: "user",
        content:
          "How does React 19's new compiler compare to Svelte's compiler in terms of performance and bundle size?",
      },
    ],
    expected:
      "React 19's compiler focuses on automatic optimization of hooks and re-renders, reducing manual optimization needs. Svelte's compiler provides zero-runtime overhead with smaller bundle sizes. React 19 maintains larger runtime but improves performance through better optimization, while Svelte continues to excel in bundle size with compile-time optimizations.",
  },
  {
    input: [
      {
        id: "12",
        role: "user",
        content:
          "What are the most significant changes in the CSS specification that landed in 2024?",
      },
    ],
    expected:
      "Major CSS updates in 2024 include: CSS Container Queries becoming widely supported, CSS Cascade Layers improving specificity management, CSS Color Module Level 4 with new color spaces, Subgrid gaining broader browser support, and CSS Nesting becoming natively supported across all major browsers.",
  },
  {
    input: [
      {
        id: "13",
        role: "user",
        content:
          "How do the latest WebAssembly features in 2024 impact JavaScript performance for compute-intensive tasks?",
      },
    ],
    expected:
      "WebAssembly 2024 updates include WASI preview 2, improved garbage collection integration, and better JavaScript interop. These provide 2-10x performance improvements for compute-intensive tasks, better memory management, and seamless integration with JavaScript modules, making WebAssembly more practical for real-world applications.",
  },
];
