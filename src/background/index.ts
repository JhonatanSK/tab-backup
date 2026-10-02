import { capture } from './builder';
import { CHANGE_ALARM, SAFETY_ALARM, nextDeadline } from './scheduler';
import { repository } from '../storage/repository';
import { settings, state, patchState } from '../storage/settings';
import { entitlements } from '../domain/entitlement';
import { bytes } from '../domain/retention';
import { parseBackup } from '../domain/serialization';
import { MAX_FILE_BYTES } from '../domain/validation';
import { restore } from '../restore/engine';
import { logger } from '../shared/logger';
import type { Reason } from '../domain/model';

let queue = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
let timer: ReturnType<typeof setTimeout> | undefined;
let firstChange = 0;
let generation = 0;
let restoring = false;
const safeErrors = [
  'invalidBackup',
  'storageError',
  'migrationError',
  'quotaError',
  'captureError',
  'emptyBackup',
  'busy',
  'previewChanged',
];
function safeError(e: unknown): string {
  return e instanceof Error && safeErrors.includes(e.message)
    ? e.message
    : 'genericError';
}
async function recordError(e: unknown) {
  logger.error('background');
  try {
    await patchState({ error: safeError(e) });
  } catch {
    /* Storage may be unavailable; next explicit action reports failure. */
  }
}
function background(fn: () => Promise<unknown>) {
  void serial(async () => {
    try {
      await ready;
      await fn();
    } catch (error) {
      await recordError(error);
    }
  });
}
async function ensureAlarms() {
  if (!(await chrome.alarms.get(SAFETY_ALARM)))
    await chrome.alarms.create(SAFETY_ALARM, { periodInMinutes: 15 });
  const pending = (await state()).pendingAt;
  if (pending && !(await chrome.alarms.get(CHANGE_ALARM)))
    await chrome.alarms.create(CHANGE_ALARM, {
      when: Math.max(Date.now() + 30000, pending),
    });
}
async function backup(reason: Reason) {
  if (restoring) throw new Error('busy');
  const before = generation;
  const snapshot = await capture(reason);
  if (generation !== before) {
    await schedule();
    throw new Error('captureError');
  }
  if (!snapshot.windows.length) {
    await patchState({ pendingAt: 0 });
    await chrome.alarms.clear(CHANGE_ALARM);
    if (reason === 'manual') throw new Error('emptyBackup');
    return false;
  }
  const created = await repository.save(snapshot);
  await patchState({ pendingAt: 0, lastChecked: Date.now(), error: '' });
  firstChange = 0;
  await chrome.alarms.clear(CHANGE_ALARM);
  return created;
}
async function schedule() {
  if (!(await settings()).automatic || restoring) return;
  const now = Date.now();
  if (!firstChange) firstChange = now;
  const deadline = nextDeadline(firstChange, now);
  // Persist before arming volatile timer; permanent 15-minute alarm repairs interrupted scheduling.
  await patchState({ pendingAt: deadline });
  if (!(await chrome.alarms.get(CHANGE_ALARM)))
    await chrome.alarms.create(CHANGE_ALARM, { when: now + 30000 });
  clearTimeout(timer);
  timer = setTimeout(
    () =>
      background(async () => {
        if ((await settings()).automatic) await backup('automatic-change');
      }),
    Math.max(0, deadline - Date.now()),
  );
}
let scheduleQueued = false;
function changed() {
  generation++;
  if (restoring || scheduleQueued) return;
  scheduleQueued = true;
  background(async () => {
    try {
      await schedule();
    } finally {
      scheduleQueued = false;
    }
  });
}
// All listeners registered at module evaluation, before any asynchronous initialization.
chrome.tabs.onCreated.addListener(changed);
chrome.tabs.onRemoved.addListener(changed);
chrome.tabs.onMoved.addListener(changed);
chrome.tabs.onAttached.addListener(changed);
chrome.tabs.onDetached.addListener(changed);
chrome.tabs.onReplaced.addListener(changed);
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (
    info.url !== undefined ||
    info.pinned !== undefined ||
    info.groupId !== undefined
  )
    changed();
});
chrome.windows.onCreated.addListener(changed);
chrome.windows.onRemoved.addListener(changed);
chrome.windows.onBoundsChanged.addListener(changed);
chrome.tabGroups.onCreated.addListener(changed);
chrome.tabGroups.onUpdated.addListener(changed);
chrome.tabGroups.onMoved.addListener(changed);
chrome.tabGroups.onRemoved.addListener(changed);
chrome.runtime.onStartup.addListener(() =>
  background(async () => {
    await ensureAlarms();
    if ((await settings()).automatic) await backup('browser-start');
  }),
);
chrome.runtime.onInstalled.addListener((details) =>
  background(async () => {
    await ensureAlarms();
    if (details.reason === 'install') await chrome.runtime.openOptionsPage();
    if ((await settings()).automatic) await backup('browser-start');
  }),
);
chrome.alarms.onAlarm.addListener((alarm) =>
  background(async () => {
    if (![CHANGE_ALARM, SAFETY_ALARM].includes(alarm.name)) return;
    if ((await settings()).automatic)
      await backup(
        alarm.name === CHANGE_ALARM ? 'automatic-change' : 'periodic',
      );
  }),
);
async function handle(raw: unknown): Promise<unknown> {
  if (!raw || typeof raw !== 'object') throw new Error('invalidBackup');
  const command = raw as Record<string, unknown>;
  switch (command.type) {
    case 'overview': {
      const snapshots = await repository.list();
      return {
        snapshots,
        settings: await settings(),
        runtime: await state(),
        usedBytes: bytes(snapshots),
        budget: entitlements.get().maxBytes,
        retention: entitlements.get().maxSnapshots,
      };
    }
    case 'backup':
      return backup('manual');
    case 'settings': {
      if (typeof command.automatic !== 'boolean')
        throw new Error('invalidBackup');
      await chrome.storage.local.set({
        settings: { ...(await settings()), automatic: command.automatic },
      });
      if (command.automatic) await schedule();
      else {
        clearTimeout(timer);
        firstChange = 0;
        await patchState({ pendingAt: 0 });
        await chrome.alarms.clear(CHANGE_ALARM);
      }
      return true;
    }
    case 'onboard':
      await chrome.storage.local.set({
        settings: { ...(await settings()), onboarded: true },
      });
      return true;
    case 'delete':
      if (typeof command.id !== 'string') throw new Error('invalidBackup');
      await repository.delete(command.id);
      return true;
    case 'deleteAll':
      await repository.clear();
      await patchState({ lastChecked: 0, error: '' });
      return true;
    case 'preview':
    case 'import': {
      if (
        typeof command.text !== 'string' ||
        command.text.length > MAX_FILE_BYTES
      )
        throw new Error('invalidBackup');
      const file = await parseBackup(command.text);
      if (command.type === 'preview')
        return { file, merge: await repository.preview(file.snapshots) };
      if (typeof command.revision !== 'string')
        throw new Error('previewChanged');
      return repository.merge(file.snapshots, command.revision);
    }
    case 'restore': {
      const snapshot = (await repository.list()).find(
        (s) => s.id === command.id,
      );
      if (!snapshot) throw new Error('invalidBackup');
      restoring = true;
      clearTimeout(timer);
      try {
        const result = await restore(snapshot, async (result) =>
          patchState({ restore: { running: true, result } }),
        );
        await patchState({ restore: { running: false, result } });
        return result;
      } catch (e) {
        const saved = (await state()).restore;
        if (saved)
          await patchState({
            restore: {
              running: false,
              result: { ...saved.result, interrupted: true },
            },
          });
        throw e;
      } finally {
        restoring = false;
        firstChange = 0;
        await schedule();
      }
    }
    default:
      throw new Error('invalidBackup');
  }
}
chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
  const own = chrome.runtime.getURL('');
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url ||
    !['popup.html', 'options.html'].some(
      (p) => sender.url!.split(/[?#]/)[0] === own + p,
    )
  )
    return false;
  void serial(async () => {
    try {
      await ready;
      return { ok: true, data: await handle(raw) };
    } catch (error) {
      logger.error('message');
      const code = safeError(error);
      if (
        [
          'storageError',
          'migrationError',
          'quotaError',
          'captureError',
        ].includes(code)
      )
        await recordError(error);
      return { ok: false, error: code };
    }
  }).then(respond);
  return true;
});
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({
    accessLevel: 'TRUSTED_CONTEXTS',
  });
  const current = await state();
  if (current.restore?.running)
    await patchState({
      restore: {
        running: false,
        result: { ...current.restore.result, interrupted: true },
      },
    });
  await ensureAlarms();
})();
void ready.catch(recordError);
