export type DetailEntryPoint = 'list' | 'map' | 'favorites' | 'related' | 'direct';

export interface EngagementAnalyticsEvents {
  entity_detail_viewed: { entity_type: 'coffee_shop' | 'coffee' | 'roaster'; entry_point: DetailEntryPoint; search_id?: string };
  shop_content_interacted: { section: 'photos' | 'menu' | 'hours' | 'roasters'; action: 'open' | 'close' | 'select' };
  shop_action_clicked: { action: 'directions' | 'share' | 'phone_copy' | 'email' | 'website' | 'instagram' | 'check_in' | 'edit' | 'report_issue'; entry_point: 'shop_detail' | 'shop_contacts' | 'mobile_actions' | 'shop_header' };
  entity_content_interacted: { entity_type: 'coffee' | 'roaster'; section: 'photos' | 'description' | 'roaster' | 'similar_coffees' | 'assortment' | 'shops' | 'contacts'; action: 'open' | 'close' | 'select' | 'view_all' | 'website' | 'instagram' | 'share' };
  feed_viewed: { result_count: number; is_empty: boolean };
  feed_action_clicked: { action: 'refresh' | 'load_more' | 'retry'; trigger: 'button' | 'gesture' | 'scroll' };
  feed_item_interacted: { action: 'open' | 'author' | 'shop' | 'drink_photo' | 'photo' | 'like' | 'unlike' | 'home_detail'; check_in_kind: 'shop' | 'home' };
}

/** Router state is untrusted. Keep only known sources and our opaque search identifier. */
export function detailAnalyticsContext(state: unknown): { entry_point: DetailEntryPoint; search_id?: string } {
  if (!state || typeof state !== 'object' || !('analytics' in state)) return { entry_point: 'direct' };
  const context = state.analytics;
  if (!context || typeof context !== 'object' || !('source' in context)) return { entry_point: 'direct' };
  const source = context.source;
  const entry_point: DetailEntryPoint = source === 'list' || source === 'map' || source === 'favorites' || source === 'related' ? source : 'direct';
  const searchId = 'search_id' in context ? context.search_id : undefined;
  return {
    entry_point,
    ...(typeof searchId === 'string' && /^search-[a-z0-9]{1,12}-[a-z0-9]{1,12}$/.test(searchId) ? { search_id: searchId } : {}),
  };
}
