'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useCreateAgentSkillMutation } from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSkillRecordingContext } from '@/providers/skill-recording-provider';
import { buildRecordedSkill, type RecordedStep } from '@/lib/recorded-skill';
import type { TenantKeyMentorIdParams } from '@/lib/types';

function describe(step: RecordedStep): string {
  const control = step.target.name
    ? `${step.target.role} "${step.target.name}"`
    : step.target.role;
  if (step.tool === 'navigate') return `Go to ${step.url}`;
  if (step.tool === 'type') return `Type into the ${control}`;
  if (step.tool === 'select') return `Choose in the ${control}`;
  return `Click the ${control}`;
}

/**
 * What a person does with a finished recording before it becomes a skill:
 * name it, drop the wrong turns, and decide which of the things they typed
 * belong to the skill rather than to that one afternoon.
 */
export function SkillReview() {
  const recording = useSkillRecordingContext();
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();
  const [createSkill, { isLoading }] = useCreateAgentSkillMutation();
  const [name, setName] = useState('');
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [keptValues, setKeptValues] = useState<Set<number>>(new Set());

  const captured = recording?.steps ?? null;
  const steps = useMemo(
    () =>
      (captured ?? [])
        .map((step, index) =>
          keptValues.has(index) ? step : { ...step, value: undefined },
        )
        .filter((_, index) => !dropped.has(index)),
    [captured, dropped, keptValues],
  );

  if (!recording || !captured) return null;

  const save = async () => {
    if (!name.trim() || !mentorId || !tenantKey) return;
    try {
      await createSkill({
        org: tenantKey,
        ...buildRecordedSkill({ name, steps, mentorId }),
      } as never).unwrap();
      toast.success('Skill saved');
      recording.clear();
    } catch {
      toast.error('The skill could not be saved. Try again.');
    }
  };

  return (
    <div
      data-testid="skill-review"
      className="absolute inset-0 z-20 flex min-h-0 flex-col gap-3 overflow-y-auto bg-white p-4"
    >
      <div>
        <h2 className="text-base font-medium text-gray-900">Name this skill</h2>
        <p className="mt-1 text-xs text-gray-500">
          The agent follows these steps when you ask for this again.
        </p>
      </div>
      <Input
        value={name}
        autoFocus
        placeholder="Weekly sales report"
        aria-label="Skill name"
        onChange={(event) => setName(event.target.value)}
      />

      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {captured.map((step, index) => {
          if (dropped.has(index)) return null;
          return (
            <li
              key={index}
              className="flex items-start gap-2 rounded-md border border-gray-200 p-2 text-xs text-gray-700"
            >
              <span className="flex-1">
                {describe(step)}
                {step.value !== undefined && (
                  <label className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
                    <input
                      type="checkbox"
                      checked={keptValues.has(index)}
                      onChange={(event) =>
                        setKeptValues((kept) => {
                          const next = new Set(kept);
                          if (event.target.checked) next.add(index);
                          else next.delete(index);
                          return next;
                        })
                      }
                    />
                    Always use “{step.value}”
                  </label>
                )}
              </span>
              <button
                type="button"
                aria-label={`Remove step ${index + 1}`}
                onClick={() => setDropped((drops) => new Set(drops).add(index))}
                className="text-gray-400 hover:text-gray-700"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => recording.clear()}>
          Discard
        </Button>
        <Button
          onClick={save}
          disabled={!name.trim() || steps.length === 0 || isLoading}
        >
          Save Skill
        </Button>
      </div>
    </div>
  );
}
