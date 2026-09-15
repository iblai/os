'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { sanitizeFilename } from '@/components/canvas/canvas-utils';
import { downloadBlob } from '@/components/canvas/canvas-export-handlers';
import type { Message } from '@iblai/iblai-js/web-utils';

import { buildMessageTranscript, buildTranscript } from './chat-transcript';

type Props = {
  message: Message;
  messages: Message[];
  mentorName: string;
};

/** Which slice of the conversation the user chose to download. */
type Scope = 'chat' | 'message';

const download = (text: string, filename: string) => {
  downloadBlob(
    new Blob([text], { type: 'text/plain;charset=utf-8' }),
    filename,
  );
};

export function AIMessageDownload({ message, messages, mentorName }: Props) {
  const t = useTranslations('chatAiMessageDownload');
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('chat');

  const labels = {
    header: t('transcriptHeader', { mentorName }),
    roleUser: t('roleUser'),
    roleAi: mentorName || t('roleAi'),
  };

  const filename = (prefix: string) =>
    `${sanitizeFilename(`${prefix}-${mentorName}-${new Date().toISOString().slice(0, 10)}`)}.txt`;

  const handleDownload = () => {
    const text =
      scope === 'chat'
        ? buildTranscript(messages, labels)
        : buildMessageTranscript(message, labels);
    download(text, filename(scope));
    setIsOpen(false);
  };

  // Always reopen on the default choice rather than the last one used.
  const handleOpenChange = (open: boolean) => {
    if (open) setScope('chat');
    setIsOpen(open);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => handleOpenChange(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="sr-only">{t('downloadThisChat')}</span>
            <Download className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="ibl-tooltip-content">
          {t('download')}
        </TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="ibl-dialog-title">
              {t('dialogTitle')}
            </DialogTitle>
            {/* Kept for screen readers — Radix warns when a dialog has no
                description, and the radio labels carry the visible guidance. */}
            <DialogDescription className="sr-only">
              {t('dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={scope}
            onValueChange={(value) => setScope(value as Scope)}
            className="gap-5 py-2"
          >
            {(
              [
                ['chat', 'entireChat', 'entireChatDescription'],
                ['message', 'thisMessage', 'thisMessageDescription'],
              ] as const
            ).map(([value, labelKey, descriptionKey]) => (
              <div key={value} className="flex items-start space-x-3">
                <RadioGroupItem
                  value={value}
                  id={`download-scope-${value}`}
                  // Explicit utilities, not `.ibl-outline-primary`: tailwind-merge
                  // can only drop the item's built-in `border-primary`/`text-primary`
                  // when the override is a real utility class.
                  className="mt-0.5 border-[#2563EB] text-[#2563EB]"
                />
                <div className="grid gap-1">
                  <Label
                    htmlFor={`download-scope-${value}`}
                    className="cursor-pointer font-medium"
                  >
                    {t(labelKey)}
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    {t(descriptionKey)}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>

          <DialogFooter className="mt-2">
            <Button onClick={handleDownload} className="ibl-button-primary">
              {t('downloadButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
