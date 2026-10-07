import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** Keep the coffee catalog in place while its filters update. */
export function ScrollToTop() {
  const { pathname, search } = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname !== '/coffees' || previousPath.current !== pathname) window.scrollTo(0, 0);
    previousPath.current = pathname;
  }, [pathname, search]);

  return null;
}
