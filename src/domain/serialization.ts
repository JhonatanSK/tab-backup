import type { BackupFile, Snapshot } from './model';
import { MAX_FILE_BYTES, invalid, integer, object, str } from './validation';
import { migrateSnapshot } from '../storage/migrations';
export async function digest(text: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export async function serialize(
  snapshots: Snapshot[],
  extensionVersion: string,
): Promise<string> {
  const body = {
    schemaVersion: 1 as const,
    metadata: {
      product: 'TabBackup' as const,
      exportedAt: Date.now(),
      extensionVersion,
    },
    snapshots,
  };
  return JSON.stringify({
    ...body,
    checksum: await digest(JSON.stringify(body)),
  });
}
export async function parseBackup(text: string): Promise<BackupFile> {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) return invalid();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return invalid();
  }
  const o = object(raw);
  if (
    Object.keys(o).some(
      (k) =>
        !['schemaVersion', 'metadata', 'snapshots', 'checksum'].includes(k),
    ) ||
    o.schemaVersion !== 1
  )
    return invalid();
  const meta = object(o.metadata);
  if (
    Object.keys(meta).some(
      (k) => !['product', 'exportedAt', 'extensionVersion'].includes(k),
    ) ||
    meta.product !== 'TabBackup'
  )
    return invalid();
  if (!Array.isArray(o.snapshots) || o.snapshots.length > 100) return invalid();
  const body = {
    schemaVersion: 1,
    metadata: o.metadata,
    snapshots: o.snapshots,
  };
  if (str(o.checksum, 64) !== (await digest(JSON.stringify(body))))
    return invalid();
  const snapshots = o.snapshots.map(migrateSnapshot);
  if (snapshots.some((s) => s.createdAt > Date.now())) return invalid();
  if (
    snapshots.reduce(
      (n, s) => n + s.windows.reduce((n, w) => n + w.tabs.length, 0),
      0,
    ) > 100000
  )
    return invalid();
  const ids = new Set(snapshots.map((s) => s.id));
  if (ids.size !== snapshots.length) return invalid();
  return {
    schemaVersion: 1,
    metadata: {
      product: 'TabBackup',
      exportedAt: integer(meta.exportedAt, 8640000000000000),
      extensionVersion: str(meta.extensionVersion, 50),
    },
    snapshots,
    checksum: str(o.checksum, 64),
  };
}
export function exportFilename(date = new Date()): string {
  return `tabbackup-${date.toISOString().slice(0, 10)}-${date.toISOString().slice(11, 16).replace(':', '')}.tabbackup.json`;
}
