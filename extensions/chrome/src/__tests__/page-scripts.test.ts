import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actOnPage,
  extractPageContent,
  mountHud,
  OVERLAY_ATTR,
  removeHud,
  scrollPage,
  setHudHidden,
  snapshotPage,
  waitForQuiet,
  watchPage,
  unwatchPage,
  type RecordedEvent,
} from '../page-scripts';
import { SECRET_FIELDS } from '../secret-fields';

const FIXTURE = `
<main>
  <h1>Sign in</h1>
  <form id="f">
    <label for="email">Email</label><input id="email" type="text" value="">
    <input id="pw" type="password" aria-label="Password" value="secret">
    <input type="hidden" name="csrf" value="x">
    <button type="submit">Continue</button>
  </form>
  <a href="/forgot">Forgot password?</a>
  <button hidden>Hidden</button>
  <div aria-hidden="true"><button>Ghost</button></div>
  <select id="lang"><option value="en">English</option><option value="fr">Français</option></select>
  <input type="checkbox" id="c" checked><label for="c">Remember me</label>
  <div contenteditable="true" id="ed"></div>
  <button aria-expanded="false" title="Menu"><img alt="Open menu"></button>
  <input id="cc" autocomplete="cc-number" placeholder="Card number" value="4242 4242 4242 4242">
  <span id="lbl">Search</span><input id="q" aria-labelledby="lbl" value="  hello   world  ">
  <button type="button">Pay now</button>
  <p>Welcome to Acme. Sign in to continue.</p>
</main>`;

const agentMap = () =>
  (globalThis as { __agentMap?: Map<number, Element> }).__agentMap;

beforeEach(() => {
  Object.defineProperty(HTMLFormElement.prototype, 'requestSubmit', {
    configurable: true,
    value(this: HTMLFormElement) {
      this.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    },
  });
});

beforeEach(() => {
  document.body.innerHTML = FIXTURE;
  // jsdom cannot submit a form; keep implicit submissions from logging.
  document.body.addEventListener('submit', (e) => e.preventDefault());
});

afterEach(() => {
  delete (globalThis as { __agentMap?: unknown }).__agentMap;
});

describe('injected functions stay self-contained', () => {
  it.each([
    ['extractPageContent', extractPageContent],
    ['snapshotPage', snapshotPage],
    ['actOnPage', actOnPage],
    ['scrollPage', scrollPage],
    ['waitForQuiet', waitForQuiet],
    ['mountHud', mountHud],
    ['setHudHidden', setHudHidden],
    ['removeHud', removeHud],
  ])('%s re-evaluates in an empty scope', (_name, fn) => {
    const source = fn.toString();
    // Istanbul rewrites bodies with module-level counters under --coverage; the
    // check only means something on the plain source.
    if (/cov_[a-z0-9]+\(\)/.test(source)) return;
    const rebuilt = new Function(`return (${source})`)() as typeof fn;
    expect(typeof rebuilt).toBe('function');
    if (fn === snapshotPage) {
      const snapshot = (rebuilt as typeof snapshotPage)(50, 100);
      expect(snapshot.items.length).toBeGreaterThan(0);
    }
  });
});

describe('extractPageContent', () => {
  it('returns title, href and the body text', () => {
    document.title = 'Acme';
    const content = extractPageContent();
    expect(content.title).toBe('Acme');
    expect(content.href).toBe(location.href);
    expect(content.text).toContain('Welcome to Acme');
  });

  // A display:none iframe's document: innerText there is the whole textContent.
  it('returns no text for a document that is not rendered', () => {
    Object.defineProperty(document.body, 'checkVisibility', {
      configurable: true,
      value: () => false,
    });
    try {
      expect(extractPageContent().text).toBe('');
    } finally {
      delete (document.body as { checkVisibility?: unknown }).checkVisibility;
    }
  });
});

