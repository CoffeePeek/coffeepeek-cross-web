# PostHog для CoffeePeek: контракт web и инструкция для мобильных приложений

Дата сверки: 15.10.2026. Версия прикладной схемы событий: `1`.

Базовая web-реализация: commit `073bff2ac723f5c0afa5019f8710d1cd7fbad317` в `main`. В ней 37 прикладных событий плюс вручную отправляемый `$pageview`. Перед push прошли 43 test suites / 271 тест, typecheck и production build; в браузере проверены каталог, пустая выдача, карточка и авторизационный барьер. Эти результаты относятся к web, а не к будущей mobile-интеграции.

Этот файл можно передать разработчику или coding agent вместе с репозиторием Android/iOS. Он описывает уже реализованный сбор в **клиентском web-приложении `coffee-peek`** и требования к совместимой мобильной реализации. Мобильные приложения этим изменением не интегрированы. Их стек, навигацию и текущий сбор аналитики нужно определить по исходникам. Админское web-приложение не инструментировано.

Цель: видеть путь «функцию показали → человек попробовал → получил результат → вернулся к ней» и отличать отсутствие спроса от незаметности функции, ошибок и сложного интерфейса. Простого количества кликов для решения об удалении функции недостаточно.

## 1. Проект, настройки и границы интеграции

