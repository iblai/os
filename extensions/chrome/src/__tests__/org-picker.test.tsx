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
    show({ notice: 'Something else is signing in right now.' });

    expect(
      await screen.findByText('Something else is signing in right now.'),
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
