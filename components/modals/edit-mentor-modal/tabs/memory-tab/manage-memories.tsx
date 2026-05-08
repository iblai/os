'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { DateRange } from 'react-day-picker';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  Plus,
  ChevronDown,
  Calendar,
  ChevronsUpDown,
  Check,
  Tags,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
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
  useGetMentorMemoriesListQuery,
  useDeleteMentorMemoryMutation,
  useUpdateMentorMemoryMutation,
  useCreateMentorMemoryMutation,
  useGetMemoryCategoriesAdminQuery,
  type MentorMemory,
  type MentorMemoryCategory,
} from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import IblPagination from '@/components/ibl-pagination';

const EditMemoryModal = dynamic(
  () =>
    import('./edit-memory-modal').then((module) => ({
      default: module.EditMemoryModal,
    })),
  { ssr: false },
);

const AddMemoryModal = dynamic(
  () =>
    import('./add-memory-modal').then((module) => ({
      default: module.AddMemoryModal,
    })),
  { ssr: false },
);

const DeleteMemoryModal = dynamic(
  () =>
    import('./delete-memory-modal').then((module) => ({
      default: module.DeleteMemoryModal,
    })),
  { ssr: false },
);

const BulkDeleteMemoryModal = dynamic(
  () =>
    import('./bulk-delete-memory-modal').then((module) => ({
      default: module.BulkDeleteMemoryModal,
    })),
  { ssr: false },
);

const ManageCategoriesModal = dynamic(
  () =>
    import('./manage-categories-modal').then((module) => ({
      default: module.ManageCategoriesModal,
    })),
  { ssr: false },
);

interface Memory {
  id: number;
  content: string;
  category: {
    id: number;
    name: string;
    slug: string;
  };
  email?: string;
  createdAt?: string;
}

interface ManageMemoriesProps {
  tenantKey: string;
  username: string | null;
  mentorId: string;
}

const PAGE_SIZE = 20;
const SNAPSHOT_PAGE_SIZE = 1000;

