/** Metadata from the authenticated central HTTP transport; never from browser caching. */
export interface PhotoResponse {
  status: number;
  blob?: Blob;
  headers: Headers;
  requestMono: number;
  responseMono: number;
  responseWall: number;
}

export interface PhotoPermission {
  blob: Blob;
  displayUntil: number;
  displayExpiresAt: number;
  credentialExpiresAt: number;
}
