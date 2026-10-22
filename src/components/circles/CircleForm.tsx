'use client';

import { useId, useMemo, useState } from 'react';
import { assignVariants } from '../../ui/circles/avatars/avatar-seed';
import type { SearchPreviewResponse } from '../../shared/contracts';
import { clampMinimum, hasErrors, LIMITS, validateCircleForm } from '../../ui/circles/validation';
import type { CircleFormValues, FormErrors } from '../../ui/circles/validation';
import { ActivityFields } from './ActivityFields';
import { MemberAvatar } from './MemberAvatar';
import s from './circles.module.css';

const FIT_LABEL: Record<string, string> = {
  experience: 'Relevant experience',
  complementary_need: 'Complementary need',
  collaborator: 'Potential collaborator',
  peer: 'Peer',
  speaker: 'Speaker',
};

export function CircleForm({
  preview,
  initial,
  submitting,
  onSubmit,
}: {
  preview: SearchPreviewResponse;
  initial: CircleFormValues;
  submitting: boolean;
  onSubmit: (values: CircleFormValues) => void;
}) {
  const id = useId();
  const variants = useMemo(() => assignVariants(preview.discovery.people.map((p) => p.member.id)), [preview]);
  const [v, setV] = useState<CircleFormValues>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attempted, setAttempted] = useState(false);

  const update = (patch: Partial<CircleFormValues>) => {
    const next = { ...v, ...patch };
    if (patch.selectedMemberIds) next.minimumMembers = clampMinimum(next.minimumMembers, patch.selectedMemberIds.length);
    setV(next);
    if (attempted) setErrors(validateCircleForm(next));
  };

  const toggle = (memberId: string) => {
    const has = v.selectedMemberIds.includes(memberId);
    update({ selectedMemberIds: has ? v.selectedMemberIds.filter((x) => x !== memberId) : [...v.selectedMemberIds, memberId] });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setAttempted(true);
    const found = validateCircleForm(v);
    setErrors(found);
    if (hasErrors(found)) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    onSubmit(v);
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className={s.field}>
        <label className={s.label} htmlFor={`${id}-title`}>Circle name</label>
        <input
          id={`${id}-title`}
          className={`${s.input} ${errors.title ? s.inputError : ''}`}
          value={v.title}
          disabled={submitting}
          aria-invalid={Boolean(errors.title)}
          onChange={(e) => update({ title: e.target.value })}
        />
        {errors.title ? <span className={s.error}>{errors.title}</span> : null}
      </div>
      <div className={s.field}>
        <label className={s.label} htmlFor={`${id}-purpose`}>Purpose</label>
        <textarea
          id={`${id}-purpose`}
          className={`${s.input} ${errors.purpose ? s.inputError : ''}`}
          value={v.purpose}
          disabled={submitting}
          aria-invalid={Boolean(errors.purpose)}
          onChange={(e) => update({ purpose: e.target.value })}
        />
        {errors.purpose ? <span className={s.error}>{errors.purpose}</span> : null}
      </div>

      <ActivityFields
        values={v}
        errors={errors}
        disabled={submitting}
        onChange={(patch) => update(patch)}
      />

      <fieldset className={s.fieldset} aria-describedby={`${id}-people-h`}>
        <legend className={s.legend}>Who to invite</legend>
        <span id={`${id}-people-h`} className={s.hint}>
          You are the host. Nobody has agreed to anything yet: they only join if they accept their invitation.
        </span>
        {preview.discovery.people.map((p) => {
          const checked = v.selectedMemberIds.includes(p.member.id);
          return (
            <label key={p.member.id} className={s.check}>
              <input type="checkbox" checked={checked} disabled={submitting} onChange={() => toggle(p.member.id)} />
              <MemberAvatar seed={p.member.id} initials={p.member.initials} size={40} variants={variants} />
              <span className={s.checkText}>
                <span className={s.checkName}>{p.member.displayName}</span>
                <span className={s.checkSub}>
                  {FIT_LABEL[p.fitType] ?? p.fitType} · {p.reason}
                </span>
                {p.availability === 'unknown' ? <span className={s.checkSub}>Availability to be confirmed.</span> : null}
              </span>
            </label>
          );
        })}
        {errors.selectedMemberIds ? <span className={s.error}>{errors.selectedMemberIds}</span> : null}
      </fieldset>

      <div className={s.twoCol}>
        <div className={s.field}>
          <label className={s.label} htmlFor={`${id}-cap`}>Seats (max {LIMITS.capacityMax})</label>
          <input
            id={`${id}-cap`}
            inputMode="numeric"
            className={`${s.input} ${errors.capacity ? s.inputError : ''}`}
            value={v.capacity}
            disabled={submitting}
            aria-invalid={Boolean(errors.capacity)}
            onChange={(e) => update({ capacity: e.target.value })}
          />
          {errors.capacity ? <span className={s.error}>{errors.capacity}</span> : null}
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor={`${id}-min`}>Needed to go active</label>
          <input
            id={`${id}-min`}
            inputMode="numeric"
            className={`${s.input} ${errors.minimumMembers ? s.inputError : ''}`}
            value={v.minimumMembers}
            disabled={submitting}
            aria-invalid={Boolean(errors.minimumMembers)}
            aria-describedby={`${id}-min-h`}
            onChange={(e) => update({ minimumMembers: e.target.value })}
          />
          <span id={`${id}-min-h`} className={errors.minimumMembers ? s.error : s.hint}>
            {errors.minimumMembers ?? 'Including you.'}
          </span>
        </div>
      </div>

      <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={submitting}>
        {submitting ? 'Creating circle…' : 'Create circle and invitations'}
        <span aria-hidden>↗</span>
      </button>
      <p className={s.note}>
        This creates a private invitation link for each person. Small World doesn’t send anything: you share the links yourself.
      </p>
    </form>
  );
}
