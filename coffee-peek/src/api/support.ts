import HttpClient from './core/httpClient';

export interface SupportRequest {
  email: string;
  message: string;
}

// Keep support requests on the public site origin; Vercel routes this path to the Gateway.
const supportClient = new HttpClient('');

export async function sendSupportRequest(request: SupportRequest): Promise<number | string | undefined> {
  const response = await supportClient.post<unknown>('/api/support/requests', request, {
    requiresAuth: false,
    skipAuthHeader: true,
  });
  return response.statusCode;
}
