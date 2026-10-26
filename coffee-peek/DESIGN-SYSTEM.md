# CoffeePeek Design System

Дизайн-система пользовательского сайта `coffee-peek`. Все размеры — CSS px, tracking — em, длительности — ms. Описание и экспорт отражают текущую реализацию компонентов.

## Источники и обновление

```text
src/design-system/
├── tokens.ts       # Бренд, темы, типографика, размеры и эффекты
├── components.ts   # Параметры текущих UI-компонентов и текстовые пресеты
├── tokens.json     # Генерируемый экспорт токенов и спецификаций
└── index.ts        # Публичный экспорт
```

`npm run design:sync` обновляет JSON и полный реестр ниже из TypeScript. `npm run design:check` проверяет, что экспорт и реестр актуальны. При изменении интерфейса обновляйте соответствующие спецификации и описание, затем запускайте обе команды. Параметры компонентов не являются автоматическим CSS-генератором: размеры, задаваемые отдельной страницей через className/style, описываются как варианты.

JSON версии 1.1.0 сохраняет темы в `themes.light` / `themes.dark`; `components` содержит полные спецификации с вариантами и состояниями. Цвета записаны в CSS-формате, включая rgba для overlay. Ссылки вида `theme.surface` выбираются из активной темы, `brand.primary` — из брендовых токенов. JSON не ссылается на отдельную schema.

## Бренд и темы

Основной акцент — золотой `#EAB308`, hover — `#FACC15`. Тёмный кофейный фон — `#1A1412`, поверхности — `#2D241F`. В светлой теме фон — `#FAFAF9`, поверхности — белые. Все брендовые, семантические и тематические цвета перечислены в полном реестре.

Тёмная тема включается по умолчанию. Выбор сохраняется в localStorage (`theme`) и применяется через `data-theme`, классы html/body и ThemeContext; системная тема ОС автоматически не выбирается. Tailwind использует `darkMode: 'class'`.

Токены тем задают базовую палитру. `getThemeClasses` дополнительно использует стандартные цвета Tailwind в светлой теме: границы gray-200/300, фоны gray-50/100, secondary-кнопки gray-100 с hover gray-200, ghost-текст gray-600 с hover gray-900. Варианты кнопок перечислены в спецификациях. Цвет текста body в dark — белый с alpha 0.87; компоненты могут задавать непрозрачный `textPrimary`.

В Tailwind определены статусы `pending #F59E0B`, `approved #10B981`, `rejected #EF4444`; success-токен `#22C55E` применяется также к статусу «Открыто». Это отдельные роли цвета.

## Публичный профиль

Публичный профиль `/users/:slug` повторяет структуру мобильного приложения: компактная шапка с аватаром, @именем, серверными счётчиками чекинов, добавленных кофеен и подписчиков; описание и кнопка подписки. До lg ширина до 680 и одна колонка. С 1024 px контейнер расширяется до 1280: слева колонка 420 px с профилем, активностью и любимыми местами; справа — чекины на оставшуюся ширину. Между колонками 32 px, с 1280 px — 48 px. Колонки выровнены по верхнему краю. На больших экранах левая колонка закрепляется при прокрутке с отступом 16 px под фактическую высоту шапки; её высота ограничена доступным пространством окна с отступами по 16 px. В низком окне содержимое колонки прокручивается отдельно. Внутренний отступ 6 px с компенсирующим внешним отступом сохраняет рамки клавиатурного фокуса. Горизонтальная лента любимых прокручивается внутри левой колонки. До 1024 px закрепления и ограничения высоты нет. Padding 16 / 32, аватар 88 (72 при ширине до 360, 104 с sm). Панель «Назад / Профиль / Поделиться» находится в потоке страницы; цели касания 44. Собственный публичный профиль ведёт к редактированию через `/profile`. Используются общие цвета светлой и тёмной тем; аватар без фото — градиент goldWarm / primary.

Недельная активность — карточка radius 20 с семью днями, текущим днём в золотой рамке и подсветкой дней с публичными чекинами. Данные загружаются по времени Europe/Minsk, включая оба месяца на границе недели. По нажатию открывается календарь с переключением месяцев. «Любимые» — горизонтальная scroll-snap лента до шести элементов; карточки 160 / 192, фото 4:3, переходы в кофейни и обжарщики. Чекины показываются сразу в основной колонке, по 10 на страницу: следующие подгружаются за 400 px до конца списка. Кнопка «Загрузить ещё» доступна для ручной подгрузки. Во время запроса показывается индикатор под списком; при ошибке уже загруженные карточки сохраняются, автоматическая подгрузка останавливается до повтора. Отдельного окна «Все» для чекинов нет. Подписчики и подписки доступны отдельными списками с пагинацией. Модальные окна используют нативный dialog: max-width 640, max-height 85dvh, radius 24; до sm — нижняя панель на всю ширину с safe area. Escape и кнопка закрытия возвращают фокус. Пустые списки, ошибки и повторная загрузка отображаются внутри соответствующего раздела.

## Типографика

Семейство — Manrope с fallback sans-serif. Роли Tailwind `font-body`, `font-condensed`, `font-extended`, `font-expanded` используют одно семейство и не меняют ширину начертания. index.html подключает Google Fonts с весами 400, 500, 600, 700, 800 и display=swap. Шкала fontWeight в токенах содержит CSS-значения 200–900; значения вне подключённого диапазона сопоставляются браузером с доступным начертанием.

Базовые значения: 16 px, вес 400, line-height 1.5. `typographyStyles` — самостоятельные текстовые пресеты: wordmark соответствует тексту логотипа Header, hero задаёт начертание основного заголовка лендинга, h1/h2/h3/body/label/caption доступны для явного применения. Неуказанный line-height наследуется; у h2 он не фиксируется пресетом.

Общие CSS-классы имеют собственные роли:

