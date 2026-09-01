'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AddResourceModal } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/add-resource-modal';
import { PlusCircle } from 'lucide-react';

export function AddResourceButton() {
  const t = useTranslations('componentsAddResourceButton');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2"
        variant="outline"
      >
        <PlusCircle size={16} />
        <span>{t('addResource')}</span>
      </Button>

      <AddResourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
