/**
 * A finished recording, as the panel hands it over, turned into the skill the
 * platform stores. The step shape is repeated here rather than imported: the
 * extension is a separate bundle and these cross a `postMessage` boundary.
 */

export interface RecordedStep {
  tool: 'click' | 'type' | 'select' | 'navigate';
  target: { role: string; name: string };
  value?: string;
  url: string;
  outcomeUrl?: string;
}

export interface RecordedSkillDraft {
  name: string;
  description?: string;
  steps: RecordedStep[];
  /** The agent that recorded it; the skill is private to it. */
  mentorId: string;
}

export const RECORDED_SKILL_CATEGORY = 'browser';
export const RECORDED_SKILL_SOURCE = 'chrome-extension-recorder';
export const RECORDED_SKILL_VERSION = '1.0.0';

export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'recorded-skill'
  );
}

function line(step: RecordedStep): string {
  const control = step.target.name
    ? `the ${step.target.role} "${step.target.name}"`
    : `the ${step.target.role}`;
  switch (step.tool) {
    case 'navigate':
      return `Go to ${step.url}`;
    case 'type':
      return step.value
        ? `Type "${step.value}" into ${control}`
        : `Type into ${control} what the person asked for`;
    case 'select':
      return step.value
        ? `Choose "${step.value}" in ${control}`
        : `Choose in ${control} what the person asked for`;
    default:
      return `Click ${control}`;
  }
}

/**
 * The playbook the agent follows. Written as instructions against what is on
 * screen, never selectors, so it still reads true after the site changes.
 */
export function buildInstruction(steps: RecordedStep[]): string {
  return steps.map((step, index) => `${index + 1}. ${line(step)}`).join('\n');
}

/** The sites a recording touched, for the playbook's first line. */
export function sitesIn(steps: RecordedStep[]): string[] {
  const hosts = steps.flatMap((step) => {
    try {
      return [new URL(step.outcomeUrl ?? step.url).host];
    } catch {
      return [];
    }
  });
  return [...new Set(hosts)];
}

export interface RecordedSkillPayload {
  name: string;
  slug: string;
  description: string;
  version: string;
  skill_type: 'custom';
  category: string;
  source: string;
  mentor: string;
  instruction: string;
}

export function buildRecordedSkill(
  draft: RecordedSkillDraft,
): RecordedSkillPayload {
  const sites = sitesIn(draft.steps);
  const description =
    draft.description?.trim() ||
    (sites.length
      ? `Recorded on ${sites.join(', ')}.`
      : 'Recorded in the browser.');

  return {
    name: draft.name.trim(),
    slug: slugify(draft.name),
    description,
    version: RECORDED_SKILL_VERSION,
    skill_type: 'custom',
    category: RECORDED_SKILL_CATEGORY,
    source: RECORDED_SKILL_SOURCE,
    mentor: draft.mentorId,
    instruction: buildInstruction(draft.steps),
  };
}