| Класс | Вес | Tracking | Line-height | Дополнительно |
|---|---|---|---|---|
| `.wordmark` | 400 | -0.045em | 1 | Размер наследуется |
| `.hero-text` | 400 | -0.01em | 0.92 | Uppercase, размер наследуется |
| `.accent-word` | 400 | Наследуется | Наследуется | Gold |
| `.numeral` | 400 | -0.045em | 0.84 | Tabular nums, размер наследуется |

На лендинге заголовок «Хороший кофе. В твоём Минске.» адаптивный: `clamp(36px, 5vw, 88px)`, tracking -0.05em, line-height 0.95, CSS weight 900. Заголовки секций — `clamp(22px, 3.4vw, 36px)`, 700, tracking -0.025em, line-height 1.15. Вводная строка — 12 px / 700, uppercase; описание — 16 px mobile / 17 px desktop, line-height 1.55. Header использует wordmark 20 px / 800 / -0.045em.

Шкала fontSize в токенах и стандартные классы Tailwind — разные шкалы: token base = 14, а text-base = 16 при root 16 px. Аналогично token borderRadius.lg = 16, а rounded-lg = 8. Нужные размеры выбирайте по значению, а не по совпадению имени.

Знак белорусского рубля использует локальный шрифт nbrb, класс `.nbrb-icon-byn`, символ U+E901; файлы лежат в public/fonts/.

## Layout и адаптивность

Основная ширина контента — 1280. Базовый горизонтальный padding — 16 mobile / 32 desktop; лендинг использует 20 / 32. Header — строка 64 px плюс граница и safe-area-inset-top, одинаковая на лендинге и внутренних страницах. Панель закреплена сверху, фон темы с opacity 0.78 и backdrop blur 24 px. До монтирования React показывается только фон выбранной темы; старая статическая заставка удалена.

Breakpoints Tailwind: sm 640, md 768, lg 1024, xl 1280, 2xl 1536. С lg основные разделы видны по центру Header. До lg справа находится кнопка меню 44×44; она раскрывает нативный popover под панелью с тем же фоном и блюром. Строки разделов — минимум 48 px, активный раздел выделен gold. Меню закрывается при выборе раздела, клике вне панели, Escape и смене маршрута; браузер управляет возвратом фокуса. Для гостей доступны вход и регистрация, для аккаунта — выход. Нижняя навигация отсутствует. Минимальная ширина body — 320. Layout вычитает из 100dvh фактическую высоту Header и уведомления, учитывает safe area.

Лендинг: desktop hero-сетка 0.95fr / 1.05fr с gap 32, слева текст, справа три перекрывающиеся рамки iPhone со скриншотами мобильного приложения: поиск кофеен, карта и лента. Скриншоты лежат в public/images/app-screenshots/, светлый или тёмный вариант выбирается по теме сайта. Превью декоративное (`aria-hidden`, `inert`), действия доступны в основных секциях. Высота превью 560 desktop / 480 tablet / 400 до 480 px. На mobile текст и превью расположены последовательно, CTA вертикальные до sm. CTA используют Button: min-height 52, radius 14, текст 15 px. В строке зон фиксированы Динамо, Восток, Минск Мир, Немига, Новая Боровая, Октябрьская, Осмоловка и Площадь Победы. Секции карты, кофе и сообщества чередуют текст с существующими компонентами: desktop две равные колонки с gap 64 и вертикальными отступами 80; mobile одна колонка с gap 40 и отступами 48. Карточки кофе до 320 px, в одну колонку до 480 px. Карта и карточки показывают данные API; загрузка использует существующие skeleton-компоненты, ошибки — повторную загрузку. FAQ использует нативные details/summary и цвета темы. Завершающий блок объединяет заголовок и MobileAppDownload inline на тёмном кофейном фоне из дизайн-системы. В подвале четыре колонки: Открывай, Приложение, Контакты, Документы; copyright находится под подписью бренда. Ссылка «Настройки cookie» ведёт к существующему #analytics-settings в политике конфиденциальности. Город фиксирован: Минск, язык — русский.

Кнопка «Скачать приложение» открывает нативный dialog: max-width 480, radius 28; до sm — bottom sheet шириной 100%, max-height 90dvh с учётом safe area. Тема задаёт фон, текст и overlay. QR-код 192 px и копируемая ссылка ведут на `/download/auto` из LEGAL.siteUrl; ссылка копируется с подтверждением или доступна для ручного копирования при ошибке Clipboard API. Нативный dialog управляет фокусом, блокирует фон и закрывается по Escape, крестику и нажатию на подложку. MobileAppDownload inline переиспользует существующие DownloadButton: доступность каналов берётся из API, недоступный App Store показан без активной ссылки с подписью «Скоро». Если все каналы недоступны, inline показывает сообщение о временной недоступности установки. Варианты full и compact сохраняют прежнее поведение.

Публичная страница `/download/auto` не требует входа: iPhone/iPad/iPod переходят на `/download/ios`, Android — на `/download/android`, если соответствующий магазин доступен по конфигурации API. iPad с десктопным User-Agent определяется по Macintosh и нескольким точкам касания. На компьютере, неизвестном устройстве или при недоступном магазине остаётся страница выбора установки с доступными кнопками магазинов и APK. APK автоматически не скачивается. Карточка использует max-width 480, radius 28, отступы 20/40 по горизонтали и 40/48 по вертикали, фон и текст темы. С sm отображаются QR-код 192 px и инструкция для телефона; на мобильных остаются заголовок и варианты установки. Ошибка API показывает повторную загрузку через MobileAppDownload.

