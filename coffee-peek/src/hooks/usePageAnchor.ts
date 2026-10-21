import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Lazy pages render after the browser's initial fragment scroll. */
export function usePageAnchor(ready = true): void {
  const { hash } = useLocation();

  useEffect(() => {
    if (!ready || !hash) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, ready]);
}
