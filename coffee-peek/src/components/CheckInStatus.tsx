import type { CheckInDto } from '../api/coffeeshop';

const labels = { NotSubmitted: 'Не опубликован', Pending: 'На модерации', Approved: 'Опубликован', Rejected: 'Отклонён' };

export default function CheckInStatus({ item }: { item: CheckInDto }) {
  return <div className="mt-2 text-sm">
    <span className="inline-flex rounded-full bg-stone-500/10 px-3 py-1">{item.visibility === 'Private' ? 'Личный' : `Публичный · ${labels[item.moderationState]}`}</span>
    {item.visibility === 'Public' && item.moderationState === 'Rejected' && item.rejectionReason && <p className="mt-2 text-red-500">Причина отклонения: {item.rejectionReason}</p>}
  </div>;
}
