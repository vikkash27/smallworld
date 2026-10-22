import s from './circles.module.css';

/**
 * One member as an initials circle, as in the mockups. The adjacent text always carries the name, so this is
 * decorative (aria-hidden).
 *
 * `anonymous` is for someone who has NOT agreed to be named: they get a neutral dashed "?" and nothing that
 * could identify them.
 */
export function MemberAvatar({
  initials,
  anonymous = false,
  size = 44,
}: {
  initials: string | null;
  anonymous?: boolean;
  size?: number;
}) {
  const hidden = anonymous || !initials;
  return (
    <span
      className={`${s.avatar} ${hidden ? s.avatarGhost : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {hidden ? '?' : initials}
    </span>
  );
}
