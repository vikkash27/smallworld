import { describe, expect, it } from 'vitest';
import base from '../../src/ui/circles/avatars/base.avatar.json';
import { assignVariants, BODY_COLORS, EXPRESSIONS, hashString, variantFor } from '../../src/ui/circles/avatars/avatar-seed';

describe('member avatar variants', () => {
  it('are deterministic: the same member always looks the same', () => {
    expect(variantFor('demo-amara')).toEqual(variantFor('demo-amara'));
    expect(hashString('demo-amara')).toBe(hashString('demo-amara'));
  });

  it('only ever use expressions that exist in the avatar definition', () => {
    for (const key of EXPRESSIONS) expect(Object.keys(base.expressions)).toContain(key);
  });

  it('never pick an unfriendly expression', () => {
    for (const key of EXPRESSIONS) expect(key).not.toMatch(/angry|sleep|drowsy|closed|uneasy/);
  });

  it('stay inside the palette for any seed', () => {
    for (const seed of ['', 'a', 'host:Vikkash', 'x'.repeat(500), 'émoji-😀']) {
      expect(BODY_COLORS).toContain(variantFor(seed).color);
    }
  });

  it('give everyone in a circle a distinct colour (plain hashing alone would collide)', () => {
    const ids = ['demo-host', 'demo-amara', 'demo-leo', 'demo-nina'];
    const map = assignVariants(ids);
    expect(new Set(ids.map((id) => map.get(id)!.color)).size).toBe(4);
    // Many circles of five: still never a repeated colour.
    for (let n = 0; n < 200; n++) {
      const five = Array.from({ length: 5 }, (_, i) => `member-${n}-${i}`);
      const m = assignVariants(five);
      expect(new Set(five.map((id) => m.get(id)!.color)).size).toBe(5);
    }
  });

  it('does not depend on the order members are listed in', () => {
    const a = assignVariants(['b', 'a', 'c', 'd']);
    const b = assignVariants(['d', 'c', 'a', 'b']);
    for (const id of ['a', 'b', 'c', 'd']) expect(a.get(id)).toEqual(b.get(id));
  });

  it('keeps each member’s expression stable whatever the circle looks like', () => {
    expect(assignVariants(['x', 'y']).get('x')!.expression).toBe(variantFor('x').expression);
  });
});
