import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChromeExtensionAgent } from '@/hooks/use-chrome-extension-agent';
import {
  AGENT_PURPOSES,
  BROWSING_ASSISTANT_NAME,
  PURPOSE_AGENTS_KEY,
} from '@/lib/purpose-agents';

const CHROME = AGENT_PURPOSES.CHROME_EXTENSION;

const unwrap = <T>(value: T) => ({ unwrap: () => Promise.resolve(value) });
const rejects = (error: unknown) => ({
  unwrap: () => Promise.reject(error),
});

const getTenantMetadata = vi.fn();
const updateTenantMetadata = vi.fn();
const createMentor = vi.fn();
const getMentors = vi.fn();

let isAdmin = true;
let username: string | null = 'jane';
let knownMetadata: Record<string, unknown> = {};

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetTenantMetadataQuery: () => [getTenantMetadata],
  useUpdateTenantMetadataMutation: () => [updateTenantMetadata],
  useCreateMentorMutation: () => [createMentor],
}));

vi.mock('@/features/mentors/api-slice', () => ({
  useLazyGetMentorsQuery: () => [getMentors],
}));

vi.mock('@/lib/config', () => ({
  config: { iblTemplateMentor: () => 'ai-mentor' },
}));

vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: () => isAdmin,
  useUsername: () => username,
}));

vi.mock('@/hooks/use-tenant-object-metadata', () => ({
  useTenantObjectMetadata: () => knownMetadata,
}));

const envelope = (metadata: unknown) => ({
  platform_key: 'acme',
  platform_name: 'Acme',
  metadata,
});

const panel = () => renderHook(() => useChromeExtensionAgent()).result.current;
const resolve = () => {
  const agent = panel();
  return (tenantKey: string) => agent.resolve(tenantKey);
};

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = true;
  username = 'jane';
  knownMetadata = {};
  getTenantMetadata.mockReturnValue(unwrap(envelope({})));
  getMentors.mockReturnValue(unwrap({ results: [] }));
  createMentor.mockReturnValue(unwrap({ unique_id: 'made-1' }));
  updateTenantMetadata.mockReturnValue(unwrap({}));
});

describe('an organization that has already chosen', () => {
  it('opens its agent without asking the platform anything', async () => {
    knownMetadata = { [PURPOSE_AGENTS_KEY]: { [CHROME]: 'chosen-1' } };

    await expect(resolve()('acme')).resolves.toEqual({
      status: 'ready',
      mentorId: 'chosen-1',
    });

    expect(getTenantMetadata).not.toHaveBeenCalled();
    expect(createMentor).not.toHaveBeenCalled();
  });

  it('asks the platform when the list it had was out of date', async () => {
    getTenantMetadata.mockReturnValue(
      unwrap(envelope({ [PURPOSE_AGENTS_KEY]: { [CHROME]: 'chosen-2' } })),
    );

    await expect(resolve()('acme')).resolves.toEqual({
      status: 'ready',
      mentorId: 'chosen-2',
    });

    expect(createMentor).not.toHaveBeenCalled();
  });
});

describe('an organization that has not', () => {
  it('creates the agent, records it, and opens it', async () => {
    await expect(resolve()('acme')).resolves.toEqual({
      status: 'ready',
      mentorId: 'made-1',
    });

    expect(createMentor).toHaveBeenCalledWith(
      expect.objectContaining({
        org: 'acme',
        userId: 'jane',
        formData: expect.objectContaining({
          new_mentor_name: BROWSING_ASSISTANT_NAME,
        }),
      }),
    );
    expect(updateTenantMetadata).toHaveBeenCalledWith([
      expect.objectContaining({
        org: 'acme',
        requestBody: expect.objectContaining({
          metadata: { [PURPOSE_AGENTS_KEY]: { [CHROME]: 'made-1' } },
        }),
      }),
    ]);
  });

  it('keeps the rest of the metadata when it records the agent', async () => {
    getTenantMetadata.mockReturnValue(
      unwrap(envelope({ mentor_advanced_css: '.a{}' })),
    );

    await resolve()('acme');

    expect(
      updateTenantMetadata.mock.calls[0][0][0].requestBody.metadata,
    ).toEqual({
      mentor_advanced_css: '.a{}',
      [PURPOSE_AGENTS_KEY]: { [CHROME]: 'made-1' },
    });
  });

  it('adopts an agent of that name rather than making a second one', async () => {
    // A create whose metadata write failed leaves one behind; making another
    // on every load is how an organization ends up with twenty.
    getMentors.mockReturnValue(
      unwrap({
        results: [{ name: BROWSING_ASSISTANT_NAME, unique_id: 'found-1' }],
      }),
    );

    await expect(resolve()('acme')).resolves.toEqual({
      status: 'ready',
      mentorId: 'found-1',
    });

    expect(createMentor).not.toHaveBeenCalled();
    expect(updateTenantMetadata).toHaveBeenCalled();
  });

  it('opens the agent it made even when recording it failed', async () => {
    updateTenantMetadata.mockReturnValue(rejects(new Error('403')));

    await expect(resolve()('acme')).resolves.toEqual({
      status: 'ready',
      mentorId: 'made-1',
    });
  });

  it('asks someone who may not make one to have it set up', async () => {
    isAdmin = false;

    await expect(resolve()('acme')).resolves.toEqual({
      status: 'needs-setup',
    });

    expect(createMentor).not.toHaveBeenCalled();
    expect(updateTenantMetadata).not.toHaveBeenCalled();
  });

  it('leaves the choice to the app when the agent could not be made', async () => {
    createMentor.mockReturnValue(rejects(new Error('500')));

    // A failure we could not see past must not read as "not set up".
    await expect(resolve()('acme')).resolves.toEqual({
      status: 'unavailable',
    });

    expect(updateTenantMetadata).not.toHaveBeenCalled();
  });

  it('leaves the choice to the app when the metadata cannot be read', async () => {
    getTenantMetadata.mockReturnValue(rejects(new Error('403')));

    await expect(resolve()('acme')).resolves.toEqual({
      status: 'unavailable',
    });

    expect(createMentor).not.toHaveBeenCalled();
  });
});

