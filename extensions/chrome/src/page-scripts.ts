// Functions injected into the browsed tab with chrome.scripting.executeScript({ func }).
// Chrome serializes each one with Function.prototype.toString and runs it in the
// tab's isolated world, so a function may use only its own arguments, its own
// locals and the page's globals: no imports, no module-level helpers, no enums.
// page-scripts.test.ts re-evaluates every export in an empty scope to enforce it.
//
// The isolated world's globalThis persists for the life of the document and is
// wiped by a navigation — exactly the lifetime of an element number. Every FRAME
// of the tab is its own document with its own world: a snapshot numbers the
// frame's elements from 1 and keeps the map here, while the worker (tools.ts)
// runs snapshotPage in every frame, renumbers the merged list for the model and
// sends each action back to the element's own frame with the frame's number.

export interface SnapshotItem {
  n: number;
  role: string;
  name: string;
  state: string;
  submit: boolean;
  /** A password, one-time-code or payment field: never typed into, never read back. */
  secret: boolean;
  /** Where it sits in the tab's viewport (CSS px); absent in a cross-origin frame or off its frame's screen. */
  rect?: { x: number; y: number; w: number; h: number };
}

/** One frame's view of itself; the worker merges the frames into what the model reads. */
export interface FrameSnapshot {
  url: string;
  title: string;
  items: SnapshotItem[];
  /** The frame's main text, collapsed and capped at `textChars`. */
  excerpt: string;
  /** The frame's viewport in CSS px; the page's is what the picture shows. */
  viewport: { width: number; height: number };
}

export interface ActResult {
  ok: boolean;
  error?: string;
  /** Viewport coordinates of the element's centre, from `locate`. */
  x?: number;
  y?: number;
  /** Whether x/y are the tab's own viewport; false inside a cross-origin frame. */
  top?: boolean;
  /** Something lies over the element even after scrolling: a real click would hit that. */
  covered?: boolean;
  /** Appended to the tool result the model reads. */
  note?: string;
}

/** The Chat tab's context feed (unchanged from the original panel.js). */
export function extractPageContent(): {
  title: string;
  href: string;
  text: string;
} {
  const body = document.body;
  // A display:none iframe's document has no layout, and innerText on an element
  // that is not being rendered returns its whole textContent (HTML spec), so a
  // hidden helper frame would feed its markup's text as if it were on screen.
  const rendered =
    !body ||
    typeof body.checkVisibility !== 'function' ||
    body.checkVisibility();
  const text = body && rendered ? body.innerText || body.textContent || '' : '';
  return {
    title: document.title,
    href: location.href,
    text: text.slice(0, 100000),
  };
}

