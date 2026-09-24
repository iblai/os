import { SearchX } from 'lucide-react';

export function EmptyState({
  message = 'Sorry, no agents found!',
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-14 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
        <SearchX className="h-5 w-5 text-gray-400" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-gray-900 md:text-base">
        {message}
      </p>
      {hint && <p className="mt-1 text-sm text-gray-600">{hint}</p>}
    </div>
  );
}
