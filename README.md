# openleaf

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Beta Status](https://img.shields.io/badge/Status-Beta-yellow.svg)](https://github.com/AashishRichhariya/openleaf)
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://openleaf.xyz/info)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/AashishRichhariya/openleaf/pulls)

## The minimalist web-based editor

**openleaf** is a minimalist, browser-based rich text editor that lets you start writing instantly without signup, downloads, or configuration. Just go to any URL and start typing!

![image](https://github.com/user-attachments/assets/ed490943-4bbf-4513-8ff3-2a60ec40a143)

Check it out: [openleaf.xyz/info](https://openleaf.xyz/info)

## How It Works

- Visit any link like `openleaf.xyz/anything-you-want`
- Start typing immediately
- The content automatically saves as you type
- Share the URL with others or return later to continue

## Features

### Markdown Syntax

**openleaf** supports markdown shortcuts for quick formatting (type the symbol then press space to activate):

- Type `#` for a large heading
- Type `##` for a medium heading
- Type `###` for a small heading
- Type `-` for bullet points
- Type `1.` for numbered lists
- Type `>` for blockquotes
- Type `[]` or `[x]` for checklist items
- Type `[text](url)` to create links
- Type `` ` `` around text (like `` `code` ``) for inline code formatting
- Type ` ``` ` and press Space for code block
- Type `---` for a horizontal divider
- Type `$` around text (like `$ equation=inline $`) for inline equations
- Type `$$` around text (like `$$ equation=block $$`) for block equations

### Command Menu

Press `/` to access the command menu with all available formatting options:

- Headings (3 levels)
- Lists (numbered, bulleted, checklist)
- Tables
- Quotes
- Text alignment
- Code blocks
- Mathematical expressions
- And more!

### Tables

Create tables easily by either:

- Type `/table` and select from the menu
- Or type `/NxM` where N and M are any numbers (like `/3x4`, `/2x6`, etc.) to instantly create a table with that many rows and columns

### Links

Create links easily in multiple ways:

- Type `[text](url)` using markdown syntax
- Type any URL, such as `https://openleaf.xyz` or `www.openleaf.xyz`, to have it automatically detected as a link
- Select text and paste a URL (Cmd+V or Ctrl+V) to turn the selected text into a link

### Code Blocks

Format code with syntax highlighting:

- Type ` ``` ` and press Space to create a code block
- Access code blocks via the command menu
- View line numbers for easier reference

### Equations

Create mathematical expressions using LaTeX syntax:

- Click or press Enter to select an equation
- Double click or press Enter while in select mode to edit an equation
- Press Enter or click outside to save the changes
- Supports both inline and block equations

### Checklists

Keep track of tasks with checkable lists:

- [x] Create a minimalist editor
- [x] Make it work without signup with a simple url
- [x] Add Markdown support
- [x] Add table support
- [x] Open-source it
- [ ] Fix bugs
- [ ] Add more features!

## Philosophy

**openleaf** is designed with simplicity in mind:

> The best tool is the one that gets out of your way.

The goal is to provide a writing space that's instantly available when needed, without barriers or complexity. Sometimes all you need is a quick place to jot down thoughts or draft something up.

## Privacy & Security

By design, **openleaf** is open and accessible. This means:

- Anyone with the URL can view and edit your content
- Nothing is private by default
- Choose obscure URLs for reduced discoverability
- Don't store sensitive information
- For extra security, clear the editor content after you're done if you don't want others to access it later

## Use Cases

### Perfect for:

- Quick notes while browsing
- Drafting emails or messages
- Temporary information sharing
- Collaborative brainstorming
- Instant document creation

### Not ideal for:

- Private/confidential information
- Long-term document storage

## Project Status

**openleaf** is currently in beta with known bugs and limitations. Development continues as time permits, with priority given to critical issues and frequently requested features. Please use the GitHub repository to report any bugs you encounter.

## Contribute to openleaf

This project is open source under the MIT license. Contributions and feedback are welcome on [GitHub](https://github.com/AashishRichhariya/openleaf)!

- 🐛 Found a bug? [Open an issue](https://github.com/AashishRichhariya/openleaf/issues)
- 💡 Have a feature idea? [Share it with us](https://github.com/AashishRichhariya/openleaf/issues)
- 💻 Want to contribute code? [Check out our guidelines](CONTRIBUTING.md)
- ⭐ Enjoying openleaf? Spread the word or star us on [GitHub](https://github.com/AashishRichhariya/openleaf)!

## Technical Details

**openleaf** is built with:

- [Lexical](https://lexical.dev/) - Meta's open-sourced text editor framework
- [Next.js](https://nextjs.org/) - Full stack React framework with TypeScript
- [Tailwind CSS](https://tailwindcss.com/) - For styling
- [DynamoDB](https://aws.amazon.com/dynamodb/) - For storage

## Feature Roadmap

| Feature                     | Status      |
| --------------------------- | ----------- |
| Enhanced UI                 | Developing  |
| Advanced Formatting Options | Developing  |
| Private Notes               | Planned     |
| Media Support               | Planned     |
| Encrypted Notes             | Exploring   |
| Real-time Collaboration     | Exploring   |
| Document History            | Exploring   |
| Self-Hosting                | Exploring   |
| Export Options              | Considering |
| CMS Integration             | Considering |

## Installation

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
