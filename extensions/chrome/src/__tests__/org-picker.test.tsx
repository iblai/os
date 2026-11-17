import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStub } from './chrome.stub';

const mocks = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  setDefaultOrganization: vi.fn(),
}));

// The real NoSessionError, so `instanceof` in the component still means
// something: a stubbed class would make that branch untestable.
vi.mock('../organizations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../organizations')>();
  return { ...mocks, NoSessionError: actual.NoSessionError };
});

import { OrgPicker } from '../org-picker';

const TWO = [
  { key: 'acme', name: 'Acme Inc', isDefault: false },
  { key: 'globex', name: 'Globex', isDefault: false },
];

beforeEach(() => {
  installChromeStub();
  vi.clearAllMocks();
  mocks.listOrganizations.mockResolvedValue(TWO);
  mocks.setDefaultOrganization.mockResolvedValue(undefined);
});

const show = (over: Partial<Parameters<typeof OrgPicker>[0]> = {}) => {
  const onPick = vi.fn();
  const onCancel = vi.fn();
  render(
    <OrgPicker current="acme" onPick={onPick} onCancel={onCancel} {...over} />,
  );
  return { onPick, onCancel };
};

describe('OrgPicker', () => {
  it('lists the organizations the person belongs to', async () => {
    show();
    expect(await screen.findByText('Acme Inc')).toBeTruthy();
    expect(screen.getByText('Globex')).toBeTruthy();
  });

  // The row is the control: choosing one is the whole point of the screen, so
  // there is no Select button beside a name.
  it('switches to the one that is clicked', async () => {
    const { onPick } = show();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Globex'));

    expect(onPick).toHaveBeenCalledWith('globex');
  });

  it('marks the current one and does not offer it again', async () => {
    const { onPick } = show();
    const user = userEvent.setup();
    await screen.findByText('Acme Inc');

    expect(screen.getByText('Current')).toBeTruthy();
    await user.click(screen.getByText('Acme Inc'));

    expect(onPick).not.toHaveBeenCalled();
  });

  it('closes without switching when dismissed', async () => {
    const { onCancel, onPick } = show();
    const user = userEvent.setup();
    await screen.findByText('Acme Inc');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('saves which one opens by default, without switching to it', async () => {
    const { onPick } = show();
    const user = userEvent.setup();
    await screen.findByText('Globex');

    await user.click(
      screen.getByRole('button', {
        name: /Open in this one by default: Globex/,
      }),
    );

    await waitFor(() =>
      expect(mocks.setDefaultOrganization).toHaveBeenCalledWith('globex'),
    );
    // Setting a default is a different decision from switching.
    expect(onPick).not.toHaveBeenCalled();
  });

  // Read off the list rows, so no second request that 503s where the backing
  // table is not migrated.
  it('shows which one already opens by default, as a word', async () => {
    mocks.listOrganizations.mockResolvedValue([
      TWO[0],
      { ...TWO[1], isDefault: true },
    ]);
    show();

    expect(await screen.findByText('Default')).toBeTruthy();
    // No control offered where it would do nothing.
    expect(
      screen.queryByRole('button', {
        name: /Open in this one by default: Globex/,
      }),
    ).toBeNull();
  });

  it('says so plainly when the session has ended, not "check your connection"', async () => {
    const { NoSessionError } = await import('../organizations');
    mocks.listOrganizations.mockRejectedValue(new NoSessionError());
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    show();

    expect(
      await screen.findByText(
        'Your session has ended. Close and reopen the panel to sign in again.',
      ),
    ).toBeTruthy();
    warn.mockRestore();
  });

  it('clears an earlier save failure once a later save works', async () => {
    mocks.setDefaultOrganization
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce(undefined);
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    show();
    const user = userEvent.setup();
    await screen.findByText('Globex');
    const star = () =>
      screen.getByRole('button', {
        name: /Open in this one by default: Globex/,
      });

    await user.click(star());
    expect(
      await screen.findByText(
        'Could not save which one opens by default. Try again.',
      ),
    ).toBeTruthy();

    await user.click(star());

    await waitFor(() =>
      expect(
        screen.queryByText(
          'Could not save which one opens by default. Try again.',
        ),
      ).toBeNull(),
    );
    warn.mockRestore();
  });

  it('shows a notice handed down from the panel', async () => {
    show({ notice: { kind: 'failed' } });

    expect(
      await screen.findByText(
        'That did not go through. Pick an organization to try again.',
      ),
    ).toBeTruthy();
  });

  it('puts the mark back and says so when the save fails', async () => {
    mocks.setDefaultOrganization.mockRejectedValue(new Error('nope'));
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    show();
    const user = userEvent.setup();
    await screen.findByText('Globex');

    await user.click(
      screen.getByRole('button', {
        name: /Open in this one by default: Globex/,
      }),
    );

    expect(
      await screen.findByText(
        'Could not save which one opens by default. Try again.',
      ),
    ).toBeTruthy();
    // Back to offerable, not stuck looking chosen.
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /Open in this one by default: Globex/,
        }),
      ).toBeTruthy(),
    );
    warn.mockRestore();
  });

  // It covers the chat, so it has to behave like a dialog rather than an
  // opaque sheet with the keyboard still behind it.
  it('starts the keyboard inside itself', async () => {
    show();
    await screen.findByText('Acme Inc');

    // The dialog itself: the one node that stays mounted through every state,
    // and not something a held Enter can activate.
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('closes on Escape', async () => {
    const { onCancel } = show();
    await screen.findByText('Acme Inc');
    const user = userEvent.setup();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('is announced as a dialog', async () => {
    show();
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  // A notice from the panel must not sit on top of the picker's own, newer and
  // more specific, problem.
  it('shows its own error rather than the panel notice', async () => {
    mocks.setDefaultOrganization.mockRejectedValue(new Error('nope'));
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    show({ notice: { kind: 'failed' } });
    const user = userEvent.setup();
    await screen.findByText('Globex');

    await user.click(
      screen.getByRole('button', {
        name: /Open in this one by default: Globex/,
      }),
    );

    expect(
      await screen.findByText(
        'Could not save which one opens by default. Try again.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'That did not go through. Pick an organization to try again.',
      ),
    ).toBeNull();
    warn.mockRestore();
  });

  // The sign-in window can stay open as long as the person needs it.
  it('says a switch is happening and stops taking picks', async () => {
    const { onPick } = show({ switching: true });
    const user = userEvent.setup();

    expect(await screen.findByText('Switching organization…')).toBeTruthy();
    expect(screen.queryByText('Acme Inc')).toBeNull();
    await user.keyboard('{Tab}');
    expect(onPick).not.toHaveBeenCalled();
  });

  // A save failure survives until a later successful save, so it must not sit
  // on top of the panel's message about a switch that has just failed.
  it('lets a switch failure through once a switch starts', async () => {
    mocks.setDefaultOrganization.mockRejectedValue(new Error('nope'));
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onPick = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <OrgPicker current="acme" onPick={onPick} onCancel={onCancel} />,
    );
    const user = userEvent.setup();
    await screen.findByText('Globex');

    await user.click(
      screen.getByRole('button', {
        name: /Open in this one by default: Globex/,
      }),
    );
    await screen.findByText(
      'Could not save which one opens by default. Try again.',
    );

    // The panel reports a failed switch while that message is still up.
    rerender(
      <OrgPicker
        current="acme"
        onPick={onPick}
        onCancel={onCancel}
        switching
      />,
    );
    rerender(
      <OrgPicker
        current="acme"
        onPick={onPick}
        onCancel={onCancel}
        notice={{ kind: 'failed' }}
      />,
    );

    expect(
      await screen.findByText(
        'That did not go through. Pick an organization to try again.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Could not save which one opens by default. Try again.',
      ),
    ).toBeNull();
    warn.mockRestore();
  });

  // The rows give way to the switching note, so the focused row unmounts; the
  // keyboard has to land somewhere inside the dialog, not on <body>.
  it('keeps the keyboard in the dialog when the rows give way', async () => {
    const onPick = vi.fn();
    const { rerender } = render(
      <OrgPicker current="acme" onPick={onPick} onCancel={() => {}} />,
    );
    const globex = await screen.findByText('Globex');
    (globex.closest('button') as HTMLButtonElement).focus();

    rerender(
      <OrgPicker
        current="acme"
        onPick={onPick}
        onCancel={() => {}}
        switching
      />,
    );

    await screen.findByText('Switching organization…');
    // Still the dialog, which outlives both the row and the note.
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  // Keyed on an unstable callback, the dialog effect re-ran on every parent
  // render and pulled focus back to ×, off whatever row the person was on.
  it('does not steal focus back on a parent re-render', async () => {
    const onPick = vi.fn();
    const { rerender } = render(
      <OrgPicker current="acme" onPick={onPick} onCancel={() => {}} />,
    );
    const globex = await screen.findByText('Globex');
    (globex.closest('button') as HTMLButtonElement).focus();

    rerender(<OrgPicker current="acme" onPick={onPick} onCancel={() => {}} />);

    expect(document.activeElement).toBe(globex.closest('button'));
  });

  // The switch reports a tenant key; the row above shows a name. The notice has
  // to agree with the row — a personal platform is "Account" here, not a
  // 32-character blob.
  it('names the organization it landed in, rather than its key', async () => {
    mocks.listOrganizations.mockResolvedValue([
      { key: 'acme', name: 'Acme Inc', isDefault: false },
      { key: 'b'.repeat(32), name: 'Account', isDefault: false },
    ]);
    show({ notice: { kind: 'elsewhere', landed: 'b'.repeat(32) } });

    // Scoped to the notice: the row is called "Account" too, which is the
    // point — the two have to agree.
    const notice = await screen.findByText(/You are now in/);
    expect(notice.textContent).toContain('Account');
    expect(notice.textContent).not.toContain('b'.repeat(32));
  });

  it('falls back to the key for an organization not in the list', async () => {
    show({ notice: { kind: 'elsewhere', landed: 'elsewhere-co' } });
    const notice = await screen.findByText(/You are now in/);
    expect(notice.textContent).toContain('elsewhere-co');
  });

  it('says so when the list cannot be loaded', async () => {
    mocks.listOrganizations.mockRejectedValue(new Error('offline'));
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    show();

    expect(
      await screen.findByText(
        'Could not load your organizations. Check your connection and try again.',
      ),
    ).toBeTruthy();
    warn.mockRestore();
  });

  it('says so when there is nowhere else to go', async () => {
    mocks.listOrganizations.mockResolvedValue([]);
    show();

    expect(
      await screen.findByText('You are not in any other organization yet.'),
    ).toBeTruthy();
  });

  it('says it is working while the list loads', () => {
    mocks.listOrganizations.mockReturnValue(new Promise(() => {}));
    show();

    expect(screen.getByText('Loading your organizations…')).toBeTruthy();
  });
});
