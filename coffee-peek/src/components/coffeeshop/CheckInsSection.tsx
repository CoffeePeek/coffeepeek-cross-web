import type { CheckInDto } from '../../api/coffeeshop';
import { CheckInCardSkeleton } from '../skeletons';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/theme';
import { StarIcon } from '../icons';
import Mascot from '../Mascot';
import CheckInCard from '../CheckInCard';

interface CheckInsSectionProps {
  checkIns: CheckInDto[];
  isLoading: boolean;
  onCreateCheckIn: () => void;
  coffeeShopName: string;
  averageRating: number;
  totalCount: number;
}

export function CheckInsSection({ checkIns, isLoading, onCreateCheckIn, coffeeShopName, averageRating, totalCount }: CheckInsSectionProps) {
  const { theme } = useTheme();
  const classes = getThemeClasses(theme);
  // The shop rating uses the latest public visit per author; repeat visits still get their own cards.
  const latestByAuthor = new Map<string, CheckInDto>();
  [...checkIns].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc)).forEach(item => {
    const author = item.author?.slug ?? item.id;
    if (!latestByAuthor.has(author)) latestByAuthor.set(author, item);
  });
  const latest = [...latestByAuthor.values()];
  return <section aria-label="Публичные чекины">
    <div className="mb-6 flex items-center justify-between gap-3"><h2 className={`text-2xl font-bold ${classes.text.primary}`}>Публичные чекины</h2><button type="button" onClick={onCreateCheckIn} className={`min-h-11 rounded-xl px-4 py-2.5 font-bold ${classes.primary.bgLight} ${classes.primary.text}`}>Добавить</button></div>
    {!isLoading && totalCount > 0 && <div className="mb-6 space-y-4">
      <div className={`flex items-center gap-2 text-xl font-bold ${classes.text.primary}`}><StarIcon filled size={28} className={classes.primary.text} /><span>{averageRating.toFixed(1)} · Чекины: {totalCount}</span></div>
      {latest.length > 0 && <div className="space-y-3">{([['Кофе', 'coffee', 'cup'], ['Сервис', 'service', 'dessert'], ['Аура', 'place', 'happy']] as const).map(([label, key, pose]) => {
        const value = latest.reduce((sum, item) => sum + item.rating[key], 0) / latest.length;
        return <div key={key} className="flex items-center gap-3 sm:gap-4"><div className="flex w-28 shrink-0 items-center gap-2 sm:w-36"><Mascot pose={pose} size={28} /><span className={classes.text.primary}>{label}</span></div><div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={5} aria-valuenow={value} className={`h-2.5 flex-1 overflow-hidden rounded-full ${classes.bg.tertiary}`}><div className={`h-full rounded-full ${classes.primary.bg}`} style={{ width: `${value * 20}%` }} /></div><span className={`w-9 text-right text-lg font-semibold ${classes.text.primary}`}>{value.toFixed(1)}</span></div>;
      })}<p className={`text-xs ${classes.text.secondary}`}>Оценки категорий — по последним посещениям авторов среди показанных чекинов</p></div>}
    </div>}
    {isLoading ? <CheckInCardSkeleton count={3} /> : checkIns.length ? <div className="grid items-start gap-4 sm:grid-cols-2">{checkIns.map(item => <CheckInCard key={item.id} item={item} showShop={false} />)}</div> : <div className="flex flex-col items-center py-8 text-center"><Mascot pose="book" size={120} /><p className={`mt-3 ${classes.text.secondary}`}>Станьте первым, кто добавит публичный чекин о посещении {coffeeShopName}</p></div>}
  </section>;
}
