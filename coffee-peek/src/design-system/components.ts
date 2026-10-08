/**
 * Спецификации UI-компонентов CoffeePeek Design System.
 * Размеры в px (≈ dp в Android при density 1x).
 */

import { animation, borderRadius, borderWidth, spacing, typography } from './tokens';

export const button = {
  height: 40,
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: borderRadius.md,
  fontSize: typography.fontSize.lg,
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
    },
    ghost: {
      background: 'transparent',
      text: 'theme.textSecondary',
      textHover: 'theme.textPrimary',
    },
  },
  states: {
    disabledOpacity: 0.5,
    pressScale: animation.buttonPressScale,
    focusRingWidth: 2,
    focusRingColor: 'brand.primary',
    focusRingOpacity: 0.5,
  },
} as const;

export const input = {
  minHeight: 52,
  paddingVertical: 16,
  paddingHorizontal: 16,
  paddingHorizontalWithIcon: 48,
  borderRadius: borderRadius['3xl'],
  fontSize: typography.fontSize.lg,
  labelFontSize: typography.fontSize.base,
  labelFontWeight: typography.fontWeight.medium,
  borderWidth: borderWidth.thin,
  states: {
    defaultBorder: 'theme.border',
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
    focusBorder: 'brand.primary',
    focusShadow: 'shadow.focusRing',
    selectedItemBackground: 'brand.primary',
    selectedItemBackgroundOpacity: 0.1,
    hoverItemBackground: 'theme.border',
  },
} as const;

export const card = {
  borderRadius: borderRadius.lg,
  borderWidth: borderWidth.thin,
  padding: spacing[6],
  photoAspectRatio: '5:3',
  hoverTranslateY: -3,
  hoverTransitionMs: animation.durationNormal,
  states: {
    defaultBorder: 'theme.border',
    hoverBorder: 'brand.primary',
    hoverBorderOpacity: 0.31,
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
  drink: { minHeight: 56, borderRadius: 16, photoSize: 44, photoBorderRadius: 12, fontSize: 14 },
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
  heightLanding: 72,
  logoSize: 40,
  logoBorderRadius: borderRadius.md,
  navButtonPaddingVertical: 7,
  navButtonPaddingHorizontal: 12,
  navButtonBorderRadius: borderRadius.sm,
  navFontSize: typography.fontSize.base,
  navFontWeight: typography.fontWeight.semibold,
  avatarSize: 30,
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
    letterSpacing: typography.letterSpacing.wordmark,
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