describe('snapshotPage', () => {
  it('numbers the visible interactive elements in order and stores the map', () => {
    const snapshot = snapshotPage(200, 1500, SECRET_FIELDS);
    const lines = snapshot.items.map(
      (item) =>
        `[${item.n}] ${item.role} "${item.name}"${item.state ? ` (${item.state})` : ''}`,
    );
    expect(lines).toEqual([
      '[1] heading "Sign in"',
      '[2] textbox "Email" (empty)',
      '[3] textbox "Password" (secret)',
      '[4] button "Continue" (submit)',
      '[5] link "Forgot password?"',
      '[6] combobox "" (selected: "English")',
      '[7] checkbox "Remember me" (checked)',
      '[8] textbox "" (empty)',
      '[9] button "Menu" (collapsed)',
      '[10] textbox "Card number" (secret)',
      '[11] textbox "Search" (value: "hello world")',
      '[12] button "Pay now"',
    ]);
    expect(snapshot.excerpt).toContain('Welcome to Acme');
    expect(agentMap()?.get(4)).toBe(
      document.querySelector('button[type=submit]'),
    );
    expect(snapshot.items[2]).toMatchObject({ secret: true, submit: false });
    expect(snapshot.items[3]).toMatchObject({ secret: false, submit: true });
    // What the user typed into a payment field is theirs: never read back.
    expect(JSON.stringify(snapshot)).not.toContain('4242');
  });

  // Custom dropdowns list their choices as focusable paragraphs with no role
  // and one shared aria-label; the words the user would say must survive.
  it('lists focusable elements as clickable, named by their own words beside a shared label', () => {
    document.body.innerHTML = `
      <span tabindex="0" role="button" aria-label="open dropdown options"></span>
      <p tabindex="0" aria-label="select option">New residents - transfer license</p>
      <p tabindex="0" aria-label="select option">CDL knowledge test</p>
      <div tabindex="-1">Programmatic focus only</div>
      <button aria-label="Close">×</button>
      <span tabindex="0">Plain focusable</span>
      <input type="text" tabindex="0" aria-label="Name" value="Name">`;
    const names = snapshotPage(200, 100).items.map(
      (item) => `${item.role}:${item.name}`,
    );
    expect(names).toEqual([
      'button:open dropdown options',
      'focusable:select option: New residents - transfer license',
      'focusable:select option: CDL knowledge test',
      'button:Close',
      'focusable:Plain focusable',
      'textbox:Name',
    ]);
  });

  it('masks every secret field it is told about, and only those', () => {
    document.body.innerHTML = `
      <input id="a" autocomplete="billing cc-number" value="4111">
      <input id="b" autocomplete="ONE-TIME-CODE" value="123456">
      <input id="c" autocomplete="email" value="jane@example.com">`;
    const states = snapshotPage(200, 100, SECRET_FIELDS).items.map(
      (item) => item.state,
    );
    expect(states).toEqual(['secret', 'secret', 'value: "jane@example.com"']);
    expect(snapshotPage(200, 100).items.map((item) => item.secret)).toEqual([
      false,
      false,
      false,
    ]);
  });

  // Google Drive's file viewer: the folder behind it keeps its layout, so its
  // innerText read as the page and the agent believed it was back on the list.
  it('leaves the page behind a modal out of the text', () => {
    document.body.innerHTML = `
      <div aria-hidden="true">
        <h1>Shared with me</h1>
        <p>Folder path. Name Owner Date modified.</p>
      </div>
      <div><button aria-label="Close"></button><h2>demo.webm</h2><p>Playing.</p></div>`;
    const snapshot = snapshotPage(200, 300);
    expect(snapshot.excerpt).toContain('demo.webm');
    expect(snapshot.excerpt).toContain('Playing.');
    expect(snapshot.excerpt).not.toContain('Shared with me');
    expect(snapshot.excerpt).not.toContain('Folder path');
    expect(snapshot.items.map((item) => item.name)).toEqual([
      'Close',
      'demo.webm',
    ]);
  });

  // The same page with a <main>: it is the excerpt's source until a modal
  // covers it, and then the body's own blocks are what is left on screen.
  it('reads the overlay rather than a main the modal covers', () => {
    document.body.innerHTML = `
      <div aria-hidden="true"><main><p>Folder list.</p></main></div>
      <div><p>Viewer.</p></div>`;
    expect(snapshotPage(200, 300).excerpt).toBe('Viewer.');
    document.body.innerHTML = `
      <div><main><p>Folder list.</p></main></div>
      <div aria-hidden="true"><p>Hidden helper.</p></div>`;
    expect(snapshotPage(200, 300).excerpt).toBe('Folder list.');
  });

  // Chrome's checkVisibility() is false for display: contents (no box of its
  // own), which read a whole app root, or a <main>, as hidden.
  it('reads a display: contents block that checkVisibility calls hidden', () => {
    document.body.innerHTML = `
      <header>Header</header>
      <main style="display: contents"><p>Main text.</p></main>`;
    const hidden = { configurable: true, value: () => false };
    Object.defineProperty(
      document.querySelector('main')!,
      'checkVisibility',
      hidden,
    );
    expect(snapshotPage(200, 300).excerpt).toBe('Main text.');
    document.body.innerHTML = `<div style="display: contents"><p>Root text.</p></div>`;
    Object.defineProperty(
      document.querySelector('div')!,
      'checkVisibility',
      hidden,
    );
    expect(snapshotPage(200, 300).excerpt).toBe('Root text.');
  });

  // Chrome's innerText of a block holding only hidden content is empty, and
  // the textContent fallback read that hidden content as the page.
  it('leaves out what a block does not render', () => {
    document.body.innerHTML = `
      <p>Real text.</p>
      <div><div hidden>Hidden dialog.</div></div>
      <div>Shown.</div>`;
    const [, hiddenOnly, shown] = Array.from(document.body.children);
    Object.defineProperty(hiddenOnly, 'innerText', {
      configurable: true,
      value: '',
    });
    Object.defineProperty(shown, 'innerText', {
      configurable: true,
      value: 'Shown.',
    });
    expect(snapshotPage(200, 300).excerpt).toBe('Real text. Shown.');
  });

  it('caps the number of items and the text excerpt', () => {
    const snapshot = snapshotPage(3, 12);
    expect(snapshot.items).toHaveLength(3);
    expect(agentMap()?.size).toBe(3);
    expect(snapshot.excerpt.length).toBeLessThanOrEqual(12);
    expect(snapshot.excerpt.endsWith('…')).toBe(true);
  });

  it('lists controls inside open shadow roots in place, named within their root, and not closed ones', () => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML =
      '<button>Shadow btn</button><span id="l">Lbl</span><input aria-labelledby="l">';
    const sealed = document.createElement('div');
    sealed.attachShadow({ mode: 'closed' }).innerHTML =
      '<button>Sealed</button>';
    document.querySelector('main')!.append(host, sealed);
    const snapshot = snapshotPage(200, 100);
    const names = snapshot.items.map(
      (item) => `${item.n}:${item.role}:${item.name}`,
    );
    expect(names).toContain('13:button:Shadow btn');
    expect(names).toContain('14:textbox:Lbl');
    expect(names.join()).not.toContain('Sealed');
    const onClick = vi.fn();
    host
      .shadowRoot!.querySelector('button')!
      .addEventListener('click', onClick);
    expect(actOnPage(13, 'click', '', false)).toEqual({ ok: true });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses checkVisibility when the browser has it', () => {
    const original = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'checkVisibility',
    );
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      configurable: true,
      value(this: HTMLElement) {
        return this.id !== 'email';
      },
    });
    try {
      const snapshot = snapshotPage(200, 100);
      expect(snapshot.items.map((item) => item.name)).not.toContain('Email');
      expect(snapshot.items.map((item) => item.name)).toContain('Password');
    } finally {
      if (original)
        Object.defineProperty(
          HTMLElement.prototype,
          'checkVisibility',
          original,
        );
      else
        delete (HTMLElement.prototype as { checkVisibility?: unknown })
          .checkVisibility;
    }
  });

  it('names elements by aria-label, label, placeholder, title, alt, value or text', () => {
    document.body.innerHTML = `
      <button aria-label="Close"><img alt="x"></button>
      <button><img alt="Open menu"></button>
      <input type="submit" value="Go">
      <button aria-labelledby="missing"></button>
      <label>Nick <input id="nick"></label>
      <textarea placeholder="Notes"></textarea>
      <div role="button tab">Role first</div>
      <input type="image" alt="Buy">`;
    const names = snapshotPage(200, 100).items.map(
      (item) => `${item.role}:${item.name}`,
    );
    expect(names).toEqual([
      'button:Close',
      'button:Open menu',
      'button:Go',
      'button:',
      'textbox:Nick',
      'textbox:Notes',
      'button:Role first',
      'button:Buy',
    ]);
  });

  it('reports switches, disabled controls, expanded and selected state', () => {
    document.body.innerHTML = `
      <div role="switch" aria-checked="true">Dark</div>
      <button disabled>Save</button>
      <button aria-disabled="true">Later</button>
      <button aria-expanded="true">More</button>
      <div role="row" aria-selected="true" tabindex="0">Report.pdf</div>
      <div contenteditable="true">Draft text</div>`;
    const states = snapshotPage(200, 100).items.map((item) => item.state);
    expect(states).toEqual([
      'checked',
      'disabled',
      'disabled',
      'expanded',
      'selected',
      'value: "Draft text"',
    ]);
  });
});

/** A 100×40 box at (left, top) in this frame's viewport. */
const box = (el: Element | null, left: number, top: number) =>
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left, top, width: 100, height: 40 }),
  });

