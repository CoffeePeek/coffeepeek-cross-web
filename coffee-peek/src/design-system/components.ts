/**
 * Спецификации UI-компонентов CoffeePeek Design System.
 * Размеры в CSS px. auto означает высоту, определяемую содержимым и padding.
 */

import { animation, borderRadius, borderWidth, spacing, typography } from './tokens';

export const button = {
  height: 'auto',
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: borderRadius.md,
  fontSize: typography.fontSize.lg,
  lineHeight: 24,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: typography.fontFamily.body,
  gap: spacing[2],
  variants: {
    primary: {
      background: 'brand.primary',
      text: 'theme.textOnPrimary',
      backgroundHover: 'brand.primaryHover',
      shadow: 'shadow.buttonPrimary',
    },
    secondary: {
      background: 'theme.surface',
      text: 'theme.textPrimary',
      border: 'theme.border',
      backgroundHover: 'theme.border',
      light: {
        background: '#F3F4F6',
        text: '#111827',
        border: '#D1D5DB',
        backgroundHover: '#E5E7EB',
      },
    },
    ghost: {
      background: 'transparent',
      text: 'theme.textSecondary',
      textHover: 'theme.textPrimary',
      light: {
        text: '#4B5563',
        textHover: '#111827',
      },
    },
  },
  states: {
    disabledOpacity: 0.5,
    pressScale: animation.buttonPressScale,
    focusRingWidth: 2,
    focusRingColor: 'brand.primary',
    focusRingOpacity: 0.5,
    focusRingOffset: 2,
  },
} as const;

export const input = {
  height: 'auto',
  paddingVertical: 16,
  paddingHorizontal: 16,
  paddingHorizontalWithIcon: 48,
  borderRadius: borderRadius['3xl'],
  fontSize: typography.fontSize.lg,
  lineHeight: 24,
  labelFontSize: typography.fontSize.base,
  labelFontWeight: typography.fontWeight.medium,
  borderWidth: 0,
  states: {
    defaultBorder: 'theme.border',
    defaultBorderLight: '#E5E7EB',
    focusBorder: 'brand.primary',
    focusRingWidth: 3,
    focusRingColor: 'brand.primary',
    focusRingOpacity: 0.1,
    placeholder: 'theme.textTertiary',
  },
} as const;

export const select = {
  minHeight: 56,
  paddingVertical: 16,
  paddingHorizontal: 16,
  paddingHorizontalWithIcon: 48,
  borderRadius: borderRadius.lg,
  fontSize: typography.fontSize.lg,
  labelFontSize: typography.fontSize.xs,
  borderWidth: borderWidth.medium,
  dropdownMaxHeight: 256,
  dropdownBorderRadius: borderRadius.lg,
  states: {
    defaultBorder: 'theme.border',
    defaultBorderLight: '#E5E7EB',
    focusBorder: 'brand.primary',
    focusShadow: '0 10px 15px -3px rgba(234,179,8,.1), 0 4px 6px -4px rgba(234,179,8,.1)',
    selectedItemBackground: 'brand.primary',
    selectedItemBackgroundOpacity: 0.1,
    hoverItemBackground: 'theme.border',
    hoverItemBackgroundLight: '#F3F4F6',
  },
} as const;

export const card = {
  borderRadius: borderRadius['4xl'],
  borderWidth: borderWidth.thin,
  padding: spacing[4],
  paddingTop: spacing[3],
  photoAspectRatio: '16:9',
  hoverTranslateY: -2,
  hoverTransitionMs: animation.durationFast,
  photoHoverScale: 1.035,
  photoTransitionMs: 500,
  states: {
    defaultBorder: 'theme.border',
    hoverBorder: 'brand.primary',
    hoverBorderOpacity: 112 / 255,
    shadow: 'shadow.card',
    shadowHover: 'shadow.cardHover',
  },
} as const;

export const checkInCard = {
  borderRadius: 20,
  borderWidth: borderWidth.thin,
  padding: 16,
  paddingDesktop: 20,
  avatarSize: 48,
  authorFontSize: 14,
  dateFontSize: 12,
  dateFontSizeDesktop: 14,
  shopFontSize: 20,
  starSize: 20,
  bodyFontSize: 16,
  bodyLineHeight: 1.55,
  drink: { placement: 'bottom-right', layout: 'horizontal', verticalAlign: 'center', photoSize: 80, photoFit: 'contain', fallbackIconSize: 32, fontSize: 14 },
  photos: { borderRadius: 12, gap: 4, singleAspectRatio: '3:2', collageAspectRatio: '5:3', fourAspectRatio: '5:4' },
  reaction: { iconSize: 26, minHeight: 44, color: '#EF4444', fontSize: 14 },
} as const;

export const toast = {
  minWidth: 320,
  maxWidth: 448,
  padding: spacing[4],
  borderRadius: borderRadius.md,
  fontSize: typography.fontSize.base,
  fontWeight: typography.fontWeight.medium,
  gap: spacing[3],
  durationMs: animation.durationToast,
  iconSize: 20,
  imageSize: 80,
} as const;

export const header = {
  height: 64,
  heightLanding: 64,
  logoSize: 52,
  logoBorderRadius: 15,
  navButtonMinHeight: 34,
  navButtonPaddingVertical: 0,
  navButtonPaddingHorizontal: 14,
  navButtonBorderRadius: 999,
  navFontSize: typography.fontSize.base,
  navFontWeight: typography.fontWeight.semibold,
  avatarSize: 34,
  avatarSizeLarge: 38,
} as const;

export const badge = {
  paddingVertical: 4,
  paddingHorizontal: 12,
  borderRadius: borderRadius.full,
  fontSize: typography.fontSize.xs,
  fontWeight: typography.fontWeight.medium,
} as const;

export const loader = {
  defaultSize: 48,
  buttonSize: 20,
  color: 'brand.primary',
  borderWidthRatio: 16,
  minBorderWidth: 2,
  borderWidthRounding: 'round',
} as const;

export const typographyStyles = {
  wordmark: {
    fontFamily: typography.fontFamily.display,
    fontWeight: typography.fontWeight.extrabold,
    fontSize: typography.fontSize.xl,
    letterSpacing: typography.letterSpacing.wordmark,
  },
  hero: {
    fontFamily: typography.fontFamily.display,
    fontWeight: typography.fontWeight.black,
    fontSize: typography.fontSize.hero,
    letterSpacing: -0.05,
    lineHeight: typography.lineHeight.snug,
  },
  h1: {
    fontFamily: typography.fontFamily.display,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize['4xl'],
    letterSpacing: typography.letterSpacing.heading,
  },
  h2: {
    fontFamily: typography.fontFamily.display,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize['2xl'],
    letterSpacing: typography.letterSpacing.label,
  },
  h3: {
    fontFamily: typography.fontFamily.display,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.xl,
  },
  body: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.fontWeight.regular,
    fontSize: typography.fontSize.lg,
  },
  bodySmall: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.fontWeight.regular,
    fontSize: typography.fontSize.base,
  },
  caption: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.fontWeight.regular,
    fontSize: typography.fontSize.xs,
  },
  label: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.base,
  },
} as const;

export const components = {
  button,
  input,
  select,
  card,
  checkInCard,
  toast,
  header,
  badge,
  loader,
  typographyStyles,
} as const;
