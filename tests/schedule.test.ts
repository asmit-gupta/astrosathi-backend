import { describe, expect, it } from 'vitest';
import { overlaps, scheduleState } from '../src/modules/astrologers/schedule';

// Sunday 15 Nov 2026, 23:30 India time.
const sundayNight = new Date('2026-11-15T18:00:00Z');

describe('weekly schedule times', () => {
  it('joins blocks across midnight into one stretch', () => {
    const slots = [
      { weekday: 7, startMinute: 22 * 60, endMinute: 24 * 60 },
      { weekday: 1, startMinute: 0, endMinute: 2 * 60 },
    ];
    // Ends Monday 02:00 India time.
    expect(scheduleState(slots, sundayNight)).toEqual({
      inHours: true,
      nextChangeAt: new Date('2026-11-15T20:30:00Z'),
    });
  });

  it('finds the next start, even a week away, and nothing with no hours', () => {
    const slots = [{ weekday: 7, startMinute: 9 * 60, endMinute: 10 * 60 }];
    expect(scheduleState(slots, sundayNight)).toEqual({
      inHours: false,
      nextChangeAt: new Date('2026-11-22T03:30:00Z'),
    });
    expect(scheduleState([], sundayNight)).toEqual({ inHours: false, nextChangeAt: null });
  });

  it('spots overlaps on the same day only', () => {
    const a = { weekday: 1, startMinute: 60, endMinute: 120 };
    expect(overlaps([a, { ...a, startMinute: 119, endMinute: 180 }])).toBe(true);
    expect(overlaps([a, { ...a, startMinute: 120, endMinute: 180 }])).toBe(false);
    expect(overlaps([a, { ...a, weekday: 2 }])).toBe(false);
  });
});
