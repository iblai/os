'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Plus, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useGetMemoriesQuery,
  useGetMemoryCategoriesQuery,
  useDeleteMemoryMutation,
  useDeleteMemoryByCategoryMutation,
  useUpdateMemoryEntryMutation,
  useCreateMemoryMutation,
  type Memory as ApiMemory,
  type MemoryEntry,
} from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { transformCategoryToApi, transformCategoryToDisplay } from './utils';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';

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
}

interface SavedMemoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantKey: string;
  username: string | null;
}

export function SavedMemoriesModal({
  open,
  onOpenChange,
  tenantKey,
  username,
}: SavedMemoriesModalProps) {
  const { tenantKey: tenantKeyParam } = useParams<TenantKeyMentorIdParams>();
  // API hooks
  const { data: memoriesResponse, isLoading: isLoadingMemories } = useGetMemoriesQuery(
    {
      tenantKey,
      username: username ?? '',
    },
    {
      skip: !tenantKey || !username || !open,
    },
  );

  const { data: categoriesResponse } = useGetMemoryCategoriesQuery(
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
      console.error(JSON.stringify({ tenant: tenantKeyParam, error }));
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
      console.error(JSON.stringify({ tenant: tenantKeyParam, error }));
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
      console.error(JSON.stringify({ tenant: tenantKeyParam, error }));
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
      console.error(JSON.stringify({ tenant: tenantKeyParam, error }));
    }
  };

  const cancelAddMemory = () => {
    setShowAddMemory(false);
    setNewMemoryContent('');
    setNewMemoryCategory('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-background text-foreground border-border mx-4 sm:mx-auto">
        <DialogHeader className="space-y-0">
          <div className="">
            <DialogTitle className="text-md font-medium">Saved Memories</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 overflow-x-hidden">
          <div className="border-t border-border"></div>

          <div className="flex items-center justify-between gap-4">
            <div className="hidden sm:flex space-x-8 overflow-x-auto flex-1 scrollbar-none border-border border-b">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`relative py-2 px-1 text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'text-[#38A1E5]'
                      : 'text-muted-foreground hover:text-foreground'
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
                      className={selectedCategory === category ? 'bg-accent' : ''}
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

          <div className="space-y-3 max-h-96 overflow-y-auto px-1 sm:px-0">
            {isLoadingMemories ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading memories...</p>
              </div>
            ) : (
              filteredMemories.map((memory: any) => (
                <div
                  key={memory.id}
                  className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border"
                >
                  <div className="flex-1 text-sm text-foreground leading-relaxed">
                    {memory.content}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
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
              ))
            )}
          </div>

          {filteredMemories.length > 0 && selectedCategory.toLowerCase() !== 'all' && (
            <div className="flex justify-end pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(true)}>
                Delete All
              </Button>
            </div>
          )}

          {filteredMemories.length === 0 && !isLoadingMemories && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No saved memories yet.</p>
            </div>
          )}
        </div>
      </DialogContent>

      <EditMemoryModal
        open={!!editingMemory}
        onOpenChange={(open) => !open && cancelEdit()}
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
        onOpenChange={(open) => !open && cancelAddMemory()}
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
        onOpenChange={(open) => !open && setShowDeleteConfirm(null)}
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
    </Dialog>
  );
}
