import { describe, it, expect } from 'vitest';
import { snapshot } from './fixtures';
import { equivalent } from '../src/domain/normalize';
import { sanitizeUrl, canRestore } from '../src/domain/urls';
import { retained } from '../src/domain/retention';
import {
  serialize,
  parseBackup,
  digest,
  exportFilename,
} from '../src/domain/serialization';
import { migrateSnapshot } from '../src/storage/migrations';
import { restorePlan } from '../src/restore/plan';
import { entitlements } from '../src/domain/entitlement';
import { nextDeadline } from '../src/background/scheduler';
import { validateSnapshot, MAX_FILE_BYTES } from '../src/domain/validation';

describe('normalization and retention', () => {
  it('ignores identity, focus and page titles, preserves meaningful URL/order/pin changes', () => {
    const a = snapshot(),
      b = structuredClone(a);
    b.id = 'other';
    b.createdAt++;
    b.windows[0]!.focused = false;
    b.windows[0]!.tabs[0]!.title = 'new';
    expect(equivalent(a, b)).toBe(true);
    b.windows[0]!.tabs[0]!.pinned = false;
    expect(equivalent(a, b)).toBe(false);
    b.windows[0]!.tabs[0]!.pinned = true;
    b.windows[0]!.tabs[0]!.url += '?changed=1';
    expect(equivalent(a, b)).toBe(false);
  });
  it('normalizes group refs but detects metadata', () => {
    const a = snapshot();
    a.windows[0]!.groups = [
      { localId: 'g7', title: 'Work', color: 'blue', collapsed: false },
    ];
    a.windows[0]!.tabs[1]!.groupRef = 'g7';
    const b = structuredClone(a);
    b.windows[0]!.groups[0]!.localId = 'g22';
    b.windows[0]!.tabs[1]!.groupRef = 'g22';
    expect(equivalent(a, b)).toBe(true);
    b.windows[0]!.groups[0]!.collapsed = true;
    expect(equivalent(a, b)).toBe(false);
  });
  it('keeps newest 20 without mutating inputs', () => {
    const all = Array.from({ length: 25 }, (_, i) => ({
      ...snapshot(String(i)),
      createdAt: i,
    }));
    expect(retained(all, 20).map((s) => s.createdAt)).toEqual(
      Array.from({ length: 20 }, (_, i) => 24 - i),
    );
    expect(all).toHaveLength(25);
  });
  it('centralizes free entitlements', () => {
    expect(entitlements.get().maxSnapshots).toBe(20);
    expect(entitlements.get().favorites).toBe(false);
  });
  it('bounds debounce during a continuous burst', () => {
    expect(nextDeadline(1000, 2000)).toBe(5000);
    expect(nextDeadline(1000, 15000)).toBe(16000);
  });
});
describe('untrusted files and URLs', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'blob:https://example.com/a',
    'not a url',
    'https://example.com/\nfoo',
  ])('rejects %s', (url) => {
    expect(sanitizeUrl(url)).toBeNull();
    expect(canRestore(url)).toBe(false);
  });
  it('redacts credentials and recognizable auth values', () => {
    expect(
      sanitizeUrl(
        'https://user:pass@example.com/?token=secret&q=work#access_token=x',
      ),
    ).toBe('https://example.com/?q=work');
  });
  it.each([
    'chrome://settings/',
    'chrome-extension://abc/index.html',
    'file:///secret.txt',
  ])('stores metadata but skips %s', (url) => {
    expect(sanitizeUrl(url)).toBe(url);
    expect(canRestore(url)).toBe(false);
  });
  it('plans safe restore with exact skip count', () => {
    const s = snapshot();
    s.windows[0]!.tabs[1]!.url = 'chrome://settings/';
    expect(restorePlan(s).skipped).toBe(1);
    expect(restorePlan(s).windows[0]!.tabs).toHaveLength(2);
  });
  it('roundtrips with checksum and v1 migration', async () => {
    const s = snapshot();
    expect(
      (await parseBackup(await serialize([s], '1.0.0'))).snapshots,
    ).toEqual([s]);
    expect(migrateSnapshot(s)).toEqual(s);
  });
  it('rejects malformed/corrupt/future/legacy formats', async () => {
    await expect(parseBackup('{broken')).rejects.toThrow();
    const text = await serialize([snapshot()], '1.0.0');
    await expect(
      parseBackup(text.replace('Page 0', 'Altered')),
    ).rejects.toThrow();
    for (const schemaVersion of [0, 2, undefined])
      expect(() => migrateSnapshot({ ...snapshot(), schemaVersion })).toThrow();
  });
  it('rejects duplicate IDs', async () => {
    await expect(
      parseBackup(await serialize([snapshot(), snapshot()], '1.0.0')),
    ).rejects.toThrow();
  });
  it('rejects malicious properties with a valid hash', async () => {
    const body = JSON.parse(await serialize([snapshot()], '1.0.0'));
    body.snapshots[0].windows[0].tabs[0] = JSON.parse(
      '{"__proto__":{"polluted":true}}',
    );
    delete body.checksum;
    body.checksum = await digest(JSON.stringify(body));
    await expect(parseBackup(JSON.stringify(body))).rejects.toThrow();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
  it('rejects files larger than the byte limit', async () => {
    await expect(parseBackup(' '.repeat(MAX_FILE_BYTES + 1))).rejects.toThrow();
  });
  it('rejects noncontiguous groups, pinned grouping and dangling refs', () => {
    const s = snapshot();
    s.windows[0]!.tabs[0]!.groupRef = 'missing';
    expect(() => validateSnapshot(s)).toThrow();
  });
  it('uses UTC, portable export names', () => {
    expect(exportFilename(new Date('2026-10-02T12:34:00Z'))).toBe(
      'tabbackup-2026-10-02-1234.tabbackup.json',
    );
  });
});
it('rejects future-dated imports that could prevent normal history retention', async () => {
  await expect(
    parseBackup(
      await serialize(
        [{ ...snapshot(), createdAt: Date.now() + 3600000 }],
        '1.0.0',
      ),
    ),
  ).rejects.toThrow();
});
it('can re-import an exported history with more than 25,000 tabs', async () => {
  const history = Array.from({ length: 20 }, (_, i) =>
    snapshot(`roundtrip-${i}`, 1300),
  );
  const text = await serialize(history, '1.0.0');
  expect(new TextEncoder().encode(text).length).toBeLessThan(MAX_FILE_BYTES);
  expect((await parseBackup(text)).snapshots).toHaveLength(20);
});
