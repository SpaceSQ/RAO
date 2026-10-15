import { ELEMENT_CODES, type ElementCode } from '@/core/constants/fourteen-elements';

export function zeroElements(): Record<ElementCode, number> {
  const out = {} as Record<ElementCode, number>;
  for (const code of ELEMENT_CODES) out[code] = 0;
  return out;
}

export function cloneElements(weights: Record<ElementCode, number>): Record<ElementCode, number> {
  const out = zeroElements();
  for (const code of ELEMENT_CODES) out[code] = weights[code] ?? 0;
  return out;
}

export function sumElements(weights: Record<ElementCode, number>): number {
  return ELEMENT_CODES.reduce((total, code) => total + (weights[code] ?? 0), 0);
}

export function normalizeElements(weights: Record<ElementCode, number>): Record<ElementCode, number> {
  const safe = zeroElements();
  for (const code of ELEMENT_CODES) safe[code] = Math.max(0, weights[code] ?? 0);
  const total = sumElements(safe);
  if (total <= 0) {
    const even = 1 / ELEMENT_CODES.length;
    for (const code of ELEMENT_CODES) safe[code] = even;
    return safe;
  }
  for (const code of ELEMENT_CODES) safe[code] = safe[code] / total;
  return safe;
}

export function l1Distance(a: Record<ElementCode, number>, b: Record<ElementCode, number>): number {
  return ELEMENT_CODES.reduce((total, code) => total + Math.abs((a[code] ?? 0) - (b[code] ?? 0)), 0);
}

export function cosineElements(a: Record<ElementCode, number>, b: Record<ElementCode, number>): number {
  let dot = 0;
  let left = 0;
  let right = 0;
  for (const code of ELEMENT_CODES) {
    const av = a[code] ?? 0;
    const bv = b[code] ?? 0;
    dot += av * bv;
    left += av * av;
    right += bv * bv;
  }
  if (left === 0 && right === 0) return 1;
  if (left === 0 || right === 0) return 0;
  return dot / Math.sqrt(left * right);
}

export const TRUST_REGION = 0.02;

export function clampTrustDelta(delta: number): number {
  return Math.max(-TRUST_REGION, Math.min(TRUST_REGION, delta));
}

export function applyTrustRegion(
  current: Record<ElementCode, number>,
  proposedStep: Record<ElementCode, number>,
): Record<ElementCode, number> {
  const stepped = zeroElements();
  for (const code of ELEMENT_CODES) {
    stepped[code] = Math.max(0.001, (current[code] ?? 0) + clampTrustDelta(proposedStep[code] ?? 0));
  }
  return normalizeElements(stepped);
}
