import type { CheckInDto } from '../coffeeshop';

export function normalizeCheckInDto(dto: CheckInDto): CheckInDto {
  return { ...dto, photos: [...(dto.photos ?? [])].sort((a, b) => a.sortIndex - b.sortIndex) };
}
