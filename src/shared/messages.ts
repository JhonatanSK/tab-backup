import type { Snapshot, Settings } from '../domain/model';
import type { RuntimeState } from '../storage/settings';
export interface Overview {
  snapshots: Snapshot[];
  settings: Settings;
  runtime: RuntimeState;
  usedBytes: number;
  budget: number;
  retention: number;
}
export type Command =
  | { type: 'overview' }
  | { type: 'backup' }
  | { type: 'restore'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'deleteAll' }
  | { type: 'settings'; automatic: boolean }
  | { type: 'onboard' }
  | { type: 'preview'; text: string }
  | { type: 'import'; text: string; revision: string };
export async function request<T>(command: Command): Promise<T> {
  const response = (await chrome.runtime.sendMessage(command)) as {
    ok: boolean;
    data: T;
    error?: string;
  };
  if (!response?.ok) throw new Error(response?.error || 'genericError');
  return response.data;
}
