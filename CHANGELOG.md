# Changelog

All notable changes to openleaf will be documented in this file.

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
