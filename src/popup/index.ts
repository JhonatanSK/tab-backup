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
} from '../shared/ui';
import { request, type Overview } from '../shared/messages';
initLanguage();
const app = document.querySelector<HTMLElement>('#app')!;
async function render() {
  app.replaceChildren();
  const header = el('header');
  header.append(brand(), el('span', t('free'), 'badge'));
  const message = notice();
  app.append(header, message);
  try {
    const data = await request<Overview>({ type: 'overview' }),
      latest = data.snapshots[0];
    const hero = el('section', undefined, 'popup-hero');
    hero.append(
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
      el('h1', t('tagline')),
      el(
        'p',
        t('lastBackup', latest ? date(latest.createdAt) : t('never')),
        'muted',
      ),
    );
    if (latest) hero.append(el('p', summary(latest)));
    const backup = button(
      t('backupNow'),
      async () => {
        backup.disabled = true;
        try {
          const created = await request<boolean>({ type: 'backup' });
          await render();
          document.querySelector('.notice')!.className = 'notice success';
          document.querySelector('.notice')!.textContent = t(
            created ? 'backupCreated' : 'unchanged',
          );
        } catch (e) {
          message.className = 'notice error';
          message.textContent = errorText(e);
          backup.disabled = false;
        }
      },
      'primary',
    );
    hero.append(backup);
    app.append(hero, el('h2', t('recent')));
    for (const s of data.snapshots.slice(0, 3)) {
      const row = button(
        `${date(s.createdAt)} · ${summary(s)}`,
        () => {
          void chrome.tabs.create({
            url: chrome.runtime.getURL(`options.html#${s.id}`),
          });
        },
        'recent-row',
      );
      app.append(row);
    }
    if (data.runtime.error) {
      message.className = 'notice error';
      message.textContent = t(data.runtime.error);
    }
    app.append(
      button(t('viewAll'), () => chrome.runtime.openOptionsPage()),
      el('p', t('privacy'), 'footnote'),
    );
  } catch (e) {
    message.className = 'notice error';
    message.textContent = errorText(e);
    app.append(button(t('retry'), render));
  }
}
void render();
