import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAutosave } from './useArticleEditor';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAutosave', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports dirty and saves after the debounce window', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave(value, save, true, 1500, 'article-1'),
      { initialProps: { value: { title: '' } } },
    );

    rerender({ value: { title: 'Bản nháp' } });
    expect(result.current.state).toBe('dirty');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(save).toHaveBeenCalledWith({ title: 'Bản nháp' });
    expect(result.current.state).toBe('saved');
  });

  it('serializes overlapping saves and coalesces to the latest value', async () => {
    vi.useFakeTimers();
    const first = deferred();
    const save = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave(value, save, true, 100, 'article-1'),
      { initialProps: { value: { title: 'A' } } },
    );

    rerender({ value: { title: 'B' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(save).toHaveBeenCalledTimes(1);

    rerender({ value: { title: 'C' } });
    await act(async () => {
      first.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ title: 'C' });
    expect(result.current.state).toBe('saved');
  });

  it('flushes the latest value without waiting for debounce', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave(value, save, true, 1500, 'article-1'),
      { initialProps: { value: { title: 'A' } } },
    );
    rerender({ value: { title: 'B' } });

    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: 'B' });
    expect(result.current.state).toBe('saved');
  });

  it('keeps the editor dirty state recoverable after a failed save', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValue(new Error('conflict'));
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave(value, save, true, 100, 'article-1'),
      { initialProps: { value: { title: 'A' } } },
    );
    rerender({ value: { title: 'B' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.state).toBe('error');
  });
});
