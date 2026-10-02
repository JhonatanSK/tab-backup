import {
  COLORS,
  type Snapshot,
  type WindowSnapshot,
  type TabSnapshot,
  type GroupSnapshot,
} from './model';
import { sanitizeUrl } from './urls';
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export function invalid(): never {
  throw new Error('invalidBackup');
}
export function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid();
  const o = v as Record<string, unknown>;
  if (
    Object.keys(o).some((k) =>
      ['__proto__', 'prototype', 'constructor'].includes(k),
    )
  )
    return invalid();
  return o;
}
function keys(o: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(o).some((k) => !allowed.includes(k))) invalid();
}
export function str(v: unknown, max = 512): string {
  if (typeof v !== 'string' || v.length > max) return invalid();
  return v;
}
function bool(v: unknown): boolean {
  if (typeof v !== 'boolean') return invalid();
  return v;
}
export function integer(v: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max)
    return invalid();
  return v;
}
function array(v: unknown, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) return invalid();
  return v;
}
function group(value: unknown): GroupSnapshot {
  const g = object(value);
  keys(g, ['localId', 'title', 'color', 'collapsed']);
  const color = str(g.color);
  if (!(COLORS as readonly string[]).includes(color)) return invalid();
  return {
    localId: str(g.localId, 100),
    title: str(g.title),
    color: color as GroupSnapshot['color'],
    collapsed: bool(g.collapsed),
  };
}
function tab(value: unknown): TabSnapshot {
  const t = object(value);
  keys(t, ['url', 'title', 'pinned', 'index', 'groupRef']);
  const url = sanitizeUrl(str(t.url, 8192));
  if (!url) return invalid();
  return {
    url,
    pinned: bool(t.pinned),
    index: integer(t.index, 4999),
    ...(t.title !== undefined ? { title: str(t.title, 1024) } : {}),
    ...(t.groupRef !== undefined ? { groupRef: str(t.groupRef, 100) } : {}),
  };
}
function windowSnapshot(value: unknown): WindowSnapshot {
  const w = object(value);
  keys(w, ['focused', 'state', 'tabs', 'groups']);
  const state = str(w.state);
  if (!['normal', 'minimized', 'maximized', 'fullscreen'].includes(state))
    return invalid();
  const tabs = array(w.tabs, 5000).map(tab),
    groups = array(w.groups, 1000).map(group);
  const ids = new Set(groups.map((g) => g.localId));
  if (
    ids.size !== groups.length ||
    tabs.some(
      (t, i) =>
        t.index !== i || (t.groupRef && (!ids.has(t.groupRef) || t.pinned)),
    )
  )
    return invalid();
  let unpinned = false;
  const closedGroups = new Set<string>();
  let lastGroup: string | undefined;
  for (const t of tabs) {
    if (t.pinned && unpinned) invalid();
    if (!t.pinned) unpinned = true;
    if (t.groupRef !== lastGroup) {
      if (lastGroup) closedGroups.add(lastGroup);
      if (t.groupRef && closedGroups.has(t.groupRef)) invalid();
      lastGroup = t.groupRef;
    }
  }
  if (groups.some((g) => !tabs.some((t) => t.groupRef === g.localId)))
    return invalid();
  return {
    focused: bool(w.focused),
    state: state as WindowSnapshot['state'],
    tabs,
    groups,
  };
}
export function validateSnapshot(value: unknown): Snapshot {
  const s = object(value);
  keys(s, [
    'schemaVersion',
    'id',
    'createdAt',
    'reason',
    'extensionVersion',
    'windows',
  ]);
  if (s.schemaVersion !== 1) return invalid();
  const id = str(s.id, 100);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return invalid();
  const reason = str(s.reason);
  if (
    !['automatic-change', 'periodic', 'browser-start', 'manual'].includes(
      reason,
    )
  )
    return invalid();
  const windows = array(s.windows, 100).map(windowSnapshot);
  if (windows.reduce((n, w) => n + w.tabs.length, 0) > 5000) return invalid();
  return {
    schemaVersion: 1,
    id,
    createdAt: integer(s.createdAt, 8640000000000000),
    reason: reason as Snapshot['reason'],
    extensionVersion: str(s.extensionVersion, 50),
    windows,
  };
}
