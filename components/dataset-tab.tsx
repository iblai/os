'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { AddResourceModal } from './modals/edit-mentor-modal/tabs/datasets-tab/add-resource-modal';

export function DatasetTab() {
  const t = useTranslations('componentsDatasetTab');
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{t('dataset')}</h2>

        {/* Add Resource Button */}
        <Button
          variant="outline"
          onClick={() => {
            setIsAddResourceModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <PlusCircle size={16} />
          <span>{t('addResource')}</span>
        </Button>
      </div>

      {/* Your dataset content here */}
      <div className="rounded-lg bg-gray-50 p-4">
        <p className="text-center text-gray-500">{t('noResourcesAddedYet')}</p>
      </div>

      {/* Add Resource Modal */}
      <AddResourceModal
        isOpen={isAddResourceModalOpen}
        onClose={() => setIsAddResourceModalOpen(false)}
        keepParentOpen={true}
      />
    </div>
  );
}
