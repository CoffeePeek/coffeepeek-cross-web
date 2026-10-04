import { Input } from '@/src/components/ui/Input';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideImportCandidate,
  getImportCandidate,
  getImportCandidates,
  ImportCandidatesPage,
  patchImportCandidate,
  attachImportCandidateMenuPhotos,
  parseImportCandidateMenu,
  updateImportCandidateMenu,
} from '../api/import';
import { getShopTags } from '../api/catalogs';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/Dialog';
import { DossierMap } from '../components/import/DossierMap';
import { DossierQueue } from '../components/import/DossierQueue';
import { MenuEditor } from '../components/menu/MenuEditor';
import LogoMark from '../components/LogoMark';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  CATALOG_TAG_OPTIONS,
  COFFEE_FOCUS_OPTIONS,
  CoffeeFocus,
  IMPORT_SOURCE_LABELS,
  IMPORT_QUEUE_PAGE_SIZE,
  QUEUE_STATUS_LABELS,
  REJECT_REASON_LABELS,
  REJECT_REASON_OPTIONS,
  RejectReason,
  catalogTagLabel,
  displayShopName,
  instagramHandleFrom,
  isClosedPermanently,
  isUsableShopName,
  normalizeInstagramUrl,
  parseImportSource,
} from '../constants/catalogIngest';
import {
  displayFacts,
  dossierSoftWarning,
  parseWorkspacePanel,
  safeHttpUrl,
  suggestedFocusFromSignals,
} from '../utils/importDossier';
import { formatImportOpeningHours } from '../utils/importOpeningHours';
import { ImportInboxPage } from './ImportInboxPage';
import { ImportStatsPage } from './ImportStatsPage';

type DecideStatus = 'Published' | 'Rejected' | 'Skipped';
interface DecideVars {
  /** Captured at mutate time — the dossier on screen may change while the request is in flight. */
  candidateId: string;
  page: number;
  status: DecideStatus;
  coffeeFocus?: CoffeeFocus;
  tagSlugs: string[];
  overrideClosed?: boolean;
  rejectReason?: RejectReason;
}

/** Enter on these must keep its native meaning (activate button / follow link). */
const NATIVE_ENTER_TARGETS = 'button, a[href], [role="button"], [role="link"], summary';
/** Keys pressed inside these never reach the dossier shortcuts. */
const SHORTCUT_BLOCKED_TARGETS =
  '[contenteditable]:not([contenteditable="false"]), [role="dialog"], [aria-modal="true"]';

const pillOff =
  'inline-flex items-center rounded-full px-2.5 py-[5px] text-[13px] font-medium font-body border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark text-text-main dark:text-white hover:border-text-muted dark:hover:border-stone-500 transition-colors';
const pillOn =
  'inline-flex items-center rounded-full px-2.5 py-[5px] text-[13px] font-medium font-body border border-text-main bg-text-main text-white dark:border-white dark:bg-white dark:text-black';

