import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/theme';
import Shimmer from './Shimmer';
import ShopCardSkeleton from './ShopCardSkeleton';

export function CoffeeDetailSkeleton() {
  const { theme } = useTheme();
  const tc = getThemeClasses(theme);
  return <main role="status" aria-label="Загрузка кофе" className="mx-auto max-w-[1200px] space-y-8 px-4 py-5 pb-28 sm:px-6">
    <div aria-hidden="true" className="flex h-11 items-center gap-2"><Shimmer width={44} height={16} /><Shimmer width={96} height={16} /><Shimmer width="25%" height={16} /></div>
    <section aria-hidden="true" className="grid items-start gap-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-9">
      <div className="min-w-0 space-y-3">
        <div className="aspect-[10/11] overflow-hidden rounded-xl"><Shimmer height="100%" className="!rounded-none" /></div>
        <div className="flex gap-2">{[0, 1, 2].map(i => <Shimmer key={i} width={80} height={80} className="!rounded-xl" />)}</div>
      </div>
      <div className="min-w-0 space-y-6">
        <div className="flex items-center gap-3"><Shimmer width={56} height={56} className="!rounded-xl" /><div className="flex-1 space-y-2"><Shimmer width="45%" height={16} /><Shimmer width={70} height={12} /></div><Shimmer width={44} height={44} circle /></div>
        <div className="space-y-4">
          <Shimmer width="85%" height={40} />
          <div className="flex flex-wrap gap-2"><Shimmer width={128} height={40} circle /><Shimmer width={200} height={40} circle /></div>
          <div className="space-y-3"><Shimmer height={16} /><Shimmer height={16} /><Shimmer width="65%" height={16} /></div>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="space-y-2"><Shimmer width={48} height={48} className="!rounded-2xl" /><Shimmer width="85%" height={12} /><Shimmer width="70%" height={16} /></div>)}</div>
        <div className={`space-y-3 border-t pt-5 ${tc.border.default}`}><Shimmer width={150} height={20} /><div className="flex flex-wrap gap-2"><Shimmer width={88} height={32} circle /><Shimmer width={80} height={32} circle /><Shimmer width={72} height={32} circle /></div></div>
        <div className={`space-y-4 border-t pt-5 ${tc.border.default}`}><Shimmer width={80} height={20} /><div className="grid grid-cols-2 gap-4">{[0, 1].map(i => <div key={i} className="space-y-2"><Shimmer width={60} height={12} /><Shimmer width="60%" height={20} /></div>)}</div></div>
      </div>
    </section>
    <section aria-hidden="true" className="space-y-4">
      <Shimmer width="45%" height={32} />
      <div className="grid gap-4 md:grid-cols-2">{[0, 1].map(i => <div key={i} className={`space-y-4 rounded-2xl border p-4 sm:p-5 ${tc.bg.card} ${tc.border.default}`}>
        <div className="flex justify-between gap-3"><Shimmer width={64} height={24} /><Shimmer width={100} height={16} /></div>
        <Shimmer width={112} height={28} /><Shimmer height={44} circle />
        <div className="space-y-3">{[0, 1, 2, 3, 4].map(row => <div key={row} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4"><Shimmer width="75%" height={12} /><Shimmer width="85%" height={12} /></div>)}</div>
      </div>)}</div>
    </section>
    <section aria-hidden="true" className="space-y-4"><Shimmer width={180} height={24} /><div className="relative flex gap-4 overflow-x-auto pb-3 [contain:paint] sm:grid sm:grid-cols-2 lg:grid-cols-4 [&>article]:w-[80%] [&>article]:shrink-0 sm:[&>article]:w-auto"><ShopCardSkeleton variant="coffee" count={4} /></div></section>
  </main>;
}

export function RoasterDetailSkeleton() {
  const { theme } = useTheme();
  const tc = getThemeClasses(theme);
  return <main role="status" aria-label="Загрузка обжарщика" className={`mx-auto max-w-[1200px] space-y-8 px-4 py-6 pb-28 sm:px-6 ${tc.bg.primary}`}>
    <header aria-hidden="true" className="space-y-3">
      <div className="flex h-11 items-center gap-2"><Shimmer width={96} height={16} /><Shimmer width={120} height={16} /></div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <div className="h-24 w-24 shrink-0 sm:h-32 sm:w-32"><Shimmer height="100%" className="!rounded-2xl" /></div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-3"><Shimmer width="65%" height={32} /><Shimmer width={44} height={44} circle className="ml-auto" /></div>
            <Shimmer width="70%" height={16} />
            <div className="flex flex-wrap gap-2"><Shimmer width={112} height={44} className="!rounded-xl" /><Shimmer width={120} height={44} className="!rounded-xl" /></div>
            <div className="flex flex-wrap gap-2"><Shimmer width={88} height={32} circle /><Shimmer width={72} height={32} circle /></div>
          </div>
        </div>
        <div className={`grid grid-cols-2 rounded-2xl border p-4 ${tc.bg.card} ${tc.border.default}`}>{[0, 1].map(i => <div key={i} className={`space-y-2 px-3 py-2 ${i ? `border-l ${tc.border.default}` : ''}`}><Shimmer width={40} height={28} className="mx-auto" /><Shimmer height={12} /></div>)}</div>
      </div>
    </header>
    <section aria-hidden="true" className="space-y-3"><Shimmer width={170} height={24} /><Shimmer height={16} /><Shimmer width="95%" height={16} /><Shimmer width="70%" height={16} /></section>
    <section aria-hidden="true" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Shimmer width={190} height={28} /><Shimmer width={112} height={16} /></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><ShopCardSkeleton variant="coffee" count={3} /></div></section>
    <section aria-hidden="true" className="space-y-4"><Shimmer width={220} height={24} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className={`flex items-center gap-3 rounded-2xl border p-3 ${tc.bg.card} ${tc.border.default}`}><Shimmer width={64} height={64} className="!rounded-xl" /><div className="min-w-0 flex-1 space-y-2"><Shimmer width="85%" height={16} /><Shimmer width="70%" height={12} /></div></div>)}</div></section>
  </main>;
}
