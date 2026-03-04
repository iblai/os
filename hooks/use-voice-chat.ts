'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import { toast } from 'sonner';
import { useAudioToTextMutation } from '@iblai/iblai-js/data-layer';

import { useUsername } from './use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useTimer } from '@/hooks/use-timer';

type Props = {
  sendMessage: (message: string) => void;
};

export default function useVoiceChat({ sendMessage }: Props) {
  const { start, stop, time } = useTimer();
  const username = useUsername();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();

  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [, setAudioChunks] = React.useState<BlobPart[]>([]);

  const stream = React.useRef<MediaStream | null>(null);
  const mediaRecorder = React.useRef<MediaRecorder | null>(null);

  const [audioToText] = useAudioToTextMutation();

  const convertVoiceToText = async (chunks: BlobPart[]) => {
    setProcessing(true);

    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
    const file = new File([audioBlob], 'recording.webm', {
      type: 'audio/webm',
    });

    try {
      const response = await audioToText({
        org: tenantKey,
        // @ts-expect-error - formData expects specific type but File constructor creates compatible object
        formData: { file },
        userId: username ?? '',
      }).unwrap();
      sendMessage(response.text);
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Could not process your audio, please try again');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    } finally {
      setProcessing(false);
      stream.current?.getTracks().forEach((track) => track.stop());
    }
  };

  const startRecording = async () => {
    setAudioChunks([]);
    stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream.current);

    const chunks: BlobPart[] = [];

    mediaRecorder.current.ondataavailable = (event) => {
      chunks.push(event.data);
      setAudioChunks((prev) => [...prev, event.data]);
    };

    mediaRecorder.current.onstop = () => convertVoiceToText(chunks);
    mediaRecorder.current.start();
  };

  const handleMicrophoneBtnClick = async () => {
    if (recording) {
      mediaRecorder.current?.stop();
      setRecording(false);
      stop();
    } else {
      await startRecording();
      setRecording(true);
      start();
    }
  };

  return { handleMicrophoneBtnClick, recording, processing, time };
}
