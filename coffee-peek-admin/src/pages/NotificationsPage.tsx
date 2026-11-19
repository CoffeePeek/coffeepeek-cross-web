import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getNotificationTemplates, saveNotificationTemplate, sendNotification, getNotificationAudience, getNotificationBroadcasts, sendNotificationBroadcast, type NotificationMessage, type NotificationTemplate } from '../api/notifications';
import { customNotificationSchema, notificationMessageSchema, notificationTemplateSchema, renderNotificationPreview } from '../utils/notificationTemplates';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { NotificationPreview } from '../components/notifications/NotificationPreview';

const templatesKey = ['admin', 'notification-templates'];
const fieldClass = 'w-full rounded-md border border-border-light bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-border-dark dark:bg-surface-dark dark:text-white';

function TemplateEditor({ template }: { template: NotificationTemplate }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { register, handleSubmit, watch, formState: { errors, isDirty }, reset } = useForm<NotificationMessage>({
    resolver: zodResolver(notificationTemplateSchema(template.category)), defaultValues: { title: template.title, body: template.body },
  });
  const save = useMutation({ mutationFn: (message: NotificationMessage) => saveNotificationTemplate(template.category, message),
    onSuccess: async (_, message) => { reset(message); await qc.invalidateQueries({ queryKey: templatesKey }); showToast('Шаблон сохранён', 'success'); },
  });
  const label = { Moderation: 'Результат модерации', Inactivity: 'Возвращение в приложение', NewShop: 'Новая кофейня на карте' }[template.category];
  return <Card className="p-5 sm:p-6">
    <h3 className="font-display text-lg font-semibold">{label}</h3>
    <p className="mb-5 mt-1 text-sm text-text-muted dark:text-stone-400">{template.category === 'Moderation'
      ? 'Общий шаблон для чекинов, кофеен, обжарщиков, жалоб и исправлений. Переменные: {subject} — объект, {status} — решение.'
      : template.category === 'NewShop'
        ? 'Для всех пользователей CoffeePeek при появлении кофейни на карте. Переменная: {name} — название кофейни (до 300 символов).'
        : 'После 7 дней без посещений и чекинов, не чаще раза в неделю. Переменные не используются.'}</p>
    <div className="grid gap-6 lg:grid-cols-2"><form className="space-y-4" onSubmit={handleSubmit(message => save.mutate(message))}>
      <label className="block space-y-1 text-sm"><span>Заголовок · до 120 символов</span><Input disabled={save.isPending} maxLength={120} {...register('title')} aria-invalid={!!errors.title} />{errors.title && <span role="alert" className="text-red-500">{errors.title.message}</span>}</label>
      <label className="block space-y-1 text-sm"><span>Текст · до 500 символов</span><textarea disabled={save.isPending} rows={4} maxLength={500} className={fieldClass} {...register('body')} aria-invalid={!!errors.body} />{errors.body && <span role="alert" className="text-red-500">{errors.body.message}</span>}</label>
      {save.isError && <p role="alert" className="text-sm text-red-500">{getErrorMessage(save.error, 'Не удалось сохранить шаблон')}</p>}
      <Button type="submit" loading={save.isPending} disabled={!isDirty}>Сохранить шаблон</Button>
      <p className="text-xs text-text-muted dark:text-stone-400">Изменится текст новых уведомлений. Уже поставленные в очередь сообщения сохранят прежний текст.</p>
    </form><NotificationPreview message={renderNotificationPreview(watch(), template.category)} /></div>
  </Card>;
}

