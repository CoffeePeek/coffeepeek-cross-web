import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bell } from 'lucide-react';
import { getNotificationTemplates, saveNotificationTemplate, sendNotification, type NotificationMessage, type NotificationTemplate } from '../api/notifications';
import { customNotificationSchema, notificationTemplateSchema, renderNotificationPreview } from '../utils/notificationTemplates';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errors';

const templatesKey = ['admin', 'notification-templates'];
const fieldClass = 'w-full rounded-md border border-border-light bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-border-dark dark:bg-surface-dark dark:text-white';

function Preview({ message }: { message: NotificationMessage }) {
  return <aside aria-label="Предпросмотр уведомления" className="rounded-2xl border border-border-light bg-stone-50 p-4 dark:border-border-dark dark:bg-white/5">
    <div className="mb-3 flex items-center gap-2 text-xs text-text-muted dark:text-stone-400"><Bell size={16} aria-hidden="true" /> CoffeePeek · сейчас</div>
    <p className="break-words font-semibold">{message.title || 'Заголовок уведомления'}</p>
    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body || 'Текст уведомления'}</p>
    <p className="mt-4 text-xs text-text-muted dark:text-stone-400">Пример. Внешний вид зависит от устройства и его настроек.</p>
  </aside>;
}

function TemplateEditor({ template }: { template: NotificationTemplate }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { register, handleSubmit, watch, formState: { errors, isDirty }, reset } = useForm<NotificationMessage>({
    resolver: zodResolver(notificationTemplateSchema(template.category)), defaultValues: { title: template.title, body: template.body },
  });
  const save = useMutation({ mutationFn: (message: NotificationMessage) => saveNotificationTemplate(template.category, message),
    onSuccess: async (_, message) => { reset(message); await qc.invalidateQueries({ queryKey: templatesKey }); showToast('Шаблон сохранён', 'success'); },
  });
  const label = template.category === 'Moderation' ? 'Результат модерации' : 'Возвращение в приложение';
  return <Card className="p-5 sm:p-6">
    <h3 className="font-display text-lg font-semibold">{label}</h3>
    <p className="mb-5 mt-1 text-sm text-text-muted dark:text-stone-400">{template.category === 'Moderation'
      ? 'Общий шаблон для чекинов, кофеен, обжарщиков, жалоб и исправлений. Переменные: {subject} — объект, {status} — решение.'
      : 'После 7 дней без посещений и чекинов, не чаще раза в неделю. Переменные не используются.'}</p>
    <div className="grid gap-6 lg:grid-cols-2"><form className="space-y-4" onSubmit={handleSubmit(message => save.mutate(message))}>
      <label className="block space-y-1 text-sm"><span>Заголовок · до 120 символов</span><Input disabled={save.isPending} maxLength={120} {...register('title')} aria-invalid={!!errors.title} />{errors.title && <span role="alert" className="text-red-500">{errors.title.message}</span>}</label>
      <label className="block space-y-1 text-sm"><span>Текст · до 500 символов</span><textarea disabled={save.isPending} rows={4} maxLength={500} className={fieldClass} {...register('body')} aria-invalid={!!errors.body} />{errors.body && <span role="alert" className="text-red-500">{errors.body.message}</span>}</label>
      {save.isError && <p role="alert" className="text-sm text-red-500">{getErrorMessage(save.error, 'Не удалось сохранить шаблон')}</p>}
      <Button type="submit" loading={save.isPending} disabled={!isDirty}>Сохранить шаблон</Button>
      <p className="text-xs text-text-muted dark:text-stone-400">Изменится текст новых уведомлений. Уже поставленные в очередь сообщения сохранят прежний текст.</p>
    </form><Preview message={renderNotificationPreview(watch(), template.category)} /></div>
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
    </form><Preview message={value} /></div>
  </Card>;
}

export function NotificationsPage() {
  const [params] = useSearchParams();
  const templates = useQuery({ queryKey: templatesKey, queryFn: () => getNotificationTemplates().then(response => response.data) });
  return <main className="mx-auto w-full max-w-6xl space-y-6 text-text-main dark:text-white">
    <header><h2 className="font-display text-2xl font-bold">Уведомления</h2><p className="mt-1 text-sm text-text-muted dark:text-stone-400">Тексты автоматических уведомлений и сообщения пользователям.</p></header>
    <CustomMessage key={params.get('userId') ?? ''} userId={params.get('userId') ?? ''} />
    <h2 className="font-display text-xl font-semibold">Автоматические шаблоны</h2>
    {templates.isPending && <p role="status">Загрузка шаблонов…</p>}
    {templates.isError && <div role="alert"><p>{getErrorMessage(templates.error, 'Не удалось загрузить шаблоны')}</p><Button variant="secondary" onClick={() => void templates.refetch()}>Повторить</Button></div>}
    {templates.data?.map(template => <TemplateEditor key={template.category} template={template} />)}
  </main>;
}
