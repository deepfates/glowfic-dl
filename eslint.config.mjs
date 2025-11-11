import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // Ignore generated and vendor content
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "build/**",
      "*.tsbuildinfo",
      "**/*.min.*",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ],
  },

  // Base ESLint recommended rules for JS
  js.configs.recommended,

  // CommonJS config files
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "script",
      globals: globals.node,
    },
  },

  // TypeScript rules
  {
    files: ["**/*.ts", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        // For type-aware rules later, set: project: true
      },
      globals: globals.node,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"],
        },
      },
    },
    rules: {
      // General
      "no-console": "off",

      // Imports
      "import/no-unresolved": "off", // Let TS resolver handle this
      "import/order": [
        "warn",
        {
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index", "object"],
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // TypeScript
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Disable rules that conflict with Prettier formatting
  eslintConfigPrettier,
];
