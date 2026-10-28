import { Link } from 'react-router-dom';
import { OwnershipFilters, useOwnershipFilters } from '../components/ownership/OwnershipFilters';
import { OwnershipHistory } from '../components/ownership/OwnershipHistory';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function OwnershipChangesPage() {
  const { filters, validId, update } = useOwnershipFilters();
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="font-display text-2xl font-bold">История доступа</h1><p className="mt-1 text-sm text-text-muted dark:text-stone-400">Назначения, смена владельцев и отзывы доступа к кофейням и обжарщикам.</p></div>
      <Button asChild variant="secondary"><Link to="/ownership-claims">Заявки на владение</Link></Button>
    </div>
    <Card className="p-4"><OwnershipFilters /></Card>
    <Card><OwnershipHistory filters={filters} enabled={validId} onPageChange={page => update({ page: String(page) })} /></Card>
  </div>;
}
