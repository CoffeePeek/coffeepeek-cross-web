# CoffeePeek Admin — действующие контракты API

Обновлено 4 октября 2026 после сверки с CoffeePeek-NET и исправления связок клиента. Это описание подключённого API, а не список отсутствующих возможностей. Полный исходный реестр маршрутов и потребителей сохранён в `../../docs/API-ENDPOINTS-2026-10-04.csv`; результаты исправлений — в `../../docs/API-IMPLEMENTATION-2026-10-04.md`.

## Рейтинг активности (backend PR #362)

Экран `/leaderboard` доступен Admin и Moderator. GET `/api/v1/leaderboard` принимает `period=week|month`, `date=YYYY-MM-DD` (день внутри периода, годы 2000–2100), `page` (1–10000), `pageSize` (1–100). Ответ `data`: `{period,startsOn,endsOnExclusive,timeZone,items,totalCount,page,pageSize,me}`. Периоды календарные, неделя с понедельника, Europe/Minsk. Строка: `{rank,authorId,username,avatarUrl,address?,points,additions,edits,checkIns}`. Места и баллы берутся с сервера, одинаковые баллы дают места 1, 1, 3. Admin/Moderator, удалённые и заблокированные аккаунты исключает сервер. Чтение без кеша.

DTO модерации чекина содержит `leaderboardGeoStatus`, `shopDistanceMeters`, `locationAccuracyMeters`, `locationCapturedAtUtc`, `leaderboardOverride: boolean|null`, `leaderboardReason`. `WithinRange` означает успешную геопроверку; остальные результаты: `OutsideRadius`, `MissingLocation`, `InvalidLocation`, `MissingShopLocation`, `InaccurateLocation`, `StaleLocation`. Геопроверка не означает фактического зачёта: он требует публичного одобренного чекина в кофейне. DTO модерации не содержит текущую видимость.

PUT `/api/v1/moderation/check-ins` сохраняет ручное решение через `countsForLeaderboard` и `leaderboardReason` (trim, 1–1000 символов), только Admin. При изменении зачёта текущий `moderationStatus` и `rejectReason` сохраняются; обычное approve/reject не отправляет поля рейтинга. Новая ревизия содержимого сбрасывает ручное решение на сервере. Аудит возвращает действия `LeaderboardIncluded` / `LeaderboardExcluded` (числовые значения 3 / 4), автора в `moderatorUserId`, время в `createdAtUtc`, причину в `comment`. Тип чекина в API аудита — `Review` (1); адаптер преобразует его в UI-тип `CheckIn` и обратно для фильтра.

## Транспорт и авторизация

