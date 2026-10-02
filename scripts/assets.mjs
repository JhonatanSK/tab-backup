import sharp from 'sharp';
import { URL } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const theme = await readFile(
  new URL('../src/shared/theme.css', import.meta.url),
  'utf8',
);
function brandColor(name) {
  const value = theme.match(
    new RegExp(`--brand-${name}:\\s*(#[a-fA-F0-9]{6});`),
  )?.[1];
  if (!value) throw new Error(`Missing brand token: ${name}`);
  return value;
}
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="16" y="16" width="96" height="96" rx="24" fill="${brandColor('primary')}"/><path d="M34 40h22l8 8h30v37a7 7 0 0 1-7 7H41a7 7 0 0 1-7-7z" fill="${brandColor('text')}"/><path d="M64 56l20 8v14c0 12-11 20-20 24-9-4-20-12-20-24V64z" fill="${brandColor('secondary')}" stroke="${brandColor('primary')}" stroke-width="4"/><path d="M55 77l7 7 13-16" fill="none" stroke="${brandColor('success')}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
await mkdir('public/icons', { recursive: true });
await mkdir('assets/store', { recursive: true });
await writeFile('assets/icon.svg', icon);
for (const size of [16, 32, 48, 128])
  await sharp(Buffer.from(icon))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon${size}.png`);
await sharp(Buffer.from(icon)).png().toFile('assets/store/icon-128.png');
const promo = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280"><rect width="440" height="280" fill="${brandColor('background')}"/><circle cx="410" cy="15" r="160" fill="${brandColor('secondary')}"/><g transform="translate(20 14) scale(.72)">${icon.replace(/<svg[^>]*>|<\/svg>/g, '')}</g><text x="34" y="145" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${brandColor('text')}">TabBackup</text><text x="35" y="181" font-family="Arial,sans-serif" font-size="20" fill="${brandColor('text')}">Your tabs, automatically</text><text x="35" y="207" font-family="Arial,sans-serif" font-size="20" fill="${brandColor('text')}">backed up.</text><text x="35" y="250" font-family="Arial,sans-serif" font-size="12" fill="${brandColor('muted')}">LOCAL BACKUPS · NO ACCOUNT</text></svg>`;
await sharp(Buffer.from(promo))
  .removeAlpha()
  .png()
  .toFile('assets/store/promo-440x280.png');
