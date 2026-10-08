# Skeleton Loading Components

Система компонентов для отображения shimmer эффекта во время загрузки данных.

## Компоненты

### Shimmer (Базовый)
Базовый компонент для создания shimmer элементов.

```tsx
import { Shimmer } from './components/skeletons';

<Shimmer width="100px" height="20px" />
<Shimmer width="48px" height="48px" circle />
```

**Props:**
- `width?: string` - Ширина (по умолчанию: '100%')
- `height?: string` - Высота (по умолчанию: '1rem')
- `className?: string` - Дополнительные CSS классы
- `circle?: boolean` - Круглая форма (для аватаров)

---

### ShopCardSkeleton
Skeleton для карточки кофейни в списке.

```tsx
import { ShopCardSkeleton } from './components/skeletons';

<ShopCardSkeleton count={6} />
```

**Props:**
- `count?: number` - Количество карточек (по умолчанию: 6)

**Использование:**
- Список кофеен (CoffeeShopList)
- Результаты поиска
- Избранное

---

### ShopDetailSkeleton
Skeleton для детальной страницы кофейни.

```tsx
import { ShopDetailSkeleton } from './components/skeletons';

<ShopDetailSkeleton />
```

**Включает:**
- Галерею фотографий (3 изображения)
- Заголовок и рейтинг
- Описание
- Детали кофе (оборудование, зёрна и т.д.)
- Боковую панель с информацией

**Использование:**
- CoffeeShopPage

---

### CheckInCardSkeleton
Skeleton для карточки чекина.

```tsx
import { CheckInCardSkeleton } from './components/skeletons';

<CheckInCardSkeleton count={3} />
```

**Props:**
- `count?: number` - Количество карточек (по умолчанию: 3)

**Включает:**
- Аватар пользователя
- Имя и дата
- Рейтинг
- Заголовок чекина
- Текст чекина

**Использование:**
- CoffeeShopPage (раздел чекинов)
- UserProfilePage (чекины пользователя)
- ProfilePage (мои чекины)

---

### ProfileSkeleton
Skeleton для страницы профиля.

```tsx
import { ProfileSkeleton } from './components/skeletons';

<ProfileSkeleton />
```

**Включает:**
- Шапку профиля (аватар, имя, информация)
- Статистику (3 показателя)
- Контент секцию со списком элементов

**Использование:**
- ProfilePage
- UserProfilePage

---

### ListSkeleton
Универсальный skeleton для списков.

```tsx
import { ListSkeleton } from './components/skeletons';

<ListSkeleton count={5} showAvatar />
```

**Props:**
- `count?: number` - Количество элементов (по умолчанию: 5)
- `showAvatar?: boolean` - Показывать аватар (по умолчанию: true)

**Использование:**
- Списки пользователей
- Списки элементов
- Результаты фильтрации

---

### ModerationSkeleton
Skeleton для панели модерации.

```tsx
import { ModerationSkeleton } from './components/skeletons';

<ModerationSkeleton />
```

**Включает:**
- Заголовок страницы
- Фильтры статусов
- Сетку карточек кофеен (4 карточки)
- Каждая карточка включает:
  - Заголовок и статус
  - Изображение
  - Детали (адрес, цена, расписание)
  - Теги (оборудование, зёрна и т.д.)
  - Кнопки действий
- Пагинацию

**Использование:**
- ModeratorPanel

---

## Импорт

Все компоненты экспортируются из одного файла:

```tsx
import { 
  Shimmer,
  ShopCardSkeleton,
  CheckInCardSkeleton,
  ShopDetailSkeleton,
  ProfileSkeleton,
  ListSkeleton,
  ModerationSkeleton
} from './components/skeletons';
```

---

## CSS Анимация

Shimmer эффект определен в `index.css`:

```css
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background-size: 1000px 100%;
}
```

---

## Темы

Все skeleton компоненты автоматически адаптируются под текущую тему (dark/light) используя `useTheme()` hook.

**Dark theme:**
- Фон: `#2D241F`
- Shimmer: `#2D241F` → `#3D2F28` → `#2D241F`

**Light theme:**
- Фон: `white`
- Shimmer: `gray-100` → `gray-200` → `gray-100`

---

## Примеры использования

### В компоненте с условным рендерингом

```tsx
const MyComponent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState([]);

  if (isLoading) {
    return <ShopCardSkeleton count={6} />;
  }

  return (
    <div>
      {data.map(item => <Card key={item.id} {...item} />)}
    </div>
  );
};
```

### Создание кастомного skeleton

```tsx
import { Shimmer } from './components/skeletons';
import { useTheme } from './contexts/ThemeContext';

const CustomSkeleton = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-[#2D241F]' : 'bg-white';

  return (
    <div className={`${cardBg} p-4 rounded-lg`}>
      <Shimmer width="100%" height="200px" className="mb-4" />
      <Shimmer width="80%" height="24px" className="mb-2" />
      <Shimmer width="60%" height="16px" />
    </div>
  );
};
```

---

## Best Practices

1. **Количество элементов**: Показывайте столько же skeleton элементов, сколько ожидается реальных
2. **Размеры**: Максимально точно повторяйте размеры реального контента
3. **Структура**: Сохраняйте структуру layout'а (grid, flex)
4. **Длительность**: Shimmer анимация 2 секунды - оптимальная скорость
5. **Единообразие**: Используйте существующие компоненты вместо создания новых

---

## Файлы

```
skeletons/
├── index.ts                 # Barrel export
├── Shimmer.tsx             # Базовый компонент
├── ShopCardSkeleton.tsx    # Карточка кофейни
├── CheckInCardSkeleton.tsx  # Карточка чекина
├── ShopDetailSkeleton.tsx  # Детальная страница
├── ProfileSkeleton.tsx     # Страница профиля
├── ListSkeleton.tsx        # Универсальный список
├── ModerationSkeleton.tsx  # Панель модерации
└── README.md              # Документация
```