describe('actOnPage', () => {
  it('refuses a number that is not in the current snapshot', () => {
    expect(actOnPage(1, 'click', '', false)).toMatchObject({ ok: false });
    snapshotPage(200, 100);
    expect(actOnPage(99, 'click', '', false).error).toMatch(
      /not in the current snapshot/,
    );
  });

  it('refuses an element that left the document', () => {
    snapshotPage(200, 100);
    document.querySelector('#email')?.remove();
    expect(actOnPage(2, 'click', '', false).ok).toBe(false);
  });

  it('clicks and focuses the element', () => {
    snapshotPage(200, 100);
    const onClick = vi.fn();
    document
      .querySelector('button[type=submit]')
      ?.addEventListener('click', onClick);
    expect(actOnPage(4, 'click', '', false)).toEqual({ ok: true });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // Menus and drag handles act on the press, not the click.
  it('sends the sequence a mouse sends before the click', () => {
    snapshotPage(200, 100);
    const seen: string[] = [];
    const button = document.querySelector('button[type=submit]')!;
    for (const type of [
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ])
      button.addEventListener(type, (e) => {
        seen.push(`${type}${e instanceof MouseEvent ? ':mouse' : ''}`);
      });
    actOnPage(4, 'click', '', false);
    expect(seen).toEqual([
      'pointerdown:mouse',
      'mousedown:mouse',
      'pointerup:mouse',
      'mouseup:mouse',
      'click:mouse',
    ]);
  });

  // A file in a list opens on the second click, which the page counts.
  it('double-clicks: the sequence twice, counted, then dblclick', () => {
    snapshotPage(200, 100);
    const seen: string[] = [];
    const button = document.querySelector('button[type=submit]')!;
    for (const type of ['mousedown', 'mouseup', 'click', 'dblclick'])
      button.addEventListener(type, (e) => {
        seen.push(`${type}:${(e as MouseEvent).detail}`);
      });
    expect(actOnPage(4, 'dblclick', '', false)).toEqual({ ok: true });
    expect(seen).toEqual([
      'mousedown:1',
      'mouseup:1',
      'click:0',
      'mousedown:2',
      'mouseup:2',
      'click:0',
      'dblclick:2',
    ]);
  });

  // jsdom's own elementFromPoint answers null, which reads as off-screen.
  const hitting = (el: Element | null) => {
    const hit = vi.fn<() => Element | null>(() => el);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: hit,
    });
    return hit;
  };
  afterEach(() => {
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
  });
  const scrollSpy = (el: Element) => {
    const scrolls: ScrollIntoViewOptions[] = [];
    Object.defineProperty(el, 'scrollIntoView', {
      configurable: true,
      value: (options: ScrollIntoViewOptions) => scrolls.push(options),
    });
    return scrolls;
  };

  it('locates an element by the centre of its box, after an instant scroll', () => {
    snapshotPage(200, 100);
    const link = document.querySelector('a')!;
    const scrolls = scrollSpy(link);
    box(link, 10, 20);
    hitting(link);
    expect(actOnPage(5, 'locate', '', false)).toEqual({
      ok: true,
      x: 60,
      y: 40,
      top: true,
    });
    // Never the page's smooth scroll: the box is measured right after.
    expect(scrolls).toEqual([
      { block: 'nearest', inline: 'nearest', behavior: 'instant' },
    ]);
  });

  // A sticky header or a banner over the element would take a real click.
  it('reports an element something covers, after trying to scroll it clear', () => {
    snapshotPage(200, 100);
    const link = document.querySelector('a')!;
    const scrolls = scrollSpy(link);
    const hit = hitting(document.querySelector('p'));
    expect(actOnPage(5, 'locate', '', false)).toMatchObject({
      ok: true,
      top: true,
      covered: true,
    });
    expect(scrolls.map((s) => s.block)).toEqual(['nearest', 'center']);
    // The element, anything inside it or its shadow host is no cover.
    hit.mockReturnValue(link);
    expect(actOnPage(5, 'locate', '', false)).not.toHaveProperty('covered');
    hit.mockReturnValue(document.querySelector('button[type=submit]'));
    expect(actOnPage(2, 'locate', '', false)).toHaveProperty('covered', true);
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<button>Inner</button>';
    document.querySelector('main')!.append(host);
    snapshotPage(200, 100);
    hit.mockReturnValue(host);
    expect(actOnPage(13, 'locate', '', false)).not.toHaveProperty('covered');
    // Off-screen reads as covered too: a real click there would land anywhere.
    hit.mockReturnValue(null);
    expect(actOnPage(13, 'locate', '', false)).toHaveProperty('covered', true);
  });

  // A same-origin frame chain: the window sits in `frameElement`, whose owner
  // is the parent document; null stands for a cross-origin parent.
  const inFrame = (frameElement: Element | null, fn: () => void) => {
    const outer = { top: null as unknown, parent: null as unknown };
    outer.top = outer;
    outer.parent = outer;
    const keys = ['top', 'parent', 'frameElement'] as const;
    const saved = keys.map(
      (key) => [key, Object.getOwnPropertyDescriptor(window, key)] as const,
    );
    const values = { top: outer, parent: outer, frameElement };
    try {
      for (const key of keys)
        Object.defineProperty(window, key, {
          configurable: true,
          value: values[key],
        });
      fn();
    } finally {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(window, key, descriptor);
        else delete (window as unknown as Record<string, unknown>)[key];
      }
    }
  };
  // What a real click meets at each "x,y": the frame-local centre, and the
  // point mapped into the parent, which in jsdom is this same document.
  const hitsAt = (at: Record<string, Element | null>) =>
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (x: number, y: number) => at[`${x},${y}`] ?? null,
    });

  // An embedded same-origin frame: its elements are placed in the tab's own
  // viewport through the iframe's box, so a real click can reach them.
  it('maps a same-origin frame into the tab viewport and gives up past a cross-origin one', () => {
    const frame = document.createElement('iframe');
    box(frame, 100, 50);
    const link = document.querySelector('a')!;
    box(link, 10, 20);
    hitsAt({ '60,40': link, '160,90': frame });
    inFrame(frame, () => {
      expect(snapshotPage(200, 100).items[4].rect).toEqual({
        x: 110,
        y: 70,
        w: 100,
        h: 40,
      });
      expect(actOnPage(5, 'locate', '', false)).toEqual({
        ok: true,
        x: 160,
        y: 90,
        top: true,
      });
      expect(actOnPage(2, 'prepare-type', '', false)).toEqual({
        ok: true,
        top: true,
      });
    });
    inFrame(null, () => {
      expect(snapshotPage(200, 100).items[4].rect).toBeUndefined();
      expect(actOnPage(5, 'locate', '', false)).toEqual({
        ok: true,
        x: 60,
        y: 40,
        top: false,
      });
      expect(actOnPage(2, 'prepare-type', '', false)).toEqual({
        ok: true,
        top: false,
      });
    });
  });

  // The frame's own document cannot see a banner or a backdrop the parent page
  // lays over the iframe: the parent's hit test must return the iframe itself.
  it('reports an element covered by the page around its frame', () => {
    snapshotPage(200, 100);
    const frame = document.createElement('iframe');
    box(frame, 100, 50);
    const link = document.querySelector('a')!;
    const scrolls = scrollSpy(link);
    box(link, 10, 20);
    inFrame(frame, () => {
      hitsAt({ '60,40': link, '160,90': document.querySelector('h1') });
      expect(actOnPage(5, 'locate', '', false)).toEqual({
        ok: true,
        x: 160,
        y: 90,
        top: true,
        covered: true,
      });
      expect(scrolls.map((s) => s.block)).toEqual(['nearest', 'center']);
      hitsAt({ '60,40': link, '160,90': frame });
      expect(actOnPage(5, 'locate', '', false)).not.toHaveProperty('covered');
      // The frame itself is out of the parent's view: nothing at the point.
      hitsAt({ '60,40': link });
      expect(actOnPage(5, 'locate', '', false)).toHaveProperty('covered', true);
    });
  });

  // `center` scrolls the parent page too, so the frame's box moves between the
  // retry and the measurement; the offset must come from after that scroll.
  it('measures the frame offset after the retry scroll', () => {
    snapshotPage(200, 100);
    const link = document.querySelector('a')!;
    const scrolls = scrollSpy(link);
    box(link, 10, 20);
    const frame = document.createElement('iframe');
    Object.defineProperty(frame, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 100,
        top: scrolls.some((s) => s.block === 'center') ? 250 : 50,
        width: 300,
        height: 200,
      }),
    });
    // Something in the frame covers the link once; after the retry it is clear.
    const inFrameHits = [document.querySelector('p'), link];
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (x: number, y: number) =>
        x === 60 && y === 40 ? (inFrameHits.shift() ?? link) : frame,
    });
    inFrame(frame, () => {
      expect(actOnPage(5, 'locate', '', false)).toEqual({
        ok: true,
        x: 160,
        y: 290,
        top: true,
      });
    });
  });

  it('prepares a field for real typing: focused and selected whole, never a secret one', () => {
    snapshotPage(200, 100, SECRET_FIELDS);
    const email = document.querySelector<HTMLInputElement>('#email')!;
    email.value = 'old';
    expect(actOnPage(2, 'prepare-type', '', false)).toEqual({
      ok: true,
      top: true,
    });
    expect(document.activeElement).toBe(email);
    expect([email.selectionStart, email.selectionEnd]).toEqual([0, 3]);

    expect(
      actOnPage(3, 'prepare-type', '', false, SECRET_FIELDS).error,
    ).toMatch(/^Refused:/);
    expect(
      actOnPage(10, 'prepare-type', '', false, SECRET_FIELDS).error,
    ).toMatch(/^Refused:/);

    const editor = document.querySelector('#ed')!;
    editor.textContent = 'Draft';
    expect(actOnPage(8, 'prepare-type', '', false)).toEqual({
      ok: true,
      top: true,
    });
    expect(window.getSelection()?.toString()).toBe('Draft');

    expect(actOnPage(4, 'prepare-type', '', false)).toEqual({
      ok: false,
      error: 'Element cannot receive text.',
    });
  });

  it('types through the native setter and fires input and change', () => {
    snapshotPage(200, 100);
    const input = document.querySelector<HTMLInputElement>('#email')!;
    const seen: string[] = [];
    input.addEventListener('input', (e) =>
      seen.push(`input:${(e.target as HTMLInputElement).value}`),
    );
    input.addEventListener('change', () => seen.push('change'));
    expect(actOnPage(2, 'type', 'jane@x.io', false)).toEqual({ ok: true });
    expect(input.value).toBe('jane@x.io');
    expect(seen).toEqual(['input:jane@x.io', 'change']);
  });

  it('submits after typing when asked: Enter keys, then the form', () => {
    snapshotPage(200, 100);
    const input = document.querySelector<HTMLInputElement>('#email')!;
    const keys: string[] = [];
    input.addEventListener('keydown', (e) =>
      keys.push((e as KeyboardEvent).key),
    );
    const submitted = vi.fn((e: Event) => e.preventDefault());
    document.querySelector('#f')!.addEventListener('submit', submitted);
    expect(actOnPage(2, 'type', 'jane', true).ok).toBe(true);
    expect(keys).toEqual(['Enter']);
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('refuses password and payment fields', () => {
    snapshotPage(200, 100);
    expect(actOnPage(3, 'type', 'hunter2', false).error).toMatch(/^Refused:/);
    expect(document.querySelector<HTMLInputElement>('#pw')!.value).toBe(
      'secret',
    );
    expect(actOnPage(10, 'type', '4242', false, SECRET_FIELDS).error).toMatch(
      /^Refused:/,
    );
  });

  // `autocomplete` is a token list, so a checkout's `billing cc-number` has to
  // be refused as surely as a bare `cc-number`. Its own DOM: the shared fixture's
  // element numbers are asserted by index all over this file.
  it('refuses every secret field, prefixed tokens and one-time codes included', () => {
    document.body.innerHTML = `
      <input id="a" autocomplete="billing cc-number">
      <input id="b" autocomplete="section-pay shipping cc-csc">
      <input id="c" autocomplete="ONE-TIME-CODE">
      <input id="d" autocomplete="cc-exp-month">
      <input id="e" autocomplete="cc-name">
      <input id="f" autocomplete="current-password webauthn">
      <input id="g" autocomplete="email">`;
    snapshotPage(200, 100);

    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(actOnPage(n, 'type', 'x', false, SECRET_FIELDS).error).toMatch(
        /^Refused:/,
      );
    }
    // Not everything carrying an autocomplete hint is a secret.
    expect(
      actOnPage(7, 'type', 'jane@example.com', false, SECRET_FIELDS).ok,
    ).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#g')!.value).toBe(
      'jane@example.com',
    );
  });

  it('types into a contenteditable and refuses elements that take no text', () => {
    snapshotPage(200, 100);
    const editor = document.querySelector('#ed')!;
    const onInput = vi.fn();
    editor.addEventListener('input', onInput);
    expect(actOnPage(8, 'type', 'hello', false)).toEqual({ ok: true });
    expect(editor.textContent).toBe('hello');
    expect(onInput).toHaveBeenCalled();
    expect(actOnPage(5, 'type', 'x', false).error).toBe(
      'Element cannot receive text.',
    );
  });

  it('prefers execCommand for contenteditable when it inserts', () => {
    snapshotPage(200, 100);
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: exec,
    });
    try {
      expect(actOnPage(8, 'type', 'via exec', false).ok).toBe(true);
      expect(exec).toHaveBeenCalledWith('insertText', false, 'via exec');
      expect(document.querySelector('#ed')!.textContent).toBe('');
    } finally {
      delete (document as { execCommand?: unknown }).execCommand;
    }
  });

  it('selects an option by value or label and reports unknown options', () => {
    snapshotPage(200, 100);
    const select = document.querySelector<HTMLSelectElement>('#lang')!;
    const onChange = vi.fn();
    select.addEventListener('change', onChange);
    expect(actOnPage(6, 'select', 'Français', false)).toEqual({ ok: true });
    expect(select.value).toBe('fr');
    expect(actOnPage(6, 'select', 'en', false)).toEqual({ ok: true });
    expect(select.value).toBe('en');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(actOnPage(6, 'select', 'Klingon', false).error).toMatch(
      /No option matches "Klingon". Options: English \| Français/,
    );
    expect(actOnPage(2, 'select', 'x', false).error).toBe(
      'Element is not a select.',
    );
  });

  it('scrolls to an element and rejects unknown actions', () => {
    snapshotPage(200, 100);
    expect(actOnPage(5, 'scroll', '', false)).toEqual({ ok: true });
    expect(actOnPage(5, 'dance', '', false).error).toBe(
      'Unknown action "dance".',
    );
  });
});

