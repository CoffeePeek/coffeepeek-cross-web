/**
 * CoffeePeek Design System — единый источник токенов.
 * Используется в веб-приложении. npm run design:sync обновляет JSON и документацию.
 */

export const brand = {
  primary: '#EAB308',
  primaryHover: '#FACC15',
  primaryDark: '#CA8A04',
  primaryLight: '#FEF3C7',
  goldWarm: '#D4A84B',
  goldWarmHover: '#B68A2E',
  goldWarmSoft: '#F8F1DD',
} as const;

export const semantic = {
  success: '#22C55E',
  error: '#EF4444',
  warning: '#EAB308',
  info: '#3B82F6',
} as const;

export const light = {
  background: '#FAFAF9',
  surface: '#FFFFFF',
  surfaceAlt: '#F9F8F6',
  card: '#FFFFFF',
  input: '#FFFFFF',
  badge: '#F3F4F6',
  textPrimary: '#1C1917',
  textSecondary: '#78716C',
  textMuted: '#75706B',
  textTertiary: '#6B7280',
  textOnPrimary: '#1A1412',
  border: '#E7E5E4',
  borderSubtle: '#E5E1DA',
  borderHover: '#D1D5DB',
  overlay: 'rgba(0, 0, 0, 0.5)',
  scrollbarTrack: '#F5F4F2',
  scrollbarThumb: '#D1D5DB',
} as const;

export const dark = {
  background: '#1A1412',
  surface: '#2D241F',
  surfaceAlt: '#2D241F',
  card: '#2D241F',
  input: '#1A1412',
  badge: '#2D241F',
  textPrimary: '#FFFFFF',
  textSecondary: '#A39E93',
  textMuted: '#A8A8A8',
  textTertiary: '#5C544F',
  textOnPrimary: '#1A1412',
  border: '#3D2F28',
  borderSubtle: '#3D2F28',
  borderHover: '#4A3D35',
  overlay: 'rgba(0, 0, 0, 0.5)',
  scrollbarTrack: '#1A1412',
  scrollbarThumb: '#3D2F28',
} as const;

export const typography = {
  fontFamily: {
    display: 'Manrope',
    body: 'Manrope',
  },
  fontWeight: {
    ultralight: 200,
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  fontSize: {
    xs: 12,
    sm: 13,
    base: 14,
    md: 15,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    hero: 88,
  },
  lineHeight: {
    tight: 0.92,
    snug: 0.95,
    normal: 1.15,
    relaxed: 1.5,
  },
  letterSpacing: {
    wordmark: -0.045,
    hero: -0.01,
    heading: -0.02,
    label: -0.025,
    normal: 0,
  },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  18: 72,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 26,
  '4xl': 28,
  full: 9999,
} as const;

export const borderWidth = {
  thin: 1,
  medium: 2,
} as const;

export const shadow = {
  buttonPrimary: '0 4px 6px -4px rgba(180, 140, 75, 0.2), 0 10px 15px -3px rgba(180, 140, 75, 0.2)',
  card: '0 3px 14px rgba(0,0,0,.08)',
  cardHover: '0 12px 32px rgba(0,0,0,.22)',
  dropdown: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  focusRing: '0 0 0 3px rgba(234, 179, 8, 0.1)',
  goldGlow: '0 4px 12px rgba(234, 179, 8, 0.18)',
} as const;

export const opacity = {
  disabled: 0.5,
  primaryTint10: 0.1,
  primaryTint20: 0.2,
  primaryTint30: 0.3,
  primaryTint40: 0.4,
  primaryTint50: 0.5,
  surfaceBackdrop: 0.88,
  surfaceBackdropDark: 0.7,
} as const;

export const animation = {
  durationFast: 150,
  durationNormal: 200,
  durationSlow: 300,
  durationToast: 5000,
  easingDefault: 'ease',
  buttonPressScale: 0.98,
} as const;

export const layout = {
  headerHeight: 64,
  headerHeightLanding: 64,
  maxContentWidth: 1280,
  contentPaddingX: 16,
  contentPaddingXDesktop: 32,
} as const;

/** @deprecated Используйте импорт из design-system. Оставлено для обратной совместимости. */
export const COLORS = {
  primary: brand.primary,
  primaryHover: brand.primaryHover,
  primaryDark: brand.primaryDark,
  primaryLight: brand.primaryLight,
  light,
  dark,
  success: semantic.success,
  error: semantic.error,
};

export const getThemeColors = (theme: 'light' | 'dark') =>
  theme === 'dark' ? dark : light;

export const tokens = {
  brand,
  semantic,
  light,
  dark,
  typography,
  spacing,
  borderRadius,
  borderWidth,
  shadow,
  opacity,
  animation,
  layout,
} as const;

export type ThemeMode = 'light' | 'dark';
export type DesignTokens = typeof tokens;
