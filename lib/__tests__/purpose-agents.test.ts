import { describe, expect, it } from 'vitest';

import {
  AGENT_PURPOSES,
  PURPOSE_AGENTS_KEY,
  readPurposeAgent,
  withPurposeAgent,
} from '@/lib/purpose-agents';

const CHROME = AGENT_PURPOSES.CHROME_EXTENSION;

describe('readPurposeAgent', () => {
  it('finds the agent a tenant bound to a purpose', () => {
    const metadata = { [PURPOSE_AGENTS_KEY]: { [CHROME]: 'mentor-123' } };
    expect(readPurposeAgent(metadata, CHROME)).toBe('mentor-123');
  });

  it('reads a blob an older write left as a JSON string', () => {
    const metadata = {
      [PURPOSE_AGENTS_KEY]: JSON.stringify({ [CHROME]: 'mentor-123' }),
    };
    expect(readPurposeAgent(metadata, CHROME)).toBe('mentor-123');
  });

  it.each([
    ['no metadata at all', undefined],
    ['metadata without the key', { mentor_advanced_css: '.a{}' }],
    ['a blob that is not an object', { [PURPOSE_AGENTS_KEY]: 'nonsense' }],
    ['a list where a map belongs', { [PURPOSE_AGENTS_KEY]: ['mentor-123'] }],
    ['another purpose only', { [PURPOSE_AGENTS_KEY]: { slack: 'mentor-9' } }],
    ['an id that is blank', { [PURPOSE_AGENTS_KEY]: { [CHROME]: '   ' } }],
    ['an id that is not text', { [PURPOSE_AGENTS_KEY]: { [CHROME]: 7 } }],
  ])('answers null for %s', (_case, metadata) => {
    // Every one of these means the same thing to a caller — choose an agent the
    // normal way — so they must not be told apart.
    expect(readPurposeAgent(metadata as never, CHROME)).toBeNull();
  });
});

describe('withPurposeAgent', () => {
  it('keeps everything else the tenant stores', () => {
    // The endpoint REPLACES the metadata object, so a writer that dropped a
    // sibling key would delete the tenant's CSS along with it.
    const metadata = {
      mentor_advanced_css: '.a{}',
      user_onboarding_form: { version: 1 },
    };

    const next = withPurposeAgent(metadata, CHROME, 'mentor-123');

    expect(next).toEqual({
      mentor_advanced_css: '.a{}',
      user_onboarding_form: { version: 1 },
      [PURPOSE_AGENTS_KEY]: { [CHROME]: 'mentor-123' },
    });
  });

  it('keeps the agents bound to other purposes', () => {
    const metadata = { [PURPOSE_AGENTS_KEY]: { slack: 'mentor-9' } };

    const next = withPurposeAgent(metadata, CHROME, 'mentor-123');

    expect(next[PURPOSE_AGENTS_KEY]).toEqual({
      slack: 'mentor-9',
      [CHROME]: 'mentor-123',
    });
  });

  it('replaces the agent already bound to this purpose', () => {
    const metadata = { [PURPOSE_AGENTS_KEY]: { [CHROME]: 'old' } };

    expect(
      withPurposeAgent(metadata, CHROME, 'new')[PURPOSE_AGENTS_KEY],
    ).toEqual({ [CHROME]: 'new' });
  });

  it('rebuilds a string blob as an object', () => {
    const metadata = {
      [PURPOSE_AGENTS_KEY]: JSON.stringify({ slack: 'mentor-9' }),
    };

    expect(withPurposeAgent(metadata, CHROME, 'mentor-123')).toEqual({
      [PURPOSE_AGENTS_KEY]: { slack: 'mentor-9', [CHROME]: 'mentor-123' },
    });
  });

  it('does not touch the metadata it was given', () => {
    const metadata = { [PURPOSE_AGENTS_KEY]: { slack: 'mentor-9' } };

    withPurposeAgent(metadata, CHROME, 'mentor-123');

    expect(metadata).toEqual({ [PURPOSE_AGENTS_KEY]: { slack: 'mentor-9' } });
  });
});
