# openleaf

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Beta Status](https://img.shields.io/badge/Status-Beta-yellow.svg)](https://github.com/AashishRichhariya/openleaf)

## The minimalist web-based editor

**openleaf** is a minimalist, browser-based text editor that lets you start writing instantly without signup, downloads, or configuration. Just go to any URL and start typing!

<img width="1440" alt="image" src="https://github.com/user-attachments/assets/61fe5463-6b17-4125-925f-187377040dd0" />

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

### Command Menu
Press `/` to access the command menu with all available formatting options:
- Headings (3 levels)
- Lists (numbered, bulleted, checklist)
- Tables
- Quotes
- Code blocks (coming soon!)
- Text alignment (coming soon!)
- And more!

### Tables
Create tables easily by either:
- Type `/table` and select from the menu
- Or type `/NxM` where N and M are any numbers (like `/3x4`, `/2x6`, etc.) to instantly create a table with that many rows and columns

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

This project is open source under the MIT license. Contributions and feedback are welcome!

- 🐛 Found a bug? [Open an issue](https://github.com/AashishRichhariya/openleaf/issues) on GitHub
- 💡 Have a feature idea? [Share it](https://github.com/AashishRichhariya/openleaf/issues) on GitHub
- 💻 Want to contribute code? [Submit a pull request](https://github.com/AashishRichhariya/openleaf/pulls)

## Technical Details

**openleaf** is built with:
- [Lexical](https://lexical.dev/) - Meta's open-sourced text editor framework
- [Next.js](https://nextjs.org/) - Full stack React framework with TypeScript
- [Tailwind CSS](https://tailwindcss.com/) - For styling
- [DynamoDB](https://aws.amazon.com/dynamodb/) - For storage

## Future Possibilities

If interest grows, potential future features might include:
- Optional user accounts
- Temporary URL leasing (lock a URL for your exclusive use for a set period)
- More formatting options
- PDF exporting and printing
- Real-time collaboration indicators

## Installation

```bash
# Clone the repository
git clone https://github.com/AashishRichhariya/openleaf.git

# Navigate to the project directory
cd openleaf

# Install dependencies
npm install

# Run the development server
npm run dev
```

## License

**openleaf** is licensed under the [MIT License](LICENSE).
