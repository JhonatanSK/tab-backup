import {
  COLORS,
  type Snapshot,
  type WindowSnapshot,
  type Reason,
} from '../domain/model';
import { sanitizeUrl } from '../domain/urls';
export async function capture(reason: Reason): Promise<Snapshot> {
  const [windows, groups] = await Promise.all([
    chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
    chrome.tabGroups.query({}),
  ]);
  const snapshots: WindowSnapshot[] = [];
  for (const w of windows) {
    if (w.incognito) continue;
    const tabs = (w.tabs || [])
      .filter(
        (t) => !t.incognito && !t.url?.startsWith(chrome.runtime.getURL('')),
      )
      .sort((a, b) => a.index - b.index);
    const refs = new Map<number, string>();
    const saved: WindowSnapshot['tabs'] = [];
    for (const t of tabs) {
      const url = sanitizeUrl(t.pendingUrl || t.url || '');
      if (!url) continue;
      const g = groups.find((g) => g.id === t.groupId && g.windowId === w.id);
      if (t.groupId !== -1 && !t.pinned && !g) throw new Error('captureError'); // race: retry instead of silently dropping grouping
      let groupRef: string | undefined;
      if (g && !t.pinned) {
        groupRef = refs.get(g.id) || `g${refs.size}`;
        refs.set(g.id, groupRef);
      }
      saved.push({
        url,
        title: (t.title || '').slice(0, 1024),
        pinned: t.pinned,
        index: saved.length,
        ...(groupRef ? { groupRef } : {}),
      });
    }
    if (!saved.length) continue;
    snapshots.push({
      focused: w.focused,
      state:
        w.state === 'minimized' ||
        w.state === 'maximized' ||
        w.state === 'fullscreen'
          ? w.state
          : 'normal',
      tabs: saved,
      groups: [...refs].map(([id, localId]) => {
        const g = groups.find((g) => g.id === id)!;
        return {
          localId,
          title: (g.title || '').slice(0, 512),
          color: COLORS.includes(g.color) ? g.color : 'grey',
          collapsed: g.collapsed,
        };
      }),
    });
  }
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    reason,
    extensionVersion: chrome.runtime.getManifest().version,
    windows: snapshots,
  };
}
