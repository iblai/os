import { AlertCircle } from 'lucide-react';

export function EmptyPrompts() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-[5px] bg-gray-100 p-3">
        <AlertCircle className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-700">
        No prompts available
      </h3>
      <p className="max-w-md text-sm text-gray-500">
        There are no prompts in this category yet. Click the &quot;Add
        Prompt&quot; button to create the first one.
      </p>
    </div>
  );
}
