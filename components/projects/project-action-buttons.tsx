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
    <div className="border border-gray-200 rounded-lg transition-shadow">
      <div className="grid grid-cols-1 md:grid-cols-2 h-full">
        {/* Add Files Section */}
        <div
          className="p-6 h-full flex flex-col justify-between cursor-pointer hover:bg-[#F0F1F0] transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-inset"
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
              <h3 className="font-semibold text-gray-900 mb-1">
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
            <div className="ml-4 flex items-center">{/* {renderFileIcons()} */}</div>
          </div>
        </div>

        {/* Add Instructions Section */}
        <div
          className="p-6 h-full flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-200 cursor-pointer hover:bg-[#F0F1F0] transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-inset"
          onClick={onInstructionsClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onInstructionsClick();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={instructions ? 'Edit project instructions' : 'Add project instructions'}
        >
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {instructions ? 'Project Instructions' : 'Add project instructions'}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {instructions ? instructions : 'Tailor the way the mentor responds in this project'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
