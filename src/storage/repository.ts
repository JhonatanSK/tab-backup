import type { Snapshot } from '../domain/model';
import { equivalent } from '../domain/normalize';
import { retained, bytes } from '../domain/retention';
import { entitlements, type EntitlementProvider } from '../domain/entitlement';
import { migrateSnapshot, upgradeDatabase } from './migrations';
export interface MergeResult {
  added: number;
  duplicates: number;
  collisions: number;
  removed: number;
  revision?: string;
}
export function revision(snapshots: Snapshot[]): string {
  return snapshots
    .map((s) => s.id)
    .sort()
    .join('|');
}
export function mergePlan(
  existing: Snapshot[],
  incoming: Snapshot[],
  limit: number,
): { snapshots: Snapshot[]; result: MergeResult } {
  const merged = [...existing];
  let duplicates = 0,
    collisions = 0;
  for (const source of incoming) {
    const same = merged.find((s) => s.id === source.id);
    if (
      same &&
      JSON.stringify(migrateSnapshot(same)) ===
        JSON.stringify(migrateSnapshot(source))
    ) {
      duplicates++;
      continue;
    }
    if (same) collisions++;
    merged.push(same ? { ...source, id: crypto.randomUUID() } : source);
  }
  const snapshots = retained(merged, limit);
  return {
    snapshots,
    result: {
      added: snapshots.filter((s) => !existing.some((e) => e.id === s.id))
        .length,
      duplicates,
      collisions,
      removed: merged.length - snapshots.length,
    },
  };
}
export class Repository {
  constructor(
    private name = 'tabbackup-v1',
    private provider: EntitlementProvider = entitlements,
  ) {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(this.name, 1);
      r.onupgradeneeded = (e) => upgradeDatabase(r.result, e.oldVersion);
      r.onsuccess = () => {
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => reject(new Error('storageError'));
      r.onblocked = () => reject(new Error('storageError'));
    });
  }
  async list(): Promise<Snapshot[]> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readonly');
        const r = tx.objectStore('snapshots').getAll();
        r.onsuccess = () => {
          try {
            resolve(
              retained(
                (r.result as unknown[]).map(migrateSnapshot),
                Number.MAX_SAFE_INTEGER,
              ),
            );
          } catch {
            reject(new Error('migrationError'));
          }
        };
        r.onerror = () => reject(new Error('storageError'));
      });
    } finally {
      db.close();
    }
  }
  private async change<T>(
    fn: (current: Snapshot[]) => { snapshots: Snapshot[]; result: T },
  ): Promise<T> {
    const db = await this.open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite', {
            durability: 'strict',
          }),
          store = tx.objectStore('snapshots');
        let result: T;
        let error = 'storageError';
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(new Error(error));
        tx.onerror = () => {
          /* onabort reports safe error, never record contents */
        };
        const read = store.getAll();
        read.onsuccess = () => {
          try {
            let current: Snapshot[];
            try {
              current = (read.result as unknown[]).map(migrateSnapshot);
            } catch {
              error = 'migrationError';
              tx.abort();
              return;
            }
            const next = fn(retained(current, Number.MAX_SAFE_INTEGER));
            if (bytes(next.snapshots) > this.provider.get().maxBytes) {
              error = 'quotaError';
              tx.abort();
              return;
            }
            result = next.result;
            // Snapshot writes and deletion of expired records commit atomically, or all roll back.
            const existingIds = new Set(current.map((s) => s.id));
            for (const s of next.snapshots)
              if (!existingIds.has(s.id)) store.add(s);
            const ids = new Set(next.snapshots.map((s) => s.id));
            for (const s of current) if (!ids.has(s.id)) store.delete(s.id);
          } catch (e) {
            if (
              e instanceof Error &&
              ['previewChanged', 'invalidBackup'].includes(e.message)
            )
              error = e.message;
            tx.abort();
          }
        };
      });
    } finally {
      db.close();
    }
  }
  async save(snapshot: Snapshot): Promise<boolean> {
    const valid = migrateSnapshot(snapshot);
    return this.change((current) => {
      if (current[0] && equivalent(current[0], valid))
        return { snapshots: current, result: false };
      if (current.some((s) => s.id === valid.id))
        throw new Error('invalidBackup');
      return {
        snapshots: retained(
          [valid, ...current],
          this.provider.get().maxSnapshots,
        ),
        result: true,
      };
    });
  }
  async preview(incoming: Snapshot[]): Promise<MergeResult> {
    const current = await this.list();
    return {
      ...mergePlan(current, incoming, this.provider.get().maxSnapshots).result,
      revision: revision(current),
    };
  }
  async merge(
    incoming: Snapshot[],
    expectedRevision?: string,
  ): Promise<MergeResult> {
    const valid = incoming.map(migrateSnapshot);
    return this.change((current) => {
      if (
        expectedRevision !== undefined &&
        revision(current) !== expectedRevision
      )
        throw new Error('previewChanged');
      return mergePlan(current, valid, this.provider.get().maxSnapshots);
    });
  }
  async delete(id: string): Promise<void> {
    return this.change((current) => ({
      snapshots: current.filter((s) => s.id !== id),
      result: undefined,
    }));
  }
  async clear(): Promise<void> {
    return this.change(() => ({ snapshots: [], result: undefined }));
  }
}
export const repository = new Repository();
