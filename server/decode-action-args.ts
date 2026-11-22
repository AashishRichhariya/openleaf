import 'server-only';

/**
 * Decode the arguments that a 0.3.0 tab sends to its saveDocument server action.
 *
 * React encodes them as JSON in which a string starting with $ is special: $$ escapes a real
 * dollar, $undefined is undefined and $0:path points at an object that was sent earlier.
 */
export function decodeActionArgs(body: string): unknown[] | null {
  let args: unknown;
  try {
    args = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(args)) return null;
  const root = args;

  const decode = (value: unknown, depth: number): unknown => {
    if (depth > 200) throw new Error('Nested too deeply');
    if (typeof value === 'string' && value.startsWith('$')) {
      if (value.startsWith('$$')) return value.slice(1);
      if (value === '$undefined') return undefined;
      if (value === '$-0') return 0;
      if (value.startsWith('$0:')) {
        let target: unknown = root;
        for (const key of value.slice(3).split(':')) {
          if (!target || typeof target !== 'object' || !Object.hasOwn(target, key)) {
            throw new Error('Dangling reference');
          }
          target = (target as Record<string, unknown>)[key];
        }
        // A reference points at an object, never at another reference
        if (!target || typeof target !== 'object') throw new Error('Invalid reference');
        return decode(target, depth + 20);
      }
      throw new Error('Unsupported value');
    }
    if (Array.isArray(value)) return value.map((item) => decode(item, depth + 1));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, decode(item, depth + 1)]),
      );
    }
    return value;
  };

  try {
    return decode(root, 0) as unknown[];
  } catch {
    return null;
  }
}
