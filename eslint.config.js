import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_|^extra$", caughtErrors: "none" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "semi": ["error", "always"],
      "no-console": "warn",
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "error",
      // TypeScript handles undefined variable detection; no-undef creates false positives for TS types
      "no-undef": "off",
      // Allow require() in .ts files (used sparingly to avoid circular deps)
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
  {
    ignores: ["node_modules/", "build/", "coverage/", "*.config.ts", "**/*.test.ts", "**/__tests__/**"],
  },
];
