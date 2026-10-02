import { readFile, readdir, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = 'dist/chrome';
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.incognito, 'not_allowed');
assert.deepEqual(manifest.permissions.sort(), [
  'alarms',
  'storage',
  'tabGroups',
  'tabs',
]);
assert(
  !manifest.host_permissions &&
    !manifest.content_scripts &&
    !manifest.externally_connectable &&
    !manifest.web_accessible_resources,
);
for (const p of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
  ...Object.values(manifest.icons),
])
  await stat(`${root}/${p}`);
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      await scan(p);
      continue;
    }
    assert(!p.endsWith('.map'));
    if (/\.(js|html)$/.test(p)) {
      const text = await readFile(p, 'utf8');
      assert(
        !/\beval\s*\(|new\s+Function\s*\(|https?:\/\/localhost|127\.0\.0\.1|@vite\/client|fake-indexeddb|sourceMappingURL|<script[^>]+src=["']https?:/i.test(
          text,
        ),
        `Forbidden production pattern: ${p}`,
      );
    }
  }
}
await scan(root);
for (const locale of ['en', 'pt_BR']) {
  const messages = JSON.parse(
    await readFile(`${root}/_locales/${locale}/messages.json`, 'utf8'),
  );
  assert(messages.extensionDescription.message.length <= 132);
  assert(
    Object.keys(messages).every((k) => /^[A-Za-z0-9_]+$/.test(k)),
    'Invalid locale key',
  );
}
console.log('Production artifact checks passed.');
