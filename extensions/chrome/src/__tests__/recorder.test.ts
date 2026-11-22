import { describe, expect, it } from 'vitest';

import { describeStep, NAVIGATION_WINDOW_MS, Recording } from '../recorder';
import type { RecordedEvent } from '../page-scripts';

const URL_A = 'https://admin.acme.com/reports';
const URL_B = 'https://admin.acme.com/reports?range=7d';

const event = (over: Partial<RecordedEvent>): RecordedEvent => ({
  kind: 'click',
  role: 'button',
  name: 'Export',
  secret: false,
  url: URL_A,
  ...over,
});

describe('what a recording keeps', () => {
  it('keeps a click as the control the person clicked', () => {
    const run = new Recording();
    run.add(event({ role: 'button', name: 'Export' }), 0);

    expect(run.steps()).toEqual([
      { tool: 'click', target: { role: 'button', name: 'Export' }, url: URL_A },
    ]);
  });

  it('keeps one step for a field the person typed in twice', () => {
    const run = new Recording();
    run.add(
      event({ kind: 'input', role: 'textbox', name: 'Search', value: 'acm' }),
      0,
    );
    run.add(
      event({
        kind: 'input',
        role: 'textbox',
        name: 'Search',
        value: 'acme corp',
      }),
      50,
    );

    // Correcting yourself is one step, and the field ends up holding the last
    // thing typed, not the first.
    expect(run.steps()).toEqual([
      {
        tool: 'type',
        target: { role: 'textbox', name: 'Search' },
        value: 'acme corp',
        url: URL_A,
      },
    ]);
  });

  it('settles the last thing typed when the recording is read', () => {
    const run = new Recording();
    run.add(
      event({ kind: 'input', role: 'textbox', name: 'Search', value: 'acme' }),
      0,
    );

    // Without this the last field typed into before Stop is lost.
    expect(run.steps()).toHaveLength(1);
  });

  it('closes a field when the person moves to another one', () => {
    const run = new Recording();
    run.add(
      event({ kind: 'input', role: 'textbox', name: 'First', value: 'Jane' }),
      0,
    );
    run.add(
      event({ kind: 'input', role: 'textbox', name: 'Last', value: 'Doe' }),
      10,
    );

    expect(run.steps().map((s) => s.target.name)).toEqual(['First', 'Last']);
  });

  it('calls a choice in a dropdown choosing, not typing', () => {
    const run = new Recording();
    run.add(
      event({ kind: 'change', role: 'combobox', name: 'Format', value: 'CSV' }),
      0,
    );

    expect(run.steps()[0]).toMatchObject({ tool: 'select', value: 'CSV' });
  });

  it('keeps submitting a form as the click it was', () => {
    const run = new Recording();
    run.add(event({ kind: 'submit', role: 'button', name: 'Search' }), 0);

    expect(run.steps()).toEqual([
      { tool: 'click', target: { role: 'button', name: 'Search' }, url: URL_A },
    ]);
  });

  it('remembers which frame a click happened in', () => {
    const run = new Recording();
    run.add(event({ frameUrl: 'https://embed.acme.com/widget' }), 0);

    // Replay has to look inside the same frame; the page's own address would
    // send it hunting for a control that is not there.
    expect(run.steps()[0]).toMatchObject({
      frameUrl: 'https://embed.acme.com/widget',
    });
  });
});

describe('what a recording never keeps', () => {
  it('holds no value for a secret field', () => {
    const run = new Recording();
    run.add(
      event({ kind: 'input', role: 'textbox', name: 'Password', secret: true }),
      0,
    );

    const [step] = run.steps();
    expect(step).not.toHaveProperty('value');
    expect(step.target.name).toBe('Password');
  });

  it('marks a control it could not name, rather than storing an empty one', () => {
    const run = new Recording();
    run.add(event({ role: 'combobox', name: '' }), 0);

    // Review asks the person what it was; `combobox ""` helps nobody.
    expect(run.steps()[0]).toMatchObject({ unnamed: true });
  });
});

describe('a navigation', () => {
  it('belongs to the click that caused it', () => {
    const run = new Recording();
    run.add(event({ role: 'option', name: 'Last 7 days' }), 1000);
    run.navigated(URL_B, 1200);

    expect(run.steps()).toEqual([
      {
        tool: 'click',
        target: { role: 'option', name: 'Last 7 days' },
        url: URL_A,
        outcomeUrl: URL_B,
      },
    ]);
  });

  it('is its own step when nothing was clicked first', () => {
    const run = new Recording();
    run.navigated(URL_A, 0, 'Reports');

    expect(run.steps()).toEqual([
      {
        tool: 'navigate',
        target: { role: 'page', name: 'Reports' },
        url: URL_A,
      },
    ]);
  });

  it('is its own step when it comes long after the click', () => {
    const run = new Recording();
    run.add(event({ role: 'button', name: 'Export' }), 0);
    run.navigated(URL_B, NAVIGATION_WINDOW_MS + 500);

    // A redirect minutes later is the person going somewhere, not the click.
    expect(run.steps().map((s) => s.tool)).toEqual(['click', 'navigate']);
  });

  it('attaches to the click that caused it, not to a later one', () => {
    const run = new Recording();
    run.add(event({ role: 'option', name: 'Last 7 days' }), 1000);
    run.navigated(URL_B, 1100);
    run.add(event({ role: 'button', name: 'Export' }), 5000);

    const [first, second] = run.steps();
    expect(first.outcomeUrl).toBe(URL_B);
    expect(second.outcomeUrl).toBeUndefined();
  });
});

