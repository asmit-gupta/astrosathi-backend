/**
 * Placeholder until the consult sessions module exists (build step 5).
 * Spec §8.20: birth details can't change while a session is active, and
 * account deletion must wait for any live session to end.
 * TODO(sessions): return true when the user has a session in requested/connecting/active.
 */
export async function hasActiveConsultSession(_userId: string): Promise<boolean> {
  return false;
}
