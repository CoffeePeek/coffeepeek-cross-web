import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences as Preferences } from '../api/notifications';
import { getErrorMessage } from '../utils/errorHandler';

const categories = [
  ['moderation', 'Решения модерации', 'Статусы ваших чекинов, кофеен, исправлений и жалоб'],
  ['inactivity', 'Напоминания', 'Напомним о CoffeePeek после недели без посещений и чекинов'],
  ['custom', 'Другие сообщения', 'Персональные сообщения от команды CoffeePeek'],
] as const;

export default function NotificationPreferences({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const key = ['notification-preferences', userId];
  const query = useQuery({ queryKey: key, queryFn: getNotificationPreferences });
  const save = useMutation({ mutationFn: updateNotificationPreferences, onSuccess: (_, value) => qc.setQueryData(key, value) });
  return <div className="p-4 sm:p-5">
    <p className="mb-4 text-xs opacity-75">Для всех подключённых устройств вашего аккаунта. Разрешение на показ уведомлений включается отдельно в приложении.</p>
    {query.isPending && <p role="status" className="text-sm">Загрузка настроек…</p>}
    {(query.isError || save.isError) && <p role="alert" className="mb-3 text-sm text-red-500">{getErrorMessage(query.error ?? save.error)}</p>}
    {query.isError && <button type="button" className="rounded-lg px-3 py-2 text-sm underline focus-visible:outline focus-visible:outline-2" onClick={() => void query.refetch()}>Повторить</button>}
    {query.data && categories.map(([category, title, description]) => <label key={category} className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span><span className="block text-base font-medium">{title}</span><span className="mt-1 block text-xs opacity-75">{description}</span></span>
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#EAB308] focus-visible:outline focus-visible:outline-2" checked={query.data[category]} disabled={save.isPending}
        onChange={event => save.mutate({ ...query.data!, [category]: event.target.checked } as Preferences)} />
    </label>)}
    {save.isSuccess && <p role="status" className="mt-2 text-xs opacity-75">Настройки сохранены</p>}
  </div>;
}
