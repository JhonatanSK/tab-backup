export const SCHEMA_VERSION = 1 as const;
export const COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;
export type GroupColor = (typeof COLORS)[number];
export type Reason =
  'automatic-change' | 'periodic' | 'browser-start' | 'manual';
export interface TabSnapshot {
  url: string;
  title?: string;
  pinned: boolean;
  index: number;
  groupRef?: string;
}
export interface GroupSnapshot {
  localId: string;
  title: string;
  color: GroupColor;
  collapsed: boolean;
}
export interface WindowSnapshot {
  focused: boolean;
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen';
  tabs: TabSnapshot[];
  groups: GroupSnapshot[];
}
export interface Snapshot {
  schemaVersion: 1;
  id: string;
  createdAt: number;
  reason: Reason;
  extensionVersion: string;
  windows: WindowSnapshot[];
}
export interface BackupFile {
  schemaVersion: 1;
  metadata: {
    product: 'TabBackup';
    exportedAt: number;
    extensionVersion: string;
  };
  snapshots: Snapshot[];
  checksum: string;
}
export interface Settings {
  automatic: boolean;
  onboarded: boolean;
}
export interface RestoreResult {
  tabs: number;
  windows: number;
  groups: number;
  skipped: number;
  failed: number;
  warnings: number;
  verified: number;
  interrupted?: boolean;
}
export function counts(s: Snapshot) {
  return {
    windows: s.windows.length,
    tabs: s.windows.reduce((n, w) => n + w.tabs.length, 0),
    groups: s.windows.reduce((n, w) => n + w.groups.length, 0),
  };
}
