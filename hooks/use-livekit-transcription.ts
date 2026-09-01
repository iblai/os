'use client';

import React from 'react';

import {
  RoomEvent,
  type Participant,
  type Room,
  type TranscriptionSegment,
} from 'livekit-client';

/**
 * Live transcription for a LiveKit room.
 *
 * The screen-sharing flow already consumes `RoomEvent.TranscriptionReceived`
 * (see `TranscriptionRelay` in `components/live-kit-screen-sharing.tsx`), but it
 * forwards each event over `postMessage` to a Picture-in-Picture window that
 * renders a single, self-clearing line. The voice call modal lives in the main
 * document and wants the opposite: an accumulated, ordered transcript for the
 * whole call.
 *
 * CONVERGENCE OPPORTUNITY: `TranscriptionRelay` could be reimplemented on top
 * of this hook (relaying `entries[entries.length - 1]` instead of hand-rolling
 * the same segment handling). That refactor is deliberately out of scope here
 * to keep the blast radius of the voice-call change small.
 */

const TRANSCRIPTION_DEBUG_PREFIX = '[VoiceChat:Transcription]';

// Matches the `voiceLog`/`voiceWarn` convention in
// `components/live-kit-voice-chat.tsx` so a single console filter shows the
// whole voice-call story.
function transcriptionLog(...args: unknown[]) {
  console.log(TRANSCRIPTION_DEBUG_PREFIX, ...args);
}

function transcriptionWarn(...args: unknown[]) {
  console.warn(TRANSCRIPTION_DEBUG_PREFIX, ...args);
}

/**
 * Who produced an utterance. Anything that is not the local participant is the
 * mentor agent — a voice call is always a two-party room.
 */
export type TranscriptSpeaker = 'user' | 'agent';

export type TranscriptEntry = {
  /** LiveKit segment id. Stable across the partial -> final updates. */
  id: string;
  text: string;
  speaker: TranscriptSpeaker;
  /** Display name LiveKit reported for the speaker, when it sent one. */
  participantName?: string;
  participantIdentity?: string;
  /** `false` while the utterance is still being spoken. */
  isFinal: boolean;
  /** When the entry first appeared. Kept stable so ordering never jumps. */
  timestamp: number;
};

export type UseLiveKitTranscriptionOptions = {
  room: Room | null | undefined;
  /**
   * Identity of the local participant. Optional: the room usually has not
   * finished connecting when the hook mounts, so the identity is re-read from
   * `room.localParticipant` on every event when this is not supplied.
   */
  localParticipantIdentity?: string;
  /**
   * Hard ceiling on retained entries. An hour-long call is thousands of
   * utterances, and every one of them is a live DOM node in the transcript
   * band; past this many the oldest are dropped.
   */
  maxEntries?: number;
};

export type UseLiveKitTranscriptionResult = {
  /** Oldest first. New ids append; known ids update in place. */
  entries: TranscriptEntry[];
  /** True while the newest entry is still a partial. */
  isTranscribing: boolean;
  /** True once at least one transcription event has been observed. */
  hasReceivedTranscription: boolean;
  /** Clears the accumulated transcript. */
  reset: () => void;
};

export const DEFAULT_MAX_TRANSCRIPT_ENTRIES = 500;

/**
 * Combines the segments carried by a single transcription event.
 *
 * KNOWN UNKNOWN: LiveKit does not guarantee whether the segments in one event
 * are disjoint fragments of an utterance ("Hello", "there") or successive
 * CUMULATIVE snapshots of it ("Hello", "Hello there"). The screen-sharing relay
 * assumes disjoint and does a naive `join(' ')`, which duplicates text under
 * the cumulative shape. We have not verified which shape our voice agent emits.
 *
 * The fold below is safe under both: a segment that starts with everything we
 * have so far supersedes it (cumulative), anything else is appended (disjoint).
 * The one accepted cost is that two identical fragments inside a single event
 * ("no", "no") collapse to one — vastly less damaging than echoing an entire
 * utterance twice, and it cannot happen at all under the disjoint shape unless
 * the speaker literally repeated a word within the same event window.
 */
