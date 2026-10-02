import './styles.css';
import type { Snapshot, RestoreResult } from '../domain/model';
import { counts } from '../domain/model';
import { serialize, exportFilename } from '../domain/serialization';
export function t(key: string, ...args: (string | number)[]): string {
  return (
    chrome.i18n.getMessage(key.replaceAll('-', '_'), args.map(String)) || key
  );
}
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  cls?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
export function button(
  label: string,
  action: () => void | Promise<void>,
  cls = 'secondary',
): HTMLButtonElement {
  const b = el('button', label, cls);
  b.type = 'button';
  b.addEventListener('click', () => {
    void action();
  });
  return b;
}
export function locale(): string {
  return (
    chrome.i18n.getMessage('@@ui_locale') || chrome.i18n.getUILanguage()
  ).replace('_', '-');
}
export function date(time: number): string {
  return new Date(time).toLocaleString(locale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
export function summary(s: Snapshot): string {
  const c = counts(s);
  return t('summary', c.tabs, c.windows, c.groups);
}
export function brand(): HTMLElement {
  const h = el('div', undefined, 'brand');
  const img = el('img');
  img.src = 'icons/icon48.png';
  img.alt = '';
  img.width = 36;
  img.height = 36;
  h.append(img, el('span', 'TabBackup'));
  return h;
}
export function notice(): HTMLElement {
  const e = el('p', undefined, 'notice');
  e.setAttribute('role', 'status');
  e.setAttribute('aria-live', 'polite');
  return e;
}
export function errorText(e: unknown): string {
  return t(e instanceof Error ? e.message : 'genericError');
}
export async function download(snapshots: Snapshot[]): Promise<void> {
  const data = await serialize(snapshots, chrome.runtime.getManifest().version);
  const url = URL.createObjectURL(
    new Blob([data], { type: 'application/json' }),
  );
  const a = el('a');
  a.href = url;
  a.download = exportFilename();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function restoreMessage(r: RestoreResult): string {
  return [
    t('restoreResult', r.tabs, r.windows, r.groups),
    t('restoreDetails', r.skipped, r.failed, r.verified, r.warnings),
    r.interrupted ? t('interrupted') : '',
  ]
    .filter(Boolean)
    .join(' ');
}
export function confirmDialog(
  message: string,
  label: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = el('dialog');
    const heading = el('h2', message);
    heading.id = 'confirm-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    const row = el('div', undefined, 'actions');
    const finish = (ok: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(ok);
    };
    row.append(
      button(t('cancel'), () => finish(false)),
      button(label, () => finish(true), 'danger'),
    );
    dialog.append(heading, row);
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(false);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
export function initLanguage() {
  document.documentElement.lang = locale();
}
