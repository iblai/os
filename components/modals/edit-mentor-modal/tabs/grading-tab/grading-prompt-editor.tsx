'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const DEFAULT_PLACEHOLDER =
  'Describe how the mentor should grade student responses against the rubric...';

const MAX_PROMPT_LENGTH = 4000;

type GradingPromptEditorProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

export function GradingPromptEditor({
  value,
  onChange,
  disabled = false,
  placeholder = DEFAULT_PLACEHOLDER,
  id = 'grading-prompt',
}: GradingPromptEditorProps) {
  const charCount = value.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>Grading Prompt</Label>
        <span
          className="text-xs text-gray-500"
          data-testid="grading-prompt-char-count"
          aria-live="polite"
        >
          {charCount} / {MAX_PROMPT_LENGTH}
        </span>
      </div>
      <Textarea
        id={id}
        data-testid="grading-prompt-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={MAX_PROMPT_LENGTH}
        rows={6}
        className="min-h-[140px]"
      />
    </div>
  );
}

export const GRADING_PROMPT_MAX_LENGTH = MAX_PROMPT_LENGTH;
