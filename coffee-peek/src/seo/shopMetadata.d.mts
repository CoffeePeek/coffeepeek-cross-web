type ShopLocation = {
  cityId?: string;
  city?: { slug: string } | null;
};

export function getShopTitle(shop: ShopLocation & {
  name: string;
  address?: string;
  location?: { address?: string };
}): string;

export function getShopCollectionLinks(shop: ShopLocation & {
  type?: string;
  tags?: { slug: string }[];
}): { path: string; heading: string }[];

export function getShopOpeningHours(shop: ShopLocation & {
  schedules?: {
    dayOfWeek: number | string;
    openTime?: string;
    closeTime?: string;
    isClosed?: boolean;
    intervals?: { openTime?: string; closeTime?: string }[] | null;
  }[];
}): { day: number; opens: string; closes: string }[];

export function getShopLocalWeekday(shop: ShopLocation): number;
export function getShopUtcOffsetMinutes(shop: ShopLocation): number | undefined;

export function buildShopMetadata(shop: Parameters<typeof getShopTitle>[0], canonical?: string): {
  title: string;
  description: string;
  structuredData: Record<string, unknown>;
};
