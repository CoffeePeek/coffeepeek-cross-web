// In development, keep browser requests same-origin and let Vite proxy them.
// Production continues to use the configured public API URL directly.
export const API_BASE_URL = import.meta.env.DEV
  ? '/backend'
  : import.meta.env.VITE_API_URL as string;
export const API_GATEWAY_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  console.error('[config] VITE_API_URL не задан — запросы к API не будут работать. Укажите его в .env / переменных окружения сборки.');
}

export const API_ENDPOINTS = {
  TOKEN: {
    BASE: '/api/tokens',
  },

  AUTH: {
    LOGIN: '/api/tokens',
  },

  ADMIN: {
    STATS_OVERVIEW: '/api/admin/stats/overview',
    STATS_USERS_TIMESERIES: '/api/admin/stats/users/timeseries',
    STATS_SHOPS_TIMESERIES: '/api/admin/stats/shops/timeseries',
    STATS_SHOPS_INSIGHTS: '/api/admin/stats/shops/insights',
    STATS_MODERATION_INSIGHTS: '/api/admin/stats/moderation/insights',
    USERS: '/api/admin/users',
    USER_STATS: '/api/admin/users/stats',
    USER_PROFILE: (id: string) => `/api/admin/users/${encodeURIComponent(id)}/profile`,
    USER_ROLE: (id: string) => `/api/admin/users/${encodeURIComponent(id)}/role`,
    USER_BLOCK: (id: string) => `/api/admin/users/${encodeURIComponent(id)}/block`,
    USER_DELETE: (id: string) => `/api/admin/users/${encodeURIComponent(id)}`,
    USER_SESSIONS: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/sessions`,
    USER_SESSION_BY_ID: (userId: string, sessionId: string) =>
      `/api/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
    AUDIT_MODERATION: '/api/admin/audit/moderation',
    SHOPS: '/api/admin/shops',
    SHOP_BY_ID: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}`,
    SHOP_PUBLIC_ADDRESS_BY_ID: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/public-address`,
    SHOP_PUBLIC_ADDRESS_BY_SLUG: (slug: string) => `/api/admin/shops/by-slug/${encodeURIComponent(slug)}/public-address`,
    SHOP_PHOTOS: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/photos`,
    SHOP_MENU: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/menu`,
    SHOP_MENU_PHOTOS: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/menu/photos`,
    SHOP_MENU_PARSE: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/menu/parse`,
    SHOP_VISIBILITY: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/visibility`,
    SHOP_OWNER: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/owner`,
    SHOP_FOCUS: (id: string) => `/api/admin/shops/${encodeURIComponent(id)}/focus`,
    SHOP_TAGS: '/api/admin/shop-tags',
    SHOP_TAG_BY_ID: (id: string) => `/api/admin/shop-tags/${encodeURIComponent(id)}`,
    SHOP_TAGS_ASSIGN: (shopId: string) => `/api/admin/shops/${encodeURIComponent(shopId)}/tags`,
    CATALOG_CITIES: '/api/admin/cities',
    CATALOG_CITY_BY_ID: (id: string) => `/api/admin/cities/${encodeURIComponent(id)}`,
    CATALOG_BEANS: '/api/admin/beans',
    CATALOG_BEAN_BY_ID: (id: string) => `/api/admin/beans/${encodeURIComponent(id)}`,
    CATALOG_EQUIPMENTS: '/api/admin/equipments',
    CATALOG_EQUIPMENT_BY_ID: (id: string) => `/api/admin/equipments/${encodeURIComponent(id)}`,
    CATALOG_ROASTERS: '/api/admin/roasters',
    CATALOG_ROASTER_BY_ID: (id: string) => `/api/admin/roasters/${encodeURIComponent(id)}`,
    CATALOG_BREW_METHODS: '/api/admin/brew-methods',
    CATALOG_BREW_METHOD_BY_ID: (id: string) => `/api/admin/brew-methods/${encodeURIComponent(id)}`,
    IMPORT_OSM_REFRESH: '/api/admin/import/osm/refresh',
    IMPORT_CANDIDATES: '/api/admin/import/candidates',
    IMPORT_CANDIDATE_BY_ID: (id: string) => `/api/admin/import/candidates/${encodeURIComponent(id)}`,
    IMPORT_CANDIDATE_MENU: (id: string) => `/api/admin/import/candidates/${encodeURIComponent(id)}/menu`,
    IMPORT_CANDIDATE_MENU_PHOTOS: (id: string) => `/api/admin/import/candidates/${encodeURIComponent(id)}/menu/photos`,
    IMPORT_CANDIDATE_MENU_PARSE: (id: string) => `/api/admin/import/candidates/${encodeURIComponent(id)}/menu/parse`,
    IMPORT_CANDIDATE_DECIDE: (id: string) => `/api/admin/import/candidates/${encodeURIComponent(id)}/decide`,
    IMPORT_STATS: '/api/admin/import/stats',
    IMPORT_DUPLICATES: '/api/admin/import/duplicates',
    IMPORT_DUPLICATES_REFRESH: '/api/admin/import/duplicates/refresh',
    IMPORT_DUPLICATE_DECIDE: (id: string) => `/api/admin/import/duplicates/${encodeURIComponent(id)}/decide`,
    CACHE_KEYS: '/api/admin/cache/keys',
    CACHE_CLEAR: '/api/admin/cache/clear',
    CACHE_CLEAR_KEY: (key: string) => `/api/admin/cache/clear/${encodeURIComponent(key)}`,
    CACHE: {
      CLEAR: '/api/admin/cache/clear',
    },
    APP_DOWNLOADS: '/api/admin/v1/app-downloads',
    APP_DOWNLOADS_ANDROID_GOOGLE_PLAY: '/api/admin/v1/app-downloads/android/google-play',
    APP_DOWNLOADS_IOS_APP_STORE: '/api/admin/v1/app-downloads/ios/app-store',
    APP_DOWNLOADS_ANDROID_RELEASES: '/api/admin/v1/app-downloads/android/releases',
    APP_DOWNLOADS_ANDROID_RELEASE_PUBLISH: (id: string) =>
      `/api/admin/v1/app-downloads/android/releases/${encodeURIComponent(id)}/publish`,
    SHOP_REPORTS: '/api/admin/shop-reports',
    SHOP_REPORT_STATUS: (id: string) => `/api/admin/shop-reports/${encodeURIComponent(id)}/status`,
    COFFEE_ZONES: '/api/admin/coffee-zones',
    COFFEE_ZONE_BY_ID: (id: string) => `/api/admin/coffee-zones/${encodeURIComponent(id)}`,
    COFFEE_ZONE_STATUS: (id: string) => `/api/admin/coffee-zones/${encodeURIComponent(id)}/status`,
    COFFEE_ZONE_MEMBERSHIP: (id: string) => `/api/admin/coffee-zones/${encodeURIComponent(id)}/membership`,
    COFFEE_ZONE_MEMBER: (zoneId: string, shopId: string) =>
      `/api/admin/coffee-zones/${encodeURIComponent(zoneId)}/membership/${encodeURIComponent(shopId)}`,
    COFFEE_ZONE_CANDIDATES: '/api/admin/coffee-zones/candidates',
  },

  MENU: {
    DRINKS: '/api/menu/drinks',
  },

  PHOTOS: {
    MENU: '/api/Photos/menu',
    SHOP: '/api/Photos/shop',
    ROASTER: '/api/Photos/roaster',
  },

  REALTIME: {
    SESSION: '/realtime/session',
  },

  OWNER: {
    SHOPS: '/api/owner/coffee-shops',
    SHOP_BY_ID: (id: string) => `/api/owner/coffee-shops/${encodeURIComponent(id)}`,
    SHOP_PHOTOS: (id: string) => `/api/owner/coffee-shops/${encodeURIComponent(id)}/photos`,
  },

  MODERATION: {
    SHOPS: '/api/ModerationShops',
    SHOP_BY_ID: (id: string) => `/api/ModerationShops/${encodeURIComponent(id)}`,
    SHOP_STATUS: '/api/ModerationShops/status',
    CHECK_INS: '/api/v1/moderation/check-ins',
    ROASTERS: '/api/ModerationRoasters',
    ROASTER_BY_ID: (id: string) => `/api/ModerationRoasters/${encodeURIComponent(id)}`,
    ROASTER_STATUS: '/api/ModerationRoasters/status',
  },

  COFFEE_SHOP: {
    BASE: '/api/CoffeeShops',
    BY_SLUG: (slug: string) => `/api/CoffeeShops/${encodeURIComponent(slug)}`,
  },

  MAP: {
    BASE: '/api/Map',
  },

  SHOP_CHANGE_REQUESTS: {
    BASE: '/api/ShopChangeRequests',
    BY_ID: (id: string) => `/api/ShopChangeRequests/${encodeURIComponent(id)}`,
    STATUS: (id: string) => `/api/ShopChangeRequests/${encodeURIComponent(id)}/status`,
  },

} as const;

export function buildUrlWithParams(
  url: string,
  params?: Record<string, unknown>
): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
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
