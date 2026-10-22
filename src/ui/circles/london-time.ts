/**
 * Activity times are proposed in Europe/London and sent as ISO UTC. The UK clocks go back on
 * 25 October 2026, so a fixed +01:00 offset would be wrong for anything proposed after that date.
 */
const TZ = 'Europe/London';

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function londonFields(utcMs: number) {
  const p: Record<string, string> = {};
  for (const part of PARTS.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

function offsetMinutes(utcMs: number): number {
  const f = londonFields(utcMs);
  const asUtc = Date.UTC(f.y, f.mo - 1, f.d, f.h, f.mi, f.s);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DDTHH:mm` read as London wall-clock time → ISO UTC. Null if invalid or non-existent. */
export function londonLocalToUtcIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d ||
    check.getUTCHours() !== h || check.getUTCMinutes() !== mi
  ) return null;

  let utc = wall - offsetMinutes(wall) * 60000;
  utc = wall - offsetMinutes(utc) * 60000;
  const iso = new Date(utc).toISOString().replace('.000Z', 'Z');
  // A wall time skipped by the spring clock change does not round-trip.
  return utcIsoToLondonLocal(iso) === local ? iso : null;
}

/** ISO UTC → `YYYY-MM-DDTHH:mm` in London, for a datetime-local input. Empty string if unparseable. */
export function utcIsoToLondonLocal(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const f = londonFields(ms);
  return `${f.y}-${pad(f.mo)}-${pad(f.d)}T${pad(f.h)}:${pad(f.mi)}`;
}

const DISPLAY = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

export function formatProposedTime(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 'Time to be agreed' : DISPLAY.format(new Date(ms));
}

/**
 * The one line that says when. A null time must read as undecided, never as a booking. Returns null when the
 * description already says so, so the same words are not shown twice.
 */
export function describeTime(a: { proposedStartsAt: string | null; description: string }): string | null {
  if (a.proposedStartsAt) return `Proposed: ${formatProposedTime(a.proposedStartsAt)}`;
  return /to be agreed/i.test(a.description) ? null : 'Time to be agreed';
}
