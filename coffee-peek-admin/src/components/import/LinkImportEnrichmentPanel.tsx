import type { ShopMenuDto } from '../../api/menu';
import type { LinkImportEnrichment, MatchedImportDrink } from '../../utils/linkImportEnrichment';

export interface EnrichmentSelection {
  tags: string[];
  drinks: number[];
  photos: string[];
}
export const emptySelection = (): EnrichmentSelection => ({ tags: [], drinks: [], photos: [] });

export function LinkImportEnrichmentPanel({ enrichment, matches, tagOptions, selection, onChange, menu, disabled, canImportMenu }: {
  enrichment: LinkImportEnrichment;
  matches: MatchedImportDrink[];
  tagOptions: { slug: string; label: string }[];
  selection: EnrichmentSelection;
  onChange: (value: EnrichmentSelection) => void;
  menu?: ShopMenuDto | null;
  disabled: boolean;
  canImportMenu: boolean;
}) {
  const tags = enrichment.tags.filter((tag) => tagOptions.some((option) => option.slug === tag.slug));
  const currency = menu?.currency || 'BYN';
  const photoLimit = 4;
  return <div className="space-y-4 border-t border-border-light dark:border-border-dark pt-4">
    {enrichment.warnings.map((warning) => <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
    <section aria-label="Теги для публикации">
      <h3 className="text-sm font-semibold mb-2">Теги для публикации</h3>
      {tags.length ? <div className="space-y-2">{tags.map((tag) => <div key={tag.slug} className="flex items-start gap-2 text-sm">
        <label className="flex items-center gap-2 shrink-0">
          <input type="checkbox" disabled={disabled} checked={selection.tags.includes(tag.slug)} onChange={(event) => onChange({ ...selection,
            tags: event.target.checked ? [...selection.tags, tag.slug] : selection.tags.filter((slug) => slug !== tag.slug) })} />
          {tagOptions.find((option) => option.slug === tag.slug)?.label}
        </label>
        <a href={tag.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted underline break-words">{tag.evidence}</a>
      </div>)}</div> : <p className="text-xs text-text-muted">Подтверждений для тегов не найдено.</p>}
    </section>
    <section aria-label="Найденное меню">
      <h3 className="text-sm font-semibold mb-2">Меню{enrichment.menuItems.length ? ` · найдено ${enrichment.menuItems.length}` : ''}</h3>
      {enrichment.menuSources.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3 text-xs">{enrichment.menuSources.map((source) =>
        <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.label}</a>)}</div>}
      {!canImportMenu && (matches.length > 0 || enrichment.photos.length > 0) && <p className="text-xs text-text-muted mb-2">Добавьте кофейню, затем перенесите меню из её карточки.</p>}
      {matches.length > 0 && <fieldset disabled={disabled || !canImportMenu} className="space-y-2">
        <legend className="text-xs text-text-muted mb-2">Напитки в каталог · {currency}</legend>
        {matches.map(({ slug, name, item, index }) => <label key={`${slug}-${index}`} className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" aria-label={`Импортировать ${item.name}, ${item.volumeMl ?? 'без объёма'}, ${item.price ?? 'без цены'}`}
            checked={selection.drinks.includes(index)} disabled={disabled || !canImportMenu || Boolean(item.price !== undefined && item.currency !== currency)}
            onChange={(event) => onChange({ ...selection, drinks: event.target.checked
              ? [...selection.drinks.filter((i) => matches.find((match) => match.index === i)?.slug !== slug), index] : selection.drinks.filter((i) => i !== index) })} />
          <span title={item.name}>{name}{item.volumeMl ? ` · ${item.volumeMl} мл` : ''}{item.price !== undefined ? ` · ${item.price.toLocaleString('ru-RU')} ${item.currency}` : ' · цена не найдена'}
            {item.delivery && <span className="text-amber-700 dark:text-amber-300"> · доставка</span>}
            {menu?.items.some((row) => row.slug === slug && row.availability === 'Present') && <span className="text-text-muted"> · уже в меню</span>}
          </span>
        </label>)}
      </fieldset>}
      {enrichment.menuItems.length > matches.length && <details className="text-xs mt-3">
        <summary className="cursor-pointer text-text-muted">Все найденные позиции</summary>
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1">{enrichment.menuItems.map((item, index) => <div key={index}>
          {item.name}{item.weightGrams ? ` · ${item.weightGrams} г` : ''}{item.volumeMl ? ` · ${item.volumeMl} мл` : ''}{item.price !== undefined ? ` · ${item.price} ${item.currency}` : ''}
        </div>)}</div>
      </details>}
      {enrichment.photos.length > 0 && <fieldset disabled={disabled || !canImportMenu} className="mt-4">
        <legend className="text-xs text-text-muted mb-2">Выберите фото меню для распознавания · до {photoLimit}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto">{enrichment.photos.map((photo, index) => <div key={photo.url} className="rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть фото ${index + 1}`}>
            <img src={photo.url} alt={photo.label} loading="lazy" referrerPolicy="no-referrer" className="w-full h-32 object-contain bg-stone-100 dark:bg-stone-900" />
          </a>
          <label className="flex items-center gap-2 p-2 text-xs">
            <input type="checkbox" aria-label={`Фото меню ${index + 1}`} checked={selection.photos.includes(photo.url)}
              disabled={disabled || !canImportMenu || (!selection.photos.includes(photo.url) && selection.photos.length >= photoLimit)}
              onChange={(event) => onChange({ ...selection, photos: event.target.checked ? [...selection.photos, photo.url] : selection.photos.filter((url) => url !== photo.url) })} />
            Фото {index + 1}
          </label>
        </div>)}</div>
      </fieldset>}
      {!enrichment.menuItems.length && !enrichment.photos.length && <p className="text-xs text-text-muted">Позиции и фото меню не найдены.</p>}
    </section>
  </div>;
}
