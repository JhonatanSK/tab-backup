import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { mkdtemp, rm, mkdir, writeFile, cp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import type { Overview } from '../../src/shared/messages';
import type { RestoreResult } from '../../src/domain/model';
import { snapshot } from '../fixtures';
import { serialize } from '../../src/domain/serialization';
const extension = resolve('dist/chrome');
async function launch(profile: string, unpacked = extension) {
  return chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 800 },
    args: [
      '--lang=en-US',
      `--disable-extensions-except=${unpacked}`,
      `--load-extension=${unpacked}`,
    ],
  });
}
async function ui(context: BrowserContext) {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent('serviceworker', { timeout: 15000 }));
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.waitForSelector('.sidebar');
  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ type: 'onboard' });
  });
  await page.reload();
  await page.waitForSelector('.snapshot-list');
  return { page, id };
}
async function command<T = unknown>(page: Page, value: unknown): Promise<T> {
  return page.evaluate(async (value) => {
    const r = await chrome.runtime.sendMessage(value);
    if (!r.ok) throw new Error(r.error);
    return r.data;
  }, value);
}
async function overview(page: Page) {
  return command<Overview>(page, { type: 'overview' });
}

test('real MV3 lifecycle: automatic backup, groups, restore, import/export and worker/browser restart', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'tabbackup-e2e-'));
  const unpacked = join(profile, 'unpacked');
  await cp(extension, unpacked, { recursive: true });
  let context = await launch(profile, unpacked);
  try {
    const { page, id } = await ui(context);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const source = await page.evaluate(async () => {
      const win = await chrome.windows.create({
        url: 'https://example.com/project',
        focused: false,
      });
      if (!win?.id) throw new Error();
      const first = win.tabs![0]!.id!;
      await chrome.tabs.update(first, { pinned: true });
      const second = await chrome.tabs.create({
        windowId: win.id,
        url: 'https://example.org/design',
        active: false,
      });
      const third = await chrome.tabs.create({
        windowId: win.id,
        url: 'https://example.net/notes',
        active: false,
      });
      const group = await chrome.tabs.group({
        tabIds: [second.id!, third.id!],
      });
      await chrome.tabGroups.update(group, {
        title: 'Research',
        color: 'blue',
        collapsed: true,
      });
      const other = await chrome.windows.create({
        url: 'https://example.com/other',
        focused: false,
      });
      return { windowId: win.id, first, second: second.id!, other: other!.id! };
    });
    await expect
      .poll(async () => {
        const d = await overview(page);
        return d.snapshots.some((s) =>
          s.windows.some((w) => w.groups.some((g) => g.title === 'Research')),
        );
      })
      .toBe(true);
    const before = await overview(page);
    const saved = before.snapshots[0]!;
    expect(saved.windows.length).toBeGreaterThanOrEqual(2);
    expect(saved.windows.some((w) => w.tabs.some((t) => t.pinned))).toBe(true);
    await command(page, { type: 'backup' });
    expect((await overview(page)).snapshots.length).toBe(
      before.snapshots.length,
    );
    await command(page, { type: 'settings', automatic: false });
    const restored = await command<RestoreResult>(page, {
      type: 'restore',
      id: saved.id,
    });
    expect(restored.failed).toBe(0);
    expect(restored.groups).toBeGreaterThanOrEqual(1);
    expect(restored.windows).toBeGreaterThanOrEqual(2);
    expect(restored.verified).toBe(restored.tabs);
    expect(
      await page.evaluate(
        async (id) => (await chrome.tabs.get(id)).pinned,
        source.first,
      ),
    ).toBe(true);
    const downloadPromise = page.waitForEvent('download');
    await page.reload();
    await page
      .getByRole('button', {
        name: /^(Export all|Exportar tudo)$/,
        exact: true,
      })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.tabbackup\.json$/);
    const file = join(profile, 'export.tabbackup.json');
    await download.saveAs(file);
    const chooserPromise = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /^(Import|Importar)$/, exact: true })
      .click();
    await (await chooserPromise).setFiles(file);
    await expect(page.getByRole('dialog')).toContainText(
      /duplicates skipped|duplicatas ignoradas/,
    );
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^(Import|Importar)$/, exact: true })
      .click();
    await expect(page.locator('.main > .notice')).toContainText(
      /Skipped|Ignoradas/,
    );
    const bad = join(profile, 'bad.tabbackup.json');
    await writeFile(bad, '{"schemaVersion":999}');
    const badChooser = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /^(Import|Importar)$/, exact: true })
      .click();
    await (await badChooser).setFiles(bad);
    await expect(page.locator('.main > .notice')).toContainText(
      /invalid or unsupported|inválido ou incompatível/,
    );
    await command(page, { type: 'settings', automatic: true });
    const cdp = await context.newCDPSession(page);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    await cdp.detach();
    await page.evaluate(async (tabId) => {
      await chrome.tabs.update(tabId, {
        url: 'https://example.org/after-worker-restart',
      });
    }, source.second);
    await expect
      .poll(async () => JSON.stringify((await overview(page)).snapshots[0]))
      .toContain('after-worker-restart');
    // Stop a worker with a persisted pending task: the alarm/periodic fallback must remain recoverable.
    const pending = await page.evaluate(async () => {
      const r = await chrome.storage.local.get('runtime');
      return r.runtime;
    });
    expect((pending as { lastChecked: number }).lastChecked).toBeGreaterThan(0);
    const snapshotIds = (await overview(page)).snapshots.map((s) => s.id);
    expect(errors).toEqual([]);
    await context.close();
    context = await launch(profile, unpacked);
    const restarted = await ui(context);
    expect(restarted.id).toBe(id);
    expect(
      (await overview(restarted.page)).snapshots.some((s) =>
        snapshotIds.includes(s.id),
      ),
    ).toBe(true);
    // Load an actual version update at the same extension path and ID, preserving its profile.
    await context.close();
    const manifestPath = join(unpacked, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.version = '1.0.1';
    await writeFile(manifestPath, JSON.stringify(manifest));
    context = await launch(profile, unpacked);
    const updated = await ui(context);
    expect(updated.id).toBe(id);
    expect(
      await updated.page.evaluate(() => chrome.runtime.getManifest().version),
    ).toBe('1.0.1');
    expect(
      (await overview(updated.page)).snapshots.some((s) =>
        snapshotIds.includes(s.id),
      ),
    ).toBe(true);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('100 real tabs, retention, keyboard, theme, CSP and store screenshots', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'tabbackup-many-'));
  const context = await launch(profile);
  try {
    const { page } = await ui(context);
    await command(page, { type: 'settings', automatic: false });
    await page.evaluate(async () => {
      const w = await chrome.windows.create({
        url: 'about:blank',
        focused: false,
      });
      for (let i = 0; i < 100; i++)
        await chrome.tabs.create({
          windowId: w!.id,
          url: `https://example.com/#tab-${i}`,
          active: false,
        });
    });
    await command(page, { type: 'backup' });
    expect(
      (await overview(page)).snapshots[0]!.windows.reduce(
        (n, w) => n + w.tabs.length,
        0,
      ),
    ).toBeGreaterThanOrEqual(100);
    // Restore uses real Chrome APIs; page content is not part of verification.
    const many = (await overview(page)).snapshots[0]!;
    const result = await command<RestoreResult>(page, {
      type: 'restore',
      id: many.id,
    });
    expect(result.failed).toBe(0);
    expect(result.tabs).toBeGreaterThanOrEqual(100);
    const snapshots = Array.from({ length: 25 }, (_, i) => {
      const s = snapshot(`import-${i}`, 4);
      s.createdAt = Date.now() - (24 - i) * 15 * 60000;
      s.windows[0]!.tabs[0]!.title = 'Project overview';
      s.windows[0]!.tabs[1]!.title = 'Design guidelines';
      s.windows[0]!.tabs[2]!.title = 'Research notes';
      s.windows[0]!.tabs[3]!.title = 'Weekly planning';
      return s;
    });
    snapshots[22]!.windows[0]!.tabs[3]!.title = '<img src=x onerror=alert(1)>';
    const text = await serialize(snapshots, '1.0.0');
    const preview = await command<{
      merge: { removed: number; revision: string };
    }>(page, { type: 'preview', text });
    expect(preview.merge.removed).toBeGreaterThan(0);
    await command(page, {
      type: 'import',
      text,
      revision: preview.merge.revision,
    });
    expect((await overview(page)).snapshots).toHaveLength(20);
    await page.reload();
    await page.getByRole('searchbox').fill('no-backup-matches-this-query');
    await expect(page.locator('.snapshot-list')).toContainText(
      /No backups match|Nenhum backup corresponde/,
    );
    await page.getByRole('searchbox').fill('');
    await page.locator('#import-22 summary').click();
    await expect(page.locator('#import-22 .tab-title').last()).toHaveText(
      '<img src=x onerror=alert(1)>',
    );
    expect(await page.locator('img[src=x]').count()).toBe(0);
    await page.locator('#import-22 summary').click();
    await page.getByRole('searchbox').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
      'BUTTON',
    );
    const csp = await page.evaluate(async () => {
      try {
        await fetch('https://example.com/exfiltration');
        return false;
      } catch {
        return true;
      }
    });
    expect(csp).toBe(true);
    await command(page, { type: 'settings', automatic: true });
    await page.reload();
    await expect(page.getByText(/^(Protected|Protegido) ✓$/)).toBeVisible();
    await page.evaluate(async () => {
      const stored = await chrome.storage.local.get('runtime');
      const runtime = stored.runtime as Record<string, unknown>;
      delete runtime.restore;
      await chrome.storage.local.set({ runtime });
    });
    // Release the 200+ test tabs before capturing UI assets to avoid GPU pressure.
    await page.evaluate(async () => {
      const current = await chrome.tabs.getCurrent();
      const ids = (await chrome.tabs.query({}))
        .filter((tab) => tab.id !== current?.id)
        .map((tab) => tab.id!);
      if (ids.length) await chrome.tabs.remove(ids);
    });
    await page.bringToFront();
    await page.reload();
    await page.waitForSelector('.snapshot');
    await mkdir('assets/store', { recursive: true });
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(async () => {
      await page.bringToFront();
      await page.screenshot({
        path: 'assets/store/screenshot-library-1280x800.png',
      });
    }).toPass({ timeout: 5000, intervals: [200, 500] });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(async () => {
      await page.bringToFront();
      await page.screenshot({
        path: 'assets/store/screenshot-dark-1280x800.png',
      });
    }).toPass({ timeout: 5000, intervals: [200, 500] });
    await page
      .getByRole('button', { name: /^(Settings|Configurações)$/, exact: true })
      .click();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(async () => {
      await page.bringToFront();
      await page.screenshot({
        path: 'assets/store/screenshot-settings-1280x800.png',
      });
    }).toPass({ timeout: 5000, intervals: [200, 500] });
    await page
      .getByRole('button', {
        name: /^(Delete all backups|Excluir todos os backups)$/,
        exact: true,
      })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('button', { name: /^(Cancel|Cancelar)$/, exact: true })
      .click();
    expect((await overview(page)).snapshots).toHaveLength(20);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('durable alarm after worker disposal, interrupted journal and safe renderer-crash recovery', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'tabbackup-recovery-'));
  const context = await launch(profile);
  try {
    const { page } = await ui(context);
    const source = await page.evaluate(async () => {
      const tab = await chrome.tabs.create({
        url: 'https://example.com/recovery-original',
        active: false,
      });
      return tab.id!;
    });
    await expect
      .poll(async () => JSON.stringify((await overview(page)).snapshots))
      .toContain('recovery-original');
    await page.evaluate(async (id) => {
      await chrome.tabs.update(id, {
        url: 'https://example.com/pending-recovery',
      });
    }, source);
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const data = await chrome.storage.local.get('runtime');
          return (data.runtime as { pendingAt: number }).pendingAt;
        }),
      )
      .toBeGreaterThan(0);
    const cdp = await context.newCDPSession(page);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    // No tab mutation after disposal: only the persisted alarm can perform this capture.
    await expect
      .poll(async () => JSON.stringify((await overview(page)).snapshots[0]), {
        timeout: 45000,
        intervals: [1000],
      })
      .toContain('pending-recovery');
    await command(page, { type: 'settings', automatic: false });
    await page.evaluate(async () => {
      const data = await chrome.storage.local.get('runtime');
      await chrome.storage.local.set({
        runtime: {
          ...(data.runtime as object),
          restore: {
            running: true,
            result: {
              tabs: 2,
              windows: 1,
              groups: 0,
              failed: 0,
              skipped: 0,
              verified: 0,
              warnings: 0,
            },
          },
        },
      });
    });
    await cdp.send('ServiceWorker.stopAllWorkers');
    expect((await overview(page)).runtime.restore).toMatchObject({
      running: false,
      result: { tabs: 2, interrupted: true },
    });
    await cdp.detach();
    const saved = (await overview(page)).snapshots[0]!;
    const victim = context
      .pages()
      .find((p) => p.url().includes('pending-recovery'));
    expect(victim).toBeDefined();
    const target = await context.newCDPSession(victim!);
    const crashed = victim!.waitForEvent('crash', { timeout: 10000 });
    void target.send('Page.crash').catch(() => {});
    await crashed;
    const result = await command<RestoreResult>(page, {
      type: 'restore',
      id: saved.id,
    });
    expect(result.failed).toBe(0);
    expect(result.tabs).toBeGreaterThan(0);
    expect(result.verified).toBe(result.tabs);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
