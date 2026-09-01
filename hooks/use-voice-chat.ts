'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import { toast } from 'sonner';
import { useAudioToTextMutation } from '@iblai/iblai-js/data-layer';

import { useUsername } from './use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useTimer } from '@/hooks/use-timer';

const MIN_RECORDING_MS = 500;
const TIMESLICE_MS = 250;

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

const EXTENSION_BY_TYPE: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

export function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return (
    CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ??
    ''
  );
}

export function extensionFor(mimeType: string) {
  return EXTENSION_BY_TYPE[mimeType.split(';')[0]] ?? 'webm';
}

export function micErrorMessage(error: unknown) {
  switch ((error as DOMException)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Enable it in your browser settings and try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found.';
    case 'NotReadableError':
      return 'Your microphone is in use by another app.';
    default:
      return 'Could not start recording, please try again.';
  }
}

type Props = {
  onTranscript: (text: string) => void;
};

export default function useVoiceChat({ onTranscript }: Props) {
  const { start, stop, time } = useTimer();
  const username = useUsername();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();

  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);

  const stream = React.useRef<MediaStream | null>(null);
  const mediaRecorder = React.useRef<MediaRecorder | null>(null);
  const busy = React.useRef(false);
  const cancelled = React.useRef(false);
  const startedAt = React.useRef(0);
  const mounted = React.useRef(true);

  const [audioToText] = useAudioToTextMutation();

  const onTranscriptRef = React.useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const releaseStream = React.useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    mediaRecorder.current = null;
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      if (mediaRecorder.current?.state === 'recording') {
        mediaRecorder.current.stop();
      }
      releaseStream();
    };
  }, [releaseStream]);

  const convertVoiceToText = async (chunks: BlobPart[], mimeType: string) => {
    const audioBlob = new Blob(chunks, { type: mimeType });

    if (audioBlob.size === 0) {
      toast.error('No audio was captured, please try again');
      return;
    }

    setProcessing(true);
    const file = new File([audioBlob], `recording.${extensionFor(mimeType)}`, {
      type: mimeType,
    });

    try {
      const response = await audioToText({
        org: tenantKey,
        // @ts-expect-error - formData expects specific type but File constructor creates compatible object
        formData: { file },
        userId: username ?? '',
      }).unwrap();

      if (!mounted.current || cancelled.current) return;

      const text = response.text?.trim();
      if (!text) {
        toast.error("We couldn't make out any speech, please try again");
        return;
      }
      onTranscriptRef.current(text);
    } catch (error) {
      console.error('[voice-chat] transcription failed', {
        tenant: tenantKey,
        mimeType,
        bytes: audioBlob.size,
        durationMs: Date.now() - startedAt.current,
        error,
      });
      if (mounted.current) {
        toast.error('Could not process your audio, please try again');
      }
    } finally {
      if (mounted.current) setProcessing(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
    setRecording(false);
    stop();
  };

  const startRecording = async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      toast.error('Voice input is not supported in this browser');
      return false;
    }

    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      toast.error(micErrorMessage(error));
      return false;
    }

    const mimeType = pickMimeType();
    const chunks: BlobPart[] = [];

    try {
      const recorder = new MediaRecorder(
        stream.current,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onerror = () => {
        cancelled.current = true;
        setRecording(false);
        stop();
        releaseStream();
        toast.error('Recording stopped unexpectedly, please try again');
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const duration = Date.now() - startedAt.current;
        releaseStream();
        if (cancelled.current) return;
        if (duration < MIN_RECORDING_MS) {
          toast.error('That recording was too short');
          return;
        }
        void convertVoiceToText(chunks, type);
      };

      cancelled.current = false;
      startedAt.current = Date.now();
      recorder.start(TIMESLICE_MS);
    } catch (error) {
      console.error('[voice-chat] could not start recording', error);
      toast.error('Voice input is not supported in this browser');
      releaseStream();
      return false;
    }

    return true;
  };

  const handleMicrophoneBtnClick = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (recording) {
        stopRecording();
        return;
      }
      if (!username) {
        toast.error('Still signing you in, please try again in a moment');
        return;
      }
      if (await startRecording()) {
        setRecording(true);
        start();
      }
    } finally {
      busy.current = false;
    }
  };

  return {
    handleMicrophoneBtnClick,
    recording,
    processing,
    time,
  };
}
