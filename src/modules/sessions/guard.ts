import { hasOpenConsult } from '../consults/consults.service';

/**
 * Spec §8.20: birth details can't change while a consult is open, and
 * account deletion must wait for any open consult to end.
 */
export async function hasActiveConsultSession(userId: string): Promise<boolean> {
  return hasOpenConsult(userId);
}
