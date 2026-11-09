import { useState, useCallback, useRef } from 'react';

export interface UseIdempotentActionOptions<TResult> {
  onSuccess?: (data: TResult) => void;
  onError?: (error: Error) => void;
  retryOnConflict?: boolean;
  maxConflictRetries?: number;
  conflictRetryDelayMs?: number;
}

export interface UseIdempotentActionReturn<TArgs extends any[], TResult> {
  execute: (...args: TArgs) => Promise<TResult | undefined>;
  isExecuting: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Utility to generate standard UUID v4 across browsers and environments
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * React 19 Custom Hook for executing critical mutations (Pay, Register, Order)
 * with automatic UUID v4 Idempotency-Key injection and physical double-click locking.
 */
export function useIdempotentAction<TArgs extends any[], TResult>(
  actionFn: (key: string, ...args: TArgs) => Promise<TResult>,
  options: UseIdempotentActionOptions<TResult> = {}
): UseIdempotentActionReturn<TArgs, TResult> {
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Active execution lock ref to protect against immediate re-entrancy double clicks
  const lockRef = useRef<boolean>(false);

  const reset = useCallback(() => {
    setError(null);
    setIsExecuting(false);
    lockRef.current = false;
  }, []);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      // 1. Prevent physical double-clicks and concurrent calls
      if (lockRef.current || isExecuting) {
        console.warn('[useIdempotentAction] Duplicate click blocked by client-side lock.');
        return undefined;
      }

      lockRef.current = true;
      setIsExecuting(true);
      setError(null);

      // 2. Generate unique UUID v4 idempotency key for this atomic transaction
      const idempotencyKey = generateIdempotencyKey();

      try {
        let attempts = 0;
        const maxRetries = options.retryOnConflict ? (options.maxConflictRetries ?? 2) : 0;
        const delayMs = options.conflictRetryDelayMs ?? 1000;

        while (true) {
          try {
            const result = await actionFn(idempotencyKey, ...args);
            options.onSuccess?.(result);
            return result;
          } catch (err: any) {
            // Check for HTTP 409 Conflict (request currently in flight on backend)
            const isConflict = err?.status === 409 || err?.response?.status === 409 || err?.message?.includes('409');
            if (isConflict && attempts < maxRetries) {
              attempts++;
              console.warn(`[useIdempotentAction] 409 Conflict detected. Retrying attempt ${attempts}/${maxRetries} after ${delayMs}ms...`);
              await new Promise((res) => setTimeout(res, delayMs));
              continue;
            }
            throw err;
          }
        }
      } catch (err: any) {
        const normalizedError = err instanceof Error ? err : new Error(String(err?.message || err));
        setError(normalizedError);
        options.onError?.(normalizedError);
        throw normalizedError;
      } finally {
        lockRef.current = false;
        setIsExecuting(false);
      }
    },
    [actionFn, isExecuting, options]
  );

  return {
    execute,
    isExecuting,
    error,
    reset,
  };
}

/**
 * Universal Idempotent Fetch wrapper injecting 'Idempotency-Key' into HTTP headers
 */
export async function idempotentFetch<T = any>(
  url: string,
  options: RequestInit = {},
  explicitKey?: string
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  // Inject Idempotency-Key on state-mutating HTTP methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', explicitKey || generateIdempotencyKey());
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error: any = new Error(
      (data && typeof data === 'object' && data.error) ||
        (data && typeof data === 'object' && data.message) ||
        `HTTP ${response.status}: ${response.statusText}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}
