import type { Settings, RestoreResult } from '../domain/model';
export interface RuntimeState {
  pendingAt?: number;
  lastChecked?: number;
  error?: string;
  restore?: { running: boolean; result: RestoreResult };
}
export async function settings(): Promise<Settings> {
  const data = await chrome.storage.local.get('settings');
  const s = data.settings as Partial<Settings> | undefined;
  return {
    automatic: s?.automatic !== false,
    onboarded: s?.onboarded === true,
  };
}
export async function state(): Promise<RuntimeState> {
  return (
    ((await chrome.storage.local.get('runtime')).runtime as RuntimeState) || {}
  );
}
export async function patchState(patch: Partial<RuntimeState>): Promise<void> {
  await chrome.storage.local.set({ runtime: { ...(await state()), ...patch } });
}
