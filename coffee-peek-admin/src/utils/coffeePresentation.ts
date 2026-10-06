/// <reference lib="es2021.intl" />

const warningLabels: Record<string, string> = {
  origin_not_specified: 'Источник не указал страну происхождения зерна.',
  origin_extracted_from_name: 'Страна определена по названию кофе. Подтвердите происхождение.',
  'origin_extracted_from_description.composition': 'Страна определена по описанию состава. Подтвердите происхождение.',
  ambiguous_congo_country: 'Уточните страну: Республика Конго или ДР Конго.',
  blend_composition_may_be_incomplete: 'Состав смеси может быть неполным. Проверьте все компоненты.',
  blend_other_origins_not_specified: 'Для части компонентов смеси не указаны страны происхождения.',
  product_form_not_specified: 'Уточните форму кофе: в зёрнах или молотый.',
  photos_not_imported: 'Фото есть у источника, но ещё не загружены в карточку.',
  photos_not_provided: 'Источник не предоставил фотографии кофе.',
  detail_properties_not_collected: 'Подробные характеристики кофе не загружены. Сверьте карточку с источником.',
  availability_reported_at_product_level: 'Наличие указано для кофе в целом. Проверьте каждую упаковку.',
  source_ids_not_provided: 'Источник не указал ID товаров. При переименовании проверьте, не появился ли дубликат.',
  purchase_in_store_only: 'Покупка доступна только в магазине, без онлайн-заказа.',
};

const countryNames = new Intl.DisplayNames(['ru'], { type: 'region' });

export function coffeeWarningLabel(warning: string): string {
  const [code, ...parts] = warning.split(':');
  const detail = parts.join(':');
  const country = /^[A-Z]{2}$/.test(detail) ? countryNames.of(detail) ?? detail : detail;
  switch (code) {
    case 'country_requires_confirmation': return `Подтвердите страну происхождения: ${country}.`;
    case 'country_not_in_catalog': return `Страна отсутствует в справочнике: ${country}.`;
    case 'variant_weight_not_specified': return `Не указан вес упаковки${detail ? ` (ID: ${detail})` : ''}.`;
    case 'photo_unavailable': return `Не удалось загрузить фото из источника${detail ? ` (код ответа: ${detail})` : ''}.`;
    default: return warningLabels[code] ?? warning;
  }
}
