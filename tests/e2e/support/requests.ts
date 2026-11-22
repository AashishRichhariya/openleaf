import { Page } from '@playwright/test';

export interface CapturedSave {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

/** Records the request the app itself sends when it saves `marker`. */
export async function captureSave(
  page: Page,
  marker: string,
  trigger: () => Promise<void>,
): Promise<CapturedSave> {
  const request = page.waitForRequest(
    (sent) => sent.method() !== 'GET' && (sent.postData() ?? '').includes(marker),
    { timeout: 10_000 },
  );
  await trigger();
  const sent = await request;
  const keep = ['next-action', 'next-router-state-tree', 'content-type', 'accept'];
  return {
    url: sent.url(),
    method: sent.method(),
    headers: Object.fromEntries(
      Object.entries(sent.headers()).filter(([key]) => keep.includes(key)),
    ),
    body: sent.postData()!,
  };
}

/** Sends a request from the page, as anyone with devtools could. Returns the HTTP status. */
export function send(page: Page, request: CapturedSave): Promise<number> {
  return page.evaluate(async ({ url, method, headers, body }) => {
    const response = await fetch(url, { method, headers, body });
    await response.text();
    return response.status;
  }, request);
}

/** The request an editor tab of 0.3.0 sends: a server action with positional arguments. */
export function legacySave(
  origin: string,
  actionId: string,
  args: unknown[],
  slug = String(args[0]),
): CapturedSave {
  return {
    url: `${origin}/${slug}`,
    method: 'POST',
    headers: {
      'next-action': actionId,
      'content-type': 'text/plain;charset=UTF-8',
      accept: 'text/x-component',
    },
    body: JSON.stringify(args),
  };
}
