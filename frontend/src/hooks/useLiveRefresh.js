import { useEffect, useRef } from 'react';

const DATA_CHANGED_EVENT = 'sedes:data-changed';

export default function useLiveRefresh(callback, enabled = true, intervalMs = 12000) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    const refresh = () => {
      if (!document.hidden) callbackRef.current?.();
    };

    const interval = window.setInterval(refresh, intervalMs);
    window.addEventListener('focus', refresh);
    window.addEventListener(DATA_CHANGED_EVENT, refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(DATA_CHANGED_EVENT, refresh);
    };
  }, [enabled, intervalMs]);
}
