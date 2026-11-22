import { Page } from '@playwright/test';

export interface Box {
  el: string;
  rect: number[];
  style: string;
}

export interface View {
  caret: string;
  focus: string;
  text: string;
  boxes: Box[];
  floating: Box[];
  scroll: number;
}

/** Everything observable about the editor right now. */
export function capture(page: Page): Promise<View> {
  return page.evaluate(() => {
    const root: any = document.querySelector('.editor-input');
    const state = root.__lexicalEditor.getEditorState();

    const path = (key: string) => {
      const indexes: number[] = [];
      let node = state._nodeMap.get(key);
      if (!node) return '?';
      while (node && node.__parent) {
        let index = 0;
        for (let before = node.__prev; before; before = state._nodeMap.get(before).__prev) {
          index += 1;
        }
        indexes.unshift(index);
        node = state._nodeMap.get(node.__parent);
      }
      return indexes.join('.');
    };

    const selection = state._selection;
    let caret = 'none';
    if (selection?.anchor) {
      const point = (at: any) => `${path(at.key)}:${at.offset}:${at.type}`;
      const anchor = point(selection.anchor);
      const focus = point(selection.focus);
      caret = (selection.tableKey ? 'table ' : '')
        + (anchor === focus ? anchor : `${anchor}-${focus}`);
    } else if (selection?._nodes) {
      caret = `nodes ${([...selection._nodes] as string[]).map(path).sort().join(',')}`;
    }

    const active = document.activeElement as HTMLInputElement | null;
    let focus = active === root ? 'editor' : active?.tagName.toLowerCase() ?? 'none';
    if (active?.tagName === 'INPUT') {
      focus += ` ${active.placeholder}=${JSON.stringify(active.value)}`;
    }

    const origin = root.getBoundingClientRect();
    const describe = (element: Element, relative: boolean) => {
      const rect = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      const name = [...element.classList]
        .filter((cls) => /^(editor-|katex$|katex-error$|equation-|typeahead|table-)/.test(cls))
        .sort()
        .join('.');
      const parts = [
        css.color, css.backgroundColor,
        css.fontFamily.split(',')[0], css.fontSize, css.fontWeight, css.fontStyle,
        css.lineHeight, css.textDecorationLine,
        css.textAlign === 'start' ? 'left' : css.textAlign,
        css.direction, css.cursor,
        css.borderTopWidth === '0px'
          ? 'no-border'
          : `${css.borderTopWidth} ${css.borderTopStyle} ${css.borderTopColor}`,
        css.borderLeftWidth === '0px'
          ? 'no-left'
          : `${css.borderLeftWidth} ${css.borderLeftStyle} ${css.borderLeftColor}`,
        css.borderTopLeftRadius,
        `${css.paddingTop} ${css.paddingRight} ${css.paddingBottom} ${css.paddingLeft}`,
      ];
      if (element.tagName === 'LI' || element.tagName === 'UL' || element.tagName === 'OL') {
        parts.push(css.listStyleType);
      }
      if (/editor-(code|listitem-|horizontal-rule)/.test(name)) {
        for (const pseudo of ['::before', '::after']) {
          const extra = getComputedStyle(element, pseudo);
          if (extra.content === 'none' || extra.display === 'none') continue;
          parts.push([
            pseudo, extra.content, extra.width, extra.height, extra.backgroundColor,
            extra.borderBottomWidth, extra.borderBottomColor, extra.opacity,
          ].join(' '));
        }
      }
      const left = relative ? rect.left - origin.left : rect.left;
      const top = relative ? rect.top - origin.top : rect.top;
      const content = element.matches('[data-lexical-text], .item, .table-action-menu-item')
        ? ` ${JSON.stringify(element.textContent?.slice(0, 40))}`
        : '';
      return {
        el: `${element.tagName.toLowerCase()}${name ? `.${name}` : ''}${content}`,
        rect: [left, top, rect.width, rect.height].map(Math.round),
        style: parts.join(' | '),
      };
    };

    const shown = (element: Element) => {
      const css = getComputedStyle(element);
      return css.visibility !== 'hidden' && css.display !== 'none' && css.opacity !== '0';
    };

    const boxes = [
      ...root.querySelectorAll(
        '[data-lexical-text], [class*="editor-"], li, table, td, th, input, .katex',
      ),
    ]
      .filter((element: Element) => !element.parentElement?.closest('.katex'))
      .filter((element: Element) => {
        // Only what is on screen: long documents would drown the comparison.
        const { top, bottom } = element.getBoundingClientRect();
        return bottom > -2 && top < innerHeight + 2;
      })
      .slice(0, 300)
      .map((element: Element) => describe(element, true));

    const floating = [
      ...document.querySelectorAll([
        '.component-picker-menu',
        '.component-picker-menu .item',
        '.table-action-menu-dropdown',
        '.table-action-menu-item',
        '.table-cell-action-button-container-active',
        '.editor-table-add-rows',
        '.editor-table-add-columns',
        '.editor-placeholder',
        '.equation-controls',
      ].join(',')),
    ]
      .filter(shown)
      .map((element) => describe(element, false));

    return {
      caret,
      focus,
      text: root.innerText
        .replace(/[ ​]/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim(),
      boxes,
      floating,
      scroll: Math.round(scrollY),
    };
  });
}
