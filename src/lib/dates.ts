import { clock } from './clock';

const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in India, "YYYY-MM-DD". Age rules use the Indian date, not UTC. */
export function todayInIndia(): string {
  return IST_DATE.format(clock.now());
}

/** Whole years between two "YYYY-MM-DD" dates. */
export function yearsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  return ty - fy - (tm < fm || (tm === fm && td < fd) ? 1 : 0);
}

/** "YYYY-MM-DD" → Date at UTC midnight, the form Prisma expects for @db.Date. */
export const toDbDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);

export function isRealDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = toDbDate(ymd);
  return !Number.isNaN(d.getTime()) && fromDbDate(d) === ymd;
}
