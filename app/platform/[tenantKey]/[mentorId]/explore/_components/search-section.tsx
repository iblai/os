import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Category {
  label: string;
  value: string;
}

interface SearchSectionProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeTab: string;
  onTabChange: (value: string) => void;
  categories: Category[];
}

export function SearchSection({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  categories,
}: SearchSectionProps) {
  return (
    <div className="sticky top-0 z-10 mx-auto mb-3 w-full max-w-[800px] space-y-2 overflow-hidden border-b bg-white pt-0 pb-2 sm:mb-4 sm:pb-3 md:mb-6">
      <div className="relative mb-2 w-full max-w-full">
        <label htmlFor="mentor-search" className="sr-only">
          Search agents
        </label>
        <Search
          className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-gray-500 sm:h-4 sm:w-4"
          aria-hidden="true"
        />
        <Input
          id="mentor-search"
          type="search"
          placeholder="Search agents"
          aria-label="Search agents"
          className="w-full py-4 pl-9 text-base shadow-[0_0_10px_rgba(0,0,0,0.05)] sm:h-10 sm:py-2 sm:pl-12"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div
        className="scrollbar-none mb-1 w-full overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        role="region"
        aria-label="Category filters"
      >
        <div
          className="inline-flex min-w-full"
          role="tablist"
          aria-label="Filter agents by category"
        >
          <div className="scrollbar-none flex w-full flex-nowrap justify-start gap-1 overflow-x-auto sm:gap-2">
            {categories.map((category) => (
              <button
                key={category.value}
                type="button"
                role="tab"
                aria-selected={activeTab === category.value}
                aria-controls={`tabpanel-${category.value}`}
                className={cn(
                  'flex-shrink-0 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus:ring-1 focus:ring-blue-200 focus:ring-offset-1 focus:outline-none',
                  activeTab === category.value
                    ? 'bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
                onClick={() => onTabChange(category.value)}
                aria-label={`Filter by ${category.label} category`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
