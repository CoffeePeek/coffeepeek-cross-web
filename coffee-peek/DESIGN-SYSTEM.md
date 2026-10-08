# CoffeePeek Design System

Единая дизайн-система для веб-приложения и Android. Все токены и спецификации компонентов собраны в одном месте.

## Структура файлов

```
src/design-system/
├── tokens.ts              # TypeScript — источник правды для веба
├── tokens.json            # JSON — для импорта в Android / другие платформы
├── components.ts          # Спецификации UI-компонентов
├── index.ts               # Публичный экспорт
└── android/
    ├── colors.xml         # Android colors (light)
    ├── colors-night.xml   # Android colors (dark)
    ├── dimens.xml         # Android размеры
    └── CoffeePeekTheme.kt.example  # Jetpack Compose тема
```

## Бренд

| Токен | HEX | Android resource | Использование |
|-------|-----|------------------|---------------|
| `brand.primary` | `#EAB308` | `brand_primary` | Кнопки, акценты, фокус |
| `brand.primaryHover` | `#FACC15` | `brand_primary_hover` | Hover кнопок |
| `brand.primaryDark` | `#CA8A04` | `brand_primary_dark` | Pressed state |
| `brand.primaryLight` | `#FEF3C7` | `brand_primary_light` | Фон бейджей |
| `brand.goldWarm` | `#D4A84B` | `brand_gold_warm` |
 Аватары, декор |
| `brand.goldWarmSoft` | `#F8F1DD` | `brand_gold_warm_soft` | Мягкий фон |

## Семантические цвета

| Токен | HEX | Назначение |
|-------|-----|------------|
| `semantic.success` | `#22C55E` | Успех, одобрено |
| `semantic.error` | `#EF4444` | Ошибки, выход |
| `semantic.warning` | `#EAB308` | Предупреждения |
| `semantic.info` | `#3B82F6` | Информация |

## Темы (Light / Dark)

### Dark (основная тема по умолчанию)

| Токен | HEX |
|-------|-----|
| `dark.background` | `#1A1412` |
| `dark.surface` | `#2D241F` |
| `dark.card` | `#2D241F` |
| `dark.input` | `#1A1412` |
| `dark.textPrimary` | `#FFFFFF` |
| `dark.textSecondary` | `#A39E93` |
| `dark.textMuted` | `#A8A8A8` |
| `dark.textTertiary` | `#5C544F` |
| `dark.textOnPrimary` | `#1A1412` |
| `dark.border` | `#3D2F28` |
| `dark.borderHover` | `#4A3D35` |

### Light

| Токен | HEX |
|-------|-----|
| `light.background` | `#FAFAF9` |
| `light.surface` | `#FFFFFF` |
| `light.card` | `#FFFFFF` |
| `light.input` | `#FFFFFF` |
| `light.textPrimary` | `#1C1917` |
| `light.textSecondary` | `#78716C` |
| `light.textMuted` | `#75706B` |
| `light.textTertiary` | `#6B7280` |
| `light.textOnPrimary` | `#1A1412` |
| `light.border` | `#E7E5E4` |
| `light.borderHover` | `#D1D5DB` |

## Типографика

### Шрифты

| Роль | Семейство | Tailwind | Использование |
|------|-----------|----------|---------------|
| Body (простой текст) | Manrope | `font-body` | Параграфы, формы, дефолтный текст |
| Headline (заголовки) | Manrope | `font-extended` | H1–H3, заголовки секций |
| Accent (крупные брендовые акценты) | Manrope | `font-expanded`, `.wordmark`, `.hero-text`, `.numeral` | Логотип, hero, крупные цифры |
| Condensed (мало места) | Manrope | `font-condensed` | Бейджи, чипы, плотный UI |
| Icons | Phosphor Icons (`@phosphor-icons/react`) | — | — |

Единый шрифт Manrope (variable, вес 400–900), подключается через Google Fonts в `index.html`.

Android-соответствие (плейсхолдер, пока не портировано): Manrope из Google Fonts → `res/font/`.

### Стили текста

