// Synthetic UI fixture only. No production requests, accounts or photographs.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CheckInPhotos from '../src/components/CheckInPhotos';
import { httpClient } from '../src/api/core/httpClient';
import { invalidateProtectedPhotos } from '../src/lib/photoSession';
import '../index.css';

let denied = false;
let offline = false;
let noStore = false;
let mismatch = false;
let omitDate = false;
const ttl = Math.max(0, Math.min(20, Number(new URLSearchParams(location.search).get('ttl') ?? 20)));
const requests: string[] = [];
httpClient.getPhotoResponse = async (url, signal, etag) => {
  const requestMono = performance.now();
  const variant = url.includes('/variants/');
  const tag = `"fixture:${url}"`;
  const status = etag && etag === tag && !noStore ? 304 : 200;
  const outcome = denied ? '403' : offline ? 'offline' : String(status);
  requests.push(`${outcome} ${etag ? `If-None-Match ${etag} ` : ''}${url}`);
  document.getElementById('requests')!.textContent = requests.join('\n');
  if (offline) throw new TypeError('Synthetic offline');
  if (denied) throw new Error('Access denied');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const blob = status === 200 ? new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960"><rect width="640" height="960" fill="#6b4233"/><circle cx="320" cy="440" r="150" fill="#f3e6cf"/><text x="320" y="740" text-anchor="middle" font-size="28" fill="white">${url.split('/').slice(-2).join(' ')}</text></svg>`], { type: 'image/svg+xml' }) : undefined;
  const headers = new Headers({ ETag: mismatch ? '"different"' : tag, 'Cache-Control': variant && !noStore ? `private,max-age=${ttl},must-revalidate` : 'private,no-store' });
  if (!omitDate) headers.set('Date', new Date().toUTCString());
  headers.set('Age', '0');
  return { status, blob, headers, requestMono, responseMono: performance.now(), responseWall: Date.now() };
};

const photos = Array.from({ length: 5 }, (_, index) => ({ id: `${index}`, url: `/api/v1/check-ins/fixture/photos/${index}`, fileName: '', storageKey: '', contentType: 'image/jpeg', sizeBytes: 1000, sortIndex: index,
  variants: ['thumb', 'feed', 'detail'].map(purpose => ({ purpose, format: 'webp', contentType: 'image/webp', width: 640, height: 960, sizeBytes: 1000, sourceVersion: 'fixture', recipeVersion: 1, url: `/api/v1/check-ins/fixture/photos/${index}/variants/fixture/1/${purpose}.webp` })),
}));

function Fixture() {
  const [mounted, setMounted] = useState(true);
  return <main className="mx-auto max-w-xl space-y-4 p-5">
    <h1 className="text-xl font-bold">Photo delivery fixture</h1>
    <p className="text-sm">Memory only; TTL {ttl}s. Unmount/Mount before TTL uses bytes; after TTL revalidates with 304. Open ?ttl=2 for fast expiry checks.</p>
    <div className="flex flex-wrap gap-2">
      <button onClick={() => setMounted(value => !value)}>{mounted ? 'Unmount' : 'Mount'}</button>
      <button onClick={invalidateProtectedPhotos}>New session</button>
      <button onClick={() => { denied = true; invalidateProtectedPhotos(); }}>Deny access</button>
      <button onClick={() => { denied = true; }}>Deny next request</button>
      <button onClick={() => { denied = false; invalidateProtectedPhotos(); }}>Allow access</button>
      <button onClick={() => { offline = true; }}>Offline next request</button>
      <button onClick={() => { offline = false; invalidateProtectedPhotos(); }}>Online new session</button>
      <button onClick={() => { noStore = true; invalidateProtectedPhotos(); }}>No-store new session</button>
      <button onClick={() => { noStore = false; invalidateProtectedPhotos(); }}>Cacheable new session</button>
      <button onClick={() => { mismatch = true; }}>Mismatch next ETag</button>
      <button onClick={() => { omitDate = true; invalidateProtectedPhotos(); }}>Missing Date new session</button>
    </div>
    {mounted && <CheckInPhotos photos={photos} shopName="Fixture Coffee" />}
    <pre id="requests" aria-label="Photo requests" className="whitespace-pre-wrap text-xs" />
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