export const ImportQueuePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const panel = parseWorkspacePanel(searchParams.get('panel'));
  const queuePage = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const [queueOpen, setQueueOpen] = useState(false);
  const [focus, setFocus] = useState<CoffeeFocus | undefined>();
  const [tagSlugs, setTagSlugs] = useState<string[]>([]);
  const [instagramDraft, setInstagramDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [websiteDraft, setWebsiteDraft] = useState('');
  const [igPaste, setIgPaste] = useState('');
  const [patchAvailable, setPatchAvailable] = useState<boolean | null>(null);
  const [confirmPublishClosed, setConfirmPublishClosed] = useState(false);
  const [rejectPickerOpen, setRejectPickerOpen] = useState(false);
  /** True between a successful decision and landing on the next dossier. */
  const [advancing, setAdvancing] = useState(false);
  const idRef = useRef(id);
  idRef.current = id;

  const queueQuery = useQuery({
    queryKey: ['admin', 'import', 'queue', queuePage],
    queryFn: () =>
      getImportCandidates({
        status: 'Pending',
        page: queuePage,
        pageSize: IMPORT_QUEUE_PAGE_SIZE,
      }).then((r) => r.data),
  });

  const candidateQuery = useQuery({
    queryKey: ['admin', 'import', 'candidate', id],
    queryFn: () => getImportCandidate(id!).then((r) => r.data),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.menu?.parseStatus;
      return status === 'Pending' || status === 'Running' ? 2500 : false;
    },
  });

  const tagsQuery = useQuery({
    queryKey: ['catalogs', 'shop-tags'],
    queryFn: () => getShopTags().then((r) => r.data ?? []),
  });

  const tagOptions = useMemo(() => {
    const fromApi = (tagsQuery.data ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'))
      .map((tag) => ({ slug: tag.slug, label: catalogTagLabel(tag.slug, tag.name) }));
    return fromApi.length > 0 ? fromApi : CATALOG_TAG_OPTIONS;
  }, [tagsQuery.data]);
  const queueItems = queueQuery.data?.items ?? [];
  const candidateFromQueue = queueItems.find((item) => item.id === id);
  const candidate = candidateQuery.data ?? candidateFromQueue;
  const totalCount = queueQuery.data?.totalCount ?? 0;
  const totalPages = queueQuery.data?.totalPages ?? 1;
  const currentIndex = queueItems.findIndex((item) => item.id === id);

  const instagram = instagramDraft || candidate?.instagram || '';
  const phone = phoneDraft || candidate?.phone || '';
  const website = websiteDraft || candidate?.website || '';
  const igHandle = instagramHandleFrom(instagram);

  useEffect(() => {
    if (!candidate) return;
    setFocus(candidate.coffeeFocus ?? suggestedFocusFromSignals(candidate));
    setTagSlugs(candidate.tagSlugs);
    setInstagramDraft('');
    setPhoneDraft('');
    setWebsiteDraft('');
    setIgPaste('');
    setRejectPickerOpen(false);
  }, [candidate?.id]);

  const decided = candidate && candidate.queueStatus !== 'Pending' && candidate.queueStatus !== 'Skipped';
  const closed = isClosedPermanently(candidate?.googleBusinessStatus);
  const needsOverride = Boolean(closed || candidate?.suggestReject);
  const canPublish = Boolean(focus) && isUsableShopName(candidate?.name);

  const setPanel = (nextPanel: typeof panel) => {
    const next = new URLSearchParams(searchParams);
    next.set('panel', nextPanel);
    if (id) navigate(`/import/${id}?${next.toString()}`, { replace: true });
    else setSearchParams(next, { replace: true });
    setQueueOpen(false);
  };

  const setQueuePage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next, { replace: true });
  };

  const goToCandidate = (nextId: string, page = queuePage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    navigate(`/import/${nextId}?${next.toString()}`, { replace: true });
    setQueueOpen(false);
  };

  useEffect(() => {
    if (id || panel !== 'map' || queueQuery.isLoading) return;
    const first = queueItems[0];
    if (first) goToCandidate(first.id);
  }, [id, panel, queueItems, queueQuery.isLoading]);

  /**
   * Everything about the decided item comes from the snapshot taken at mutate time
   * (`remaining` = that page minus the item, `index` = its position there).
   */
  const afterDecide = async (
    decidedId: string,
    page: number,
    remaining: ImportCandidatesPage['items'],
    index: number,
    pages: number
  ) => {
    const nextSamePage = (index >= 0 ? remaining[index] : undefined) ?? remaining[0];
    if (nextSamePage) {
      goToCandidate(nextSamePage.id, page);
      return;
    }
    if (page < pages) {
      let nextPage;
      try {
        nextPage = await getImportCandidates({
          status: 'Pending',
          page: page + 1,
          pageSize: IMPORT_QUEUE_PAGE_SIZE,
        });
      } catch (err) {
        showToast(
          (err as { message?: string })?.message ?? 'Не удалось загрузить следующую страницу очереди',
          'error'
        );
        return;
      }
      // The admin may have opened another dossier while we were fetching — don't yank them away.
      if (idRef.current !== decidedId) return;
      const first = nextPage.data.items.find((item) => item.id !== decidedId) ?? nextPage.data.items[0];
      if (first) {
        goToCandidate(first.id, page + 1);
        return;
      }
    }
    const next = new URLSearchParams(searchParams);
    next.set('panel', panel === 'stats' ? 'stats' : 'list');
    navigate(`/import?${next.toString()}`, { replace: true });
  };

  const decideMutation = useMutation({
    mutationFn: ({ candidateId, status, coffeeFocus, tagSlugs: slugs, overrideClosed, rejectReason }: DecideVars) =>
      decideImportCandidate(candidateId, {
        status,
        coffeeFocus: status === 'Published' ? coffeeFocus : undefined,
        tagSlugs: status === 'Published' ? slugs : undefined,
        overrideClosed: status === 'Published' ? overrideClosed : undefined,
        rejectReason: status === 'Rejected' ? rejectReason : undefined,
      }),
    onMutate: async ({ candidateId, page }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'import', 'queue'] });
      const key = ['admin', 'import', 'queue', page] as const;
      const previous = qc.getQueryData<ImportCandidatesPage>(key);
      const index = previous?.items.findIndex((item) => item.id === candidateId) ?? -1;
      const remaining = previous?.items.filter((item) => item.id !== candidateId) ?? [];
      qc.setQueryData(key, (old: ImportCandidatesPage | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((item) => item.id !== candidateId),
          totalCount: Math.max(0, old.totalCount - 1),
        };
      });
      return { previous, index, remaining, totalPages: previous?.totalPages ?? 1 };
    },
    onSuccess: async (_, { candidateId, page, status, rejectReason }, ctx) => {
      const messages = {
        Published: 'В ленте',
        Rejected: rejectReason
          ? `Не в ленту · ${REJECT_REASON_LABELS[rejectReason]}`
          : 'Не в ленту',
        Skipped: 'Отложено',
      };
      showToast(messages[status], 'success');
      setRejectPickerOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'import'] });
      // Only advance if the decided dossier is still the one on screen.
      if (idRef.current !== candidateId) return;
      setAdvancing(true);
      try {
        await afterDecide(candidateId, page, ctx?.remaining ?? [], ctx?.index ?? -1, ctx?.totalPages ?? 1);
      } finally {
        setAdvancing(false);
      }
    },
    onError: (err: { message?: string }, { page }, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['admin', 'import', 'queue', page], ctx.previous);
      }
      showToast(err?.message ?? 'Ошибка решения', 'error');
    },
  });

  const busy = decideMutation.isPending || advancing;

  const decide = (vars: Pick<DecideVars, 'status' | 'overrideClosed' | 'rejectReason'>) => {
    if (!id || busy) return;
    decideMutation.mutate({
      ...vars,
      candidateId: id,
      page: queuePage,
      coffeeFocus: focus,
      tagSlugs,
    });
  };

  const tryPatchContacts = async (fields: {
    instagram?: string;
    phone?: string;
    website?: string;
  }): Promise<'saved' | 'missing' | 'error'> => {
    if (!id) return 'error';
    if (patchAvailable === false) {
      showToast('Сохранение контактов недоступно', 'error');
      return 'missing';
    }
    try {
      const result = await patchImportCandidate(id, fields);
      if (result.patchMissing) {
        setPatchAvailable(false);
        showToast('Сохранение контактов недоступно', 'error');
        return 'missing';
      }
      setPatchAvailable(true);
      if (result.data) qc.setQueryData(['admin', 'import', 'candidate', id], result.data);
      return 'saved';
    } catch (err) {
      showToast((err as { message?: string })?.message ?? 'Не удалось сохранить контакты', 'error');
      return 'error';
    }
  };

  const applyInstagram = async () => {
    const normalized = normalizeInstagramUrl(igPaste);
    if (!normalized) {
      showToast('Вставь instagram.com/… или @handle', 'error');
      return;
    }
    const result = await tryPatchContacts({ instagram: normalized });
    if (result === 'saved') {
      setInstagramDraft(normalized);
      setIgPaste('');
      showToast('Instagram сохранён', 'success');
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!id || busy || decided || confirmPublishClosed || panel === 'stats') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.isContentEditable || target?.closest?.(SHORTCUT_BLOCKED_TARGETS)) return;
      if (event.key === 'Enter' && target?.closest?.(NATIVE_ENTER_TARGETS)) return;

      if (rejectPickerOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setRejectPickerOpen(false);
          return;
        }
        const reason = REJECT_REASON_OPTIONS.find((opt) => opt.key === event.key)?.value;
        if (reason) {
          event.preventDefault();
          decide({ status: 'Rejected', rejectReason: reason });
        }
        return;
      }

      if (event.key === '1') setFocus('specialty');
      if (event.key === '2') setFocus('coffee_bar');
      if (event.key === '3') setFocus('cafe');
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        decide({ status: 'Skipped' });
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        setRejectPickerOpen(true);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!canPublish) return;
        if (needsOverride) setConfirmPublishClosed(true);
        else decide({ status: 'Published' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title = candidate ? displayShopName(candidate.name, candidate.brand) : '';
  const source = parseImportSource(candidate?.source);
  const facts = candidate ? displayFacts(candidate) : [];
  const softWarning = candidate ? dossierSoftWarning(candidate) : undefined;
  const queuePosition = currentIndex >= 0 ? (queuePage - 1) * IMPORT_QUEUE_PAGE_SIZE + currentIndex + 1 : '—';

  const PANEL_TABS = [
    { id: 'map' as const, label: 'Карта' },
    { id: 'list' as const, label: 'Список' },
    { id: 'stats' as const, label: 'Статистика' },
  ];

  const showCard = Boolean(candidate) && panel !== 'stats';
  const showMapQueue = panel === 'map';

  const queuePanel = (
    <DossierQueue
      items={queueItems}
      activeId={id}
      page={queuePage}
      totalPages={totalPages}
      totalCount={totalCount}
      loading={queueQuery.isLoading}
      onSelect={(nextId) => !busy && goToCandidate(nextId)}
      onPageChange={setQueuePage}
    />
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-background-light dark:bg-background-dark">
      <header className="shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 min-h-11 py-2 border-b border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
        {showMapQueue && !isDesktop && (
          <button
            type="button"
            onClick={() => setQueueOpen(true)}
            className="px-2.5 py-1.5 rounded-full text-xs font-medium border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-white/5"
          >
            Очередь
          </button>
        )}
        <LogoMark size={22} className="hidden sm:inline-flex shrink-0" />
        <span className="hidden sm:inline text-sm font-semibold font-display text-text-main dark:text-white">
          Импорт данных
        </span>
        <div className="flex items-center gap-0.5 rounded-full bg-background-light dark:bg-white/5 border border-border-light dark:border-border-dark p-1">
          {PANEL_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPanel(item.id)}
              className={[
                'px-3 py-1.5 rounded-full text-[13px] font-semibold transition-colors font-body',
                panel === item.id
                  ? 'bg-text-main text-white dark:bg-white dark:text-black'
                  : 'text-text-muted hover:text-text-main dark:text-stone-400 dark:hover:text-white',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {candidate && panel !== 'stats' && (
          <>
            <span className="text-sm text-text-muted tabular-nums hidden sm:inline">
              {queuePosition} / {totalCount} в очереди
            </span>
            <span className="text-sm text-text-muted tabular-nums sm:hidden">
              {queuePosition}/{totalCount}
            </span>
            {source && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-background-light dark:bg-white/10 text-text-muted font-medium">
                {IMPORT_SOURCE_LABELS[source]}
              </span>
            )}
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary text-black font-semibold">
              {QUEUE_STATUS_LABELS[candidate.queueStatus]}
            </span>
          </>
        )}
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {showMapQueue && isDesktop && <div className="w-[248px] shrink-0 min-h-0">{queuePanel}</div>}

        <div className="relative flex flex-col min-h-[280px] lg:min-h-0 flex-1 min-w-0">
          {panel === 'map' && <DossierMap candidate={candidate} />}
          {panel === 'list' && (
            <div className="flex-1 min-h-0">
              <ImportInboxPage selectedId={id} />
            </div>
          )}
          {panel === 'stats' && (
            <div className="flex-1 min-h-0">
              <ImportStatsPage embedded />
            </div>
          )}
        </div>

        {showCard && candidate && (
        <section className="w-full lg:w-[420px] shrink-0 flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
          <div className="flex-1 overflow-y-auto px-[18px] pt-[18px] pb-3 space-y-4 font-body">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-semibold mb-1.5">
                кандидат{source ? ` · ${IMPORT_SOURCE_LABELS[source]}` : ''}
              </p>
              <h1 className="text-[24px] font-bold font-display text-text-main dark:text-white leading-[1.15] tracking-tight">
                {title}
              </h1>
              {candidate.address && (
                <p className="text-sm text-text-muted mt-1.5">{candidate.address}</p>
              )}
              {candidate.openingHours && (
                <p className="text-sm mt-2.5 whitespace-pre-line">
                  {formatImportOpeningHours(candidate.openingHours)}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {facts.map((fact) => (
                  <span
                    key={fact}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-background-light dark:bg-white/5 border border-border-light dark:border-border-dark"
                  >
                    {fact}
                  </span>
                ))}
              </div>
              {softWarning && (
                <p className="mt-3 text-sm text-text-main dark:text-amber-100 bg-primary-light dark:bg-primary/10 border border-primary/30 rounded-[10px] px-3 py-2">
                  {softWarning}
                </p>
              )}
              {(needsOverride || closed) && (
                <p className="mt-3 text-sm text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[10px] px-3 py-2">
                  {closed
                    ? 'Google: закрыто навсегда. Для публикации нужно явное подтверждение.'
                    : 'Бэкенд предлагает отклонить. Для публикации нужно подтверждение.'}
                </p>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-2">Instagram</h2>
              {igHandle ? (
                <div className="rounded-[10px] border border-border-light dark:border-border-dark overflow-hidden">
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="w-9 h-9 rounded-full p-[2px] bg-[conic-gradient(#f9ce34,#ee2a7b,#6228d7,#f9ce34)] shrink-0">
                      <span className="block w-full h-full rounded-full bg-gold-warm-soft dark:bg-surface-dark" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">@{igHandle}</p>
                    </div>
                    <a
                      href={normalizeInstagramUrl(instagram)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-3 py-1.5 rounded-[10px] text-[13px] font-medium border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-white/5"
                    >
                      Открыть
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-[10px] border border-dashed border-border-light dark:border-border-dark bg-background-light dark:bg-white/5 p-3 space-y-2">
                  <div className="flex gap-1.5">
                    <Input
                      aria-label="Instagram"
                      value={igPaste}
                      onChange={(e) => setIgPaste(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void applyInstagram();
                        }
                      }}
                      placeholder="instagram.com/…"
                      className="flex-1"
                    />
                    <Button variant="secondary" size="sm" onClick={() => void applyInstagram()}>
                      Сохранить
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-2">Контакты</h2>
              <div className="grid gap-1.5">
                {candidate.phone ? (
                  <p className="text-sm">{phone}</p>
                ) : (
                  <Input
                    aria-label="Телефон"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    onBlur={() => phoneDraft.trim() && void tryPatchContacts({ phone: phoneDraft.trim() })}
                    placeholder="Телефон"
                  />
                )}
                {candidate.website ? (
                  <a
                    href={safeHttpUrl(website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary break-all"
                  >
                    {website}
                  </a>
                ) : (
                  <Input
                    aria-label="Сайт"
                    value={websiteDraft}
                    onChange={(e) => setWebsiteDraft(e.target.value)}
                    onBlur={() => websiteDraft.trim() && void tryPatchContacts({ website: websiteDraft.trim() })}
                    placeholder="Сайт"
                  />
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-2">Фокус</h2>
              <div className="flex flex-wrap gap-1.5">
                {COFFEE_FOCUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={Boolean(decided)}
                    onClick={() => {
                      setFocus(option.value);
                    }}
                    className={focus === option.value ? pillOn : pillOff}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {!focus && (
                <p className="text-[11px] text-red-600 mt-2">Для публикации нужен фокус</p>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-2">Теги в каталог</h2>
              <div className="flex flex-wrap gap-1.5">
                {tagOptions.map((tag) => {
                  const active = tagSlugs.includes(tag.slug);
                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      disabled={Boolean(decided)}
                      onClick={() =>
                        setTagSlugs((current) =>
                          active ? current.filter((slug) => slug !== tag.slug) : [...current, tag.slug]
                        )
                      }
                      className={active ? pillOn : pillOff}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {id && (
              <MenuEditor
                compact
                menu={candidate.menu ?? null}
                onAttach={async (photos) => {
                  await attachImportCandidateMenuPhotos(id, { photos });
                  await qc.invalidateQueries({ queryKey: ['admin', 'import', 'candidate', id] });
                }}
                onParse={async () => {
                  await parseImportCandidateMenu(id);
                  await qc.invalidateQueries({ queryKey: ['admin', 'import', 'candidate', id] });
                }}
                onSave={async (body) => {
                  await updateImportCandidateMenu(id, body);
                  await qc.invalidateQueries({ queryKey: ['admin', 'import', 'candidate', id] });
                }}
              />
            )}

          </div>

          <div className="shrink-0 p-3 pb-4 border-t border-border-light dark:border-border-dark bg-white dark:bg-surface-dark grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              disabled={!canPublish || Boolean(decided)}
              loading={busy}
              onClick={() =>
                needsOverride
                  ? setConfirmPublishClosed(true)
                  : decide({ status: 'Published' })
              }
              className="min-h-[48px] rounded-[10px] text-sm"
            >
              В ленту
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(decided)}
              loading={busy}
              onClick={() => decide({ status: 'Skipped' })}
              className="min-h-[48px] rounded-[10px] text-sm"
            >
              Пропуск
            </Button>
            <button
              type="button"
              disabled={Boolean(decided) || busy}
              onClick={() => setRejectPickerOpen(true)}
              className="col-span-2 min-h-[40px] rounded-[10px] text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50"
            >
              Отклонить
            </button>
          </div>
        </section>
        )}
      </div>

      {showMapQueue && !isDesktop && queueOpen && (
        <div className="fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Закрыть очередь"
            className="absolute inset-0 bg-black/50"
            onClick={() => setQueueOpen(false)}
          />
          <div className="relative w-[260px] max-w-[80vw] h-full bg-white dark:bg-surface-dark shadow-xl">
            {queuePanel}
          </div>
        </div>
      )}

      {rejectPickerOpen && (
        <Dialog open onOpenChange={(open) => !open && setRejectPickerOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Почему не в ленту?</DialogTitle>
            <DialogDescription>Выберите причину. Без причины отклонить нельзя.</DialogDescription>
            <div className="flex flex-col gap-2">
              {REJECT_REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={busy}
                  onClick={() => decide({ status: 'Rejected', rejectReason: opt.value })}
                  className={[
                    'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-3 text-left min-h-[56px] transition-colors',
                    closed && opt.value === 'closed'
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-border-light dark:border-border-dark hover:border-primary/60',
                  ].join(' ')}
                >
                  <span className="text-sm font-semibold font-display">
                    {opt.key}. {opt.label}
                  </span>
                  <span className="text-xs text-text-muted">{opt.hint}</span>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full min-h-[44px]"
              onClick={() => setRejectPickerOpen(false)}
              disabled={busy}
            >
              Отмена
            </Button>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        isOpen={confirmPublishClosed}
        title="Нужно подтверждение"
        message="Google считает место закрытым или бэкенд предлагает отклонить. Опубликовать всё равно?"
        confirmLabel="Всё равно в ленту"
        variant="danger"
        onCancel={() => setConfirmPublishClosed(false)}
        onConfirm={() => {
          setConfirmPublishClosed(false);
          decide({ status: 'Published', overrideClosed: true });
        }}
      />
    </div>
  );
};
