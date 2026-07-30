'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { CriterionDraft } from './hooks/use-grader-configuration';

type RubricEditorProps = {
  value: CriterionDraft[];
  onChange: (next: CriterionDraft[]) => void;
  disabled?: boolean;
};

const DEFAULT_POINTS = 1;

export function createEmptyRubricItem(): CriterionDraft {
  return { name: '', criteria: '', points: DEFAULT_POINTS };
}

export function RubricEditor({
  value,
  onChange,
  disabled = false,
}: RubricEditorProps) {
  const handleAdd = () => {
    onChange([...value, createEmptyRubricItem()]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, patch: Partial<CriterionDraft>) => {
    const next = value.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Rubric</Label>
        <span
          className="text-xs text-gray-500"
          data-testid="rubric-item-count"
          aria-live="polite"
        >
          {value.length} {value.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {value.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500"
          data-testid="rubric-empty-state"
        >
          No rubric items yet. Add at least one to enable grading.
        </div>
      ) : (
        <ul className="space-y-3" data-testid="rubric-items-list">
          {value.map((item, index) => {
            const itemKey = item.id ?? `rubric-item-${index}`;
            return (
              <li
                key={itemKey}
                data-testid={`rubric-item-${index}`}
                className="relative space-y-3 rounded-md border border-gray-200 bg-white p-3 pr-12"
              >
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Remove rubric item ${index + 1}`}
                  data-testid={`rubric-item-remove-${index}`}
                  onClick={() => handleRemove(index)}
                  className="absolute top-2 right-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor={`rubric-name-${index}`} className="text-xs">
                      Name
                    </Label>
                    <Input
                      id={`rubric-name-${index}`}
                      data-testid={`rubric-item-name-${index}`}
                      value={item.name}
                      disabled={disabled}
                      placeholder="e.g. Clarity"
                      maxLength={200}
                      onChange={(event) =>
                        handleUpdate(index, { name: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <Label
                      htmlFor={`rubric-points-${index}`}
                      className="text-xs"
                    >
                      Points
                    </Label>
                    <Input
                      id={`rubric-points-${index}`}
                      data-testid={`rubric-item-points-${index}`}
                      type="number"
                      min={0}
                      step="any"
                      value={item.points}
                      disabled={disabled}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const points = raw === '' ? 0 : Number(raw);
                        handleUpdate(index, {
                          points: Number.isNaN(points) ? 0 : points,
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label
                    htmlFor={`rubric-criteria-${index}`}
                    className="text-xs"
                  >
                    Criteria
                  </Label>
                  <Textarea
                    id={`rubric-criteria-${index}`}
                    data-testid={`rubric-item-criteria-${index}`}
                    value={item.criteria}
                    rows={2}
                    disabled={disabled}
                    placeholder="Describe what a high score on this criterion requires."
                    onChange={(event) =>
                      handleUpdate(index, { criteria: event.target.value })
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        disabled={disabled}
        onClick={handleAdd}
        data-testid="rubric-add-item"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add rubric item
      </Button>
    </div>
  );
}
