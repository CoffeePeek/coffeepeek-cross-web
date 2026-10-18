// Synthetic UI fixture only. No production requests, accounts or photographs.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CheckInPhotos from '../src/components/CheckInPhotos';
import { httpClient } from '../src/api/core/httpClient';
import { invalidateProtectedPhotos } from '../src/lib/photoSession';
import '../index.css';

let denied = false;
const requests: string[] = [];
httpClient.getBlob = async (url, signal) => {
  requests.push(url);
  document.getElementById('requests')!.textContent = requests.join('\n');
  if (denied) throw new Error('Access denied');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960"><rect width="640" height="960" fill="#6b4233"/><circle cx="320" cy="440" r="150" fill="#f3e6cf"/><text x="320" y="740" text-anchor="middle" font-size="28" fill="white">${url.split('/').slice(-2).join(' ')}</text></svg>`], { type: 'image/svg+xml' });
};

const photos = Array.from({ length: 5 }, (_, index) => ({ id: `${index}`, url: `/original/${index}`, fileName: '', storageKey: '', contentType: 'image/jpeg', sizeBytes: 1000, sortIndex: index,
  variants: ['thumb', 'feed', 'detail'].map(purpose => ({ purpose, format: 'webp', contentType: 'image/webp', width: 640, height: 960, sizeBytes: 1000, sourceVersion: 'fixture', recipeVersion: 1, url: `/variant/${purpose}/${index}` })),
}));

function Fixture() {
  const [mounted, setMounted] = useState(true);
  return <main className="mx-auto max-w-xl space-y-4 p-5">
    <h1 className="text-xl font-bold">Photo delivery fixture</h1>
    <div className="flex flex-wrap gap-2">
      <button onClick={() => setMounted(value => !value)}>{mounted ? 'Unmount' : 'Mount'}</button>
      <button onClick={invalidateProtectedPhotos}>New session</button>
      <button onClick={() => { denied = true; invalidateProtectedPhotos(); }}>Deny access</button>
      <button onClick={() => { denied = true; }}>Deny next request</button>
      <button onClick={() => { denied = false; invalidateProtectedPhotos(); }}>Allow access</button>
    </div>
    {mounted && <CheckInPhotos photos={photos} shopName="Fixture Coffee" />}
    <pre id="requests" aria-label="Photo requests" className="whitespace-pre-wrap text-xs" />
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
