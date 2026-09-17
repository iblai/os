// Functions injected into the browsed tab with chrome.scripting.executeScript({ func }).
// Chrome serializes each one with Function.prototype.toString and runs it in the
// tab's isolated world, so a function may use only its own arguments, its own
// locals and the page's globals: no imports, no module-level helpers, no enums.
// page-scripts.test.ts re-evaluates every export in an empty scope to enforce it.
//
// The isolated world's globalThis persists for the life of the document and is
// wiped by a navigation — exactly the lifetime of an element number.

export interface SnapshotItem {
  n: number;
  role: string;
  name: string;
  state: string;
  submit: boolean;
  password: boolean;
}

export interface Snapshot {
  url: string;
  title: string;
  items: SnapshotItem[];
  /** What the model reads: URL and title, one line per item, a text excerpt. */
  text: string;
}

export interface ActResult {
  ok: boolean;
  error?: string;
}

/** The Chat tab's context feed (unchanged from the original panel.js). */
export function extractPageContent(): {
  title: string;
  href: string;
  text: string;
} {
  const body = document.body;
  const text = body ? body.innerText || body.textContent || '' : '';
  return {
    title: document.title,
    href: location.href,
    text: text.slice(0, 100000),
  };
}

export function snapshotPage(maxItems: number, textChars: number): Snapshot {
  const SELECTOR = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    'summary',
    '[contenteditable="true"]',
    '[role~="button"]',
    '[role~="link"]',
    '[role~="textbox"]',
    '[role~="checkbox"]',
    '[role~="radio"]',
    '[role~="tab"]',
    '[role~="menuitem"]',
    '[role~="option"]',
    '[role~="combobox"]',
    '[role~="switch"]',
    'h1',
    'h2',
    'h3',
  ].join(', ');

  const collapse = (value: string | null | undefined, max: number): string => {
    const clean = (value || '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
  };
  const textOf = (el: Element | null): string =>
    el ? (el as HTMLElement).innerText || el.textContent || '' : '';
  // Never rect-based: layout is unavailable in tests and irrelevant to the model.
  const visible = (el: Element): boolean => {
    const html = el as HTMLElement;
    if (typeof html.checkVisibility === 'function') {
      return html.checkVisibility({
        checkOpacity: true,
        visibilityProperty: true,
      });
    }
    return !html.hidden && getComputedStyle(html).display !== 'none';
  };
  const nameOf = (el: Element): string => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return collapse(aria, 80);
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => textOf(document.getElementById(id)))
        .join(' ');
      if (text.trim()) return collapse(text, 80);
    }
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) {
      const text = Array.from(labels)
        .map((label) => textOf(label))
        .join(' ');
      if (text.trim()) return collapse(text, 80);
    }
    const wrapping = el.closest('label');
    if (wrapping && textOf(wrapping).trim())
      return collapse(textOf(wrapping), 80);
    for (const attr of ['placeholder', 'title', 'alt']) {
      const value = el.getAttribute(attr);
      if (value && value.trim()) return collapse(value, 80);
    }
    const img = el.querySelector('img[alt]');
    const alt = img ? img.getAttribute('alt') : null;
    if (alt && alt.trim()) return collapse(alt, 80);
    if (
      el instanceof HTMLInputElement &&
      /^(submit|button|reset)$/.test(el.type)
    ) {
      return collapse(el.value, 80);
    }
    // A select's text is its options run together; the selected one is in its state.
    if (el instanceof HTMLSelectElement) return '';
    return collapse(textOf(el), 80);
  };
  const roleOf = (el: Element): string => {
    const role = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
    if (role) return role.toLowerCase();
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') return 'heading';
    if (tag === 'input') {
      const type = (el as HTMLInputElement).type;
      if (
        type === 'submit' ||
        type === 'button' ||
        type === 'reset' ||
        type === 'image'
      ) {
        return 'button';
      }
      if (type === 'checkbox' || type === 'radio') return type;
    }
    return 'textbox';
  };
  const isSubmit = (el: Element): boolean => {
    if (el instanceof HTMLInputElement)
      return el.type === 'submit' || el.type === 'image';
    if (el instanceof HTMLButtonElement)
      return el.type === 'submit' && Boolean(el.form);
    return false;
  };
  const stateOf = (el: Element, role: string, password: boolean): string => {
    const parts: string[] = [];
    if (role === 'textbox' || role === 'searchbox') {
      if (password) {
        parts.push('password');
      } else {
        const value =
          el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
            ? el.value
            : textOf(el);
        parts.push(value.trim() ? `value: "${collapse(value, 40)}"` : 'empty');
      }
    }
    if (role === 'checkbox' || role === 'radio' || role === 'switch') {
      const checked =
        el instanceof HTMLInputElement
          ? el.checked
          : el.getAttribute('aria-checked') === 'true';
      parts.push(checked ? 'checked' : 'unchecked');
    }
    if (el instanceof HTMLSelectElement && el.selectedOptions[0]) {
      parts.push(`selected: "${collapse(el.selectedOptions[0].text, 40)}"`);
    }
    const expanded = el.getAttribute('aria-expanded');
    if (expanded === 'true') parts.push('expanded');
    else if (expanded === 'false') parts.push('collapsed');
    if (
      (el as HTMLButtonElement).disabled ||
      el.getAttribute('aria-disabled') === 'true'
    ) {
      parts.push('disabled');
    }
    if (isSubmit(el)) parts.push('submit');
    return parts.join(', ');
  };

  const map = new Map<number, Element>();
  const items: SnapshotItem[] = [];
  for (const el of Array.from(document.querySelectorAll(SELECTOR))) {
    if (items.length >= maxItems) break;
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue;
    if (!visible(el) || el.closest('[aria-hidden="true"]')) continue;
    const role = roleOf(el);
    const password = el instanceof HTMLInputElement && el.type === 'password';
    const n = items.length + 1;
    map.set(n, el);
    items.push({
      n,
      role,
      name: nameOf(el),
      state: stateOf(el, role, password),
      submit: isSubmit(el),
      password,
    });
  }
  (globalThis as { __agentMap?: Map<number, Element> }).__agentMap = map;

  const main = document.querySelector('main') || document.body;
  const excerpt = collapse(textOf(main), textChars);
  const lines = items.map(
    (item) =>
      `[${item.n}] ${item.role} "${item.name}"${item.state ? ` (${item.state})` : ''}`,
  );
  const text = `${location.href}  "${document.title}"\n${lines.join('\n')}\n--- text ---\n${excerpt}`;
  return { url: location.href, title: document.title, items, text };
}

