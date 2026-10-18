type Entry = { controller: AbortController; promise: Promise<Blob>; users: number };

/** Shares only in-flight requests. Bytes and object URLs are never retained here. */
export class PhotoRequests {
  private active = 0;
  private waiting = new Set<() => void>();
  private entries = new Map<string, Entry>();
  private load: (url: string, signal: AbortSignal) => Promise<Blob>;
  private limit: number;
  constructor(load: (url: string, signal: AbortSignal) => Promise<Blob>, limit = 4) {
    this.load = load;
    this.limit = limit;
  }

  acquire(url: string, scope: number) {
    const key = JSON.stringify([scope, url]);
    let entry = this.entries.get(key);
    if (!entry) {
      const controller = new AbortController();
      const promise = this.run(url, controller.signal);
      entry = { controller, promise, users: 0 };
      const current = entry;
      this.entries.set(key, entry);
      void promise.finally(() => { if (this.entries.get(key) === current) this.entries.delete(key); }).catch(() => {});
    }
    entry.users++;
    let released = false;
    const current = entry;
    return { promise: entry.promise, release: () => {
      if (released) return;
      released = true;
      if (--current.users === 0) {
        current.controller.abort();
        if (this.entries.get(key) === current) this.entries.delete(key);
      }
    } };
  }

  private async run(url: string, signal: AbortSignal): Promise<Blob> {
    while (this.active >= this.limit) {
      await new Promise<void>((resolve, reject) => {
        const wake = () => { signal.removeEventListener('abort', cancel); this.waiting.delete(wake); resolve(); };
        const cancel = () => { this.waiting.delete(wake); reject(new DOMException('Cancelled', 'AbortError')); };
        if (signal.aborted) { cancel(); return; }
        this.waiting.add(wake);
        signal.addEventListener('abort', cancel, { once: true });
      });
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    this.active++;
    try { return await this.load(url, signal); }
    finally { this.active--; this.waiting.values().next().value?.(); }
  }
}