function CustomMessage({ userId }: { userId: string }) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [sent, setSent] = useState(false);
  const [submitted, setSubmitted] = useState<(NotificationMessage & { userId: string }) | null>(null);
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<NotificationMessage & { userId: string }>({
    resolver: zodResolver(customNotificationSchema), defaultValues: { userId, title: '', body: '' },
  });
  const send = useMutation({ mutationFn: (value: NotificationMessage & { userId: string }) => sendNotification(requestId, value.userId, value),
    onSuccess: () => setSent(true),
  });
  const value = watch();
  return <Card className="p-5 sm:p-6"><h3 className="font-display text-lg font-semibold">Сообщение пользователю</h3>
    <p className="mb-5 mt-1 text-sm text-text-muted dark:text-stone-400">Отправка на подключённые устройства с учётом настроек пользователя. Выбрать получателя можно кнопкой «Уведомление» в списке пользователей.</p>
    <div className="grid gap-6 lg:grid-cols-2"><form className="space-y-4" onSubmit={handleSubmit(message => { setSubmitted(message); send.mutate(message); })}>
      <fieldset disabled={submitted !== null} className="space-y-4">
        <label className="block space-y-1 text-sm"><span>ID пользователя</span><Input {...register('userId')} aria-invalid={!!errors.userId} />{errors.userId && <span role="alert" className="text-red-500">{errors.userId.message}</span>}</label>
        <label className="block space-y-1 text-sm"><span>Заголовок</span><Input maxLength={120} {...register('title')} aria-invalid={!!errors.title} />{errors.title && <span role="alert" className="text-red-500">{errors.title.message}</span>}</label>
        <label className="block space-y-1 text-sm"><span>Текст</span><textarea rows={4} maxLength={500} className={fieldClass} {...register('body')} aria-invalid={!!errors.body} />{errors.body && <span role="alert" className="text-red-500">{errors.body.message}</span>}</label>
      </fieldset>
      {send.isError && <p role="alert" className="text-sm text-red-500">{getErrorMessage(send.error, 'Не удалось поставить сообщение в очередь. Повторите попытку с тем же текстом.')}</p>}
      {sent ? <><p role="status" className="text-sm text-emerald-600">Сообщение поставлено в очередь. Это ещё не подтверждение доставки на устройство.</p><Button onClick={() => { setRequestId(crypto.randomUUID()); setSent(false); setSubmitted(null); send.reset(); reset({ userId: value.userId, title: '', body: '' }); }}>Новое сообщение</Button></>
        : submitted ? <Button type="button" loading={send.isPending} onClick={() => send.mutate(submitted)}>Повторить отправку</Button>
        : <Button type="submit">Отправить уведомление</Button>}
    </form><NotificationPreview message={value} /></div>
  </Card>;
}

function BroadcastMessage() {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [review, setReview] = useState<NotificationMessage | null>(null);
  const [submitted, setSubmitted] = useState<NotificationMessage | null>(null);
  const [sent, setSent] = useState(false);
  const qc = useQueryClient();
  const audience = useQuery({
    queryKey: ['admin', 'notification-audience'],
    queryFn: () => getNotificationAudience().then(response => response.data),
  });
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<NotificationMessage>({
    resolver: zodResolver(notificationMessageSchema), defaultValues: { title: '', body: '' },
  });
  const send = useMutation({
    mutationFn: (message: NotificationMessage) => sendNotificationBroadcast(requestId, message),
    onSuccess: async () => {
      setSent(true);
      await qc.invalidateQueries({ queryKey: ['admin', 'notification-broadcasts'] });
    },
  });
  const value = watch();
  return <Card className="p-5 sm:p-6">
    <h3 className="font-display text-lg font-semibold">Сообщение всем пользователям</h3>
    <p className="mb-5 mt-1 text-sm text-text-muted dark:text-stone-400">
      Уведомление появится в приложении у всех действующих аккаунтов. Push получат пользователи с подключёнными устройствами и разрешёнными уведомлениями.
    </p>
    {audience.data && <p className="mb-4 text-sm" role="status">
      Получателей в приложении — {audience.data.users.toLocaleString('ru-RU')}. Доступен push — {audience.data.pushUsers.toLocaleString('ru-RU')}.
    </p>}
    {audience.isError && <div className="mb-4 text-sm" role="alert">
      <p>{getErrorMessage(audience.error, 'Не удалось получить число получателей')}</p>
      <Button variant="secondary" size="sm" onClick={() => void audience.refetch()}>Повторить</Button>
    </div>}
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="space-y-4" onSubmit={handleSubmit(message => setReview(message))}>
        <fieldset disabled={submitted !== null} className="space-y-4">
          <label className="block space-y-1 text-sm"><span>Заголовок</span>
            <Input maxLength={120} {...register('title')} aria-invalid={!!errors.title} />
            {errors.title && <span role="alert" className="text-red-500">{errors.title.message}</span>}
          </label>
          <label className="block space-y-1 text-sm"><span>Текст</span>
            <textarea rows={4} maxLength={500} className={fieldClass} {...register('body')} aria-invalid={!!errors.body} />
            {errors.body && <span role="alert" className="text-red-500">{errors.body.message}</span>}
          </label>
        </fieldset>
        {send.isError && <p role="alert" className="text-sm text-red-500">
          {getErrorMessage(send.error, 'Не удалось подтвердить постановку рассылки в очередь. Повторите попытку с тем же текстом.')}
        </p>}
        {sent ? <>
          <p role="status" className="text-sm text-emerald-600">Рассылка поставлена в очередь. Статус подготовки показан ниже.</p>
          <Button onClick={() => {
            setRequestId(crypto.randomUUID()); setSent(false); setSubmitted(null); send.reset(); reset();
          }}>Новая рассылка</Button>
        </> : submitted
          ? <Button loading={send.isPending} onClick={() => send.mutate(submitted)}>Повторить отправку</Button>
          : <Button type="submit" disabled={!audience.data?.users || audience.isFetching}>Проверить и отправить всем</Button>}
      </form>
      <NotificationPreview message={value} />
    </div>
    <ConfirmDialog isOpen={review !== null} title="Отправить уведомление всем пользователям?"
      message={'Получателей в приложении — ' + (audience.data?.users ?? 0) + '.\n\n' + (review?.title ?? '') + '\n' + (review?.body ?? '')}
      confirmLabel="Отправить всем" onCancel={() => setReview(null)}
      onConfirm={() => {
        if (!review) return;
        setSubmitted(review); setReview(null); send.mutate(review);
      }} />
  </Card>;
}

