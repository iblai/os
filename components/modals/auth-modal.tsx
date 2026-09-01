'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { redirectToAuthSpaJoinTenant } from '@/lib/utils';
import Logo from '../logo';
import { useTranslations } from 'next-intl';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tenantKey: string;
};

export function AuthModal({ isOpen, onClose, tenantKey }: Props) {
  const t = useTranslations('modalsAuthModal');
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('welcomeTitle')}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          {t('loginDescription')}
        </DialogDescription>
        <div className="mt-4 text-center text-sm text-gray-500">
          {t('createAccountPrompt')}
        </div>
        <div className="flex justify-center">
          <Logo tenantKey={tenantKey} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => redirectToAuthSpaJoinTenant(tenantKey)}
            className="ibl-button-primary cursor-pointer"
          >
            {t('loginButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