describe('scrollPage', () => {
  it('scrolls by most of a screen in the given direction', () => {
    const scrollBy = vi.fn();
    Object.defineProperty(window, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });
    expect(scrollPage('down')).toEqual({ ok: true });
    expect(scrollPage('up')).toEqual({ ok: true });
    expect(
      scrollBy.mock.calls.map((call) => (call[0] as { top: number }).top),
    ).toEqual([800, -800]);
  });
});

describe('waitForQuiet', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves after a quiet window', async () => {
    const promise = waitForQuiet(100, 1000);
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe('quiet');
  });

  it('re-arms on mutations and gives up at the cap', async () => {
    const promise = waitForQuiet(100, 350);
    const churn = setInterval(
      () => document.body.append(document.createElement('i')),
      50,
    );
    await vi.advanceTimersByTimeAsync(350);
    clearInterval(churn);
    await expect(promise).resolves.toBe('cap');
  });

  it('keeps waiting while the document is still loading', async () => {
    const original = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'readyState',
    );
    let state = 'loading';
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => state,
    });
    try {
      const promise = waitForQuiet(100, 1000);
      await vi.advanceTimersByTimeAsync(150);
      state = 'complete';
      await vi.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toBe('quiet');
    } finally {
      delete (document as { readyState?: unknown }).readyState;
      if (original)
        Object.defineProperty(Document.prototype, 'readyState', original);
    }
  });
});

