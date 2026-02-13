import pluginJs from "@eslint/js";
import deprecation from "eslint-plugin-deprecation";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.app.json", "./tsconfig.spec.json"],
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      deprecation: deprecation,
    },
    rules: {
      "deprecation/deprecation": "warn",
      // TypeScript specific rules (without type information)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/prefer-for-of": "error",

      // General code quality rules
      "prefer-const": "error",
      "no-var": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Angular specific patterns
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='alert']",
          message: "Use proper notification system instead of alert()",
        },
      ],
    },
  },
  {
    files: ["src/**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
