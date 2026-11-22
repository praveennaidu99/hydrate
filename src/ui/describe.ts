import type { CustomReminder } from '../notifications';

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const fmtTime = (h: number, m: number) =>
  new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const fmtDateTime = (d: Date) =>
  d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const fmtMinutes = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`);

/** Human-readable schedule, e.g. "Weekdays at 9:00 AM". */
export function describeReminder(r: CustomReminder, short = false): string {
  switch (r.mode) {
    case 'at':
      return `Once · ${fmtDateTime(new Date(r.at ?? 0))}`;
    case 'every':
      return `Every ${fmtMinutes(r.minutes ?? 0)}`;
    case 'daily': {
      const t = fmtTime(r.hour ?? 0, r.minute ?? 0);
      const d = r.days && r.days.length ? r.days : ALL_DAYS;
      if (d.length === 7) return short ? `Daily ${t}` : `Every day at ${t}`;
      if (d.join() === '2,3,4,5,6') return `Weekdays at ${t}`;
      if (d.join() === '1,7') return `Weekends at ${t}`;
      return `${d.map((x) => NAMES[x - 1]).join(', ')} at ${t}`;
    }
    case 'in': {
      const created = Number(r.id.replace('custom-', ''));
      return created && r.minutes ? `Once · ${fmtDateTime(new Date(created + r.minutes * 60000))}` : `In ${fmtMinutes(r.minutes ?? 0)}`;
    }
  }
}
