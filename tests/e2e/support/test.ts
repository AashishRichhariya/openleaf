import { expect, test as base } from '@playwright/test';

import { Editor } from './editor';
import { isLoopback } from './env';

// Not an error: the browser postponed a resize notification by a frame. WebKit reports it now and
// then (2 of 14 identical runs on 0.3.0) for the observer inside Lexical's typeahead menu.
const RESIZE_POSTPONED = 'ResizeObserver loop completed with undelivered notifications.';

interface Fixtures {
  /** Console errors and uncaught page errors, in every tab of the test. */
  problems: string[];
  /** External URLs the page tried to reach. None of them is ever requested for real. */
  external: string[];
  ed: Editor;
}

export const test = base.extend<Fixtures>({
  external: async ({}, provide) => {
    await provide([]);
  },

  problems: async ({}, provide) => {
    await provide([]);
  },

  context: async ({ context, external, problems }, provide) => {
    // Scrolls happen at once instead of animating (the page sets scroll-behavior: smooth), as
    // animations are disabled for screenshots: WebKit reports almost no position while it
    // animates, so a capture could catch a smooth scroll halfway.
    await context.addInitScript(() => {
      const instant = () => {
        const style = document.createElement('style');
        style.textContent = 'html { scroll-behavior: auto !important; }';
        document.documentElement.appendChild(style);
      };
      if (document.documentElement) instant();
      else document.addEventListener('DOMContentLoaded', instant, { once: true });
    });
    await context.route(
      (url) => !isLoopback(url.href),
      async (route) => {
        external.push(route.request().url());
        // Answered locally, so that link clicks can be tested without any network.
        await route.fulfill({ contentType: 'text/html', body: '<title>external</title>' });
      },
    );
    await context.routeWebSocket(
      (url) => !isLoopback(url.href.replace(/^ws/, 'http')),
      (socket) => socket.close(),
    );
    context.on('page', (page) => {
      page.on('pageerror', (error) => {
        if (error.message !== RESIZE_POSTPONED) problems.push(`pageerror: ${error.message}`);
      });
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
    });
    await provide(context);
  },

  ed: async ({ page }, provide) => {
    await provide(new Editor(page));
  },
});

export { expect };
