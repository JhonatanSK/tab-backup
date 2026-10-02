import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
type Listener = (...args: unknown[]) => unknown;
function event() {
  const listeners: Listener[] = [];
  return {
    addListener: (listener: Listener) => listeners.push(listener),
    emit: (...args: unknown[]) => listeners.map((fn) => fn(...args)),
  };
}
function environment(
  local: Record<string, unknown> = {},
  alarms = new Map<string, unknown>(),
) {
  const tabEvents = {
    onCreated: event(),
    onRemoved: event(),
    onMoved: event(),
    onAttached: event(),
    onDetached: event(),
    onReplaced: event(),
    onUpdated: event(),
  };
  const api = {
    runtime: {
      id: 'test',
      getURL: (p: string) => `chrome-extension://test/${p}`,
      getManifest: () => ({ version: '1.0.0' }),
      openOptionsPage: vi.fn(async () => {}),
      onMessage: event(),
      onStartup: event(),
      onInstalled: event(),
    },
    tabs: tabEvents,
    windows: {
      getAll: vi.fn(async () => [
        {
          id: 1,
          focused: true,
          state: 'normal',
          tabs: [
            {
              url: 'https://example.com/background',
              pinned: false,
              index: 0,
              groupId: -1,
            },
          ],
        },
      ]),
      onCreated: event(),
      onRemoved: event(),
      onBoundsChanged: event(),
    },
    tabGroups: {
      query: async () => [],
      onCreated: event(),
      onUpdated: event(),
      onMoved: event(),
      onRemoved: event(),
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: structuredClone(local[key]) }),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(local, structuredClone(values));
        }),
        setAccessLevel: async () => {},
      },
    },
    alarms: {
      get: async (name: string) => alarms.get(name),
      create: async (name: string, info: unknown) => {
        alarms.set(name, info);
      },
      clear: async (name: string) => alarms.delete(name),
      onAlarm: event(),
    },
  };
  vi.stubGlobal('chrome', api);
  async function send(message: unknown) {
    return new Promise<{
      ok: boolean;
      data: { snapshots: { id: string }[] };
      error?: string;
    }>((resolve) => {
      api.runtime.onMessage.emit(
        message,
        { id: 'test', url: 'chrome-extension://test/options.html' },
        resolve,
      );
    });
  }
  return { api, send, local, alarms };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('coalesces events, survives worker restart and repairs pending capture without memory', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.resetModules();
  const env = environment();
  await import('../src/background/index');
  await env.send({ type: 'overview' });
  await env.send({ type: 'deleteAll' });
  for (let i = 0; i < 100; i++) env.api.tabs.onCreated.emit({});
  await env.send({ type: 'overview' });
  expect(env.alarms.has('tabbackup-change')).toBe(true);
  expect(
    (env.local.runtime as { pendingAt: number }).pendingAt,
  ).toBeGreaterThan(0);
  const writes = env.api.storage.local.set.mock.calls.length;
  expect(writes).toBeLessThan(10);
  // Dispose module state and timer, retaining only actual persistent stores.
  vi.clearAllTimers();
  vi.resetModules();
  env.alarms.delete('tabbackup-change');
  const restarted = environment(env.local, env.alarms);
  await import('../src/background/index');
  await restarted.send({ type: 'overview' });
  expect(restarted.alarms.has('tabbackup-change')).toBe(true);
  restarted.api.alarms.onAlarm.emit({ name: 'tabbackup-change' });
  const captured = await restarted.send({ type: 'overview' });
  expect(captured.data.snapshots).toHaveLength(1);
  restarted.api.alarms.onAlarm.emit({ name: 'tabbackup-safety' });
  expect(
    (await restarted.send({ type: 'overview' })).data.snapshots,
  ).toHaveLength(1);
  await restarted.send({ type: 'settings', automatic: false });
  restarted.api.tabs.onCreated.emit({});
  await vi.advanceTimersByTimeAsync(20000);
  expect(
    (await restarted.send({ type: 'overview' })).data.snapshots,
  ).toHaveLength(1);
  restarted.api.runtime.onInstalled.emit({ reason: 'update' });
  expect(
    (await restarted.send({ type: 'overview' })).data.snapshots,
  ).toHaveLength(1);
  expect(
    restarted.api.runtime.onMessage.emit(
      { type: 'deleteAll' },
      { id: 'other', url: 'https://example.com' },
      () => {},
    ),
  ).toEqual([false]);
});
it('marks a previously running restore interrupted on worker entry', async () => {
  vi.resetModules();
  const result = {
    tabs: 2,
    windows: 1,
    groups: 0,
    skipped: 0,
    failed: 0,
    warnings: 0,
    verified: 0,
  };
  const env = environment({ runtime: { restore: { running: true, result } } });
  await import('../src/background/index');
  await env.send({ type: 'overview' });
  expect(env.local.runtime).toMatchObject({
    restore: { running: false, result: { tabs: 2, interrupted: true } },
  });
});
