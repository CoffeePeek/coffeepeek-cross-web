import type { BrewMethod } from '../api/coffeeshop';

export function brewMethodName(code: string | null | undefined, methods: BrewMethod[] | undefined): string {
  if (!code) return '';
  return methods?.find(method => method.slug === code)?.name || code;
}