describe('how a step reads', () => {
  it('names the control the way a person would', () => {
    expect(
      describeStep({
        tool: 'click',
        target: { role: 'button', name: 'Export' },
        url: URL_A,
      }),
    ).toBe('Click the button "Export"');
  });

  it('leaves out a value the person did not keep', () => {
    expect(
      describeStep({
        tool: 'type',
        target: { role: 'textbox', name: 'Search' },
        url: URL_A,
      }),
    ).toBe('Type into the textbox "Search"');
  });

  it('includes one they did', () => {
    expect(
      describeStep({
        tool: 'type',
        target: { role: 'textbox', name: 'Search' },
        value: 'acme corp',
        url: URL_A,
      }),
    ).toBe('Type "acme corp" into the textbox "Search"');
  });

  it('names the address a navigation goes to', () => {
    expect(
      describeStep({
        tool: 'navigate',
        target: { role: 'page', name: 'Reports' },
        url: URL_A,
      }),
    ).toBe(`Go to ${URL_A}`);
  });

  it('reads a choice with the value only when review kept it', () => {
    const chose = {
      tool: 'select' as const,
      target: { role: 'combobox', name: 'Range' },
      url: URL_A,
    };

    expect(describeStep(chose)).toBe('Choose in the combobox "Range"');
    expect(describeStep({ ...chose, value: 'Last 7 days' })).toBe(
      'Choose "Last 7 days" in the combobox "Range"',
    );
  });
});

describe('a workflow that moves between tabs', () => {
  const tab = (id: number, title: string, url = `https://${title}.com/`) => ({
    id,
    title,
    url,
  });

  it('follows the person, and says so in the steps', () => {
    const run = new Recording();
    run.switchedTo(tab(1, 'reports'), 0);
    run.add(event({ role: 'button', name: 'Export' }), 10);
    run.switchedTo(tab(2, 'sheets'), 20);
    run.add(event({ role: 'button', name: 'Paste' }), 30);

    expect(run.steps().map((s) => s.tool)).toEqual([
      'click',
      'switch-tab',
      'click',
    ]);
    expect(run.steps()[1].target.name).toBe('sheets');
  });

  it('does not open with a switch nobody made', () => {
    const run = new Recording();
    run.switchedTo(tab(1, 'reports'), 0);
    run.add(event({ role: 'button', name: 'Export' }), 10);

    // The first tab is where they already were.
    expect(run.steps().map((s) => s.tool)).toEqual(['click']);
  });

  it('ignores a tab they looked at and left without doing anything', () => {
    const run = new Recording();
    run.switchedTo(tab(1, 'reports'), 0);
    run.add(event({ role: 'button', name: 'Export' }), 10);
    run.switchedTo(tab(2, 'sheets'), 20);
    run.switchedTo(tab(1, 'reports'), 30);
    run.add(event({ role: 'button', name: 'Download' }), 40);

    // Two switches are recorded because they happened; what matters is that
    // nothing invented a step on the tab nothing was done in.
    const tools = run.steps().map((s) => s.tool);
    expect(tools.filter((x) => x === 'click')).toHaveLength(2);
  });

  it('closes what was being typed before the person leaves the tab', () => {
    const run = new Recording();
    run.switchedTo(tab(1, 'reports'), 0);
    run.add(
      event({ kind: 'input', role: 'textbox', name: 'Search', value: 'acme' }),
      10,
    );
    run.switchedTo(tab(2, 'sheets'), 20);

    // Otherwise the half-typed field lands after the switch, in the wrong tab.
    expect(run.steps().map((s) => s.tool)).toEqual(['type', 'switch-tab']);
  });

  it('reads as something a person could follow', () => {
    expect(
      describeStep({
        tool: 'switch-tab',
        target: { role: 'tab', name: 'Sheets' },
        url: 'https://sheets.com/',
      }),
    ).toBe('Switch to the tab showing Sheets');
  });

  it('records nothing for a switch to the tab already in front', () => {
    const run = new Recording();
    run.switchedTo(tab(1, 'reports'), 0);
    run.add(event({}), 5);
    run.switchedTo(tab(1, 'reports'), 10);

    expect(run.steps().filter((step) => step.tool === 'switch-tab')).toEqual(
      [],
    );
  });

  it('falls back to the address when a tab has no title, and to nothing when it has neither', () => {
    const run = new Recording();
    run.switchedTo(tab(1, 'reports'), 0);
    run.add(event({}), 5);
    run.switchedTo({ id: 2, url: 'https://sheets.acme.com/x' }, 10);
    run.switchedTo({ id: 3 }, 20);

    expect(
      run
        .steps()
        .filter((step) => step.tool === 'switch-tab')
        .map((step) => step.target.name),
    ).toEqual(['sheets.acme.com', '']);
  });
});