function BroadcastHistory() {
  const history = useQuery({
    queryKey: ['admin', 'notification-broadcasts'],
    queryFn: () => getNotificationBroadcasts().then(response => response.data),
    refetchInterval: query => query.state.data?.some(row => !row.completedAtUtc) ? 5000 : false,
  });
  if (history.isError) return <Card className="space-y-3 p-5">
    <p role="alert">{getErrorMessage(history.error, 'Не удалось загрузить рассылки')}</p>
    <Button variant="secondary" onClick={() => void history.refetch()}>Обновить рассылки</Button>
  </Card>;
  if (!history.data?.length) return null;
  return <Card className="space-y-4 p-5 sm:p-6">
    <h3 className="font-display text-lg font-semibold">Последние рассылки</h3>
    <p className="text-xs text-text-muted dark:text-stone-400">
      Счётчик показывает создание уведомлений в приложении. Доставка push зависит от устройства и разрешений пользователя.
    </p>
    <ul className="divide-y divide-border-light dark:divide-border-dark">
      {history.data.map(row => <li key={row.id} className="space-y-1 py-3">
        <div className="flex flex-wrap justify-between gap-2">
          <strong className="min-w-0 break-words text-sm">{row.title}</strong>
          <span className="text-xs text-text-muted dark:text-stone-400">
            {row.completedAtUtc
              ? (new Date(row.completedAtUtc) >= new Date(row.expiresAtUtc) ? 'Срок отправки истёк' : 'Уведомления созданы')
              : 'Подготовка рассылки'}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm">{row.body}</p>
        <p className="text-xs text-text-muted dark:text-stone-400">
          {new Date(row.createdAtUtc).toLocaleString('ru-RU')} · Создано {row.queuedUsers.toLocaleString('ru-RU')} из {row.totalUsers.toLocaleString('ru-RU')}
        </p>
      </li>)}
    </ul>
  </Card>;
}

export function NotificationsPage() {
  const [params] = useSearchParams();
  const [audience, setAudience] = useState<'user' | 'all'>('user');
  const templates = useQuery({ queryKey: templatesKey, queryFn: () => getNotificationTemplates().then(response => response.data) });
  return <main className="mx-auto w-full max-w-6xl space-y-6 text-text-main dark:text-white">
    <header><h2 className="font-display text-2xl font-bold">Уведомления</h2><p className="mt-1 text-sm text-text-muted dark:text-stone-400">Тексты автоматических уведомлений и сообщения пользователям.</p></header>
    <div role="group" aria-label="Получатели уведомления" className="flex flex-wrap gap-2">
      <Button variant={audience === 'user' ? 'primary' : 'secondary'} aria-pressed={audience === 'user'} onClick={() => setAudience('user')}>Одному пользователю</Button>
      <Button variant={audience === 'all' ? 'primary' : 'secondary'} aria-pressed={audience === 'all'} onClick={() => setAudience('all')}>Всем пользователям</Button>
    </div>
    <div hidden={audience !== 'user'}><CustomMessage key={params.get('userId') ?? ''} userId={params.get('userId') ?? ''} /></div>
    <div hidden={audience !== 'all'}><BroadcastMessage /></div>
    <BroadcastHistory />
    <h2 className="font-display text-xl font-semibold">Автоматические шаблоны</h2>
    {templates.isPending && <p role="status">Загрузка шаблонов…</p>}
    {templates.isError && <div role="alert"><p>{getErrorMessage(templates.error, 'Не удалось загрузить шаблоны')}</p><Button variant="secondary" onClick={() => void templates.refetch()}>Повторить</Button></div>}
    {templates.data?.map(template => <TemplateEditor key={template.category} template={template} />)}
  </main>;
}
