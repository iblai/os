'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useCreateAgentSkillMutation } from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useSkillRecordingContext } from '@/providers/skill-recording-provider';
import { buildRecordedSkill, type RecordedStep } from '@/lib/recorded-skill';
import type { TenantKeyMentorIdParams } from '@/lib/types';

/**
 * An address someone can place at a glance; the full one stays as hover text.
 * A mail thread's URL is ninety characters of no use in a list of steps.
 */
export function shortUrl(url: string): string {
  try {
    const { host, pathname, search, hash } = new URL(url);
    // The hash counts: a mail thread's id lives there, and without it two
    // different steps render as the same line.
    const rest = `${pathname === '/' ? '' : pathname}${search}${hash}`;
    return rest.length > 24 ? `${host}${rest.slice(0, 24)}…` : `${host}${rest}`;
  } catch {
    return url;
  }
}

/** The verb, then what it acts on, so a scan down the list reads as a procedure. */
export function stepParts(step: RecordedStep): { verb: string; what: string } {
  const control = step.target.name
    ? `${step.target.role} “${step.target.name}”`
    : step.target.role;
  switch (step.tool) {
    case 'navigate':
      return { verb: 'Go to', what: shortUrl(step.url) };
    case 'type':
      return { verb: 'Type into', what: control };
    case 'select':
      return { verb: 'Choose in', what: control };
    default:
      return { verb: 'Click', what: control };
  }
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

  const remaining = captured.filter((_, index) => !dropped.has(index)).length;

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

  let position = 0;

  return (
    <div
      data-testid="skill-review"
      className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-white"
    >
      <div className="flex-none border-b border-gray-200 p-4">
        <h2 className="ibl-dialog-title">Name This Skill</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          The agent follows these steps when you ask for this again.
        </p>
        <Input
          value={name}
          autoFocus
          placeholder="Weekly sales report"
          aria-label="Skill name"
          className="mt-3"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <p className="flex-none px-4 pt-3 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
        {remaining === 1 ? '1 step' : `${remaining} steps`}
      </p>

      <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-2">
        {remaining === 0 && (
          <li className="rounded-md border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
            Every step was removed. Discard this and record again.
          </li>
        )}
        {captured.map((step, index) => {
          if (dropped.has(index)) return null;
          const { verb, what } = stepParts(step);
          position += 1;
          return (
            <li
              key={index}
              className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              <span className="mt-0.5 flex-none text-[11px] font-medium text-gray-400">
                {position}
              </span>
              {/* `min-w-0` is what lets this wrap instead of pushing the row
                  wider than the panel — a long address did exactly that. */}
              <span className="min-w-0 flex-1 text-xs break-words text-gray-700">
                <span className="text-gray-500">{verb}</span>{' '}
                <span title={step.url}>{what}</span>
                {step.value ? (
                  <label className="mt-1.5 flex items-start gap-1.5 text-[11px] text-gray-500">
                    <Checkbox
                      className="mt-0.5 h-3.5 w-3.5 flex-none"
                      checked={keptValues.has(index)}
                      onCheckedChange={(checked) =>
                        setKeptValues((values) => {
                          const next = new Set(values);
                          if (checked) next.add(index);
                          else next.delete(index);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 break-words">
                      Always use “{step.value}”
                    </span>
                  </label>
                ) : null}
              </span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove step ${index + 1}`}
                onClick={() => setDropped((drops) => new Set(drops).add(index))}
                className="h-7 w-7 flex-none p-0 text-gray-400 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-none items-center justify-end gap-2 border-t border-gray-200 p-3">
        <Button variant="ghost" onClick={() => recording.clear()}>
          Discard
        </Button>
        <Button
          onClick={save}
          className="ibl-button-primary"
          disabled={!name.trim() || steps.length === 0 || isLoading}
        >
          Save Skill
        </Button>
      </div>
    </div>
  );
}
