'use client';

/**
 * THE ONLY FILE THAT IMPORTS THE AVATAR LIBRARY.
 *
 * @bible-strong/avatar-react and @bible-strong/avatar-core are AGPL-3.0-only (https://github.com/smontlouis/bible-strong-avatar-lab).
 * Shipping them makes the combined work AGPL-3.0, so the repository LICENSE must be AGPL-3.0 (an allowed
 * submission licence). If the team picks MIT or Apache-2.0, remove the two dependencies and this file, and in
 * MemberAvatar.tsx render the existing `fallback` (initials circle) instead of <LabAvatar>. Nothing else changes.
 * See NOTICE.md in this folder.
 */
import { validateAvatarDefinition } from '@bible-strong/avatar-core';
import type { AvatarDefinition } from '@bible-strong/avatar-core';
import { Avatar } from '@bible-strong/avatar-react';
import '@bible-strong/avatar-react/styles.css';
import baseJson from './base.avatar.json';

const checked = validateAvatarDefinition(baseJson);
const base: AvatarDefinition | null = checked.ok ? (checked.value as AvatarDefinition) : null;

// One immutable definition per body colour: the renderer validates once per object reference, so reusing
// references keeps a list of avatars cheap.
const byColor = new Map<string, AvatarDefinition>();
function definitionFor(color: `#${string}`): AvatarDefinition | null {
  if (!base) return null;
  const hit = byColor.get(color);
  if (hit) return hit;
  const def: AvatarDefinition = { ...base, colors: { ...base.colors, body: color } };
  byColor.set(color, def);
  return def;
}

export default function LabAvatar({
  color,
  expression,
  size,
  label,
}: {
  color: `#${string}`;
  expression: string;
  size: number;
  label: string;
}) {
  const definition = definitionFor(color);
  if (!definition) return null;
  // A static expression, not an animation: calm in a list, and no per-frame work for every member.
  return <Avatar definition={definition} expression={expression as never} size={size} ariaLabel={label} />;
}
