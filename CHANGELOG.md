# Changelog

All notable changes to openleaf will be documented in this file.

## [Unreleased]

## [0.5.0] - 2026-11-28

### Changed

- Each save sends only the blocks that changed since the last save, instead of the whole document, so saving a large document costs about as much as saving a small one
- Documents are stored compressed, about 7 times smaller. Documents over the old limit of 400 KB, about 1,000 to 2,000 lines, can be saved again: the limit is now 400 KB compressed. A document is converted the next time it is saved; nothing has to be run
- A save that fails also keeps the edit in the browser until a save succeeds, as hiding the tab already did, so a crash or a tab closed while offline loses nothing. Failed saves are still not shown
- Each document's save log keeps one entry per tab, for the 10 most recent tabs, instead of the last 100 saves
- This version can't be rolled back to 0.4.1, which can't read compressed documents: fix forward

### Fixed

- Deleting a selected equation with Backspace or Delete no longer deletes the character next to it too, and undo brings the equation back
- Inserting an equation near the bottom of a long page leaves the page at the same place every time

## [0.4.1] - 2026-11-24

### Changed

- A save that fails no longer shows "Changes not saved. Retrying…". It is retried quietly, and the next save sends the whole document
- A document locked while it is open no longer freezes or shows "this document is now read-only". Like a document that opens locked, it can still be edited and is never saved
- Documents too large to save still show their notice

## [0.4.0] - 2026-11-23

### Security

- Saving goes through a single guarded route. Internal server functions were public, so anyone could overwrite, lock or unlock any document, including locked ones
- Upgraded to Next.js 16 and React 19.3, which fix a remote code execution flaw and other advisories in Next.js 15.3
- Crafted save requests are refused without slowing or crashing the server

### Fixed

- Nobody can lock, unlock or overwrite a locked document from outside the app any more. Locked documents, such as the info page, can still be edited to try things out, and are never saved, as before
- Documents holding only an empty table or code block no longer vanish on reload
- Edits made just before closing the tab are saved
- Typing without a pause still saves, at least every 5 seconds, and failed saves are shown
- Two tabs editing the same document no longer overwrite each other: both edits are kept
- Three backticks create a code block in the right place, so markdown shortcuts, slash commands and lists keep working after it
- Copying equations with non-Latin characters works
- Prices such as `$5 and $` are no longer turned into math
- Pasting a sentence that contains a web address over selected text pastes the sentence, instead of turning the selection into a broken link. Pasting just an address with `https://` or `www.` still makes the selection a link
- Pasting very long words no longer freezes the page
- Escape in the table size widget keeps the caret, and the widget is never saved into documents
- `/center` offers Align center first
- Strikethrough, H4 and H5 have visible styling
- `/NxM` works beyond single digits, as the README says: either number up to 99, or up to 500 while the table has at most 1000 cells. The bottom-right cell offers add-column too
- Empty text styles and equations are saved as empty strings, not null
- Links opened in a new tab cannot control the editor tab
- Clicking away from an equation keeps the edit and puts the caret where you clicked
- After pasting several blocks, or pressing Down on the last line of a code block, typing goes where the caret is
- In Firefox, Enter in an equation no longer adds a line break after it

### Changed

- Documents open faster: KaTeX loads only when a document has an equation, and code highlighting loads right after the page
- Upgraded Lexical to 0.53, Tailwind CSS to 4, TypeScript to 6, ESLint to 9.39, KaTeX to 0.19, the AWS SDK and every other dependency to its latest stable version
- Requires Node.js 26 LTS and pnpm 12. Delete `node_modules` before the first install
- Added a Playwright test suite that compares every editor behavior with 0.3.0 in Chromium, Firefox and WebKit

## [0.3.0] - 2025-05-19

### Added

- Code component with syntax highlighting and line numbers
- LaTeX equation support (inline and block) with KaTeX integration
- Triple backtick code block trigger (```)
- Horizontal divider component via component picker and markdown syntax
- SVG icons component and dedicated icons folder
- Keyboard shortcuts in command menu

### Changed

- Improved dropdown UI with borders, icons and shortcut commands
- Enhanced text formatting for bold, italic, underline, and inline-code
- Upgraded Lexical packages and removed custom link transformer
- Improved mobile UI margins and sizes

### Fixed

- Table component improvements:
  - Fixed row/column hover button positioning
  - Fixed vertical rendering of menu action buttons
  - Combined table plugins into a single custom plugin
  - Fixed scrolling to page top on clearTableSelection
- Fixed editor placeholder positioning in smaller screens
- Fixed typeahead popover rendering on scrolled windows
- Fixed server not saving empty nodes
- Fixed equation alignments and overflow
- Fixed number lines height in code blocks

## [0.2.0] - 2025-04-26

### Added

- Link support with multiple creation methods:
  - Markdown syntax `[text](url)`
  - Automatic URL detection
  - Convert selected text to link by pasting URL
- Checklist markdown support (type `[]` or `[x]` followed by space)
- Social and GitHub icons with correct links
- Contributing guidelines (CONTRIBUTING.md)

### Changed

- Improved UI with better color contrast
- Updated automatic URL creation for more user-friendly and readable links
- Renamed backend code's folder from 'libs' to 'server' for better organization
- Updated README with more detailed information

### Performance

- Optimized asset delivery by reducing key image size from 20KB to 1.5KB after compression
- Improved bundle size through tree shaking and removal of unnecessary dependencies
- Switched from Vercel analytics to Umami analytics for smaller footprint and improved page load times

### Accessibility

- Added ARIA labels to improve screen reader compatibility

## [0.1.0] - Initial Release

### Features

- Minimalist browser-based editor with instant access via URL
- Auto-saving content as you type
- Markdown shortcuts support:
  - Headings (3 levels)
  - Bullet points
  - Numbered lists
  - Blockquotes
- Command menu (access via '/')
- Table creation via command menu or `/NxM` shortcut
- Basic project documentation