describe('the picture', () => {
  it("reports each element's place in the tab and the viewport, for the numbers drawn on it", () => {
    Object.defineProperty(
      document.querySelector('a'),
      'getBoundingClientRect',
      {
        configurable: true,
        value: () => ({ left: 10, top: 20, width: 100, height: 40 }),
      },
    );
    const snapshot = snapshotPage(200, 100);
    expect(snapshot.viewport).toEqual({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    expect(snapshot.items[4].rect).toEqual({ x: 10, y: 20, w: 100, h: 40 });
  });

  // Off the frame's screen, a number would land on whatever the tab shows at
  // that position; jsdom's zero-size boxes at the origin count as on screen.
  it("lists what is off the frame's screen last, with no place", () => {
    box(document.querySelector('a'), 10, -100);
    box(document.querySelector('#email'), window.innerWidth + 10, 20);
    const snapshot = snapshotPage(200, 100);
    const last = snapshot.items.slice(-2);
    expect(last.map((item) => item.name)).toEqual([
      'Email',
      'Forgot password?',
    ]);
    expect(last.map((item) => item.rect)).toEqual([undefined, undefined]);
    expect(snapshot.items[0].rect).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(snapshot.dropped).toBe(0);
  });

  // Gmail: fifty inbox rows come before the compose window in the document,
  // and the cap used to cut the compose fields while listing rows nobody saw.
  it('cuts what is off screen first under the cap, and counts it', () => {
    box(document.querySelector('a'), 10, -100);
    const snapshot = snapshotPage(11, 100);
    expect(snapshot.items).toHaveLength(11);
    expect(snapshot.items.map((item) => item.name)).not.toContain(
      'Forgot password?',
    );
    expect(snapshot.dropped).toBe(1);
    expect(agentMap()?.size).toBe(11);
  });
});

describe('the element at a point', () => {
  const hitsAt = (at: Record<string, Element | null>) =>
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (x: number, y: number) => at[`${x},${y}`] ?? null,
    });
  afterEach(() => {
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
  });

  it('describes it as item 0, by its nearest listed ancestor, leaving the numbers alone', () => {
    snapshotPage(200, 100);
    const map = agentMap();
    hitsAt({
      '60,40': document.querySelector('a'),
      '5,5': document.querySelector('button[title="Menu"] img'),
      '1,1': document.body,
    });
    const hit = snapshotPage(200, 100, SECRET_FIELDS, { x: 60, y: 40 });
    expect(hit.items).toEqual([
      {
        n: 0,
        role: 'link',
        name: 'Forgot password?',
        state: '',
        submit: false,
        secret: false,
        rect: { x: 0, y: 0, w: 0, h: 0 },
      },
    ]);
    expect(hit.excerpt).toBe('');
    expect(hit.dropped).toBe(0);
    expect(agentMap()).toBe(map);
    expect(map?.get(0)).toBeUndefined();
    expect(
      snapshotPage(200, 100, SECRET_FIELDS, { x: 5, y: 5 }).items[0],
    ).toMatchObject({ n: 0, role: 'button', name: 'Menu' });
    expect(
      snapshotPage(200, 100, SECRET_FIELDS, { x: 1, y: 1 }).items[0],
    ).toMatchObject({ n: 0, role: 'body' });
    expect(snapshotPage(200, 100, SECRET_FIELDS, { x: 9, y: 9 }).items).toEqual(
      [],
    );
  });

  it('looks through an open shadow root and into a same-origin frame, and stops at a cross-origin one', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const inner = document.createElement('button');
    inner.textContent = 'Inner';
    host.attachShadow({ mode: 'open' }).append(inner);
    Object.defineProperty(host.shadowRoot, 'elementFromPoint', {
      value: () => inner,
    });
    const frame = document.createElement('iframe');
    document.body.append(frame);
    box(frame, 100, 50);
    const framed = frame.contentDocument!.createElement('button');
    framed.textContent = 'Framed';
    frame.contentDocument!.body.append(framed);
    Object.defineProperty(framed, 'checkVisibility', { value: () => true });
    Object.defineProperty(frame.contentDocument, 'elementFromPoint', {
      value: (x: number, y: number) => (x === 60 && y === 40 ? framed : null),
    });
    const foreign = document.createElement('iframe');
    foreign.title = 'Ad';
    document.body.append(foreign);
    Object.defineProperty(foreign, 'contentDocument', { value: null });
    hitsAt({ '3,3': host, '160,90': frame, '7,7': foreign });
    const at = (x: number, y: number) =>
      snapshotPage(200, 100, SECRET_FIELDS, { x, y }).items[0];
    expect(at(3, 3)).toMatchObject({ n: 0, role: 'button', name: 'Inner' });
    expect(at(160, 90)).toMatchObject({ n: 0, role: 'button', name: 'Framed' });
    expect(at(7, 7)).toMatchObject({ n: 0, role: 'iframe', name: 'Ad' });
  });
});