| Стиль | Font | Weight | Size | Letter-spacing | Line-height |
|-------|------|--------|------|----------------|-------------|
| Wordmark | Accent | 800 | 20px | -0.045em | — |
| Hero | Accent | 900 | 88px | -0.045em | 0.95 |
| H1 | Headline | 700 | 36px | -0.02em | — |
| H2 | Headline | 700 | 24px | -0.025em | 1.15 |
| H3 | Headline | 700 | 20px | — | — |
| Body | Body | 400 | 16px | — | — |
| Body Small | Body | 400 | 14px | — | — |
| Label | Body | 500 | 14px | — | — |
| Caption | Body | 400 | 12px | — | — |

## Spacing

| Токен | px / dp |
|-------|---------|
| `spacing.1` | 4 |
| `spacing.2` | 8 |
| `spacing.3` | 12 |
| `spacing.4` | 16 |
| `spacing.5` | 20 |
| `spacing.6` | 24 |
| `spacing.8` | 32 |
| `spacing.16` | 64 |

## Border Radius

| Токен | px / dp | Использование |
|-------|---------|---------------|
| `radius.sm` | 8 | Nav buttons, small chips |
| `radius.md` | 12 | Button, Toast |
| `radius.lg` | 16 | Card, Select |
| `radius.3xl` | 26 | Input |
| `radius.4xl` | 28 | Landing widgets |
| `radius.full` | 9999 | Avatar, badges |

## Компоненты

### CheckInCard

Карточка чекина в стиле поста: radius 20, border 1, padding 16 mobile / 20 desktop. Компактная шапка — avatar 48, имя 14/600, дата 12 mobile / 14 desktop. Название кофейни 20/700; под ним пять звёзд 20 и средняя оценка с одним десятичным знаком. Дробная часть рейтинга заполняет звезду пропорционально.

Напиток отображается только при наличии: строка min-height 56, radius 16, локальное моковое фото 44×44 с radius 12, название 14/500 и стрелка для просмотра фото. Текст чекина — 16, line-height 1.55, без обрезки. Одно фото занимает всю ширину в формате 3:2; два/три фото образуют коллаж 5:3; четыре — сетку 5:4. При большем количестве четвёртая ячейка показывает число оставшихся снимков; все доступны в PhotoLightbox.

Основная реакция — красное сердце 26 и счётчик 14, touch target 44. Использует существующий helpful API; для своих чекинов и гостей отображается счётчик. Действия автора и жалоба находятся в меню с многоточием. Статус публикации виден автору. Для созданных менее 24 часов назад чекинов показываются «15 минут назад», «4 часа назад» с русскими склонениями и обновлением раз в минуту; далее отображается дата посещения.

### Button

| Параметр | Значение |
|----------|----------|
| Height | 40dp |
| Padding | 10dp vertical, 16dp horizontal |
| Border radius | 12dp |
| Font | 16sp, semibold (600) |
| Gap (icon + text) | 8dp |

**Варианты:**

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| `primary` | `brand.primary` | `theme.textOnPrimary` | — |
| `secondary` | `theme.surface` | `theme.textPrimary` | `theme.border` |
| `ghost` | transparent | `theme.textSecondary` | — |

**Состояния:**
- Hover: `brand.primaryHover` (primary), `theme.border` (secondary)
- Pressed: scale 0.98
- Disabled: opacity 0.5
- Focus: ring 2dp, `brand.primary` at 50% opacity
- Loading: WobbleRing 20dp, цвет `currentColor`

### Input

| Параметр | Значение |
|----------|----------|
| Min height | 52dp |
| Padding | 16dp |
| Border radius | 26dp |
| Font | 16sp |
| Label | 14sp, medium |

**Состояния:**
- Default border: `theme.border`
- Focus border: `brand.primary`
- Focus ring: 3dp, `brand.primary` at 10% opacity
- Placeholder: `theme.textTertiary`

### Select (MaterialSelect)

| Параметр | Значение |
|----------|----------|
| Min height | 56dp |
| Border radius | 16dp |
| Border width | 2dp |
| Floating label | 12sp, `brand.primary` when focused |
| Dropdown max height | 256dp |

