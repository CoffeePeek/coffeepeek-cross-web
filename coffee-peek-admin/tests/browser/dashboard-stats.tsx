import { createRoot } from 'react-dom/client';
import type { OverviewStats } from '../../src/api/admin';
import { AudienceGrowthStats } from '../../src/components/dashboard/AudienceGrowthStats';
import { ShopCoverageStats } from '../../src/components/dashboard/ShopCoverageStats';
import { Card } from '../../src/components/ui/Card';
import '../../src/index.css';

const empty = new URLSearchParams(location.search).has('empty');
const metric = (eligibleUsers: number, returnedUsers: number) => ({
  eligibleUsers: empty ? 0 : eligibleUsers, returnedUsers: empty ? 0 : returnedUsers,
  ratePercent: empty ? null : Math.round(returnedUsers * 10000 / eligibleUsers) / 100,
});
const overview = {
  totalUsers: empty ? 0 : 1240, googleUsers: empty ? 0 : 420, appleUsers: empty ? 0 : 280,
  emailUsers: empty ? 0 : 540, otherAuthUsers: 0,
  retention: { asOfDateUtc: '2026-10-29', d1: metric(1200, 396), d7: metric(1100, 187),
    d30: metric(900, 81), afterRegistration: metric(1233, 592) },
} as OverviewStats;

createRoot(document.getElementById('root')!).render(
  <main className="min-h-screen bg-stone-50 p-4 text-text-main sm:p-8 dark:bg-stone-950">
    <div className="mx-auto max-w-6xl space-y-4">
      <header>
        <p className="text-sm text-text-muted">CoffeePeek · демонстрационные данные</p>
        <h1 className="mt-1 font-display text-2xl font-bold">Новые показатели дашборда</h1>
        <nav className="mt-2 flex gap-4 text-sm"><a href="?">Заполненные данные</a><a href="?empty">Пустые данные</a></nav>
      </header>
      <AudienceGrowthStats overview={overview} />
      <Card className="p-4"><ShopCoverageStats coverage={{ totalShops: empty ? 0 : 312,
        averageCompletenessPercent: empty ? null : 68.42, shopsWithCheckIns: empty ? 0 : 184,
        shopsWithoutCheckIns: empty ? 0 : 128 }} /></Card>
    </div>
  </main>,
);