describe('the focused element as number 0', () => {
  it('prepares whatever holds the focus, through an open shadow root, behind the secret refusal', () => {
    snapshotPage(200, 100);
    expect(actOnPage(0, 'prepare-type', '', false)).toEqual({
      ok: false,
      error: 'Nothing is focused.',
    });
    const email = document.querySelector<HTMLInputElement>('#email')!;
    email.value = 'old';
    email.focus();
    expect(actOnPage(0, 'prepare-type', '', false, SECRET_FIELDS)).toEqual({
      ok: true,
      top: true,
    });
    expect([email.selectionStart, email.selectionEnd]).toEqual([0, 3]);
    document.querySelector<HTMLInputElement>('#pw')!.focus();
    expect(
      actOnPage(0, 'prepare-type', '', false, SECRET_FIELDS).error,
    ).toMatch(/^Refused:/);
    const host = document.createElement('div');
    document.body.append(host);
    const inner = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(inner);
    inner.focus();
    expect(document.activeElement).toBe(host);
    expect(actOnPage(0, 'prepare-type', '', false, SECRET_FIELDS)).toEqual({
      ok: true,
      top: true,
    });
    // The frame holding the focus answers for itself; here it is not a field.
    const frame = document.createElement('iframe');
    document.body.append(frame);
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => frame,
    });
    try {
      expect(actOnPage(0, 'prepare-type', '', false).ok).toBe(false);
    } finally {
      delete (document as { activeElement?: unknown }).activeElement;
    }
  });
});

