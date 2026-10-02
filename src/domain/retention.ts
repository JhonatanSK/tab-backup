import type { Snapshot } from './model';
export function retained(snapshots: Snapshot[], limit: number): Snapshot[] {
  return [...snapshots]
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}
export function bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