| Параметр | Значение |
| --- | --- |
| Проект | [CoffeePeek, EU, project 306763](https://eu.posthog.com/project/306763) |
| Адрес приёма событий | `https://eu.i.posthog.com` |
| Публичный Project token | `phc_ucb4dkookxkqiCgSkzz3MjDRCQa7HQxEWBroKJbdNjbK` |
| Web SDK | `posthog-js`; фактическую установленную версию фиксирует `coffee-peek/package-lock.json` |
| Web-конфигурация | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` в `.env.production`; образец в `.env.example` |
| Локальный web-сбор | Выключен, кроме явного `VITE_POSTHOG_ENABLE_DEV=true` |

`phc_…` — публичный токен для приёма событий. Его можно включить в клиентскую сборку. Он не предоставляет управление проектом, отчётами или пользователями. Личный API key `phx_…`, access/refresh token приложения и любые серверные секреты в приложение не добавлять. Адрес интерфейса `eu.posthog.com/project/306763` не является API host для SDK.

Мобильным приложениям использовать тот же проект, чтобы сопоставлять поведение между платформами. Задать отдельный `app` и сохранять единый внутренний ID пользователя при `identify`. Debug/staging не смешивать с production; по умолчанию отключить capture в debug, разрешать только явным локальным переключателем.

В web сохранены Vercel Analytics и Speed Insights. Новые события PostHog не являются системой серверных логов или сборщиком stack trace. Session replay, crash/error autocapture, surveys, feature flags и автоматический сбор всех нажатий в эту задачу не входят.

## 2. Источники истины в web-репозитории

Пути ниже относительны к `coffee-peek/`. При расхождении актуального кода и описания сначала проверить код, затем явно обновить контракт; не переименовывать существующие события молча.

| Файл | Ответственность |
| --- | --- |
| `src/lib/analytics.ts` | SDK, consent/readiness, общие свойства, идентификация, очередь, очистка URL, основной event map |
| `src/lib/analyticsConsent.ts` | Хранение согласия и его изменение |
| `src/components/ProductAnalytics.tsx` | Синхронизация авторизации, маршрута, версии сборки и согласия |
| `src/lib/analyticsContext.ts` | Стабильные типы страниц и категории API |
| `src/lib/analyticsError.ts` | Безопасная классификация ошибок |
| `src/lib/featureExposure.ts`, `src/hooks/useFeatureExposure.ts` | Видимость 10% / 500 мс и дедупликация показов |
| `src/utils/discoveryAnalytics.ts`, `src/hooks/useDiscoveryAnalytics.ts` | Поиск, фильтры, search ID, результаты и ошибки |
| `src/lib/engagementAnalytics.ts` | Карточки сущностей, источник перехода, взаимодействия, лента |
| `src/lib/checkInAnalytics.ts` | Жизненный цикл чекина, поля, попытки, этапы, корреляция |
| `src/hooks/useFavorites.ts`, `src/hooks/useRequireAuth.ts` | Избранное, отложенное действие после входа, авторизационный барьер |
| `src/api/core/httpClient.ts` | Один диагностический результат логического HTTP-запроса |
| `src/components/CookieBanner.tsx`, `src/pages/PrivacyPolicyPage.tsx` | Выбор согласия и отзыв |
| `docs/ANALYTICS.md` | Краткая инструкция для web и рецепты отчётов |

## 3. Общий контекст всех прикладных событий

SDK добавляет технические поля самостоятельно: время события, distinct ID, контекст устройства/ОС/сессии. Не создавать второй постоянный пользовательский или аппаратный идентификатор.

| Свойство | Web сейчас | Мобильная адаптация |
| --- | --- | --- |
| `app` | `coffee-peek` | `coffee-peek-android` или `coffee-peek-ios` — новые согласованные значения для mobile |
| `event_schema_version` | Число `1` | Число `1` для этого совместимого контракта |
| `app_version` | `VERCEL_GIT_COMMIT_SHA`, затем `APP_VERSION`, затем `local-<build timestamp>` | Версия и номер сборки, например `1.8.0+120`; без данных пользователя |
| `environment` | Vite mode; обычно `production` / `development` | Закрытый набор `production` / `staging` / `development` |
| `auth_state` | `guest` / `signed_in` | Тот же набор, состояние на момент события |
| `page_type` | Стабильная группа маршрута | Оставить это имя ради общих отчётов; значение соответствует назначению экрана |

Текущий словарь `page_type`: `landing`, `discovery`, `shops`, `map`, `coffees`, `roasters`, `feed`, `my_check_ins`, `profile`, `login`, `register`, `settings`, `privacy`, `terms`, `error`, `check_in_create`, `check_in_edit`, `shop_edit`, `shop_detail`, `roaster_detail`, `coffee_detail`, `user_profile`, `contributions`, `other`.

`city_slug` — **не общее свойство всех событий**. Сейчас оно опционально только у поисковых событий, берётся из публичного каталога городов после проверки выбранного города. Не определять его из точных координат специально для аналитики.

**Навигация:** web вручную отправляет `$pageview` с `$current_url` и `$pathname` при первом просмотре и смене pathname; изменение только query/hash не даёт ещё один pageview. У URL удаляются query/hash, но сам путь сохраняется, включая возможные динамические сегменты. `page_type` отдельно нормализован и не содержит ID.

**Предлагаемая mobile-адаптация:** вместо искусственного web URL отправлять один `$screen` через официальный метод `screen` SDK на фактический показ экрана. Использовать только стабильное имя из словаря, не title кофейни, имя пользователя, ID чекина или deep link. Общие свойства должны быть и на `$screen`. Не включать одновременно автоматический и ручной screen tracking. Объединённые отчёты строить по `page_type`; `$screen` является нативным дополнением, не существующим web-событием.

## 4. Полный прикладной event map

Ниже переносимый TypeScript-подобный контракт данных, **не код конкретного мобильного SDK**. На Kotlin/Swift/Dart реализовать эквивалентные enum/структуры. `?` означает опциональное поле, остальные обязательны. Общий контекст из раздела 3 добавляет сервис, а не каждый экран. Тип `string` отражает текущую web-схему; разрешённые фактические значения и правила приведены после кода.

```ts
type Entity = 'coffee_shop' | 'roaster' | 'coffee';
type FavoriteEntity = 'coffee_shop' | 'roaster';
type Catalog = 'discovery' | 'shops' | 'roasters' | 'coffees';
type ResultSource = 'list' | 'map' | 'favorites' | 'related';
type DetailEntry = ResultSource | 'direct';
type ErrorCategory = 'validation' | 'authentication' | 'permission'
  | 'not_found' | 'rate_limited' | 'server' | 'network' | 'cancelled' | 'unknown';
type SafeError = { error_category: ErrorCategory; status_code?: number };

type Search = {
  catalog: Catalog;
  search_id: string;
  source: 'list' | 'map' | 'favorites';
  has_query: boolean;
  query_length: number;
  filter_keys: string[];
  sort: string;
  nearby: boolean;
  city_slug?: string;
};

type CheckInKind = 'undecided' | 'visit' | 'home';
type CheckInMode = 'create' | 'edit';
type CheckInSource = 'global_create' | 'shop_detail' | 'direct' | 'my_check_ins';
type CheckInStep = 'type_picker' | 'shop_picker' | 'editor' | 'bean_picker';
type CheckInStage = 'shop_search' | 'shop_detail' | 'load' | 'photo_upload' | 'save' | 'bean_search';
type Flow = { flow_id: string; kind: CheckInKind; mode: CheckInMode; source: CheckInSource };

interface Events {
  feature_exposed: { feature: string; placement: string };
  sign_in_completed: { method: 'password' | 'google'; entry_point: 'login' | 'register' };
  sign_up_completed: { method: 'password' };
  auth_gate_shown: { feature: string };

  catalog_search_started: Search;
  catalog_results_viewed: Search & { result_count: number; is_empty: boolean; duration_ms: number };
  catalog_search_failed: Search & {
    duration_ms: number;
    failure_category: 'network' | 'authorization' | 'validation' | 'server' | 'unknown';
    http_status?: number;
  };
  catalog_item_opened: {
    entity_type: Entity; source: ResultSource; search_id?: string; position?: number;
  };
  filters_opened: { catalog: Catalog; placement: 'desktop' | 'mobile' };
  filters_applied: {
    catalog: Catalog; filter_keys: string[]; changed_filter_keys: string[]; action: 'apply' | 'reset';
  };
  map_interaction: {
    action: 'expanded' | 'collapsed' | 'loaded' | 'load_failed' | 'marker_selected'
      | 'search_selected' | 'zones_toggled' | 'zoomed' | 'nearby_loaded' | 'nearby_failed';
    result_count?: number; duration_ms?: number; enabled?: boolean;
  };
  geolocation_result: {
    placement: 'discovery' | 'filters' | 'map'; trigger: 'automatic' | 'user';
    outcome: 'available' | 'unavailable'; duration_ms?: number;
  };

  entity_detail_viewed: { entity_type: Entity; entry_point: DetailEntry; search_id?: string };
  shop_content_interacted: {
    section: 'photos' | 'menu' | 'hours' | 'roasters'; action: 'open' | 'close' | 'select';
  };
  shop_action_clicked: {
    action: 'directions' | 'share' | 'phone_copy' | 'email' | 'website' | 'instagram'
      | 'check_in' | 'edit' | 'report_issue';
    entry_point: 'shop_detail' | 'shop_contacts' | 'mobile_actions' | 'shop_header';
  };
  entity_content_interacted: {
    entity_type: 'coffee' | 'roaster';
    section: 'photos' | 'description' | 'roaster' | 'similar_coffees' | 'assortment' | 'shops' | 'contacts';
    action: 'open' | 'close' | 'select' | 'view_all' | 'website' | 'instagram' | 'share';
  };

  favorite_attempted: { entity_type: FavoriteEntity; is_favorite?: boolean };
  favorite_changed: {
    entity_type: FavoriteEntity; is_favorite: boolean; duration_ms?: number; resumed_after_auth?: boolean;
  };
  favorite_failed: { entity_type: FavoriteEntity; duration_ms: number } & SafeError;
  favorites_opened: { entry_point: 'profile' };

  check_in_start_attempted: { source: CheckInSource };
  check_in_flow_started: Flow;
  check_in_kind_selected: Flow;
  check_in_step_viewed: Flow & { step: CheckInStep; duration_ms: number };
  check_in_field_interacted: Flow & { field: string };
  check_in_submit_attempted: Flow & { attempt: number; duration_ms: number };
  check_in_validation_failed: Flow & {
    attempt: number; fields: string[]; validation_source: 'client' | 'server';
  };
  check_in_failed: Flow & {
    attempt: number; stage: CheckInStage; duration_ms: number; error_category: string; status_code?: number;
  };
  check_in_retry_clicked: Flow & { attempt: number; stage: CheckInStage };
  check_in_saved: Flow & {
    attempt: number; duration_ms: number; visibility: string; has_photos: boolean;
  };
  check_in_created: {
    kind: 'visit' | 'home'; visibility: string; has_photos: boolean;
    flow_id?: string; source?: string; duration_ms?: number;
  };
  check_in_cancelled: Flow & {
    step: CheckInStep; reason: 'close' | 'back' | 'map'; duration_ms: number;
  };

  feed_viewed: { result_count: number; is_empty: boolean };
  feed_action_clicked: { action: 'refresh' | 'load_more' | 'retry'; trigger: 'button' | 'gesture' | 'scroll' };
  feed_item_interacted: {
    action: 'author' | 'shop' | 'drink_photo' | 'photo' | 'like' | 'unlike' | 'home_detail';
    check_in_kind: 'shop' | 'home';
  };
  api_request_completed: {
    category: string; method: string; outcome: 'success' | 'failure'; duration_ms: number;
    auth_retried: boolean; status_code?: number; error_category?: ErrorCategory;
  };
  app_download_clicked: { channel: string };
}
```

Зарезервированные SDK-события `$pageview`, `$screen`, `$identify` не являются произвольными бизнес-событиями. Не имитировать `$identify` обычным `capture`: использовать штатную идентификацию SDK.

### 4.1. Значения, которые нельзя угадывать или расширять незаметно

- `visibility` фактически принимает `Private` / `Public` с заглавной буквы. В web event map тип шире (`string`), но значения приходят из этого API-контракта.
- `sort`: `recommended`, `name_asc`, `relevance`, `distance_asc`, `rating_desc`, `available_coffees_desc`, `price_asc`, `price_desc`, `newest`; неподдерживаемое значение преобразуется в `unknown`. Обычный список кофеен отмечается как `recommended`, хотя в POST-запросе `sort` не передаётся; текстовый поиск отмечается как `relevance`.
- `query_length`: длина строки после trim и схлопывания пробелов, ограничена сверху числом `100`. `has_query = query_length > 0`. Саму строку не отправлять. Для строгого совпадения с JS длиной на iOS считать UTF-16 code units, а не визуальные grapheme clusters.
- `position`: позиция карточки в выдаче, начиная с `1`; отсутствует, если позиции нет. Не ID объекта.
- `filter_count` сейчас **не отправляется web-кодом**. При необходимости вычислять из длины `filter_keys` в отчёте; добавление явного поля — отдельно документируемое расширение.
- `app_download_clicked.channel`: текущие каналы кнопок `google-play`, `app-store`, `apk`. Это переход к загрузке, не подтверждённая установка. В mobile не отправлять это событие при первом запуске; оно нужно только при наличии соответствующего действия.
- `check_in_failed.error_category` типизирован как `string`, но фактический классификатор выдаёт только `ErrorCategory` из контракта.
- `catalog_search_failed` имеет **другие имена и набор категорий**: `failure_category` / `http_status`. Не заменять их на `error_category` / `status_code` только на mobile. В общем отчёте нормализовать две схемы.
- `feed_item_interacted.check_in_kind=shop` соответствует `check_in_created.kind=visit`. Эти значения различаются намеренно в существующем контракте; учитывать при объединении данных.
- Авторизация Apple или новый мобильный entry point не входят в web-схему. Если функция реально есть, добавить именованное расширение в мобильный контракт и отчёты; не называть Apple-вход `google` и не переиспользовать неподходящий enum.

`filter_keys` и `changed_filter_keys` содержат только имена из списка ниже, сортируются, не содержат значения фильтра. `origin` преобразуется в `nearby`:

```text
city, tags, excludeTags, roasters, isOpen, minRating, isNew, equipments,
beans, brewMethods, priceRange, type, visitedOnly, favoritesOnly, nearby,
radiusKm, countries, productKind, productForm, brew, caffeine, roast,
acidity, processing, fermentation, taste, composition, weightGrams,
currency, minPrice, maxPrice, availabilityScope, availableOnly,
menu.brew, menu.currency, menu.minPrice, menu.maxPrice, menu.volumeMl,
budget.currency, budget.minDrinkPrice, budget.maxDrinkPrice,
budget.drinkVolumeMl, budget.minCoffeePrice, budget.maxCoffeePrice,
budget.coffeeWeightGrams
```

Текущая функция web проверяет наличие значения (не `undefined`, `null`, пустая строка/массив/объект); `false` и `0` считаются присутствующими. Поэтому длина этого списка — количество переданных непустых параметров, не обязательно число включённых переключателей. Отпечаток реальных критериев для дедупликации хранится только в памяти и никогда не отправляется, даже в виде хеша.

Поля чекина нормализуются до категорий: `note`, `rating_coffee`, `rating_service`, `rating_place`, `rating`, `date`, `shop`, `drink`, `visibility`, `photos`, `brew_method`, `bean`, `dose`, `brew_duration`, `rating_taste`, `form`. Неизвестное поле → `form`. Текст, оценка, дата посещения, дозировка и рецепт не включаются: отправляется только факт взаимодействия с категорией поля. Для серверных ошибок нормализовать названия полей; не пересылать произвольные ключи или текст ответа.

Категории API: `authentication`, `favorites`, `check_ins`, `photos`, `coffees`, `roasters`, `shops`, `feed`, `catalog`, `profile`, `other`. Метод — контролируемый HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE` в текущем клиенте). Не отправлять исходный endpoint.