describe('an agent that has been deleted', () => {
  it('is never resolved again once it is known to be gone', async () => {
    knownMetadata = { [PURPOSE_AGENTS_KEY]: { [CHROME]: 'dead-1' } };
    const agent = panel();
    expect(agent.peek()).toBe('dead-1');

    agent.forget('dead-1');

    // Without this the next resolve reads the same dead id straight back out
    // of metadata and the panel loops between it and the 404.
    expect(agent.peek()).toBeNull();
    await expect(agent.resolve('acme')).resolves.toMatchObject({
      status: 'ready',
      mentorId: 'made-1',
    });
  });

  it('is replaced in the organization, not just skipped', async () => {
    getTenantMetadata.mockReturnValue(
      unwrap(envelope({ [PURPOSE_AGENTS_KEY]: { [CHROME]: 'dead-1' } })),
    );
    const agent = panel();
    agent.forget('dead-1');

    await expect(agent.resolve('acme')).resolves.toMatchObject({
      status: 'ready',
      mentorId: 'made-1',
    });

    expect(
      updateTenantMetadata.mock.calls[0][0][0].requestBody.metadata,
    ).toEqual({ [PURPOSE_AGENTS_KEY]: { [CHROME]: 'made-1' } });
  });

  it('is not adopted back by name', async () => {
    getMentors.mockReturnValue(
      unwrap({
        results: [{ name: BROWSING_ASSISTANT_NAME, unique_id: 'dead-1' }],
      }),
    );
    const agent = panel();
    agent.forget('dead-1');

    await expect(agent.resolve('acme')).resolves.toMatchObject({
      status: 'ready',
      mentorId: 'made-1',
    });
  });

  it('leaves the choice to the app for someone who may not replace it', async () => {
    isAdmin = false;
    knownMetadata = { [PURPOSE_AGENTS_KEY]: { [CHROME]: 'dead-1' } };
    const agent = panel();
    agent.forget('dead-1');

    await expect(agent.resolve('acme')).resolves.toEqual({
      status: 'needs-setup',
    });
  });
});

describe('two panels opening at once', () => {
  it('creates one agent, not one each', async () => {
    const agent = panel();

    const [first, second] = await Promise.all([
      agent.resolve('acme'),
      agent.resolve('acme'),
    ]);

    // The name search cannot see a sibling's not-yet-indexed create, so the
    // guard has to be here.
    expect(createMentor).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ mentorId: 'made-1' });
    expect(second).toMatchObject({ mentorId: 'made-1' });
  });
});

describe('the agent it creates', () => {
  it("is built from the deployment's template and visible to members", async () => {
    await resolve()('acme');

    expect(createMentor.mock.calls[0][0].formData).toMatchObject({
      template_name: 'ai-mentor',
      mentor_visibility: 'viewable_by_tenant_students',
      // ibl.ai's own router: a third-party provider would only answer in
      // organizations holding that key.
      llm_provider: 'iblai',
      llm_name: 'iblai-pro',
    });
  });
});

describe('a platform that says no', () => {
  const refuses = (status: number, detail?: string) => ({
    unwrap: () =>
      Promise.reject({ status, data: detail ? { detail } : undefined }),
  });

  it('says so rather than quietly using another agent', async () => {
    createMentor.mockReturnValue(refuses(403, 'Not allowed to create agents'));

    await expect(resolve()('acme')).resolves.toEqual({
      status: 'refused',
      reason: 'Not allowed to create agents',
    });
  });

  it.each([400, 402, 409, 422])('treats %s as a refusal', async (status) => {
    createMentor.mockReturnValue(refuses(status));

    await expect(resolve()('acme')).resolves.toMatchObject({
      status: 'refused',
    });
  });

  it.each([500, 502, 503])(
    'treats %s as a hiccup, not a refusal',
    async (status) => {
      createMentor.mockReturnValue(refuses(status));

      // Trying again later may work, and telling a whole organization it cannot
      // have this because of one bad minute would be wrong.
      await expect(resolve()('acme')).resolves.toEqual({
        status: 'unavailable',
      });
    },
  );

  it('treats a failure with no status as a hiccup', async () => {
    createMentor.mockReturnValue(rejects(new Error('network')));

    await expect(resolve()('acme')).resolves.toEqual({ status: 'unavailable' });
  });
});
