'use client';

import { Component } from 'react';
import type { ReactNode } from 'react';
import LabAvatar from '../../ui/circles/avatars/avatar-lab';
import { variantFor } from '../../ui/circles/avatars/avatar-seed';
import type { AvatarVariant } from '../../ui/circles/avatars/avatar-seed';
import s from './circles.module.css';

class FallbackOnError extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * One member, drawn as a small procedural avatar. The adjacent text always carries the name, so the avatar is
 * decorative (aria-hidden).
 *
 * `seed` is an opaque id. Pass null for someone who has NOT agreed to be shown: they get a neutral dashed
 * placeholder, never a distinctive avatar, so the picture can't identify them.
 */
export function MemberAvatar({
  seed,
  initials,
  size = 52,
  variants,
}: {
  seed: string | null;
  initials: string | null;
  size?: number;
  /** From assignVariants() for the whole circle, so members are drawn distinctly. Falls back to the plain hash. */
  variants?: ReadonlyMap<string, AvatarVariant>;
}) {
  if (seed === null) {
    return (
      <span className={`${s.avatar} ${s.avatarGhost}`} style={{ width: size, height: size }} aria-hidden>
        ?
      </span>
    );
  }
  const { color, expression } = variants?.get(seed) ?? variantFor(seed);
  const fallback = (
    <span className={s.avatar} style={{ width: size, height: size }} aria-hidden>
      {initials ?? '?'}
    </span>
  );
  return (
    <span
      className={s.avatarFrame}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 22%, var(--d-bg))` }}
      aria-hidden
    >
      <FallbackOnError fallback={fallback}>
        <LabAvatar color={color} expression={expression} size={size} label="" />
      </FallbackOnError>
    </span>
  );
}
