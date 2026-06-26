'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mic, Shield, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface VoiceTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}

export function VoiceTermsModal({
  isOpen,
  onClose,
  onAgree,
}: VoiceTermsModalProps) {
  const t = useTranslations('modalsVoiceTermsModal');
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#f5f5fa] p-6">
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('description')}
        </DialogDescription>
        <div className="flex flex-col">
          <h2
            className="mb-8 bg-gradient-to-r from-[#2563EB] to-[#93C5FD] bg-clip-text text-2xl font-medium text-transparent"
            aria-hidden="true"
          >
            {t('heading')}
          </h2>

          <div className="mb-8 space-y-6">
            {/* Rule 1 */}
            <div className="flex items-start gap-4">
              <div className="mt-1 text-blue-600">
                <Mic className="h-5 w-5" />
              </div>
              <p className="font-medium text-gray-800">
                {t('ruleNoRecordingWithoutConsent')}
              </p>
            </div>

            {/* Rule 2 */}
            <div className="flex items-start gap-4">
              <div className="mt-1 text-blue-600">
                <Shield className="h-5 w-5" />
              </div>
              <p className="font-medium text-gray-800">
                {t('ruleNoCopyrightedVoices')}
              </p>
            </div>

            {/* Rule 3 */}
            <div className="flex items-start gap-4">
              <div className="mt-1 text-blue-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="font-medium text-gray-800">
                {t('ruleNoMaliciousUse')}
              </p>
            </div>
          </div>

          <button
            onClick={onAgree}
            className="w-full rounded-md bg-gradient-to-r from-[#2563EB] to-[#93C5FD] py-3 text-base font-medium text-white transition-all hover:opacity-90"
          >
            {t('agreeAndContinue')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