### 4.2. Точки вызова и значение события

| Группа | Когда отправлять | Чего событие не доказывает |
| --- | --- | --- |
| Auth | `sign_in_completed` / `sign_up_completed` после успешного ответа сервера; `auth_gate_shown` когда действие реально ведёт на вход | Восстановление сессии не является новым входом. Google API не различает новый аккаунт: web отправляет только `sign_in_completed`, в том числе с `entry_point=register` |
| Search | Одна пара start → results **или** failed на логический набор критериев | Пагинация, refetch и возврат фокуса не являются новыми поисками |
| Filters | Открытие панели; apply/reset после действия с фильтрами | Apply не означает успешную серверную выдачу |
| Card/detail | `catalog_item_opened` по нажатию; `entity_detail_viewed` после успешной загрузки сущности | Клик не равен успешно открытой карточке |
| Shop/entity | Открытие/закрытие/выбор раздела; действие с контактом, маршрутом, share, check-in | Маршрут не подтверждает визит; share не подтверждает отправку; email/website не подтверждают коммуникацию |
| Favorites | attempted до auth; changed только после сервера; failed при ошибке | Оптимистическая перерисовка звёздочки не является changed |
| Check-in | Отдельные старт, выбранный тип, видимый шаг, первый ввод категории, submit, validation/failure/retry, saved/created/cancelled | Взаимодействие с полем не означает заполненный шаг. Saved включает редактирование |
| Feed | viewed после первой страницы; action по refresh/load_more/retry; item по действию | `result_count` — первая страница, не весь объём ленты. Like/unlike здесь означает попытку |
| API | Завершение логической операции централизованного клиента | Фоновый запрос — диагностика, а не использование функции |

