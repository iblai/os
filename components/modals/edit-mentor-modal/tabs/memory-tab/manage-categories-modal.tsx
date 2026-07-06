'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  useGetMemoryCategoriesAdminQuery,
  useCreateMemoryCategoryMutation,
  useUpdateMemoryCategoryMutation,
  useDeleteMemoryCategoryMutation,
  type MentorMemoryCategory,
} from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';

interface ManageCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantKey: string;
  mentorId: string;
}

const toSlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function ManageCategoriesModal({
  open,
  onOpenChange,
  tenantKey,
  mentorId,
}: ManageCategoriesModalProps) {
  const t = useTranslations('memoryTabManageCategoriesModal');
  const { data: categories = [], isLoading } = useGetMemoryCategoriesAdminQuery(
    { org: tenantKey, mentorId },
    { skip: !open || !tenantKey || !mentorId },
  );

  const [createCategory, { isLoading: isCreating }] =
    useCreateMemoryCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] =
    useUpdateMemoryCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] =
    useDeleteMemoryCategoryMutation();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCategory({
        org: tenantKey,
        mentorId,
        data: { name, slug: toSlug(name) },
      }).unwrap();
      setNewName('');
      toast.success(t('categoryCreated'));
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error(t('failedToCreateCategory'));
    }
  };

  const startEdit = (category: MentorMemoryCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (categoryId: number) => {
    const name = editName.trim();
    if (!name) return;
    try {
      await updateCategory({
        org: tenantKey,
        mentorId,
        categoryId,
        data: { name },
      }).unwrap();
      cancelEdit();
      toast.success(t('categoryUpdated'));
    } catch (error) {
      console.error('Failed to update category:', error);
      toast.error(t('failedToUpdateCategory'));
    }
  };

  const handleDelete = async (categoryId: number) => {
    try {
      await deleteCategory({
        org: tenantKey,
        mentorId,
        categoryId,
      }).unwrap();
      setConfirmDeleteId(null);
      toast.success(t('categoryDeleted'));
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error(t('failedToDeleteCategory'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          cancelEdit();
          setConfirmDeleteId(null);
          setNewName('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="mx-4 max-w-md sm:mx-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('newCategoryPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <Button
            className="ibl-button-primary"
            onClick={handleCreate}
            disabled={!newName.trim() || isCreating}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('addButton')}
          </Button>
        </div>

        <div className="max-h-[320px] space-y-2 overflow-y-auto">
          {isLoading ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t('loadingCategories')}
            </p>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t('noCategories')}
            </p>
          ) : (
            categories.map((category: MentorMemoryCategory) => {
              const isEditing = editingId === category.id;
              const isConfirming = confirmDeleteId === category.id;

              return (
                <div
                  key={category.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2"
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEdit(category.id);
                          } else if (e.key === 'Escape') {
                            cancelEdit();
                          }
                        }}
                        className="h-8"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => saveEdit(category.id)}
                        disabled={!editName.trim() || isUpdating}
                        aria-label={t('saveCategoryAriaLabel')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={cancelEdit}
                        aria-label={t('cancelEditAriaLabel')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : isConfirming ? (
                    <>
                      <span className="flex-1 text-sm text-gray-900">
                        {t('confirmDeleteMessage', { name: category.name })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        {t('cancelButton')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? t('deletingButton') : t('deleteButton')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-900">
                        {category.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => startEdit(category)}
                        aria-label={t('editCategoryAriaLabel', {
                          name: category.name,
                        })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        onClick={() => setConfirmDeleteId(category.id)}
                        aria-label={t('deleteCategoryAriaLabel', {
                          name: category.name,
                        })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-2 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('doneButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
