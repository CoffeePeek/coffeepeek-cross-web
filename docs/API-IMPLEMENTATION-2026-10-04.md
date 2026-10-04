# Исправления по аудиту API — 4 октября 2026

Исходный аудит: [API-AUDIT-2026-10-04.md](./API-AUDIT-2026-10-04.md). Реестр **214 объявлений маршрутов / 47 контроллеров / 56 YARP routes** в [API-ENDPOINTS-2026-10-04.csv](./API-ENDPOINTS-2026-10-04.csv) фиксирует состояние до исправлений. Новые административные чтения описаны ниже. Исторический реестр не является снимком API после реализации.

Изменения выполнены в `CoffeePeek.FE.WebClient` и соседнем `CoffeePeek-NET`. Исправлены обнаруженные P1-расхождения контрактов и связанные P2-проблемы отзывов; убран подтверждённый неиспользуемый код фронта. Архитектурные рекомендации аудита и серверные кандидаты без веб-потребителя перечислены отдельно в конце документа.

Frontend source/tests/CI: локальный commit `f04d62c` (`fix: align frontend API contracts and remove unused wrappers`).

Backend commits: `66cd36bd` (administrative reads), `14fd21f6` (review photos/outbox), `c623f063` (personal review availability), `9c352201` (legacy retained photos и local service discovery).

## Что исправлено

| Проблема | Результат |
|---|---|
| Ссылка подтверждения email на главную страницу | Root redirect передаёт token на `/confirm-email` до редиректа авторизованного пользователя. Оттуда выполняется существующий PUT `/api/users/me/email-confirmation?token=…`. Удалён имитационный OTP-процесс лендинга. |
| Изменение опубликованного отзыва | Published ID используется для GET; PUT идёт по `moderationReviewId`. Отправляется вложенный `rating: {coffee,service,place}` и полный список оставляемых фотографий. |
| Фотографии при изменении отзыва | Backend различает сохранение/очистку/замену, доверяет сохранённым метаданным старых фото и проверяет новые ключи в Media по автору. Подтверждение новых фото передаётся через outbox. |
| UUID автора в публичном API | Админка использует новое защищённое чтение профиля по UUID. Публичные URL пользователя продолжают использовать slug. |
| UUID обжарщика и потеря города при сохранении | Админка читает новый administrative detail по UUID, получает `cityId` и инициализирует выбор города этим значением. |
| Старый Public DTO в admin list/map/detail | Адаптер берёт slug и canonicalPath из `address`, уличный адрес — из `location.address`. Для административного изменения дополнительно разрешается UUID. |
| UUID кофейни в публичных ссылках модерации/жалоб | Компонент `PublishedShopLink` получает актуальный canonicalPath по защищённому чтению; недоступная сущность отображается без некорректной UUID-ссылки. |
| Несовпадение подписи при загрузке аватара | Профиль использует общий `putPhotoToStorage()`, передающий Content-Type и `x-amz-tagging: is_permanent=False`. |
| Незаданные `canCreateReview` / `existingReviewId` | Backend вычисляет наличие видимого опубликованного отзыва отдельно для пользователя после чтения общего кеша кофейни. ExistingReviewId — published ID. |
| Неверные типы результатов и сообщения | Создание возвращает submission `entityId`, изменение — `reviewId`; UI сообщает об отправке на модерацию. Неподдерживаемое поле `visitedAt` убрано из формы отзыва. |

### Добавленные административные чтения

Все четыре маршрута используют policy `Moderator` (Moderator и Admin), включая явные GET-only правила Gateway. Общие административные маршруты изменения сохраняют свои права.

