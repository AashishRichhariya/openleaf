import path from 'node:path';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function isLoopback(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return ['data:', 'blob:', 'about:'].includes(protocol) || LOOPBACK.has(hostname);
  } catch {
    return false;
  }
}

function loopbackUrl(value: string): string {
  if (!isLoopback(value)) throw new Error(`The e2e suite only talks to loopback, got ${value}`);
  return value;
}

function localTable(value: string): string {
  if (!value.startsWith('openleaf-local')) {
    throw new Error(`The e2e suite only uses openleaf-local* tables, got ${value}`);
  }
  return value;
}

/** Where the app under test and its local database are. */
export const ENV = {
  baseURL: loopbackUrl(process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4200'),
  dbURL: loopbackUrl(process.env.E2E_DB_URL ?? 'http://127.0.0.1:8000'),
  table: localTable(process.env.E2E_TABLE ?? 'openleaf-local-e2e'),
  // The build under test, used to find every server action it exposes.
  appDir: process.env.E2E_APP_DIR ?? path.resolve(__dirname, '../../..'),
  // Scenarios record what they see instead of comparing it. Set by `pnpm test:e2e:update`, which
  // then merges the recordings into expected/ (merge-recording.mjs).
  record: process.env.E2E_RECORD === '1',
  // Optional folder that receives one screenshot per scenario.
  screens: process.env.E2E_SCREENS,
};
