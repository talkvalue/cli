import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "../../../src/api/retry.js";

function makeResponse(status: number, headers?: Record<string, string>): Response {
  return new Response(null, { status, headers });
}

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("successful response returns immediately", async () => {
    const fn = vi.fn().mockResolvedValueOnce(makeResponse(200));

    const result = await withRetry(fn);

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("client error 400 returns immediately without retry", async () => {
    const fn = vi.fn().mockResolvedValueOnce(makeResponse(400));

    const result = await withRetry(fn);

    expect(result.status).toBe(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("client error 404 returns immediately without retry", async () => {
    const fn = vi.fn().mockResolvedValueOnce(makeResponse(404));

    const result = await withRetry(fn);

    expect(result.status).toBe(404);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("429 retries with Retry-After header", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, { "retry-after": "2" }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = withRetry(fn, { baseDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("503 retries with exponential backoff", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("max attempts exhausted returns last response", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(503));

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.status).toBe(503);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("network error (TypeError) retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = withRetry(fn, { baseDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("non-retryable error throws immediately", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    const fn = vi.fn().mockRejectedValueOnce(abortError);

    await expect(withRetry(fn)).rejects.toThrow("The operation was aborted");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("Retry-After capped at maxRetryAfterMs", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, { "retry-after": "120" }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = withRetry(fn, { maxRetryAfterMs: 60_000, baseDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
