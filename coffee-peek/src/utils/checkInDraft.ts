import { todayInputValue, type CheckInDraft } from './checkInForm';

export interface CheckInDraftState extends CheckInDraft {
  selectedFiles: File[];
}

let activeCheckInDraft: CheckInDraftState | null = null;

export function createEmptyCheckInDraft(shopId: string, now = new Date()): CheckInDraftState {
  return {
    coffeeShopId: shopId,
    drinkSlug: '',
    customDrinkName: '',
    note: '',
    isPublic: false,
    visitedDate: todayInputValue(now),
    rating: { coffee: 5, service: 5, place: 5 },
    selectedFiles: [],
  };
}

/**
 * Keeps exactly one check-in draft for the lifetime of the current page.
 * A different shop replaces it; a full reload naturally clears module memory.
 */
export function activateCheckInDraft(shopId: string, now = new Date()): CheckInDraftState {
  if (!activeCheckInDraft || activeCheckInDraft.coffeeShopId !== shopId) {
    activeCheckInDraft = createEmptyCheckInDraft(shopId, now);
  }
  return activeCheckInDraft;
}

export function updateCheckInDraft(
  shopId: string,
  patch: Partial<Omit<CheckInDraftState, 'coffeeShopId'>>,
): CheckInDraftState {
  const current = activateCheckInDraft(shopId);
  activeCheckInDraft = { ...current, ...patch, coffeeShopId: shopId };
  return activeCheckInDraft;
}

export function clearCheckInDraft(shopId?: string): void {
  if (!shopId || activeCheckInDraft?.coffeeShopId === shopId) {
    activeCheckInDraft = null;
  }
}
