import type { Snapshot } from '../src/domain/model';
export function snapshot(id = 'test', tabCount = 3): Snapshot {
  return {
    schemaVersion: 1,
    id,
    createdAt: 1700000000000,
    reason: 'manual',
    extensionVersion: '1.0.0',
    windows: [
      {
        focused: true,
        state: 'normal',
        groups: [],
        tabs: Array.from({ length: tabCount }, (_, index) => ({
          url: `https://example.com/${index}`,
          title: `Page ${index}`,
          index,
          pinned: index === 0,
        })),
      },
    ],
  };
}
