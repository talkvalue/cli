interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxRetryAfterMs?: number;
}

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return undefined;
}

function isRetryableError(error: unknown): boolean {
  return error instanceof TypeError;
}

export async function withRetry(
  fn: () => Promise<Response>,
  options?: RetryOptions,
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? 3;
  if (maxAttempts < 1) {
    return fn();
  }
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const maxRetryAfterMs = options?.maxRetryAfterMs ?? 60_000;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fn();

      if (!RETRYABLE_STATUS_CODES.has(response.status)) {
        return response;
      }

      if (attempt === maxAttempts - 1) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(response);
      const jitter = 0.75 + Math.random() * 0.5;
      const exponentialMs = Math.floor(baseDelayMs * 2 ** attempt * jitter);
      const delayMs = retryAfterMs ? Math.min(retryAfterMs, maxRetryAfterMs) : exponentialMs;

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt === maxAttempts - 1) {
        throw error;
      }

      const jitter = 0.75 + Math.random() * 0.5;
      const exponentialMs = Math.floor(baseDelayMs * 2 ** attempt * jitter);
      await new Promise((resolve) => setTimeout(resolve, exponentialMs));
    }
  }

  throw lastError;
}
