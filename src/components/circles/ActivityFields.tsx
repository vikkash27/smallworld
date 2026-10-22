'use client';

import { useId } from 'react';
import { LIMITS } from '../../ui/circles/validation';
import type { ActivityErrors, ActivityFormValues } from '../../ui/circles/validation';
import s from './circles.module.css';

export function ActivityFields({
  values,
  errors,
  onChange,
  disabled,
}: {
  values: ActivityFormValues;
  errors: ActivityErrors;
  onChange: (patch: Partial<ActivityFormValues>) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <>
      <div className={s.field}>
        <label className={s.label} htmlFor={`${id}-title`}>First activity</label>
        <input
          id={`${id}-title`}
          className={`${s.input} ${errors.activityTitle ? s.inputError : ''}`}
          value={values.activityTitle}
          maxLength={LIMITS.activityTitle + 20}
          disabled={disabled}
          aria-invalid={Boolean(errors.activityTitle)}
          aria-describedby={errors.activityTitle ? `${id}-title-e` : undefined}
          onChange={(e) => onChange({ activityTitle: e.target.value })}
        />
        {errors.activityTitle ? <span id={`${id}-title-e`} className={s.error}>{errors.activityTitle}</span> : null}
      </div>
      <div className={s.field}>
        <label className={s.label} htmlFor={`${id}-desc`}>What happens</label>
        <textarea
          id={`${id}-desc`}
          className={`${s.input} ${errors.activityDescription ? s.inputError : ''}`}
          value={values.activityDescription}
          disabled={disabled}
          aria-invalid={Boolean(errors.activityDescription)}
          aria-describedby={errors.activityDescription ? `${id}-desc-e` : undefined}
          onChange={(e) => onChange({ activityDescription: e.target.value })}
        />
        {errors.activityDescription ? <span id={`${id}-desc-e`} className={s.error}>{errors.activityDescription}</span> : null}
      </div>
      <div className={s.twoCol}>
        <div className={s.field}>
          <label className={s.label} htmlFor={`${id}-when`}>Proposed time (optional)</label>
          <input
            id={`${id}-when`}
            type="datetime-local"
            className={`${s.input} ${errors.startsAtLocal ? s.inputError : ''}`}
            value={values.startsAtLocal}
            disabled={disabled}
            aria-invalid={Boolean(errors.startsAtLocal)}
            aria-describedby={`${id}-when-h`}
            onChange={(e) => onChange({ startsAtLocal: e.target.value })}
          />
          <span id={`${id}-when-h`} className={errors.startsAtLocal ? s.error : s.hint}>
            {errors.startsAtLocal ?? 'London time. Leave blank and it shows as “time to be agreed”.'}
          </span>
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor={`${id}-where`}>Where (optional)</label>
          <input
            id={`${id}-where`}
            className={`${s.input} ${errors.location ? s.inputError : ''}`}
            value={values.location}
            disabled={disabled}
            onChange={(e) => onChange({ location: e.target.value })}
          />
          {errors.location ? <span className={s.error}>{errors.location}</span> : null}
        </div>
      </div>
    </>
  );
}
