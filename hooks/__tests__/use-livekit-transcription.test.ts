import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// The hook only needs the RoomEvent enum from livekit-client; everything else
// it touches is a plain object we hand it.
vi.mock('livekit-client', () => ({
  RoomEvent: {
    TranscriptionReceived: 'transcriptionReceived',
  },
}));

import {
  DEFAULT_MAX_TRANSCRIPT_ENTRIES,
  joinTranscriptionSegments,
  useLiveKitTranscription,
} from '../use-livekit-transcription';

const TRANSCRIPTION_EVENT = 'transcriptionReceived';

type Handler = (...args: unknown[]) => void;

function createRoom(localIdentity: string | undefined = 'local-user') {
  const handlers: Record<string, Handler[]> = {};

  return {
    state: 'connected',
    localParticipant: localIdentity ? { identity: localIdentity } : undefined,
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = [...(handlers[event] ?? []), handler];
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== handler);
    }),
    listenerCount: (event: string) => (handlers[event] ?? []).length,
    emit: (event: string, ...args: unknown[]) =>
      (handlers[event] ?? []).forEach((handler) => handler(...args)),
  };
}

type FakeRoom = ReturnType<typeof createRoom>;

function segment(
  id: string,
  text: string,
  final = false,
): Record<string, unknown> {
  return { id, text, final, startTime: 0, endTime: 0, language: 'en' };
}

const localParticipant = { identity: 'local-user', name: 'Me', isLocal: true };
const agentParticipant = {
  identity: 'agent-7',
  name: 'Agent Seven',
  isLocal: false,
};

const render = (room: FakeRoom | null, options: Record<string, any> = {}) =>
  renderHook(
    (props: Record<string, any>) => useLiveKitTranscription(props as any),
    { initialProps: { room, ...options } },
  );

function emit(
  room: FakeRoom,
  segments: unknown,
  participant?: Record<string, unknown>,
) {
  act(() => {
    room.emit(TRANSCRIPTION_EVENT, segments, participant);
  });
}

