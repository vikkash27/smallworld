'use client';

import { useState } from 'react';
import type { InvitationSummary, MemberSummary } from '../../shared/contracts';
import type { InvitationLink } from '../../ui/circles/links-cache';
import { MemberAvatar } from './MemberAvatar';
import s from './circles.module.css';

async function copyText(text: string, input: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; over plain http on a LAN address fall back to selection.
    if (!input) return false;
    input.focus();
    input.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

function LinkRow({ link, name, member }: { link: InvitationLink; name: string; member: MemberSummary | null }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <li className={s.linkRow}>
      <div className={s.linkWhoRow}>
        <MemberAvatar initials={member?.initials ?? null} size={36} />
        <p className={s.linkWho}>{name}</p>
      </div>
      <div className={s.linkInputRow}>
        <input
          ref={setInput}
          className={s.input}
          readOnly
          value={link.url}
          aria-label={`Invitation link for ${name}`}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className={`${s.btn} ${s.btnGhost}`}
          onClick={async () => setStatus((await copyText(link.url, input)) ? 'copied' : 'manual')}
        >
          Copy link
        </button>
        {canShare ? (
          <button
            type="button"
            className={`${s.btn} ${s.btnGhost}`}
            onClick={() => navigator.share({ title: 'Small World invitation', url: link.url }).catch(() => undefined)}
          >
            Share
          </button>
        ) : null}
      </div>
      <p className={s.status} role="status">
        {status === 'copied' ? 'Copied.' : status === 'manual' ? 'Couldn’t copy automatically. Select the link and copy it.' : 'Not sent yet. You share this one yourself.'}
      </p>
    </li>
  );
}

export function InvitationLinks({ links, invitations }: { links: InvitationLink[]; invitations: InvitationSummary[] }) {
  if (links.length === 0) return null;
  const memberFor = (l: InvitationLink): MemberSummary | null =>
    (invitations.find((i) => i.id === l.invitationId) ?? invitations.find((i) => i.member.id === l.memberId))?.member ?? null;
  return (
    <section aria-labelledby="links-h" style={{ marginBottom: 28 }}>
      <h2 id="links-h" className={s.h2}>Share these links</h2>
      <p className={s.note} style={{ marginTop: 8 }}>
        Each link is private to one person and is shown only now. Send each one yourself, for example by message. Anyone who
        holds a link can respond to that invitation, so don’t post them publicly.
      </p>
      <ul className={s.list}>
        {links.map((l) => {
          const member = memberFor(l);
          return <LinkRow key={l.invitationId} link={l} name={member?.displayName ?? 'Invitee'} member={member} />;
        })}
      </ul>
    </section>
  );
}
