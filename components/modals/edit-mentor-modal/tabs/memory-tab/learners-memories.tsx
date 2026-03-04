'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Check, ChevronRight, ChevronsUpDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/spinner';
import { useGetMemoryFiltersQuery, useGetFilteredMemoriesQuery } from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import { transformCategoryToDisplay } from './utils';

export function LearnersMemories() {
  const username = useUsername();
  const [open, setOpen] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null);
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();

  const { data: memoryFilters } = useGetMemoryFiltersQuery(
    {
      tenantKey,
      username: username ?? '',
    },
    {
      skip: !tenantKey || !username,
    },
  );

  const categories = (memoryFilters?.categories ?? []).filter((cat) => cat !== null);
  const learners = memoryFilters?.users ?? [];

  const { data: filteredMemoriesData, isLoading: isLoadingMemories } = useGetFilteredMemoriesQuery(
    {
      tenantKey,
      username: username ?? '',
      params: {
        ...(selectedCategory && selectedCategory !== 'all' && { category: selectedCategory }),
        ...(selectedLearner && { username: selectedLearner }),
        ...(dateRange?.from && { start_date: dateRange.from.toISOString() }),
        ...(dateRange?.to && { end_date: dateRange.to.toISOString() }),
      },
    },
    {
      skip: !tenantKey || !username,
    },
  );

  const memories = filteredMemoriesData?.results ?? [];

  return (
    <div className="space-y-4 pt-6 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-900">Learner Memories</h3>
        <Info className="h-4 w-4 text-gray-400" />
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex flex-wrap gap-3 flex-1">
            <div className="flex-1 min-w-[200px]">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal bg-transparent"
                  >
                    {selectedLearner
                      ? learners.find((learner) => learner.username === selectedLearner)?.username
                      : 'Select Learner'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search learner..." />
                    <CommandList>
                      <CommandEmpty>No learner found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setSelectedLearner('');
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedLearner === '' ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          All Learners
                        </CommandItem>
                        {learners.map((learner) => (
                          <CommandItem
                            key={learner.username}
                            value={`${learner.username} ${learner.email}`}
                            onSelect={() => {
                              setSelectedLearner(learner.username);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedLearner === learner.username ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{learner.username}</span>
                              <span className="text-xs text-gray-500">{learner.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 whitespace-nowrap font-normal bg-transparent w-full lg:w-auto"
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
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="hidden lg:block">
              <Select value={selectedCategory || 'all'} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {transformCategoryToDisplay(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 lg:hidden">
            <Select value={selectedCategory || 'all'} onValueChange={setSelectedCategory}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {transformCategoryToDisplay(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoadingMemories ? (
        <div className="border rounded-md p-8 md:p-20 flex items-center justify-center">
          <Spinner />
        </div>
      ) : memories.length === 0 ? (
        <div className="border rounded-md p-8 md:p-20 flex items-center justify-center text-gray-500">
          No Memories
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 col-span-full md:col-span-1">
            <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto scrollbar-hide">
              {memories.map((memory) => {
                const timeAgo = formatDistanceToNow(new Date(memory.updated_at), {
                  addSuffix: true,
                });
                const firstEntry = memory.entries[0];
                return (
                  <div
                    key={memory.unique_id}
                    className={cn(
                      'flex items-center justify-between p-4 border-b last:border-b-0 cursor-pointer',
                      selectedMemory === memory.unique_id ? 'bg-gray-100' : 'hover:bg-gray-50',
                    )}
                    onClick={() => setSelectedMemory(memory.unique_id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">{timeAgo}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                          {transformCategoryToDisplay(memory.category)}
                        </span>
                      </div>
                      <div className="font-medium text-gray-900 mb-1">{memory.username}</div>
                      <div className="text-xs text-gray-500 mb-2">{memory.email}</div>
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {firstEntry ? `${firstEntry.key}: ${firstEntry.value}` : 'No entries'}
                      </p>
                      <span className="text-xs text-gray-400 mt-1 inline-block">
                        {memory.entries.length} {memory.entries.length === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 ml-4">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hidden md:flex border rounded-lg p-6 bg-white shadow-sm flex-col max-h-[400px] overflow-y-auto scrollbar-hide">
            {selectedMemory !== null ? (
              <>
                {(() => {
                  const memory = memories.find((m) => m.unique_id === selectedMemory);
                  return memory ? (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
                            {transformCategoryToDisplay(memory.category)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(memory.updated_at), "MMM dd, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">
                          {memory.username}
                        </h3>
                        <span className="text-sm text-gray-600">{memory.email}</span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">
                            Memory Entries
                          </h4>
                          <div className="space-y-3">
                            {memory.entries.map((entry) => (
                              <div
                                key={entry.unique_id}
                                className="border-l-2 border-blue-200 pl-3"
                              >
                                <div className="text-xs font-medium text-gray-700 mb-1">
                                  {entry.key}
                                </div>
                                <div className="text-sm text-gray-600">{entry.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null;
                })()}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a memory to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
