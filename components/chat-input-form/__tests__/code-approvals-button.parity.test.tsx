import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as before from './fixtures/code-approvals-button.before';
import * as after from '../code-approvals-button';

/**
 * The approvals button and its store moved into the SDK unchanged. The fixture
 * is the OS file as it was before the move, kept verbatim: every check here
 * drives the fixture and the SDK-backed wrapper the same way and requires the
 * same result.
 */

const locale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  const catalogs: Record<string, Record<string, unknown>> = {
    en: (await import('../../../messages/en.json')).default,
    es: (await import('../../../messages/es.json')).default,
    fr: (await import('../../../messages/fr.json')).default,
    zh: (await import('../../../messages/zh.json')).default,
  };
  return {
    ...actual,
    useTranslations: (namespace: string) =>
      actual.createTranslator({
        locale: locale.current,
        messages: catalogs[locale.current],
        namespace: namespace as any,
      }),
  };
});

type Button = typeof after.CodeApprovalsButton;
type Store = Pick<
  typeof after,
  | 'useApprovalMode'
  | 'useOfferApprovals'
  | 'useApprovalsOffered'
  | 'setApprovalMode'
  | 'applyApprovalMode'
  | 'loadApprovalMode'
  | 'seedApprovalMode'
  | 'resetApprovalModeForTests'
>;

const LOCALES = ['en', 'es', 'fr', 'zh'] as const;
const MODES: after.PermissionMode[] = ['manual', 'auto'];

