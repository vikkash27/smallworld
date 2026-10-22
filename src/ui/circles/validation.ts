import type { Activity, CircleDraft, CreateCircleRequest, Id, SearchPreviewResponse } from '../../shared/contracts';
import { londonLocalToUtcIso, utcIsoToLondonLocal } from './london-time';

/**
 * Length and capacity limits are our assumptions, not part of the frozen contract. They stop obviously
 * broken input; the server stays authoritative and its BAD_INPUT message is shown if it disagrees.
 */
export const LIMITS = {
  title: 80,
  purpose: 400,
  activityTitle: 80,
  activityDescription: 500,
  location: 120,
  capacityMax: 12,
  maxInvitees: 3,
} as const;

export interface ActivityFormValues {
  activityTitle: string;
  activityDescription: string;
  location: string;
  /** `YYYY-MM-DDTHH:mm`, London wall-clock time. Empty means "time to be agreed". */
  startsAtLocal: string;
}

export interface CircleFormValues extends ActivityFormValues {
  title: string;
  purpose: string;
  capacity: string;
  minimumMembers: string;
  selectedMemberIds: Id[];
}

export type ActivityErrors = Partial<Record<keyof ActivityFormValues, string>>;
export type FormErrors = Partial<Record<keyof CircleFormValues, string>>;

export function validateActivity(v: ActivityFormValues, now: number = Date.now()): ActivityErrors {
  const e: ActivityErrors = {};
  if (!v.activityTitle.trim()) e.activityTitle = 'Give the first activity a short title.';
  else if (v.activityTitle.trim().length > LIMITS.activityTitle) e.activityTitle = `Keep it under ${LIMITS.activityTitle} characters.`;
  if (!v.activityDescription.trim()) e.activityDescription = 'Say what people will actually do.';
  else if (v.activityDescription.trim().length > LIMITS.activityDescription) e.activityDescription = `Keep it under ${LIMITS.activityDescription} characters.`;
  if (v.location.trim().length > LIMITS.location) e.location = `Keep it under ${LIMITS.location} characters.`;
  if (v.startsAtLocal) {
    const iso = londonLocalToUtcIso(v.startsAtLocal);
    if (!iso) e.startsAtLocal = 'That time doesn’t exist in London (the clocks change). Pick another.';
    else if (Date.parse(iso) <= now) e.startsAtLocal = 'Pick a time in the future, or leave it blank to agree later.';
  }
  return e;
}

const toInt = (s: string): number => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

export function validateCircleForm(v: CircleFormValues, now: number = Date.now()): FormErrors {
  const e: FormErrors = { ...validateActivity(v, now) };
  if (!v.title.trim()) e.title = 'Name the circle.';
  else if (v.title.trim().length > LIMITS.title) e.title = `Keep it under ${LIMITS.title} characters.`;
  if (!v.purpose.trim()) e.purpose = 'Say what this circle is for.';
  else if (v.purpose.trim().length > LIMITS.purpose) e.purpose = `Keep it under ${LIMITS.purpose} characters.`;

  const invitees = v.selectedMemberIds.length;
  if (invitees < 1) e.selectedMemberIds = 'Choose at least one person to invite.';
  else if (invitees > LIMITS.maxInvitees) e.selectedMemberIds = `Invite at most ${LIMITS.maxInvitees} people.`;

  const capacity = toInt(v.capacity);
  const minimum = toInt(v.minimumMembers);
  // Minimum includes the host, so it can never exceed host + invitees or the circle could never become active.
  if (Number.isNaN(minimum) || minimum < 2) e.minimumMembers = 'Minimum members, including you, must be at least 2.';
  else if (minimum > invitees + 1) e.minimumMembers = `Only ${invitees + 1} people can join with this guest list, so this circle could never become active.`;
  if (Number.isNaN(capacity)) e.capacity = 'Enter a number of seats.';
  else if (capacity > LIMITS.capacityMax) e.capacity = `Capacity can be at most ${LIMITS.capacityMax}.`;
  else if (capacity < invitees + 1) e.capacity = 'Leave a seat for you and everyone you invite.';
  else if (!Number.isNaN(minimum) && capacity < minimum) e.capacity = 'Capacity can’t be below the minimum.';
  return e;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export function activityFromForm(v: ActivityFormValues): Activity {
  return {
    title: v.activityTitle.trim(),
    description: v.activityDescription.trim(),
    proposedStartsAt: v.startsAtLocal ? londonLocalToUtcIso(v.startsAtLocal) : null,
    timezone: 'Europe/London',
    location: v.location.trim() || null,
  };
}

export function activityToForm(a: Activity): ActivityFormValues {
  return {
    activityTitle: a.title,
    activityDescription: a.description,
    location: a.location ?? '',
    startsAtLocal: a.proposedStartsAt ? utcIsoToLondonLocal(a.proposedStartsAt) : '',
  };
}

/** Pull the minimum back down when the guest list shrinks, so the form never silently becomes unsatisfiable. */
export function clampMinimum(minimum: string, inviteeCount: number): string {
  const n = toInt(minimum);
  const max = Math.max(2, inviteeCount + 1);
  return Number.isNaN(n) || n <= max ? minimum : String(max);
}

export function initialFormValues(draft: CircleDraft, preview: SearchPreviewResponse): CircleFormValues {
  const known = new Set(preview.discovery.people.map((p) => p.member.id));
  const selected = draft.proposedMemberIds.filter((id) => known.has(id)).slice(0, LIMITS.maxInvitees);
  return {
    title: draft.title,
    purpose: draft.purpose,
    ...activityToForm(draft.activity),
    capacity: String(draft.capacity),
    minimumMembers: clampMinimum(String(draft.minimumMembers), selected.length),
    selectedMemberIds: selected,
  };
}

export function toCreateRequest(searchId: Id, v: CircleFormValues): CreateCircleRequest {
  return {
    searchId,
    selectedMemberIds: v.selectedMemberIds,
    title: v.title.trim(),
    purpose: v.purpose.trim(),
    activity: activityFromForm(v),
    capacity: toInt(v.capacity),
    minimumMembers: toInt(v.minimumMembers),
  };
}
