'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CircleDetail } from '../../shared/contracts';
import { assignVariants } from '../../ui/circles/avatars/avatar-seed';
import { getCirclesClient } from '../../ui/circles/client';
import { messageFor, toApiError } from '../../ui/circles/errors';
import type { ApiError } from '../../ui/circles/errors';
import { loadLinks } from '../../ui/circles/links-cache';
import type { InvitationLink } from '../../ui/circles/links-cache';
import { createPoller, documentVisibility } from '../../ui/circles/polling';
import { ActivityPanel } from './ActivityPanel';
import { InvitationLinks } from './InvitationLinks';
import { MemberAvatar } from './MemberAvatar';
import { DataBadge, LoadingState, StateMessage } from './StateMessage';
import s from './circles.module.css';

const POLL_MS = 3000;
const STATUS_LABEL = { draft: 'Draft', forming: 'Forming', active: 'Active', archived: 'Archived' } as const;
const WAITING_LABEL = { pending: 'Waiting to respond', declined: 'Declined', expired: 'Link expired', revoked: 'Link withdrawn', accepted: 'Joined' } as const;

const FATAL = new Set(['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']);

export default function CircleDetailView() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params.id ?? ''));
  const client = getCirclesClient();

  const [circle, setCircle] = useState<CircleDetail | null>(null);
  const [fatal, setFatal] = useState<ApiError | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [links, setLinks] = useState<InvitationLink[]>([]);
  // Bumped when this page changes the circle itself, so a poll already in flight can't overwrite the newer data.
  const epoch = useRef(0);

  useEffect(() => setLinks(loadLinks(id)), [id]);

  // Poll only while the circle can still change: forming (or draft) and the tab is visible.
  const polling = fatal === null && (circle === null || circle.status === 'forming' || circle.status === 'draft');

  useEffect(() => {
    if (!polling) return;
    const poller = createPoller({
      intervalMs: POLL_MS,
      visibility: documentVisibility,
      run: async (signal) => {
        const startedAt = epoch.current;
        const next = await client.getCircle(id, { signal });
        if (epoch.current !== startedAt) return;
        setCircle(next);
        setReconnecting(false);
      },
      onError: (e) => {
        const err = toApiError(e);
        if (FATAL.has(err.code)) {
          setFatal(err);
          return 'stop';
        }
        setReconnecting(true);
        return 'retry';
      },
    });
    poller.start();
    return () => poller.stop();
  }, [id, polling, client]);

  const waiting = useMemo(() => (circle ? circle.invitations.filter((i) => i.status !== 'accepted') : []), [circle]);
  // One distinct look per person in this circle, shared by every list on the page.
  const variants = useMemo(
    () => (circle ? assignVariants([circle.host.id, ...circle.invitations.map((i) => i.member.id)]) : undefined),
    [circle],
  );

  if (fatal) {
    return (
      <main className={`${s.root} ${s.narrow}`}>
        <StateMessage
          title="We couldn’t open this circle"
          error={fatal}
          actions={<Link href="/circles" className={`${s.btn} ${s.btnGhost}`}>Your circles</Link>}
        >
          {messageFor(fatal, 'circle')}
        </StateMessage>
      </main>
    );
  }

  if (!circle) {
    return (
      <main className={`${s.root} ${s.page}`}>
        <LoadingState label="Loading circle…" />
      </main>
    );
  }

  const joined = circle.acceptedCount;
  const hasLinks = links.length > 0 && circle.status !== 'archived';

  return (
    <main className={`${s.root} ${s.page}`}>
      <DataBadge mode={client.mode} />
      <p className={s.eyebrow}>Creator view</p>
      <h1 className={s.title}>{circle.title}</h1>
      <p className={s.lede}>{circle.purpose}</p>

      {reconnecting ? (
        <p className={`${s.banner} ${s.bannerWarn}`} role="status">
          Having trouble refreshing. Showing the last update; we’ll keep trying.
        </p>
      ) : null}

      {hasLinks ? <InvitationLinks links={links} invitations={circle.invitations} variants={variants} /> : null}

      <ActivityPanel
        circle={circle}
        onBeforeUpdate={() => { epoch.current += 1; }}
        onUpdated={(next) => { epoch.current += 1; setCircle(next); }}
      />

      <section aria-labelledby="roster-h">
        <div className={s.rosterHead}>
          <h2 id="roster-h" className={s.h2} aria-live="polite" aria-atomic="true">
            {joined} {joined === 1 ? 'person' : 'people'} joined
          </h2>
          <span className={`${s.tag} ${circle.status === 'active' ? '' : s.tagMuted}`}>{STATUS_LABEL[circle.status]}</span>
        </div>
        <ul className={s.list}>
          {circle.roster.map((m) => (
            <li key={m.id} className={s.row}>
              {/* A member who hasn't agreed to be named gets the neutral placeholder, never a distinctive avatar. */}
              <MemberAvatar seed={m.displayName ? m.id : null} initials={m.initials} variants={variants} />
              <span className={s.rowName}>{m.displayName ?? 'Member (name hidden)'}</span>
              <span className={s.rowRole}>{m.role === 'host' ? 'Host' : 'Joined'}</span>
            </li>
          ))}
        </ul>

        {waiting.length > 0 ? (
          <>
            <p className={s.note}>Pending invitations don’t count as members.</p>
            <ul className={s.list} aria-label="Invitations not yet accepted">
              {waiting.map((i) => (
                <li key={i.id} className={s.row}>
                  <MemberAvatar seed={i.member.id} initials={i.member.initials} variants={variants} />
                  <span className={s.rowName}>{i.member.displayName}</span>
                  <span className={s.rowRole}>{WAITING_LABEL[i.status]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {polling ? <p className={s.note}>This page updates automatically while it’s open.</p> : null}
    </main>
  );
}
