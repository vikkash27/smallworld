'use client';

import Link from 'next/link';
import { getCirclesClient } from '../../ui/circles/client';
import { messageFor } from '../../ui/circles/errors';
import { useRequest } from '../../ui/circles/use-request';
import { DataBadge, LoadingState, StateMessage } from './StateMessage';
import s from './circles.module.css';

const STATUS_LABEL = { draft: 'Draft', forming: 'Forming', active: 'Active', archived: 'Archived' } as const;

export default function CircleList() {
  const client = getCirclesClient();
  const { state, reload } = useRequest((signal) => client.listCircles({ signal }), 'list');

  return (
    <main className={`${s.root} ${s.page}`}>
      <DataBadge mode={client.mode} />
      <p className={s.eyebrow}>Your circles</p>
      <h1 className={s.title}>Circles you’re building.</h1>

      {state.status === 'loading' ? <LoadingState label="Loading your circles…" /> : null}

      {state.status === 'error' ? (
        <StateMessage
          title="We couldn’t load your circles"
          error={state.error}
          actions={<button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={reload}>Try again</button>}
        >
          {messageFor(state.error, 'circle')}
        </StateMessage>
      ) : null}

      {state.status === 'ready' && state.data.length === 0 ? (
        <StateMessage title="No circles yet" actions={<Link href="/" className={`${s.btn} ${s.btnPrimary} ${s.btnPrimaryAuto}`}>Find people</Link>}>
          Describe a goal on Discover and bring a few people together.
        </StateMessage>
      ) : null}

      {state.status === 'ready' && state.data.length > 0 ? (
        <ul className={s.list}>
          {state.data.map((c) => (
            <li key={c.id}>
              <Link href={`/circles/${encodeURIComponent(c.id)}`} className={s.listItem}>
                <h2 className={s.listTitle}>{c.title}</h2>
                <p className={s.listMeta}>
                  {STATUS_LABEL[c.status]} · {c.acceptedCount} of {c.capacity} seats filled
                  {c.activityConfirmed ? ' · first activity confirmed' : ' · activity not confirmed'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
