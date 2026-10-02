import { validateSnapshot, object, invalid } from '../../domain/validation';
import type { Snapshot } from '../../domain/model';
// v1 is the first shipped format. Never guess at legacy/future formats or mutate originals.
export function migrateSnapshot(raw: unknown): Snapshot {
  const version = object(raw).schemaVersion;
  switch (version) {
    case 1:
      return validateSnapshot(raw);
    default:
      return invalid();
  }
}
export function upgradeDatabase(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion === 0) db.createObjectStore('snapshots', { keyPath: 'id' });
}
