import type { AdminShopCoverage } from '../../api/admin';

export const ShopCoverageStats = ({ coverage }: { coverage?: AdminShopCoverage | null }) => (
  <section aria-label="Заполненность и охват кофеен" className="space-y-3">
    <h4 className="text-sm font-semibold">Заполненность и охват кофеен</h4>
    {coverage ? (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Всего кофеен', value: coverage.totalShops },
            { label: 'Средняя заполненность карточек', value: coverage.averageCompletenessPercent === null ? '—' : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(coverage.averageCompletenessPercent)}%` },
            { label: 'С чекинами', value: coverage.shopsWithCheckIns },
            { label: 'Без чекинов', value: coverage.shopsWithoutCheckIns },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border-light p-3 dark:border-border-dark">
              <p className="text-xs text-text-muted dark:text-stone-400">{label}</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted dark:text-stone-400">
          Все кофейни каталога, включая скрытые и закрытые. Заполненность — средний балл карточки от 0 до 100.
          Охват — наличие хотя бы одного опубликованного, одобренного и неудалённого чекина в кофейне за всё время; у скрытых кофеен публичных чекинов нет.
        </p>
      </>
    ) : <p className="text-sm text-text-muted">Данные заполненности и охвата недоступны</p>}
  </section>
);