export function actOnPage(
  n: number,
  action: string,
  value: string,
  submit: boolean,
): ActResult {
  const map = (globalThis as { __agentMap?: Map<number, Element> }).__agentMap;
  const el = map ? map.get(n) : undefined;
  if (!el || !el.isConnected) {
    return {
      ok: false,
      error: `Element ${n} is not in the current snapshot; call read_page and use a fresh number.`,
    };
  }
  const html = el as HTMLElement;
  const fire = (type: string) =>
    el.dispatchEvent(new Event(type, { bubbles: true }));
  if (typeof html.scrollIntoView === 'function') {
    html.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  if (action === 'scroll') return { ok: true };

  if (action === 'click') {
    if (typeof html.focus === 'function') html.focus();
    html.click();
    return { ok: true };
  }

  if (action === 'type') {
    const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
    const secret =
      (el instanceof HTMLInputElement && el.type === 'password') ||
      /^(current-password|new-password|cc-number|cc-csc)$/.test(autocomplete);
    if (secret) {
      return {
        ok: false,
        error:
          'Refused: this field takes a password or payment secret. Ask the user to type it themselves, then continue.',
      };
    }
    if (typeof html.focus === 'function') html.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      // React tracks the value through the prototype setter; a plain `el.value =`
      // is swallowed as "no change" and the app never sees the text.
      const proto =
        el instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : HTMLTextAreaElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) descriptor.set.call(el, value);
      else el.value = value;
      fire('input');
      fire('change');
    } else if (
      html.isContentEditable ||
      el.getAttribute('contenteditable') === 'true'
    ) {
      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, value);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        html.textContent = value;
        fire('input');
      }
    } else {
      return { ok: false, error: 'Element cannot receive text.' };
    }
    if (submit) {
      const init = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      };
      el.dispatchEvent(new KeyboardEvent('keydown', init));
      el.dispatchEvent(new KeyboardEvent('keyup', init));
      // Synthetic Enter never triggers implicit submission; do it explicitly.
      const form = (el as HTMLInputElement).form;
      if (form) {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.submit();
      }
    }
    return { ok: true };
  }

  if (action === 'select') {
    if (!(el instanceof HTMLSelectElement))
      return { ok: false, error: 'Element is not a select.' };
    const wanted = value.trim().toLowerCase();
    const options = Array.from(el.options);
    const option =
      options.find((o) => o.value === value) ||
      options.find((o) => o.text.trim().toLowerCase() === wanted);
    if (!option) {
      const listed = options
        .map((o) => o.text.trim())
        .slice(0, 20)
        .join(' | ');
      return {
        ok: false,
        error: `No option matches "${value}". Options: ${listed}`,
      };
    }
    el.value = option.value;
    fire('input');
    fire('change');
    return { ok: true };
  }

  return { ok: false, error: `Unknown action "${action}".` };
}

export function scrollPage(direction: string): ActResult {
  const delta =
    Math.round(window.innerHeight * 0.8) * (direction === 'up' ? -1 : 1);
  window.scrollBy({ top: delta, left: 0, behavior: 'instant' });
  return { ok: true };
}

/**
 * Resolves after `quietMs` without DOM mutations (once the document is
 * complete), or at `capMs`. Chrome awaits a promise returned by an injected
 * function. Never "network idle": SDK apps keep the network busy for good.
 */
export function waitForQuiet(quietMs: number, capMs: number): Promise<string> {
  return new Promise((resolve) => {
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;
    let capTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (why: string) => {
      if (quietTimer) clearTimeout(quietTimer);
      if (capTimer) clearTimeout(capTimer);
      if (observer) observer.disconnect();
      resolve(why);
    };
    const arm = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        if (document.readyState === 'complete') finish('quiet');
        else arm();
      }, quietMs);
    };
    capTimer = setTimeout(() => finish('cap'), capMs);
    observer = new MutationObserver(arm);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    arm();
  });
}