Discovery: ширина до 1920, колонки 1.36fr / 1fr, gap 16×24, padding 16px 24px 32px. Карточки auto-fill с минимальной шириной 360, для кофеен 320, gap 16. Рамка карты radius 28. До 1024 layout одноколоночный; высота карты clamp(220px, (100vw - 32px) × 0.625, 400px); обзорные списки — горизонтальные scroll-snap ленты. Раскрытая карта занимает область между навигацией. При выборе раздела кофеен или обжарщиков карта и кнопка «Карта» скрыты; возврат к обзору — шеврон слева от поиска. Переключатель зон доступен и на мобильной preview-карте. Заливка, контур и рамка подписи зоны используют её серверный color (#RRGGBB); при отсутствии корректного цвета применяется brand.primary. Подпись: «Название · число кофеен».

В каталоге кофе карточки ограничены шириной 320 px, как карточки кофеен; они переносятся на новую строку при сужении области результатов. Карточки загрузки используют ту же раскладку.
Карточки в одном ряду растягиваются до одинаковой высоты, а блок цены остаётся у нижнего края. Вместо отсутствующих вкусовых групп показывается одна подтверждённая характеристика: степень обжарки, назначение, обработка или имя обжарщика (в этом порядке). Если данных нет, выводится «Характеристики не указаны».

На карте кнопки масштаба, зон и геолокации собраны в горизонтальный ряд: цели 44×44, иконки 24, gap 8. Ряд расположен справа над каруселью с отступом 8 px; без карусели — в 16 px от нижнего края. Карточки карусели — до 320×96, внешние отступы 16, padding/gap 12, radius 24, фото 56×56; название 16 px, оценка и часы 12 px. Компактное мобильное превью скрывает карусель и оставляет кнопки в 12 px от нижнего края.

Маркеры кофеен повторяют Android: Specialty — зерно, CoffeeBar — чашка с блюдцем, Cafe — вилка и нож; исходные PNG из Android лежат в public/icons/map/ и окрашиваются CSS mask. Диаметр круга 31 px, выбранного — 41 px, в деталях и выборе адреса — 43 px; область нажатия 44×44. Фон, иконка и рамка следуют светлой/тёмной теме, выбранный маркер выделяется кольцом goldWarm 2 px с отступом 1.5 px. Клавиатурный фокус виден; reduced-motion отключает pop/pulse.

Карта передаёт API текущий масштаб и отображает серверные группы, зоны и отдельные кофейни. Кластеры — круги 34.1 px с фоном, рамкой и цветом текста текущей темы, как у маркеров кофеен; область нажатия 44×44, число 12/800. Подпись ограничена «99+», точное число доступно в aria-label. Группа из одной кофейни использует маркер зерна. Нажатие или Enter/Space приближает к границам группы, максимум на два уровня за раз; для совпадающих координат — на один. Подписи зон тоже приближают карту; ниже zoom 11 они скрываются сразу при масштабировании и возвращаются при приближении. При отключённых контурах серверные зоны отображаются числовыми группами, чтобы кофейни не исчезали. Порог группировки определяет сервер; загрузка отдельных кофеен рядом с пользователем остаётся независимой от масштаба.

Смена групп анимируется 380 ms: исходящие точки сходятся к центру новой группы, дочерние расходятся от центра прежней. Неизменившиеся маркеры сохраняются, повторный зум продолжает переход с текущей видимой позиции. Исходящие точки недоступны для фокуса и нажатия; фокус сохранённого маркера остаётся на нём. Системный reduced-motion и настройка превью отключают переходы. После изменения целого уровня масштаба запрос отправляется без дополнительной задержки; для панорамирования сохраняется debounce 300 ms.

Политика конфиденциальности и условия используют общий LegalPageLayout с Header. Ширина до 1280 px, внешней карточки и общей рамки нет. С lg слева закреплено оглавление шириной 224 px, gap до документа 48 px; оглавление прокручивается в пределах экрана, текущий раздел отмечен золотой линией. На mobile — раскрываемое оглавление перед текстом, закрывающееся после выбора. Якоря имеют отступ 96 px плюс safe-area-inset-top, существующие #posthog, #analytics-settings и #data-deletion сохранены. Тексты и дата документов при смене макета не изменяются.

Футер вынесен в общий `Footer` и подключён один раз после маршрутов приложения, а также в отдельной странице `/support`. Содержимое и оформление одинаковые: бренд с подписью и copyright, четыре колонки Открывай / Приложение / Контакты / Документы. Ширина до 1280 px, padding 40×20 на mobile и 48×32 на desktop; до sm ссылки в двух колонках, с sm — в четырёх, с lg бренд расположен слева. Компонент использует цвета текущей темы и самостоятельный CSS, поэтому support не подключает глобальные стили приложения. В приложении внутренние ссылки используют router; на standalone-странице — обычные переходы. Недоступные магазины сохраняют статус и ведут к доступным способам установки в настройках.

## Компоненты и состояния

В настройках ссылка «Связаться с поддержкой» находится в блоке «Другие настройки» и открывает `/support` с формой обращения. Она повторяет оформление соседних строк: иконка диалога на золотом полупрозрачном фоне, подпись и шеврон справа; при фокусе с клавиатуры показывается золотой контур.

### Button

Высота auto: определяется line-height, padding и границей. Padding 10×16, radius 12, текст по умолчанию 16/600, line-height 24, gap 8. Primary — gold с тёмным текстом и золотой тенью. Secondary и ghost имеют светлые варианты, указанные в реестре. Hover primary — primaryHover; pressed — scale 0.98; disabled — opacity 0.5; focus — ring 2 / gold 50%, offset 2. Loading — WobbleRing 20 с currentColor.

### Input

Высота auto, padding 16, line-height 24, radius 26, текст 16; label 14/500 с gap 8. Общий компонент не задаёт ширину границы (0); задаётся её цвет. Focus-ring — 3 / gold 10%. Слева может быть иконка с padding 48, справа — переключатель видимости пароля. Размеры/границы могут задаваться className; ошибки и подсказки выводятся формами отдельно.

### MaterialSelect

Min-height 56, border 2, radius 16, обычная label 16 / floating label 12. Label становится золотой при фокусе, открытии или наличии значения. Dropdown max-height 256, radius 16, margin-top 8, shadow-2xl. Focus — gold border и shadow-lg с gold 10%; selected option — gold 10% + gold text; hover dark — theme.border, light — gray-100. Enter/Space открывают и выбирают, Escape закрывает combobox, клик снаружи закрывает список. Стрелочная навигация отдельно не реализована.

### ShopCard

Radius 28, border 1, фото 16:9, padding контента 12px 16px 16px. Hover: translateY -2, gold border с alpha 112/255 (`#EAB30870`), тени shadow.card/cardHover. Переход transform 150 ms; фото увеличивается до 1.035 за 500 ms, кроме карточки обжарщика. Кофейня использует object-cover; кофе/обжарщик — object-contain.

Заголовок 20/800; кнопка избранного 44×44; аватары обжарщиков 48; статусы «Открыто/Закрыто» 11/800 uppercase, зелёный/красный. Карточка поддерживает Tab, Enter/Space и видимый focus-ring.

### CheckInCard

Карточка чекина в стиле поста: radius 20, border 1, padding 16 mobile / 20 desktop. Компактная шапка — avatar 48, имя 14/600, дата 12 mobile / 14 desktop. Название кофейни 20/700; под ним пять звёзд 20 и средняя оценка с одним десятичным знаком. Дробная часть рейтинга заполняет звезду пропорционально.

Напиток отображается справа внизу карточки, в одной строке с реакцией: вырезанное фото из drinkPhotoUrl вписывается в область 80×80 без обрезки, название 14/500 располагается справа от него. Фото, название и лайк выровнены по вертикальному центру. Нажатие на фото открывает PhotoLightbox. При отсутствии фото или ошибке загрузки используется иконка Coffee 32, без подставных изображений и эмодзи. Галерея оригиналов остаётся отдельной. Возврат в окно не сбрасывает фотографии: действующие изображения сохраняются, проверка доступа выполняется заранее в фоне. На успешный 304 сохраняется тот же object URL. Истечение разрешения, смена сессии и отказ доступа скрывают фото; при ожидании используется нейтральный фон без текста о загрузке поверх изображения. Домашние чекины используют те же фон, рамку, скругление и мобильное оформление ленты, что и чекины из кофеен; рецепт дополняет содержимое карточки. Текст чекина — 16, line-height 1.55, без обрезки. Одно фото занимает всю ширину в формате 3:2, в ленте — 2:1. Два фото расположены в одном ряду без пустых строк, формат галереи 8:3. При трёх и более фото коллаж 4:3: первое фото слева на две строки, второе и третье справа. При большем количестве третья ячейка показывает число оставшихся снимков; все доступны в PhotoLightbox.

Лента обновляется жестом вниз более чем на 80 px от верхнего края страницы; отдельной кнопки «Обновить» нет. Горизонтальные жесты, несколько касаний, отмена жеста и прокрутка внутри ленты не вызывают обновление. Во время загрузки повторное обновление блокируется.

Основная реакция — красное сердце 26 и счётчик 14, touch target 44. Использует существующий helpful API; для своих чекинов и гостей отображается счётчик. Действия автора и жалоба находятся в меню с многоточием. Статус публикации виден автору. Для созданных менее 24 часов назад чекинов показываются «15 минут назад», «4 часа назад» с русскими склонениями и обновлением раз в минуту; далее отображается дата посещения.

При создании чекина в кофейне и «Кофе дома» добавленные фотографии показаны миниатюрами 96×96 с radius 16, gap 12 и переносом строк. Номер в углу отражает порядок отправки. Нажатие открывает PhotoLightbox с перелистыванием всех выбранных снимков. Порядок меняется перетаскиванием миниатюры мышью, ручки «Порядок» мышью или пальцем, а также стрелками и Home/End при фокусе на ручке. Цель перетаскивания выделяется золотой рамкой 2 px. Удаление и ручка имеют touch target 44; изменения озвучиваются через live region. Во время отправки управление отключено.

### Header

LogoMark в Header — 52, radius round(size × 0.28) = 15. Сам LogoMark по умолчанию имеет size 40. Avatar — 34, в меню 38. Desktop-nav: min-height 34, padding 0×14, pill radius 999, текст 14/600. Header полупрозрачный (alpha 0.78), blur 24. Dropdown radius 16, min-width 224.

Нижняя навигация: Поиск, Кофе, Профиль, Настройки; кнопка min-height 64, иконка 23, подпись 10. На страницах деталей/создания кофейни панель скрывается. Header/нижняя панель имеют z-index 1100/1200.

### Toast, чипы, загрузка

Toast: min-width 320 / max-width 448, padding 16, radius 12, gap 12, текст 14/500, auto-close 5000 ms. Top/right 16, z-index 1200. Error-иконка 20, маскот 40, внешняя иллюстрация 80. Серверная ошибка — 7000 ms.

Badge-пресет: padding 4×12, radius full, 12/500. RemovableChip: padding 5px 8px 5px 12px, gap 4, radius 99, 12/600, фон gold с hex-alpha 15, border с hex-alpha 40. InfoChip: min-height 32, padding-x 12, 14/500, pill.

WobbleRing: size 48 / 20 в кнопке, border max(2, round(size/16)); spin 1.6 s, morph 5 s. Shimmer: dark #3D2F28 / light #ECEAE7, radius 8 или full, движение полосы 1.8 s; reduced-motion отключает движение. Loader/Toast используют role=status.

### Дополнительные паттерны

ShopSearchBar — capsule 56 mobile / 44 или 52 desktop. PriceRangeSlider — три сегмента «До 8 / 8 / От 8», height от 30, текст 12, active gold. ThemeToggle — circle 40 по умолчанию. OTP — 6 ячеек, 44×56 mobile / 56×64 sm / 64×80 lg, тёмная палитра.

CheckInModal — bottom sheet mobile / центральная панель desktop, radius 32, max-width 440. ReportShopIssueModal — radius 28, max-width 420. PhotoCarousel — 16:9 вне card-view, radius 12, переход 300 ms. PhotoLightbox — нативный dialog, overlay 82%, close 44 и стрелки 48, возврат фокуса. CookieBanner — radius 24, ширина 380 desktop, z-index 1250; mobile отступ снизу 16 px плюс safe area. Плавающая кнопка чекина на mobile — 20 px от нижней safe area.

## Эффекты и анимации

Лендинг использует однотонный theme.background, границы theme.border и существующие тени карточек; отдельные фоновые текстуры и radial-glow не применяются. Фиксированные тени/opacity и основные длительности приведены в реестре.

Основные переходы — 150/200/300 ms; discovery layout использует 350 ms для геометрии и 200 для opacity. Выбранный маркер карты: pop 350 ms / pulse 1.8 s. Бегущее длинное имя обжарщика — 6 s, с паузой на hover/focus-within. Reduced-motion обрабатывается для discovery, skeleton, маркеров, названий и части лендинга; WobbleRing сохраняет свою анимацию. Классы animate-in/slide-in/fade-in в JSX не подключают отдельную анимацию входа: соответствующий плагин не настроен.

## Иконки и ассеты

Иконки — @phosphor-icons/react, общий реэкспорт src/components/Icon.tsx. AppIcon: size 20 по умолчанию, regular / fill для filled; явный weight имеет приоритет. Legacy material-имена преобразуются через iconMap. StarIcon и BeanPriceMarks используются для рейтинга и цены.

SVG методов заваривания лежат в public/icons/brew-methods/: aeropress, batch-brew, cezve, chemex, cold-brew, espresso, v60. AppIcon окрашивает их через CSS mask.

Логотип — public/logo/logo.png, фон задаётся темой. Маскот — public/maskot-emotion/ (happy, astonishment, dance) и public/maskot-props/ (book, laptop, magnifying-glass, bean, cup, dessert); файл чашки называется maskot-wthi-cup.png. Mascot default size 160. Favicon и manifest — public/favicon/, store badges — public/images/, карта — public/map-minsk.svg, серверная иллюстрация — public/server-error.gif.

## Межплатформенный экспорт и админка

tokens.json предназначен для импорта значений на другие платформы: размеры веба в px, Android — dp после адаптации; текстовые размеры требуют sp. Android XML, Compose theme и отдельная JSON schema не входят в репозиторий. Необходимо преобразовать CSS-цвета при импорте в Android, а не читать rgba как ARGB hex.

Соответствие Material 3: brand.primary → primary; textOnPrimary → onPrimary; background → background; surface → surface; textPrimary → onSurface; textSecondary → onSurfaceVariant; border → outline; semantic.error → error.

coffee-peek-admin — отдельное приложение с собственной конфигурацией Tailwind и компонентами. Оно использует те же основные цвета и Manrope, но данный каталог специфицирует пользовательский сайт.

## Использование в вебе

```typescript
import { brand, getThemeColors, spacing, borderRadius, card } from '@/design-system';

const colors = getThemeColors(theme);
const accent = brand.primary;            // #EAB308
const contentPadding = spacing[4];       // 16
const cardRadius = card.borderRadius;    // 28
const inputRadius = borderRadius['3xl']; // 26
```

Совместимые импорты COLORS и getThemeColors через src/constants/colors.ts сохраняются.

## Полный реестр токенов и спецификаций

Раздел генерируется из TypeScript командой npm run design:sync. Все числовые размеры ниже — px, tracking — em, длительности — ms; отношение сторон и auto записаны строками.

<!-- design-system:start -->

### brand

| Токен / поле | Значение |
|---|---|
| `brand.primary` | `#EAB308` |
| `brand.primaryHover` | `#FACC15` |
| `brand.primaryDark` | `#CA8A04` |
| `brand.primaryLight` | `#FEF3C7` |
| `brand.goldWarm` | `#D4A84B` |
| `brand.goldWarmHover` | `#B68A2E` |
| `brand.goldWarmSoft` | `#F8F1DD` |

### semantic

| Токен / поле | Значение |
|---|---|
| `semantic.success` | `#22C55E` |
| `semantic.error` | `#EF4444` |
| `semantic.warning` | `#EAB308` |
| `semantic.info` | `#3B82F6` |

### light

| Токен / поле | Значение |
|---|---|
| `light.background` | `#FAFAF9` |
| `light.surface` | `#FFFFFF` |
| `light.surfaceAlt` | `#F9F8F6` |
| `light.card` | `#FFFFFF` |
| `light.input` | `#FFFFFF` |
| `light.badge` | `#F3F4F6` |
| `light.textPrimary` | `#1C1917` |
| `light.textSecondary` | `#78716C` |
| `light.textMuted` | `#75706B` |
| `light.textTertiary` | `#6B7280` |
| `light.textOnPrimary` | `#1A1412` |
| `light.border` | `#E7E5E4` |
| `light.borderSubtle` | `#E5E1DA` |
| `light.borderHover` | `#D1D5DB` |
| `light.overlay` | `rgba(0, 0, 0, 0.5)` |
| `light.scrollbarTrack` | `#F5F4F2` |
| `light.scrollbarThumb` | `#D1D5DB` |

### dark

| Токен / поле | Значение |
|---|---|
| `dark.background` | `#1A1412` |
| `dark.surface` | `#2D241F` |
| `dark.surfaceAlt` | `#2D241F` |
| `dark.card` | `#2D241F` |
| `dark.input` | `#1A1412` |
| `dark.badge` | `#2D241F` |
| `dark.textPrimary` | `#FFFFFF` |
| `dark.textSecondary` | `#A39E93` |
| `dark.textMuted` | `#A8A8A8` |
| `dark.textTertiary` | `#5C544F` |
| `dark.textOnPrimary` | `#1A1412` |
| `dark.border` | `#3D2F28` |
| `dark.borderSubtle` | `#3D2F28` |
| `dark.borderHover` | `#4A3D35` |
| `dark.overlay` | `rgba(0, 0, 0, 0.5)` |
| `dark.scrollbarTrack` | `#1A1412` |
| `dark.scrollbarThumb` | `#3D2F28` |

### typography

| Токен / поле | Значение |
|---|---|
| `typography.fontFamily.display` | `Manrope` |
| `typography.fontFamily.body` | `Manrope` |
| `typography.fontWeight.ultralight` | `200` |
| `typography.fontWeight.light` | `300` |
| `typography.fontWeight.regular` | `400` |
| `typography.fontWeight.medium` | `500` |
| `typography.fontWeight.semibold` | `600` |
| `typography.fontWeight.bold` | `700` |
| `typography.fontWeight.extrabold` | `800` |
| `typography.fontWeight.black` | `900` |
| `typography.fontSize.xs` | `12` |
| `typography.fontSize.sm` | `13` |
| `typography.fontSize.base` | `14` |
| `typography.fontSize.md` | `15` |
| `typography.fontSize.lg` | `16` |
| `typography.fontSize.xl` | `20` |
| `typography.fontSize.2xl` | `24` |
| `typography.fontSize.3xl` | `30` |
| `typography.fontSize.4xl` | `36` |
| `typography.fontSize.hero` | `88` |
| `typography.lineHeight.tight` | `0.92` |
| `typography.lineHeight.snug` | `0.95` |
| `typography.lineHeight.normal` | `1.15` |
| `typography.lineHeight.relaxed` | `1.5` |
| `typography.letterSpacing.wordmark` | `-0.045` |
| `typography.letterSpacing.hero` | `-0.01` |
| `typography.letterSpacing.heading` | `-0.02` |
| `typography.letterSpacing.label` | `-0.025` |
| `typography.letterSpacing.normal` | `0` |

### spacing

| Токен / поле | Значение |
|---|---|
| `spacing.0` | `0` |
| `spacing.1` | `4` |
| `spacing.2` | `8` |
| `spacing.3` | `12` |
| `spacing.4` | `16` |
| `spacing.5` | `20` |
| `spacing.6` | `24` |
| `spacing.7` | `28` |
| `spacing.8` | `32` |
| `spacing.10` | `40` |
| `spacing.12` | `48` |
| `spacing.16` | `64` |
| `spacing.18` | `72` |

### borderRadius

| Токен / поле | Значение |
|---|---|
| `borderRadius.sm` | `8` |
| `borderRadius.md` | `12` |
| `borderRadius.lg` | `16` |
| `borderRadius.xl` | `20` |
| `borderRadius.2xl` | `24` |
| `borderRadius.3xl` | `26` |
| `borderRadius.4xl` | `28` |
| `borderRadius.full` | `9999` |

### borderWidth

| Токен / поле | Значение |
|---|---|
| `borderWidth.thin` | `1` |
| `borderWidth.medium` | `2` |

### shadow

| Токен / поле | Значение |
|---|---|
| `shadow.buttonPrimary` | `0 4px 6px -4px rgba(180, 140, 75, 0.2), 0 10px 15px -3px rgba(180, 140, 75, 0.2)` |
| `shadow.card` | `0 3px 14px rgba(0,0,0,.08)` |
| `shadow.cardHover` | `0 12px 32px rgba(0,0,0,.22)` |
| `shadow.dropdown` | `0 25px 50px -12px rgba(0, 0, 0, 0.25)` |
| `shadow.focusRing` | `0 0 0 3px rgba(234, 179, 8, 0.1)` |
| `shadow.goldGlow` | `0 4px 12px rgba(234, 179, 8, 0.18)` |

### opacity

| Токен / поле | Значение |
|---|---|
| `opacity.disabled` | `0.5` |
| `opacity.primaryTint10` | `0.1` |
| `opacity.primaryTint20` | `0.2` |
| `opacity.primaryTint30` | `0.3` |
| `opacity.primaryTint40` | `0.4` |
| `opacity.primaryTint50` | `0.5` |
| `opacity.surfaceBackdrop` | `0.88` |
| `opacity.surfaceBackdropDark` | `0.7` |

### animation

| Токен / поле | Значение |
|---|---|
| `animation.durationFast` | `150` |
| `animation.durationNormal` | `200` |
| `animation.durationSlow` | `300` |
| `animation.durationToast` | `5000` |
| `animation.easingDefault` | `ease` |
| `animation.buttonPressScale` | `0.98` |

### layout

| Токен / поле | Значение |
|---|---|
| `layout.headerHeight` | `64` |
| `layout.headerHeightLanding` | `64` |
| `layout.maxContentWidth` | `1280` |
| `layout.contentPaddingX` | `16` |
| `layout.contentPaddingXDesktop` | `32` |

### button

| Токен / поле | Значение |
|---|---|
| `button.height` | `auto` |
| `button.paddingVertical` | `10` |
| `button.paddingHorizontal` | `16` |
| `button.borderRadius` | `12` |
| `button.fontSize` | `16` |
| `button.lineHeight` | `24` |
| `button.fontWeight` | `600` |
| `button.fontFamily` | `Manrope` |
| `button.gap` | `8` |
| `button.variants.primary.background` | `brand.primary` |
| `button.variants.primary.text` | `theme.textOnPrimary` |
| `button.variants.primary.backgroundHover` | `brand.primaryHover` |
| `button.variants.primary.shadow` | `shadow.buttonPrimary` |
| `button.variants.secondary.background` | `theme.surface` |
| `button.variants.secondary.text` | `theme.textPrimary` |
| `button.variants.secondary.border` | `theme.border` |
| `button.variants.secondary.backgroundHover` | `theme.border` |
| `button.variants.secondary.light.background` | `#F3F4F6` |
| `button.variants.secondary.light.text` | `#111827` |
| `button.variants.secondary.light.border` | `#D1D5DB` |
| `button.variants.secondary.light.backgroundHover` | `#E5E7EB` |
| `button.variants.ghost.background` | `transparent` |
| `button.variants.ghost.text` | `theme.textSecondary` |
| `button.variants.ghost.textHover` | `theme.textPrimary` |
| `button.variants.ghost.light.text` | `#4B5563` |
| `button.variants.ghost.light.textHover` | `#111827` |
| `button.states.disabledOpacity` | `0.5` |
| `button.states.pressScale` | `0.98` |
| `button.states.focusRingWidth` | `2` |
| `button.states.focusRingColor` | `brand.primary` |
| `button.states.focusRingOpacity` | `0.5` |
| `button.states.focusRingOffset` | `2` |

### input

| Токен / поле | Значение |
|---|---|
| `input.height` | `auto` |
| `input.paddingVertical` | `16` |
| `input.paddingHorizontal` | `16` |
| `input.paddingHorizontalWithIcon` | `48` |
| `input.borderRadius` | `26` |
| `input.fontSize` | `16` |
| `input.lineHeight` | `24` |
| `input.labelFontSize` | `14` |
| `input.labelFontWeight` | `500` |
| `input.borderWidth` | `0` |
| `input.states.defaultBorder` | `theme.border` |
| `input.states.defaultBorderLight` | `#E5E7EB` |
| `input.states.focusBorder` | `brand.primary` |
| `input.states.focusRingWidth` | `3` |
| `input.states.focusRingColor` | `brand.primary` |
| `input.states.focusRingOpacity` | `0.1` |
| `input.states.placeholder` | `theme.textTertiary` |

### select

| Токен / поле | Значение |
|---|---|
| `select.minHeight` | `56` |
| `select.paddingVertical` | `16` |
| `select.paddingHorizontal` | `16` |
| `select.paddingHorizontalWithIcon` | `48` |
| `select.borderRadius` | `16` |
| `select.fontSize` | `16` |
| `select.labelFontSize` | `12` |
| `select.borderWidth` | `2` |
| `select.dropdownMaxHeight` | `256` |
| `select.dropdownBorderRadius` | `16` |
| `select.states.defaultBorder` | `theme.border` |
| `select.states.defaultBorderLight` | `#E5E7EB` |
| `select.states.focusBorder` | `brand.primary` |
| `select.states.focusShadow` | `0 10px 15px -3px rgba(234,179,8,.1), 0 4px 6px -4px rgba(234,179,8,.1)` |
| `select.states.selectedItemBackground` | `brand.primary` |
| `select.states.selectedItemBackgroundOpacity` | `0.1` |
| `select.states.hoverItemBackground` | `theme.border` |
| `select.states.hoverItemBackgroundLight` | `#F3F4F6` |

### card

| Токен / поле | Значение |
|---|---|
| `card.borderRadius` | `28` |
| `card.borderWidth` | `1` |
| `card.padding` | `16` |
| `card.paddingTop` | `12` |
| `card.photoAspectRatio` | `16:9` |
| `card.hoverTranslateY` | `-2` |
| `card.hoverTransitionMs` | `150` |
| `card.photoHoverScale` | `1.035` |
| `card.photoTransitionMs` | `500` |
| `card.states.defaultBorder` | `theme.border` |
| `card.states.hoverBorder` | `brand.primary` |
| `card.states.hoverBorderOpacity` | `0.4392156862745098` |
| `card.states.shadow` | `shadow.card` |
| `card.states.shadowHover` | `shadow.cardHover` |

### checkInCard

| Токен / поле | Значение |
|---|---|
| `checkInCard.borderRadius` | `20` |
| `checkInCard.borderWidth` | `1` |
| `checkInCard.padding` | `16` |
| `checkInCard.paddingDesktop` | `20` |
| `checkInCard.avatarSize` | `48` |
| `checkInCard.authorFontSize` | `14` |
| `checkInCard.dateFontSize` | `12` |
| `checkInCard.dateFontSizeDesktop` | `14` |
| `checkInCard.shopFontSize` | `20` |
| `checkInCard.starSize` | `20` |
| `checkInCard.bodyFontSize` | `16` |
| `checkInCard.bodyLineHeight` | `1.55` |
| `checkInCard.drink.placement` | `bottom-right` |
| `checkInCard.drink.layout` | `horizontal` |
| `checkInCard.drink.verticalAlign` | `center` |
| `checkInCard.drink.photoSize` | `80` |
| `checkInCard.drink.photoFit` | `contain` |
| `checkInCard.drink.fallbackIconSize` | `32` |
| `checkInCard.drink.fontSize` | `14` |
| `checkInCard.photos.borderRadius` | `12` |
| `checkInCard.photos.gap` | `4` |
| `checkInCard.photos.singleAspectRatio` | `3:2` |
| `checkInCard.photos.feedSingleAspectRatio` | `2:1` |
| `checkInCard.photos.twoAspectRatio` | `8:3` |
| `checkInCard.photos.collageAspectRatio` | `4:3` |
| `checkInCard.photos.fourAspectRatio` | `4:3` |
| `checkInCard.reaction.iconSize` | `26` |
| `checkInCard.reaction.minHeight` | `44` |
| `checkInCard.reaction.color` | `#EF4444` |
| `checkInCard.reaction.fontSize` | `14` |

### checkInPhotoGallery

| Токен / поле | Значение |
|---|---|
| `checkInPhotoGallery.thumbnailSize` | `96` |
| `checkInPhotoGallery.borderRadius` | `16` |
| `checkInPhotoGallery.gap` | `12` |
| `checkInPhotoGallery.layout` | `flex-wrap` |
| `checkInPhotoGallery.maxPhotos` | `5` |
| `checkInPhotoGallery.removeTouchTarget` | `44` |
| `checkInPhotoGallery.reorderTouchTarget` | `44` |
| `checkInPhotoGallery.reorderIconSize` | `18` |
| `checkInPhotoGallery.dropIndicatorWidth` | `2` |
| `checkInPhotoGallery.dropIndicatorColor` | `brand.primary` |
| `checkInPhotoGallery.preview` | `PhotoLightbox` |
| `checkInPhotoGallery.reorder` | `mouse-drag, pointer-handle, keyboard-arrows-home-end` |

### publicProfile

| Токен / поле | Значение |
|---|---|
| `publicProfile.maxWidth` | `680` |
| `publicProfile.maxWidthDesktop` | `1280` |
| `publicProfile.twoColumnBreakpoint` | `1024` |
| `publicProfile.overviewWidthDesktop` | `420` |
| `publicProfile.overviewStickyGap` | `16` |
| `publicProfile.overviewFocusInset` | `6` |
| `publicProfile.columnGapDesktop` | `32` |
| `publicProfile.columnGapWide` | `48` |
| `publicProfile.paddingHorizontal` | `16` |
| `publicProfile.paddingHorizontalDesktop` | `32` |
| `publicProfile.headerTouchTarget` | `44` |
| `publicProfile.avatarSize` | `88` |
| `publicProfile.avatarSizeNarrow` | `72` |
| `publicProfile.avatarSizeDesktop` | `104` |
| `publicProfile.nameFontSize` | `22` |
| `publicProfile.nameFontSizeDesktop` | `30` |
| `publicProfile.statFontSize` | `22` |
| `publicProfile.statLabelFontSize` | `11` |
| `publicProfile.sectionGap` | `20` |
| `publicProfile.weekBorderRadius` | `20` |
| `publicProfile.calendarDayBorderRadius` | `10` |
| `publicProfile.favoriteWidth` | `160` |
| `publicProfile.favoriteWidthDesktop` | `192` |
| `publicProfile.checkInPageSize` | `10` |
| `publicProfile.checkInPrefetchMargin` | `400` |
| `publicProfile.dialogMaxWidth` | `640` |
| `publicProfile.dialogMaxHeight` | `85dvh` |
| `publicProfile.dialogBorderRadius` | `24` |
| `publicProfile.activityTimeZone` | `Europe/Minsk` |

### toast

| Токен / поле | Значение |
|---|---|
| `toast.minWidth` | `320` |
| `toast.maxWidth` | `448` |
| `toast.padding` | `16` |
| `toast.borderRadius` | `12` |
| `toast.fontSize` | `14` |
| `toast.fontWeight` | `500` |
| `toast.gap` | `12` |
| `toast.durationMs` | `5000` |
| `toast.iconSize` | `20` |
| `toast.imageSize` | `80` |

### header

| Токен / поле | Значение |
|---|---|
| `header.height` | `64` |
| `header.heightLanding` | `64` |
| `header.backdropBlur` | `24` |
| `header.mobileNavigation` | `top-popover` |
| `header.mobileMenuButtonSize` | `44` |
| `header.mobileMenuItemMinHeight` | `48` |
| `header.logoSize` | `52` |
| `header.logoBorderRadius` | `15` |
| `header.navButtonMinHeight` | `34` |
| `header.navButtonPaddingVertical` | `0` |
| `header.navButtonPaddingHorizontal` | `14` |
| `header.navButtonBorderRadius` | `999` |
| `header.navFontSize` | `14` |
| `header.navFontWeight` | `600` |
| `header.avatarSize` | `34` |
| `header.avatarSizeLarge` | `38` |

### badge

| Токен / поле | Значение |
|---|---|
| `badge.paddingVertical` | `4` |
| `badge.paddingHorizontal` | `12` |
| `badge.borderRadius` | `9999` |
| `badge.fontSize` | `12` |
| `badge.fontWeight` | `500` |

### loader

| Токен / поле | Значение |
|---|---|
| `loader.defaultSize` | `48` |
| `loader.buttonSize` | `20` |
| `loader.color` | `brand.primary` |
| `loader.borderWidthRatio` | `16` |
| `loader.minBorderWidth` | `2` |
| `loader.borderWidthRounding` | `round` |

### typographyStyles

| Токен / поле | Значение |
|---|---|
| `typographyStyles.wordmark.fontFamily` | `Manrope` |
| `typographyStyles.wordmark.fontWeight` | `800` |
| `typographyStyles.wordmark.fontSize` | `20` |
| `typographyStyles.wordmark.letterSpacing` | `-0.045` |
| `typographyStyles.hero.fontFamily` | `Manrope` |
| `typographyStyles.hero.fontWeight` | `900` |
| `typographyStyles.hero.fontSize` | `88` |
| `typographyStyles.hero.letterSpacing` | `-0.05` |
| `typographyStyles.hero.lineHeight` | `0.95` |
| `typographyStyles.h1.fontFamily` | `Manrope` |
| `typographyStyles.h1.fontWeight` | `700` |
| `typographyStyles.h1.fontSize` | `36` |
| `typographyStyles.h1.letterSpacing` | `-0.02` |
| `typographyStyles.h2.fontFamily` | `Manrope` |
| `typographyStyles.h2.fontWeight` | `700` |
| `typographyStyles.h2.fontSize` | `24` |
| `typographyStyles.h2.letterSpacing` | `-0.025` |
| `typographyStyles.h3.fontFamily` | `Manrope` |
| `typographyStyles.h3.fontWeight` | `700` |
| `typographyStyles.h3.fontSize` | `20` |
| `typographyStyles.body.fontFamily` | `Manrope` |
| `typographyStyles.body.fontWeight` | `400` |
| `typographyStyles.body.fontSize` | `16` |
| `typographyStyles.bodySmall.fontFamily` | `Manrope` |
| `typographyStyles.bodySmall.fontWeight` | `400` |
| `typographyStyles.bodySmall.fontSize` | `14` |
| `typographyStyles.caption.fontFamily` | `Manrope` |
| `typographyStyles.caption.fontWeight` | `400` |
| `typographyStyles.caption.fontSize` | `12` |
| `typographyStyles.label.fontFamily` | `Manrope` |
| `typographyStyles.label.fontWeight` | `500` |
| `typographyStyles.label.fontSize` | `14` |

<!-- design-system:end -->