describe('useLiveKitTranscription', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('subscription lifecycle', () => {
    it('subscribes to TranscriptionReceived on mount and logs it', () => {
      const room = createRoom();
      render(room);

      expect(room.on).toHaveBeenCalledWith(
        TRANSCRIPTION_EVENT,
        expect.any(Function),
      );
      expect(logSpy).toHaveBeenCalledWith(
        '[VoiceChat:Transcription]',
        'Subscribed to RoomEvent.TranscriptionReceived',
        expect.objectContaining({
          roomState: 'connected',
          localParticipant: 'local-user',
        }),
      );
    });

    it('removes the listener on unmount', () => {
      const room = createRoom();
      const { unmount } = render(room);

      expect(room.listenerCount(TRANSCRIPTION_EVENT)).toBe(1);

      unmount();

      expect(room.off).toHaveBeenCalledWith(
        TRANSCRIPTION_EVENT,
        expect.any(Function),
      );
      expect(room.listenerCount(TRANSCRIPTION_EVENT)).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        '[VoiceChat:Transcription]',
        'Unsubscribed from RoomEvent.TranscriptionReceived',
      );
    });

    it('does not update state after unmount', () => {
      const room = createRoom();
      const { unmount } = render(room);
      unmount();

      // Nothing is listening anymore, so this is a no-op rather than a
      // "setState on an unmounted component" warning.
      expect(() =>
        room.emit(TRANSCRIPTION_EVENT, [segment('s1', 'ghost', true)]),
      ).not.toThrow();
    });

    it('warns and stays inert when there is no room', () => {
      const { result } = render(null);

      expect(result.current.entries).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        '[VoiceChat:Transcription]',
        'No room available; not subscribing',
      );
    });

    it('re-subscribes when the room instance changes', () => {
      const first = createRoom();
      const second = createRoom();
      const { rerender } = render(first);

      rerender({ room: second });

      expect(first.listenerCount(TRANSCRIPTION_EVENT)).toBe(0);
      expect(second.listenerCount(TRANSCRIPTION_EVENT)).toBe(1);
    });
  });

  describe('accumulation', () => {
    it('appends a new segment id as a new entry', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'Hello', true)], agentParticipant);
      emit(room, [segment('s2', 'How are you', true)], localParticipant);

      expect(result.current.entries.map((e) => e.text)).toEqual([
        'Hello',
        'How are you',
      ]);
    });

    it('keeps every utterance for the life of the call', () => {
      const room = createRoom();
      const { result } = render(room);

      for (let i = 0; i < 12; i += 1) {
        emit(room, [segment(`s${i}`, `line ${i}`, true)], agentParticipant);
      }

      expect(result.current.entries).toHaveLength(12);
      expect(result.current.entries[0].text).toBe('line 0');
    });

    it('updates a known segment id in place instead of appending', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'Hel')], agentParticipant);
      emit(room, [segment('s1', 'Hello the')], agentParticipant);
      emit(room, [segment('s1', 'Hello there', true)], agentParticipant);

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]).toMatchObject({
        id: 's1',
        text: 'Hello there',
        isFinal: true,
      });
    });

    it('preserves the original timestamp across partial updates', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'Hel')], agentParticipant);
      const firstTimestamp = result.current.entries[0].timestamp;

      emit(room, [segment('s1', 'Hello', true)], agentParticipant);

      expect(result.current.entries[0].timestamp).toBe(firstTimestamp);
    });

    it('keeps ordering stable when two speakers interleave partials', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('u1', 'What is')], localParticipant);
      emit(room, [segment('a1', 'Let me')], agentParticipant);
      emit(room, [segment('u1', 'What is the time', true)], localParticipant);
      emit(room, [segment('a1', 'Let me check', true)], agentParticipant);

      expect(
        result.current.entries.map((e) => [e.id, e.speaker, e.text]),
      ).toEqual([
        ['u1', 'user', 'What is the time'],
        ['a1', 'agent', 'Let me check'],
      ]);
    });

    it('does not reopen a finalised entry when a late partial arrives', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'Done', true)], agentParticipant);
      emit(room, [segment('s1', 'Done later')], agentParticipant);

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].isFinal).toBe(true);
      expect(result.current.entries[0].text).toBe('Done later');
    });

    it('treats a duplicate final event for the same id as an update', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'Same', true)], agentParticipant);
      emit(room, [segment('s1', 'Same', true)], agentParticipant);

      expect(result.current.entries).toHaveLength(1);
    });

    it('updates an older entry in place when ids arrive out of order', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'first')], agentParticipant);
      emit(room, [segment('s2', 'second')], localParticipant);
      emit(room, [segment('s1', 'first, corrected', true)], agentParticipant);

      expect(result.current.entries.map((e) => e.text)).toEqual([
        'first, corrected',
        'second',
      ]);
    });

    it('trims the oldest entries past the retention ceiling', () => {
      const room = createRoom();
      const { result } = render(room, { maxEntries: 3 });

      ['a', 'b', 'c', 'd'].forEach((id) =>
        emit(room, [segment(id, id, true)], agentParticipant),
      );

      expect(result.current.entries.map((e) => e.id)).toEqual(['b', 'c', 'd']);
    });

    it('defaults the retention ceiling to 500 entries', () => {
      expect(DEFAULT_MAX_TRANSCRIPT_ENTRIES).toBe(500);
    });

    it('resets the accumulated transcript', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'Hello', true)], agentParticipant);
      expect(result.current.hasReceivedTranscription).toBe(true);

      act(() => result.current.reset());

      expect(result.current.entries).toEqual([]);
      expect(result.current.hasReceivedTranscription).toBe(false);
    });
  });

  describe('degenerate events', () => {
    it('records that an event arrived even when it carries no segments', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [], agentParticipant);

      expect(result.current.entries).toEqual([]);
      expect(result.current.hasReceivedTranscription).toBe(true);
    });

    it('survives an undefined segment list', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, undefined, agentParticipant);

      expect(result.current.entries).toEqual([]);
      expect(result.current.hasReceivedTranscription).toBe(true);
    });

    it('treats a segment with no final flag as still in progress', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [{ id: 's1', text: 'Half a thought' }], agentParticipant);

      expect(result.current.entries[0].isFinal).toBe(false);
      expect(result.current.isTranscribing).toBe(true);
    });

    it('drops a segment with no id and says so', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [{ text: 'orphan', final: true }], agentParticipant);

      expect(result.current.entries).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        '[VoiceChat:Transcription]',
        'Dropping transcription without a segment id',
        { text: 'orphan' },
      );
    });

    it('tolerates a segment with no text', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [{ id: 's1', final: false }], agentParticipant);

      expect(result.current.entries[0].text).toBe('');
    });

    it('logs every event so a silent agent is distinguishable', () => {
      const room = createRoom();
      render(room);

      emit(room, [segment('s1', 'Hello', true)], agentParticipant);

      expect(logSpy).toHaveBeenCalledWith(
        '[VoiceChat:Transcription]',
        'TranscriptionReceived',
        expect.objectContaining({
          segmentCount: 1,
          participantIdentity: 'agent-7',
          participantName: 'Agent Seven',
          isLocal: false,
          finals: [true],
        }),
      );
    });
  });

  describe('speaker attribution', () => {
    it('labels the local participant as the user by identity', () => {
      const room = createRoom('local-user');
      const { result } = render(room);

      emit(room, [segment('s1', 'mine', true)], {
        identity: 'local-user',
        name: 'Me',
      });

      expect(result.current.entries[0].speaker).toBe('user');
    });

    it('labels the local participant as the user by isLocal', () => {
      // Identity is not known yet (room still connecting) but LiveKit still
      // flags the participant as local.
      const room = createRoom(undefined);
      const { result } = render(room);

      emit(room, [segment('s1', 'mine', true)], {
        identity: 'someone-else',
        isLocal: true,
      });

      expect(result.current.entries[0].speaker).toBe('user');
    });

    it('labels any other participant as the agent', () => {
      const room = createRoom('local-user');
      const { result } = render(room);

      emit(room, [segment('s1', 'theirs', true)], agentParticipant);

      expect(result.current.entries[0]).toMatchObject({
        speaker: 'agent',
        participantName: 'Agent Seven',
        participantIdentity: 'agent-7',
      });
    });

    it('labels an unattributed transcription as the agent', () => {
      const room = createRoom('local-user');
      const { result } = render(room);

      emit(room, [segment('s1', 'from nowhere', true)]);

      expect(result.current.entries[0].speaker).toBe('agent');
      expect(result.current.entries[0].participantName).toBeUndefined();
    });

    it('prefers an explicitly supplied local identity over the room one', () => {
      const room = createRoom('stale-identity');
      const { result } = render(room, {
        localParticipantIdentity: 'real-local',
      });

      emit(room, [segment('s1', 'mine', true)], { identity: 'real-local' });
      emit(room, [segment('s2', 'theirs', true)], {
        identity: 'stale-identity',
      });

      expect(result.current.entries.map((e) => e.speaker)).toEqual([
        'user',
        'agent',
      ]);
    });

    it('keeps the known participant details when a later event omits them', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'part')], agentParticipant);
      emit(room, [segment('s1', 'part two', true)]);

      expect(result.current.entries[0]).toMatchObject({
        participantName: 'Agent Seven',
        participantIdentity: 'agent-7',
      });
    });

    it('does not label a remote speaker as local when identity is unknown', () => {
      const room = createRoom(undefined);
      const { result } = render(room);

      emit(room, [segment('s1', 'theirs', true)], { identity: 'agent-7' });

      expect(result.current.entries[0].speaker).toBe('agent');
    });
  });

  describe('isTranscribing', () => {
    it('is false before anything arrives', () => {
      const room = createRoom();
      const { result } = render(room);

      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.hasReceivedTranscription).toBe(false);
    });

    it('is true while the newest entry is still partial', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'Hel')], agentParticipant);

      expect(result.current.isTranscribing).toBe(true);
    });

    it('settles to false once the newest entry finalises', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(room, [segment('s1', 'Hel')], agentParticipant);
      emit(room, [segment('s1', 'Hello', true)], agentParticipant);

      expect(result.current.isTranscribing).toBe(false);
    });
  });

  describe('joinTranscriptionSegments', () => {
    it('joins disjoint fragments with a space', () => {
      expect(joinTranscriptionSegments(['Hello', 'there'])).toBe('Hello there');
    });

    it('collapses cumulative snapshots instead of duplicating them', () => {
      expect(joinTranscriptionSegments(['Hello', 'Hello there'])).toBe(
        'Hello there',
      );
    });

    it('ignores blank and whitespace-only segments', () => {
      expect(joinTranscriptionSegments(['', '  ', 'Hello', ' '])).toBe('Hello');
    });

    it('trims each fragment', () => {
      expect(joinTranscriptionSegments([' Hello ', ' there '])).toBe(
        'Hello there',
      );
    });

    it('returns an empty string for no segments', () => {
      expect(joinTranscriptionSegments([])).toBe('');
    });

    it('survives a null or undefined fragment', () => {
      expect(
        joinTranscriptionSegments([
          undefined as unknown as string,
          'Hello',
          null as unknown as string,
        ]),
      ).toBe('Hello');
    });

    it('is applied to multi-segment events', () => {
      const room = createRoom();
      const { result } = render(room);

      emit(
        room,
        [segment('s1', 'Hello'), segment('s2', 'Hello there', true)],
        agentParticipant,
      );

      // The last segment supplies the id, the fold supplies the text.
      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]).toMatchObject({
        id: 's2',
        text: 'Hello there',
      });
    });
  });
});
