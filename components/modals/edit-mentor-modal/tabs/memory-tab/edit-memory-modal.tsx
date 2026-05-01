'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface EditMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editContent: string;
  editCategory: string;
  onContentChange: (content: string) => void;
  onCategoryChange: (category: string) => void;
  onSave: () => void;
  onCancel: () => void;
  categories: string[];
  isSaving: boolean;
}

export function EditMemoryModal({
  open,
  onOpenChange,
  editContent,
  editCategory,
  onContentChange,
  onCategoryChange,
  onSave,
  onCancel,
  categories,
  isSaving,
}: EditMemoryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-2xl sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-700">Edit Memory</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              Category
            </label>
            <Select value={editCategory} onValueChange={onCategoryChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a memory category" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((cat) => cat !== 'All')
                  .map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Memory</label>
            <Textarea
              value={editContent}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Enter memory content..."
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              {editContent.trim().length < 10
                ? `${editContent.trim().length}/10 characters minimum`
                : `${editContent.trim().length} characters`}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              className="ibl-button-primary"
              disabled={editContent.trim().length < 10 || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
