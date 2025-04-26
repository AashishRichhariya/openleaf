# Changelog

All notable changes to openleaf will be documented in this file.

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