| Метод и путь | Ответ |
|---|---|
| GET `/api/admin/users/{id:guid}/profile` | `Response<PublicUserProfileResponse>`: имя, about, аватар, дата создания и счётчики; без email, телефона и дублирующего ID. |
| GET `/api/admin/roasters/{id:guid}` | `Response<RoasterDetailsDto>` с nullable `cityId` для административной формы. |
| GET `/api/admin/shops/{id:guid}/public-address` | `Response<PublicAddressMetadata>`: entityId, slug, canonicalPath, revision, isAlias. |
| GET `/api/admin/shops/by-slug/{slug}/public-address` | Тот же DTO; учитывает aliases, актуальный адрес и публичную доступность. |

UUID и slug разделены в названиях функций: публичные `getCoffeeShopBySlug`, `getRoasterBySlug`, `getBrowseCoffeeShopBySlug`; административные `getRoasterById`, `getShopPublicAddressById` и `getShopPublicAddressBySlug`.

### Контракт изменения фотографий отзыва

PUT `/api/ModerationReviews/{moderationReviewId}`:

```json
{
  "header": "Заголовок",
  "comment": "Новый текст",
  "rating": { "coffee": 5, "service": 4, "place": 5 },
  "photos": []
}
```

- Поле `photos` отсутствует или равно null: сохранить текущие фото.
- `photos: []`: очистить список в заявке.
- Непустой список: заменить набор. Оставляемые storage keys переиспользуют точные сохранённые сервером метаданные. Принадлежность проверяется по загруженному агрегату отзыва: старые фотографии с пустым OwnerId или прежней связью с кофейней также сохраняются. Ключ из другого агрегата не считается оставляемым фото.
- Новые keys проверяются через owner-scoped Media `/api/Photos/resolve`: отсутствие, чужой владелец, истёкшая/незагруженная фотография дают 400; недоступность Media даёт 503 до изменения агрегата.
- Пустые/дублирующие ключи и более 20 фотографий отклоняются.
- Новые фото добавляются в EF как новые записи; повторная загрузка агрегата после сохранения проверяется тестом.
- Подтверждение загрузок публикуется через `ReviewPhotosAttachedEvent` и outbox вместе с сохранением заявки. Media обрабатывает его идемпотентно с проверкой владельца.

Для запроса Moderation → Media добавлены ссылки на существующий сервис в local dev runner и Aspire AppHost; конфигурация Docker Compose уже содержала нужное service discovery mapping.

Старые объекты storage не удаляются физически при редактировании: опубликованный отзыв продолжает ссылаться на них до одобрения замены. Безопасная очистка требует проверки ссылок и отдельной политики.

## Удалённый неиспользуемый код

Из customer app удалены **15 экспортированных API-функций**, для которых аудит не нашёл потребителей:

| Модуль | Функции |
|---|---|
| coffeeshop | getCoffeeShops, getCoffeeShopsByCity |
| auth | refreshAccessToken, getProfileByUserId, updatePhoneNumber, resendEmailConfirmation, changePassword |
| moderation | getUploadUrls, sendReviewToModeration, updateCoffeeShopReview, transformSchedulesFromBackend, transformContactFromBackend |
| user | getUsersPublicProfiles |
| shopChangeRequests | getMyShopChangeRequest |
| core/apiConfig | getFullUrl |

Также удалены два зависимых неиспользуемых query hooks, восемь неиспользуемых типов и лишние endpoint constants в обоих приложениях. Поиск кофеен остаётся в `searchCoffeeShops`. Refresh продолжает выполнять interceptor. Используемая повторная отправка email по адресу `resendEmailConfirmationByEmail` сохранена. Несуществующий маршрут получения upload URLs больше не объявляется клиентом.

## Проверки

