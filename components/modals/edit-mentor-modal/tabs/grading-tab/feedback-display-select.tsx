'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check } from 'lucide-react';

import type { FeedbackMode } from '@iblai/iblai-js/data-layer';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type FeedbackDisplaySelectProps = {
  value: FeedbackMode;
  onChange: (next: FeedbackMode) => void;
  disabled?: boolean;
  id?: string;
};

export const FEEDBACK_MODE_OPTIONS: Array<{
  value: FeedbackMode;
  label: string;
  description: string;
}> = [
  {
    value: 'per_criteria',
    label: 'Per criteria',
    description: 'Show a score and feedback for each rubric criterion.',
  },
  {
    value: 'overall',
    label: 'Overall only',
    description: 'Only show the overall score and feedback.',
  },
  {
    value: 'both',
    label: 'Both per criteria and overall',
    description: 'Show the rubric breakdown plus the overall summary.',
  },
];

export function FeedbackDisplaySelect({
  value,
  onChange,
  disabled = false,
  id = 'feedback-display',
}: FeedbackDisplaySelectProps) {
  return (
    <div className="space-y-3">
      <Label htmlFor={id}>Feedback Display</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as FeedbackMode)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          data-testid="feedback-display-trigger"
          aria-label="Feedback display"
        >
          <SelectValue placeholder="Select feedback display" />
        </SelectTrigger>
        <SelectContent>
          {FEEDBACK_MODE_OPTIONS.map((option) => (
            <SelectPrimitive.Item
              key={option.value}
              value={option.value}
              data-testid={`feedback-display-option-${option.value}`}
              className={cn(
                'focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default flex-col items-start rounded-sm py-1.5 pr-8 pl-2 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
              )}
            >
              <span className="absolute top-2 right-2 flex h-3.5 w-3.5 items-center justify-center">
                <SelectPrimitive.ItemIndicator>
                  <Check className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
              </span>
              <SelectPrimitive.ItemText>
                <span className="text-sm">{option.label}</span>
              </SelectPrimitive.ItemText>
              <span className="text-xs text-gray-500">
                {option.description}
              </span>
            </SelectPrimitive.Item>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
