import type { Config } from 'tailwindcss';

export default {
  darkMode: ["class", "(prefers-color-scheme: dark)"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        primary: "var(--primary)",
        "primary-10": "var(--primary-10)",
        "primary-20": "var(--primary-20)",
        "primary-50": "var(--primary-50)",
        "primary-80": "var(--primary-80)",
        "surface-dark": "var(--surface-dark)",
        "surface-medium": "var(--surface-medium)",
        "surface-light": "var(--surface-light)",
        "surface-dark-lighter": "var(--surface-dark-lighter)",
        "surface-dark-darker": "var(--surface-dark-darker)",
        "surface-medium-lighter": "var(--surface-medium-lighter)",
        "surface-medium-darker": "var(--surface-medium-darker)",
        text: "var(--text)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-disabled": "var(--text-disabled)",

        // Mapped colors (existing)
        background: "var(--background)",
        foreground: "var(--foreground)",
        "editor-bg": "var(--editor-bg)",
        "editor-border": "var(--editor-border)",

        // Accent colors with opacity variants
        accent: {
          DEFAULT: 'var(--accent)',
          '10': 'var(--primary-10)',
          '20': 'var(--primary-20)',
          '50': 'var(--primary-50)',
          '80': 'var(--primary-80)',
        },
      },

      // Add the semantic colors to all relevant color utilities
      backgroundColor: {
        DEFAULT: "var(--background)",
        "placeholder-text": "var(--placeholder-text)",
        "quote-border": "var(--quote-border)",
        "checkbox-border": "var(--checkbox-border)",
        "checkbox-checked-bg": "var(--checkbox-checked-bg)",
        "checkbox-checkmark": "var(--checkbox-checkmark)",
        "code-bg": "var(--code-bg)",
        "dropdown-chevron": "var(--dropdown-chevron)",
        "table-border": "var(--table-border)",
        "table-cell-bg": "var(--table-cell-bg)",
        "table-header-bg": "var(--table-header-bg)",
        "table-selected-bg": "var(--table-selected-bg)",
        "table-striping": "var(--table-striping)",
        "input-border": "var(--input-border)",
        "input-text": "var(--input-text)",
        "input-bg": "var(--input-bg)",
        "input-focus-border": "var(--input-focus-border)",
        "input-focus-bg": "var(--input-focus-bg)",
        "input-focus-shadow": "var(--input-focus-shadow)",
        "input-placeholder": "var(--input-placeholder)",
        "primary": "var(--primary)",
        "primary-10": "var(--primary-10)",
        "primary-20": "var(--primary-20)",
        "primary-50": "var(--primary-50)",
        "primary-80": "var(--primary-80)",
        "surface-dark-lighter": "var(--surface-dark-lighter)",
        "surface-dark-darker": "var(--surface-dark-darker)",
        "surface-medium-lighter": "var(--surface-medium-lighter)",
        "surface-medium-darker": "var(--surface-medium-darker)",
      },

      textColor: {
        DEFAULT: "var(--foreground)",
        "placeholder-text": "var(--placeholder-text)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-disabled": "var(--text-disabled)",
        "quote-border": "var(--quote-border)",
        "checkbox-border": "var(--checkbox-border)",
        "checkbox-checked-bg": "var(--checkbox-checked-bg)",
        "checkbox-checkmark": "var(--checkbox-checkmark)",
        "code-bg": "var(--code-bg)",
        "dropdown-chevron": "var(--dropdown-chevron)",
        "table-border": "var(--table-border)",
        "table-cell-bg": "var(--table-cell-bg)",
        "table-header-bg": "var(--table-header-bg)",
        "table-selected-bg": "var(--table-selected-bg)",
        "table-striping": "var(--table-striping)",
        "input-border": "var(--input-border)",
        "input-text": "var(--input-text)",
        "input-bg": "var(--input-bg)",
        "input-focus-border": "var(--input-focus-border)",
        "input-focus-bg": "var(--input-focus-bg)",
        "input-focus-shadow": "var(--input-focus-shadow)",
        "input-placeholder": "var(--input-placeholder)",
      },

      borderColor: {
        DEFAULT: "var(--editor-border)",
        "placeholder-text": "var(--placeholder-text)",
        "quote-border": "var(--quote-border)",
        "checkbox-border": "var(--checkbox-border)",
        "checkbox-checked-bg": "var(--checkbox-checked-bg)",
        "checkbox-checkmark": "var(--checkbox-checkmark)",
        "code-bg": "var(--code-bg)",
        "dropdown-chevron": "var(--dropdown-chevron)",
        "table-border": "var(--table-border)",
        "table-cell-bg": "var(--table-cell-bg)",
        "table-header-bg": "var(--table-header-bg)",
        "table-selected-bg": "var(--table-selected-bg)",
        "table-striping": "var(--table-striping)",
        "input-border": "var(--input-border)",
        "input-text": "var(--input-text)",
        "input-bg": "var(--input-bg)",
        "input-focus-border": "var(--input-focus-border)",
        "input-focus-bg": "var(--input-focus-bg)",
        "input-focus-shadow": "var(--input-focus-shadow)",
        "input-placeholder": "var(--input-placeholder)",
      },

      caretColor: {
        DEFAULT: "var(--accent)",
        "placeholder-text": "var(--placeholder-text)",
        "checkbox-border": "var(--checkbox-border)",
        "checkbox-checked-bg": "var(--checkbox-checked-bg)",
        "checkbox-checkmark": "var(--checkbox-checkmark)",
        "dropdown-chevron": "var(--dropdown-chevron)",
        "input-text": "var(--input-text)",
      },

      outlineColor: {
        "accent": "var(--accent)",
      },

      borderRadius: {
        'squircle': '24px 24px 24px 24px / 28px 28px 28px 28px',
      },

      transitionProperty: {
        'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
      }
    },
  },
  plugins: [],
} satisfies Config;
