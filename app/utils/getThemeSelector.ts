import { EditorThemeClasses } from 'lexical';

/**
 * Converts a theme class name to a CSS selector
 * @param getTheme Function that returns the current theme
 * @param name Name of the theme property
 * @returns CSS selector string
 */
export function getThemeSelector(
  getTheme: () => EditorThemeClasses | null | undefined,
  name: string
): string {
  const theme = getTheme();
  if (!theme) return '';

  const className = theme[name as keyof EditorThemeClasses];
  if (!className || typeof className !== 'string') {
    console.warn(`Theme property ${name} is not defined or not a string`);
    return '';
  }

  // Convert space-separated class names to CSS selectors
  return className
    .split(/\s+/g)
    .map((cls) => `.${cls}`)
    .join(', '); // Use comma for multiple selectors
}
