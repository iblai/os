'use client';

import type React from 'react';
import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Search, Edit3, Trash2, Plus, Loader2 } from 'lucide-react';
import {
  useGetMentorMemoriesQuery,
  useDeleteMentorMemoryMutation,
  useUpdateMentorMemoryMutation,
  useCreateMentorMemoryMutation,
  useGetMemoryCategoriesAdminQuery,
  type MentorMemory,
  type MentorMemoryCategory,
} from '@iblai/iblai-js/data-layer';
import { useNavigate } from '@/hooks/user-navigate';
import { useUserIsStudent } from '@/hooks/use-user';
import { toast } from 'sonner';
import { TenantKeyMentorIdParams } from '@/lib/types';

interface MemoryMenuProps {
  onClose: () => void;
  tenantKey?: string;
  username?: string;
}

interface FlatMemory {
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

export const MemoryMenu = ({
  onClose,
  tenantKey,
  username,
}: MemoryMenuProps) => {
  const { mentorId: mentorIdFromParams } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const mentorId = getMentorId() ?? mentorIdFromParams ?? '';
  const isStudent = useUserIsStudent();

  const [showAllMemories, setShowAllMemories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategorySlug, setEditCategorySlug] = useState('');
  const [newMemory, setNewMemory] = useState({ content: '', categorySlug: '' });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Build query params - add my_memory=true for students
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (isStudent) {
      params.my_memory = 'true';
    }
    return Object.keys(params).length > 0 ? params : undefined;
  }, [isStudent]);

  const { data: memoriesByCategoryResponse, isLoading } =
    useGetMentorMemoriesQuery(
      {
        org: tenantKey ?? '',
        userId: username ?? '',
        mentorId,
        // @ts-ignore - my_memory param exists on API but not typed
        ...(queryParams ? { params: queryParams } : {}),
      },
      {
        skip: !tenantKey || !username || !mentorId,
      },
    );

  const { data: adminCategories } = useGetMemoryCategoriesAdminQuery(
    {
      org: tenantKey ?? '',
      mentorId,
    },
    {
      skip: !tenantKey || !mentorId,
    },
  );

  const [deleteMentorMemory] = useDeleteMentorMemoryMutation();
  const [updateMentorMemory, { isLoading: isUpdating }] =
    useUpdateMentorMemoryMutation();
  const [createMentorMemory, { isLoading: isCreating }] =
    useCreateMentorMemoryMutation();

  // Flatten the by-category response into a flat list
  const memories: FlatMemory[] = useMemo(() => {
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

  // Build category list
  const categories = useMemo(() => {
    if (adminCategories && adminCategories.length > 0) {
      return adminCategories.map((cat: MentorMemoryCategory) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
      }));
    }
    if (!memoriesByCategoryResponse) return [];
    return memoriesByCategoryResponse.map((item) => ({
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug,
    }));
  }, [adminCategories, memoriesByCategoryResponse]);

  const filteredMemories = memories.filter(
    (memory) =>
      memory.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.category.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDeleteMemory = async (memoryId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tenantKey || !username) return;

    setDeletingId(memoryId);
    try {
      await deleteMentorMemory({
        org: tenantKey,
        userId: username,
        mentorId,
        memoryId,
      }).unwrap();
      toast.success('Memory deleted');
    } catch {
      toast.error('Failed to delete memory');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemory.content.trim() || !tenantKey || !username) return;

    try {
      await createMentorMemory({
        org: tenantKey,
        userId: username,
        mentorId,
        data: {
          category_slug: newMemory.categorySlug || 'general',
          content: newMemory.content.trim(),
        },
      }).unwrap();
      setNewMemory({ content: '', categorySlug: '' });
      setIsAddingMemory(false);
      toast.success('Memory created');
    } catch {
      toast.error('Failed to create memory');
    }
  };

  const startEdit = (memory: FlatMemory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMemoryId(memory.id);
    setEditContent(memory.content);
    setEditCategorySlug(memory.category.slug);
  };

  const handleSaveEdit = async () => {
    if (!editingMemoryId || !tenantKey || !username) return;

    const original = memories.find((m) => m.id === editingMemoryId);
    try {
      await updateMentorMemory({
        org: tenantKey,
        userId: username,
        mentorId,
        memoryId: editingMemoryId,
        data: {
          content: editContent,
          ...(original && editCategorySlug !== original.category.slug
            ? { category_slug: editCategorySlug }
            : {}),
        },
      }).unwrap();
      setEditingMemoryId(null);
      setEditContent('');
      setEditCategorySlug('');
      toast.success('Memory updated');
    } catch {
      toast.error('Failed to update memory');
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <div className="border-b border-gray-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Your Memory</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-[#38A1E5] hover:text-white"
              onClick={() => setIsAddingMemory(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-gray-100"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 rounded-md border border-gray-300 pl-10 text-sm"
          />
        </div>

        <p className="mt-2 text-sm text-gray-500">
          {isStudent
            ? 'Your saved memories for this agent'
            : 'Memories for this agent'}
        </p>
      </div>

      {/* Add Memory Form */}
      {isAddingMemory && (
        <div className="border-b border-gray-100 bg-gray-50 p-4">
          <h4 className="mb-3 font-medium text-gray-900">Add New Memory</h4>
          <div className="space-y-3">
            <Textarea
              placeholder="Memory content..."
              value={newMemory.content}
              onChange={(e) =>
                setNewMemory({ ...newMemory, content: e.target.value })
              }
              className="min-h-[60px] resize-none rounded-md border border-gray-300 text-sm"
            />
            {categories.length > 0 && (
              <Select
                value={newMemory.categorySlug}
                onValueChange={(val) =>
                  setNewMemory({ ...newMemory, categorySlug: val })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddMemory}
                disabled={!newMemory.content.trim() || isCreating}
                className="bg-[#38A1E5] text-white hover:bg-[#2891D5]"
              >
                {isCreating ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : null}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAddingMemory(false);
                  setNewMemory({ content: '', categorySlug: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`${showAllMemories ? 'max-h-80' : 'max-h-64'} overflow-y-auto`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {filteredMemories
              .slice(0, showAllMemories ? filteredMemories.length : 4)
              .map((memory) => {
                const isEditing = editingMemoryId === memory.id;

                return (
                  <div
                    key={memory.id}
                    className="border-b border-gray-50 p-3 transition-colors last:border-b-0 hover:bg-gray-50"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[60px] resize-none rounded-md border border-gray-300 text-sm"
                          placeholder="Memory content..."
                        />
                        {categories.length > 0 && (
                          <Select
                            value={editCategorySlug}
                            onValueChange={setEditCategorySlug}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.slug} value={cat.slug}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={!editContent.trim() || isUpdating}
                            className="bg-[#38A1E5] text-white hover:bg-[#2891D5]"
                          >
                            {isUpdating ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingMemoryId(null);
                              setEditContent('');
                              setEditCategorySlug('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                {memory.category.name}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                              {memory.content}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              {formatTimestamp(memory.createdAt)}
                            </p>
                          </div>
                          <div className="ml-2 flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full hover:bg-blue-100"
                              onClick={(e) => startEdit(memory, e)}
                            >
                              <Edit3 className="h-3 w-3 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full hover:bg-red-100"
                              disabled={deletingId === memory.id}
                              onClick={(e) => handleDeleteMemory(memory.id, e)}
                            >
                              {deletingId === memory.id ? (
                                <Loader2 className="h-3 w-3 animate-spin text-red-500" />
                              ) : (
                                <Trash2 className="h-3 w-3 text-red-500" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            {filteredMemories.length === 0 && !isLoading && (
              <div className="p-4 text-center text-sm text-gray-500">
                {searchQuery
                  ? 'No memories found matching your search.'
                  : 'No memories yet.'}
              </div>
            )}
          </>
        )}
      </div>

      {filteredMemories.length > 4 && (
        <div className="border-t border-gray-100 p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full bg-transparent text-xs"
            onClick={() => setShowAllMemories(!showAllMemories)}
          >
            {showAllMemories
              ? 'Show Less'
              : `View All Memories (${filteredMemories.length})`}
          </Button>
        </div>
      )}
    </>
  );
};
