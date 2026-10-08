import { Input } from '@/src/components/ui/Input';
import { NativeSelect } from '@/src/components/ui/NativeSelect';
import { Textarea } from '@/src/components/ui/Textarea';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPublishedShopById } from '../api/admin';
import { getShopTags } from '../api/catalogs';
import { getPublishedShopMenu } from '../api/menu';
import {
  getShopChangeRequest,
  reviewShopChangeRequest,
  updateShopChangeRequest,
  type ShopChangePayloadDto,
  type ShopChangeRequestDto,
  type ShopChangeSection,
} from '../api/shopChangeRequests';
import { getUserPublicProfile } from '../api/users';
import { ChangeRequestPayloadView } from '../components/moderation/ChangeRequestPayloadView';
import { CatalogMultiSelect } from '../components/moderation/CatalogMultiSelect';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { useCatalogs } from '../hooks/useCatalogs';
import { sectionLabels } from './ShopChangeRequestsPage';

const SECTION_FIELD = {
  Photos: 'photos',
  Contacts: 'contacts',
  Description: 'description',
  Tags: 'tagIds',
  Roasters: 'roasterIds',
  Equipment: 'equipmentIds',
  Menu: 'menu',
  BrewMethods: 'brewMethodIds',
} as const satisfies Record<ShopChangeSection, keyof ShopChangePayloadDto>;

const sections = Object.keys(SECTION_FIELD) as ShopChangeSection[];

type IdSection = 'Tags' | 'Roasters' | 'Equipment' | 'BrewMethods';
const isIdSection = (section: ShopChangeSection): section is IdSection =>
  section === 'Tags' || section === 'Roasters' || section === 'Equipment' || section === 'BrewMethods';

const EMPTY_CONTACTS = { phoneNumber: null, email: null, siteLink: null, instagramLink: null };
const CONTACT_FIELDS = [
  ['phoneNumber', 'Телефон'],
  ['email', 'Email'],
  ['siteLink', 'Сайт'],
  ['instagramLink', 'Instagram'],
] as const;

/** The backend rejects a payload that carries another section's field (e.g. after switching the section). */
function payloadForSection(section: ShopChangeSection, payload: ShopChangePayloadDto): ShopChangePayloadDto {
  const field = SECTION_FIELD[section];
  const fallback = isIdSection(section) ? [] : section === 'Description' ? '' : null;
  return { [field]: payload[field] ?? fallback };
}

function parsePayloadText(payload: string): ShopChangePayloadDto | null {
  try {
    const value = JSON.parse(payload);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as ShopChangePayloadDto;
  } catch {
    return null;
  }
}

