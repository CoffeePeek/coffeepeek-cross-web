export const API_BASE_URL = import.meta.env.DEV ? '/backend' : import.meta.env.VITE_API_URL;

/**
 * Все эндпоинты API
 */
export const API_ENDPOINTS = {
  TOKEN: {
    BASE: "/api/tokens",
  },

  AUTH: {
    LOGIN: "/api/tokens",
    GOOGLE_LOGIN: "/api/tokens/google/login",
    REGISTER: "/api/users",
  },

  USER: {
    PROFILE: "/api/users/me",
    EMAIL_EXISTS: "/api/users/exists",
    UPDATE_ABOUT: "/api/users/me/about",
    UPDATE_EMAIL: "/api/users/me/email",
    UPDATE_AVATAR: "/api/users/me/avatar",
    UPDATE_USERNAME: "/api/users/me/username",
    PASSWORD_FORGOT: "/api/users/password/forgot",
    PASSWORD_RESET: "/api/users/password/reset",
    DELETE: "/api/users/me",
    DELETION_CONFIRMATION: "/api/users/me/deletion-confirmation",
    DELETION_REQUEST: "/api/users/me/deletion-request",
    EMAIL_CONFIRMATION: "/api/users/me/email-confirmation",
    EMAIL_CONFIRMATION_RESEND: "/api/users/email-confirmation/resend",
    REVIEWS: (userId: string) => `/api/users/${encodeURIComponent(userId)}/reviews`,
  },

  COFFEE_SHOP: {
    BASE: "/api/CoffeeShops",
    BY_SLUG: (slug: string) => `/api/CoffeeShops/${encodeURIComponent(slug)}`,
  },

  MENU: {
    DRINKS: "/api/menu/drinks",
  },

  MAP: {
    BASE: "/api/Map",
  },

  CATALOGS: {
    CITIES: "/api/Catalogs/cities",
    EQUIPMENTS: "/api/Catalogs/equipments",
    BEANS: "/api/Catalogs/beans",
    ROASTERS: "/api/Catalogs/roasters",
    BREW_METHODS: "/api/Catalogs/brew-methods",
    SHOP_TAGS: "/api/Catalogs/shop-tags",
  },

  ROASTERS: {
    BY_SLUG: (slug: string) => `/api/roasters/${encodeURIComponent(slug)}`,
  },

  REVIEW: {
    BY_ID: (reviewId: string) => `/api/CoffeeShopReviews/${encodeURIComponent(reviewId)}`,
  },

  CHECK_IN: {
    BASE: "/api/CheckIns",
  },

  PHOTOS: {
    AVATAR: "/api/photos/avatar",
    SHOP: "/api/photos/shop",
    REVIEW: "/api/photos/review",
    MENU: "/api/Photos/menu",
    ROASTER: "/api/Photos/roaster",
  },

  MODERATION: {
    SHOP: "/api/ModerationShops",
    REVIEWS: "/api/ModerationReviews",
    REVIEW_UPDATE: (reviewId: string) => `/api/ModerationReviews/${encodeURIComponent(reviewId)}`,
    ROASTER: "/api/ModerationRoasters",
  },

  SHOP_ISSUE_REPORTS: {
    BASE: "/api/ShopIssueReports",
  },

  PUBLIC: {
    STATS: "/api/public/stats",
    APP_DOWNLOADS: "/api/v1/app-downloads",
  },

  REALTIME: {
    SESSION: "/realtime/session",
  },
} as const;

export function buildUrlWithParams(
  url: string,
  params?: Record<string, any>,
): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          searchParams.append(key, String(item));
        }
      });
    } else {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}
