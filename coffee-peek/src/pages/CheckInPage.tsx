import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { useCheckIn } from '../hooks/queries/useCheckIns';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';
import CheckInCard from '../components/CheckInCard';
import WobbleRing from '../components/WobbleRing';
import Mascot from '../components/Mascot';

/** Shared check-in link target: one post, readable by guests when it is public and approved. */
export default function CheckInPage() {
  const { checkInId } = useParams<{ checkInId: string }>();
  const query = useCheckIn(checkInId);
  const { theme } = useTheme();
  const classes = getThemeClasses(theme);
  const status = (query.error as { status?: number } | null)?.status;
  const item = status === 404 ? undefined : query.data;
  const title = !item ? 'Публикация' : item.kind === 'Home'
    ? `Кофе дома — ${item.username || 'Пользователь'}` : `${item.username || 'Пользователь'} в «${item.shopName || 'кофейне'}»`;
  usePageTitle(title, { description: item?.text, canonicalPath: checkInId ? `/check-ins/${encodeURIComponent(checkInId)}` : undefined });

  return <main className={`min-h-screen px-4 pb-32 pt-3 sm:py-8 ${classes.bg.primary} ${classes.text.primary}`}><div className="mx-auto max-w-3xl space-y-6">
    <Link to="/feed" aria-label="Вернуться в ленту" title="Вернуться в ленту" className={`flex h-11 w-11 items-center justify-center rounded-full ${classes.text.secondary} hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#EAB308]`}><ArrowLeft size={24} /></Link>
    {query.isLoading && <div className="flex justify-center py-10"><WobbleRing /></div>}
    {query.isError && <div className="flex flex-col items-center py-8 text-center">
      <Mascot pose="book" size={120} />
      <p role="alert" className="mt-4 text-xl font-bold">{status === 404 ? 'Публикация недоступна' : 'Публикация временно недоступна'}</p>
      {status === 404 && <p className={`mt-2 ${classes.text.secondary}`}>Возможно, автор скрыл или удалил её, или она ещё на модерации.</p>}
      {status !== 404 && <button type="button" className="mt-4 min-h-11 underline" onClick={() => void query.refetch()}>Повторить</button>}
    </div>}
    {item && <CheckInCard item={item} />}
  </div></main>;
}
