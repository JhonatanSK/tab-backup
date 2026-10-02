import type {
  Snapshot,
  RestoreResult,
  TabSnapshot,
  GroupSnapshot,
} from '../domain/model';
import { restorePlan } from './plan';
export const emptyResult = (): RestoreResult => ({
  tabs: 0,
  windows: 0,
  groups: 0,
  skipped: 0,
  failed: 0,
  warnings: 0,
  verified: 0,
});
export async function restore(
  snapshot: Snapshot,
  checkpoint: (result: RestoreResult) => Promise<void>,
): Promise<RestoreResult> {
  const plan = restorePlan(snapshot),
    result = { ...emptyResult(), skipped: plan.skipped };
  await checkpoint({ ...result });
  for (const w of plan.windows) {
    let windowId: number;
    let placeholder: number | undefined;
    try {
      const created = await chrome.windows.create({
        url: 'about:blank',
        focused: false,
        type: 'normal',
      });
      if (!created || created.id === undefined) throw new Error();
      windowId = created.id;
      placeholder = created.tabs?.[0]?.id;
      result.windows++;
    } catch {
      result.failed += w.tabs.length;
      await checkpoint({ ...result });
      continue;
    }
    const createdTabs: { id: number; tab: TabSnapshot }[] = [];
    for (const t of w.tabs) {
      try {
        const tab = await chrome.tabs.create({
          windowId,
          url: t.url,
          pinned: t.pinned,
          active: false,
        });
        if (tab.id === undefined) throw new Error();
        createdTabs.push({ id: tab.id, tab: t });
        result.tabs++;
      } catch {
        result.failed++;
      }
      // Persist after every API operation; interruption is reported, never silently replayed.
      await checkpoint({ ...result });
    }
    if (placeholder !== undefined && createdTabs.length) {
      try {
        await chrome.tabs.remove(placeholder);
      } catch {
        result.warnings++;
      }
    }
    const createdGroups: { id: number; group: GroupSnapshot }[] = [];
    for (const group of w.groups) {
      const ids = createdTabs
        .filter((t) => t.tab.groupRef === group.localId)
        .map((t) => t.id);
      if (!ids.length) continue;
      try {
        const id = await chrome.tabs.group({
          tabIds: ids as [number, ...number[]],
          createProperties: { windowId },
        });
        await chrome.tabGroups.update(id, {
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
        });
        createdGroups.push({ id, group });
        result.groups++;
      } catch {
        result.warnings++;
      }
      await checkpoint({ ...result });
    }
    try {
      await chrome.windows.update(windowId, { state: w.state });
    } catch {
      result.warnings++;
    }
    // Inspect browser structure immediately. Redirects/loading/policy races can cause mismatches.
    try {
      const observed = await chrome.tabs.query({ windowId });
      for (const [index, t] of createdTabs.entries()) {
        const actual = observed.find((o) => o.id === t.id);
        const g = createdGroups.find((g) => g.group.localId === t.tab.groupRef);
        if (
          actual &&
          (actual.pendingUrl || actual.url) === t.tab.url &&
          actual.pinned === t.tab.pinned &&
          actual.index === index &&
          (!t.tab.groupRef || actual.groupId === g?.id)
        )
          result.verified++;
        else result.warnings++;
      }
      for (const g of createdGroups) {
        const actual = await chrome.tabGroups.get(g.id);
        if (
          actual.title !== g.group.title ||
          actual.color !== g.group.color ||
          actual.collapsed !== g.group.collapsed
        )
          result.warnings++;
      }
      const actualWindow = await chrome.windows.get(windowId);
      if (actualWindow.state !== w.state) result.warnings++;
    } catch {
      result.warnings++;
    }
    await checkpoint({ ...result });
  }
  return result;
}
