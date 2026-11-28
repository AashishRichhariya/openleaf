# Contributing to openleaf

Thanks for your interest in contributing to openleaf!

## Quick Start

```bash
# Clone the repository
git clone https://github.com/AashishRichhariya/openleaf.git

# Navigate to the project directory
cd openleaf

# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

The application will be running at `http://localhost:3000`

## How to Contribute

### Reporting Bugs

When reporting bugs:

- Check existing issues first to avoid duplicates
- Use a clear title and description
- Include steps to reproduce
- Mention your browser and OS
- Include screenshots or screen recordings when relevant

### Suggesting Features

For feature requests:

- Explain why the feature would be useful
- Keep it aligned with openleaf's philosophy
- Consider providing mockups or examples

### Branch Naming & Pull Requests

1. Fork the repository
2. Create a new branch following our naming convention:
   - All lowercase with hyphens between words
   - For features: `feature/short-description` (e.g., `feature/code-blocks`)
   - For bugfixes: `bugfix/short-description` (e.g., `bugfix/table-alignment`)
   - For documentation: `docs/short-description` (e.g., `docs/api-reference`)
   - For maintenance tasks: `chore/short-description` (e.g., `chore/update-dependencies`)
   - For refactoring: `refactor/short-description` (e.g., `refactor/editor-state`)
   - For testing: `test/short-description` (e.g., `test/table-rendering`)
   - For style changes: `style/short-description` (e.g., `style/button-colors`)
3. Make your changes, with tests (see [Testing](#testing))
4. Run `pnpm test:e2e`, then submit a PR to the `develop` branch (not directly to `main`). CI must pass.

## Code Guidelines

### Commit Messages

- Use present tense and imperative mood
- Keep the first line short (< 72 characters)
- Format: `type(scope): description` (e.g., `feat(editor): add code block support`)

### Code Style

- We use TypeScript for type safety
- Follow the existing patterns in the codebase
- Use ESLint and Prettier for formatting (configs are in the repo)
- For CSS, use Tailwind utility classes when possible

## Testing

Every feature and bug fix comes with end-to-end tests. They run in Docker, so all you need is Docker and bash:

```bash
pnpm test:e2e                          # the whole suite, in Chromium, Firefox and WebKit
pnpm test:e2e --project=chromium --grep "table"   # a subset, while you work
```

- Run the full suite before you open or update a pull request.
- CI runs it on every pull request, and its checks must pass before anything is merged.
- [tests/e2e/README.md](tests/e2e/README.md) explains how to add tests for a feature or a fix, and how to update a
  baseline when you change behavior on purpose.

## Project Structure

```
openleaf/
├── app/                  # Next.js app directory
│   ├── [slug]/           # Dynamic routes
│   ├── components/       # React components
│   │   ├── editor/       # Editor components
│   │   ├── analytics/    # Analytics components
│   │   └── social-links/ # Social link components
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Utility functions
├── server/               # Server-side code
├── public/               # Static assets
└── types/                # TypeScript types
```

## Technologies

- [Lexical](https://lexical.dev/) - Text editor framework
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - For styling
- [DynamoDB](https://aws.amazon.com/dynamodb/) - For storage

---

Happy contributing! 🌱
