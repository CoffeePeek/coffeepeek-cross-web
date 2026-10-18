import type { CheckInPhoto, CheckInPhotoVariant } from '../api/coffeeshop';

export type PhotoPurpose = 'thumb' | 'feed' | 'detail';

/** An absent field is the legacy API; an explicit empty/unsupported manifest is pending. */
export function selectCheckInPhoto(
  photo: Pick<CheckInPhoto, 'url' | 'variants'>,
  purpose: PhotoPurpose,
  targetPixels = purpose === 'thumb' ? 320 : purpose === 'feed' ? 960 : 1600,
): { url: string; width?: number; height?: number } | null {
  if (photo.variants == null) return photo.url ? { url: photo.url } : null;
  const supported = photo.variants.filter(variant => variant.purpose === purpose && variant.url
    && variant.width > 0 && variant.height > 0 && variant.sizeBytes > 0
    && ['image/webp', 'image/jpeg', 'image/png'].includes(variant.contentType));
  const formats = ['image/webp', 'image/png', 'image/jpeg'];
  const format = formats.find(type => supported.some(variant => variant.contentType === type));
  const candidates = supported.filter(variant => variant.contentType === format)
    .sort((a, b) => Math.max(a.width, a.height) - Math.max(b.width, b.height));
  const chosen: CheckInPhotoVariant | undefined = candidates.find(variant => Math.max(variant.width, variant.height) >= targetPixels)
    ?? candidates[candidates.length - 1];
  return chosen ? { url: chosen.url, width: chosen.width, height: chosen.height } : null;
}