`auth_gate_shown.feature` фактически используется как `favorites`, `favorites_filter`, `visited_filter`, `check_in`, `edit_shop`, `unspecified`. Сохранять семантику; новые именованные причины описывать в мобильном контракте. `unspecified` — fallback старых вызовов без метки, не предпочтительная метка для новых точек.

## 5. Показы функций и правила дедупликации

Web отправляет `feature_exposed` при видимости минимум **10% элемента в течение 500 мс подряд**, когда вкладка активна. Краткое прокручивание и невидимый элемент не считаются показом. Если IntersectionObserver недоступен, показ не угадывается. После позднего согласия измеряется только то, что видно сейчас.

Ключ дедупликации web: поколение identity/consent + ключ посещения маршрута + `feature` + `placement`. Повторные карточки, responsive-копии и повторный запуск эффекта не создают дополнительные показы той же функции на этом посещении. Показ означает доступность функции на экране, не доказанное внимание к ней.

Фактические пары в web:

| `feature` | `placement` |
| --- | --- |
| `search`, `filters` | `discovery`; в отдельных каталогах `shops`, `roasters`, `coffees` (компонент допускает также `discovery`) |
| `shop_catalog`, `roaster_catalog` | `discovery`, `catalog` |
| `coffee_catalog` | `catalog` |
| `map` | `home` для embedded map, иначе `discovery` |
| `favorites` | `coffee_shop_card`, `roaster_card`, `catalog_card`, `shop_detail`, `profile` |
| `check_in` | `global_create`, `shop_detail` |
| `home_check_in` | `check_in_type_picker` |
| `directions`, `share`, `shop_roasters`, `shop_hours`, `shop_contacts`, `shop_photos`, `shop_menu` | `shop_detail` |
| `coffee_offers`, `similar_coffees`, `coffee_photos`, `coffee_roaster` | `coffee_detail` |
| `roaster_assortment`, `roaster_shops`, `roaster_photos`, `roaster_contacts` | `roaster_detail` |
| `feed`, `feed_shop_check_in`, `feed_home_check_in` | `feed` |

**Mobile:** повторить критерий 10% / 500 мс через фактическую видимость native view, lazy list и foreground lifecycle. Recomposition, повторный `onAppear`, поворот устройства и повторный bind ячейки не должны дублировать показ. Не считать перекрытый modal/sheet экран видимым, если пользователь не может взаимодействовать с элементом. Ключ screen visit должен различать новый явный вход на экран и его обычную перерисовку. Отдельное появление нескольких карточек не является несколькими `feature_exposed` одной функции.

`placement=mobile_actions` в `shop_action_clicked` уже есть в web и обозначает его компактную панель действий; это не универсальный признак Android/iOS. Платформу отличать через `app`. Для эквивалентных экранов сохранить существующие пары feature/placement; если UI принципиально другой, добавить документированные новые значения, не менять смысл старых.

## 6. Search ID, flow ID, время и повторные попытки

### Поиск

1. Создать `search_id` при изменении нормализованного запроса, фильтров, сортировки, каталога или source. Начальная выдача без запроса тоже является набором критериев.
2. Web использует `search-<base36 timestamp>-<base36 counter>`; корреляционный ID не содержит запрос, user ID или координаты. Для переносимой совместимости можно использовать тот же формат; мобильный случайный ID тоже допустим, если все его потребители это поддерживают. Web router сейчас валидирует именно формат `search-[a-z0-9]{1,12}-[a-z0-9]{1,12}`.
3. Однократно отправить started; после завершения именно этих критериев — results либо failed. Не принимать старый/placeholder результат другого поиска. Не отправлять следующую страницу как новый results того же поиска.
4. `result_count` — количество подходящих результатов по доступным данным каталога: backend total, если он есть; для локального списка — длина отфильтрованного списка. В discovery web складывает число подходящих кофеен и обжарщиков. Не выдавать размер загруженной страницы за total.
5. Пронести `search_id` и source в `catalog_item_opened` и `entity_detail_viewed`. Source результата `list` / `map` / `favorites` / `related`; без известного входа detail получает `direct`.
6. `duration_ms` поиска — время от создания набора критериев до разрешения его первой выдачи/ошибки, не задержка всей сессии. Позднее согласие не должно искусственно увеличивать уже измеренное время запроса.

### Создание/редактирование чекина

1. `check_in_start_attempted` отправляется до проверки авторизации на нажатии create. Если нужен вход, следом `auth_gate_shown(feature=check_in)`; незапущенную форму не считать успешным стартом flow.
2. Создать временный `flow_id` и время начала для одного пользовательского процесса. Web использует UUID или случайный `checkin-…`, хранит их в памяти/navigation state; `started_at` не входит в payload. При чтении state web отклоняет повреждённый или старше 24 часов контекст.
3. Из глобального создания начать с `kind=undecided`, затем `check_in_kind_selected` с `visit` или `home`. Из карточки кофейни сразу `visit`, source `shop_detail`. Для прямого входа fallback `direct`, для редактирования из дневника `my_check_ins`.
4. `check_in_step_viewed` — первое фактическое появление каждого шага в данном tracker. Шаги редактора не выдумывать, если форма отображается на одном экране. `check_in_field_interacted` — первая модификация категории поля в этом tracker; содержимое не отправлять.
5. `attempt` начинается с `0` до submit и увеличивается на каждое нажатие сохранить. На повторном submit web сначала регистрирует retry стадии `save`, затем submit с новым номером. Ошибка загрузки до submit может иметь `attempt=0`.
6. Не создавать новый flow при валидации, загрузке фотографии или повторе сохранения. Указывать реальную `stage`: `photo_upload`, `save`, `load`, `shop_search`, `shop_detail`, `bean_search`.
7. `check_in_saved` — после подтверждения сервера, и для create, и для edit. `check_in_created` — только новое создание, один раз в точке успешной мутации. В одном успешном create допустимы оба события; не суммировать их как два чекина.
8. Для `mode=edit` событие created запрещено. `visibility` и `has_photos` брать из подтверждённого результата/сохранённых данных, не из нажатия кнопки.
9. `check_in_cancelled` только при явном close/back/map exit, пока flow не завершён. Unmount, уход в фон, процесс kill или обрыв сети не доказывают отмену. Отсутствующий следующий шаг анализировать как drop-off воронки.
10. `duration_ms` событий flow — прошедшее время **с начала flow**, включая исправление формы и ожидание, не latency последнего HTTP-запроса. Для API latency есть отдельное событие.

