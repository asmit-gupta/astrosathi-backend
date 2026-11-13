/**
 * Single source of "now" for the server. Billing and auth rules depend on server
 * time only (spec §8.20), and tests replace this with a controllable clock.
 */
let override: (() => Date) | null = null;

export const clock = {
  now(): Date {
    return override ? override() : new Date();
  },
  /** Test-only: pin or advance time. Pass null to restore the real clock. */
  set(fn: (() => Date) | null): void {
    override = fn;
  },
};

export const addSeconds = (d: Date, s: number): Date => new Date(d.getTime() + s * 1000);