describe('the overlay is not part of the page', () => {
  const OPTIONS = {
    color: '#2467eb',
    status: 'Clicking [1] button "Continue"',
    stop: 'Stop',
    stopping: 'Stopping…',
    label: 'ibl.ai is working on this page',
    watchdogMs: 15000,
  };
  const host = () => document.querySelector(`[${OVERLAY_ATTR}]`);

  afterEach(() => {
    removeHud();
    vi.useRealTimers();
  });

  it('carries the attribute the hit tests and the reader key off', () => {
    // The injected functions cannot import, so each repeats the attribute as a
    // literal. If one is edited and the others are not, the overlay becomes
    // visible to the model — which is the whole thing this prevents.
    for (const fn of [mountHud, removeHud]) {
      expect(fn.toString()).toContain(OVERLAY_ATTR);
    }
    for (const fn of [snapshotPage, actOnPage]) {
      expect(fn.toString()).toContain(OVERLAY_ATTR);
    }
  });

  it('keeps its shadow root closed, so the reader cannot walk into it', () => {
    mountHud(OPTIONS);
    const element = host();
    expect(element).not.toBeNull();
    expect((element as HTMLElement).shadowRoot).toBeNull();
  });

  it('hangs off <html>, never off <body>', () => {
    mountHud(OPTIONS);
    expect(host()?.parentElement).toBe(document.documentElement);
  });

  it('is in no snapshot: not an element, and not a word of the text', () => {
    const before = snapshotPage(50, 2000);
    mountHud(OPTIONS);
    const after = snapshotPage(50, 2000);
    expect(after.items).toEqual(before.items);
    expect(after.excerpt).toBe(before.excerpt);
    expect(after.excerpt).not.toContain('Stop');
    expect(JSON.stringify(after.items)).not.toContain('Stop');
  });

  // The closed shadow root already keeps the reader out, so this holds the
  // belt to the braces: anything marked as ours is skipped on its own merits,
  // and a later change to how the overlay is built cannot quietly expose it.
  it('skips anything marked as ours, shadow root or not', () => {
    const planted = document.createElement('div');
    planted.setAttribute(OVERLAY_ATTR, '');
    planted.innerHTML = '<button>Stop</button><h2>Working on this page</h2>';
    document.documentElement.appendChild(planted);
    try {
      const snapshot = snapshotPage(50, 2000);
      expect(JSON.stringify(snapshot.items)).not.toContain('Stop');
      expect(JSON.stringify(snapshot.items)).not.toContain(
        'Working on this page',
      );
    } finally {
      planted.remove();
    }
  });

  it('does not make the element under it read as covered', () => {
    mountHud(OPTIONS);
    const button = document.querySelector('button[type="submit"]')!;
    // What the overlay does to a hit test: it is what is at the point.
    const overlay = host() as HTMLElement;
    document.elementFromPoint = () => overlay;
    document.elementsFromPoint = () => [overlay, button];
    snapshotPage(50, 100);
    const located = actOnPage(
      [...(agentMap() ?? new Map())].find(([, el]) => el === button)![0],
      'locate',
      '',
      false,
    );
    expect(located.ok).toBe(true);
    expect(located.covered).toBeFalsy();
  });

  it('takes itself off the page when the beats stop', () => {
    vi.useFakeTimers();
    mountHud({ ...OPTIONS, watchdogMs: 5000 });
    expect(host()).not.toBeNull();
    vi.advanceTimersByTime(4000);
    expect(host()).not.toBeNull();
    // A worker killed mid-run cannot reach back into the page; nothing else
    // would ever clear this.
    vi.advanceTimersByTime(3000);
    expect(host()).toBeNull();
  });

  it('a beat keeps it alive and brings its words up to date', () => {
    vi.useFakeTimers();
    mountHud({ ...OPTIONS, watchdogMs: 5000 });
    vi.advanceTimersByTime(4000);
    mountHud({ ...OPTIONS, watchdogMs: 5000, status: 'Reading this page' });
    vi.advanceTimersByTime(4000);
    expect(host()).not.toBeNull();
  });

  describe('the pointer', () => {
    // The overlay's root is closed, deliberately — the page it sits on has no
    // business reaching into it. Catch the root as it is made instead of
    // opening it up for the test.
    let roots: ShadowRoot[] = [];
    const attach = Element.prototype.attachShadow;

    beforeEach(() => {
      roots = [];
      vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (
        this: Element,
        init: ShadowRootInit,
      ) {
        const root = attach.call(this, init);
        roots.push(root);
        return root;
      });
    });

    afterEach(() => {
      vi.mocked(Element.prototype.attachShadow).mockRestore();
    });

    const arrow = () => {
      const found = roots
        .map((root) => root.querySelector<HTMLElement>('.arrow'))
        .find(Boolean);
      if (!found) throw new Error('the overlay has no pointer');
      return found;
    };
    const target = { x: 100, y: 200, w: 40, h: 20 };

    it('is not on the page until there is something to point at', () => {
      mountHud(OPTIONS);
      expect(arrow().classList.contains('off')).toBe(true);
    });

    it('sits at the middle of the element being acted on', () => {
      mountHud({ ...OPTIONS, target });
      expect(arrow().classList.contains('off')).toBe(false);
      expect(arrow().style.left).toBe('120px');
      expect(arrow().style.top).toBe('210px');
    });

    // The first target is jumped to rather than flown to from 0,0, which looks
    // like a bug. The suppression is put back within the same call — only its
    // restoration is observable here, and that is the part worth pinning: left
    // off, nothing would ever travel again.
    it('leaves travel enabled after arriving at the first target', () => {
      mountHud({ ...OPTIONS, target });
      expect(arrow().style.transition).toBe('');
      mountHud({ ...OPTIONS, target: { ...target, x: 300 } });
      expect(arrow().style.left).toBe('320px');
      expect(arrow().style.transition).toBe('');
    });

    it('leaves the page when there is nothing to point at', () => {
      mountHud({ ...OPTIONS, target });
      mountHud(OPTIONS);
      expect(arrow().classList.contains('off')).toBe(true);
    });

    it('shows a press where it lands', () => {
      mountHud({ ...OPTIONS, target, pressId: 1 });
      expect(arrow().classList.contains('tap')).toBe(true);
    });

    // The overlay is re-painted on a heartbeat with the state the worker
    // holds. A flag left standing would replay the click every beat for as
    // long as the pointer rested there, which is why this is a count.
    it('does not replay the press on every beat', () => {
      mountHud({ ...OPTIONS, target, pressId: 1 });
      arrow().classList.remove('tap');
      mountHud({ ...OPTIONS, target, pressId: 1 });
      expect(arrow().classList.contains('tap')).toBe(false);
    });

    it('shows a second press in the same place', () => {
      mountHud({ ...OPTIONS, target, pressId: 1 });
      arrow().classList.remove('tap');
      mountHud({ ...OPTIONS, target, pressId: 2 });
      expect(arrow().classList.contains('tap')).toBe(true);
    });

    it('points without pressing for an action that does not press', () => {
      mountHud({ ...OPTIONS, target });
      expect(arrow().classList.contains('off')).toBe(false);
      expect(arrow().classList.contains('tap')).toBe(false);
    });
  });

  it('mounts once, however many times it is asked to', () => {
    mountHud(OPTIONS);
    mountHud(OPTIONS);
    mountHud(OPTIONS);
    expect(document.querySelectorAll(`[${OVERLAY_ATTR}]`)).toHaveLength(1);
  });

  it('steps aside only for a point it is actually over', async () => {
    mountHud(OPTIONS);
    // jsdom lays nothing out: every box is zero-sized at the origin, so the
    // origin is "over the bar" and anywhere else is not.
    await expect(
      setHudHidden({ hidden: true, point: { x: 50, y: 50 } }),
    ).resolves.toBe(false);
    await expect(
      setHudHidden({ hidden: true, point: { x: 0, y: 0 } }),
    ).resolves.toBe(true);
    expect((host() as HTMLElement).style.display).toBe('none');
    await setHudHidden({ hidden: false });
    expect((host() as HTMLElement).style.display).toBe('');
  });

  it('hides outright when no point is named — what a capture needs', async () => {
    mountHud(OPTIONS);
    await expect(setHudHidden({ hidden: true })).resolves.toBe(true);
    expect((host() as HTMLElement).style.display).toBe('none');
  });

  it('removes a host an earlier run left behind', () => {
    const stray = document.createElement('div');
    stray.setAttribute(OVERLAY_ATTR, '');
    document.documentElement.appendChild(stray);
    removeHud();
    expect(host()).toBeNull();
  });
});

/**
 * The recorder, which runs injected in the page: every click, change, submit
 * and settled edit becomes a step the worker turns into a skill. It names
 * elements by the same rules `snapshotPage` uses, and it is the one place a
 * password could leak into a transcript.
 */
