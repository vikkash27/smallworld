/**
 * Deterministic look for a member's avatar. Pure and dependency-free (no avatar library import), so it can be
 * tested and reused. The same seed always yields the same avatar; nothing about the member other than the
 * opaque seed string is used, so no personal data leaks into how someone is drawn.
 */

/** Mid-tone bodies that keep the dark eyes legible and sit well beside the electric-blue brand colour. */
export const BODY_COLORS = [
  '#5b7fe5', '#e5775b', '#4fb286', '#d9a93a', '#a46be0', '#e0689b', '#45a9cf', '#86b844',
] as const;

/** Friendly expressions only (these keys exist in base.avatar.json). Angry, sleepy and closed-eye ones are left out. */
export const EXPRESSIONS = [
  'neutral', 'curious-left', 'attentive-left', 'small-attentive', 'playful-right', 'skeptical-left',
] as const;

export type AvatarExpression = (typeof EXPRESSIONS)[number];

export interface AvatarVariant {
  color: (typeof BODY_COLORS)[number];
  expression: AvatarExpression;
}

/** FNV-1a, 32-bit. Stable across runs and platforms. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function variantFor(seed: string): AvatarVariant {
  const h = hashString(seed);
  return {
    color: BODY_COLORS[h % BODY_COLORS.length],
    expression: EXPRESSIONS[(h >>> 8) % EXPRESSIONS.length],
  };
}

/**
 * Variants for everyone in one circle, with distinct body colours (up to the palette size) so two members are
 * never drawn alike. Deterministic and independent of input order: seeds are sorted by hash, then each takes
 * its hashed colour or the next free one.
 */
export function assignVariants(seeds: readonly string[]): Map<string, AvatarVariant> {
  const unique = [...new Set(seeds)].sort((a, b) => hashString(a) - hashString(b) || (a < b ? -1 : 1));
  const used = new Set<number>();
  const out = new Map<string, AvatarVariant>();
  for (const seed of unique) {
    const base = variantFor(seed);
    let idx = hashString(seed) % BODY_COLORS.length;
    if (used.size < BODY_COLORS.length) {
      while (used.has(idx)) idx = (idx + 1) % BODY_COLORS.length;
      used.add(idx);
    }
    out.set(seed, { color: BODY_COLORS[idx], expression: base.expression });
  }
  return out;
}
