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
  /** Elements the cap left out; what is on screen is listed first, so these are off it. */
  dropped?: number;
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

/**
 * The frame's elements, numbered from 1 — or, given `at` (viewport CSS px),
 * just the element at that point as item 0, leaving the frame's numbers alone.
 */
export function snapshotPage(
  maxItems: number,
  textChars: number,
  secretTokens: string[] = [],
  at?: { x: number; y: number },
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
    return el.hasAttribute('tabindex') ? 'focusable' : tag;
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
    if (el.getAttribute('aria-selected') === 'true') parts.push('selected');
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
      // The extension's own overlay is not the page — nor is anything under
      // it. The real overlay keeps its controls in a CLOSED shadow root, which
      // this walk cannot enter in any case; the attribute is the belt to that
      // pair of braces.
      if (el.closest('[data-ibl-agent-overlay]')) continue;
      if (el.matches(SELECTOR)) out.push(el);
      if (el.shadowRoot) collect(el.shadowRoot, out);
    }
  };
  // The topmost element at a point that belongs to the PAGE: the extension's
  // own overlay carries `OVERLAY_ATTR` and is stepped over, so a point under
  // the status bar still names what the user sees there.
  const pageAt = (doc: Document, x: number, y: number): Element | null => {
    if (typeof doc.elementsFromPoint === 'function') {
      for (const node of doc.elementsFromPoint(x, y))
        if (!node.hasAttribute('data-ibl-agent-overlay')) return node;
      return null;
    }
    if (typeof doc.elementFromPoint !== 'function') return null;
    const node = doc.elementFromPoint(x, y);
    return node && node.hasAttribute('data-ibl-agent-overlay') ? null : node;
  };
  // The element at a point of the viewport, through open shadow roots and
  // same-origin iframes; a cross-origin frame is as deep as this document sees.
  const elementAt = (x: number, y: number): Element | null => {
    if (typeof document.elementFromPoint !== 'function') return null;
    let el = pageAt(document, x, y);
    for (;;) {
      const inner = el?.shadowRoot?.elementFromPoint(x, y);
      if (inner && inner !== el) {
        el = inner;
        continue;
      }
      if (!el || el.tagName !== 'IFRAME') return el;
      const child = (el as HTMLIFrameElement).contentDocument;
      if (!child) return el;
      const box = el.getBoundingClientRect();
      x -= box.left + (el as HTMLElement).clientLeft;
      y -= box.top + (el as HTMLElement).clientTop;
      el = pageAt(child, x, y);
    }
  };
  const candidates: Element[] = [];
  if (at) {
    const hit = elementAt(at.x, at.y);
    if (hit) candidates.push(hit.closest(SELECTOR) ?? hit);
  } else {
    collect(document, candidates);
  }

  const usable = candidates.filter(
    (el) =>
      !(el instanceof HTMLInputElement && el.type === 'hidden') &&
      visible(el) &&
      !el.closest('[aria-hidden="true"]'),
  );
  const boxes = new Map(
    usable.map((el) => [el, el.getBoundingClientRect()] as const),
  );
  // On this frame's screen: the number is drawn at the tab position, and an
  // element scrolled out of the frame would put it on whatever shows there.
  const shown = (el: Element): boolean => {
    const box = boxes.get(el)!;
    return (
      box.left + box.width >= 0 &&
      box.top + box.height >= 0 &&
      box.left <= window.innerWidth &&
      box.top <= window.innerHeight
    );
  };
  // What is on screen comes first, so the cap cuts only what the user cannot
  // see either — never a dialog appended at the end of the document behind a
  // long list.
  const ordered = [
    ...usable.filter(shown),
    ...usable.filter((el) => !shown(el)),
  ];

  const map = new Map<number, Element>();
  const items: SnapshotItem[] = [];
  const offset = frameOffset();
  for (const el of ordered.slice(0, maxItems)) {
    const role = roleOf(el);
    const secret = isSecret(el);
    const n = at ? 0 : items.length + 1;
    map.set(n, el);
    const box = boxes.get(el)!;
    items.push({
      n,
      role,
      name: nameOf(el),
      state: stateOf(el, role, secret),
      submit: isSubmit(el),
      secret,
      ...(offset && shown(el)
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
  if (!at)
    (globalThis as { __agentMap?: Map<number, Element> }).__agentMap = map;

  // A page behind a modal keeps its layout and its innerText, and only
  // aria-hidden says it is out of reach, so the text skips those blocks too.
  // A block with no box of its own (display: contents) is still on screen.
  const onScreen = (el: Element): boolean =>
    visible(el) || getComputedStyle(el).display === 'contents';
  // Rendered text only: a block holding nothing but hidden content has an
  // empty innerText, and textContent would read that hidden content back.
  const rendered = (el: Element): string => {
    const text = (el as HTMLElement).innerText;
    return typeof text === 'string' ? text : el.textContent || '';
  };
  const readable = (root: Element): string =>
    Array.from(root.childNodes)
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
        const el = node as Element;
        return el.nodeType === Node.ELEMENT_NODE &&
          el.getAttribute('aria-hidden') !== 'true' &&
          onScreen(el)
          ? rendered(el)
          : '';
      })
      .join(' ');
  // What innerText makes of shadow content is Chrome's call, not ours.
  const inMain = document.querySelector('main');
  const main =
    inMain && !inMain.closest('[aria-hidden="true"]') && onScreen(inMain)
      ? inMain
      : document.body;
  return {
    url: location.href,
    title: document.title,
    items,
    excerpt: at ? '' : collapse(readable(main), textChars),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    dropped: ordered.length - items.length,
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
  // 0 is whatever holds the focus here, through open shadow roots: the field a
  // click by position has just focused. A frame without one answers so.
  const focused = (): Element | null => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el &&
      el !== document.body &&
      el !== document.documentElement &&
      el.tagName !== 'IFRAME'
      ? el
      : null;
  };
  const el = n === 0 ? focused() : map ? map.get(n) : undefined;
  if (!el || !el.isConnected) {
    return {
      ok: false,
      error:
        n === 0
          ? 'Nothing is focused.'
          : `Element ${n} is not in the current snapshot; call read_page and use a fresh number.`,
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
    // The extension's own overlay is not part of the page: tools.ts takes it
    // out of the way before a real click lands, so counting it as a cover
    // would send every element beneath the status bar down the scripted path.
    const pageAt = (doc: Document, x: number, y: number): Element | null => {
      if (typeof doc.elementsFromPoint === 'function') {
        for (const node of doc.elementsFromPoint(x, y))
          if (!node.hasAttribute('data-ibl-agent-overlay')) return node;
        return null;
      }
      if (typeof doc.elementFromPoint !== 'function') return null;
      const node = doc.elementFromPoint(x, y);
      return node && node.hasAttribute('data-ibl-agent-overlay') ? null : node;
    };
    const covered = (): boolean => {
      if (typeof document.elementFromPoint !== 'function') return false;
      const at = centreOf();
      const hit = pageAt(document, at.x, at.y);
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
        if (pageAt(frame.ownerDocument, x, y) !== frame) return true;
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

  if (action === 'click' || action === 'dblclick') {
    if (typeof html.focus === 'function') html.focus();
    const mouse = (type: string, detail: number) => {
      const Ctor =
        type.startsWith('pointer') && typeof PointerEvent === 'function'
          ? PointerEvent
          : MouseEvent;
      el.dispatchEvent(
        new Ctor(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          detail,
          clientX: centre.x,
          clientY: centre.y,
          button: 0,
          buttons: type.endsWith('down') ? 1 : 0,
        }),
      );
    };
    // Widgets that act on the press rather than the click (menus, drag
    // handles) see the sequence a mouse sends; click() stays last so links
    // navigate and submit buttons submit natively.
    const clicks = action === 'dblclick' ? 2 : 1;
    for (let detail = 1; detail <= clicks; detail++) {
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup'])
        mouse(type, detail);
      html.click();
    }
    if (clicks === 2) mouse('dblclick', 2);
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

/**
 * Marks the extension's own on-page UI. Nothing carrying it is part of the
 * page: the reader skips it, the hit tests see through it, and the model is
 * never shown it. The attribute is repeated as a literal inside each injected
 * function below, which must re-evaluate in an empty scope; the self-contained
 * test in page-scripts.test.ts pins those literals to this constant.
 */
export const OVERLAY_ATTR = 'data-ibl-agent-overlay';

/** The message the overlay's Stop button sends to the service worker. */
export const HUD_STOP = 'MENTOR:HUD_STOP';

export interface HudOptions {
  /** Brand colour — everything the overlay paints derives from it. */
  color: string;
  /** What is happening right now, already in the user's language. */
  status: string;
  /** The Stop button's word, and what the bar says once it is pressed. */
  stop: string;
  stopping: string;
  /** The accessible name of the bar as a whole. */
  label: string;
  /** Takes itself down once the worker stops refreshing it: a worker can die. */
  watchdogMs: number;
  /** The element about to be acted on, in the tab's viewport (CSS px). */
  target?: { x: number; y: number; w: number; h: number } | null;
  /**
   * Counts presses, rather than flagging one.
   *
   * The overlay is re-painted on a heartbeat with whatever state the worker
   * holds, so a boolean left standing would replay the click every beat for as
   * long as the pointer rested on that element. The page animates only when
   * this number changes.
   */
  pressId?: number;
}

interface HudState {
  host: HTMLElement;
  bar: HTMLElement;
  say: HTMLElement;
  stop: HTMLButtonElement;
  spot: HTMLElement;
  /** The pointer that travels to each target, and its last resting place. */
  arrow: HTMLElement;
  at: { x: number; y: number } | null;
  /** The last press this overlay has already shown. */
  pressed: number;
  beat: number;
  timer: number;
}

/**
 * Puts the overlay on the page, or brings the one already there up to date —
 * one call does both, so the worker can beat on it to keep it alive and to
 * put it back after a navigation without tracking which it is doing.
 */
export function mountHud(options: HudOptions): void {
  const root = document.documentElement;
  if (!root) return;
  const store = globalThis as { __iblHud?: HudState };
  // A navigation takes the element but not this world's view of it.
  if (store.__iblHud && !store.__iblHud.host.isConnected) delete store.__iblHud;
  let hud = store.__iblHud;

  if (!hud) {
    const rgb = (hex: string): string => {
      const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (!match) return '36, 103, 235';
      const value = parseInt(match[1], 16);
      return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
    };
    const host = document.createElement('div');
    host.setAttribute('data-ibl-agent-overlay', '');
    // Appended to <html>, never to <body>: the page reader takes its text from
    // <main> or body, so out here the words below cannot land in it.
    root.appendChild(host);
    // Closed, so the reader — which walks only OPEN shadow roots — cannot
    // descend into it: the model never sees the extension's own controls, and
    // so can never be tempted to click Stop.
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
:host { all: initial; --c: ${options.color}; --rgb: ${rgb(options.color)}; }
.ring, .bar, .spot, .arrow { position: fixed; z-index: 2147483647; pointer-events: none; }
.ring { inset: 0; border: 3px solid var(--c); border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .5), inset 0 0 26px rgba(var(--rgb), .17);
  animation: iblBreathe 3.2s ease-in-out infinite; }
.bar { left: 50%; bottom: 18px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px;
  padding: 7px 8px 7px 14px; border-radius: 999px;
  background: #fff; color: #111827; border: 1px solid var(--c);
  box-shadow: 0 8px 26px rgba(17, 24, 39, .18), 0 0 0 4px rgba(var(--rgb), .16);
  font: 500 13px/1.35 ui-sans-serif, system-ui, -apple-system, sans-serif;
  max-width: min(520px, 86vw); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c);
  flex: none; animation: iblPulse 1.4s ease-in-out infinite; }
.say { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stop { pointer-events: auto; cursor: pointer; flex: none; font: inherit;
  font-weight: 600; color: #fff; background: var(--c); border: 0;
  border-radius: 999px; padding: 5px 12px; }
.stop:disabled { opacity: .55; cursor: default; }
.spot { border: 2px solid var(--c); border-radius: 6px;
  box-shadow: 0 0 0 4px rgba(var(--rgb), .2); transition: all .12s ease-out; }
/* The pointer. Travelling is the whole point of it: a ring that simply moves
   says a box lit up, while something crossing the page says someone is doing
   this. Positioned with left/top rather than a transform so it reads in the
   same viewport coordinates the worker already sends for the target.
   (No backticks in here: this stylesheet is a template literal.) */
.arrow { left: 0; top: 0; width: 22px; height: 22px; margin: -2px 0 0 -2px;
  transition: left .34s cubic-bezier(.22, .61, .36, 1),
    top .34s cubic-bezier(.22, .61, .36, 1); }
.arrow svg { display: block; width: 100%; height: 100%;
  filter: drop-shadow(0 2px 4px rgba(17, 24, 39, .35)); }
/* The press. Scaled from the pointer's own tip, so it reads as that pointer
   clicking rather than a mark appearing beside it. */
.arrow::after { content: ''; position: absolute; left: 1px; top: 1px;
  width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%;
  border: 2px solid var(--c); opacity: 0; transform: scale(.3); }
.arrow.tap::after { animation: iblTap .45s ease-out; }
@keyframes iblTap { 0% { opacity: .9; transform: scale(.3); }
  100% { opacity: 0; transform: scale(2.6); } }
.off { display: none !important; }
@keyframes iblPulse { 0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .35; transform: scale(.75); } }
@keyframes iblBreathe { 0%, 100% { opacity: 1; } 50% { opacity: .7; } }
@media (prefers-reduced-motion: reduce) {
  .dot, .ring { animation: none; } .spot, .arrow { transition: none; }
  .arrow.tap::after { animation: none; } }`;
    const ring = document.createElement('div');
    ring.className = 'ring';
    const spot = document.createElement('div');
    spot.className = 'spot off';
    const arrow = document.createElement('div');
    arrow.className = 'arrow off';
    // Inline so the overlay stays one injected function with no fetch: the
    // page's CSP governs what we can load, and an overlay that sometimes has
    // no pointer is worse than one that always does.
    arrow.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M5 2.5 19 12l-6.4 1.3L9.8 19.5Z" fill="var(--c)" ' +
      'stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.setAttribute('role', 'status');
    const dot = document.createElement('span');
    dot.className = 'dot';
    const say = document.createElement('span');
    say.className = 'say';
    const stop = document.createElement('button');
    stop.className = 'stop';
    stop.type = 'button';
    stop.addEventListener('click', () => {
      stop.disabled = true;
      say.textContent = options.stopping;
      // The page itself can never reach the worker here: with no
      // externally_connectable, only the extension's own injected scripts may
      // send on this channel.
      try {
        chrome.runtime.sendMessage({ type: 'MENTOR:HUD_STOP' });
      } catch {
        // The worker is already gone; the watchdog below clears the bar.
      }
    });
    bar.append(dot, say, stop);
    shadow.append(style, ring, spot, arrow, bar);
    hud = {
      host,
      bar,
      say,
      stop,
      spot,
      arrow,
      at: null,
      // Zero, not the incoming id: seeding from it would swallow the very
      // first click of a run, which is the one most worth showing. A fresh
      // overlay after a navigation replays the last press once, which is the
      // right reading — that page has not shown it yet.
      pressed: 0,
      beat: Date.now(),
      timer: 0,
    };
    // Nothing else can take the overlay down — a worker killed mid-run cannot
    // reach back into the page — so it has to be able to take itself down.
    hud.timer = setInterval(() => {
      const live = (globalThis as { __iblHud?: HudState }).__iblHud;
      if (!live || Date.now() - live.beat <= options.watchdogMs) return;
      clearInterval(live.timer);
      live.host.remove();
      delete (globalThis as { __iblHud?: HudState }).__iblHud;
    }, 1000) as unknown as number;
    store.__iblHud = hud;
  }

  hud.beat = Date.now();
  // Once Stop is pressed the bar says so until the run actually ends; a beat
  // still in flight must not write the old action back over it.
  if (!hud.stop.disabled) {
    hud.say.textContent = options.status;
    hud.stop.textContent = options.stop;
  }
  hud.bar.setAttribute('aria-label', options.label);
  const target = options.target;
  if (target && target.w > 0 && target.h > 0) {
    hud.spot.style.left = `${target.x}px`;
    hud.spot.style.top = `${target.y}px`;
    hud.spot.style.width = `${target.w}px`;
    hud.spot.style.height = `${target.h}px`;
    hud.spot.classList.remove('off');

    const to = {
      x: Math.round(target.x + target.w / 2),
      y: Math.round(target.y + target.h / 2),
    };
    const moved = !hud.at || hud.at.x !== to.x || hud.at.y !== to.y;
    if (moved) {
      // First sight of a target: start at it rather than flying in from the
      // page's corner, which looks like a bug on the first action of a run.
      if (!hud.at) hud.arrow.style.transition = 'none';
      hud.arrow.style.left = `${to.x}px`;
      hud.arrow.style.top = `${to.y}px`;
      if (!hud.at) {
        // Read back so the suppressed transition applies before it is restored.
        void hud.arrow.offsetWidth;
        hud.arrow.style.transition = '';
      }
      hud.at = to;
    }
    hud.arrow.classList.remove('off');
    const press = options.pressId ?? 0;
    if (press !== hud.pressed) {
      hud.pressed = press;
      // Restart the animation rather than just setting the class: a second
      // press in the same place would otherwise show nothing at all.
      hud.arrow.classList.remove('tap');
      void hud.arrow.offsetWidth;
      hud.arrow.classList.add('tap');
    }
  } else {
    hud.spot.classList.add('off');
    hud.arrow.classList.add('off');
    hud.at = null;
  }
}

/**
 * Takes the overlay out of the way, or puts it back. Given a point, it steps
 * aside only if the bar is actually over it — a real click lands on whatever
 * is at the point, and the bar must never be what it lands on.
 *
 * Resolves a frame after the change is painted, so a capture taken next cannot
 * still show it.
 */
export function setHudHidden(payload: {
  hidden: boolean;
  point?: { x: number; y: number } | null;
}): Promise<boolean> {
  const store = globalThis as { __iblHud?: HudState };
  const hud = store.__iblHud;
  if (!hud || !hud.host.isConnected) return Promise.resolve(false);
  if (payload.hidden && payload.point) {
    const box = hud.bar.getBoundingClientRect();
    const point = payload.point;
    const over =
      point.x >= box.left &&
      point.x <= box.right &&
      point.y >= box.top &&
      point.y <= box.bottom;
    if (!over) return Promise.resolve(false);
  }
  hud.host.style.display = payload.hidden ? 'none' : '';
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
  });
}

/** Takes the overlay off the page, including one an earlier run left behind. */
export function removeHud(): void {
  const store = globalThis as { __iblHud?: HudState };
  const hud = store.__iblHud;
  if (hud) {
    clearInterval(hud.timer);
    hud.host.remove();
    delete store.__iblHud;
  }
  const strays = document.querySelectorAll('[data-ibl-agent-overlay]');
  for (const stray of Array.from(strays)) stray.remove();
}

/** The message an injected watcher sends the worker for each thing the user does. */
export const RECORDER_STEP = 'MENTOR:RECORDER_STEP';

export interface RecordedEvent {
  kind: 'click' | 'input' | 'change' | 'submit' | 'flush';
  role: string;
  name: string;
  /** Absent for a secret field: what the user typed there is theirs alone. */
  value?: string;
  secret: boolean;
  url: string;
  frameUrl?: string;
}

/**
 * Watches one frame and reports what the user does, already named.
 *
 * Resolution happens here, synchronously, from `event.target`: asking the
 * worker would answer about the page a moment later — after the click opened a
 * menu, or navigated — and `change`, `submit` and `blur` carry no coordinates
 * to resolve from at all.
 *
 * The naming rules are `snapshotPage`'s, repeated because an injected function
 * is re-evaluated in an empty scope and may import nothing.
 * `page-scripts.test.ts` holds the two in agreement.
 */
export function watchPage(secretTokens: string[]): void {
  const store = globalThis as { __iblRecorder?: () => void };
  if (store.__iblRecorder) return;

  const collapse = (text: string, max: number): string => {
    const flat = (text || '').replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
  };

  const textOf = (el: Element): string =>
    collapse((el as HTMLElement).innerText || el.textContent || '', 80);

  const nameOf = (el: Element): string => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return collapse(aria, 80);
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((node) => textOf(node as Element))
        .join(' ');
      if (text.trim()) return collapse(text, 80);
    }
    const id = el.getAttribute('id');
    if (id) {
      const labels = document.querySelectorAll(
        `label[for="${CSS.escape(id)}"]`,
      );
      const text = Array.from(labels)
        .map((label) => textOf(label))
        .join(' ');
      if (text.trim()) return collapse(text, 80);
    }
    const wrapping = el.closest('label');
    if (wrapping && textOf(wrapping).trim())
      return collapse(textOf(wrapping), 80);
    for (const attr of ['placeholder', 'title', 'alt', 'name']) {
      const value = el.getAttribute(attr);
      if (value && value.trim()) return collapse(value, 80);
    }
    if (el instanceof HTMLSelectElement) return '';
    return textOf(el);
  };

  const roleOf = (el: Element): string => {
    const role = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
    if (role) return role.toLowerCase();
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'input') {
      const type = (el as HTMLInputElement).type;
      if (type === 'submit' || type === 'button' || type === 'reset')
        return 'button';
      if (type === 'checkbox' || type === 'radio') return type;
      return 'textbox';
    }
    if (tag === 'textarea' || el.getAttribute('contenteditable') === 'true')
      return 'textbox';
    return el.hasAttribute('tabindex') ? 'focusable' : tag;
  };

  const isSecret = (el: Element): boolean => {
    if (el instanceof HTMLInputElement && el.type === 'password') return true;
    const tokens = (el.getAttribute('autocomplete') || '')
      .toLowerCase()
      .split(/\s+/);
    return tokens.some((token) => (secretTokens || []).includes(token));
  };

  const valueOf = (el: Element): string | undefined => {
    if (el instanceof HTMLSelectElement)
      return el.selectedOptions[0]?.text ?? '';
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      return el.value;
    return undefined;
  };

  const report = (kind: RecordedEvent['kind'], target: EventTarget | null) => {
    const el =
      target instanceof Element
        ? (target.closest(
            'a, button, input, select, textarea, summary, [role], [contenteditable="true"], [tabindex]',
          ) ?? target)
        : null;
    if (!el) return;
    const secret = isSecret(el);
    const step: RecordedEvent = {
      kind,
      role: roleOf(el),
      name: nameOf(el),
      secret,
      url: location.href,
      ...(window.top === window.self ? {} : { frameUrl: location.href }),
    };
    if (!secret && kind !== 'click' && kind !== 'submit') {
      const value = valueOf(el);
      if (value !== undefined) step.value = value;
    }
    try {
      chrome.runtime.sendMessage({ type: 'MENTOR:RECORDER_STEP', step });
    } catch {
      // The worker is gone; recording is over either way.
    }
  };

  const onClick = (event: Event) => report('click', event.target);
  const onChange = (event: Event) => report('change', event.target);
  const onSubmit = (event: Event) => report('submit', event.target);
  // Typing is reported when it settles, not per keystroke: the worker would
  // otherwise coalesce a message per character.
  const onBlur = (event: Event) => report('input', event.target);
  const onKeyDown = (event: Event) => {
    if ((event as KeyboardEvent).key === 'Enter') report('input', event.target);
  };

  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('blur', onBlur, true);
  document.addEventListener('keydown', onKeyDown, true);

  store.__iblRecorder = () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('submit', onSubmit, true);
    document.removeEventListener('blur', onBlur, true);
    document.removeEventListener('keydown', onKeyDown, true);
    delete store.__iblRecorder;
  };
}

/** Stops a watcher this frame already has; safe where none was installed. */
export function unwatchPage(): void {
  const store = globalThis as { __iblRecorder?: () => void };
  store.__iblRecorder?.();
}
