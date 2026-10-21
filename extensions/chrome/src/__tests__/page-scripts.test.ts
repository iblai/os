import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actOnPage,
  extractPageContent,
  markPage,
  scrollPage,
  snapshotPage,
  unmarkPage,
  waitForQuiet,
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
    ['markPage', markPage],
    ['unmarkPage', unmarkPage],
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

  it('reports switches, disabled controls and expanded state', () => {
    document.body.innerHTML = `
      <div role="switch" aria-checked="true">Dark</div>
      <button disabled>Save</button>
      <button aria-disabled="true">Later</button>
      <button aria-expanded="true">More</button>
      <div contenteditable="true">Draft text</div>`;
    const states = snapshotPage(200, 100).items.map((item) => item.state);
    expect(states).toEqual([
      'checked',
      'disabled',
      'disabled',
      'expanded',
      'value: "Draft text"',
    ]);
  });
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

  it('locates an element by the centre of its box', () => {
    snapshotPage(200, 100);
    const link = document.querySelector('a')!;
    Object.defineProperty(link, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 10, top: 20, width: 100, height: 40 }),
    });
    expect(actOnPage(5, 'locate', '', false)).toEqual({
      ok: true,
      x: 60,
      y: 40,
    });
  });

  it('prepares a field for real typing: focused and selected whole, never a secret one', () => {
    snapshotPage(200, 100, SECRET_FIELDS);
    const email = document.querySelector<HTMLInputElement>('#email')!;
    email.value = 'old';
    expect(actOnPage(2, 'prepare-type', '', false)).toEqual({ ok: true });
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
    expect(actOnPage(8, 'prepare-type', '', false)).toEqual({ ok: true });
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

describe('markPage and unmarkPage', () => {
  it('draws one badge per pair, numbered as the model sees them, and takes them down', () => {
    snapshotPage(200, 100);
    expect(
      markPage([
        [4, 17],
        [5, 18],
        [99, 19],
      ]),
    ).toBe(2);
    const layer = document.getElementById('__ibl_marks')!;
    expect(layer.style.pointerEvents).toBe('none');
    expect(
      [...layer.querySelectorAll('span')].map((b) => b.textContent),
    ).toEqual(['17', '18']);
    // Drawing again replaces the layer rather than stacking a second one.
    expect(markPage([[4, 1]])).toBe(1);
    expect(document.querySelectorAll('#__ibl_marks')).toHaveLength(1);
    unmarkPage();
    expect(document.getElementById('__ibl_marks')).toBeNull();
    unmarkPage();
  });

  it('draws nothing before a snapshot', () => {
    expect(markPage([[1, 1]])).toBe(0);
    expect(document.getElementById('__ibl_marks')).toBeNull();
  });
});
