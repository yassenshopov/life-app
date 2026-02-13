import { timingSafeEqual } from 'crypto';

/**
 * Timing-safe comparison of two secrets to prevent timing attacks.
 * Returns false if either input is null/undefined or if lengths differ.
 */
export function secureCompareSecrets(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (a == null || b == null) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
