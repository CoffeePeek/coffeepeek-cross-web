type HttpClient = import('../src/api/core/httpClient').default;
type Analytics = typeof import('../src/lib/analytics');
type CatalogSession = typeof import('../src/lib/catalogSession');

describe('HTTP request analytics', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let client: HttpClient;
  let analytics: Analytics;
  let session: CatalogSession;
  let fetchMock: jest.Mock;
  let capture: jest.Mock;
  let refresh: jest.Mock;
  let consent: 'accepted' | 'declined';

  beforeEach(async () => {
    jest.resetModules();
    consent = 'accepted';
    fetchMock = jest.fn();
    capture = jest.fn();
    refresh = jest.fn().mockResolvedValue('ok');
    globalThis.fetch = fetchMock;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { origin: 'https://coffeepeek.by', pathname: '/feed' }, dispatchEvent: jest.fn() },
    });
    const sdk = {
      init: jest.fn(() => sdk), capture,
      identify: jest.fn(), reset: jest.fn(), get_property: () => 'user-1',
      has_opted_out_capturing: () => false, opt_in_capturing: jest.fn(), opt_out_capturing: jest.fn(),
    };
    jest.doMock('posthog-js', () => ({ __esModule: true, default: sdk }));
    jest.doMock('../src/lib/analyticsConsent', () => ({ getAnalyticsConsent: () => consent }));
    jest.doMock('../src/api/core/apiConfig', () => ({
      API_BASE_URL: 'https://api.example', API_GATEWAY_URL: 'https://api.example',
      buildUrlWithParams: (path: string, params?: Record<string, string>) => params ? `${path}?${new URLSearchParams(params)}` : path,
    }));
    jest.doMock('../src/api/core/interceptors', () => ({
      requestInterceptor: (_url: string, options: RequestInit) => options,
      ensureFreshAccessToken: jest.fn().mockResolvedValue(true),
      isAuthTokenEndpoint: (path: string) => path.startsWith('/api/tokens'),
      tryRefreshAccessToken: refresh,
      TokenManager: { getAccessToken: () => 'private-access-token', clearTokens: jest.fn() },
      normalizeResponseData: (data: unknown) => data,
      responseInterceptor: async (response: Response) => {
        const body = await response.json();
        if (!response.ok) {
          const { ApiRequestError } = require('../src/api/core/apiError');
          throw new ApiRequestError(response.status, { isSuccess: false, ...body });
        }
        return body;
      },
    }));
    jest.doMock('../src/realtime/forceLogout', () => ({ emitSessionInvalidated: jest.fn() }));
    session = require('../src/lib/catalogSession');
    session.changeCatalogSession('user-1');
    analytics = require('../src/lib/analytics');
    await analytics.syncAnalytics({
      apiKey: 'phc_test', apiHost: 'https://eu.i.posthog.com', enabled: true,
      userId: 'user-1', pathname: '/feed',
    });
    capture.mockClear();
    const Client = require('../src/api/core/httpClient').default;
    client = new Client('https://api.example');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  test('records one completed outcome for a 401 followed by refresh and successful retry', async () => {
    fetchMock.mockResolvedValueOnce(response({ message: 'Expired' }, 401))
      .mockResolvedValueOnce(response({ data: { saved: true } }));
    await expect(client.post('/api/v1/check-ins', { text: 'private note' })).resolves.toMatchObject({ data: { saved: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('api_request_completed', expect.objectContaining({
      category: 'check_ins', method: 'POST', outcome: 'success', status_code: 200, auth_retried: true,
    }));
  });

  test('records one final failure when an authenticated retry also fails', async () => {
    fetchMock.mockResolvedValueOnce(response({ message: 'Expired' }, 401))
      .mockResolvedValueOnce(response({ message: 'private server details' }, 503));
    await expect(client.get('/api/v1/check-ins/mine')).rejects.toMatchObject({ status: 503 });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('api_request_completed', expect.objectContaining({
      outcome: 'failure', error_category: 'server', status_code: 503, auth_retried: true,
    }));
  });

  test('reports only category and metrics, never URL, request/response payload or credentials', async () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValue(1250);
    fetchMock.mockResolvedValue(response({ data: { email: 'private-response@example.com' } }));
    await client.post('/api/v1/check-ins/private-check-in-id', { text: 'private note', latitude: 53.9 }, {
      params: { q: 'private search', token: 'private-query-token' }, headers: { Authorization: 'Bearer private-header-token' },
    });
    expect(capture).toHaveBeenCalledWith('api_request_completed', {
      app: 'coffee-peek', event_schema_version: 1, app_version: 'unknown', environment: 'unknown', auth_state: 'signed_in', page_type: 'feed',
      category: 'check_ins', method: 'POST', outcome: 'success', duration_ms: 250, auth_retried: false, status_code: 200,
    });
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private-|private note|private search|53\.9|api\.example|Authorization/);
  });

  test.each([
    [400, 'validation'], [401, 'authentication'], [403, 'permission'], [404, 'not_found'], [429, 'rate_limited'], [503, 'server'],
  ])('categorizes HTTP %s without reporting server messages', async (status, category) => {
    refresh.mockResolvedValue('error');
    fetchMock.mockResolvedValue(response({ message: 'private server error', errors: { Text: ['private submitted note'] } }, status as number));
    await expect(client.get('/api/v1/check-ins/private-id')).rejects.toMatchObject({ status });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('api_request_completed', expect.objectContaining({ outcome: 'failure', error_category: category, status_code: status }));
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private|Text/);
  });

  test('categorizes network failures and preserves the original error', async () => {
    const error = new TypeError('Failed to fetch https://private.example/?token=secret');
    fetchMock.mockRejectedValue(error);
    await expect(client.get('/api/unknown-private-route')).rejects.toBe(error);
    expect(capture).toHaveBeenCalledWith('api_request_completed', expect.objectContaining({ category: 'other', outcome: 'failure', error_category: 'network' }));
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/private|secret|Failed to fetch/);
  });

  test('does not emit outcomes for cancelled requests', async () => {
    const abort = new DOMException('private cancellation detail', 'AbortError');
    fetchMock.mockRejectedValue(abort);
    await expect(client.get('/api/v1/check-ins/mine')).rejects.toBe(abort);
    expect(capture).not.toHaveBeenCalled();

    const controller = new AbortController();
    controller.abort();
    await expect(client.get('/api/v1/check-ins/mine', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(capture).not.toHaveBeenCalled();
  });

  test('discards a stale account response before it can be reported under another user', async () => {
    fetchMock.mockImplementation(async () => {
      session.changeCatalogSession('user-2');
      return response({ data: { text: 'previous account note' } });
    });
    await expect(client.get('/api/v1/check-ins/mine')).rejects.toMatchObject({ name: 'AbortError' });
    expect(capture).not.toHaveBeenCalled();
  });

  test('SDK capture exceptions cannot fail a successful API request or replace its original error', async () => {
    capture.mockImplementation(() => { throw new Error('Analytics blocked'); });
    fetchMock.mockResolvedValueOnce(response({ data: { saved: true } }));
    await expect(client.post('/api/v1/check-ins', { text: 'note' })).resolves.toMatchObject({ data: { saved: true } });
    const error = new TypeError('Offline');
    fetchMock.mockRejectedValueOnce(error);
    await expect(client.get('/api/v1/check-ins/mine')).rejects.toBe(error);
    expect(capture).toHaveBeenCalledTimes(2);
  });

  test('withdrawn consent suppresses request telemetry without changing the API result', async () => {
    consent = 'declined';
    fetchMock.mockResolvedValue(response({ data: [] }));
    await expect(client.get('/api/v1/check-ins/mine')).resolves.toMatchObject({ data: [] });
    expect(capture).not.toHaveBeenCalled();
  });
});
