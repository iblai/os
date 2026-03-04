import { Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface FlaggedPromptsFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterType: string;
  onFilterTypeChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
}

export function FlaggedPromptsFilters({
  searchQuery,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  dateRange,
  onDateRangeChange,
}: FlaggedPromptsFiltersProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Row 1: Search + Date (Mobile/Tablet) | All filters (Desktop) */}
        <div className="flex flex-wrap gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search for User"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-full"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2 whitespace-nowrap font-normal bg-transparent"
              >
                <Calendar className="h-4 w-4" />
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}`
                  : 'Pick a Date Range'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={onDateRangeChange}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Desktop only - show selects in same row */}
          <div className="hidden lg:flex gap-3">
            <Select value={filterType} onValueChange={onFilterTypeChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="moderation">Moderation</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
              </SelectContent>
            </Select>

            {/* <Select>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select> */}
          </div>
        </div>

        {/* Row 2: Type + Status (Mobile/Tablet only) */}
        <div className="flex gap-3 lg:hidden">
          <Select value={filterType} onValueChange={onFilterTypeChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="moderation">Moderation</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
            </SelectContent>
          </Select>

          {/* <Select>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select> */}
        </div>

        {/* Export button - separate row on tablet/mobile, same row on desktop */}
        {/* <div className="w-full lg:w-auto">
          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 w-full lg:w-auto bg-transparent"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div> */}
      </div>
    </div>
  );
}
