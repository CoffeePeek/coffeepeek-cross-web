// Local acceptance fixture. Synthetic check-ins only; all network access is stubbed.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { httpClient } from '../src/api/core/httpClient';
import { UserProvider } from '../src/contexts/UserContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { ToastProvider } from '../src/contexts/ToastContext';
import PublicProfileCheckIns from '../src/components/profile/PublicProfileCheckIns';
import '../index.css';
import '../src/pages/UserProfilePage.css';

globalThis.fetch = async () => new Response(null, { status: 401 });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
let failNext = false;
let requests: string[] = [];
httpClient.get = async (endpoint, config) => {
  if (endpoint !== '/api/v1/check-ins') throw new Error('Unexpected fixture request');
  const offset = Number(config?.params?.cursor ?? 0);
  const slug = String(config?.params?.authorSlug);
  const fail = failNext;
  failNext = false;
  requests.push(`${slug}:${offset}${fail ? ':error' : ''}`);
  document.getElementById('requests')!.textContent = requests.join(', ');
  await new Promise(resolve => setTimeout(resolve, 300));
  if (fail) throw new Error('Synthetic failure');
  return { success: true, data: {
    items: Array.from({ length: Math.min(10, 23 - offset) }, (_, index) => ({
      id: `${slug}-${offset + index}`, username: slug, shopName: `Кофейня ${offset + index + 1}`,
      text: `Чекин ${offset + index + 1}. Проверяем подгрузку при прокрутке и сохранение предыдущих карточек.`,
      kind: 'Visit', author: null, shop: null, rating: null, photos: [],
      createdAtUtc: '2026-10-20T12:00:00Z', visibility: 'Private', moderationState: 'NotSubmitted', helpfulCount: 0,
    })),
    nextCursor: offset + 10 < 23 ? String(offset + 10) : null,
  } } as never;
};

function Fixture() {
  const [slug, setSlug] = useState('test-author');
  return <main className="public-profile" style={{ '--profile-bg': '#FAFAF9', '--profile-surface': '#fff', '--profile-border': '#ddd', '--profile-text': '#1c1917', '--profile-muted': '#78716c' } as React.CSSProperties}>
    <div className="sticky top-0 z-10 bg-white p-4">
      <h1>Проверка подгрузки профиля</h1>
      <button className="profile-pill" onClick={() => { failNext = true; }}>Ошибка следующей страницы</button>
      <button className="profile-pill" onClick={() => { requests = []; setSlug('another-author'); }}>Другой профиль</button>
      <output id="requests" aria-label="Запросы чекинов" className="block" />
    </div>
    <div className="profile-shell mx-auto p-8"><div className="profile-columns">
      <aside className="profile-overview">Профиль {slug}</aside>
      <PublicProfileCheckIns key={slug} slug={slug} />
    </div></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter><ThemeProvider><ToastProvider><UserProvider><Fixture /></UserProvider></ToastProvider></ThemeProvider></MemoryRouter></QueryClientProvider>);