export function ManageMemories({
  tenantKey,
  username,
  mentorId,
}: ManageMemoriesProps) {
  const [selectedLearner, setSelectedLearner] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('all');
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever any filter changes — otherwise we could land on a
  // page index that no longer exists in the new result set.
  useEffect(() => {
    setPage(1);
  }, [selectedLearner, dateRange, selectedCategorySlug]);

  const listParams = useMemo(() => {
    const params: {
      page: number;
      page_size: number;
      category?: string;
      email?: string;
      start_date?: string;
      end_date?: string;
    } = { page, page_size: PAGE_SIZE };
    if (selectedLearner) params.email = selectedLearner;
    if (selectedCategorySlug !== 'all') params.category = selectedCategorySlug;
    if (dateRange?.from)
      params.start_date = format(dateRange.from, 'yyyy-MM-dd');
    if (dateRange?.to) params.end_date = format(dateRange.to, 'yyyy-MM-dd');
    return params;
  }, [page, selectedLearner, selectedCategorySlug, dateRange]);

  const { data: listResponse, isLoading: isLoadingMemories } =
    useGetMentorMemoriesListQuery(
      {
        org: tenantKey,
        userId: username ?? '',
        mentorId,
        params: listParams,
      },
      {
        skip: !tenantKey || !username || !mentorId,
      },
    );

  const totalPages = Math.max(
    1,
    Math.ceil((listResponse?.count ?? 0) / PAGE_SIZE),
  );

  const { data: adminCategories } = useGetMemoryCategoriesAdminQuery(
    {
      org: tenantKey,
      mentorId,
    },
    {
      skip: !tenantKey || !mentorId,
    },
  );

  const [deleteMentorMemory, { isLoading: isDeleting }] =
    useDeleteMentorMemoryMutation();
  const [updateMentorMemory, { isLoading: isEditing }] =
    useUpdateMentorMemoryMutation();
  const [createMentorMemory, { isLoading: isSaving }] =
    useCreateMentorMemoryMutation();

  // Flat list of memories on the current page, mapped into the local `Memory`
  // shape used by the rest of this component.
  const memories: Memory[] = useMemo(() => {
    if (!listResponse?.results) return [];
    return listResponse.results.map((memory: MentorMemory) => ({
      id: memory.id,
      content: memory.content,
      category: {
        id: memory.category.id,
        name: memory.category.name,
        slug: memory.category.slug,
      },
      email: memory.email,
      createdAt: memory.created_at,
    }));
  }, [listResponse]);

  // Unfiltered snapshot used to derive the learner dropdown and to source the
  // bulk-delete operation, which needs the full set of memories — not just the
  // current page.
  const { data: snapshotResponse } = useGetMentorMemoriesListQuery(
    {
      org: tenantKey,
      userId: username ?? '',
      mentorId,
      params: { page: 1, page_size: SNAPSHOT_PAGE_SIZE },
    },
    {
      skip: !tenantKey || !username || !mentorId,
    },
  );

  const learners = useMemo(() => {
    if (!snapshotResponse?.results) return [];
    const emailSet = new Set<string>();
    snapshotResponse.results.forEach((m: MentorMemory) => {
      if (m.email) emailSet.add(m.email);
    });
    return Array.from(emailSet).map((email) => ({ email }));
  }, [snapshotResponse]);

  const categories = useMemo(() => {
    if (adminCategories && adminCategories.length > 0) {
      return [
        { id: 0, name: 'All', slug: 'all' },
        ...adminCategories.map((cat: MentorMemoryCategory) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
        })),
      ];
    }
    return [{ id: 0, name: 'All', slug: 'all' }];
  }, [adminCategories]);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(
    null,
  );
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('');
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);

  const selectedCategoryName =
    categories.find((c) => c.slug === selectedCategorySlug)?.name ?? 'All';

  const VISIBLE_CATEGORY_LIMIT = 6;
  const visibleCategories = categories.slice(0, VISIBLE_CATEGORY_LIMIT);
  const overflowCategories = categories.slice(VISIBLE_CATEGORY_LIMIT);
  const overflowSelected = overflowCategories.find(
    (c) => c.slug === selectedCategorySlug,
  );

  // Category is filtered server-side via the `category` query param now, so
  // `memories` already contains only the relevant entries for the page.
  const filteredMemories = memories;

  const handleDeleteMemory = async (id: number) => {
    if (!tenantKey || !username) return;

    try {
      await deleteMentorMemory({
        org: tenantKey,
        userId: username,
        mentorId,
        memoryId: id,
      }).unwrap();
      setShowDeleteConfirm(null);
      toast.success('Memory deleted successfully');
    } catch (error) {
      console.error('Failed to delete memory:', error);
      toast.error('Failed to delete memory');
    }
  };

  const handleBulkDelete = async () => {
    if (!tenantKey || !username) return;

    setIsBulkDeleting(true);
    try {
      // Source bulk-delete from the unfiltered snapshot — `memories` only holds
      // the current page, while bulk delete must remove every entry in the
      // selected category.
      const memoriesToDelete = (snapshotResponse?.results ?? []).filter(
        (memory) => memory.category.slug === selectedCategorySlug,
      );
      await Promise.all(
        memoriesToDelete.map((memory) =>
          deleteMentorMemory({
            org: tenantKey,
            userId: username!,
            mentorId,
            memoryId: memory.id,
          }).unwrap(),
        ),
      );
      toast.success(
        `All ${selectedCategoryName} memories deleted successfully`,
      );
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete memories:', error);
      toast.error('Failed to delete memories');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const startEdit = (memory: Memory) => {
    setEditingMemory(memory);
    setEditContent(memory.content);
    setEditCategory(memory.category.name);
  };

  const saveEdit = async () => {
    if (!editingMemory || !tenantKey || !username) return;

    try {
      const selectedCat = categories.find((c) => c.name === editCategory);
      const categoryChanged =
        !!selectedCat && selectedCat.slug !== editingMemory.category.slug;
      await updateMentorMemory({
        org: tenantKey,
        userId: username,
        mentorId,
        memoryId: editingMemory.id,
        data: {
          content: editContent,
          ...(categoryChanged ? { category_slug: selectedCat.slug } : {}),
        },
      }).unwrap();
      toast.success('Memory updated successfully');

      // Follow the entry to its new category tab so the user doesn't lose
      // sight of it. Skip when viewing "All" — the entry is still visible.
      if (categoryChanged && selectedCategorySlug !== 'all') {
        setSelectedCategorySlug(selectedCat.slug);
      }

      setEditingMemory(null);
      setEditContent('');
      setEditCategory('');
    } catch (error) {
      console.error('Failed to update memory:', error);
      toast.error('Failed to update memory');
    }
  };

  const cancelEdit = () => {
    setEditingMemory(null);
    setEditContent('');
    setEditCategory('');
  };

  const startAddMemory = () => {
    setShowAddMemory(true);
    setNewMemoryCategory(selectedCategoryName);
  };

  const saveNewMemory = async () => {
    if (!newMemoryContent.trim() || !tenantKey || !username) return;

    try {
      const selectedCat = categories.find((c) => c.name === newMemoryCategory);
      const categorySlug = selectedCat?.slug ?? selectedCategorySlug;

      await createMentorMemory({
        org: tenantKey,
        userId: username,
        mentorId,
        data: {
          category_slug: categorySlug === 'all' ? 'general' : categorySlug,
          content: newMemoryContent.trim(),
        },
      }).unwrap();

      setShowAddMemory(false);
      setNewMemoryContent('');
      setNewMemoryCategory('');
      if (selectedCat) {
        setSelectedCategorySlug(selectedCat.slug);
      }
      toast.success('Memory created successfully');
    } catch (error) {
      console.error('Failed to create memory:', error);
      toast.error('Failed to create memory');
    }
  };

  const cancelAddMemory = () => {
    setShowAddMemory(false);
    setNewMemoryContent('');
    setNewMemoryCategory('');
  };

  const categoryNames = categories.map((c) => c.name);

  return (
    <>
      <div className="space-y-6">
        {/* User Filter and Date Range */}
        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-[200px] flex-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-label="Search for User"
                    className="w-full justify-between bg-transparent font-normal"
                  >
                    {selectedLearner
                      ? (learners.find(
                          (learner) => learner.email === selectedLearner,
                        )?.email ?? selectedLearner)
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
                              setSelectedLearner(learner.email);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedLearner === learner.email
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-700">
                                {learner.email}
                              </span>
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
                  className="flex w-full items-center gap-2 bg-transparent font-normal whitespace-nowrap lg:w-auto"
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
            <div
              role="tablist"
              aria-label="Memory categories"
              className="scrollbar-none hidden flex-1 items-center space-x-8 overflow-x-auto sm:flex"
            >
              {visibleCategories.map((category) => (
                <button
                  key={category.slug}
                  role="tab"
                  aria-selected={selectedCategorySlug === category.slug}
                  onClick={() => setSelectedCategorySlug(category.slug)}
                  className={`relative px-1 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategorySlug === category.slug
                      ? 'text-[#38A1E5]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {category.name}
                  {selectedCategorySlug === category.slug && (
                    <div
                      className="absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 transform bg-[#38A1E5] transition-all duration-200"
                      style={{ width: `${category.name.length * 0.55}em` }}
                    />
                  )}
                </button>
              ))}
              {overflowCategories.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        'relative flex items-center gap-1 px-1 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                        overflowSelected
                          ? 'text-[#38A1E5]'
                          : 'text-gray-600 hover:text-gray-900',
                      )}
                      aria-label="More categories"
                    >
                      {overflowSelected ? overflowSelected.name : 'More'}
                      <ChevronDown className="h-3.5 w-3.5" />
                      {overflowSelected && (
                        <div
                          className="absolute bottom-0 left-0 h-0.5 bg-[#38A1E5] transition-all duration-200"
                          style={{
                            width: `${overflowSelected.name.length * 0.55}em`,
                          }}
                        />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {overflowCategories.map((category) => (
                      <DropdownMenuItem
                        key={category.slug}
                        onClick={() => setSelectedCategorySlug(category.slug)}
                        className={
                          selectedCategorySlug === category.slug
                            ? 'bg-gray-100'
                            : ''
                        }
                      >
                        {category.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="w-full py-2 sm:hidden">
              <DropdownMenu
                open={showMobileDropdown}
                onOpenChange={setShowMobileDropdown}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-transparent"
                  >
                    {selectedCategoryName}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category.slug}
                      onClick={() => {
                        setSelectedCategorySlug(category.slug);
                        setShowMobileDropdown(false);
                      }}
                      className={
                        selectedCategorySlug === category.slug
                          ? 'bg-gray-100'
                          : ''
                      }
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              onClick={() => setShowManageCategories(true)}
              size="sm"
              variant="outline"
              className="shrink-0"
              aria-label="Manage categories"
            >
              <Tags className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Categories</span>
            </Button>

            <Button
              onClick={startAddMemory}
              size="sm"
              className="ibl-button-primary shrink-0"
            >
              <Plus className="mr-1 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Memory</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        <div
          role="list"
          aria-label="Saved memories"
          className="space-y-3 px-1 sm:px-0"
        >
          {isLoadingMemories ? (
            <div className="py-8 text-center text-gray-600">
              <p>Loading memories...</p>
            </div>
          ) : (
            filteredMemories.map((memory) => {
              const timeAgo = memory.createdAt
                ? formatDistanceToNow(new Date(memory.createdAt), {
                    addSuffix: true,
                  })
                : '';
              const displayUser = memory.email || 'Unknown';

              return (
                <div
                  key={memory.id}
                  role="listitem"
                  className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="flex-1">
                    {(timeAgo || displayUser) && (
                      <div className="mb-2 flex items-center justify-between">
                        {timeAgo && (
                          <span className="text-sm text-gray-600">
                            {timeAgo}
                          </span>
                        )}
                        {displayUser && (
                          <span className="max-w-[100px] truncate text-sm text-gray-900 sm:max-w-[200px]">
                            {displayUser}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-gray-900">
                      {memory.content}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Memory actions"
                        className="h-6 w-6 flex-shrink-0 p-0 text-gray-600 hover:text-gray-900"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEdit(memory)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowDeleteConfirm(memory.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>

        {filteredMemories.length > 0 && selectedCategorySlug !== 'all' && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteConfirm(true)}
            >
              Delete All
            </Button>
          </div>
        )}

        {filteredMemories.length === 0 && !isLoadingMemories && (
          <div className="py-8 text-center text-gray-600">
            <p>No saved memories yet.</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center pt-2">
            <IblPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              disabled={isLoadingMemories}
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
        categories={categoryNames}
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
        categories={categoryNames}
        isSaving={isSaving}
      />

      <DeleteMemoryModal
        open={!!showDeleteConfirm}
        onOpenChange={(open: boolean) => !open && setShowDeleteConfirm(null)}
        onConfirm={() =>
          showDeleteConfirm !== null && handleDeleteMemory(showDeleteConfirm)
        }
        onCancel={() => setShowDeleteConfirm(null)}
        isDeleting={isDeleting}
      />

      <ManageCategoriesModal
        open={showManageCategories}
        onOpenChange={setShowManageCategories}
        tenantKey={tenantKey}
        mentorId={mentorId}
      />

      <BulkDeleteMemoryModal
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        isDeleting={isBulkDeleting}
        selectedCategory={selectedCategoryName}
      />
    </>
  );
}
