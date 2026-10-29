import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      "out/**",
      "dist/**",
      "node_modules/**",
      "artifacts/**",
      "src/renderer/src/assets/**",
      "resources/**",
      "build/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
      },
    },
  },
);
