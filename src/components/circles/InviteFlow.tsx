'use client';

import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import type { CircleStatus, InvitationResponse } from '../../shared/contracts';
import { getCirclesClient } from '../../ui/circles/client';
import { isAbort, isAmbiguous, messageFor, toApiError } from '../../ui/circles/errors';
import type { ApiError } from '../../ui/circles/errors';
import { describeTime } from '../../ui/circles/london-time';
import { useRequest } from '../../ui/circles/use-request';
import { MemberAvatar } from './MemberAvatar';
import { DataBadge, LoadingState, StateMessage } from './StateMessage';
import s from './circles.module.css';

type Outcome = { invitationStatus: 'accepted' | 'declined'; acceptedCount: number | null; circleStatus: CircleStatus | null };

// Module-level on purpose: a component defined inside InviteFlow would remount on every render and drop input focus.
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className={`${s.root} ${s.narrow}`}>
      <p className={s.wordmark}>smallworld</p>
      {children}
    </main>
  );
}

export default function InviteFlow() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(String(params.token ?? ''));
  const client = getCirclesClient();
  const { state, reload } = useRequest((signal) => client.getInvitation(token, { signal }), token || null);

  const [showOnRoster, setShowOnRoster] = useState(false); // never pre-checked
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [unsure, setUnsure] = useState(false);
  const inFlight = useRef(false);

  if (state.status === 'loading') {
    return <Frame><LoadingState label="Opening your invitation…" /></Frame>;
  }

  if (state.status === 'error') {
    const e = state.error;
    const retryable = e.code === 'NETWORK' || e.code === 'TIMEOUT' || e.code === 'PROVIDER_UNAVAILABLE' || e.code === 'RATE_LIMITED' || e.code === 'BAD_RESPONSE';
    return (
      <Frame>
        <StateMessage
          title={e.code === 'EXPIRED' ? 'This invitation has ended' : 'We couldn’t open this invitation'}
          error={e}
          actions={retryable ? <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={reload}>Try again</button> : null}
        >
          {messageFor(e, 'invitation')}
        </StateMessage>
      </Frame>
    );
  }

  const view = state.data;
  const { circle } = view;
  const status = outcome?.invitationStatus ?? view.invitationStatus;
  const meta = [describeTime(circle.activity), circle.activity.location].filter(Boolean).join(' · ');

  async function answer(decision: 'join' | 'decline') {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    setUnsure(false);
    try {
      // Only a person who is joining can consent to being named; a decline never carries consent.
      const res: InvitationResponse = await client.respondToInvitation(token, { decision, showOnRoster: decision === 'join' && showOnRoster });
      setOutcome({ invitationStatus: res.invitationStatus, acceptedCount: res.acceptedCount, circleStatus: res.circleStatus });
    } catch (e) {
      if (isAbort(e)) return;
      const err = toApiError(e);
      if (isAmbiguous(err)) {
        // The request may have been applied. Re-read the invitation rather than risk a blind second attempt.
        try {
          const fresh = await client.getInvitation(token);
          if (fresh.invitationStatus === 'accepted' || fresh.invitationStatus === 'declined') {
            setOutcome({ invitationStatus: fresh.invitationStatus, acceptedCount: fresh.circle.acceptedCount, circleStatus: fresh.circle.status });
            return;
          }
        } catch {
          /* fall through to the uncertain message */
        }
        setUnsure(true);
      }
      setProblem(err);
    } finally {
      inFlight.current = false;
      setBusy(false);
      setConfirmingDecline(false);
    }
  }

  const header = (
    <>
      <DataBadge mode={client.mode} dataMode={view.dataMode} />
      <div className={s.hostRow}>
        <MemberAvatar initials={view.hostDisplayName.slice(0, 2).toUpperCase()} size={40} />
        <p className={s.panelMeta} style={{ margin: 0 }}>An invitation from {view.hostDisplayName}</p>
      </div>
      <h1 className={s.titleSm}>Build something together.</h1>
      <h2 className={s.panelTitle}>{circle.title}</h2>
      <p className={s.panelText} style={{ marginBottom: 20 }}>{circle.purpose}</p>
      <section className={s.panel} aria-label="First activity">
        <p className={s.panelLabel}>First activity</p>
        <p className={s.panelTitle} style={{ fontSize: 18 }}>{circle.activity.title}</p>
        <p className={s.panelMeta} style={{ marginTop: 0 }}>{circle.activity.description}</p>
        {meta ? <p className={s.panelMeta}>{meta}</p> : null}
      </section>
    </>
  );

  if (status === 'accepted') {
    const count = outcome?.acceptedCount ?? circle.acceptedCount;
    const cs = outcome?.circleStatus ?? circle.status;
    return (
      <Frame>
        {header}
        <div className={s.stateBox} role="status">
          <h2 className={s.stateTitle}>You’ve joined this circle.</h2>
          <p className={s.stateText}>
            {count} {count === 1 ? 'person has' : 'people have'} joined so far, including {view.hostDisplayName}.{' '}
            {cs === 'active' ? 'The circle is active.' : `${view.hostDisplayName} will confirm the first activity.`}
          </p>
          <p className={s.reqId} style={{ margin: 0 }}>Joining confirms this invitation link, not your identity. Your chats stay private.</p>
        </div>
      </Frame>
    );
  }

  if (status === 'declined') {
    return (
      <Frame>
        {header}
        <div className={s.stateBox} role="status">
          <h2 className={s.stateTitle}>You’ve declined.</h2>
          <p className={s.stateText}>Thanks for letting {view.hostDisplayName} know. Nothing else is needed.</p>
        </div>
      </Frame>
    );
  }

  if (status === 'expired' || status === 'revoked') {
    return (
      <Frame>
        {header}
        <StateMessage title="This invitation has ended">
          This invitation has expired or was withdrawn. Ask the host for a new one.
        </StateMessage>
      </Frame>
    );
  }

  return (
    <Frame>
      {header}

      {problem ? (
        <div style={{ marginBottom: 20 }}>
          <StateMessage
            title={unsure ? 'We’re not sure that went through' : problem.code === 'CONFLICT' ? 'Not possible right now' : 'Something went wrong'}
            error={problem}
          >
            {unsure ? 'Check your connection and try again. If you already answered, reloading this page will show it.' : messageFor(problem, 'invitation')}
          </StateMessage>
        </div>
      ) : null}

      <label className={s.check}>
        <input type="checkbox" checked={showOnRoster} disabled={busy} onChange={(e) => setShowOnRoster(e.target.checked)} />
        <span className={s.checkText}>Show my name on the circle roster</span>
      </label>

      <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={() => answer('join')}>
        {busy && !confirmingDecline ? 'Joining…' : 'Join this circle'}
        <span aria-hidden>↗</span>
      </button>

      {confirmingDecline ? (
        <div className={s.btnRow} role="group" aria-label="Confirm decline" style={{ justifyContent: 'center' }}>
          <button type="button" className={`${s.btn} ${s.btnGhost}`} disabled={busy} onClick={() => answer('decline')}>Yes, decline</button>
          <button type="button" className={s.btnLink} disabled={busy} onClick={() => setConfirmingDecline(false)}>Keep invitation</button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <button type="button" className={s.btnLink} disabled={busy} onClick={() => setConfirmingDecline(true)}>Not this time</button>
        </div>
      )}

      <p className={s.reqId} style={{ textAlign: 'center' }}>
        Joining confirms this invitation link, not your identity. Your chats stay private.
      </p>
    </Frame>
  );
}
