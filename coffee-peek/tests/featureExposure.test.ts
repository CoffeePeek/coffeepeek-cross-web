import { observeFeatureExposure } from '../src/lib/featureExposure';

describe('feature exposures', () => {
  const originals = ['window', 'document', 'IntersectionObserver'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let notify: IntersectionObserverCallback;
  let disconnect: jest.Mock;
  let target: Element;
  let capture: jest.Mock;
  let stop: () => void;
  let page: EventTarget & { visibilityState: string };
  beforeEach(() => {
    jest.useFakeTimers();
    page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    target = {} as Element;
    capture = jest.fn(() => true);
    disconnect = jest.fn();
    Object.defineProperty(globalThis, 'document', { configurable: true, value: page });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
    Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, value: jest.fn(callback => {
      notify = callback;
      return { observe: jest.fn(), disconnect };
    }) });
    stop = observeFeatureExposure(target, capture);
  });
  afterEach(() => {
    stop(); jest.useRealTimers();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  function intersect(ratio: number) {
    notify([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver);
  }
  test('offscreen elements and brief scroll passes do not become exposures', () => {
    intersect(0); jest.advanceTimersByTime(1000);
    intersect(0.6); jest.advanceTimersByTime(499);
    intersect(0); jest.advanceTimersByTime(1000);
    expect(capture).not.toHaveBeenCalled();
    intersect(0.6); jest.advanceTimersByTime(500);
    expect(capture).toHaveBeenCalledTimes(1);
    intersect(0); intersect(0.8); jest.advanceTimersByTime(1000);
    expect(capture).toHaveBeenCalledTimes(1);
  });
  test('hidden tabs cancel dwell time and resume a full dwell after activation', () => {
    intersect(0.5); jest.advanceTimersByTime(300);
    page.visibilityState = 'hidden'; page.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(1000); expect(capture).not.toHaveBeenCalled();
    page.visibilityState = 'visible'; page.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(499); expect(capture).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1); expect(capture).toHaveBeenCalledTimes(1);
  });
  test('late consent/readiness retries a currently visible feature; no retroactive offscreen exposure', () => {
    capture.mockReturnValueOnce(false);
    intersect(0.8); jest.advanceTimersByTime(500);
    window.dispatchEvent(new Event('coffeepeek:analytics-ready')); jest.advanceTimersByTime(500);
    expect(capture).toHaveBeenCalledTimes(2);
    intersect(0);
    window.dispatchEvent(new Event('coffeepeek:analytics-ready')); jest.advanceTimersByTime(500);
    expect(capture).toHaveBeenCalledTimes(2);
  });
  test('cleanup disconnects observer and cancels pending exposure', () => {
    intersect(0.9); stop(); jest.advanceTimersByTime(1000);
    window.dispatchEvent(new Event('coffeepeek:analytics-ready')); jest.advanceTimersByTime(1000);
    expect(capture).not.toHaveBeenCalled(); expect(disconnect).toHaveBeenCalled();
  });
});