**Mobile дополнительно:** сохранить flow в state/ViewModel так, чтобы поворот экрана не создавал новый flow и не удваивал успех. Для восстановления черновика после завершения процесса явно определить начало нового flow; по умолчанию начать новый, не отправлять старые события задним числом. При восстановлении того же живого процесса сохранить счётчик попыток и dedupe. Для времён операций предпочитать monotonic clock; переход устройства между часовыми поясами не должен давать отрицательные duration.

### Избранное и запросы API

- `favorite_attempted.is_favorite` — намерение **получить** это состояние. Если состояние неизвестно, поле можно опустить. Для гостя web намеревается добавить (`true`), сохраняет бизнес-намерение, открывает вход, затем возобновляет действие; `favorite_changed.resumed_after_auth=true` отмечает этот случай.
- Не дублировать attempted при автоматическом возобновлении намерения. Блокировать второй запрос для того же элемента, пока первый выполняется. Не отправлять success от старого аккаунта после смены пользователя.
- В API измерять одну логическую операцию вместе с 401 → refresh token → повтор. Успешный повтор отмечать `auth_retried=true`, не создавать три события для одной операции. Проактивное обновление токена до запроса само по себе не означает `auth_retried=true` в web.
- Retry верхнего слоя (в web React Query) — отдельный HTTP request result. Бизнес-события поиска/сохранения дедуплицируются своим tracker, поэтому их нельзя напрямую суммировать с HTTP-ошибками.
- Отменённые запросы и ответы старого account scope исключать из API/favorite диагностик. Прямые uploads в object storage web HTTP-клиентом не измеряются; их ошибки отражаются стадией `photo_upload`.

## 7. Классификация ошибок без содержимого

| Ошибка | `error_category` в API/favorites/check-in |
| --- | --- |
| Отмена (`AbortError` в web, native cancellation на mobile) | `cancelled`; API/favorite событие при этом не отправляется |
| HTTP 401 | `authentication` |
| HTTP 403 | `permission` |
| HTTP 404 | `not_found` |
| HTTP 429 | `rate_limited` |
| HTTP ≥ 500 | `server` |
| Другой HTTP ≥ 400 | `validation` |
| Сетевая ошибка | `network` (`TypeError` в web; на native определить транспортный тип, не анализировать текст) |
| Всё остальное | `unknown` |

`status_code` принимается только как целое число 100–599. Для search-классификатора web: 401/403 → `authorization`, ≥500 → `server`, остальные ≥400 → `validation`, транспортная ошибка → `network`, иначе `unknown`; поле статуса называется `http_status`.

Не отправлять `exception.message`, stack trace, response body, request body, URL, headers, названия файлов/фотографий и значения формы. Ошибка в аналитике не должна мешать авторизации, навигации или сохранению данных.

## 8. Согласие и идентификация

### Что реализовано в web

- Состояния согласия: неизвестно, `accepted`, `declined`; ключ `coffeepeek.analyticsConsent.v1`. Старое согласие на hosting metrics не считается согласием на PostHog.
- До `accepted` SDK лениво не загружается, события не захватываются. Нужны также key/host, разрешённая среда и завершённое восстановление авторизации.
- На принятии согласия синхронизируются актуальный пользователь и текущая страница. Одновременная загрузка SDK защищена revision-проверкой; поздний callback не должен отменить более новое решение.
- Гость получает штатный anonymous ID SDK. Авторизованный пользователь идентифицируется **внутренним backend user ID**, без email/имени/person properties.
- При выходе/смене уже идентифицированного аккаунта выполняется reset. После reset повторно применяется актуальное согласие; в текущем JS SDK reset сбрасывает и SDK consent.
- Отзыв через privacy экран останавливает capture, очищает прикладную очередь, сбрасывает identity и включает SDK opt-out. Следующее принятие не должно восстановить предыдущего пользователя из старой очереди.
- Очередь до готовности SDK хранится только в памяти, максимум 50 событий, только когда согласие уже получено и интеграция активна. При смене user ID/отзыве очищается. Capture возвращает «SDK/очередь принял событие», не подтверждение доставки сервером.

### Требования для mobile

Реализовать тот же жизненный цикл в одном сервисе. Решение о согласии хранить отдельно от SDK и повторно применять после reset/restart. Не инициализировать SDK до выбора `accepted`; отдельно отключить auto-init из manifest/plist/provider, если используемый wrapper его включает. При отказе не отправлять само событие отказа.

При входе гость → аккаунт использовать штатный `identify` для связи текущей анонимной активности с внутренним backend ID. При аккаунт A → B сначала reset, затем B; не использовать alias и не связывать A/B. Одинаковый backend ID на web/Android/iOS позволяет анализировать одного зарегистрированного человека между платформами. Не добавлять префикс платформы к user ID. Согласие на одном устройстве не считать автоматически согласием на другом.

Offline очередь — отдельная от 50-событийной startup-очереди задача мобильного адаптера. **Предлагаемые мобильные ограничения:** максимум 1000 событий, срок хранения до 24 часов, ограничение размера в байтах, удаление самых старых при переполнении, отсутствие содержимого пользователя. Это не заявленные настройки текущего web SDK. Если выбранный SDK уже управляет очередью, использовать его, не отправлять копии параллельной ручной HTTP-очередью.

Перед реализацией проверить реальные гарантии выбранной версии: сохраняется ли очередь на диск, что очищают reset/opt-out, как прекращаются scheduled flush и retry. При отзыве удалить pending события из собственной и SDK-очереди; при смене identity не переатрибутировать старые события новому пользователю. Не выполнять flush перед отзывом «для сохранения статистики». Уже отправленные/находящиеся в полёте запросы нельзя обещать отозвать с сервера; критерий — прекратить новые захваты/отправки и очистить доступную очередь.

Offline retry должен сохранять исходное время и event ID для дедупликации SDK, а не создавать новое бизнес-событие при каждом подключении. Не блокировать main thread, запуск приложения или завершение пользовательского действия на отправке аналитики. Никакого обещания exactly-once delivery: сеть и завершение процесса могут потерять событие.

## 9. Настройки SDK: web сейчас и нативная адаптация

Точные web-параметры из `analytics.ts`:

