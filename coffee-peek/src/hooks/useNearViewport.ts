import { useEffect, useRef, useState } from 'react';

export function useNearViewport<T extends HTMLElement>(rootMargin: string) {
  const ref = useRef<T>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target || nearViewport) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        setNearViewport(true);
      }
    }, { rootMargin });
    observer.observe(target);
    return () => observer.disconnect();
  }, [nearViewport, rootMargin]);

  return { ref, nearViewport };
}
