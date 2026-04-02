"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { DateRange } from "react-day-picker";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Plus,
  ChevronDown,
  Calendar,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  useGetMentorMemoriesQuery,
  useDeleteMentorMemoryMutation,
  useUpdateMentorMemoryMutation,
  useCreateMentorMemoryMutation,
  useGetMemoryCategoriesAdminQuery,
  type MentorMemory,
  type MentorMemoryCategory,
} from "@iblai/iblai-js/data-layer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EditMemoryModal = dynamic(
  () =>
    import("./edit-memory-modal").then((module) => ({
      default: module.EditMemoryModal,
    })),
  { ssr: false },
);

const AddMemoryModal = dynamic(
  () =>
    import("./add-memory-modal").then((module) => ({
      default: module.AddMemoryModal,
    })),
  { ssr: false },
);

const DeleteMemoryModal = dynamic(
  () =>
    import("./delete-memory-modal").then((module) => ({
      default: module.DeleteMemoryModal,
    })),
  { ssr: false },
);

const BulkDeleteMemoryModal = dynamic(
  () =>
    import("./bulk-delete-memory-modal").then((module) => ({
      default: module.BulkDeleteMemoryModal,
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
  username?: string;
  createdAt?: string;
}

interface ManageMemoriesProps {
  tenantKey: string;
  username: string | null;
  mentorId: string;
}

export function ManageMemories({
  tenantKey,
  username,
  mentorId,
}: ManageMemoriesProps) {
  const [selectedLearner, setSelectedLearner] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Build query params for server-side filtering
  const queryParams = useMemo(() => {
    const params: { start_date?: string; end_date?: string; user_id?: string } =
      {};
    if (selectedLearner) {
      params.user_id = selectedLearner;
    }
    if (dateRange?.from) {
      params.start_date = format(dateRange.from, "yyyy-MM-dd");
    }
    if (dateRange?.to) {
      params.end_date = format(dateRange.to, "yyyy-MM-dd");
    }
    return Object.keys(params).length > 0 ? params : undefined;
  }, [selectedLearner, dateRange]);

  // API hooks - use new memsearch endpoints
  const { data: memoriesByCategoryResponse, isLoading: isLoadingMemories } =
    useGetMentorMemoriesQuery(
      {
        org: tenantKey,
        userId: username ?? "",
        mentorId,
        ...(queryParams ? { params: queryParams } : {}),
      },
      {
        skip: !tenantKey || !username || !mentorId,
      },
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

  // Flatten the by-category response into a flat list of memories
  const memories: Memory[] = useMemo(() => {
    if (!memoriesByCategoryResponse) return [];

    return memoriesByCategoryResponse.flatMap((item) =>
      item.memories.map((memory: MentorMemory) => ({
        id: memory.id,
        content: memory.content,
        category: {
          id: memory.category.id,
          name: memory.category.name,
          slug: memory.category.slug,
        },
        username: memory.username,
        createdAt: memory.created_at,
      })),
    );
  }, [memoriesByCategoryResponse]);

  // Fetch unfiltered memories to derive learner list for the dropdown
  const { data: unfilteredResponse } = useGetMentorMemoriesQuery(
    {
      org: tenantKey,
      userId: username ?? "",
      mentorId,
    },
    {
      skip: !tenantKey || !username || !mentorId,
    },
  );

  // Derive unique learners from all (unfiltered) memories for the filter dropdown
  const learners = useMemo(() => {
    if (!unfilteredResponse) return [];
    const userMap = new Map<string, { username: string; email: string }>();
    unfilteredResponse.forEach((item) =>
      item.memories.forEach((m: MentorMemory) => {
        if (m.username && !userMap.has(m.username)) {
          userMap.set(m.username, { username: m.username, email: m.username });
        }
      }),
    );
    return Array.from(userMap.values());
  }, [unfilteredResponse]);

  // Build category list from admin categories or from the response
  const categories = useMemo(() => {
    if (adminCategories && adminCategories.length > 0) {
      return [
        { id: 0, name: "All", slug: "all" },
        ...adminCategories.map((cat: MentorMemoryCategory) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
        })),
      ];
    }

    // Fallback: derive from response
    if (!memoriesByCategoryResponse)
      return [{ id: 0, name: "All", slug: "all" }];

    const responseCats = memoriesByCategoryResponse.map((item) => ({
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug,
    }));

    return [{ id: 0, name: "All", slug: "all" }, ...responseCats];
  }, [adminCategories, memoriesByCategoryResponse]);

  const [selectedCategorySlug, setSelectedCategorySlug] = useState("all");
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(
    null,
  );
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState("");
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const selectedCategoryName =
    categories.find((c) => c.slug === selectedCategorySlug)?.name ?? "All";

  const filteredMemories =
    selectedCategorySlug === "all"
      ? memories
      : memories.filter(
          (memory) => memory.category.slug === selectedCategorySlug,
        );

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
      toast.success("Memory deleted successfully");
    } catch (error) {
      console.error("Failed to delete memory:", error);
      toast.error("Failed to delete memory");
    }
  };

  const handleBulkDelete = async () => {
    if (!tenantKey || !username) return;

    setIsBulkDeleting(true);
    try {
      const memoriesToDelete = memories.filter(
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
      console.error("Failed to delete memories:", error);
      toast.error("Failed to delete memories");
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
      await updateMentorMemory({
        org: tenantKey,
        userId: username,
        mentorId,
        memoryId: editingMemory.id,
        data: {
          content: editContent,
          ...(selectedCat && selectedCat.slug !== editingMemory.category.slug
            ? { category_slug: selectedCat.slug }
            : {}),
        },
      }).unwrap();
      toast.success("Memory updated successfully");

      setEditingMemory(null);
      setEditContent("");
      setEditCategory("");
    } catch (error) {
      console.error("Failed to update memory:", error);
      toast.error("Failed to update memory");
    }
  };

  const cancelEdit = () => {
    setEditingMemory(null);
    setEditContent("");
    setEditCategory("");
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
          category_slug: categorySlug === "all" ? "general" : categorySlug,
          content: newMemoryContent.trim(),
        },
      }).unwrap();

      setShowAddMemory(false);
      setNewMemoryContent("");
      setNewMemoryCategory("");
      if (selectedCat) {
        setSelectedCategorySlug(selectedCat.slug);
      }
      toast.success("Memory created successfully");
    } catch (error) {
      console.error("Failed to create memory:", error);
      toast.error("Failed to create memory");
    }
  };

  const cancelAddMemory = () => {
    setShowAddMemory(false);
    setNewMemoryContent("");
    setNewMemoryCategory("");
  };

  const categoryNames = categories.map((c) => c.name);

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
                      ? learners.find(
                          (learner) => learner.username === selectedLearner,
                        )?.email
                      : "Search for User"}
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
                            setSelectedLearner("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !selectedLearner ? "opacity-100" : "opacity-0",
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
                                "mr-2 h-4 w-4",
                                selectedLearner === learner.username
                                  ? "opacity-100"
                                  : "opacity-0",
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
                  className="flex items-center gap-2 whitespace-nowrap font-normal bg-transparent w-full lg:w-auto"
                >
                  <Calendar className="h-4 w-4" />
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                    : "Pick a Date Range"}
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
                  key={category.slug}
                  onClick={() => setSelectedCategorySlug(category.slug)}
                  className={`relative py-2 px-1 text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategorySlug === category.slug
                      ? "text-[#38A1E5]"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {category.name}
                  {selectedCategorySlug === category.slug && (
                    <div
                      className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5 bg-[#38A1E5] transition-all duration-200"
                      style={{ width: `${category.name.length * 0.55}em` }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="sm:hidden py-2 w-full">
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
                          ? "bg-gray-100"
                          : ""
                      }
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              onClick={startAddMemory}
              size="sm"
              className="ibl-button-primary shrink-0"
            >
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
            filteredMemories.map((memory) => {
              const timeAgo = memory.createdAt
                ? formatDistanceToNow(new Date(memory.createdAt), {
                    addSuffix: true,
                  })
                : "";
              const displayUser = memory.username || "Unknown";

              return (
                <div
                  key={memory.id}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    {(timeAgo || displayUser) && (
                      <div className="flex items-center justify-between mb-2">
                        {timeAgo && (
                          <span className="text-sm text-gray-600">
                            {timeAgo}
                          </span>
                        )}
                        {displayUser && (
                          <span className="text-sm text-gray-900 max-w-[100px] sm:max-w-[200px] truncate">
                            {displayUser}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-sm text-gray-900 leading-relaxed">
                      {memory.content}
                    </div>
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

        {filteredMemories.length > 0 && selectedCategorySlug !== "all" && (
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
          <div className="text-center py-8 text-gray-600">
            <p>No saved memories yet.</p>
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