export function snapshotPage(
  maxItems: number,
  textChars: number,
  secretTokens: string[] = [],
): FrameSnapshot {
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
    // A div or paragraph a script made focusable is clickable too: custom
    // dropdowns list their choices this way, with no role at all.
    '[tabindex]:not([tabindex^="-"])',
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
    if (aria && aria.trim()) {
      // Siblings often share one label ("select option"); the element's own
      // words are what the user would say, so they ride along when they differ.
      const label = collapse(aria, 80);
      const own = collapse(textOf(el), 80);
      return own && /[\p{L}\p{N}]/u.test(own) && !label.includes(own)
        ? collapse(`${label}: ${own}`, 80)
        : label;
    }
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      // Ids are scoped to the element's own tree: a shadow root's or the document's.
      const scope = el.getRootNode() as Document | ShadowRoot;
      const text = labelledBy
        .split(/\s+/)
        .map((id) => textOf(scope.getElementById(id)))
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
      return 'textbox';
    }
    if (tag === 'textarea' || el.getAttribute('contenteditable') === 'true')
      return 'textbox';
    return el.hasAttribute('tabindex') ? 'focusable' : 'textbox';
  };
  const isSubmit = (el: Element): boolean => {
    if (el instanceof HTMLInputElement)
      return el.type === 'submit' || el.type === 'image';
    if (el instanceof HTMLButtonElement)
      return el.type === 'submit' && Boolean(el.form);
    return false;
  };
  // The fields the agent never types into are never read back either: what
  // the user typed there is theirs alone.
  const isSecret = (el: Element): boolean => {
    if (el instanceof HTMLInputElement && el.type === 'password') return true;
    const tokens = (el.getAttribute('autocomplete') || '')
      .toLowerCase()
      .split(/\s+/);
    return tokens.some((token) => (secretTokens || []).includes(token));
  };
  // This frame's place in the tab's viewport, summed up the iframe chain; null
  // past a cross-origin parent, whose layout is hidden from here.
  const frameOffset = (): { x: number; y: number } | null => {
    let x = 0;
    let y = 0;
    for (let win: Window = window; win !== win.top; win = win.parent) {
      const frame = win.frameElement as HTMLElement | null;
      if (!frame) return null;
      const box = frame.getBoundingClientRect();
      x += box.left + frame.clientLeft;
      y += box.top + frame.clientTop;
    }
    return { x, y };
  };
  const stateOf = (el: Element, role: string, secret: boolean): string => {
    const parts: string[] = [];
    if (role === 'textbox' || role === 'searchbox') {
      if (secret) {
        parts.push('secret');
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

  // Open shadow roots hold real controls (web-component apps, embedded widgets)
  // that querySelectorAll never enters: walk into each one in tree order, a
  // host's shadow content right after the host. Closed roots stay closed, and
  // `closest('[aria-hidden]')` below stops at the shadow boundary, so an
  // aria-hidden host still exposes its shadow content.
  const collect = (root: ParentNode, out: Element[]): void => {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (el.matches(SELECTOR)) out.push(el);
      if (el.shadowRoot) collect(el.shadowRoot, out);
    }
  };
  const candidates: Element[] = [];
  collect(document, candidates);

  const map = new Map<number, Element>();
  const items: SnapshotItem[] = [];
  const offset = frameOffset();
  for (const el of candidates) {
    if (items.length >= maxItems) break;
    if (el instanceof HTMLInputElement && el.type === 'hidden') continue;
    if (!visible(el) || el.closest('[aria-hidden="true"]')) continue;
    const role = roleOf(el);
    const secret = isSecret(el);
    const n = items.length + 1;
    map.set(n, el);
    const box = el.getBoundingClientRect();
    // Only on this frame's screen: the number is drawn at the tab position, and
    // an element scrolled out of the frame would put it on whatever shows there.
    const shown =
      box.left + box.width >= 0 &&
      box.top + box.height >= 0 &&
      box.left <= window.innerWidth &&
      box.top <= window.innerHeight;
    items.push({
      n,
      role,
      name: nameOf(el),
      state: stateOf(el, role, secret),
      submit: isSubmit(el),
      secret,
      ...(offset && shown
        ? {
            rect: {
              x: offset.x + box.left,
              y: offset.y + box.top,
              w: box.width,
              h: box.height,
            },
          }
        : {}),
    });
  }
  (globalThis as { __agentMap?: Map<number, Element> }).__agentMap = map;

  // What innerText makes of shadow content is Chrome's call, not ours.
  const main = document.querySelector('main') || document.body;
  return {
    url: location.href,
    title: document.title,
    items,
    excerpt: collapse(textOf(main), textChars),
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
}

export function actOnPage(
  n: number,
  action: string,
  value: string,
  submit: boolean,
  secretTokens: string[] = [],
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
  // This frame's place in the tab's viewport, summed up the iframe chain; null
  // past a cross-origin parent, whose layout is hidden from here.
  const frameOffset = (): { x: number; y: number } | null => {
    let x = 0;
    let y = 0;
    for (let win: Window = window; win !== win.top; win = win.parent) {
      const frame = win.frameElement as HTMLElement | null;
      if (!frame) return null;
      const box = frame.getBoundingClientRect();
      x += box.left + frame.clientLeft;
      y += box.top + frame.clientTop;
    }
    return { x, y };
  };
  // Instant, never the page's smooth scroll: the box is measured right after.
  const scrollTo = (block: ScrollLogicalPosition) => {
    if (typeof html.scrollIntoView === 'function')
      html.scrollIntoView({ block, inline: 'nearest', behavior: 'instant' });
  };
  scrollTo(action === 'scroll' ? 'center' : 'nearest');

  if (action === 'scroll') return { ok: true };

  const centreOf = () => {
    const box = html.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };
  const centre = centreOf();

  if (action === 'locate') {
    // A real click lands on whatever is at the point: the element, something
    // inside it or its shadow host is fine; anything else is in the way. The
    // parent page's overlays are not in this document, so each same-origin
    // ancestor must show this frame at the point too.
    const covered = (): boolean => {
      if (typeof document.elementFromPoint !== 'function') return false;
      const at = centreOf();
      const hit = document.elementFromPoint(at.x, at.y);
      let own = false;
      for (let node: Node | null = el; node && hit && !own; ) {
        own = node === hit || node.contains(hit);
        const root = node.getRootNode();
        node = root instanceof ShadowRoot ? root.host : null;
      }
      if (!own) return true;
      let { x, y } = at;
      for (let win: Window = window; win !== win.top; win = win.parent) {
        const frame = win.frameElement as HTMLElement | null;
        if (!frame) return false;
        const box = frame.getBoundingClientRect();
        x += box.left + frame.clientLeft;
        y += box.top + frame.clientTop;
        // ponytail: an iframe hosted in a shadow root reads as covered (the
        // scripted click still lands); getRootNode().elementFromPoint if needed.
        if (frame.ownerDocument.elementFromPoint(x, y) !== frame) return true;
      }
      return false;
    };
    let hidden = covered();
    if (hidden) {
      scrollTo('center');
      hidden = covered();
    }
    // After the last scroll: `center` moves the parent page too.
    const offset = frameOffset();
    const at = centreOf();
    return {
      ok: true,
      x: (offset ? offset.x : 0) + at.x,
      y: (offset ? offset.y : 0) + at.y,
      top: offset !== null,
      ...(hidden ? { covered: true } : {}),
    };
  }

  if (action === 'click') {
    if (typeof html.focus === 'function') html.focus();
    // Widgets that act on the press rather than the click (menus, drag
    // handles) see the sequence a mouse sends; click() stays last so links
    // navigate and submit buttons submit natively.
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      const Ctor =
        type.startsWith('pointer') && typeof PointerEvent === 'function'
          ? PointerEvent
          : MouseEvent;
      el.dispatchEvent(
        new Ctor(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: centre.x,
          clientY: centre.y,
          button: 0,
          buttons: type.endsWith('down') ? 1 : 0,
        }),
      );
    }
    html.click();
    return { ok: true };
  }

  // Everything the user has to type themselves. The prompt tells the model
  // not to touch these; this is what makes it true, and it is the only thing
  // that does — Approvals = Automatic raises no card, and a `type` without
  // `submit` raises none in either mode.
  //
  // `autocomplete` is a TOKEN LIST: an optional `section-*`, then an optional
  // `shipping`/`billing`, then the field name, optionally `webauthn`. So
  // `billing cc-number` is as ordinary as `cc-number` on a real checkout, and
  // testing the attribute as a whole let it through.
  const tokens = (el.getAttribute('autocomplete') || '')
    .toLowerCase()
    .split(/\s+/);
  const secret =
    (el instanceof HTMLInputElement && el.type === 'password') ||
    tokens.some((token) => (secretTokens || []).includes(token));
  const refused: ActResult = {
    ok: false,
    error:
      'Refused: this field takes a password or payment secret. Ask the user to type it themselves, then continue.',
  };

  // Real typing replaces a selection, so the field is focused and selected
  // whole here, behind the same refusal as `type`.
  if (action === 'prepare-type') {
    if (secret) return refused;
    if (typeof html.focus === 'function') html.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.select();
    } else if (
      html.isContentEditable ||
      el.getAttribute('contenteditable') === 'true'
    ) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      return { ok: false, error: 'Element cannot receive text.' };
    }
    return { ok: true, top: frameOffset() !== null };
  }

  if (action === 'type') {
    if (secret) return refused;
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