export const ShopChangeRequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [request, setRequest] = useState<ShopChangeRequestDto | null>(null);
  const [section, setSection] = useState<ShopChangeSection>('Description');
  const [payload, setPayload] = useState('{}');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'save' | 'approve' | 'reject' | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    if (!id) return;
    // Ignore responses for a previous id (fast navigation between requests).
    let active = true;
    setLoading(true);
    setRequest(null);
    getShopChangeRequest(id)
      .then((response) => {
        if (!active) return;
        setRequest(response.data);
        setSection(response.data.section);
        setPayload(JSON.stringify(response.data.payload, null, 2));
      })
      .catch((error) => {
        if (active) showToast(error instanceof Error ? error.message : 'Не удалось загрузить заявку', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, showToast]);

  const parsedPayload = useMemo(() => parsePayloadText(payload), [payload]);
  const updatePayload = (patch: ShopChangePayloadDto) =>
    setPayload(JSON.stringify({ ...parsedPayload, ...patch }, null, 2));

  const { data: catalogs } = useCatalogs();
  const { data: tags = [] } = useQuery({
    queryKey: ['catalogs', 'shop-tags'],
    queryFn: () => getShopTags().then((r) => r.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
  const idEditors: Record<IdSection, { label: string; items: { id: string; name: string; subtitle?: string }[] }> = {
    Tags: { label: 'Теги', items: tags },
    Roasters: { label: 'Обжарщики', items: catalogs?.roasters ?? [] },
    Equipment: {
      label: 'Оборудование',
      items: (catalogs?.equipments ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        subtitle: [item.brand, item.model].filter(Boolean).join(' '),
      })),
    },
    BrewMethods: { label: 'Методы заваривания', items: catalogs?.brewMethods ?? [] },
  };

  const { data: shop } = useQuery({
    // Same key/queryFn as PublishedShopEditPage, so approval invalidation refreshes both.
    queryKey: ['admin', 'published-shop', request?.shopId],
    queryFn: () => getPublishedShopById(request!.shopId).then((r) => r.data),
    enabled: !!request?.shopId,
    retry: false,
  });

  const { data: user, isError: userError } = useQuery({
    queryKey: ['public-user-profile', request?.submittedByUserId],
    queryFn: () => getUserPublicProfile(request!.submittedByUserId).then((r) => r.data),
    enabled: !!request?.submittedByUserId,
    retry: false,
  });

  const { data: menuBundle } = useQuery({
    queryKey: ['admin', 'published-shop-menu', request?.shopId],
    queryFn: () => getPublishedShopMenu(request!.shopId).then((r) => r.data),
    enabled: !!request?.shopId && (section === 'Menu' || request?.section === 'Menu'),
    retry: false,
  });

  const parsePayload = (): ShopChangePayloadDto | null => {
    const value = parsePayloadText(payload);
    if (!value) {
      showToast('Данные заявки должны быть корректным JSON-объектом', 'error');
      return null;
    }
    return value;
  };

  const save = async () => {
    if (!id) return;
    const parsed = parsePayload();
    if (!parsed) return;
    setAction('save');
    try {
      const response = await updateShopChangeRequest(id, { section, payload: payloadForSection(section, parsed) });
      setRequest(response.data);
      setPayload(JSON.stringify(response.data.payload, null, 2));
      showToast('Заявка сохранена', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось сохранить заявку', 'error');
    } finally {
      setAction(null);
    }
  };

  const review = async (status: 'Approved' | 'Rejected') => {
    if (!id) return;
    const reason = comment.trim();
    if (status === 'Rejected' && !reason) {
      showToast('Укажите причину отклонения', 'error');
      return;
    }
    setAction(status === 'Approved' ? 'approve' : 'reject');
    try {
      if (status === 'Approved') {
        const parsed = parsePayload();
        if (!parsed) return;
        await updateShopChangeRequest(id, { section, payload: payloadForSection(section, parsed) });
      }
      await reviewShopChangeRequest(id, status, reason || null);
      if (request?.shopId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['admin', 'published-shop', request.shopId] }),
          qc.invalidateQueries({ queryKey: ['admin', 'published-shop-menu', request.shopId] }),
        ]);
      }
      qc.invalidateQueries({ queryKey: ['admin', 'published-shops'] });
      showToast(
        status === 'Approved' ? 'Изменение одобрено и применено' : 'Заявка отклонена',
        'success'
      );
      navigate('/shop-change-requests');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось обработать заявку', 'error');
    } finally {
      setAction(null);
    }
  };

  if (loading) return <p className="text-text-muted">Загрузка…</p>;
  if (!request) return <Card className="p-6">Заявка не найдена.</Card>;
  const pending = request.status === 'Pending';
  const shopThumb = shop?.photos?.[0]?.fullUrl;
  const userName = user?.nickname || user?.userName;

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/shop-change-requests" className="text-sm text-primary">
            ← К очереди
          </Link>
          <h1 className="mt-2 text-2xl font-bold font-display text-text-main dark:text-white">
            {sectionLabels[request.section]}
          </h1>
          <p className="mt-1 text-sm text-text-muted dark:text-stone-400">Заявка {request.id}</p>
        </div>
        <Badge variant={request.status.toLowerCase() as 'pending' | 'approved' | 'rejected'}>
          {({ Pending: 'На модерации', Approved: 'Одобрено', Rejected: 'Отклонено' } as Record<string, string>)[request.status] ?? request.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Кофейня</p>
          {shop ? (
            <div className="flex gap-3">
              {shopThumb ? (
                <img
                  src={shopThumb}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover border border-border-light dark:border-border-dark"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-xs text-text-muted dark:bg-white/10">
                  нет фото
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  to={`/published-shops/${shop.id}`}
                  className="font-semibold text-text-main hover:text-primary dark:text-white"
                >
                  {shop.name}
                </Link>
                <p className="mt-1 text-sm text-text-muted dark:text-stone-400 break-words">
                  {shop.location?.address || 'Адрес не указан'}
                </p>
                <p className="mt-1 text-[11px] font-mono text-text-muted/80">{shop.id}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-text-muted">Не удалось загрузить карточку кофейни</p>
              <p className="mt-1 font-mono text-xs break-all">{request.shopId}</p>
              <Link to={`/published-shops/${request.shopId}`} className="mt-2 inline-block text-sm text-primary">
                Открыть по ID →
              </Link>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Кто отправил
          </p>
          {user ? (
            <div className="flex gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-full object-cover border border-border-light dark:border-border-dark"
                />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-full bg-stone-100 dark:bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  to={`/users?search=${encodeURIComponent(user.userName || request.submittedByUserId)}`}
                  className="font-semibold text-text-main hover:text-primary dark:text-white"
                >
                  {userName}
                </Link>
                {user.nickname && (
                  <p className="text-xs text-text-muted dark:text-stone-400">@{user.userName}</p>
                )}
                <p className="mt-2 text-xs text-text-muted dark:text-stone-400">
                  Чекинов: {user.checkInCount ?? 0}
                </p>
                <p className="mt-1 text-[11px] font-mono text-text-muted/80">{request.submittedByUserId}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-text-muted">
                {userError ? 'Не удалось загрузить профиль' : 'Загрузка профиля…'}
              </p>
              <p className="mt-1 font-mono text-xs break-all">{request.submittedByUserId}</p>
              <Link
                to={`/users?search=${encodeURIComponent(request.submittedByUserId)}`}
                className="mt-2 inline-block text-sm text-primary"
              >
                Найти в пользователях →
              </Link>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Создано</dt>
            <dd>{new Date(request.createdAtUtc).toLocaleString('ru-RU')}</dd>
          </div>
          {request.reviewedAtUtc && (
            <div>
              <dt className="text-text-muted">Рассмотрено</dt>
              <dd>{new Date(request.reviewedAtUtc).toLocaleString('ru-RU')}</dd>
            </div>
          )}
        </dl>
        {request.rejectionReason && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            Причина: {request.rejectionReason}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text-main dark:text-white">Что меняется</h2>
            <button
              type="button"
              onClick={() => setShowRawJson((value) => !value)}
              className="text-sm text-primary"
            >
              {showRawJson ? 'Скрыть JSON' : 'Показать JSON'}
            </button>
          </div>

          {pending && (
            <label className="block text-sm font-semibold">
              Секция
              <NativeSelect
                value={section}
                onChange={(e) => setSection(e.target.value as ShopChangeSection)}
                className="mt-2"
              >
                {sections.map((item) => (
                  <option key={item} value={item}>
                    {sectionLabels[item]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}

          {parsedPayload ? (
            pending && isIdSection(section) ? (
              <CatalogMultiSelect
                label={idEditors[section].label}
                items={idEditors[section].items}
                selectedIds={parsedPayload[SECTION_FIELD[section]] ?? []}
                onChange={(ids) => updatePayload({ [SECTION_FIELD[section]]: ids })}
              />
            ) : (
              <ChangeRequestPayloadView
                section={section}
                payload={parsedPayload}
                shop={shop}
                currentMenu={menuBundle?.menu}
              />
            )
          ) : (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              JSON повреждён — исправьте в техническом редакторе ниже.
            </p>
          )}

          {pending && parsedPayload && section === 'Description' && (
            <label className="block text-sm font-semibold">
              Исправить описание
              <Textarea
                value={parsedPayload.description ?? ''}
                onChange={(e) => updatePayload({ description: e.target.value })}
                maxLength={1000}
                rows={6}
                className="mt-2"
              />
            </label>
          )}

          {pending && parsedPayload && section === 'Contacts' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTACT_FIELDS.map(([key, label]) => (
                <label key={key} className="block text-sm font-semibold">
                  {label}
                  <Input
                    value={parsedPayload.contacts?.[key] ?? ''}
                    onChange={(e) =>
                      updatePayload({
                        contacts: { ...EMPTY_CONTACTS, ...parsedPayload.contacts, [key]: e.target.value || null },
                      })
                    }
                    className="mt-2"
                  />
                </label>
              ))}
            </div>
          )}

          {showRawJson && (
            <label className="block text-sm font-semibold">
              Технический JSON
              <Textarea
                disabled={!pending}
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={16}
                spellCheck={false}
                className="mt-2 w-full rounded-lg border border-border-light bg-stone-50 p-4 font-mono text-sm dark:border-border-dark dark:bg-black/20"
              />
            </label>
          )}

          {pending && (
            <Button onClick={() => void save()} loading={action === 'save'} disabled={action !== null}>
              Сохранить исправления
            </Button>
          )}
        </div>
      </Card>

      {pending && (
        <Card className="p-6">
          <label className="block text-sm font-semibold">
            Комментарий модератора
            <Textarea
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Обязателен при отклонении"
              className="mt-2 w-full rounded-lg border border-border-light bg-white p-3 dark:border-border-dark dark:bg-surface-dark"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="success"
              onClick={() => setConfirmApprove(true)}
              loading={action === 'approve'}
              disabled={action !== null}
            >
              Одобрить и применить
            </Button>
            <Button
              variant="danger"
              onClick={() => void review('Rejected')}
              loading={action === 'reject'}
              disabled={action !== null}
            >
              Отклонить
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        isOpen={confirmApprove}
        title="Одобрить и применить?"
        message="Изменения сразу применятся к опубликованной кофейне."
        confirmLabel="Одобрить и применить"
        variant="success"
        onConfirm={async () => {
          await review('Approved');
          setConfirmApprove(false);
        }}
        onCancel={() => setConfirmApprove(false)}
      />
    </div>
  );
};
