import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import jestPlugin from "eslint-plugin-jest";
import tseslint from "typescript-eslint";

const deepModuleImport = {
  group: [
    "**/board/!(index.ts)",
    "**/player/!(index.ts)",
    "**/move/!(index.ts)",
    "**/event/!(index.ts)",
    "**/state/!(index.ts)",
    "**/placement/!(index.ts)",
    "**/explosion/!(index.ts)",
    "**/runtime/!(index.ts)",
    "**/audio/!(index.ts)",
    "**/view/!(index.ts)",
    "**/session/!(index.ts)",
    "**/composition/!(index.ts)",
    "**/ui/!(index.ts)",
    "**/message/!(index.ts)",
    "**/games/!(index.ts)",
    "**/room/!(index.ts)",
    "**/connection/!(index.ts)",
    "**/http/!(index.ts)",
    "**/ws/!(index.ts)",
    "**/catalog/!(index.ts)",
    "**/api/!(index.ts)",
  ],
  message: "Import the module index, not a file inside the subdirectory.",
};

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/jest.config.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: import.meta.dirname,
        },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "**/board/**",
      "**/player/**",
      "**/move/**",
      "**/event/**",
      "**/state/**",
      "**/placement/**",
      "**/explosion/**",
      "**/runtime/**",
      "**/audio/**",
      "**/view/**",
      "**/session/**",
      "**/composition/**",
      "**/ui/**",
      "**/message/**",
      "**/games/**",
      "**/room/**",
      "**/connection/**",
      "**/http/**",
      "**/ws/**",
      "**/catalog/**",
      "**/api/**",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [deepModuleImport] }],
    },
  },
  {
    files: ["**/*.test.ts"],
    ...jestPlugin.configs["flat/recommended"],
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
