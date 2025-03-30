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
        background: "var(--background)",
        foreground: "var(--foreground)",
        "editor-bg": "var(--editor-bg)",
        "editor-border": "var(--editor-border)",
        accent: {
          DEFAULT: 'var(--accent)',
          '20': 'rgba(var(--accent-rgb), 0.2)',
          '50': 'rgba(var(--accent-rgb), 0.5)',
          '80': 'rgba(var(--accent-rgb), 0.5)',
        },
        "nav-border": "var(--nav-border)",
      },
      borderColor: {
        DEFAULT: "var(--editor-border)",
      },
      caretColor: {
        DEFAULT: "var(--accent)",
      },
      textColor: {
        DEFAULT: "var(--foreground)",
      },
      backgroundColor: {
        DEFAULT: "var(--background)",
      },
    },
  },
  plugins: [],
} satisfies Config;

