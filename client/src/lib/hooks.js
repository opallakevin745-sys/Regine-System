import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, onDataChanged } from '../api';

/**
 * Loads an API resource, keeps the previous data visible while refetching, ignores stale
 * responses, and reloads when another screen reports a change in one of `areas`.
 */
export function useApi(path, { areas = [], select = (body) => body.data, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: Boolean(path && enabled), error: '' });
  const requestId = useRef(0);
  const selectRef = useRef(select);
  selectRef.current = select;

  const load = useCallback(async () => {
    if (!path || !enabled) return;
    const id = ++requestId.current;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const body = await apiRequest(path);
      if (id === requestId.current) setState({ data: selectRef.current(body), loading: false, error: '' });
    } catch (error) {
      if (id === requestId.current) setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, [path, enabled]);

  useEffect(() => { load(); }, [load]);

  const areaKey = areas.join('|');
  useEffect(() => (areaKey ? onDataChanged(areaKey.split('|'), load) : undefined), [areaKey, load]);

  return { ...state, reload: load };
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function usePagination(rows, pageSize = 20) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { setPage(1); }, [rows.length, pageSize]);
  const current = Math.min(page, pageCount);
  return {
    page: current,
    pageCount,
    setPage,
    total: rows.length,
    pageSize,
    rows: rows.slice((current - 1) * pageSize, current * pageSize)
  };
}

/** Runs a mutation with busy/error/success state for forms and row actions. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const run = useCallback(async (task, successMessage) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await task();
      if (successMessage) setMessage(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      return result;
    } catch (requestError) {
      setError(requestError.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, message, setError, setMessage, run };
}
