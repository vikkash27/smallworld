'use client';

import { useRef, useState } from 'react';
import type { CircleDetail } from '../../shared/contracts';
import { getCirclesClient } from '../../ui/circles/client';
import { isAbort, messageFor, toApiError } from '../../ui/circles/errors';
import { describeTime } from '../../ui/circles/london-time';
import { activityFromForm, activityToForm, hasErrors, validateActivity } from '../../ui/circles/validation';
import type { ActivityErrors, ActivityFormValues } from '../../ui/circles/validation';
import { ActivityFields } from './ActivityFields';
import s from './circles.module.css';

export function ActivityPanel({
  circle,
  onBeforeUpdate,
  onUpdated,
}: {
  circle: CircleDetail;
  onBeforeUpdate: () => void;
  onUpdated: (circle: CircleDetail) => void;
}) {
  const client = getCirclesClient();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ActivityFormValues>(() => activityToForm(circle.activity));
  const [errors, setErrors] = useState<ActivityErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);

  const { activity } = circle;
  const closed = circle.status === 'archived';
  const stillNeeded = Math.max(0, circle.minimumMembers - circle.acceptedCount);
  const meta = [describeTime(activity), activity.location].filter(Boolean).join(' · ');

  async function save(confirmed: boolean, form: ActivityFormValues) {
    if (inFlight.current) return;
    const found = validateActivity(form);
    setErrors(found);
    if (hasErrors(found)) {
      setEditing(true);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    onBeforeUpdate();
    try {
      const next = await client.updateActivity(circle.id, { activity: activityFromForm(form), confirmed });
      onUpdated(next);
      setEditing(false);
    } catch (e) {
      if (!isAbort(e)) setFailure(messageFor(toApiError(e), 'circle'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <section className={s.panel} aria-label="Edit first activity">
        <p className={s.panelLabel}>Edit first activity</p>
        <ActivityFields values={values} errors={errors} disabled={busy} onChange={(p) => setValues({ ...values, ...p })} />
        {failure ? <span className={s.error} role="alert">{failure}</span> : null}
        <div className={s.btnRow}>
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnPrimaryAuto}`} disabled={busy} onClick={() => save(circle.activityConfirmed, values)}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className={s.btnLink} disabled={busy} onClick={() => { setEditing(false); setErrors({}); setValues(activityToForm(circle.activity)); }}>
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={s.panel} aria-label="First activity">
      <p className={s.panelLabel}>First activity · {circle.activityConfirmed ? 'confirmed by host' : 'proposed'}</p>
      <h2 className={s.panelTitle}>{activity.title}</h2>
      <p className={s.panelText}>{activity.description}</p>
      {meta ? <p className={s.panelMeta}>{meta}</p> : null}

      {!closed && !circle.activityConfirmed ? (
        <div className={s.btnRow}>
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnPrimaryAuto}`} disabled={busy} onClick={() => save(true, activityToForm(activity))}>
            {busy ? 'Confirming…' : 'Confirm first activity'}
          </button>
          <button type="button" className={s.btnLink} disabled={busy} onClick={() => setEditing(true)}>Edit</button>
        </div>
      ) : null}
      {circle.activityConfirmed && circle.status === 'forming' ? (
        <p className={s.panelMeta}>
          {stillNeeded > 0
            ? `Waiting for ${stillNeeded} more ${stillNeeded === 1 ? 'person' : 'people'} to join before this circle can go active.`
            : 'Waiting for the platform to activate the circle.'}
        </p>
      ) : null}
      {failure ? <span className={s.error} role="alert">{failure}</span> : null}
    </section>
  );
}
