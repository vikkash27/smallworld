'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import type { CircleDraft } from '../../shared/contracts';
import { getCirclesClient } from '../../ui/circles/client';
import { isAbort, isAmbiguous, messageFor, toApiError } from '../../ui/circles/errors';
import type { ApiError } from '../../ui/circles/errors';
import { saveLinks } from '../../ui/circles/links-cache';
import { useRequest } from '../../ui/circles/use-request';
import { initialFormValues, toCreateRequest } from '../../ui/circles/validation';
import type { CircleFormValues } from '../../ui/circles/validation';
import { CircleForm } from './CircleForm';
import { DataBadge, LoadingState, StateMessage } from './StateMessage';
import s from './circles.module.css';

const BACK = (
  <Link href="/" className={`${s.btn} ${s.btnGhost}`}>
    Back to Discover
  </Link>
);

export default function NewCircleFlow() {
  const searchId = useSearchParams().get('searchId')?.trim() || null;
  const client = getCirclesClient();
  const router = useRouter();
  const { state, reload } = useRequest((signal) => client.getSearchPreview(searchId as string, { signal }), searchId);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<ApiError | null>(null);

  if (!searchId) {
    return (
      <main className={`${s.root} ${s.narrow}`}>
        <StateMessage title="No search to build from" actions={BACK}>
          Circles start from a search. Describe what you want to build on Discover, then choose Bring us together.
        </StateMessage>
      </main>
    );
  }

  if (state.status === 'loading') {
    return (
      <main className={`${s.root} ${s.page}`}>
        <LoadingState label="Loading your search…" />
      </main>
    );
  }

  if (state.status === 'error') {
    const e = state.error;
    const retryable = e.code === 'NETWORK' || e.code === 'TIMEOUT' || e.code === 'PROVIDER_UNAVAILABLE' || e.code === 'RATE_LIMITED' || e.code === 'BAD_RESPONSE';
    return (
      <main className={`${s.root} ${s.narrow}`}>
        <StateMessage
          title="We couldn’t open that search"
          error={e}
          actions={
            <>
              {retryable ? <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnPrimaryAuto}`} onClick={reload}>Try again</button> : null}
              {BACK}
            </>
          }
        >
          {messageFor(e, 'search')}
        </StateMessage>
      </main>
    );
  }

  const preview = state.data;
  const draft: CircleDraft | null = preview.discovery.circleDraft;
  if (preview.discovery.status === 'empty' || !draft || preview.discovery.people.length === 0) {
    return (
      <main className={`${s.root} ${s.narrow}`}>
        <StateMessage title="No circle to propose yet" actions={BACK}>
          {preview.discovery.message ?? 'This search didn’t find enough grounded people to suggest a circle.'} Try a different goal or add context on Discover.
        </StateMessage>
      </main>
    );
  }

  async function create(values: CircleFormValues) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setCreateError(null);
    try {
      const res = await client.createCircle(toCreateRequest(searchId as string, values));
      saveLinks(res.circle.id, res.invitationLinks);
      // replace(), not push(): Back must not return to a form that would create a duplicate circle.
      router.replace(`/circles/${encodeURIComponent(res.circle.id)}`);
    } catch (e) {
      if (isAbort(e)) return;
      setCreateError(toApiError(e));
      submitting.current = false;
      setBusy(false);
    }
  }

  const ambiguous = createError ? isAmbiguous(createError) : false;

  return (
    <main className={`${s.root} ${s.page}`}>
      <DataBadge mode={client.mode} dataMode={preview.discovery.dataMode} />
      <p className={s.eyebrow}>New circle · review before inviting</p>
      <h1 className={s.title}>Start something together.</h1>
      <p className={s.lede}>Goal: {preview.goal}</p>

      {createError ? (
        <div style={{ marginBottom: 24 }}>
          <StateMessage
            title={ambiguous ? 'We couldn’t confirm the circle was created' : 'The circle wasn’t created'}
            error={createError}
            actions={ambiguous ? <Link href="/circles" className={`${s.btn} ${s.btnGhost}`}>Check Your circles first</Link> : null}
          >
            {ambiguous
              ? 'The request may have gone through. Check Your circles before trying again so you don’t create it twice.'
              : messageFor(createError)}
          </StateMessage>
        </div>
      ) : null}

      <CircleForm preview={preview} initial={initialFormValues(draft, preview)} submitting={busy} onSubmit={create} />
    </main>
  );
}
