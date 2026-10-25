import { usePublicCheckIns } from '../../hooks/queries/useCheckIns';
import { useLoadMoreOnScroll } from '../../hooks/useLoadMoreOnScroll';
import CheckInCard from '../CheckInCard';
import { ProfileError, ProfileLoading, ProfileSectionHeading } from './ProfileUI';

export default function PublicProfileCheckIns({ slug }: { slug: string }) {
  const query = usePublicCheckIns({ authorSlug: slug, pageSize: 10 });
  const checkIns = [...new Map(query.data?.pages.flatMap(page => page.items).map(item => [item.id, item]) ?? []).values()];
  const loadMore = () => { void query.fetchNextPage({ cancelRefetch: false }); };
  const loadMoreRef = useLoadMoreOnScroll(!!query.hasNextPage && !query.isFetching && !query.isError, loadMore);

  return <section className="profile-check-ins min-w-0">
    <ProfileSectionHeading title="Чекины" />
    {query.isPending && <ProfileLoading label="Загрузка чекинов…" />}
    {checkIns.length > 0 && <div className="space-y-3">{checkIns.map(item => <CheckInCard key={item.id} item={item} />)}</div>}
    {query.isError && !query.isFetching && <div className="mt-3"><ProfileError
      message={query.isFetchNextPageError ? 'Не удалось загрузить следующие чекины' : 'Не удалось загрузить чекины'}
      onRetry={() => { if (query.isFetchNextPageError) loadMore(); else void query.refetch(); }}
    /></div>}
    {query.isSuccess && !checkIns.length && !query.hasNextPage && <p className="profile-panel rounded-[20px] border px-5 py-8 text-center text-sm profile-muted">Пока нет публичных чекинов</p>}
    <div ref={loadMoreRef} className="mt-4 min-h-px">
      {query.isFetchingNextPage ? <ProfileLoading label="Загрузка следующих чекинов…" />
        : query.hasNextPage && !query.isError && <button type="button" className="profile-pill w-full" disabled={query.isFetching} onClick={loadMore}>Загрузить ещё</button>}
    </div>
    {query.isSuccess && checkIns.length > 0 && !query.hasNextPage && <p className="py-4 text-center text-sm profile-muted">Все публичные чекины загружены</p>}
  </section>;
}
