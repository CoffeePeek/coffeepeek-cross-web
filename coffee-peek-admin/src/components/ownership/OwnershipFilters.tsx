import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { NativeSelect } from '../ui/NativeSelect';
import { businessLabels, claimStatusLabels, type BusinessType, type OwnershipClaimStatus } from '../../api/businessOwnership';

export function useOwnershipFilters(withStatus = false) {
  const [params, setParams] = useSearchParams();
  const pageValue = Number(params.get('page'));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const type = params.get('businessType');
  const businessType: BusinessType | undefined = type === 'CoffeeShop' || type === 'Roaster' ? type : undefined;
  const rawStatus = params.get('status');
  const status: OwnershipClaimStatus = rawStatus === 'Approved' || rawStatus === 'Rejected' ? rawStatus : 'Pending';
  const businessId = params.get('businessId')?.trim() || undefined;
  const validId = !businessId || z.string().uuid().safeParse(businessId).success;
  const filters = { page, pageSize: 20, businessType, businessId, ...(withStatus ? { status } : {}) };
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next);
  };
  return { filters, status, validId, update };
}
export function OwnershipFilters({ withStatus = false }: { withStatus?: boolean }) {
  const { filters, status, validId, update } = useOwnershipFilters(withStatus);
  return <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = String(data.get('businessId') ?? '').trim();
    const field = event.currentTarget.elements.namedItem('businessId') as HTMLInputElement;
    field.setCustomValidity(id && !z.string().uuid().safeParse(id).success ? 'Введите UUID бизнеса' : '');
    if (!field.reportValidity()) return;
    update({ businessId: id, page: '1' });
  }}>
    {withStatus && <label className="grid w-full gap-1 text-sm sm:w-auto">Статус заявки
      <NativeSelect value={status} onChange={event => update({ status: event.target.value, page: '1' })}>
        {Object.entries(claimStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </NativeSelect>
    </label>}
    <label className="grid w-full gap-1 text-sm sm:w-auto">Тип бизнеса
      <NativeSelect value={filters.businessType ?? ''} onChange={event => update({ businessType: event.target.value, page: '1' })}>
        <option value="">Все типы</option>
        {Object.entries(businessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </NativeSelect>
    </label>
    <label className="grid min-w-0 w-full gap-1 text-sm sm:min-w-48 sm:w-auto sm:flex-1">ID бизнеса
      <Input key={filters.businessId ?? ''} name="businessId" className="min-w-0" defaultValue={filters.businessId} placeholder="UUID бизнеса" onChange={event => event.target.setCustomValidity('')} aria-invalid={!validId} />
    </label>
    <Button type="submit" variant="secondary">Применить</Button>
    {!validId && <p role="alert" className="w-full text-sm text-red-600">Введите корректный UUID бизнеса.</p>}
  </form>;
}
