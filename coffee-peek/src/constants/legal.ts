/** Shared legal copy metadata for Privacy Policy / Terms (РБ, Закон № 99-З). */
export const LEGAL = {
  updatedAt: '15.10.2026',
  siteUrl: 'https://coffeepeek.by',
  serviceName: 'CoffeePeek',
  /**
   * Contact for PD requests and terms.
   * Product UI already tells users transactional mail is from this address —
   * confirm the mailbox works in the domain/mail panel (hoster / Timeweb / DNS).
   */
  contactEmail: 'info@coffeepeek.by',
  /** Operator under Law of the Republic of Belarus No. 99-Z. */
  operatorDisplayName:
    'физическое лицо Стефаненко Арсений Игоревич, оператор сервиса CoffeePeek (сайт coffeepeek.by)',
  operatorLegalDetails: '',
  operatorAddress: '',
  /** Infrastructure used for transparency / cross-border processing disclosure. */
  infra: {
    frontend: 'Vercel (размещение клиентской части Сайта; инфраструктура преимущественно за пределами Республики Беларусь)',
    backend: 'Timeweb (размещение серверной части API и связанных данных)',
    errors: 'Sentry (сбор технических логов и сведений об ошибках для диагностики)',
    analytics: 'PostHog (аналитика посещений и действий на сайте с согласия пользователя)',
  },
  pdAuthority:
    'Национальный центр защиты персональных данных Республики Беларусь (https://cpd.by)',
} as const;

export function legalOperatorBlock(): string {
  const parts = [LEGAL.operatorDisplayName];
  if (LEGAL.operatorLegalDetails) parts.push(LEGAL.operatorLegalDetails);
  if (LEGAL.operatorAddress) parts.push(`Адрес: ${LEGAL.operatorAddress}`);
  return parts.join('. ');
}
