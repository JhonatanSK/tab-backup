import type { Snapshot } from '../domain/model';
import { canRestore } from '../domain/urls';
export function restorePlan(snapshot: Snapshot) {
  let skipped = 0;
  const windows = snapshot.windows
    .map((w) => ({
      ...w,
      tabs: w.tabs.filter((t) => {
        const ok = canRestore(t.url);
        if (!ok) skipped++;
        return ok;
      }),
    }))
    .filter((w) => w.tabs.length);
  return { windows, skipped };
}
