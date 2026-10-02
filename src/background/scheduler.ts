export const DEBOUNCE_MS = 3000,
  MAX_COALESCE_MS = 15000;
export function nextDeadline(first: number, now: number): number {
  return Math.min(now + DEBOUNCE_MS, first + MAX_COALESCE_MS);
}
export const CHANGE_ALARM = 'tabbackup-change',
  SAFETY_ALARM = 'tabbackup-safety';