Все запросы приложения проходят через `src/api/core/httpClient.ts`. В development используется same-origin `/backend` с Vite proxy; production читает `VITE_API_URL`. Access token хранится в памяти, refresh cookie — HttpOnly. Refresh выполняется interceptor; ручная обёртка refresh не нужна.

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/tokens` | Вход: JSON `{email,password}` |
| POST | `/api/tokens/google/login` | Google-вход: JSON `{idToken}` из Google Identity Services; access token в ответе, refresh cookie — HttpOnly |
| PUT | `/api/tokens` | Refresh cookie → новый access token |
| DELETE | `/api/tokens` | Завершение текущей сессии |
| SignalR | `/realtime/session` | Уведомления об отзыве сессии |

Policy `Moderator` включает Moderator и Admin. Policy `Admin` разрешает только Admin. Owner API требует владельца и проверяет принадлежность кофейни. Gateway и контроллеры проверяют права независимо; наличие кнопки в интерфейсе не заменяет серверную проверку.

На экране входа нет регистрации; Google-вход дополняет email/пароль и использует ту же проверку ролей Admin/Moderator/Owner. Сессия аккаунта без доступа к панели отзывается. Общий серверный Google endpoint по-прежнему может создать новый обычный аккаунт; отдельный запрет регистрации в API не вводится. ID token передаётся только в теле запроса без Bearer-заголовка; полученный access token хранится в памяти.

Кнопка Google появляется при заданном `VITE_GOOGLE_CLIENT_ID` (OAuth client типа Web application). Для локальной разработки и production нужно добавить соответствующие origin админки в Authorized JavaScript origins этого клиента в Google Cloud; backend должен принимать его audience. Используется официальная кнопка Google с popup-входом, без автоматического входа и One Tap. Если Google недоступен, остаётся вход по паролю; загрузку кнопки можно повторить.

## Изменения поиска — 27 октября 2026

`POST /api/v1/discovery/search` удалён вместе с маршрутом Gateway, DTO и схемами OpenAPI. Основной поиск кофеен использует `POST /api/v1/coffee-shops/search`.

Каталог админки, выбор кофейни для чекина, поиск на карте, SEO и sitemap используют `POST /api/v1/coffee-shops/search`. Обычный список передаёт `{filters, page, pageSize}` без `q` и `sort`, чтобы backend вернул рекомендации; также допустим явный `sort: "recommended"`. Текстовый поиск добавляет `q` без сортировки, сервер выбирает релевантность. Режим «Рядом» добавляет `filters.origin` и `sort: "distance_asc"`. В ответе `data.items` и пагинация; адрес карточки — `addressLine`, фото — `coverPhoto`, публичный адрес — `address`.

## Публичные адреса и административные ID

У кофейни, обжарщика и пользователя публичный адрес использует **slug**. Публичные чтения по UUID не поддерживаются. Административные DTO используют **UUID**; ID заявок, фотографий и чекинов также остаются UUID.

| Метод | Путь | Данные / доступ |
|---|---|---|
| POST | `/api/v1/coffee-shops/search` | Публичный поиск; `{q?, filters, sort?, page, pageSize}` → `data.items`, `totalPages` |
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
| Модерация чекинов | `/api/v1/moderation/check-ins`, `/{submissionId}` | Список и снимок заявки; PUT базового пути принимает решение по ID заявки и её ревизии |
| Модерация обжарщиков | `/api/ModerationRoasters`, `/{id}`, `/status` | Список/detail, approve/reject |
| Предложения правок | `/api/ShopChangeRequests`, `/{id}`, `/{id}/status` | List/detail/решение; административный detail содержит сведения для модератора |
| Жалобы на данные | `/api/admin/shop-reports`, `/{id}/status` | Пагинация и решение |
| Жалобы на чекины | `/api/admin/check-in-reports`, `/{id}`, `/{id}/resolution` | Список, чекин для проверки, решение `{deleteCheckIn}`; конфликт состояния — 409 |
| Опубликованные кофейни | `/api/admin/shops`, `/{id}` | Список/detail/создание/обновление/удаление по UUID; Admin |
| Управление кофейней | `/api/admin/shops/{id}/visibility`, `/owner`, `/focus`, `/tags`, `/photos` | Видимость, владелец, профиль кофе, теги и фотографии; Admin |
| Меню | `/api/admin/shops/{id}/menu`, `/menu/photos`, `/menu/parse` | Чтение, изменение, загрузка фото, разбор меню; DELETE `/menu/photos` с `{photoIds: [UUID]}` удаляет только выбранные фото, сохраняя напитки и цены (Admin) |
| Справочники | `/api/admin/cities`, `/beans`, `/equipments`, `/roasters`, `/brew-methods`, `/shop-tags` | Административные UUID для редактирования/связей; публичные списки содержат slug и для этих форм не подходят |
| Кофейные зоны | `/api/admin/coffee-zones`, `/{id}`, `/membership`, `/candidates` | Редактирование, публикация, состав зоны |
| Импорт | `/api/admin/import` | Кандидаты, решения, файл/OSM, статистика, повторная проверка, меню, дубликаты |
| Пользователи | `/api/admin/users`, `/stats`, `/{id}/role`, `/block`, `/sessions` | Moderator/Admin: GET списка/поиска и статистики; только Admin: роли, блокировка, удаление и все операции с сессиями |
| Статистика | `/api/admin/stats/overview`, `/users/timeseries`, `/shops/timeseries`, `/shops/insights`, `/moderation/insights` | Moderator/Admin: GET всей сводки и подробной статистики |
| Audit log | `/api/admin/audit/moderation` | Кто принял решение и когда |
| Приложения | `/api/admin/v1/app-downloads` | Ссылки магазинов, Android releases, публикация релиза |
| Owner | `/api/owner/coffee-shops`, `/{id}`, `/{id}/photos` | Собственные кофейни владельца |

Таблица группирует ресурсы; методы и точные тела каждого запроса задаются соответствующим `src/api` и серверным контроллером. Не все backend-операции имеют экран в админке: например, backfill публичных адресов и каталог напитков. Отсутствие экрана не означает отсутствие API.

### Доступ к дашборду и пользователям

Moderator и Admin доступны все GET `/api/admin/stats/overview`, `/api/admin/stats/users/timeseries`, `/api/admin/stats/shops/timeseries`, `/api/admin/stats/shops/insights`, `/api/admin/stats/moderation/insights`, `/api/admin/users` и `/api/admin/users/stats`. Для модератора список пользователей доступен только для чтения: поиск, фильтры, пагинация и статистика.

Только Admin доступны PATCH `/api/admin/users/{id}/role`, PATCH `/api/admin/users/{id}/block`, DELETE `/api/admin/users/{id}`, GET `/api/admin/users/{id}/sessions`, DELETE `/api/admin/users/{id}/sessions/{sessionId}` и DELETE `/api/admin/users/{id}/sessions`. Интерфейс показывает действия с пользователями и раздел сессий только администратору. URL, HTTP-методы, JSON-поля, параметры запросов и заголовки пагинации прежние. Bearer-авторизация: отсутствующий или недействительный токен — 401; недостаточные права — 403.

### DAU по дням

GET `/api/admin/stats/users/timeseries?days=30` возвращает `data: { days, newUsers, dailyActiveUsers }`. Обе серии содержат `{ date: "YYYY-MM-DD", count: number }` за одинаковые последовательные дни UTC по возрастанию, включая сегодня. `days` по умолчанию 30, сервер ограничивает значение диапазоном 1–90; пустые дни заполнены нулями.

`dailyActiveUsers` — уникальные пользователи с входом или обновлением сессии за календарный день UTC. Повторные входы, устройства и обновления одного пользователя за день считаются один раз. Сегодняшняя точка неполная. Этот ряд отличается от `overview.dailyActiveUsers`, который считает последние 24 часа; админка показывает его отдельно от регистраций, без суммы за период. История зависит от сохранённых токенов и может уменьшаться при удалении токенов или аккаунтов. При ошибке запроса данные недоступны, а не равны нулю.

## Ссылки магазинов приложений

Сверено 7 октября 2026 с [UpdateStoreDownloadChannelRequest](https://github.com/CoffeePeek/coffeepeek-backend/blob/main/CoffeePeek.Contract/Dtos/AppDownloads/UpdateStoreDownloadChannelRequest.cs) и [AdminAppDownloadsController](https://github.com/CoffeePeek/coffeepeek-backend/blob/main/CoffeePeek.ShopsService/Controllers/AdminAppDownloadsController.cs).

PUT `/api/admin/v1/app-downloads/android/google-play` и PUT `/api/admin/v1/app-downloads/ios/app-store` принимают JSON `{url: string | null, enabled: boolean}`. Поле `externalUrl` относится к **ответу** (`androidGooglePlay.externalUrl`, `iosAppStore.externalUrl`); в запросе оно не задаёт URL.

При `enabled: true` URL обязателен. Непустая ссылка должна быть HTTPS, длиной до 2048 символов, с хостом `play.google.com` для Google Play или `apps.apple.com` для App Store. Отключение без ссылки: `{url: null, enabled: false}`. Нарушение этих правил возвращает HTTP 400 с `VALIDATION_FAILED`.

GET `/api/admin/v1/app-downloads` также возвращает `iosVersion` и `androidVersion`: `{latestVersionCode, minVersionCode}`. На экране «Приложения» политика каждой платформы сохраняется вручную через PUT `/api/admin/v1/app-downloads/{android|ios}/version`, например `{latestVersionCode: 46, minVersionCode: 0}`. Оба кода — целые числа int32; актуальный > 0, минимальный ≥ 0 и ≤ актуального. Это внутренние коды сборки, отдельные от публичного имени версии `1.1.0`. При минимальном коде 0 обязательное обновление отключено. Актуальный код Android относится к Google Play; актуальный APK задаётся выбором production-релиза. Минимум Android общий для Play и APK. Значения загружаются с сервера; сохранение политики не изменяет ссылки магазинов и доступность каналов.

## Формат ответа и пагинация

Обычно сервер возвращает `Response<T> {isSuccess,message,data}`; HTTP client превращает его в `ApiResponse<T>`. Отдельные команды создания возвращают верхнеуровневый `entityId`, а не DTO опубликованной сущности. Не объявлять их ответ как карточку ресурса.

Пагинация может находиться в `X-Total-Count`, `X-Total-Pages`, `X-Current-Page`, `X-Page-Size` или в `data.totalItems/totalPages/currentPage/pageSize`. Клиентский `meta` — нормализация этих полей. У отдельных списков разные имена коллекции (`items`, `coffeeShops`); их адаптация находится рядом с API-функцией. Длина текущей страницы не равна общему количеству записей.

JSON-тела и query/header параметры сверять с API-функцией ресурса. Редактирование заявки на кофейню не использует FormData: фотографии сначала загружаются в object storage, после чего JSON содержит метаданные.

## Чекины и фотографии — контракт обновлён 14 октября 2026

Отзывы заменены публичными и личными чекинами. Клиентская карточка содержит `kind: "Shop" | "Home"`, `shop` и `author` как nullable публичные адреса, `username`, `shopName`, `text`, вложенный `rating`, `visitedAt`, `createdAtUtc`, `visibility`, `moderationState`, `contentRevision`, `rejectionReason`, плоские поля напитка, фотографии, `helpfulCount`, `isHelpfulByCurrentUser` и необязательные `drinkPhotoUrl`/`home`. Блок `home` содержит `preparedOn`, `brewMethodCode`, `beanName`, `doseGrams`, `brewDurationSeconds`, `tasteScore`. Служебных `shopId`/`userId` в клиентской карточке нет.

- POST `/api/v1/check-ins`: `{coffeeShopSlug,text,rating,visibility?,drinkSlug?,customDrinkName?,photos?,visitedAt?}`. По умолчанию `Private`. Текст после trim — 1–1000 символов, оценки — целые 1–5, до пяти фото. Дата с часовым поясом; лимиты создания — один чекин за три часа и три за сутки UTC.
- GET/PUT/DELETE `/api/v1/check-ins/{id}`: чтение, изменение автором, удаление. PUT заменяет `{text,rating,drinkSlug?,customDrinkName?}`; отсутствие напитка очищает его. Кофейня, дата и фотографии сохраняются. Изменение публичного чекина создаёт новую ревизию модерации.
- PUT `/{id}/visibility`: `{visibility: "Private" | "Public"}`. Личный чекин сразу исключается из публичной выдачи. Состояния модерации: `NotSubmitted`, `Pending`, `Approved`, `Rejected`.
- GET `/api/v1/check-ins/mine`: Bearer, `pageNumber`, `pageSize`, `from?`, `to?`; диапазон посещений `[from,to)`, ответ `{items,totalCount}` и заголовки пагинации.
- GET `/api/v1/check-ins`: одобренные публичные карточки, `{items,nextCursor}`. GET `/api/v1/feed`: `{items:[{publishedAtUtc,checkIn}],nextCursor}`. Оба принимают `citySlug?`, `coffeeShopSlug?`, `authorSlug?`, `pageSize`, `cursor?`; курсоры несовместимы. При смене фильтров и обновлении ленты начинается первая страница. Повторные посещения остаются отдельными карточками.
- PUT/DELETE `/{id}/helpful`: Bearer, без тела, `{isHelpful,helpfulCount}`; автор не голосует за себя. POST `/{id}/reports`: Bearer, `{text}` длиной 1–2000 после trim.

POST `/api/Photos/check-in` принимает массив `{sizeBytes,fileName,contentType}`, возвращает `{photoId,uploadUrl,storageKey}`. Presigned PUT использует `Content-Type` и `x-amz-tagging: is_permanent=False`. В создание прикрепляется `{fileName,contentType,storageKey,size}`; не `sizeBytes` и не `photoId`. Форматы: JPEG, PNG, GIF, WebP, BMP, AVIF. Для отображения используется только `photos[].url`; личные и ожидающие фотографии загружаются с Bearer как Blob. URL из `storageKey` не конструируется.

Модерация доступна Moderator/Admin. GET `/api/v1/moderation/check-ins` принимает `page`, `pageSize`, `status?`, `search?` до 100 символов, `userId?`. Без статуса возвращаются все заявки; очередь запрашивает `Pending`. Ответ `{items,totalItems,totalPages,currentPage,pageSize}`. В DTO `id` — **ID заявки**, `checkInId` — ID чекина; также есть `contentRevision`, `userId`, `userName`, `createdAt`, `text`, напиток, `rejectedReason`, `moderationStatus` и фото. Для различения новых заявок backend должен отдавать `kind: "Shop" | "Home"`: у `Shop` используются `shopId`, `visitedAtUtc`, тройка `rating`; у `Home` `shopId` отсутствует/null, а дата и рецепт доступны в `preparedAtUtc`/`preparedOn` и `home{preparedOn,brewMethodCode,beanName,doseGrams,brewDurationSeconds,tasteScore}` либо в одноимённых плоских полях. Домашний текст может быть пустым. До обновления всех серверных DTO админка определяет старую запись по `shopId` и домашнюю по полям рецепта; запись без обоих признаков показывает «Тип не указан».

PUT базового пути модерации принимает `{submissionId,moderationStatus,comment,rejectReason}` со строковым статусом `Approved`/`Rejected`. Причина отклонения обязательна, 2–1000 символов; непустой `comment` имеет приоритет. Ответ содержит новый статус в `data`, предыдущий в `oldEntity`. Снимок заявки не редактируется; публикация применяется через событие. Фотографии читаются с Bearer по `photos[].fullUrl`, содержащему маршрут `moderation-photos` и `revision`.

Жалобы доступны только Admin. GET `/api/admin/check-in-reports`: `status=Pending` по умолчанию, допустимы `Dismissed`/`CheckInDeleted`, статуса `All` нет; `page`, `pageSize`, ответ `{items,totalCount,page,pageSize}`. Detail `/{reportId}` возвращает `{report,checkIn}`; `checkIn:null` для исторической жалобы — штатный случай «Чекин недоступен». Целевой `checkIn` также должен передавать `kind`; для домашнего чекина `shopId` nullable, используются дата/рецепт/`tasteScore`, для посещения — `shopId` и три оценки. PUT `/{reportId}/resolution` принимает `{deleteCheckIn:boolean}`. Противоположное уже принятому решение возвращает 409.

Кофейня теперь содержит `checkInCount`, `checkIns`, `userCheckIns`; профиль — `checkInCount`, публичная статистика — `totalCoffeeShops`, `totalCheckIns`, `averageRating`. Рейтинг кофейни учитывает последнее подходящее публичное посещение каждого автора. Обзор админки использует `totalCheckIns`, `newCheckInsToday`, `pendingModerationCheckIns`; временные ряды — `newCheckIns`.

## Проверки

В обоих приложениях доступны `npm run typecheck`, `npm test -- --silent`, `npm run build`. Клиент дополнительно запускает `npm run test:ssr`. CI `.github/workflows/frontend-validation.yml` проверяет обе программы. Тесты `coffee-peek-admin/tests/apiContracts.test.ts` покрывают Public DTO list/detail/map, UUID-профиль, cityId обжарщика и преобразование адресов. Проверки фикстур подтверждают контракт фронта; реальный gateway/storage сценарий проверяется отдельно.

Для браузерных сценариев чекинов запустите dev-серверы клиента и админки, затем `npm run test:check-ins` в админке. Скрипт использует порты 5173/5174; другие адреса задаются через `COFFEE_CUSTOMER_ORIGIN` и `COFFEE_ADMIN_ORIGIN`. Все API-запросы перехватываются фикстурами. Проверяются личные фото, presign/PUT/прикрепление, сохранение напитка, видимость, удаление, полезность, жалобы, курсоры ленты и решения по заявкам; скриншоты сохраняются в `test-results/check-ins`.

## Discovery / каталог кофе — PR #334

Сверено с OpenAPI задачи и PR #334: первоначально 8a8bc274213404612e446fb46ae55fd45b8fa8a6, после деплоя — merged head 09e383e890f3596942f44176d33be09f9511da41. Live public search/facets теперь возвращают 200; admin и favorites без JWT — 401. Типы/маршруты: src/api/coffeeCatalog.ts; результаты live/mock: ../../docs/DISCOVERY-VERIFICATION.md.

- /api/admin/roaster-tags и /api/admin/coffee-filter-values: GET всех значений, POST создания; /{id} PATCH и DELETE деактивации. Slug либо groupCode+code неизменяемы. Реактивация через PATCH isActive:true.
- /api/admin/roasters/{id}/tags: GET назначений; PUT {tagIds: GUID[]} полностью заменяет их, возвращает 204. Неактивные теги нельзя назначать повторно.
- /api/admin/coffees: GET page,pageSize,status. /{id} GET карточки; PATCH {content,countryCodes,protectedFields,status,version}. Content целиком; защита базовых полей PascalCase.
- /{id}/classification: GET; PATCH {classification,protectedFields,version}, camelCase защита только классификации. /{id}/variants/{variantId}/classification PATCH {brewPurpose,protectFromImport,version}. null наследует назначение продукта. Каждая мутация увеличивает общую версию; PATCH выполняются последовательно.
- /api/admin/coffees/public-addresses/{id}: PATCH {slug,expectedRevision,reason}, только Admin. /initialize POST для отсутствующего адреса. Admin DTO не предоставляет revision существующего Draft/Archived адреса; клиент её не угадывает.
- /api/admin/coffee-import/runs?limit=30: read-only список по источникам, Applied/Failed, snapshotId, время, products/variants/added, missingAvailabilityApplied, error.

Base coffee PATCH может вернуть HTTP 409 с coffee_catalog_error; редактор трактует любой 409 как конфликт, сохраняет локальный черновик и требует явного решения перед повторной записью.
