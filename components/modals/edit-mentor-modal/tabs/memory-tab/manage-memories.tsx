'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { DateRange } from 'react-day-picker';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Plus, ChevronDown, Calendar, ChevronsUpDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  useGetFilteredMemoriesQuery,
  useGetMemoryCategoriesQuery,
  useDeleteMemoryMutation,
  useDeleteMemoryByCategoryMutation,
  useUpdateMemoryEntryMutation,
  useCreateMemoryMutation,
  useGetMemoryFiltersQuery,
  type Memory as ApiMemory,
  type MemoryEntry,
} from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { transformCategoryToApi, transformCategoryToDisplay } from './utils';
import { cn } from '@/lib/utils';
import IblPagination from '@/components/ibl-pagination';
import { useEffect } from 'react';

const EditMemoryModal = dynamic(
  () => import('./edit-memory-modal').then((module) => ({ default: module.EditMemoryModal })),
  { ssr: false },
);

const AddMemoryModal = dynamic(
  () => import('./add-memory-modal').then((module) => ({ default: module.AddMemoryModal })),
  { ssr: false },
);

const DeleteMemoryModal = dynamic(
  () => import('./delete-memory-modal').then((module) => ({ default: module.DeleteMemoryModal })),
  { ssr: false },
);

const BulkDeleteMemoryModal = dynamic(
  () =>
    import('./bulk-delete-memory-modal').then((module) => ({
      default: module.BulkDeleteMemoryModal,
    })),
  { ssr: false },
);

interface Memory {
  id: string;
  content: string;
  category: string;
  memoryId?: string;
  entryKey?: string;
  email?: string;
  username?: string;
  insertedAt?: string;
}

interface ManageMemoriesProps {
  tenantKey: string;
  username: string | null;
  mentorId: string;
}

