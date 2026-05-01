import { Mentor } from '@/features/mentors/types';
import { useNavigate } from '@/hooks/user-navigate';
import { formatDateString } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// import { useMentorStore } from '../../../../../../mentor-mobile/store/mentor-store';

interface MentorCardProps {
  mentor: Mentor;
}

export function MentorCard({ mentor }: MentorCardProps) {
  const { navigateToMentor } = useNavigate();
  // const selectMentor = typeof window !== 'undefined' && window.location.pathname.includes('/mentor-mobile')
  //   ? useMentorStore((state) => state.selectMentor)
  //   : undefined;
  const selectMentor = undefined;

  const handleClick = () => {
    if (selectMentor) {
      // selectMentor(mentor);
    }
    navigateToMentor(mentor.unique_id);
  };

  return (
    <button
      className="flex h-full w-full cursor-pointer items-center gap-4 overflow-hidden rounded-lg border border-gray-200 bg-white p-2 py-4 text-left transition-colors hover:border-blue-500 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:ring-offset-1 focus:outline-none sm:gap-3 sm:p-3 md:p-4"
      onClick={handleClick}
      aria-label={`Open agent ${mentor.name}. ${mentor.description}`}
    >
      <Avatar className="h-8 w-8 flex-shrink-0 rounded-full sm:h-10 sm:w-10 md:h-12 md:w-12">
        <AvatarImage
          src={mentor.profile_image}
          alt={mentor.name}
          className="object-cover"
        />
        <AvatarFallback>
          {mentor.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 overflow-hidden">
        <h3 className="mb-0.5 truncate text-sm font-medium text-gray-900 sm:mb-1 sm:text-sm md:text-base">
          {mentor.name}
        </h3>
        <p className="mb-0.5 line-clamp-2 text-sm break-words text-gray-600 sm:mb-1 md:text-sm">
          {mentor.description}
        </p>
        {mentor.recently_accessed_at && (
          <p className="hidden truncate text-xs text-gray-500 sm:block">
            Recently accessed on {formatDateString(mentor.recently_accessed_at)}
          </p>
        )}
      </div>
    </button>
  );
}
