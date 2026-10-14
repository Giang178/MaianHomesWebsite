import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type AutosaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export type AutosaveController = {
  state: AutosaveState;
  flush: () => Promise<void>;
};

export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  enabled: boolean,
  delay = 1500,
  scopeKey: string | null = null,
): AutosaveController {
  const [state, setState] = useState<AutosaveState>('idle');
  const saveRef = useRef(save);
  const latestValueRef = useRef(value);
  const latestSnapshotRef = useRef(JSON.stringify(value));
  const lastSavedSnapshotRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef<Promise<void> | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const snapshot = useMemo(() => JSON.stringify(value), [value]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runQueue = useCallback((): Promise<void> => {
    if (runningRef.current) return runningRef.current;
    const generation = generationRef.current;
    const task = (async () => {
      while (
        enabled
        && generation === generationRef.current
        && lastSavedSnapshotRef.current !== latestSnapshotRef.current
      ) {
        const valueToSave = latestValueRef.current;
        const snapshotToSave = latestSnapshotRef.current;
        if (mountedRef.current) setState('saving');
        try {
          await saveRef.current(valueToSave);
        } catch (error) {
          if (mountedRef.current && generation === generationRef.current) {
            setState('error');
          }
          throw error;
        }
        if (generation !== generationRef.current) return;
        lastSavedSnapshotRef.current = snapshotToSave;
        if (mountedRef.current) {
          setState(
            latestSnapshotRef.current === snapshotToSave ? 'saved' : 'dirty',
          );
        }
      }
    })();
    const wrapped = task.finally(() => {
      if (runningRef.current === wrapped) runningRef.current = null;
    });
    runningRef.current = wrapped;
    return wrapped;
  }, [enabled]);

  const flush = useCallback(async () => {
    clearTimer();
    if (!enabled) return;
    await runQueue();
  }, [clearTimer, enabled, runQueue]);

  useEffect(() => {
    generationRef.current += 1;
    clearTimer();
    runningRef.current = null;
    latestValueRef.current = value;
    latestSnapshotRef.current = snapshot;
    lastSavedSnapshotRef.current = enabled ? snapshot : undefined;
    setState('idle');
    // Scope changes intentionally reset the baseline; value updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    latestValueRef.current = value;
    latestSnapshotRef.current = snapshot;
    if (!enabled) {
      clearTimer();
      lastSavedSnapshotRef.current = undefined;
      setState('idle');
      return;
    }
    if (lastSavedSnapshotRef.current === undefined) {
      lastSavedSnapshotRef.current = snapshot;
      return;
    }
    if (lastSavedSnapshotRef.current === snapshot) return;
    setState('dirty');
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void runQueue().catch(() => undefined);
    }, delay);
  }, [clearTimer, delay, enabled, runQueue, snapshot, value]);

  useEffect(() => () => {
    mountedRef.current = false;
    generationRef.current += 1;
    clearTimer();
  }, [clearTimer]);

  return { state, flush };
}
