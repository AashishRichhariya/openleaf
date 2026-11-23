import { debounce } from 'lodash-es';
import { useLayoutEffect, useMemo, useRef } from 'react';

export function useDebounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
  maxWait?: number,
) {
  const funcRef = useRef<T>(fn);
  useLayoutEffect(() => {
    funcRef.current = fn;
  });

  return useMemo(
    () =>
      debounce(
        // debounce only calls this later, never during render
        // eslint-disable-next-line react-hooks/refs
        (...args: Parameters<T>) => {
          funcRef.current(...args);
        },
        ms,
        maxWait !== undefined ? { maxWait } : undefined,
      ),
    [ms, maxWait],
  );
}
