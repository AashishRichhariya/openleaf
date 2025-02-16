import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      import: (await import("eslint-plugin-import")).default,
      "unused-imports": (await import("eslint-plugin-unused-imports")).default
    },
    rules: {
      // Import sorting and organization
      "import/order": [
        "error",
        {
          "groups": [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type"
          ],
          "newlines-between": "always",
          "alphabetize": {
            "order": "asc",
            "caseInsensitive": true
          }
        }
      ],
      "import/no-unresolved": "error",
      "import/no-unused-modules": "warn",
      'import/no-anonymous-default-export': 'warn',

      // Auto-remove unused imports
      "unused-imports/no-unused-imports": "error",

      // Formatting
      "indent": ["error", 2],
      "max-len": [
        "error",
        {
          "code": 100,
          "tabWidth": 2,
          "comments": 80,
          "ignoreStrings": true,
          "ignoreTemplateLiterals": true,
          "ignoreRegExpLiterals": true,
          'ignoreComments': true
        }
      ],
      "semi": ["error", "always"],
      "quotes": ["error", "single"],
      "comma-dangle": ["error", "always-multiline"]
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"]
      },
      "import/resolver": {
        "typescript": {
          "alwaysTryTypes": true
        },
        "node": true
      }
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: (await import("@typescript-eslint/parser")).default,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    ignores: ["./*.next*", "*next-env.d.ts*"]
  }
];

export default config;
