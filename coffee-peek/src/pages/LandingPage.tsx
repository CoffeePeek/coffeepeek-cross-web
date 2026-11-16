import React, { Suspense, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { searchCoffees, getCoffeeFilterValues } from '../api/discovery';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { brand, card, dark, light, getThemeColors, shadow } from '../design-system';
import { getCatalogScope } from '../lib/catalogSession';
import { usePageTitle } from '../hooks/usePageTitle';
import minsk from '../constants/minskCatalog.json';
import { useLocalCity } from '../hooks/useLocalCity';
import { usePublicCheckIns } from '../hooks/queries/useCheckIns';
import { useNearViewport } from '../hooks/useNearViewport';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { APP_DOWNLOAD_URL } from '../utils/appDownload';
import { AppIcon } from '../components/icons';
import Button from '../components/Button';
import ShopCardSkeleton from '../components/skeletons/ShopCardSkeleton';
import CheckInCardSkeleton from '../components/skeletons/CheckInCardSkeleton';
import { MobileAppDownload } from '../components/mobile-app';
import Header from '../components/Header';
import Mascot from '../components/Mascot';
import './LandingPage.css';

const appScreenshots = ['shops', 'map', 'feed'] as const;
const LandingMapWidget = lazyWithRetry(() => import('../components/LandingMapWidget'));
const CoffeeCatalogCard = lazyWithRetry(() => import('../components/CatalogCards').then(module => ({ default: module.CoffeeCatalogCard })));
const CheckInCard = lazyWithRetry(() => import('../components/CheckInCard'));

const questions = [
  { title: 'Что такое CoffeePeek?', answer: 'Кофейный гид с картой кофеен, каталогом кофе и обжарщиков и чекинами посетителей.' },
  { title: 'Можно пользоваться без регистрации?', answer: 'Да. Кофейни, карта, каталог кофе и публичная лента доступны без аккаунта. Войди, чтобы сохранять любимые места и оставлять чекины.' },
  { title: 'Как добавить кофейню?', answer: 'Войди в аккаунт и выбери «Добавить кофейню». Заполни информацию о месте и отправь её на модерацию.' },
  { title: 'Как оставить чекин?', answer: 'Открой страницу кофейни и отметь свой визит: выбери напиток, поставь оценку и поделись впечатлениями. Для этого понадобится аккаунт.' },
];

const LandingPage: React.FC = () => {
  const { city } = useLocalCity();
  usePageTitle(`Кофейни, карта и отзывы · ${city.name}`, {
    description: `Кофейни на карте · ${city.name}. Адреса, часы работы, меню и отзывы посетителей на CoffeePeek.`,
  });
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isLoading: authLoading } = useUser();
  const c = getThemeColors(theme);
  const scope = getCatalogScope();
  const mapSection = useNearViewport<HTMLDivElement>('150px');
  const coffeeSection = useNearViewport<HTMLDivElement>('300px');
  const communitySection = useNearViewport<HTMLDivElement>('300px');
  const downloadDialog = useRef<HTMLDialogElement>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const openDownloads = () => downloadDialog.current?.showModal();
  const copyDownloadLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_DOWNLOAD_URL);
      setCopyStatus('Ссылка скопирована');
    } catch {
      setCopyStatus('Не удалось скопировать. Выдели ссылку ниже и скопируй её вручную.');
    }
  };
  const coffees = useQuery({
    queryKey: ['catalog', scope, 'landing', 'coffees'],
    queryFn: ({ signal }) => searchCoffees({ q: '', filters: {}, sort: 'name_asc', page: 1, pageSize: 2 }, signal),
    enabled: coffeeSection.nearViewport && !authLoading,
  });
  const dictionary = useQuery({
    queryKey: ['catalogs', 'coffee-filter-values'],
    queryFn: ({ signal }) => getCoffeeFilterValues(signal),
    enabled: coffeeSection.nearViewport,
  });
  const checkIns = usePublicCheckIns({ citySlug: city.id, pageSize: 1 }, communitySection.nearViewport);
  const latestCheckIn = checkIns.data?.pages[0]?.items[0];

  return (
    <div className="landing-page min-h-screen" style={{
      background: c.background, color: c.textPrimary,
      '--landing-border': c.border, '--landing-muted': c.textSecondary,
      '--landing-accent': brand.primary, '--landing-radius': `${card.borderRadius}px`,
      '--landing-shadow': shadow.card,
      '--landing-overlay': c.overlay,
      '--landing-device': dark.background,
    } as React.CSSProperties}>
      <Header />
      <main id="main-content">
        <section className="landing-container landing-hero" aria-labelledby="landing-title">
          <div className="min-w-0">
            <p className="landing-eyebrow">Кофейный гид · {city.name}</p>
            <h1 id="landing-title" className="landing-title mt-6 font-extended font-black">
              Хороший кофе.<br /><span className="landing-accent">В твоём городе.</span>
            </h1>
            <p className="landing-description mt-6 max-w-[520px]">
              Находи кофейни, выбирай зерно и делись впечатлениями. Всё о кофе в одном городе.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => navigate('/map')} className="min-h-[52px] rounded-[14px] px-6 text-[15px]">
                Найти кофейню <AppIcon name="arrow_forward" size={18} />
              </Button>
              <Button variant="secondary" onClick={openDownloads} className="min-h-[52px] rounded-[14px] px-6 text-[15px]">
                Скачать приложение
              </Button>
            </div>
            <p className="mt-5 text-sm leading-relaxed" style={{ color: c.textSecondary }}>Карта, чекины и любимые места — всегда под рукой.</p>
          </div>
          <div className="landing-preview" aria-hidden="true" inert>
            {appScreenshots.map(screen => <div key={screen} className={`landing-preview-screen landing-preview-${screen}`}>
              <img src={`/images/app-screenshots/${screen}-${theme}.webp`} alt="" width={480} height={1041}
                loading={screen === 'map' ? undefined : 'lazy'} fetchPriority={screen === 'map' ? undefined : 'low'}
                decoding="async" className="landing-app-screenshot" />
            </div>)}
          </div>
        </section>

        <section className="landing-container landing-feature border-t" style={{ borderColor: c.border }} aria-labelledby="shops-title">
          <div>
            <p className="landing-eyebrow">Карта кофеен · {city.name}</p>
            <h2 id="shops-title" className="landing-heading mt-5 font-extended font-bold">
              Твоя следующая чашка — где-то <span className="landing-accent">рядом.</span>
            </h2>
            <p className="landing-description mt-5">Сравнивай оценки кофеен и находи места, куда хочется вернуться.</p>
            <ul className="my-6 space-y-3 text-sm sm:text-base">
              {['Карта и удобные фильтры', 'Часы работы и способы заваривания', 'Любимые места в избранном'].map(text => (
                <li key={text} className="flex items-start gap-3"><AppIcon name="check" size={20} color={brand.primary} className="shrink-0" /><span>{text}</span></li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link to="/map" className="landing-link">Исследовать карту <AppIcon name="arrow_forward" size={18} /></Link>
              {city.id === minsk.slug && <a href={minsk.path} className="landing-link">{minsk.heading}</a>}
            </div>
          </div>
          <div ref={mapSection.ref} className="min-w-0 overflow-hidden rounded-[28px] border" style={{ borderColor: c.border }}>
            <Suspense fallback={<div className="landing-map-placeholder" aria-hidden="true" />}>
              {mapSection.nearViewport ? <LandingMapWidget embed /> : <div className="landing-map-placeholder" aria-hidden="true" />}
            </Suspense>
          </div>
        </section>

        <section className="landing-section-border" style={{ borderColor: c.border }} aria-labelledby="coffee-title">
          <div className="landing-container landing-feature">
            <div className="lg:order-2">
              <p className="landing-eyebrow">Кофе и обжарщики</p>
              <h2 id="coffee-title" className="landing-heading mt-5 font-extended font-bold">
                Найди кофе <span className="landing-accent">по своему вкусу.</span>
              </h2>
              <p className="landing-description mt-5">Знакомься с обжарщиками и выбирай зерно по вкусовым нотам и способу приготовления.</p>
              <div className="my-6 flex flex-wrap gap-3">
                <Link to="/coffees" className="landing-link">Выбрать кофе <AppIcon name="arrow_forward" size={18} /></Link>
                <Link to="/roasters" className="landing-link">Обжарщики <AppIcon name="arrow_forward" size={18} /></Link>
              </div>
            </div>
            <div ref={coffeeSection.ref} className="min-w-0 lg:order-1">
              <Suspense fallback={<div className="landing-coffees"><ShopCardSkeleton count={2} variant="coffee" /></div>}>
                {!coffeeSection.nearViewport || coffees.isPending ? <div className="landing-coffees"><ShopCardSkeleton count={2} variant="coffee" /></div>
                  : coffees.isError ? <div className="landing-empty" role="status"><p>Не удалось загрузить кофе.</p><Button variant="secondary" onClick={() => void coffees.refetch()}>Попробовать ещё раз</Button></div>
                  : coffees.data?.items.length ? <div className="landing-coffees">{coffees.data.items.map(coffee => <CoffeeCatalogCard key={coffee.address.slug} coffee={coffee} groups={dictionary.data ?? []} />)}</div>
                  : <div className="landing-empty"><Mascot pose="bean" size={160} /><p>В каталоге пока нет кофе.</p></div>}
              </Suspense>
            </div>
          </div>
        </section>

        <section className="landing-container landing-feature" aria-labelledby="community-title">
          <div>
            <p className="landing-eyebrow">Чекины · {city.name}</p>
            <h2 id="community-title" className="landing-heading mt-5 font-extended font-bold">
              У каждой чашки <span className="landing-accent">своя история.</span>
            </h2>
            <p className="landing-description mt-5">Отмечай визиты, сохраняй впечатления и смотри, что пробуют другие любители кофе.</p>
            <Link to="/feed" className="landing-link mt-6">Открыть ленту <AppIcon name="arrow_forward" size={18} /></Link>
          </div>
          <div ref={communitySection.ref} className="min-w-0">
            <Suspense fallback={<CheckInCardSkeleton count={1} />}>
              {!communitySection.nearViewport || checkIns.isPending ? <CheckInCardSkeleton count={1} />
                : checkIns.isError ? <div className="landing-empty" role="status"><p>Не удалось загрузить чекины.</p><Button variant="secondary" onClick={() => void checkIns.refetch()}>Попробовать ещё раз</Button></div>
                : latestCheckIn ? <CheckInCard item={latestCheckIn} />
                : <div className="landing-empty"><Mascot pose="cup" size={160} /><p>Поделись первым впечатлением о местных кофейнях.</p></div>}
            </Suspense>
          </div>
        </section>

        <section className="landing-section-border" style={{ borderColor: c.border }} aria-labelledby="questions-title">
          <div className="landing-container py-12 lg:py-20">
            <p className="landing-eyebrow">Вопросы и ответы</p>
            <h2 id="questions-title" className="landing-heading mt-5 font-extended font-bold">Всё, что нужно знать.</h2>
            <div className="mt-8 space-y-3">
              {questions.map(question => <details key={question.title} className="landing-question rounded-xl border" style={{ borderColor: c.border }}>
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 py-4 font-semibold">
                  {question.title}<AppIcon name="add" size={20} className="landing-question-icon shrink-0" />
                </summary>
                <p className="max-w-3xl px-5 pb-5 text-sm leading-relaxed sm:text-base" style={{ color: c.textSecondary }}>{question.answer}</p>
              </details>)}
            </div>
          </div>
        </section>

        <section id="application" className="landing-container scroll-mt-24 pb-12 lg:pb-20" aria-labelledby="application-title">
          <div className="landing-cta rounded-[28px] border px-6 py-12 sm:px-8 lg:py-20" style={{ background: dark.background, color: dark.textPrimary, borderColor: dark.border }}>
            <h2 id="application-title" className="landing-download-title font-extended font-extrabold">Любимые кофейни.<br /><span className="landing-accent">Всегда под рукой.</span></h2>
            <p className="mt-5 max-w-3xl text-base leading-relaxed" style={{ color: dark.textSecondary }}>Находи кофейни, выбирай зерно и сохраняй впечатления в CoffeePeek.</p>
            <MobileAppDownload variant="inline" className="mt-8" />
            <p className="mt-6 text-sm" style={{ color: dark.textSecondary }}>Карта, кофе и сообщество — в одном приложении.</p>
          </div>
        </section>
      </main>

      <dialog ref={downloadDialog} className="landing-download-dialog" aria-labelledby="download-dialog-title" aria-describedby="download-dialog-description"
        style={{ background: c.card, color: c.textPrimary, borderColor: c.border }}
        onClose={() => setCopyStatus('')} onClick={event => { if (event.target === event.currentTarget) downloadDialog.current?.close(); }}>
        <div className="relative px-5 py-10 text-center sm:px-10 sm:py-12">
          <div className="absolute right-3 top-3"><Button variant="ghost" aria-label="Закрыть окно скачивания" className="h-11 w-11 rounded-full p-0" onClick={() => downloadDialog.current?.close()}><AppIcon name="close" size={20} /></Button></div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: c.textSecondary }}>Приложение CoffeePeek</p>
          <h2 id="download-dialog-title" className="landing-heading mt-5 font-extended font-bold">Сканируй,<br /><span className="landing-accent">чтобы скачать.</span></h2>
          <p id="download-dialog-description" className="mt-5 text-sm leading-relaxed" style={{ color: c.textSecondary }}>Наведи камеру телефона на QR-код и выбери удобный способ установки CoffeePeek.</p>
          <a href={APP_DOWNLOAD_URL} className="mx-auto my-7 block w-fit rounded-[24px] border p-4" style={{ background: light.surface, borderColor: c.border }} aria-label="QR-код: открыть способы установки CoffeePeek"><QRCodeSVG value={APP_DOWNLOAD_URL} size={192} /></a>
          <MobileAppDownload variant="inline" />
          <div className="mt-6 border-t pt-5" style={{ borderColor: c.border }}>
            <p className="mb-3 text-sm" style={{ color: c.textSecondary }}>Нет телефона под рукой?</p>
            <Button variant="secondary" className="mx-auto min-h-11" onClick={() => void copyDownloadLink()}><AppIcon name="content_copy" size={18} />Скопировать ссылку</Button>
            <p role="status" className="mt-3 text-sm">{copyStatus}</p>
            {copyStatus.startsWith('Не удалось') && <input aria-label="Ссылка на скачивание" readOnly value={APP_DOWNLOAD_URL} onFocus={event => event.currentTarget.select()} className="mt-2 w-full rounded-xl border p-3 text-sm" style={{ background: c.input, borderColor: c.border }} />}
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default LandingPage;
