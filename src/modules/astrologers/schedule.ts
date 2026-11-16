import type { AstrologerAvailability, AstrologerScheduleSlot } from '@prisma/client';

/** Weekly hours are in India time (UTC+5:30, no daylight saving). */
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

export type Slot = Pick<AstrologerScheduleSlot, 'weekday' | 'startMinute' | 'endMinute'>;

/** "09:30" ↔ 570. "24:00" is allowed as an end. */
export const toMinute = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const toHhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Absolute times of every slot from yesterday to a week ahead, merged where they touch (e.g. across midnight). */
function intervals(slots: Slot[], now: Date): [number, number][] {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const midnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  const todayIso = ist.getUTCDay() || 7;
  const raw: [number, number][] = [];
  for (let k = -1; k <= 7; k++) {
    const day = midnight + k * DAY_MS;
    const iso = ((((todayIso - 1 + k) % 7) + 7) % 7) + 1;
    for (const s of slots) {
      if (s.weekday === iso) raw.push([day + s.startMinute * 60_000, day + s.endMinute * 60_000]);
    }
  }
  raw.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const iv of raw) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else merged.push([...iv]);
  }
  return merged;
}

/** Whether now is inside the hours, and when that next changes (null with no hours). */
export function scheduleState(slots: Slot[], now: Date): { inHours: boolean; nextChangeAt: Date | null } {
  const t = now.getTime();
  for (const [start, end] of intervals(slots, now)) {
    if (start <= t && t < end) return { inHours: true, nextChangeAt: new Date(end) };
    if (start > t) return { inHours: false, nextChangeAt: new Date(start) };
  }
  return { inHours: false, nextChangeAt: null };
}

/** The schedule drives a mode when it is on, covers that mode and no manual switch is still winning. */
export const scheduleDrives = (av: AstrologerAvailability | null, mode: string, now: Date) =>
  !!av?.scheduleEnabled && av.scheduleModes.includes(mode) && !(av.scheduleSkipUntil && av.scheduleSkipUntil > now);

/** Slots overlap on the same day. Expects start < end on each. */
export const overlaps = (slots: Slot[]) =>
  slots.some((a, i) =>
    slots.some(
      (b, j) => i < j && a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute,
    ),
  );
