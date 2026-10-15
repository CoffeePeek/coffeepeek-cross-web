import { captureAnalyticsEvent } from '../src/lib/analytics';
import { CheckInAnalytics, checkInFieldNames, createCheckInFlow, readCheckInFlow } from '../src/lib/checkInAnalytics';

jest.mock('../src/lib/analytics', () => ({ captureAnalyticsEvent: jest.fn() }));
jest.mock('../src/lib/analyticsError', () => ({ getAnalyticsError: () => ({ error_category: 'server', status_code: 503 }) }));

const capture = jest.mocked(captureAnalyticsEvent);

beforeEach(() => { capture.mockReset(); capture.mockReturnValue(true); jest.spyOn(Date, 'now').mockReturnValue(100000); });
afterEach(() => { jest.restoreAllMocks(); });

test('picker and editor share one flow start without retaining arbitrary navigation state', () => {
  const picker = new CheckInAnalytics(createCheckInFlow('global_create'), 'undecided');
  picker.start();
  picker.start();
  picker.view('type_picker');
  picker.view('type_picker');
  picker.selectKind('home');
  const transferred = readCheckInFlow({ ...picker.flow, text: 'private note', checkInId: 'private-id' });
  const editor = new CheckInAnalytics(transferred, 'home');
  editor.start();
  editor.view('editor');
  expect(capture.mock.calls.filter(([event]) => event === 'check_in_flow_started')).toHaveLength(1);
  expect(capture.mock.calls.filter(([event]) => event === 'check_in_step_viewed')).toHaveLength(2);
  expect(transferred).toEqual(picker.flow);
  expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private note|private-id/);
});

test('rejects raw text and stale/future identifiers in navigation state', () => {
  const good = createCheckInFlow('shop_detail');
  expect(readCheckInFlow(good)).toEqual(good);
  for (const bad of [
    { ...good, flow_id: 'someone@example.com' },
    { ...good, source: 'private custom source' },
    { ...good, started_at: 100001 },
    { ...good, started_at: -100000000 },
  ]) {
    const sanitized = readCheckInFlow(bad);
    expect(sanitized.source).toBe('direct');
    expect(sanitized.started).toBe(false);
    expect(sanitized.flow_id).not.toBe(bad.flow_id);
  }
});

test('keeps only categorical field names from server validation and first field interactions', () => {
  expect(checkInFieldNames(['$.CustomDrinkName', 'Text', 'Rating.Coffee', 'secret@example.com', 'text'])).toEqual(['drink', 'form', 'note', 'rating_coffee']);
  const analytics = new CheckInAnalytics(createCheckInFlow('direct'), 'home');
  analytics.field('customBeanName');
  analytics.field('coffeeProductSlug');
  analytics.submit();
  analytics.validation(['secret@example.com', 'photos'], 'server');
  expect(capture.mock.calls.filter(([event]) => event === 'check_in_field_interacted')).toHaveLength(1);
  expect(capture).toHaveBeenLastCalledWith('check_in_validation_failed', expect.objectContaining({ fields: ['form', 'photos'], attempt: 1, validation_source: 'server' }));
  expect(JSON.stringify(capture.mock.calls)).not.toContain('secret@example.com');
});

test('tracks retries, sanitized failures and elapsed duration without duplicate success or false cancellation', () => {
  const analytics = new CheckInAnalytics(createCheckInFlow('direct'), 'visit', 'edit');
  analytics.start();
  analytics.submit();
  const error = new Error('private note and access token');
  analytics.failure(error, 'save');
  analytics.failure(error, 'save');
  expect(capture.mock.calls.filter(([event]) => event === 'check_in_failed')).toHaveLength(1);
  jest.spyOn(Date, 'now').mockReturnValue(105000);
  analytics.submit();
  analytics.saved('Private', true);
  analytics.saved('Private', true);
  analytics.cancel('editor');
  analytics.failure(error, 'save');
  expect(capture).toHaveBeenCalledWith('check_in_retry_clicked', expect.objectContaining({ attempt: 2, stage: 'save' }));
  expect(capture).toHaveBeenLastCalledWith('check_in_saved', expect.objectContaining({ mode: 'edit', kind: 'visit', attempt: 2, duration_ms: 5000, has_photos: true }));
  expect(capture.mock.calls.filter(([event]) => event === 'check_in_saved')).toHaveLength(1);
  expect(capture.mock.calls.some(([event]) => event === 'check_in_created' || event === 'check_in_cancelled')).toBe(false);
  expect(JSON.stringify(capture.mock.calls)).not.toContain(error.message);
});

test('records an explicit close once and does not turn a subsequent event into a success', () => {
  const analytics = new CheckInAnalytics(createCheckInFlow('global_create'), 'undecided');
  analytics.cancel('type_picker');
  analytics.cancel('type_picker');
  analytics.saved('Private', false);
  analytics.start();
  expect(capture.mock.calls.map(([event]) => event)).toEqual(['check_in_cancelled']);
});

test('allows ready notification to capture current step after consent and SDK become ready', () => {
  const analytics = new CheckInAnalytics(createCheckInFlow('direct'), 'visit');
  capture.mockReturnValue(false);
  analytics.start();
  analytics.view('editor');
  expect(analytics.flow.started).toBe(false);
  capture.mockReturnValue(true);
  analytics.start();
  analytics.view('editor');
  analytics.start();
  analytics.view('editor');
  expect(analytics.flow.started).toBe(true);
  expect(capture.mock.calls.filter(([event]) => event === 'check_in_flow_started')).toHaveLength(2);
  expect(capture.mock.calls.filter(([event]) => event === 'check_in_step_viewed')).toHaveLength(2);
});
