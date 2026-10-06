import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useBeforeUnload } from 'react-router-dom';

export function useUnsavedCoffee(dirty: boolean) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const current = useRef(dirty);
  current.current = dirty;
  useBeforeUnload(event => { if (current.current) { event.preventDefault(); event.returnValue = ''; } });
  useEffect(() => {
    const push = navigator.push;
    const replace = navigator.replace;
    const go = navigator.go;
    const allowed = () => !current.current || window.confirm('Есть несохранённые изменения. Покинуть карточку?');
    navigator.push = (...args) => { if (allowed()) push.apply(navigator, args); };
    navigator.replace = (...args) => { if (allowed()) replace.apply(navigator, args); };
    let approvedPop = false;
    navigator.go = (...args) => { if (allowed()) { approvedPop = true; go.apply(navigator, args); } };
    let index = window.history.state?.idx ?? 0;
    let restoring = false;
    const pop = (event: PopStateEvent) => {
      const next = event.state?.idx ?? index;
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
      if (approvedPop) { approvedPop = false; index = next; return; }
      if (!allowed()) { event.stopImmediatePropagation(); restoring = true; window.history.go(index - next); }
      else index = next;
    };
    window.addEventListener('popstate', pop, true);
    return () => { navigator.push = push; navigator.replace = replace; navigator.go = go; window.removeEventListener('popstate', pop, true); };
  }, [navigator]);
}
