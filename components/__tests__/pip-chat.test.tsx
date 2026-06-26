import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PipChat } from '../pip-chat';

/**
 * Test suite for the PIP (Picture-in-Picture) chat container.
 *
 * The component communicates with a parent window via postMessage and listens
 * for incoming messages on a target window (pipWindow or the global window).
 * We drive coverage by dispatching MessageEvents and asserting on the rendered
 * output / outgoing postMessage calls.
 */

// Dispatch a message event on the given target with the provided data.
function dispatchMessage(target: Window, data: unknown) {
  act(() => {
    target.dispatchEvent(new MessageEvent('message', { data }));
  });
}

describe('PipChat', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders empty state when there are no messages', () => {
    render(<PipChat />);
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(
      screen.getByText('Start chatting with the agent'),
    ).toBeInTheDocument();
  });

  it('requests an initial message sync from the parent window on mount', () => {
    const postMessage = vi.fn();
    const parentWindow = { postMessage } as unknown as Window;

    render(<PipChat parentWindow={parentWindow} />);

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'PIP:REQUEST_MESSAGES_SYNC' },
      '*',
    );
  });

  it('warns when no parentWindow is provided', () => {
    render(<PipChat />);
    expect(console.warn).toHaveBeenCalledWith(
      '[PipChat] No parentWindow provided',
    );
  });

  it('adds an incoming chat message and renders it', () => {
    render(<PipChat localParticipantIdentity="me" mentorName="Mentor" />);

    dispatchMessage(window, {
      type: 'PIP:CHAT_MESSAGE',
      id: 'm1',
      message: 'Hello there',
      from: { identity: 'agent-1', name: 'Agent One' },
      timestamp: Date.now(),
    });

    expect(screen.getByText('Hello there')).toBeInTheDocument();
    // mentorName should be preferred as the sender label for non-own messages
    expect(screen.getByText('Mentor')).toBeInTheDocument();
  });

  it('marks the local participant message as own and labels it "You"', () => {
    render(<PipChat localParticipantIdentity="me" />);

    dispatchMessage(window, {
      type: 'PIP:CHAT_MESSAGE',
      id: 'own-1',
      message: 'my own message',
      from: { identity: 'me', name: 'Myself' },
      timestamp: Date.now(),
    });

    expect(screen.getByText('my own message')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('uses the from name / identity / agent fallback for the sender label', () => {
    render(<PipChat localParticipantIdentity="me" />);

    // Has a name -> uses name
    dispatchMessage(window, {
      type: 'PIP:CHAT_MESSAGE',
      id: 'a',
      message: 'with name',
      from: { identity: 'x', name: 'Named Sender' },
      timestamp: 1,
    });
    expect(screen.getByText('Named Sender')).toBeInTheDocument();

    // No name -> uses identity
    dispatchMessage(window, {
      type: 'PIP:CHAT_MESSAGE',
      id: 'b',
      message: 'with identity only',
      from: { identity: 'identity-only' },
      timestamp: 2,
    });
    expect(screen.getByText('identity-only')).toBeInTheDocument();

    // No name, no identity -> uses Agent fallback
    dispatchMessage(window, {
      type: 'PIP:CHAT_MESSAGE',
      id: 'c',
      message: 'no sender info',
      from: {},
      timestamp: 3,
    });
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('ignores duplicate chat messages with the same id', () => {
    render(<PipChat localParticipantIdentity="me" />);

    const payload = {
      type: 'PIP:CHAT_MESSAGE',
      id: 'dup',
      message: 'duplicate message',
      from: { identity: 'x' },
      timestamp: 1,
    };

    dispatchMessage(window, payload);
    dispatchMessage(window, payload);

    expect(screen.getAllByText('duplicate message')).toHaveLength(1);
  });

  it('syncs all messages on PIP:CHAT_MESSAGES_SYNC', () => {
    render(<PipChat localParticipantIdentity="me" />);

    dispatchMessage(window, {
      type: 'PIP:CHAT_MESSAGES_SYNC',
      messages: [
        {
          id: 's1',
          message: 'sync one',
          from: { identity: 'a' },
          timestamp: 1,
        },
        {
          id: 's2',
          message: 'sync two',
          from: { identity: 'b' },
          timestamp: 2,
        },
      ],
    });

    expect(screen.getByText('sync one')).toBeInTheDocument();
    expect(screen.getByText('sync two')).toBeInTheDocument();
  });

  it('handles a sync message with no messages array', () => {
    render(<PipChat localParticipantIdentity="me" />);

    dispatchMessage(window, { type: 'PIP:CHAT_MESSAGES_SYNC' });

    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('renders a transcription for another participant and clears it after timeout', () => {
    render(<PipChat localParticipantIdentity="me" mentorName="Prof. Mentor" />);

    dispatchMessage(window, {
      type: 'PIP:TRANSCRIPTION',
      id: 't1',
      text: 'this is being spoken',
      participantIdentity: 'agent-1',
      participantName: 'Agent One',
      isFinal: true,
      timestamp: Date.now(),
    });

    expect(screen.getByText('this is being spoken')).toBeInTheDocument();
    expect(screen.getByText('Prof. Mentor is speaking')).toBeInTheDocument();

    // The final transcription clears after 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('this is being spoken')).not.toBeInTheDocument();
  });

  it('renders "You are speaking" for the local participant transcription', () => {
    render(<PipChat localParticipantIdentity="me" />);

    dispatchMessage(window, {
      type: 'PIP:TRANSCRIPTION',
      id: 't-own',
      text: 'I am talking',
      participantIdentity: 'me',
      isFinal: false,
      timestamp: Date.now(),
    });

    expect(screen.getByText('You are speaking')).toBeInTheDocument();
    expect(screen.getByText('I am talking')).toBeInTheDocument();
  });

  it('falls back to participant name / identity / agent in transcription label', () => {
    const { rerender } = render(<PipChat localParticipantIdentity="me" />);

    // participantName present (no mentorName)
    dispatchMessage(window, {
      type: 'PIP:TRANSCRIPTION',
      id: 'tn',
      text: 'speak 1',
      participantIdentity: 'agent-x',
      participantName: 'Named Participant',
      isFinal: false,
      timestamp: 1,
    });
    expect(
      screen.getByText('Named Participant is speaking'),
    ).toBeInTheDocument();

    // participantIdentity only
    rerender(<PipChat localParticipantIdentity="me" key="b" />);
    dispatchMessage(window, {
      type: 'PIP:TRANSCRIPTION',
      id: 'ti',
      text: 'speak 2',
      participantIdentity: 'just-identity',
      isFinal: false,
      timestamp: 2,
    });
    expect(screen.getByText('just-identity is speaking')).toBeInTheDocument();
  });

  it('resets the transcription timeout when a new final transcription arrives', () => {
    render(<PipChat localParticipantIdentity="me" />);

    dispatchMessage(window, {
      type: 'PIP:TRANSCRIPTION',
      id: 't1',
      text: 'first final',
      participantIdentity: 'agent',
      isFinal: true,
      timestamp: 1,
    });

    // Advance partway, then send another final transcription which clears the
    // existing timeout (covers the clearTimeout branch).
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    dispatchMessage(window, {
      type: 'PIP:TRANSCRIPTION',
      id: 't2',
      text: 'second final',
      participantIdentity: 'agent',
      isFinal: true,
      timestamp: 2,
    });

    expect(screen.getByText('second final')).toBeInTheDocument();
  });

  it('sends a message to the parent window and clears the input', () => {
    const postMessage = vi.fn();
    const parentWindow = { postMessage } as unknown as Window;

    render(<PipChat parentWindow={parentWindow} />);
    postMessage.mockClear(); // ignore the initial sync request

    const textarea = screen.getByPlaceholderText(
      'Type a message...',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello parent' } });

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendButton);

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'PIP:SEND_CHAT_MESSAGE', message: 'hello parent' },
      '*',
    );
    expect(textarea.value).toBe('');
  });

  it('does not send when the input is empty or whitespace only', () => {
    const postMessage = vi.fn();
    const parentWindow = { postMessage } as unknown as Window;

    render(<PipChat parentWindow={parentWindow} />);
    postMessage.mockClear();

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: '   ' } });

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendButton);

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does not send when there is no parentWindow', () => {
    render(<PipChat />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'no parent' } });

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    // Button is disabled-eligible but handleSend also guards on parentWindow
    fireEvent.click(sendButton);

    // Input should remain because send is blocked
    expect((textarea as HTMLTextAreaElement).value).toBe('no parent');
  });

  it('sends on Enter key without shift and stops sending on PIP:SEND_COMPLETE', () => {
    const postMessage = vi.fn();
    const parentWindow = { postMessage } as unknown as Window;

    render(<PipChat parentWindow={parentWindow} />);
    postMessage.mockClear();

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'enter message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'PIP:SEND_CHAT_MESSAGE', message: 'enter message' },
      '*',
    );

    // While sending, the spinner is shown instead of the Send icon.
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();

    // Parent reports the send completed.
    dispatchMessage(window, { type: 'PIP:SEND_COMPLETE' });

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled(); // still disabled because input is now empty
  });

  it('does not send on Shift+Enter (newline)', () => {
    const postMessage = vi.fn();
    const parentWindow = { postMessage } as unknown as Window;

    render(<PipChat parentWindow={parentWindow} />);
    postMessage.mockClear();

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'multiline' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('listens on the provided pipWindow when given', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const pipWindow = window as unknown as Window;

    render(<PipChat pipWindow={pipWindow} />);

    expect(addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
  });

  it('logs PIP-prefixed message types but tolerates non-PIP messages', () => {
    render(<PipChat localParticipantIdentity="me" />);

    // Non-PIP message should be ignored without error.
    dispatchMessage(window, { type: 'OTHER:EVENT' });
    // A message with no type at all.
    dispatchMessage(window, { foo: 'bar' });

    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });
});
