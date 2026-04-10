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
              ? 'View project files'
              : 'Add files to project'
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-gray-900">
                {projectFiles?.results && projectFiles?.results?.length > 0
                  ? 'Project files'
                  : 'Add files'}
              </h3>
              <p className="text-sm text-gray-600">
                {projectFiles?.results && projectFiles?.results?.length === 0
                  ? 'Chats in this project can access file content'
                  : `${projectFiles?.results?.length ?? 0} file${projectFiles?.results?.length === 1 ? '' : 's'} added`}
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
              ? 'Edit project instructions'
              : 'Add project instructions'
          }
        >
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-gray-900">
                {instructions
                  ? 'Project Instructions'
                  : 'Add project instructions'}
              </h3>
              <p className="line-clamp-2 text-sm text-gray-600">
                {instructions
                  ? instructions
                  : 'Tailor the way the mentor responds in this project'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
