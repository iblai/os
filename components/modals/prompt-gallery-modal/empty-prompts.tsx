import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function EmptyPrompts() {
  const t = useTranslations('modalsPromptGalleryModalEmptyPrompts');
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-[5px] bg-gray-100 p-3">
        <AlertCircle className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-700">
        {t('noPromptsAvailable')}
      </h3>
      <p className="max-w-md text-sm text-gray-500">{t('noPromptsHelpText')}</p>
    </div>
  );
}
