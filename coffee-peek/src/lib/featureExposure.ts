/** An exposure requires at least 10% of the control/section visible for 500 ms in an active tab. */
export function observeFeatureExposure(element: Element, capture: () => boolean): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => undefined;
  let visible = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let captured = false;
  const cancel = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const schedule = () => {
    cancel();
    if (!visible || captured || document.visibilityState === 'hidden') return;
    timer = setTimeout(() => {
      timer = undefined;
      if (visible && document.visibilityState !== 'hidden') captured = capture();
    }, 500);
  };
  const observer = new IntersectionObserver(entries => {
    const entry = entries.find(item => item.target === element);
    if (!entry) return;
    visible = entry.isIntersecting && entry.intersectionRatio >= 0.1;
    schedule();
  }, { threshold: [0, 0.1] });
  observer.observe(element);
  const onReady = () => { captured = false; schedule(); };
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('coffeepeek:analytics-ready', onReady);
  return () => {
    cancel(); observer.disconnect();
    document.removeEventListener('visibilitychange', schedule);
    window.removeEventListener('coffeepeek:analytics-ready', onReady);
  };
}