```ts
{
  api_host: 'https://eu.i.posthog.com',
  defaults: '2026-08-30',
  person_profiles: 'identified_only',
  persistence: 'localStorage',
  opt_out_capturing_by_default: true,
  opt_out_persistence_by_default: true,
  capture_pageview: false,
  capture_pageleave: false,
  autocapture: false,
  capture_dead_clicks: false,
  rageclick: false,
  capture_exceptions: false,
  capture_performance: false,
  disable_session_recording: true,
  disable_surveys: true,
  disable_external_dependency_loading: true,
  advanced_disable_flags: true,
  save_campaign_params: false,
  save_referrer: false,
  disable_capture_url_hashes: true,
  mask_personal_data_properties: true,
  custom_personal_data_properties: [
    'token', 'access_token', 'refresh_token', 'id_token', 'code', 'email',
    'q', 'query', 'search', 'filters', 'origin',
    'lat', 'lon', 'lng', 'latitude', 'longitude'
  ],
  internal_or_test_user_hostname: null
  // before_send: повторная проверка consent/active и sanitizeAnalyticsEvent
}
```

Web sanitizer рекурсивно очищает query/hash у строковых свойств, имя которых оканчивается на `url`, `referrer`, `pathname`, `href`; удаляет attribution-поля `utm_*`, `ph_keyword`, gclid/fbclid/msclkid/dclid/gbraid/wbraid, включая SDK-derived поля. Он сохраняет специальные объекты, например timestamp Date, вместо превращения их в пустой объект.

**Эти JS-имена нельзя копировать в Swift/Kotlin-конфиг.** Для native нужна эквивалентная политика, сверенная с установленной версией SDK:

| Политика | Android: проверенные точки официального SDK | iOS: проверенные точки официального SDK |
| --- | --- | --- |
| Setup | `PostHogAndroidConfig(apiKey = ..., host = ...)`, `PostHogAndroid.setup(...)` | `PostHogConfig(projectToken: ..., host: ...)`, `PostHogSDK.shared.setup(...)` |
| Consent | `config.optOut`, `PostHog.optIn()`, `PostHog.optOut()` | `config.optOut`, `PostHogSDK.shared.optIn()`, `PostHogSDK.shared.optOut()` |
| Ручные экраны | `PostHog.screen(...)`; `captureScreenViews=false` | `PostHogSDK.shared.screen(...)`; `captureScreenViews=false` |
| Автособытия lifecycle | `captureApplicationLifecycleEvents=false` | `captureApplicationLifecycleEvents=false` |
| Deep link | `captureDeepLinks=false` | Не подключать автоматический захват deep link; не передавать URL из navigation callback |
| Replay | `sessionReplay=false` | `sessionReplay=false` |
| Автоматические взаимодействия | Не подключать autocapture-инструментацию | `captureElementInteractions=false` |
| Feature flags | `preloadFeatureFlags=false`, `sendFeatureFlagEvent=false`; не вызывать flag API | `preloadFeatureFlags=false`, `sendFeatureFlagEvent=false`; не вызывать flag API |
| Surveys | Не подключать surveys; проверить config выбранной версии | `surveys=false` |
| Profiles | `personProfiles = PersonProfiles.IDENTIFIED_ONLY` | `personProfiles`: выбрать identified-only case в enum установленной версии |
| Очередь | `maxQueueSize`, `flushAt`, `flushIntervalSeconds`, `maxBatchSize`, `maxRetries` | Те же имена конфигурационных свойств опубликованы в API iOS SDK; сверить типы/единицы |
| Ошибки/логи | Автоматический error tracking отключить (`errorTrackingConfig.autoCapture=false` в текущей Android-документации); не подключать logs | Не включать error tracking/log capture; проверить настройки `errorTrackingConfig`/`logs` установленной версии |