| Проверка | Результат |
|---|---|
| Customer `npm run typecheck` | Успешно. Локальные зависимости восстановлены через npm ci. |
| Customer `npm test -- --silent` | **22 suites / 130 tests passed**. |
| Customer `npm run build` | Успешно. |
| Customer `npm run test:ssr` | **1 test-файл passed**. |
| Admin `npm run typecheck` | Успешно. |
| Admin `npm test -- --silent` | **1 suite / 6 tests passed**; добавлен runnable Jest/ts-jest setup. |
| Admin `npm run build` | Успешно. |
| Git diff whitespace check | Успешно. |
| Backend `dotnet build CoffeePeek.Backend.ci.slnf -c Debug` | Успешно: **0 errors / 531 warnings**. |
| Backend CI solution tests | **1613 passed / 53 skipped / 0 failed**. |
| Полный ModerationService.Tests | **66 passed / 0 failed**. |
| Полный MediaService.Tests | **17 passed / 0 failed**. |
| Backend tests суммарно | **1696 passed / 53 skipped / 0 failed**, всего 1749. Пропуски — opt-in live PostgreSQL tests. |
| Aspire AppHost build | Успешно: **0 errors / 233 warnings**. |
| Local dev runner syntax | Успешно. |
| NuGet vulnerability audit | Уязвимые пакеты не найдены. |

В клиентские тесты добавлены проверки email redirect/PUT, разделения published/moderation review IDs, вложенных rating, результата создания и подписанных storage headers. Админские тесты проверяют Public DTO list/detail/map, нулевые координаты, защищённое чтение автора, cityId обжарщика и преобразование slug↔UUID.

Добавлен `.github/workflows/frontend-validation.yml`: две программы независимо проходят npm ci, typecheck, tests, build; customer также SSR tests. Соответствующие команды выполнены локально; запуск GitHub Actions после push в этой работе не выполнялся.

Браузерные сценарии выполнены с **локальным fixture API и синтетическими данными**:

1. Ссылка `/?token=…` при авторизованной сессии завершилась экраном подтверждённого email и PUT на правильный маршрут.
2. Admin список показал текст уличного адреса; публичная карточка дала ссылку редактирования с administrative UUID.
3. Редактирование published review отправило PUT на отдельный moderation ID с nested rating и `photos: []`; UI сообщил об отправке на модерацию.
4. Форма обжарщика восстановила город; сохранение отправило PATCH по UUID с исходным cityId.

Браузерная проверка подтверждает поведение фронта и отправляемые запросы. Реальный сквозной сценарий Gateway → сервисы → PostgreSQL/MinIO не запускался. Предупреждения сборки о больших map bundles, аннотациях SignalR и статическом/динамическом импорте ErrorPage не блокируют сборку и существовали ранее.

## Ограничения и следующие улучшения

- Доступность создания отзыва учитывает **видимые опубликованные** отзывы. Pending/unpublished и временное скрытие при повторной модерации требуют отдельного решения: `IsSoftDelete` сейчас смешивает удаление и временное скрытие. Это ограничение не скрывается за персональными полями DTO.
- У старого published review без `moderationReviewId` форма блокирует отправку изменения с объяснением. Для редактирования таких данных нужен backfill связи с исходной заявкой.
- Подписанные заголовки аватара проверены тестом; фактическую загрузку и последующее отображение надо проверить на доступном MinIO окружении.
- Серверные маршруты без веб-вызовов сохранены: среди них межсервисные операции, мобильные контракты, эксплуатационные backfill и release pipeline. Удаление требует проверки других клиентов и трафика; две альтернативные catalog slug-формы остаются кандидатами на версионируемую депрекацию.
- OpenAPI-генерация клиента и проверка общего контракта backend↔frontend в CI остаются отдельной задачей. Текущие тесты используют зафиксированные DTO fixtures, а не автоматически выгруженную спецификацию.
- Общий transport/auth пакет двух приложений, единый формат response/pagination, устранение N+1 в списках модерации и общий read model каталога напитков остаются архитектурными рекомендациями исходного аудита.
- Политика физической очистки заменённых фотографий требует анализа ссылок опубликованных отзывов и заявок. В этой реализации старые объекты сохраняются.

Документ контрактов админки обновлён: [BACKEND-API-SPEC.md](../coffee-peek-admin/docs/BACKEND-API-SPEC.md).
