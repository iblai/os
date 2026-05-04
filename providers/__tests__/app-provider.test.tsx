import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// ── controllable mocks ──────────────────────────────────────────────────────

const mockDispatch = vi.fn();
const mockGetVectorDocuments = vi.fn().mockResolvedValue({});
const mockGetRecentMessages = vi.fn().mockResolvedValue({});
const mockGetPinnedMessages = vi.fn().mockResolvedValue({});
const mockSendMessageToParentWebsite = vi.fn();

let mockParams: Record<string, string> = { tenantKey: 'tenant-xyz' };

let capturedIframeMessageHandler: {
  handlers?: Record<string, (event: MessageEvent) => unknown>;
  defaultHandler?: (data: Record<string, unknown>) => void;
} = {};

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/lib/utils', () => ({
  sendMessageToParentWebsite: (...args: unknown[]) =>
    mockSendMessageToParentWebsite(...args),
}));

vi.mock('@/features/utils', () => ({
  getUserId: () => 'user-id-123',
  getUserName: () => 'user-name-abc',
}));

vi.mock('@/lib/features/app/app-slice', () => ({
  updateSessionId: (payload: string) => ({
    type: 'app/updateSessionId',
    payload,
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetVectorDocumentsQuery: () => [mockGetVectorDocuments],
  useLazyGetRecentMessageQuery: () => [mockGetRecentMessages],
  useLazyGetPinnedMessagesQuery: () => [mockGetPinnedMessages],
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  useIframeMessageHandler: (opts: {
    handlers?: Record<string, (event: MessageEvent) => unknown>;
    defaultHandler?: (data: Record<string, unknown>) => void;
  }) => {
    capturedIframeMessageHandler = opts;
  },
}));

vi.mock('../message-bridge-provider', () => ({
  MessageBridgeProvider: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="message-bridge-provider">{children}</div>
  ),
}));

// ── import component after mocks ────────────────────────────────────────────

import AppProvider from '../app-provider';

// ── helpers ─────────────────────────────────────────────────────────────────

function resetState() {
  mockParams = { tenantKey: 'tenant-xyz' };
  capturedIframeMessageHandler = {};
}

describe('AppProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  describe('basic rendering', () => {
    it('renders children through MessageBridgeProvider', () => {
      const { getByText, getByTestId } = render(
        <AppProvider>
          <div>Hello AppProvider</div>
        </AppProvider>,
      );
      expect(getByTestId('message-bridge-provider')).toBeInTheDocument();
      expect(getByText('Hello AppProvider')).toBeInTheDocument();
    });

    it('renders null children without crashing', () => {
      const { container } = render(<AppProvider>{null}</AppProvider>);
      expect(container).toBeTruthy();
    });
  });

  describe('parent postMessage on mount', () => {
    it('sends ready message to parent on mount', () => {
      render(
        <AppProvider>
          <div />
        </AppProvider>,
      );
      expect(mockSendMessageToParentWebsite).toHaveBeenCalledWith({
        ready: true,
      });
    });

    it('sends ready only once on mount', () => {
      const { rerender } = render(
        <AppProvider>
          <div>1</div>
        </AppProvider>,
      );
      rerender(
        <AppProvider>
          <div>2</div>
        </AppProvider>,
      );
      expect(mockSendMessageToParentWebsite).toHaveBeenCalledTimes(1);
    });
  });

  describe('iframe message handler registration', () => {
    it('registers a MENTOR:RESPONDED handler', () => {
      render(
        <AppProvider>
          <div />
        </AppProvider>,
      );
      expect(capturedIframeMessageHandler.handlers).toBeDefined();
      expect(
        capturedIframeMessageHandler.handlers?.['MENTOR:RESPONDED'],
      ).toBeTypeOf('function');
    });

    it('does not register a defaultHandler (owned by parent Providers)', () => {
      render(
        <AppProvider>
          <div />
        </AppProvider>,
      );
      expect(capturedIframeMessageHandler.defaultHandler).toBeUndefined();
    });
  });

  describe('MENTOR:RESPONDED handler', () => {
    async function invokeMentorResponded(
      event: Partial<MessageEvent> & { data: Record<string, unknown> },
    ) {
      render(
        <AppProvider>
          <div />
        </AppProvider>,
      );
      const handler =
        capturedIframeMessageHandler.handlers?.['MENTOR:RESPONDED'];
      expect(handler).toBeTypeOf('function');
      await act(async () => {
        await handler!(event as MessageEvent);
      });
    }

    it('dispatches updateSessionId with the received sessionId', async () => {
      await invokeMentorResponded({
        data: { value: { sessionId: 'session-1' } },
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'app/updateSessionId',
        payload: 'session-1',
      });
    });

    it('fetches vector documents with tenant, session, and user id', async () => {
      await invokeMentorResponded({
        data: { value: { sessionId: 'session-2' } },
      });
      expect(mockGetVectorDocuments).toHaveBeenCalledWith({
        org: 'tenant-xyz',
        sessionId: 'session-2',
        userId: 'user-id-123',
      });
    });

    it('fetches recent messages with tenant and user name', async () => {
      await invokeMentorResponded({
        data: { value: { sessionId: 'session-3' } },
      });
      expect(mockGetRecentMessages).toHaveBeenCalledWith({
        org: 'tenant-xyz',
        userId: 'user-name-abc',
      });
    });

    it('fetches pinned messages with tenant, session, and user name', async () => {
      await invokeMentorResponded({
        data: { value: { sessionId: 'session-4' } },
      });
      expect(mockGetPinnedMessages).toHaveBeenCalledWith({
        org: 'tenant-xyz',
        sessionId: 'session-4',
        userId: 'user-name-abc',
      });
    });

    it('uses the tenantKey from next/navigation params', async () => {
      mockParams = { tenantKey: 'other-tenant' };
      await invokeMentorResponded({
        data: { value: { sessionId: 'session-5' } },
      });
      expect(mockGetVectorDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ org: 'other-tenant' }),
      );
      expect(mockGetRecentMessages).toHaveBeenCalledWith(
        expect.objectContaining({ org: 'other-tenant' }),
      );
      expect(mockGetPinnedMessages).toHaveBeenCalledWith(
        expect.objectContaining({ org: 'other-tenant' }),
      );
    });

    it('awaits each data-layer query in sequence', async () => {
      const order: string[] = [];
      mockGetVectorDocuments.mockImplementationOnce(async () => {
        order.push('vector');
      });
      mockGetRecentMessages.mockImplementationOnce(async () => {
        order.push('recent');
      });
      mockGetPinnedMessages.mockImplementationOnce(async () => {
        order.push('pinned');
      });
      await invokeMentorResponded({
        data: { value: { sessionId: 'session-6' } },
      });
      expect(order).toEqual(['vector', 'recent', 'pinned']);
    });
  });
});