describe('watchPage', () => {
  let sent: { type: string; step: RecordedEvent }[];

  beforeEach(() => {
    sent = [];
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage: (message: { type: string; step: RecordedEvent }) => {
          sent.push(message);
        },
      },
    };
  });

  afterEach(() => {
    unwatchPage();
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  const steps = () => sent.map((message) => message.step);
  const last = () => steps().at(-1)!;

  const page = (html: string): HTMLElement => {
    document.body.innerHTML = html;
    watchPage(SECRET_FIELDS);
    return document.body;
  };

  it('reports a click with the element it landed on', () => {
    page('<button id="go">Continue</button>');
    document.getElementById('go')!.click();

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('MENTOR:RECORDER_STEP');
    expect(last()).toMatchObject({
      kind: 'click',
      role: 'button',
      name: 'Continue',
      secret: false,
      url: location.href,
    });
  });

  // The click lands on whatever is under the cursor; the step should name the
  // control, not the span inside it.
  it('climbs to the control the click was really on', () => {
    page('<button><span id="inner">Save</span></button>');
    document.getElementById('inner')!.click();

    expect(last().role).toBe('button');
  });

  // No control to climb to: the element itself is the step, named by its tag.
  // Pages put handlers on plain elements, and a click that went nowhere in the
  // transcript would be a hole in the recording.
  it('falls back to the element itself when it is not a control', () => {
    page('<div id="el">plain</div>');
    document
      .getElementById('el')!
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(last()).toMatchObject({ kind: 'click', role: 'div', name: 'plain' });
  });

  it('says nothing at all for a click on no element', () => {
    page('<button id="go">Go</button>');
    document.dispatchEvent(new Event('click', { bubbles: true }));

    expect(sent).toHaveLength(0);
  });

  describe('naming', () => {
    const named = (html: string, id = 'el'): string => {
      page(html);
      document.getElementById(id)!.click();
      return last().name;
    };

    it('prefers an aria-label', () => {
      expect(named('<button id="el" aria-label="Close">x</button>')).toBe(
        'Close',
      );
    });

    it('falls back to aria-labelledby', () => {
      expect(
        named(
          '<span id="l">Street</span><button id="el" aria-labelledby="l">x</button>',
        ),
      ).toBe('Street');
    });

    it('falls back to a label pointing at it', () => {
      expect(named('<label for="el">Email</label><input id="el">')).toBe(
        'Email',
      );
    });

    it('falls back to a label wrapped around it', () => {
      expect(named('<label>Phone <input id="el"></label>')).toBe('Phone');
    });

    it.each([
      ['placeholder', '<input id="el" placeholder="Search">', 'Search'],
      ['title', '<button id="el" title="Help">?</button>', 'Help'],
      ['name', '<input id="el" name="city">', 'city'],
    ])('falls back to %s', (_attr, html, expected) => {
      expect(named(html)).toBe(expected);
    });

    it('uses its own text when nothing else names it', () => {
      expect(named('<button id="el">Sign in</button>')).toBe('Sign in');
    });

    it('gives a select no name of its own', () => {
      expect(named('<select id="el"><option>One</option></select>')).toBe('');
    });

    it('collapses the whitespace a page leaves in its markup', () => {
      expect(named('<button id="el">  Sign \n  in  </button>')).toBe('Sign in');
    });

    it('cuts a very long name rather than carrying it whole', () => {
      const name = named(`<button id="el">${'x'.repeat(200)}</button>`);
      expect(name).toHaveLength(80);
      expect(name.endsWith('…')).toBe(true);
    });
  });

  describe('roles', () => {
    const roleOf = (html: string): string => {
      page(html);
      document.getElementById('el')!.click();
      return last().role;
    };

    it.each([
      [
        'an explicit role wins',
        '<div id="el" role="Menu Item">x</div>',
        'menu',
      ],
      ['a link', '<a id="el" href="#">x</a>', 'link'],
      ['a button', '<button id="el">x</button>', 'button'],
      [
        'a summary',
        '<details><summary id="el">x</summary></details>',
        'button',
      ],
      ['a select', '<select id="el"></select>', 'combobox'],
      ['a submit input', '<input id="el" type="submit">', 'button'],
      ['a checkbox', '<input id="el" type="checkbox">', 'checkbox'],
      ['a radio', '<input id="el" type="radio">', 'radio'],
      ['a text input', '<input id="el">', 'textbox'],
      ['a textarea', '<textarea id="el"></textarea>', 'textbox'],
      [
        'a contenteditable',
        '<div id="el" contenteditable="true">x</div>',
        'textbox',
      ],
      ['anything focusable', '<div id="el" tabindex="0">x</div>', 'focusable'],
    ])('%s', (_label, html, expected) => {
      expect(roleOf(html)).toBe(expected);
    });
  });

  describe('values', () => {
    it('carries what was typed once an edit settles', () => {
      page('<input id="el" name="city">');
      const input = document.getElementById('el') as HTMLInputElement;
      input.value = 'Lagos';
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      expect(last()).toMatchObject({ kind: 'input', value: 'Lagos' });
    });

    // Per keystroke the worker would coalesce a message per character.
    it('reports an edit on Enter as well as on blur', () => {
      page('<input id="el" name="city">');
      const input = document.getElementById('el') as HTMLInputElement;
      input.value = 'Lagos';
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );

      expect(last()).toMatchObject({ kind: 'input', value: 'Lagos' });
    });

    it('ignores any other key', () => {
      page('<input id="el" name="city">');
      document
        .getElementById('el')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
        );

      expect(sent).toHaveLength(0);
    });

    it('carries the chosen option of a select', () => {
      page('<select id="el"><option>One</option><option>Two</option></select>');
      const select = document.getElementById('el') as HTMLSelectElement;
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));

      expect(last()).toMatchObject({ kind: 'change', value: 'Two' });
    });

    it('reports a submit, with no value to carry', () => {
      page('<form id="f"><input name="q"></form>');
      document
        .getElementById('f')!
        .dispatchEvent(new Event('submit', { bubbles: true }));

      expect(last()).toMatchObject({ kind: 'submit' });
      expect(last().value).toBeUndefined();
    });

    it('carries no value on a click', () => {
      page('<input id="el" value="typed">');
      document.getElementById('el')!.click();

      expect(last().kind).toBe('click');
      expect(last().value).toBeUndefined();
    });
  });

  // The one place a password could reach a transcript.
  describe('secrets', () => {
    it('marks a password field and keeps what was typed out of the step', () => {
      page('<input id="el" type="password" name="pw">');
      const input = document.getElementById('el') as HTMLInputElement;
      input.value = 'hunter2';
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      expect(last().secret).toBe(true);
      expect(last().value).toBeUndefined();
      expect(JSON.stringify(sent)).not.toContain('hunter2');
    });

    it.each(SECRET_FIELDS.slice(0, 3))(
      'treats autocomplete=%s as a secret',
      (token) => {
        page(`<input id="el" autocomplete="${token}">`);
        const input = document.getElementById('el') as HTMLInputElement;
        input.value = 'secret-value';
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(last().secret).toBe(true);
        expect(last().value).toBeUndefined();
      },
    );

    it('leaves an ordinary field alone', () => {
      page('<input id="el" autocomplete="off" name="city">');
      const input = document.getElementById('el') as HTMLInputElement;
      input.value = 'Lagos';
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      expect(last().secret).toBe(false);
      expect(last().value).toBe('Lagos');
    });
  });

  describe('its lifetime', () => {
    it('watches once, however many times it is asked to', () => {
      page('<button id="go">Go</button>');
      watchPage(SECRET_FIELDS);
      watchPage(SECRET_FIELDS);
      document.getElementById('go')!.click();

      expect(sent).toHaveLength(1);
    });

    it('stops reporting once it is taken off', () => {
      page('<button id="go">Go</button>');
      unwatchPage();
      document.getElementById('go')!.click();

      expect(sent).toHaveLength(0);
    });

    it('can be taken off where it was never put on', () => {
      expect(() => unwatchPage()).not.toThrow();
    });

    it('can be put back after being taken off', () => {
      page('<button id="go">Go</button>');
      unwatchPage();
      watchPage(SECRET_FIELDS);
      document.getElementById('go')!.click();

      expect(sent).toHaveLength(1);
    });

    // The worker dies and the page carries on; recording is over either way.
    it('survives the worker being gone', () => {
      page('<button id="go">Go</button>');
      (globalThis as { chrome?: unknown }).chrome = {
        runtime: {
          sendMessage: () => {
            throw new Error('Extension context invalidated');
          },
        },
      };

      expect(() => document.getElementById('go')!.click()).not.toThrow();
    });
  });
});
