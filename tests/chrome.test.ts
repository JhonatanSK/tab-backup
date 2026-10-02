import { it, expect, vi, afterEach } from 'vitest';
import { capture } from '../src/background/builder';
import { restore } from '../src/restore/engine';
import { snapshot } from './fixtures';
afterEach(() => vi.unstubAllGlobals());
it('captures multiple normal windows, pinned tabs and local group refs; excludes incognito and own UI', async () => {
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: () => 'chrome-extension://self/',
      getManifest: () => ({ version: '1.0.0' }),
    },
    windows: {
      getAll: async () => [
        {
          id: 1,
          focused: true,
          state: 'normal',
          tabs: [
            {
              url: 'https://example.com/',
              title: 'Example',
              pinned: true,
              index: 0,
              groupId: -1,
            },
            {
              url: 'https://example.org/',
              pinned: false,
              index: 1,
              groupId: 88,
            },
            {
              url: 'chrome-extension://self/options.html',
              index: 2,
              groupId: -1,
            },
          ],
        },
        {
          id: 2,
          focused: false,
          tabs: [
            {
              url: 'https://example.net/',
              pinned: false,
              index: 0,
              groupId: -1,
            },
          ],
        },
        {
          id: 3,
          incognito: true,
          tabs: [{ url: 'https://private.example/', groupId: -1 }],
        },
      ],
    },
    tabGroups: {
      query: async () => [
        { id: 88, windowId: 1, title: 'Work', color: 'blue', collapsed: true },
      ],
    },
  });
  const s = await capture('manual');
  expect(s.windows).toHaveLength(2);
  expect(s.windows[0]!.tabs).toHaveLength(2);
  expect(s.windows[0]!.tabs[1]!.groupRef).toBe('g0');
  expect(JSON.stringify(s)).not.toContain('private');
  expect(s.windows[0]).not.toHaveProperty('id');
  expect(s.windows[0]!.groups[0]).not.toHaveProperty('id');
});
it('reports partial failures and metadata warnings without removing existing session tabs', async () => {
  const s = snapshot();
  s.windows[0]!.tabs[2]!.url = 'chrome://settings/';
  let id = 20;
  const remove = vi.fn(async () => {}),
    created: { id: number; url: string; pinned: boolean; index: number }[] = [];
  vi.stubGlobal('chrome', {
    windows: {
      create: async () => ({ id: 5, tabs: [{ id: 10 }] }),
      update: async () => {},
      get: async () => ({ state: 'normal' }),
    },
    tabs: {
      create: async (arg: { url: string; pinned: boolean }) => {
        if (arg.url.endsWith('/1')) throw new Error('policy');
        const tab = { id: ++id, url: arg.url, pinned: arg.pinned, index: 0 };
        created.push(tab);
        return tab;
      },
      remove,
      query: async () => created,
    },
    tabGroups: {},
  });
  const result = await restore(s, async () => {});
  expect(result).toMatchObject({
    tabs: 1,
    windows: 1,
    skipped: 1,
    failed: 1,
    verified: 1,
  });
  expect(remove).toHaveBeenCalledExactlyOnceWith(10);
});
it('handles window creation failure without reporting restored tabs', async () => {
  vi.stubGlobal('chrome', {
    windows: {
      create: async () => {
        throw new Error('blocked');
      },
    },
  });
  expect(await restore(snapshot(), async () => {})).toMatchObject({
    tabs: 0,
    windows: 0,
    failed: 3,
  });
});
