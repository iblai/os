'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  message: string;
  timestamp: number;
  from: {
    identity?: string;
    name?: string;
  };
}

interface Transcription {
  id: string;
  text: string;
  participantIdentity?: string;
  participantName?: string;
  isFinal: boolean;
  timestamp: number;
}

interface PipChatProps {
  /** Participant identity for identifying self vs others */
  localParticipantIdentity?: string;
  /** Reference to the parent window for postMessage communication (screen sharing popup) */
  parentWindow?: Window;
  /** Reference to the PIP window itself for receiving messages */
  pipWindow?: Window;
  /** Display name of the mentor */
  mentorName?: string;
}

/**
 * Minimal chat interface for use in PIP (Picture-in-Picture) window.
 * Communicates with the parent window via postMessage for chat functionality.
 */
export function PipChat({
  localParticipantIdentity,
  parentWindow,
  pipWindow,
  mentorName,
}: PipChatProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentTranscription, setCurrentTranscription] =
    useState<Transcription | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Listen for chat messages from parent window
  // We need to listen on the pipWindow (PIP window's window object) because
  // this component runs in the parent window's JS context even though it's
  // rendered in the PIP window's document
  useEffect(() => {
    // Use pipWindow if provided, otherwise fall back to window
    const targetWindow = pipWindow || window;

    const handleMessage = (event: MessageEvent) => {
      // Only log PIP-related messages to reduce noise
      if (event.data?.type?.startsWith?.('PIP:')) {
        console.log(
          '[PipChat] Received message:',
          event.data?.type,
          event.data,
        );
      }

      if (event.data?.type === 'PIP:CHAT_MESSAGE') {
        const { message, from, timestamp, id } = event.data;
        console.log('[PipChat] Adding chat message:', { id, message, from });
        setChatMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === id)) {
            console.log('[PipChat] Duplicate message, skipping:', id);
            return prev;
          }
          return [...prev, { id, message, from, timestamp }];
        });
      } else if (event.data?.type === 'PIP:CHAT_MESSAGES_SYNC') {
        // Sync all messages when PIP opens
        console.log(
          '[PipChat] Syncing messages:',
          event.data.messages?.length || 0,
          'messages',
        );
        setChatMessages(event.data.messages || []);
      } else if (event.data?.type === 'PIP:SEND_COMPLETE') {
        console.log('[PipChat] Send complete');
        setIsSending(false);
      } else if (event.data?.type === 'PIP:TRANSCRIPTION') {
        console.log('[PipChat] Received transcription:', event.data);
        const {
          id,
          text,
          participantIdentity,
          participantName,
          isFinal,
          timestamp,
        } = event.data;

        // Clear any existing timeout
        if (transcriptionTimeoutRef.current) {
          clearTimeout(transcriptionTimeoutRef.current);
        }

        // Update current transcription
        setCurrentTranscription({
          id,
          text,
          participantIdentity,
          participantName,
          isFinal,
          timestamp,
        });

        // Clear transcription after 5 seconds of no updates (for final transcriptions)
        if (isFinal) {
          transcriptionTimeoutRef.current = setTimeout(() => {
            setCurrentTranscription(null);
          }, 5000);
        }
      }
    };

    console.log(
      '[PipChat] Adding message listener to',
      pipWindow ? 'pipWindow' : 'window',
    );
    targetWindow.addEventListener('message', handleMessage);

    // Request initial message sync from parent
    if (parentWindow) {
      console.log('[PipChat] Requesting initial message sync from parent');
      parentWindow.postMessage({ type: 'PIP:REQUEST_MESSAGES_SYNC' }, '*');
    } else {
      console.warn('[PipChat] No parentWindow provided');
    }

    return () => targetWindow.removeEventListener('message', handleMessage);
  }, [parentWindow, pipWindow]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isSending || !parentWindow) {
      console.log('[PipChat] handleSend blocked:', {
        hasInput: !!inputValue.trim(),
        isSending,
        hasParentWindow: !!parentWindow,
      });
      return;
    }

    console.log('[PipChat] Sending message to parent:', inputValue.trim());
    setIsSending(true);

    // Send message to parent window for relay through LiveKit
    parentWindow.postMessage(
      {
        type: 'PIP:SEND_CHAT_MESSAGE',
        message: inputValue.trim(),
      },
      '*',
    );

    setInputValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, isSending, parentWindow]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOwnMessage = (fromIdentity?: string) => {
    return fromIdentity === localParticipantIdentity;
  };

  return (
    <div className="pip-chat-container">
      {/* Transcription display - shows mentor's speech in real-time */}
      {currentTranscription && (
        <div className="pip-transcription-container">
          <div className="pip-transcription-header">
            <div className="pip-transcription-indicator" />
            <span>
              {currentTranscription.participantIdentity ===
              localParticipantIdentity
                ? 'You are speaking'
                : `${mentorName || currentTranscription.participantName || currentTranscription.participantIdentity || 'Agent'} is speaking`}
            </span>
          </div>
          <div className="pip-transcription-text">
            {currentTranscription.text}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="pip-chat-messages">
        {chatMessages.length === 0 ? (
          <div className="pip-chat-empty">
            <p>No messages yet</p>
            <p className="pip-chat-empty-subtitle">
              Start chatting with the agent
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isOwn = isOwnMessage(msg.from?.identity);
            return (
              <div
                key={msg.id}
                className={`pip-chat-message ${isOwn ? 'pip-chat-message-own' : 'pip-chat-message-other'}`}
              >
                <div className="pip-chat-message-header">
                  <span className="pip-chat-message-sender">
                    {isOwn
                      ? 'You'
                      : mentorName ||
                        msg.from?.name ||
                        msg.from?.identity ||
                        'Agent'}
                  </span>
                  <span className="pip-chat-message-time">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="pip-chat-message-content">{msg.message}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="pip-chat-input-container">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="pip-chat-input"
          rows={1}
          disabled={isSending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
          className="pip-chat-send-button"
          aria-label="Send message"
        >
          {isSending ? (
            <div className="pip-chat-sending-spinner" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>

      <style>{`
        .pip-chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0f0f0f;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .pip-transcription-container {
          background: linear-gradient(135deg, #1e3a5f 0%, #1a2d45 100%);
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          padding: 10px 12px;
          flex-shrink: 0;
          animation: pip-transcription-fade-in 0.3s ease;
        }

        @keyframes pip-transcription-fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .pip-transcription-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 11px;
          color: #93c5fd;
          font-weight: 500;
        }

        .pip-transcription-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          animation: pip-transcription-pulse 1.5s ease-in-out infinite;
        }

        @keyframes pip-transcription-pulse {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
          }
          50% {
            opacity: 0.7;
            box-shadow: 0 0 0 6px rgba(59, 130, 246, 0);
          }
        }

        .pip-transcription-text {
          font-size: 13px;
          line-height: 1.5;
          color: #e5e7eb;
          max-height: 80px;
          overflow-y: auto;
        }

        .pip-transcription-text::-webkit-scrollbar {
          width: 4px;
        }

        .pip-transcription-text::-webkit-scrollbar-track {
          background: transparent;
        }

        .pip-transcription-text::-webkit-scrollbar-thumb {
          background: rgba(147, 197, 253, 0.3);
          border-radius: 2px;
        }

        .pip-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pip-chat-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          text-align: center;
        }

        .pip-chat-empty p {
          margin: 0;
          font-size: 14px;
        }

        .pip-chat-empty-subtitle {
          font-size: 12px !important;
          margin-top: 4px !important;
          color: #4b5563;
        }

        .pip-chat-message {
          max-width: 85%;
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.4;
        }

        .pip-chat-message-own {
          align-self: flex-end;
          background: #2563eb;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .pip-chat-message-other {
          align-self: flex-start;
          background: #1f1f1f;
          color: #e5e7eb;
          border-bottom-left-radius: 4px;
        }

        .pip-chat-message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          gap: 8px;
        }

        .pip-chat-message-sender {
          font-weight: 600;
          font-size: 11px;
          opacity: 0.9;
        }

        .pip-chat-message-time {
          font-size: 10px;
          opacity: 0.7;
        }

        .pip-chat-message-content {
          word-wrap: break-word;
          white-space: pre-wrap;
        }

        .pip-chat-input-container {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 12px;
          background: #1a1a1a;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .pip-chat-input {
          flex: 1;
          background: #0f0f0f;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 10px 14px;
          color: white;
          font-size: 14px;
          line-height: 1.4;
          resize: none;
          outline: none;
          transition: border-color 0.15s ease;
          min-height: 40px;
          max-height: 120px;
        }

        .pip-chat-input:focus {
          border-color: #2563eb;
        }

        .pip-chat-input::placeholder {
          color: #6b7280;
        }

        .pip-chat-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .pip-chat-send-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #2563eb;
          color: white;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .pip-chat-send-button:hover:not(:disabled) {
          background: #1d4ed8;
          transform: scale(1.05);
        }

        .pip-chat-send-button:disabled {
          background: #374151;
          color: #6b7280;
          cursor: not-allowed;
        }

        .pip-chat-sending-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: pip-spin 0.8s linear infinite;
        }

        @keyframes pip-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Scrollbar styling */
        .pip-chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .pip-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .pip-chat-messages::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 3px;
        }

        .pip-chat-messages::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
}
