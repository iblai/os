import { useTranslations } from 'next-intl';
import { useDatasetsWithPagination } from '@/hooks/use-datasets';

type ProjectActionButtonsProps = {
  onFilesClick: () => void;
  onInstructionsClick: () => void;
  instructions?: string;
};

export function ProjectActionButtons({
  onFilesClick,
  onInstructionsClick,
  instructions,
}: ProjectActionButtonsProps) {
  const t = useTranslations('projectsProjectActionButtons');
  const { datasets: projectFiles } = useDatasetsWithPagination();

  return (
    <div className="rounded-lg border border-gray-200 transition-shadow">
      <div className="grid h-full grid-cols-1 md:grid-cols-2">
        {/* Add Files Section */}
        <div
          className="flex h-full cursor-pointer flex-col justify-between p-6 transition-colors hover:bg-[#F0F1F0] focus:ring-2 focus:ring-gray-300 focus:outline-none focus:ring-inset"
          onClick={onFilesClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onFilesClick();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={
            projectFiles?.results && projectFiles?.results?.length > 0
              ? t('viewProjectFilesAriaLabel')
              : t('addFilesToProjectAriaLabel')
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-gray-900">
                {projectFiles?.results && projectFiles?.results?.length > 0
                  ? t('projectFiles')
                  : t('addFiles')}
              </h3>
              <p className="text-sm text-gray-600">
                {projectFiles?.results && projectFiles?.results?.length === 0
                  ? t('chatsCanAccessFiles')
                  : t('filesAdded', {
                      count: projectFiles?.results?.length ?? 0,
                    })}
              </p>
            </div>
            <div className="ml-4 flex items-center">
              {/* {renderFileIcons()} */}
            </div>
          </div>
        </div>

        {/* Add Instructions Section */}
        <div
          className="flex h-full cursor-pointer flex-col justify-between border-t border-gray-200 p-6 transition-colors hover:bg-[#F0F1F0] focus:ring-2 focus:ring-gray-300 focus:outline-none focus:ring-inset md:border-t-0 md:border-l"
          onClick={onInstructionsClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onInstructionsClick();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={
            instructions
              ? t('editInstructionsAriaLabel')
              : t('addInstructionsAriaLabel')
          }
        >
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-gray-900">
                {instructions
                  ? t('projectInstructions')
                  : t('addProjectInstructions')}
              </h3>
              <p className="line-clamp-2 text-sm text-gray-600">
                {instructions ? instructions : t('tailorResponses')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
