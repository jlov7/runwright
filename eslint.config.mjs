import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", ".stryker-tmp/**", ".fuzz-artifacts/**", "reports/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false }
      ]
    }
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["apps/web/src/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "../app/*",
            "../../app/*",
            "../features/*",
            "../../features/*",
            "../entities/*",
            "../../entities/*"
          ]
        }
      ]
    }
  },
  {
    files: ["apps/web/src/entities/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../app/*", "../../app/*", "../features/*", "../../features/*"]
        }
      ]
    }
  },
  {
    files: ["apps/web/src/features/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../app/*", "../../app/*"]
        }
      ]
    }
  }
);