/** React's useId values, which differ between any two renders. */
const normalise = (html: string) =>
  html.replace(/radix-(?:«[^»]+»|:[^:"]+:)/g, 'radix-ID');

const bodyHtml = () => normalise(document.body.innerHTML);

const focusedHtml = () =>
  document.activeElement === document.body
    ? 'body'
    : normalise(document.activeElement?.outerHTML ?? 'none');

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Everything a user meets, from the closed button to a pick. */
async function journey(Button: Button, mode: after.PermissionMode) {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Button mode={mode} onChange={onChange} />);
  const trigger = screen.getByTestId('code-approvals-button');
  await settle();
  const closed = bodyHtml();

  await user.click(trigger);
  const menu = await screen.findByRole('dialog');
  await settle();
  const open = bodyHtml();
  const menuHtml = normalise(menu.outerHTML);
  const menuFocusedOnOpen = document.activeElement === menu;
  const focusedOnOpen = focusedHtml();

  await user.tab();
  const focusedAfterTab = focusedHtml();

  const other = mode === 'auto' ? 'manual' : 'auto';
  await user.click(screen.getByTestId(`code-approvals-option-${other}`));
  await settle();
  const afterPick = bodyHtml();
  const picks = onChange.mock.calls;

  await user.click(trigger);
  await screen.findByRole('dialog');
  await user.keyboard('{Escape}');
  await settle();
  const afterEscape = bodyHtml();
  const menuAfterEscape = screen.queryByRole('dialog') !== null;

  cleanup();
  return {
    closed,
    open,
    menuHtml,
    menuFocusedOnOpen,
    focusedOnOpen,
    focusedAfterTab,
    afterPick,
    picks,
    afterEscape,
    menuAfterEscape,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Every guard of the store, run in one fixed order. */
async function storeTrace(store: Store) {
  const trace: unknown[] = [];
  const reset = () => act(() => store.resetApprovalModeForTests());
  reset();
  const view = renderHook(() => ({
    mode: store.useApprovalMode(),
    offered: store.useApprovalsOffered(),
  }));
  const note = (label: string, ...extra: unknown[]) =>
    trace.push([label, view.result.current.mode, ...extra]);
  note('initial', view.result.current.offered);

  for (const answer of ['auto', null, undefined, 'garbage', 'manual']) {
    await act(() => store.loadApprovalMode(async () => answer));
    note(`read ${String(answer)}`);
  }
  await act(() => store.loadApprovalMode(async () => 'auto'));
  await act(() =>
    store.loadApprovalMode(() => Promise.reject(new Error('no command'))),
  );
  note('read rejects');

  reset();
  const readBeforePick = deferred<string>();
  const reading = store.loadApprovalMode(() => readBeforePick.promise);
  act(() => store.setApprovalMode('auto'));
  readBeforePick.resolve('manual');
  await act(() => reading);
  note('read that started before a pick');

  const seedAfterPick = vi.fn(async () => 'manual');
  await act(() => store.seedApprovalMode(seedAfterPick));
  note('seed after a pick', seedAfterPick.mock.calls.length);

  for (const answer of [undefined, null, 'garbage', 'auto', 'manual']) {
    reset();
    await act(() => store.seedApprovalMode(async () => answer));
    note(`seed ${String(answer)}`);
  }
  reset();
  await act(() =>
    store.seedApprovalMode(() => Promise.reject(new Error('no command'))),
  );
  note('seed rejects');

  reset();
  const readBeforeSeed = deferred<string>();
  const readingBeforeSeed = store.loadApprovalMode(
    () => readBeforeSeed.promise,
  );
  await act(() => store.seedApprovalMode(async () => 'auto'));
  readBeforeSeed.resolve('manual');
  await act(() => readingBeforeSeed);
  note('read that started before a seed');

  reset();
  const seedInFlight = deferred<unknown>();
  const seeding = store.seedApprovalMode(() => seedInFlight.promise);
  act(() => store.setApprovalMode('auto'));
  seedInFlight.resolve('manual');
  await act(() => seeding);
  note('seed answered after a pick');

  reset();
  let saved: boolean | undefined;
  const save = vi.fn(async () => undefined);
  const onFailure = vi.fn();
  await act(async () => {
    saved = await store.applyApprovalMode('auto', save, onFailure);
  });
  note('apply saved', saved, save.mock.calls, onFailure.mock.calls.length);

  reset();
  const failure = new Error('save failed');
  const reread = vi.fn(async () => 'auto');
  onFailure.mockClear();
  await act(async () => {
    saved = await store.applyApprovalMode(
      'auto',
      () => Promise.reject(failure),
      onFailure,
      reread,
    );
  });
  await settle();
  note(
    'apply failed, reread',
    saved,
    onFailure.mock.calls[0]?.[0] === failure,
    reread.mock.calls.length,
  );

  reset();
  onFailure.mockClear();
  await act(async () => {
    saved = await store.applyApprovalMode(
      'auto',
      () => Promise.reject(failure),
      onFailure,
    );
  });
  note('apply failed, no reread', saved, onFailure.mock.calls.length);

  reset();
  const slowSave = deferred<unknown>();
  const laterReread = vi.fn(async () => 'auto');
  onFailure.mockClear();
  let applying!: Promise<boolean>;
  act(() => {
    applying = store.applyApprovalMode(
      'auto',
      () => slowSave.promise,
      onFailure,
      laterReread,
    );
  });
  act(() => store.setApprovalMode('manual'));
  slowSave.reject(failure);
  await act(async () => {
    saved = await applying;
  });
  note(
    'apply failed after a newer pick',
    saved,
    onFailure.mock.calls.length,
    laterReread.mock.calls.length,
  );

  const offerA = renderHook(({ offer }) => store.useOfferApprovals(offer), {
    initialProps: { offer: true },
  });
  const offerB = renderHook(() => store.useOfferApprovals(true));
  note('two offers', view.result.current.offered);
  offerA.rerender({ offer: false });
  note('one withdrawn', view.result.current.offered);
  offerB.unmount();
  note('none left', view.result.current.offered);
  offerA.rerender({ offer: true });
  note('offered again', view.result.current.offered);
  offerA.unmount();
  note('unmounted', view.result.current.offered);

  view.unmount();
  reset();
  return trace;
}

describe('CodeApprovalsButton parity with the pre-SDK OS button', () => {
  afterEach(() => {
    locale.current = 'en';
  });

  for (const lang of LOCALES) {
    for (const mode of MODES) {
      it(`renders and behaves identically: ${lang}, ${mode}`, async () => {
        locale.current = lang;
        const reference = await journey(before.CodeApprovalsButton, mode);
        const moved = await journey(after.CodeApprovalsButton, mode);

        expect(moved).toEqual(reference);
        expect(reference.menuFocusedOnOpen).toBe(true);
        expect(reference.picks).toEqual([
          [mode === 'auto' ? 'manual' : 'auto'],
        ]);
        expect(reference.menuAfterEscape).toBe(false);
        expect(reference.open).toContain('role="radiogroup"');
        expect(reference.open).not.toBe(reference.closed);
      });
    }
  }

  it('exports the same icons and modes', () => {
    expect(after.PERMISSION_MODES).toEqual(before.PERMISSION_MODES);
    for (const mode of MODES) {
      const ReferenceIcon = before.PERMISSION_MODE_ICONS[mode];
      const MovedIcon = after.PERMISSION_MODE_ICONS[mode];
      const { container: ref } = render(<ReferenceIcon aria-hidden="true" />);
      const { container: moved } = render(<MovedIcon aria-hidden="true" />);
      expect(moved.innerHTML).toBe(ref.innerHTML);
    }
  });

  it('keeps every guard of the store', async () => {
    const reference = await storeTrace(before);
    const moved = await storeTrace(after);

    expect(moved).toEqual(reference);
    expect(reference).toContainEqual([
      'read that started before a pick',
      'auto',
    ]);
    expect(reference).toContainEqual(['seed after a pick', 'auto', 0]);
    expect(reference).toContainEqual([
      'apply failed, reread',
      'auto',
      false,
      true,
      1,
    ]);
    expect(reference).toContainEqual([
      'apply failed after a newer pick',
      'manual',
      false,
      1,
      0,
    ]);
    expect(reference).toContainEqual(['one withdrawn', 'manual', true]);
    expect(reference).toContainEqual(['none left', 'manual', false]);
  });
});
