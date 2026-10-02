import type { Snapshot, WindowSnapshot } from './model';
// Runtime window/group IDs, focus changes and page-title churn do not create history entries.
export function semanticState(windows: WindowSnapshot[]): string {
  return JSON.stringify(
    windows
      .map((w) => {
        const refs = new Map<string, number>();
        for (const t of w.tabs)
          if (t.groupRef && !refs.has(t.groupRef))
            refs.set(t.groupRef, refs.size);
        return {
          state: w.state,
          tabs: [...w.tabs]
            .sort((a, b) => a.index - b.index)
            .map((t) => ({
              url: t.url,
              pinned: t.pinned,
              group: t.groupRef ? refs.get(t.groupRef) : null,
            })),
          groups: [...refs].map(([id, ref]) => {
            const g = w.groups.find((g) => g.localId === id);
            return {
              ref,
              title: g?.title,
              color: g?.color,
              collapsed: g?.collapsed,
            };
          }),
        };
      })
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}
export function equivalent(a: Snapshot, b: Snapshot): boolean {
  return semanticState(a.windows) === semanticState(b.windows);
}
