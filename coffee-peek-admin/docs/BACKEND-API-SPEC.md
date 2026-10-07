# CoffeePeek Admin — действующие контракты API

Обновлено 4 октября 2026 после сверки с CoffeePeek-NET и исправления связок клиента. Это описание подключённого API, а не список отсутствующих возможностей. Полный исходный реестр маршрутов и потребителей сохранён в `../../docs/API-ENDPOINTS-2026-10-04.csv`; результаты исправлений — в `../../docs/API-IMPLEMENTATION-2026-10-04.md`.

## Транспорт и авторизация

Все запросы приложения проходят через `src/api/core/httpClient.ts`. В development используется same-origin `/backend` с Vite proxy; production читает `VITE_API_URL`. Access token хранится в памяти, refresh cookie — HttpOnly. Refresh выполняется interceptor; ручная обёртка refresh не нужна.

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/tokens` | Вход: JSON `{email,password}` |
| PUT | `/api/tokens` | Refresh cookie → новый access token |
| DELETE | `/api/tokens` | Завершение текущей сессии |
| SignalR | `/realtime/session` | Уведомления об отзыве сессии |

Policy `Moderator` включает Moderator и Admin. Policy `Admin` разрешает только Admin. Owner API требует владельца и проверяет принадлежность кофейни. Gateway и контроллеры проверяют права независимо; наличие кнопки в интерфейсе не заменяет серверную проверку.

## Публичные адреса и административные ID

У кофейни, обжарщика и пользователя публичный адрес использует **slug**. Публичные чтения по UUID не поддерживаются. Административные DTO используют **UUID**; ID отзывов, заявок, фотографий и чек-инов также остаются UUID.

| Метод | Путь | Данные / доступ |
|---|---|---|
| GET | `/api/CoffeeShops` | Публичный поиск, `page`, `pageSize`, `q`; `data.coffeeShops` |
| GET | `/api/CoffeeShops/{slug}` | Публичная карточка |
| GET | `/api/Map` | Публичная карта; bounds + zoom, `shops`, `clusters`, `zones`, `isTruncated` |
| GET | `/api/admin/users/{id}/profile` | Moderator: публичные сведения автора по UUID; без email/телефона |
| GET | `/api/admin/roasters/{id}` | Moderator: редактируемый DTO обжарщика по UUID, включая `cityId` |
| GET | `/api/admin/shops/{id}/public-address` | Moderator: UUID → адрес |
| GET | `/api/admin/shops/by-slug/{slug}/public-address` | Moderator: slug → UUID и актуальный адрес |

Два защищённых чтения адреса возвращают `data: {entityId,slug,canonicalPath,revision,isAlias}`. Поиск пользователя по UUID возвращает `userName`, `createdAtUtc`, `about`, `avatarUrl`, счётчики. Профиль не содержит `id`; UUID уже известен вызывающему коду. Отсутствующий/недоступный ресурс не даёт права конструировать публичную ссылку по UUID.

Публичная кофейня содержит `address: {slug,canonicalPath,revision,isAlias}`. Это метаданные адреса страницы. Уличный адрес находится в `location.address`. Адаптер `src/api/coffeeShops.ts` использует slug как ключ строки/маркера, `canonicalPath` для ссылки и `location.address` для текста. Карта админки запрашивает `zoom=14`, чтобы получить отдельные маркеры. Для скрытия/редактирования из публичной карточки сначала читается защищённый адрес и используется его `entityId`.

## Подключённые административные возможности

| Блок | Основные пути | Контракты |
|---|---|---|
| Модерация кофеен | `/api/ModerationShops`, `/{id}`, `/status` | Список с пагинацией/фильтрами, detail по UUID, JSON-редактирование заявки, approve/reject с комментарием |
| Модерация отзывов | `/api/ModerationReviews` | Список с пагинацией/фильтрами и смена статуса; изменение текста автора — отдельный PUT `/{moderationReviewId}` |
| Модерация обжарщиков | `/api/ModerationRoasters`, `/{id}`, `/status` | Список/detail, approve/reject |
| Предложения правок | `/api/ShopChangeRequests`, `/{id}`, `/{id}/status` | List/detail/решение; административный detail содержит сведения для модератора |
| Жалобы на данные | `/api/admin/shop-reports`, `/{id}/status` | Пагинация и решение |
| Жалобы на отзывы | `/api/admin/review-reports`, `/{id}`, `/{id}/resolve` | Список, отзыв для проверки, решение; конфликт состояния — 409 |
| Опубликованные кофейни | `/api/admin/shops`, `/{id}` | Список/detail/создание/обновление/удаление по UUID; Admin |
| Управление кофейней | `/api/admin/shops/{id}/visibility`, `/owner`, `/focus`, `/tags`, `/photos` | Видимость, владелец, профиль кофе, теги и фотографии; Admin |
| Меню | `/api/admin/shops/{id}/menu`, `/menu/photos`, `/menu/parse` | Чтение, изменение, загрузка фото, разбор меню |
| Справочники | `/api/admin/cities`, `/beans`, `/equipments`, `/roasters`, `/brew-methods`, `/shop-tags` | Административные UUID для редактирования/связей; публичные списки содержат slug и для этих форм не подходят |
| Кофейные зоны | `/api/admin/coffee-zones`, `/{id}`, `/membership`, `/candidates` | Редактирование, публикация, состав зоны |
| Импорт | `/api/admin/import` | Кандидаты, решения, файл/OSM, статистика, повторная проверка, меню, дубликаты |
| Пользователи | `/api/admin/users`, `/stats`, `/{id}/role`, `/block`, `/sessions` | Admin: список/поиск, роли, блокировка, удаление, сессии |
| Статистика | `/api/admin/stats/overview`, `/users/timeseries`, `/shops/timeseries`, `/shops/insights`, `/moderation/insights` | Обзор и подробная статистика |
| Audit log | `/api/admin/audit/moderation` | Кто принял решение и когда |
| Кеш | `/api/admin/cache/keys`, `/clear`, `/clear/{key}` | Admin: просмотр/очистка |
| Приложения | `/api/admin/v1/app-downloads` | Ссылки магазинов, Android releases, публикация релиза |
| Owner | `/api/owner/coffee-shops`, `/{id}`, `/{id}/photos` | Собственные кофейни владельца |

Таблица группирует ресурсы; методы и точные тела каждого запроса задаются соответствующим `src/api` и серверным контроллером. Не все backend-операции имеют экран в админке: например, backfill публичных адресов, настройка версии мобильного приложения и каталог напитков. Отсутствие экрана не означает отсутствие API.

## Ссылки магазинов приложений

Сверено 7 октября 2026 с [UpdateStoreDownloadChannelRequest](https://github.com/CoffeePeek/coffeepeek-backend/blob/main/CoffeePeek.Contract/Dtos/AppDownloads/UpdateStoreDownloadChannelRequest.cs) и [AdminAppDownloadsController](https://github.com/CoffeePeek/coffeepeek-backend/blob/main/CoffeePeek.ShopsService/Controllers/AdminAppDownloadsController.cs).

PUT `/api/admin/v1/app-downloads/android/google-play` и PUT `/api/admin/v1/app-downloads/ios/app-store` принимают JSON `{url: string | null, enabled: boolean}`. Поле `externalUrl` относится к **ответу** (`androidGooglePlay.externalUrl`, `iosAppStore.externalUrl`); в запросе оно не задаёт URL.

При `enabled: true` URL обязателен. Непустая ссылка должна быть HTTPS, длиной до 2048 символов, с хостом `play.google.com` для Google Play или `apps.apple.com` для App Store. Отключение без ссылки: `{url: null, enabled: false}`. Нарушение этих правил возвращает HTTP 400 с `VALIDATION_FAILED`.

## Формат ответа и пагинация

Обычно сервер возвращает `Response<T> {isSuccess,message,data}`; HTTP client превращает его в `ApiResponse<T>`. Отдельные команды создания возвращают верхнеуровневый `entityId`, а не DTO опубликованной сущности. Не объявлять их ответ как карточку ресурса.

Пагинация может находиться в `X-Total-Count`, `X-Total-Pages`, `X-Current-Page`, `X-Page-Size` или в `data.totalItems/totalPages/currentPage/pageSize`. Клиентский `meta` — нормализация этих полей. У отдельных списков разные имена коллекции (`items`, `coffeeShops`); их адаптация находится рядом с API-функцией. Длина текущей страницы не равна общему количеству записей.

JSON-тела и query/header параметры сверять с API-функцией ресурса. Редактирование заявки на кофейню не использует FormData: фотографии сначала загружаются в object storage, после чего JSON содержит метаданные.

## Отзывы и фотографии

Published `Review.id` нужен для чтения отзыва и жалоб. Для изменения исходной заявки нужен **`Review.moderationReviewId`**. PUT `/api/ModerationReviews/{moderationReviewId}` принимает:

```json
{
  "header": "Необязательный заголовок",
  "comment": "Текст",
  "rating": {"coffee": 5, "service": 4, "place": 5},
  "photos": []
}
```

Дополнительно поддерживаются `drinkSlug`, `customDrinkName`, `clearDrink`. Не передавать туда опубликованный ID или плоские `ratingCoffee/ratingService/ratingPlace`.

В обновлении `photos` отсутствует/null — сохранить старые; `[]` — убрать все; непустой массив — заменить. Существующие storage keys переиспользуют сохранённые серверные метаданные; новые проверяются Media по автору и подтверждаются через событие после сохранения. Обновление снова отправляет отзыв на модерацию. `visitedAt` в API отзыва не предусмотрен; даты посещения относятся к чек-инам.

Фото меню/кофейни/обжарщика загружаются через `/api/Photos/{kind}` и presigned PUT в storage. PUT повторяет оба подписанных заголовка: `Content-Type` и `x-amz-tagging: is_permanent=False`. Не пропускать tagging и не использовать storage URL как маршрут API.

## Проверки

В обоих приложениях доступны `npm run typecheck`, `npm test -- --silent`, `npm run build`. Клиент дополнительно запускает `npm run test:ssr`. CI `.github/workflows/frontend-validation.yml` проверяет обе программы. Тесты `coffee-peek-admin/tests/apiContracts.test.ts` покрывают Public DTO list/detail/map, UUID-профиль, cityId обжарщика и преобразование адресов. Проверки фикстур подтверждают контракт фронта; реальный gateway/storage сценарий проверяется отдельно.

## Discovery / каталог кофе — PR #334

Сверено с OpenAPI задачи и PR #334: первоначально 8a8bc274213404612e446fb46ae55fd45b8fa8a6, после деплоя — merged head 09e383e890f3596942f44176d33be09f9511da41. Live public search/facets теперь возвращают 200; admin и favorites без JWT — 401. Типы/маршруты: src/api/coffeeCatalog.ts; результаты live/mock: ../../docs/DISCOVERY-VERIFICATION.md.

- /api/admin/roaster-tags и /api/admin/coffee-filter-values: GET всех значений, POST создания; /{id} PATCH и DELETE деактивации. Slug либо groupCode+code неизменяемы. Реактивация через PATCH isActive:true.
- /api/admin/roasters/{id}/tags: GET назначений; PUT {tagIds: GUID[]} полностью заменяет их, возвращает 204. Неактивные теги нельзя назначать повторно.
- /api/admin/coffees: GET page,pageSize,status. /{id} GET карточки; PATCH {content,countryCodes,protectedFields,status,version}. Content целиком; защита базовых полей PascalCase.
- /{id}/classification: GET; PATCH {classification,protectedFields,version}, camelCase защита только классификации. /{id}/variants/{variantId}/classification PATCH {brewPurpose,protectFromImport,version}. null наследует назначение продукта. Каждая мутация увеличивает общую версию; PATCH выполняются последовательно.
- /api/admin/coffees/public-addresses/{id}: PATCH {slug,expectedRevision,reason}, только Admin. /initialize POST для отсутствующего адреса. Admin DTO не предоставляет revision существующего Draft/Archived адреса; клиент её не угадывает.
- /api/admin/coffee-import/runs?limit=30: read-only список по источникам, Applied/Failed, snapshotId, время, products/variants/added, missingAvailabilityApplied, error.

Base coffee PATCH может вернуть HTTP 409 с coffee_catalog_error; редактор трактует любой 409 как конфликт, сохраняет локальный черновик и требует явного решения перед повторной записью.