Android-названия проверены по [официальной Android-документации](https://posthog.com/docs/libraries/android). iOS-названия — по [официальной документации конфигурации](https://posthog.com/docs/libraries/ios/configuration), [использования](https://posthog.com/docs/libraries/ios/usage) и [публичному API SDK](https://github.com/PostHog/posthog-ios/blob/main/api/posthog-ios.public-api.txt). Методы reset/consent не считать универсальной гарантией очистки очереди: [спецификация SDK отмечает зависимость состояния opt-out после reset от платформы](https://github.com/PostHog/sdk-specs/blob/main/openspec/specs/is-opt-out/spec.md).

Если проект React Native, Flutter или Kotlin Multiplatform, использовать его официальный wrapper, не подключать второй экземпляр SDK независимо: [React Native](https://posthog.com/docs/libraries/react-native), [Flutter](https://posthog.com/docs/libraries/flutter), [KMP](https://posthog.com/docs/libraries/kmp). До выбора literal-параметров прочитать документацию фактически установленной версии. Версию закрепить в lockfile/каталоге зависимостей проекта, не брать случайный номер из этой инструкции.

Отдельно проверить сетевые запросы remote config/flags/surveys: отключённый capture не всегда означает отсутствие любых SDK-запросов. Требование до согласия выполняется отсутствием SDK setup/auto-init. После согласия включать только необходимые функции и документировать служебные запросы выбранного SDK.

## 10. Переносимый AnalyticsService

Публичные методы ниже — **псевдоинтерфейс приложения**, не существующие методы PostHog SDK. Его реализация прячет выбранный SDK и даёт тестируемый fake/no-op адаптер.

```ts
type Consent = 'unknown' | 'accepted' | 'declined';
type CaptureResult = 'accepted' | 'disabled' | 'dropped';
type VisibilityState = {
  visibleFraction: number; // от 0 до 1
  foreground: boolean;
  unobscured: boolean;
  screenVisitId: string;
};
type Context = {
  app: 'coffee-peek-android' | 'coffee-peek-ios';
  app_version: string;
  environment: 'production' | 'staging' | 'development';
  page_type: string; // из закрытого словаря
};

interface AnalyticsService {
  // Восстановить решение до любого setup; не использовать старое legacy-согласие.
  restoreConsent(): Promise<Consent>;
  setConsent(value: 'accepted' | 'declined'): Promise<void>;
  // null означает гостя. authRestoring=true приостанавливает capture.
  syncIdentity(userId: string | null, authRestoring: boolean): Promise<void>;
  setContext(context: Context): void;
  track<K extends keyof Events>(name: K, properties: Events[K]): CaptureResult;
  screenShown(stableScreenName: string, screenVisitId: string): void;
  featureVisible(feature: string, placement: string, visibility: VisibilityState): void;
}
```

Порядок работы `track`: проверить consent/среду/auth readiness → валидировать event и allowlist свойств → зафиксировать context и identity generation **на момент события** → безопасно передать адаптеру или в bounded startup queue → вернуть результат без исключения в продуктовый код. Не разрешать вызывающему коду переопределять `app`, `environment`, `auth_state` произвольным payload.

Состояния сервиса: `disabled` → `initializing` → `ready`; revoke/смена аккаунта инвалидируют асинхронные callback через generation/revision. Startup queue допускается только после согласия. При срабатывании impression tracker отмечать показ отправленным только если `track` принял событие. Иначе дождаться readiness и заново проверить, что элемент ещё видим.

Не плодить capture-вызовы в каждом composable/view без координации. Поиск и flow держать в отдельном tracker/ViewModel, успешные мутации измерять в одном владельце операции, HTTP-диагностику — в общем сетевом слое. Контекст города, маршрута и авторизации должен относиться к завершившейся операции, а не случайному новому экрану после async callback.

## 11. Примеры payload

Это примеры **прикладных данных** для адаптера, не инструкция отправлять их вручную в HTTP ingest. SDK добавит timestamp/distinct ID. Примеры используют предложенный mobile `app`; значения времени и counts иллюстративные.

```json
{
  "event": "catalog_results_viewed",
  "properties": {
    "app": "coffee-peek-android",
    "event_schema_version": 1,
    "app_version": "1.8.0+120",
    "environment": "production",
    "auth_state": "guest",
    "page_type": "discovery",
    "catalog": "shops",
    "search_id": "search-m123abc-1",
    "source": "list",
    "has_query": true,
    "query_length": 6,
    "filter_keys": ["city", "isOpen"],
    "sort": "relevance",
    "nearby": false,
    "result_count": 12,
    "is_empty": false,
    "duration_ms": 380
  }
}
```

```json
{
  "event": "check_in_saved",
  "properties": {
    "app": "coffee-peek-ios",
    "event_schema_version": 1,
    "app_version": "1.8.0+120",
    "environment": "production",
    "auth_state": "signed_in",
    "page_type": "check_in_create",
    "flow_id": "6a78ab95-8bd0-46fe-a14c-4020d2609b19",
    "kind": "home",
    "mode": "create",
    "source": "global_create",
    "attempt": 2,
    "duration_ms": 42000,
    "visibility": "Private",
    "has_photos": true
  }
}
```

После такого нового сохранения дополнительно допустимо `check_in_created` с `kind`, `visibility`, `has_photos`, тем же `flow_id`, `source`, `duration_ms`. Для редактирования — только saved с `mode=edit`.

```json
{
  "event": "api_request_completed",
  "properties": {
    "app": "coffee-peek-android",
    "event_schema_version": 1,
    "app_version": "1.8.0+120",
    "environment": "production",
    "auth_state": "signed_in",
    "page_type": "check_in_create",
    "category": "check_ins",
    "method": "POST",
    "outcome": "failure",
    "duration_ms": 850,
    "auth_retried": false,
    "status_code": 503,
    "error_category": "server"
  }
}
```

## 12. Запрещённые и необязательные данные

В прикладные события не включать: email/имя/телефон; пароли и токены; тексты поиска, отзывов, заметок и полей; точные координаты или origin; адрес/контакт кофейни; URL/deep link с параметрами; фотографии, их имена и содержимое; private check-in ID; API request/response body; stack trace; рекламные/аппаратные ID; произвольные значения пользовательских фильтров. Внутренний backend user ID допустим только для SDK identity. Корреляционные search/flow ID генерируются независимо от пользовательских данных.

Не добавлять «на всякий случай» всю модель пользователя, кофейни или формы. Для данных допускаются закрытые категории, boolean, counts, durations и проверенный публичный city slug. Содержимое payload проверять **до записи в offline очередь**, а не только перед сетью. SDK metadata тоже проверить в тестовом сетевом перехвате: нельзя ограничиться просмотром параметров собственного `track`.

## 13. Отчёты для решений о функциях

Это определения для настройки, **не уже созданные dashboards в облаке**. Публичного токена хватает на ingestion, но не на сохранение insights через management API. Настройку выполнять в авторизованном PostHog либо отдельно через разрешённый доступ. Доставка тестового HTTP-события не доказывает корректность всей инструментализации приложения.

Общие фильтры: `environment=production`, нужные `app`, исключить `coffeepeek_integration_test`, debug/preview/test-пользователей. Adoption считать по уникальным людям; для сравнения платформ дополнительно разделять по `app`. Из-за общего identify один человек на нескольких платформах может входить в несколько platform breakdown, поэтому не складывать их как уникальную аудиторию всего продукта.

| Отчёт | Определение |
| --- | --- |
| Доступность функции | Unique people с `feature_exposed` за 28 дней, breakdown `feature` / `placement` / `app` |
| Показ → использование | Воронка exposure конкретной функции → соответствующее действие, в одной сессии; рядом абсолютные количества людей |
| Качество поиска | started → results → detail viewed, удерживать `search_id` постоянным; breakdown catalog/source/has_query/city/app |
| Пустая выдача | results с `is_empty=true` / все results; отдельно failed / started, не смешивать ошибку и ноль результатов |
| Карта против списка | Detail viewed по `entry_point=map/list`; сравнивать с показами соответствующей функции и переходами |
| Избранное | Exposure → attempted → changed с `is_favorite=true`; отдельно guest → auth gate → sign-in → resumed change; затем favorites_opened или item_opened с source=favorites |
| Завершение чекина | flow_started → step_viewed(editor) → submit_attempted → saved; постоянный `flow_id`, `mode=create`; breakdown source/kind/app |
| Проблемы формы | Validation по field; failed по stage; retry → saved; медиана/p90 flow duration, количество попыток |
| Вклад домашнего дневника | created с kind=home против visit: уникальные авторы, повторное создание, успешность flow |
| Полезность меню/фото/контактов | Exposure раздела → corresponding interaction; последующий directions/check-in в разумном временном окне |
| Лента | Exposure → item interaction, разбивка action и shop/home; обычная фоновая загрузка не равна активности |
| Повторное использование | Retention: meaningful action → то же действие в последующий день/сессию; окна 7 и 28 дней |
| Удержание продукта | Сравнить новые пользователи функции и показанные, но не использовавшие её; возврат в дни 1–7 / 1–28 при сопоставимом источнике/периоде/auth |
| Надёжность | api failure rate и p50/p95 duration по category/method/app_version/app; отдельно auth_retried |

Meaningful action: успешное detail view, подтверждённое добавление favorite, created чекина, реальное взаимодействие с лентой или разделом. Не брать фоновые API calls и автоматические показы как доказательство полезности функции.

Старт глобального чекина имеет `kind=undecided`; фильтр `kind=home` на первом шаге удалит такие flow из воронки. Ветвление считать на `check_in_kind_selected` или по последующему успешному событию с тем же flow ID. Контактные/directions события не содержат search_id: с ними допустима временная связь в одной сессии, но не утверждение о конкретном поиске как причине действия.

Низкая доля использования при малом числе показов может означать проблему обнаружения. Много попыток и мало успехов — проблему UX/ошибок. Небольшой сегмент с регулярными возвратами — возможную нишевую ценность. Для 7/28 дней нужны завершённые окна наблюдения. Корреляция функции с удержанием не доказывает причинность; решение о развитии проверять экспериментом/исследованием. Отказавшиеся от аналитики и потерянные сетью события в этих данных отсутствуют.

Практика настройки в PostHog: [funnels](https://posthog.com/docs/product-analytics/funnels), [retention](https://posthog.com/docs/product-analytics/retention). Сохранить выбранные окна в описаниях reports, чтобы разные разработчики не сравнивали несовместимые определения.

## 14. Критерии приёмки мобильной реализации

1. **До согласия:** fresh install, неизвестно/declined, cold/warm start — ни ingest, ни flags/replay/survey/remote-config запросов из SDK; нет дисковой аналитической очереди. Отдельно проверить auto-init wrapper.
2. **После согласия:** текущий экран приходит один раз с общим контекстом; debug включается только явно и не маркируется production.
3. **Отзыв:** capture сразу прекращается; queued события удалены и не уходят после следующего запуска/возврата сети. Повторное принятие не отправляет действия из периода отказа.
4. **Identity:** гость → A связывается штатно; A → logout → B не объединяет аккаунты; восстановление сессии не даёт sign_in_completed; переключение аккаунта во время запроса не отдаёт старый результат новому.
5. **Показы:** 100 мс на экране не считаются; 10% / 500 мс в foreground считаются; фон, перекрытый экран, scroll/recompose/rotation/rebind и responsive-копии не удваивают impression.
6. **Поиск:** один started и один settled result для критериев; pagination/refetch без дублей; новый запрос даёт новый ID; старый ответ не завершает новый поиск; card → detail сохраняет source/ID; ноль отделён от ошибки.
7. **Избранное:** attempted → auth gate → login → server-confirmed changed с resumed_after_auth; повторное нажатие во время pending не порождает дубликаты; ошибка не считается changed.
8. **Чекин:** visit/home, client/server validation, upload/save failure, retry, cancel; один flow, корректный attempt, один saved и один created для create; edit без created; поворот/возврат из photo picker не удваивает события.
9. **Длительности:** flow duration и latency API различимы; значения неотрицательные; refresh+повтор — одна логическая API операция с auth_retried; cancelled/stale исключены.
10. **Payload:** перехват реальных исходящих SDK-запросов подтверждает отсутствие запрещённых данных, включая metadata, deep links и queued events. Схемные тесты ловят неизвестные имена/enum/ключи.
11. **Offline:** после согласия допустимые события переживают временный offline согласно принятой политике; retry не повторяет бизнес-действие; ограничения размера/TTL работают; смена identity и revoke очищают очередь.
12. **Отказоустойчивость:** заблокированный домен PostHog, ошибка setup или отказ хранилища не ломают запуск, login, поиск, форму и сохранение. Main thread не ждёт сеть аналитики.
13. **PostHog Activity:** после локальных проверок увидеть разрешённые тестовые события в EU-проекте, проверить props и последовательности, не создавать настоящие пользовательские данные ради smoke test. Зафиксировать версии SDK и результаты platform build/typecheck/test/lint, доступные репозиторию.

Автотесты нужны для consent/identity/очереди, privacy schema, дедупликации, flow/search state и error mapping; UI/network smoke покрывает интеграцию с жизненным циклом конкретной платформы. В PR указать реальные пройденные проверки и ограничения; не писать «mobile готов», пока эта реализация и проверки не выполнены.

## 15. Готовое задание для coding agent мобильного репозитория

Скопируйте этот файл в мобильный репозиторий как `docs/POSTHOG-MOBILE-IMPLEMENTATION.md`, затем используйте следующий текст:

```text
Добавь PostHog в это мобильное приложение по полному контракту
docs/POSTHOG-MOBILE-IMPLEMENTATION.md. Нужна реализация и проверка, не только план.

Сначала прочитай инструкции репозитория и определи реальный стек, навигацию,
авторизацию, API client и существующий analytics SDK. Сохрани чужие изменения.
Используй официальный SDK этого стека и проверь текущие методы/параметры по его
официальной документации. Не переносить literal JS-конфиг в native.

Настрой EU-проект и публичный token из документа. Добавь один типизированный
AnalyticsService, согласие до SDK setup, identity/reset и безопасную bounded queue.
Сохрани точные business event names/props/enum и разделение показ/попытка/успех.
Подключи реальные функции: поиск/фильтры/карта, карточки кофеен/кофе/обжарщиков,
фото/меню/контакты/маршруты, избранное и auth gate, visit/home check-in create/edit,
ленту, категории ошибок и latency общего API client.

Не выдумывай отсутствующие экраны и не добавляй продуктовые функции ради событий.
Для отсутствующих возможностей явно укажи «не применимо». Мобильные отличия
(например Apple auth, другие native placements) оформи как документированное
расширение, не подменяя смысл существующих значений. Используй app по платформе,
screen tracking без дублей и общий page_type для сопоставимости с web.

Запрети raw text, coordinates, tokens, payloads и не включай replay/autocapture/
crash logging/flags/surveys. Реализуй search/flow correlation и dedupe через
жизненный цикл платформы. Проверь согласие, logout/account switch, offline/retry,
поворот/возврат в foreground, реальные SDK payload и влияние отказа аналитики.

Выполни доступные build/test/lint проверки. Обнови документацию мобильного проекта
со списком внедрённых точек, SDK version, изменений схемы, проверок и ограничений.
Не утверждай, что dashboards созданы или релиз опубликован, если этого не делал.
В финале дай список изменённых файлов, результатов проверок и оставшихся пунктов.
```
