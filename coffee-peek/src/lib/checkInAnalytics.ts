import { captureAnalyticsEvent } from './analytics';
import { getAnalyticsError } from './analyticsError';

type CheckInKind = 'undecided' | 'visit' | 'home';
type CheckInMode = 'create' | 'edit';
type CheckInSource = 'global_create' | 'shop_detail' | 'direct' | 'my_check_ins';
type CheckInStage = 'shop_search' | 'shop_detail' | 'load' | 'photo_upload' | 'save' | 'bean_search';
type CheckInStep = 'type_picker' | 'shop_picker' | 'editor' | 'bean_picker';
type CheckInContext = { flow_id: string; kind: CheckInKind; mode: CheckInMode; source: CheckInSource };

export interface CheckInAnalyticsEvents {
  check_in_start_attempted: { source: CheckInSource };
  check_in_flow_started: CheckInContext;
  check_in_kind_selected: CheckInContext;
  check_in_step_viewed: CheckInContext & { step: CheckInStep; duration_ms: number };
  check_in_field_interacted: CheckInContext & { field: string };
  check_in_submit_attempted: CheckInContext & { attempt: number; duration_ms: number };
  check_in_validation_failed: CheckInContext & { attempt: number; fields: string[]; validation_source: 'client' | 'server' };
  check_in_failed: CheckInContext & { attempt: number; stage: CheckInStage; duration_ms: number; error_category: string; status_code?: number };
  check_in_retry_clicked: CheckInContext & { attempt: number; stage: CheckInStage };
  check_in_saved: CheckInContext & { attempt: number; duration_ms: number; visibility: string; has_photos: boolean };
  check_in_cancelled: CheckInContext & { step: CheckInStep; reason: 'close' | 'back' | 'map'; duration_ms: number };
}

/** Ephemeral correlation only: never store user input or a private check-in ID. */
export interface CheckInFlow {
  flow_id: string;
  started_at: number;
  source: CheckInSource;
  started: boolean;
}

export function createCheckInFlow(source: CheckInSource): CheckInFlow {
  return {
    flow_id: globalThis.crypto?.randomUUID?.() ?? `checkin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    started_at: Date.now(), source, started: false,
  };
}

export function readCheckInFlow(value: unknown, source: CheckInSource = 'direct'): CheckInFlow {
  const candidate = value as Partial<CheckInFlow> | null;
  if (candidate && typeof candidate.flow_id === 'string' &&
      /^(?:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|checkin-[a-z0-9]+-[a-z0-9]+)$/.test(candidate.flow_id) &&
      typeof candidate.started_at === 'number' && Number.isFinite(candidate.started_at) &&
      candidate.started_at <= Date.now() && candidate.started_at >= Date.now() - 24 * 60 * 60_000 &&
      ['global_create', 'shop_detail', 'direct', 'my_check_ins'].includes(candidate.source ?? '')) {
    return { flow_id: candidate.flow_id, started_at: candidate.started_at, source: candidate.source!, started: candidate.started === true };
  }
  return createCheckInFlow(source);
}

const fieldNames: Record<string, string> = {
  text: 'note', note: 'note', coffee: 'rating_coffee', service: 'rating_service', place: 'rating_place',
  rating: 'rating', date: 'date', time: 'date', visitedDate: 'date', visitedAt: 'date', preparedAt: 'date', preparedOn: 'date',
  coffeeShopId: 'shop', coffeeShopSlug: 'shop', drinkSlug: 'drink', customDrinkName: 'drink',
  isPublic: 'visibility', visibility: 'visibility', photos: 'photos', brewMethodCode: 'brew_method',
  bean: 'bean', coffeeProductSlug: 'bean', coffeeProductId: 'bean', customBeanName: 'bean',
  doseGrams: 'dose', minutes: 'brew_duration', seconds: 'brew_duration', duration: 'brew_duration',
  brewDurationSeconds: 'brew_duration', tasteScore: 'rating_taste',
};

export function checkInFieldNames(names: string[]): string[] {
  return [...new Set(names.map(name => {
    const last = name.replace(/^\$\.?/, '').split('.').at(-1)?.toLowerCase();
    const match = Object.keys(fieldNames).find(key => key.toLowerCase() === last);
    return match ? fieldNames[match] : 'form';
  }))].sort();
}

/** One tracker per mounted flow. Effects may replay; only explicit closes are cancellations. */
export class CheckInAnalytics {
  private viewed = new Set<CheckInStep>();
  private interacted = new Set<string>();
  private failures = new Map<CheckInStage, unknown>();
  private attempt = 0;
  private finished = false;
  readonly flow: CheckInFlow;
  private kind: CheckInKind;
  private readonly mode: CheckInMode;

  constructor(flow: CheckInFlow, kind: CheckInKind, mode: CheckInMode = 'create') {
    this.flow = flow;
    this.kind = kind;
    this.mode = mode;
  }

  private context() { return { flow_id: this.flow.flow_id, source: this.flow.source, kind: this.kind, mode: this.mode }; }
  duration() { return Math.max(0, Date.now() - this.flow.started_at); }
  start() {
    if (this.flow.started || this.finished) return;
    if (captureAnalyticsEvent('check_in_flow_started', this.context())) this.flow.started = true;
  }
  selectKind(kind: 'visit' | 'home') {
    this.kind = kind;
    captureAnalyticsEvent('check_in_kind_selected', this.context());
  }
  view(step: CheckInStep) {
    if (this.viewed.has(step) || this.finished) return;
    if (captureAnalyticsEvent('check_in_step_viewed', { ...this.context(), step, duration_ms: this.duration() })) this.viewed.add(step);
  }
  field(name: string) {
    const field = checkInFieldNames([name])[0];
    if (this.interacted.has(field) || this.finished) return;
    if (captureAnalyticsEvent('check_in_field_interacted', { ...this.context(), field })) this.interacted.add(field);
  }
  submit() {
    if (this.finished) return;
    this.attempt += 1;
    if (this.attempt > 1) this.retry('save');
    captureAnalyticsEvent('check_in_submit_attempted', { ...this.context(), attempt: this.attempt, duration_ms: this.duration() });
  }
  validation(names: string[], source: 'client' | 'server' = 'client') {
    if (this.finished) return;
    captureAnalyticsEvent('check_in_validation_failed', { ...this.context(), attempt: this.attempt, fields: checkInFieldNames(names.length ? names : ['form']), validation_source: source });
  }
  failure(error: unknown, stage: CheckInStage) {
    if (this.finished || this.failures.get(stage) === error) return;
    this.failures.set(stage, error);
    captureAnalyticsEvent('check_in_failed', { ...this.context(), attempt: this.attempt, stage, duration_ms: this.duration(), ...getAnalyticsError(error) });
  }
  retry(stage: CheckInStage) {
    if (this.finished) return;
    this.failures.delete(stage);
    captureAnalyticsEvent('check_in_retry_clicked', { ...this.context(), attempt: this.attempt, stage });
  }
  saved(visibility: string, hasPhotos: boolean) {
    if (this.finished) return;
    this.finished = true;
    captureAnalyticsEvent('check_in_saved', { ...this.context(), attempt: this.attempt, duration_ms: this.duration(), visibility, has_photos: hasPhotos });
  }
  cancel(step: CheckInStep, reason: 'close' | 'back' | 'map' = 'close') {
    if (this.finished) return;
    this.finished = true;
    captureAnalyticsEvent('check_in_cancelled', { ...this.context(), step, reason, duration_ms: this.duration() });
  }
}