**Состояния:**
- Focus: border `brand.primary`, shadow gold glow
- Selected item: background `brand.primary` at 10%, text `brand.primary`
- Hover item: `theme.border`

### Card (ShopCard)

| Параметр | Значение |
|----------|----------|
| Border radius | 16dp |
| Border | 1dp `theme.border` |
| Photo aspect ratio | 5:3 |
| Hover | translateY -3dp, border `brand.primary` at 31%, shadow cardHover |

### Toast

| Параметр | Значение |
|----------|----------|
| Min width | 320dp |
| Max width | 448dp |
| Padding | 16dp |
| Border radius | 12dp |
| Font | 14sp, medium |
| Duration | 5000ms |
| Background (dark) | `#2D241F` |
| Background (light) | `#FFFFFF` |

### Header

| Параметр | Значение |
|----------|----------|
| Height | 64dp (72dp на лендинге) |
| Logo size | 40dp |
| Logo radius | 12dp |
| Avatar | 30dp (dropdown: 38dp) |
| Nav button padding | 7dp × 12dp |
| Nav font | 14sp, semibold |

### Loader (WobbleRing)

| Параметр | Значение |
|----------|----------|
| Default size | 48dp |
| Button size | 20dp |
| Color | `#EAB308` |
| Border width | max(2, size/16) |

## Анимации

| Токен | Значение |
|-------|----------|
| `durationFast` | 150ms |
| `durationNormal` | 200ms |
| `durationSlow` | 300ms |
| `durationToast` | 5000ms |
| `buttonPressScale` | 0.98 |

## Передача в Android

### Шаг 1: Скопировать ресурсы

```bash
# Colors
cp src/design-system/android/colors.xml       → app/src/main/res/values/colors.xml
cp src/design-system/android/colors-night.xml → app/src/main/res/values-night/colors.xml

# Dimensions
cp src/design-system/android/dimens.xml       → app/src/main/res/values/dimens.xml
```

### Шаг 2: Шрифты

Скачайте Manrope с Google Fonts → `res/font/`.

### Шаг 3: Compose Theme

Используйте `CoffeePeekTheme.kt.example` как основу для `MaterialTheme`:
- `CoffeePeekDarkColorScheme` / `CoffeePeekLightColorScheme`
- `CoffeePeekTypography`
- `CoffeePeekDimens`

### Шаг 4: JSON-токены

`tokens.json` можно парсить в build-скрипте для автогенерации Android-ресурсов.

### Маппинг Material 3

| CoffeePeek | Material 3 |
|------------|--------------|
| `brand.primary` | `colorScheme.primary` |
| `theme.textOnPrimary` | `colorScheme.onPrimary` |
| `theme.background` | `colorScheme.background` |
| `theme.surface` | `colorScheme.surface` |
| `theme.textPrimary` | `colorScheme.onSurface` |
| `theme.textSecondary` | `colorScheme.onSurfaceVariant` |
| `theme.border` | `colorScheme.outline` |
| `semantic.error` | `colorScheme.error` |

## Использование в веб-проекте

```typescript
import { brand, dark, spacing, borderRadius } from '@/design-system';
import { button, input, typographyStyles } from '@/design-system/components';

// Цвета
const bg = dark.background;        // #1A1412
const accent = brand.primary;        // #EAB308

// Размеры компонентов
const btnHeight = button.height;     // 40
const inputRadius = input.borderRadius; // 26
```

Обратная совместимость: `import { COLORS } from '@/constants/colors'` продолжает работать.

## Иконки

Веб использует **Phosphor Icons** (`@phosphor-icons/react`) через `src/components/Icon.tsx`:
- Прямые импорты: `User`, `Gear`, `Star`, `MapPin`, `Coffee`, и др.
- Обратная совместимость: `Icons` object (`Coffee`, `Back`, `Check`, `Map`, `Menu`, `Close`, `Alert`, `Home`, `Info`)
- `AppIcon` в `src/components/icons/` — маппинг legacy material-имён на Phosphor (для постепенной миграции)

Для Android рекомендуется Material Icons Extended + custom vector drawables для брендовых иконок (кофейная чашка).
