import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { useNavigate } from '@/hooks/user-navigate';
import { modalReducer, type ModalInfo } from '@/features/navigation/slice';
import { mentorApiSlice } from '@iblai/iblai-js/data-layer';

// --- Mocks ---
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// We parameterize search params per-test via this variable
let mockSearchParamsRaw = '';
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => '/platform/tenant123/mentor456',
  useParams: () => ({ tenantKey: 'tenant123', mentorId: 'mentor456' }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsRaw),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => vi.fn(),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({}),
}));

vi.mock('@/lib/eventBus', () => ({
  default: { emit: vi.fn() },
  RemoteEvents: {},
}));

vi.mock('@web-utils/providers', () => ({
  useTenantContext: () => ({
    setDetermineUserPath: vi.fn(),
    determineUserPath: false,
    tenantKey: 'tenant123',
    metadata: {},
    setMetadata: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: () => [{}, vi.fn()],
}));

// Helper to extract and parse the `modal` query param from a pushed path
function getModalParamFromPushArg(arg: string | undefined): string | null {
  if (!arg) return null;
  const [, query] = arg.split('?');
  if (!query) return null;
  const params = new URLSearchParams(query);
  return params.get('modal');
}

function createTestStore(preloadedStack: ModalInfo[] = []) {
  return configureStore({
    reducer: {
      modals: modalReducer,
      [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(mentorApiSlice.middleware),
    preloadedState: {
      modals: {
        modalStack: preloadedStack,
        customAlertDialog: {
          message: '',
          validateTrigger: '',
          cancelTrigger: '',
          isOpen: false,
          title: '',
        },
        iframeCloseButton: false,
        darkMode: false,
        shortcutsModal: false,
      },
    },
  });
}

// Small component to expose hook actions via buttons
function HookHarness({ onReady }: { onReady?: (api: ReturnType<typeof useNavigate>) => void }) {
  const api = useNavigate();
  useEffect(() => {
    onReady?.(api);
  }, [api, onReady]);
  return (
    <div>
      <button aria-label="open-create-mentor" onClick={() => api.openCreateMentorModal()} />
      <button aria-label="close-modal" onClick={() => api.closeCreateMentorModal()} />
      <button aria-label="change-tab" onClick={() => api.changeModalTab('prompts')} />
      <button aria-label="go-home" onClick={() => api.navigateToHome()} />
    </div>
  );
}

describe('useNavigate', () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    mockSearchParamsRaw = '';
  });

  it('syncs Redux modal stack from URL on mount', async () => {
    const stackFromUrl: ModalInfo[] = [{ name: 'settings' }];
    mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(stackFromUrl))}`;

    const store = createTestStore([]);

    render(
      <Provider store={store}>
        <HookHarness />
      </Provider>,
    );

    await waitFor(() => {
      expect(store.getState().modals.modalStack).toEqual(stackFromUrl);
    });
  });

  it('openCreateMentorModal pushes URL with new modal stack', async () => {
    mockSearchParamsRaw = '';
    const store = createTestStore([]);

    render(
      <Provider store={store}>
        <HookHarness />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-create-mentor' }));

    expect(pushMock).toHaveBeenCalled();
    const arg = pushMock.mock.calls.at(-1)?.[0] as string;
    const modalParam = getModalParamFromPushArg(arg);
    expect(modalParam).toEqual(JSON.stringify([{ name: 'create_mentor' }]));
  });

  it('closeModal trims the stack when more than one modal open', async () => {
    const initialStack: ModalInfo[] = [
      { name: 'settings' },
      { name: 'edit_mentor', tab: 'settings' },
    ];
    mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(initialStack))}`;
    const store = createTestStore(initialStack);

    render(
      <Provider store={store}>
        <HookHarness />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'close-modal' }));
    const arg = pushMock.mock.calls.at(-1)?.[0] as string;
    const modalParam = getModalParamFromPushArg(arg);
    expect(modalParam).toEqual(JSON.stringify([{ name: 'settings' }]));
  });

  it('closeModal removes modal param when only one modal is open', async () => {
    const initialStack: ModalInfo[] = [{ name: 'settings' }];
    mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(initialStack))}`;
    const store = createTestStore(initialStack);

    render(
      <Provider store={store}>
        <HookHarness />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'close-modal' }));
    const arg = pushMock.mock.calls.at(-1)?.[0] as string;
    // Expect no query string
    expect(arg).toBe('/platform/tenant123/mentor456');
  });

  it('changeModalTab updates the top modal tab in the URL', async () => {
    const initialStack: ModalInfo[] = [{ name: 'edit_mentor', tab: 'settings' }];
    mockSearchParamsRaw = `modal=${encodeURIComponent(JSON.stringify(initialStack))}`;
    const store = createTestStore(initialStack);

    render(
      <Provider store={store}>
        <HookHarness />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'change-tab' }));
    const arg = pushMock.mock.calls.at(-1)?.[0] as string;
    const modalParam = getModalParamFromPushArg(arg);
    expect(modalParam).toEqual(JSON.stringify([{ name: 'edit_mentor', tab: 'prompts' }]));
  });

  it('navigateToHome routes to mentor home using params', async () => {
    const store = createTestStore([]);

    render(
      <Provider store={store}>
        <HookHarness />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'go-home' }));
    expect(pushMock).toHaveBeenCalledWith('/platform/tenant123/mentor456');
  });
});
