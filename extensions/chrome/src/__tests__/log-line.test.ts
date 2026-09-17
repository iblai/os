import { beforeEach, describe, expect, it } from 'vitest';
import { logLine } from '../log-line';
import { installChromeStub } from './chrome.stub';

beforeEach(() => {
  installChromeStub();
});

describe('logLine', () => {
  it('names the action and its target', () => {
    expect(
      logLine({ tool: 'click', target: '[1] button "Pay"', ok: true }),
    ).toBe('Click [1] button "Pay"');
    expect(logLine({ tool: 'read_page', target: '', ok: true })).toBe(
      'Read page',
    );
  });

  it('falls back to the tool name for anything unlabelled', () => {
    expect(logLine({ tool: 'mystery', target: 'x', ok: true })).toBe(
      'mystery x',
    );
  });

  it('explains each way an action can fail', () => {
    expect(
      logLine({
        tool: 'click',
        target: '[1] link',
        ok: false,
        code: 'host_blocked',
        host: 'chrome://extensions/',
      }),
    ).toBe(
      'Click [1] link — chrome://extensions/ is not an http or https page, so it cannot be driven.',
    );
    expect(
      logLine({
        tool: 'click',
        target: '[1] link',
        ok: false,
        code: 'declined',
      }),
    ).toBe('Click [1] link — Declined.');
    expect(
      logLine({
        tool: 'type',
        target: '[2] textbox',
        ok: false,
        code: 'refused',
        detail: 'password fields are never typed into',
      }),
    ).toBe(
      'Type into [2] textbox — Refused: password fields are never typed into',
    );
    expect(
      logLine({
        tool: 'click',
        target: '[3] button',
        ok: false,
        detail: 'Element 3 is not in the current snapshot.',
      }),
    ).toBe('Click [3] button — Element 3 is not in the current snapshot.');
  });

  it('omits a missing host or detail rather than printing undefined', () => {
    expect(
      logLine({
        tool: 'click',
        target: '[1]',
        ok: false,
        code: 'host_blocked',
      }),
    ).not.toContain('undefined');
    expect(
      logLine({ tool: 'click', target: '[1]', ok: false, code: 'refused' }),
    ).not.toContain('undefined');
  });
});
