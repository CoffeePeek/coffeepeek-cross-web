import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Legal pages load lazily, after the browser's initial fragment scroll. */
export function useLegalPageAnchor(): void {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);
}
