import {
  el,
  brand,
  t,
  button,
  notice,
  date,
  summary,
  errorText,
  initLanguage,
  download,
  confirmDialog,
  restoreMessage,
  locale,
} from '../shared/ui';
import { request, type Overview } from '../shared/messages';
import {
  counts,
  type BackupFile,
  type Snapshot,
  type RestoreResult,
} from '../domain/model';
import { MAX_FILE_BYTES } from '../domain/validation';
import { canRestore } from '../domain/urls';
import type { MergeResult } from '../storage/repository';
initLanguage();
const app = document.querySelector<HTMLElement>('#app')!;
let data: Overview;
let active: 'library' | 'settings' = 'library';
let search = '';
let busy = false;
const message = notice();
const content = el('div', undefined, 'content');
async function refresh() {
  data = await request<Overview>({ type: 'overview' });
  render();
}
async function run(action: () => Promise<string | void>, tone = '') {
  if (busy) return;
  busy = true;
  app.setAttribute('aria-busy', 'true');
  message.className = 'notice';
  message.textContent = t('working');
  for (const b of app.querySelectorAll('button')) b.disabled = true;
  try {
    const result = await action();
    await refresh();
    message.className = `notice ${tone}`;
    message.textContent = result || '';
  } catch (e) {
    message.className = 'notice error';
    message.textContent = errorText(e);
    try {
      await refresh();
    } catch {
      /* Retain actionable error. */
    }
  } finally {
    busy = false;
    app.removeAttribute('aria-busy');
    for (const b of app.querySelectorAll('button')) b.disabled = false;
  }
}
function shell() {
  app.className = 'layout';
  const sidebar = el('aside', undefined, 'sidebar');
  sidebar.append(brand(), el('p', t('tagline'), 'muted'));
  const nav = el('nav');
  nav.setAttribute('aria-label', 'TabBackup');
  for (const key of ['library', 'settings'] as const) {
    const b = button(t(key), () => {
      active = key;
      render();
    });
    b.dataset.view = key;
    nav.append(b);
  }
  sidebar.append(
    nav,
    el('div', t('free'), 'badge'),
    el('p', t('privacy'), 'sidebar-privacy'),
  );
  const main = el('section', undefined, 'main');
  main.append(message, content);
  app.append(sidebar, main);
}
function render() {
  if (!data) return;
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    b.classList.toggle('selected', b.dataset.view === active);
    b.setAttribute(
      'aria-current',
      b.dataset.view === active ? 'page' : 'false',
    );
  }
  content.replaceChildren();
  if (active === 'settings') {
    renderSettings();
    return;
  }
  const top = el('div', undefined, 'page-heading');
  const title = el('div');
  title.append(
    el('p', t('kept', data.snapshots.length, data.retention), 'eyebrow'),
    el('h1', t('library')),
  );
  top.append(
    title,
    button(
      t('backupNow'),
      () =>
        run(
          async () =>
            t(
              (await request<boolean>({ type: 'backup' }))
                ? 'backupCreated'
                : 'unchanged',
            ),
          'success',
        ),
      'primary',
    ),
  );
  content.append(top);
  const protection = el('section', undefined, 'protection');
  const latest = data.snapshots[0];
  protection.append(
    el(
      'div',
      t(
        data.runtime.error
          ? 'attention'
          : !data.settings.automatic
            ? 'paused'
            : latest
              ? 'protected'
              : 'firstNeeded',
      ),
      `status ${data.runtime.error ? 'error' : !data.settings.automatic ? 'warning' : latest ? 'success' : 'muted'}`,
    ),
    el('p', t('lastBackup', latest ? date(latest.createdAt) : t('never'))),
  );
  if (latest) protection.append(el('p', summary(latest), 'muted'));
  content.append(protection);
  if (data.runtime.error)
    content.append(el('p', t(data.runtime.error), 'error'));
  if (data.runtime.restore) {
    const r = data.runtime.restore;
    content.append(
      el(
        'p',
        r.running ? t('restoreRunning') : restoreMessage(r.result),
        `notice result ${r.running ? '' : r.result.failed || r.result.skipped || r.result.warnings || r.result.interrupted ? 'warning' : 'success'}`,
      ),
    );
  }
  const toolbar = el('div', undefined, 'toolbar');
  const label = el('label', t('searchLabel'));
  const input = el('input');
  input.type = 'search';
  input.placeholder = t('search');
  input.value = search;
  input.id = 'search';
  label.htmlFor = 'search';
  input.addEventListener('input', () => {
    search = input.value;
    renderList(list);
  });
  toolbar.append(
    label,
    input,
    button(t('exportAll'), () =>
      run(async () => {
        await download(data.snapshots);
        return t('downloadStarted');
      }),
    ),
    importButton(),
  );
  content.append(toolbar);
  const list = el('div', undefined, 'snapshot-list');
  content.append(list);
  renderList(list);
  content.append(el('p', t('localWarning'), 'footnote'));
}
function renderList(list: HTMLElement) {
  list.replaceChildren();
  let day = '';
  const filtered = data.snapshots.filter(
    (s) =>
      !search ||
      JSON.stringify(s.windows)
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  if (!filtered.length) {
    const empty = el('div', undefined, 'empty');
    empty.append(
      el('h2', t(search ? 'noResults' : 'empty')),
      el('p', t('emptyBody')),
    );
    list.append(empty);
    return;
  }
  for (const s of filtered) {
    const nextDay = new Date(s.createdAt).toLocaleDateString(locale(), {
      dateStyle: 'full',
    });
    if (nextDay !== day) {
      day = nextDay;
      list.append(el('h2', day, 'day'));
    }
    const card = el('article', undefined, 'snapshot');
    card.id = s.id;
    const heading = el('div', undefined, 'snapshot-head');
    const left = el('div');
    left.append(el('h3', date(s.createdAt)), el('p', summary(s), 'muted'));
    heading.append(left, el('span', t(s.reason), 'badge'));
    card.append(heading);
    const actions = el('div', undefined, 'actions');
    actions.append(
      button(
        t('restoreAll'),
        () =>
          run(async () => {
            const r = await request<RestoreResult>({
              type: 'restore',
              id: s.id,
            });
            return restoreMessage(r);
          }),
        'primary',
      ),
      button(t('export'), () =>
        run(async () => {
          await download([s]);
          return t('downloadStarted');
        }),
      ),
      button(
        t('delete'),
        async () => {
          if (await confirmDialog(t('confirmDelete'), t('delete')))
            await run(async () => {
              await request({ type: 'delete', id: s.id });
            });
        },
        'text-danger',
      ),
    );
    card.append(actions);
    const details = el('details');
    details.open = location.hash === `#${s.id}`;
    details.append(el('summary', t('detail')));
    details.addEventListener('toggle', () => {
      if (details.open && details.children.length === 1)
        renderDetails(s, details);
    });
    card.append(details);
    list.append(card);
  }
}
function renderDetails(s: Snapshot, target: HTMLElement) {
  for (const [i, w] of s.windows.entries()) {
    const section = el('section', undefined, 'window-detail');
    section.append(el('h4', t('window', i + 1)));
    const ul = el('ol');
    for (const tab of w.tabs) {
      const li = el('li');
      const g = w.groups.find((g) => g.localId === tab.groupRef);
      if (g) {
        const pill = el('span', g.title || t('groups'), 'group');
        pill.dataset.color = g.color;
        li.append(pill);
      }
      if (tab.pinned) li.append(el('span', t('pinned'), 'badge'));
      li.append(
        el('span', tab.title || tab.url, 'tab-title'),
        el('small', tab.url, 'url'),
      );
      if (!canRestore(tab.url))
        li.append(el('span', t('unsupported'), 'warning'));
      ul.append(li);
    }
    section.append(ul);
    target.append(section);
  }
  target.append(el('p', t('limits'), 'footnote'));
}
function importButton() {
  return button(t('import'), () => {
    const file = el('input');
    file.type = 'file';
    file.accept = '.tabbackup.json,application/json';
    file.setAttribute('aria-label', t('importFile'));
    file.addEventListener('change', () => {
      const selected = file.files?.[0];
      if (!selected) return;
      void run(async () => {
        if (selected.size > MAX_FILE_BYTES) throw new Error('invalidBackup');
        const text = await selected.text();
        const preview = await request<{ file: BackupFile; merge: MergeResult }>(
          { type: 'preview', text },
        );
        showImport(preview.file, preview.merge, text);
      });
    });
    file.click();
  });
}
function showImport(file: BackupFile, merge: MergeResult, text: string) {
  const dialog = el('dialog');
  const title = el('h2', t('importPreview'));
  title.id = 'import-title';
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.append(
    title,
    el('p', t('exportDate', date(file.metadata.exportedAt))),
  );
  const oldest = file.snapshots.reduce(
    (min, s) => Math.min(min, s.createdAt),
    Infinity,
  );
  if (Number.isFinite(oldest))
    dialog.append(el('p', t('backupDate', date(oldest))));
  const total = file.snapshots.reduce(
    (a, s) => {
      const c = counts(s);
      return { tabs: a.tabs + c.tabs, windows: a.windows + c.windows };
    },
    { tabs: 0, windows: 0 },
  );
  dialog.append(
    el(
      'p',
      `${file.snapshots.length} ${t('snapshots')} · ${total.tabs} ${t('tabs')} · ${total.windows} ${t('windows')}`,
    ),
    el(
      'p',
      t(
        'importImpact',
        merge.added,
        merge.duplicates,
        merge.collisions,
        merge.removed,
      ),
      'warning',
    ),
    el('p', t('urlWarning'), 'muted'),
  );
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  const row = el('div', undefined, 'actions');
  row.append(
    button(t('cancel'), close),
    button(
      t('import'),
      async () => {
        close();
        await run(async () => {
          const result = await request<MergeResult>({
            type: 'import',
            text,
            revision: merge.revision!,
          });
          return t('imported', result.added, result.duplicates);
        });
      },
      'primary',
    ),
  );
  dialog.append(row);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  document.body.append(dialog);
  dialog.showModal();
}
function renderSettings() {
  content.append(el('h1', t('settings')));
  const panel = el('section', undefined, 'settings-panel');
  const label = el('label', undefined, 'toggle-row');
  const checkbox = el('input');
  checkbox.type = 'checkbox';
  checkbox.checked = data.settings.automatic;
  checkbox.addEventListener('change', () => {
    void run(async () => {
      await request({ type: 'settings', automatic: checkbox.checked });
    });
  });
  label.append(checkbox, el('span', t('automatic')));
  panel.append(
    label,
    el('p', t('automaticHelp'), 'muted'),
    el('h2', t('retention')),
    el('p', t('retentionHelp', data.retention)),
    el('h2', t('storage')),
    el(
      'p',
      t(
        'storageHelp',
        (data.usedBytes / 1048576).toFixed(2),
        data.budget / 1048576,
      ),
    ),
  );
  const meter = el('meter');
  meter.min = 0;
  meter.max = data.budget;
  meter.value = data.usedBytes;
  meter.setAttribute('aria-label', t('storage'));
  panel.append(
    meter,
    button(t('persistence'), () =>
      run(async () =>
        t((await navigator.storage.persist()) ? 'persistent' : 'notPersistent'),
      ),
    ),
  );
  const actions = el('div', undefined, 'actions');
  actions.append(
    button(t('exportAll'), () =>
      run(async () => {
        await download(data.snapshots);
        return t('downloadStarted');
      }),
    ),
    importButton(),
    button(
      t('deleteAll'),
      async () => {
        if (await confirmDialog(t('confirmDeleteAll'), t('deleteAll')))
          await run(async () => {
            await request({ type: 'deleteAll' });
          });
      },
      'text-danger',
    ),
  );
  panel.append(
    actions,
    el('p', t('localWarning'), 'warning'),
    el('p', t('urlWarning'), 'muted'),
  );
  content.append(panel);
  const privacy = el('section', undefined, 'settings-panel');
  privacy.append(
    el('h2', t('privacyHeading')),
    el('p', t('privacyBody')),
    el('p', t('incognito')),
    el('h2', t('learnPrivacy')),
    el('p', t('limits')),
    el('p', t('verifiedHelp'), 'muted'),
  );
  content.append(privacy);
}
function onboarding(step = 1) {
  const dialog = el('dialog', undefined, 'onboarding');
  const title = el('h1', t(`onboardTitle${step}`));
  title.id = 'onboard-title';
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.append(
    brand(),
    el('p', t('step', step), 'eyebrow'),
    title,
    el('p', t(`onboardBody${step}`)),
    el('p', t('localWarning'), 'muted'),
  );
  const row = el('div', undefined, 'actions');
  if (step > 1)
    row.append(
      button(t('back'), () => {
        dialog.close();
        dialog.remove();
        onboarding(step - 1);
      }),
    );
  row.append(
    button(
      t(step === 3 ? 'createFirst' : 'next'),
      async () => {
        dialog.close();
        dialog.remove();
        if (step < 3) onboarding(step + 1);
        else
          await run(async () => {
            await request({ type: 'onboard' });
            const created = await request<boolean>({ type: 'backup' });
            return t(created ? 'backupCreated' : 'unchanged');
          }, 'success');
      },
      'primary',
    ),
  );
  dialog.append(row);
  dialog.addEventListener('cancel', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
shell();
void refresh()
  .then(() => {
    if (!data.settings.onboarded) onboarding();
  })
  .catch((e) => {
    message.className = 'notice error';
    message.textContent = errorText(e);
    content.replaceChildren(button(t('retry'), () => run(async () => {})));
  });
window.addEventListener('focus', () => {
  if (!busy && !document.querySelector('dialog'))
    void refresh().catch((e) => {
      message.className = 'notice error';
      message.textContent = errorText(e);
    });
});
