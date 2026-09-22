import { t } from './i18n';
import type { LogEntry } from './tools';

const ACTION_LABEL: Record<string, string> = {
  click: 'actionClick',
  type: 'actionType',
  select: 'actionSelect',
  scroll: 'actionScroll',
  navigate: 'actionNavigate',
  back: 'actionBack',
  read_page: 'actionReadPage',
  wait: 'actionWait',
};

/**
 * One line per tool call: the action, its target, and why it failed — never the
 * text that was typed. Formatted in the worker rather than in the mentor app so
 * these strings stay in the extension's own `_locales`, which `chrome.i18n`
 * resolves in a service worker just as it does on a page.
 */
export function logLine(entry: LogEntry): string {
  const label = t(ACTION_LABEL[entry.tool] ?? entry.tool);
  const head = `${label} ${entry.target}`.trim();
  if (entry.code === 'host_blocked')
    return `${head} — ${t('hostBlocked', entry.host ?? '')}`;
  if (entry.code === 'declined') return `${head} — ${t('declined')}`;
  if (entry.code === 'refused')
    return `${head} — ${t('refused', entry.detail ?? '')}`;
  if (!entry.ok && entry.detail) return `${head} — ${entry.detail}`;
  return head;
}
