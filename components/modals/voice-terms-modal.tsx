'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Mic, Shield, MessageSquare } from 'lucide-react';

interface VoiceTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}

export function VoiceTermsModal({ isOpen, onClose, onAgree }: VoiceTermsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#f5f5fa] p-6">
        <DialogTitle className="sr-only">Voice Terms and Conditions</DialogTitle>
        <DialogDescription className="sr-only">
          Review and accept the terms for using voice-powered mentorAI
        </DialogDescription>
        <div className="flex flex-col">
          <h2
            className="mb-8 bg-gradient-to-r from-[#2563EB] to-[#93C5FD] bg-clip-text text-2xl font-medium text-transparent"
            aria-hidden="true"
          >
            Creating a mentorAI powered with voice
          </h2>

          <div className="mb-8 space-y-6">
            {/* Rule 1 */}
            <div className="flex items-start gap-4">
              <div className="mt-1 text-blue-600">
                <Mic className="h-5 w-5" />
              </div>
              <p className="font-medium text-gray-800">
                Don&apos;t record third parties voice without their consent
              </p>
            </div>

            {/* Rule 2 */}
            <div className="flex items-start gap-4">
              <div className="mt-1 text-blue-600">
                <Shield className="h-5 w-5" />
              </div>
              <p className="font-medium text-gray-800">Don&apos;t use copyrighted voices</p>
            </div>

            {/* Rule 3 */}
            <div className="flex items-start gap-4">
              <div className="mt-1 text-blue-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="font-medium text-gray-800">
                Don&apos;t use voices in deepfakes, bullying, frauds, or scams
              </p>
            </div>
          </div>

          <button
            onClick={onAgree}
            className="w-full rounded-md bg-gradient-to-r from-[#2563EB] to-[#93C5FD] py-3 text-base font-medium text-white transition-all hover:opacity-90"
          >
            Agree & Continue
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