export function ManageMemories({ tenantKey, username, mentorId }: ManageMemoriesProps) {
  const itemsPerPage = 10;

  // Filter state
  const [selectedLearner, setSelectedLearner] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // API hooks - use filtered query for all memories
  const {
    data: memoriesResponse,
    isLoading: isLoadingMemories,
    isFetching,
  } = useGetFilteredMemoriesQuery(
    {
      tenantKey,
      username: username ?? '',
      params: {
        page: currentPage,
        page_size: itemsPerPage,
        mentor: mentorId,
        ...(selectedLearner && { username: selectedLearner }),
        ...(dateRange?.from && { start_date: dateRange.from.toISOString() }),
        ...(dateRange?.to && { end_date: dateRange.to.toISOString() }),
      },
    },
    {
      skip: !tenantKey || !username || !mentorId,
    },
  );

  // Effect to reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLearner, dateRange]);

  const { data: categoriesResponse } = useGetMemoryCategoriesQuery(
    {
      tenantKey,
      username: username ?? '',
    },
    {
      skip: !tenantKey || !username,
    },
  );

  const { data: memoryFilters } = useGetMemoryFiltersQuery(
    {
      tenantKey,
      username: username ?? '',
    },
    {
      skip: !tenantKey || !username,
    },
  );

  const [deleteMemory, { isLoading: isDeleting }] = useDeleteMemoryMutation();
  const [deleteMemoryByCategory] = useDeleteMemoryByCategoryMutation();
  const [updateMemoryEntry, { isLoading: isEditing }] = useUpdateMemoryEntryMutation();
  const [createMemory, { isLoading: isSaving }] = useCreateMemoryMutation();

  const learners = memoryFilters?.users ?? [];

  // Pagination handler
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Calculate total pages based on count and limit
  const totalPages = memoriesResponse ? Math.ceil(memoriesResponse.count / itemsPerPage) : 0;

  // Transform API data to local format
  const memories = useMemo(() => {
    if (!memoriesResponse?.results) return [];

    return memoriesResponse.results.flatMap((memory: ApiMemory) =>
      memory.entries.map((entry: MemoryEntry) => ({
        id: entry.unique_id,
        content: entry.value,
        category: memory.category,
        memoryId: memory.unique_id,
        entryKey: entry.key,
        email: (memory as any).email || (memory as any).lti_email,
        username: (memory as any).username || (memory as any).lti_username,
        insertedAt: (memory as any).inserted_at || (memory as any).created_at,
      })),
    );
  }, [memoriesResponse]);

  const categories = useMemo(() => {
    const apiCategories = categoriesResponse?.categories ?? [];
    // Transform API categories to display format
    const displayCategories = apiCategories.map(transformCategoryToDisplay);
    const uniqueCategories = Array.from(['All', ...displayCategories]);
    const withoutAll = uniqueCategories.filter((item) => item !== 'All');
    return ['All', ...withoutAll];
  }, [categoriesResponse]);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('');
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const filteredMemories =
    selectedCategory === 'All'
      ? memories
      : memories.filter((memory: any) => {
          // Transform display category back to API format for filtering
          const apiCategory = transformCategoryToApi(selectedCategory);
          return memory.category === apiCategory;
        });

  const handleDeleteMemory = async (id: string) => {
    if (!tenantKey || !username) return;

    try {
      await deleteMemory({
        tenantKey,
        username,
        memoryId: id,
      }).unwrap();
      setShowDeleteConfirm(null);
      toast.success('Memory deleted successfully');
    } catch (error) {
      console.error('Failed to delete memory:', error);
      toast.error('Failed to delete memory');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const handleBulkDelete = async () => {
    if (!tenantKey || !username) return;

    setIsBulkDeleting(true);
    try {
      const apiCategory = transformCategoryToApi(selectedCategory);
      await deleteMemoryByCategory({
        tenantKey,
        username,
        category: apiCategory,
      }).unwrap();
      toast.success(`All ${selectedCategory} memories deleted successfully`);
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete memories:', error);
      toast.error('Failed to delete memories');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const startEdit = (memory: Memory) => {
    setEditingMemory(memory);
    setEditContent(memory.content);
    setEditCategory(transformCategoryToDisplay(memory.category));
  };

  const saveEdit = async () => {
    if (!editingMemory || !tenantKey || !username) return;

    try {
      await updateMemoryEntry({
        tenantKey,
        username,
        entryId: editingMemory.id,
        data: {
          key: editingMemory.entryKey,
          value: editContent,
        },
      }).unwrap();
      toast.success('Memory updated successfully');

      setEditingMemory(null);
      setEditContent('');
      setEditCategory('');
    } catch (error) {
      console.error('Failed to update memory:', error);
      toast.error('Failed to update memory');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const cancelEdit = () => {
    setEditingMemory(null);
    setEditContent('');
    setEditCategory('');
  };

  const startAddMemory = () => {
    setShowAddMemory(true);
    setNewMemoryCategory(selectedCategory);
  };

  const saveNewMemory = async () => {
    if (!newMemoryContent.trim() || !tenantKey || !username) return;

    try {
      const apiCategory = transformCategoryToApi(newMemoryCategory || selectedCategory);

      await createMemory({
        tenantKey,
        username,
        data: {
          name: `Memory ${Date.now()}`,
          platform: tenantKey,
          mentor_unique_id: mentorId,
          entries: [
            {
              key: 'memory',
              value: newMemoryContent.trim(),
            },
          ],
          category: apiCategory,
        },
      }).unwrap();

      setShowAddMemory(false);
      setNewMemoryContent('');
      setNewMemoryCategory('');
      setSelectedCategory(newMemoryCategory || selectedCategory);
      toast.success('Memory created successfully');
    } catch (error) {
      console.error('Failed to create memory:', error);
      toast.error('Failed to create memory');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const cancelAddMemory = () => {
    setShowAddMemory(false);
    setNewMemoryContent('');
    setNewMemoryCategory('');
  };

  return (
    <>
      <div className="space-y-6">
        {/* User Filter and Date Range */}
        <div className="border rounded-lg p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-label="Search for User"
                    className="w-full justify-between font-normal bg-transparent"
                  >
                    {selectedLearner
                      ? learners.find((learner) => learner.username === selectedLearner)?.email
                      : 'Search for User'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search users..." />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value=""
                          onSelect={() => {
                            setSelectedLearner('');
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              !selectedLearner ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          All Users
                        </CommandItem>
                        {learners.map((learner) => (
                          <CommandItem
                            key={learner.email}
                            value={learner.email}
                            onSelect={() => {
                              setSelectedLearner(learner.username);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedLearner === learner.username ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-700">{learner.email}</span>
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
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="hidden sm:flex space-x-8 overflow-x-auto flex-1 scrollbar-none">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`relative py-2 px-1 text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'text-[#38A1E5]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {category}
                  {selectedCategory === category && (
                    <div
                      className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5 bg-[#38A1E5] transition-all duration-200"
                      style={{ width: `${category.length * 0.55}em` }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="sm:hidden py-2 w-full">
              <DropdownMenu open={showMobileDropdown} onOpenChange={setShowMobileDropdown}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-transparent">
                    {selectedCategory}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowMobileDropdown(false);
                      }}
                      className={selectedCategory === category ? 'bg-gray-100' : ''}
                    >
                      {category}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button onClick={startAddMemory} size="sm" className="ibl-button-primary shrink-0">
              <Plus className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Memory</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        <div className="space-y-3 px-1 sm:px-0">
          {isLoadingMemories ? (
            <div className="text-center py-8 text-gray-600">
              <p>Loading memories...</p>
            </div>
          ) : (
            filteredMemories.map((memory: any) => {
              const timeAgo = memory.insertedAt
                ? formatDistanceToNow(new Date(memory.insertedAt), { addSuffix: true })
                : '';
              const displayEmail = memory.email || memory.username || 'Unknown';

              return (
                <div
                  key={memory.id}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    {(timeAgo || displayEmail) && (
                      <div className="flex items-center justify-between mb-2">
                        {timeAgo && <span className="text-sm text-gray-600">{timeAgo}</span>}
                        {displayEmail && (
                          <span className="text-sm text-gray-900 max-w-[100px] sm:max-w-[200px] truncate">
                            {displayEmail}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-sm text-gray-900 leading-relaxed">{memory.content}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-600 hover:text-gray-900 flex-shrink-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEdit(memory)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowDeleteConfirm(memory.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>

        {filteredMemories.length > 0 && selectedCategory.toLowerCase() !== 'all' && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(true)}>
              Delete All
            </Button>
          </div>
        )}

        {filteredMemories.length === 0 && !isLoadingMemories && (
          <div className="text-center py-8 text-gray-600">
            <p>No saved memories yet.</p>
          </div>
        )}

        {!isLoadingMemories && filteredMemories.length > 0 && totalPages > 1 && (
          <div className="flex justify-center pt-4">
            <IblPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              disabled={isFetching || isLoadingMemories}
            />
          </div>
        )}
      </div>

      <EditMemoryModal
        open={!!editingMemory}
        onOpenChange={(open: boolean) => !open && cancelEdit()}
        editContent={editContent}
        editCategory={editCategory}
        onContentChange={setEditContent}
        onCategoryChange={setEditCategory}
        onSave={saveEdit}
        onCancel={cancelEdit}
        categories={categories}
        isSaving={isEditing}
      />

      <AddMemoryModal
        open={showAddMemory}
        onOpenChange={(open: boolean) => !open && cancelAddMemory()}
        newMemoryContent={newMemoryContent}
        newMemoryCategory={newMemoryCategory}
        onContentChange={setNewMemoryContent}
        onCategoryChange={setNewMemoryCategory}
        onSave={saveNewMemory}
        onCancel={cancelAddMemory}
        categories={categories}
        isSaving={isSaving}
      />

      <DeleteMemoryModal
        open={!!showDeleteConfirm}
        onOpenChange={(open: boolean) => !open && setShowDeleteConfirm(null)}
        onConfirm={() => showDeleteConfirm && handleDeleteMemory(showDeleteConfirm)}
        onCancel={() => setShowDeleteConfirm(null)}
        isDeleting={isDeleting}
      />

      <BulkDeleteMemoryModal
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        isDeleting={isBulkDeleting}
        selectedCategory={selectedCategory}
      />
    </>
  );
}
