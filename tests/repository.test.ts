import 'fake-indexeddb/auto';
import { it, expect, vi } from 'vitest';
import { Repository, mergePlan } from '../src/storage/repository';
import { snapshot } from './fixtures';
import { entitlements } from '../src/domain/entitlement';
it('persists, deduplicates, survives reopening, applies retention and deletes', async () => {
  const name = crypto.randomUUID();
  const repo = new Repository(name);
  expect(await repo.save(snapshot())).toBe(true);
  expect(await repo.save({ ...snapshot(), id: 'duplicate' })).toBe(false);
  for (let i = 0; i < 24; i++) {
    const s = snapshot(`s${i}`);
    s.createdAt += i + 1;
    s.windows[0]!.tabs[0]!.url += `?v=${i}`;
    await repo.save(s);
  }
  const reopened = new Repository(name);
  expect(await reopened.list()).toHaveLength(20);
  expect((await reopened.list())[0]!.id).toBe('s23');
  await reopened.delete('s23');
  expect(await reopened.list()).toHaveLength(19);
  await reopened.clear();
  expect(await reopened.list()).toEqual([]);
});
it('atomically preserves original records when the storage budget fails', async () => {
  const name = crypto.randomUUID();
  const good = new Repository(name);
  await good.save(snapshot());
  const small = new Repository(name, {
    get: () => ({ ...entitlements.get(), maxBytes: 1 }),
  });
  const changed = snapshot('new');
  changed.windows[0]!.tabs[0]!.url += '?new';
  await expect(small.save(changed)).rejects.toThrow('quotaError');
  expect((await good.list()).map((s) => s.id)).toEqual(['test']);
});
it('merges ID conflicts without overwriting originals', async () => {
  const repo = new Repository(crypto.randomUUID());
  await repo.save(snapshot());
  const changed = snapshot();
  changed.windows[0]!.tabs[0]!.url += '?new';
  expect((await repo.preview([snapshot(), changed])).collisions).toBe(1);
  const result = await repo.merge([snapshot(), changed]);
  expect(result).toMatchObject({ added: 1, duplicates: 1, collisions: 1 });
  expect(await repo.list()).toHaveLength(2);
});
it('makes retention loss visible before importing older files', () => {
  const current = Array.from({ length: 20 }, (_, i) => ({
    ...snapshot(String(i)),
    createdAt: 200 + i,
  }));
  const older = { ...snapshot('old'), createdAt: 100 };
  expect(mergePlan(current, [older], 20).result).toMatchObject({
    added: 0,
    removed: 1,
  });
});
it('rejects a bad migration without deleting original data', async () => {
  const name = crypto.randomUUID();
  const repo = new Repository(name);
  await repo.save(snapshot());
  const db = await new Promise<IDBDatabase>((resolve) => {
    const r = indexedDB.open(name);
    r.onsuccess = () => resolve(r.result);
  });
  await new Promise<void>((resolve) => {
    const tx = db.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put({
      ...snapshot('future'),
      schemaVersion: 2,
    });
    tx.oncomplete = () => resolve();
  });
  db.close();
  await expect(repo.list()).rejects.toThrow('migrationError');
  await expect(repo.clear()).rejects.toThrow('migrationError');
  const reopened = await new Promise<IDBDatabase>((resolve) => {
    const r = indexedDB.open(name);
    r.onsuccess = () => resolve(r.result);
  });
  const count = await new Promise<number>((resolve) => {
    const r = reopened
      .transaction('snapshots')
      .objectStore('snapshots')
      .count();
    r.onsuccess = () => resolve(r.result);
  });
  expect(count).toBe(2);
  reopened.close();
});
it('rejects a stale import preview atomically', async () => {
  const repo = new Repository(crypto.randomUUID());
  await repo.save(snapshot());
  const preview = await repo.preview([snapshot('incoming')]);
  const changed = snapshot('changed');
  changed.createdAt++;
  changed.windows[0]!.tabs[0]!.url += '?change';
  await repo.save(changed);
  await expect(
    repo.merge([snapshot('incoming')], preview.revision),
  ).rejects.toThrow('previewChanged');
  expect((await repo.list()).map((s) => s.id)).toEqual(['changed', 'test']);
});

it('does not rewrite stored records when a snapshot is unchanged', async () => {
  const repo = new Repository(crypto.randomUUID());
  await repo.save(snapshot());
  const spy = vi.spyOn(IDBObjectStore.prototype, 'add');
  try {
    expect(await repo.save(snapshot('same-state'))).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});
