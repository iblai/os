import { describe, expect, it } from 'vitest';

import {
  buildInstruction,
  buildRecordedSkill,
  sitesIn,
  slugify,
  type RecordedStep,
} from '@/lib/recorded-skill';

const REPORTS = 'https://admin.acme.com/reports';

const steps: RecordedStep[] = [
  { tool: 'navigate', target: { role: 'page', name: 'Reports' }, url: REPORTS },
  {
    tool: 'click',
    target: { role: 'button', name: 'Date range' },
    url: REPORTS,
  },
  {
    tool: 'click',
    target: { role: 'option', name: 'Last 7 days' },
    url: REPORTS,
    outcomeUrl: `${REPORTS}?range=7d`,
  },
  {
    tool: 'select',
    target: { role: 'combobox', name: 'Format' },
    value: 'CSV',
    url: `${REPORTS}?range=7d`,
  },
];

describe('slugify', () => {
  it.each([
    ['Weekly Sales CSV', 'weekly-sales-csv'],
    ['  Trimmed  ', 'trimmed'],
    ['Ünïcode Náme', 'unicode-name'],
    ['lots!!! of... punctuation???', 'lots-of-punctuation'],
  ])('turns %s into %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('still gives a slug for a name with nothing usable in it', () => {
    expect(slugify('—— ??')).toBe('recorded-skill');
  });
});

describe('the playbook', () => {
  it('reads as instructions against what is on screen', () => {
    // Not selectors: this has to still be followable after the site changes.
    expect(buildInstruction(steps)).toBe(
      [
        '1. Go to https://admin.acme.com/reports',
        '2. Click the button "Date range"',
        '3. Click the option "Last 7 days"',
        '4. Choose "CSV" in the combobox "Format"',
      ].join('\n'),
    );
  });

  it('asks the agent to use what the person wanted where no value was kept', () => {
    const [line] = buildInstruction([
      {
        tool: 'type',
        target: { role: 'textbox', name: 'Search' },
        url: REPORTS,
      },
    ]).split('\n');

    expect(line).toBe(
      '1. Type into the textbox "Search" what the person asked for',
    );
  });

  it('names an unnamed control by its role alone', () => {
    expect(
      buildInstruction([
        { tool: 'click', target: { role: 'button', name: '' }, url: REPORTS },
      ]),
    ).toBe('1. Click the button');
  });
});

describe('sitesIn', () => {
  it('lists each host once, following where a step ended up', () => {
    expect(sitesIn(steps)).toEqual(['admin.acme.com']);
  });

  it('skips anything that is not a usable address', () => {
    expect(sitesIn([{ ...steps[1], url: 'not a url' }])).toEqual([]);
  });
});

describe('buildRecordedSkill', () => {
  const draft = { name: 'Weekly Sales CSV', steps, mentorId: 'agent-1' };

  it('is private to the agent that recorded it', () => {
    expect(buildRecordedSkill(draft).mentor).toBe('agent-1');
  });

  it('carries what the catalog needs to file it', () => {
    expect(buildRecordedSkill(draft)).toMatchObject({
      name: 'Weekly Sales CSV',
      slug: 'weekly-sales-csv',
      version: '1.0.0',
      skill_type: 'custom',
      category: 'browser',
      source: 'chrome-extension-recorder',
    });
  });

  it('describes itself by where it was recorded when nobody wrote one', () => {
    expect(buildRecordedSkill(draft).description).toBe(
      'Recorded on admin.acme.com.',
    );
  });

  it('keeps the description the person wrote', () => {
    expect(
      buildRecordedSkill({ ...draft, description: '  Pull the weekly totals ' })
        .description,
    ).toBe('Pull the weekly totals');
  });
});