export function joinTranscriptionSegments(texts: readonly string[]): string {
  return texts.reduce<string>((accumulated, raw) => {
    const text = (raw ?? '').trim();
    if (!text) return accumulated;
    if (!accumulated) return text;
    if (text.startsWith(accumulated)) return text;
    return `${accumulated} ${text}`;
  }, '');
}

export function useLiveKitTranscription({
  room,
  localParticipantIdentity,
  maxEntries = DEFAULT_MAX_TRANSCRIPT_ENTRIES,
}: UseLiveKitTranscriptionOptions): UseLiveKitTranscriptionResult {
  const [entries, setEntries] = React.useState<TranscriptEntry[]>([]);
  const [hasReceivedTranscription, setHasReceivedTranscription] =
    React.useState(false);

  // Read inside the handler so a late-arriving identity is still honoured
  // without re-subscribing (which would drop events during the swap).
  const localIdentityRef = React.useRef(localParticipantIdentity);
  localIdentityRef.current = localParticipantIdentity;
  const maxEntriesRef = React.useRef(maxEntries);
  maxEntriesRef.current = maxEntries;

  const reset = React.useCallback(() => {
    setEntries([]);
    setHasReceivedTranscription(false);
  }, []);

  React.useEffect(() => {
    if (!room) {
      transcriptionWarn('No room available; not subscribing');
      return;
    }

    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant,
    ) => {
      const list = segments ?? [];
      // Logged on every event on purpose: when a user reports "no captions" we
      // need to tell "the agent never emitted anything" apart from "the UI
      // dropped it". Absence of this line is itself the diagnosis.
      transcriptionLog('TranscriptionReceived', {
        segmentCount: list.length,
        participantIdentity: participant?.identity,
        participantName: participant?.name,
        isLocal: participant?.isLocal,
        finals: list.map((segment) => segment?.final),
      });

      setHasReceivedTranscription(true);

      if (list.length === 0) return;

      const text = joinTranscriptionSegments(list.map((s) => s?.text ?? ''));
      const lastSegment = list[list.length - 1];
      const id = lastSegment?.id;
      if (!id) {
        transcriptionWarn('Dropping transcription without a segment id', {
          text,
        });
        return;
      }

      // Speaker attribution. `pip-chat.tsx` checks the mentor name FIRST in its
      // fallback chain, so every non-local speaker is labelled with the mentor's
      // name regardless of who actually spoke. Here identity decides, and the
      // name is only ever a display detail.
      const resolvedLocalIdentity =
        localIdentityRef.current ?? room.localParticipant?.identity;
      const speaker: TranscriptSpeaker =
        participant?.isLocal === true ||
        (!!participant?.identity &&
          !!resolvedLocalIdentity &&
          participant.identity === resolvedLocalIdentity)
          ? 'user'
          : 'agent';

      const isFinal = lastSegment?.final ?? false;

      setEntries((previous) => {
        const index = previous.findIndex((entry) => entry.id === id);

        if (index === -1) {
          const appended = [
            ...previous,
            {
              id,
              text,
              speaker,
              participantName: participant?.name,
              participantIdentity: participant?.identity,
              isFinal,
              timestamp: Date.now(),
            },
          ];
          return appended.length > maxEntriesRef.current
            ? appended.slice(appended.length - maxEntriesRef.current)
            : appended;
        }

        // Known id: the utterance grew. Update in place — appending would
        // print every prefix of the sentence as its own line.
        const existing = previous[index];
        const next = previous.slice();
        next[index] = {
          ...existing,
          text,
          // `final` is sticky: a late partial for an already-finalised segment
          // must not reopen it and restart the in-progress affordance.
          isFinal: existing.isFinal || isFinal,
          participantName: participant?.name ?? existing.participantName,
          participantIdentity:
            participant?.identity ?? existing.participantIdentity,
        };
        return next;
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    transcriptionLog('Subscribed to RoomEvent.TranscriptionReceived', {
      roomState: room.state,
      localParticipant: room.localParticipant?.identity,
    });

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
      transcriptionLog('Unsubscribed from RoomEvent.TranscriptionReceived');
    };
  }, [room]);

  const isTranscribing =
    entries.length > 0 && !entries[entries.length - 1].isFinal;

  return { entries, isTranscribing, hasReceivedTranscription, reset };
}
