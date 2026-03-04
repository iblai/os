export function EmptyState({ message = 'Sorry, no mentors found!' }: { message?: string }) {
  return (
    <div className="flex h-60 w-full items-center justify-center">
      <div className="mx-auto w-full max-w-[90%] rounded-lg bg-[#F8F8FB] p-3 text-center sm:max-w-lg sm:p-4 md:p-6">
        <p className="text-xs text-gray-600 sm:text-sm md:text-base">{message}</p>
      </div>
    </div>
  );
}
