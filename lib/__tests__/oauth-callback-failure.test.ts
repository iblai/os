import { describe, it, expect } from 'vitest';
import { describeOAuthCallbackFailure } from '../oauth-callback-failure';

const failure = (data: Record<string, unknown>) => ({ status: 400, data });

describe('describeOAuthCallbackFailure', () => {
  it.each([
    [
      'a used or expired state',
      failure({ detail: 'Invalid state' }),
      'This sign-in link has expired or was already used. Close this tab and try again.',
    ],
    [
      'a token the service refused',
      failure({
        error:
          'Failed to retrieve token for oauth service: github_tools with error: incorrect_client_credentials',
      }),
      "The service didn't accept the sign-in. Check the app's Client ID and Client Secret, then try again.",
    ],
    [
      'a code that gave no token',
      failure({ error: 'Could not exchange auth token with provided code' }),
      "The service didn't accept the sign-in. Check the app's Client ID and Client Secret, then try again.",
    ],
    [
      'no app credentials',
      failure({ detail: 'No credentials found' }),
      "This service has no app credentials saved. Add them in the connector's settings, then try again.",
    ],
    [
      'a missing secret',
      failure({ detail: "'client_secret'" }),
      "This service has no app credentials saved. Add them in the connector's settings, then try again.",
    ],
    [
      'a service that did not answer',
      failure({
        error: "The provider didn't respond in time. Try signing in again.",
      }),
      "The service didn't answer in time. Close this tab and try again.",
    ],
  ])('says what to do after %s, in plain words', (_case, error, message) => {
    expect(describeOAuthCallbackFailure(error)).toBe(message);
  });

  it.each([
    ['an unknown refusal', failure({ detail: 'Something else' })],
    [
      'no answer at all',
      { status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' },
    ],
    ['nothing', null],
    ['a non-text detail', failure({ detail: { code: 1 } })],
  ])('falls back to one plain sentence for %s', (_case, error) => {
    expect(describeOAuthCallbackFailure(error)).toBe(
      "We couldn't finish connecting. Close this tab and try again.",
    );
  });
});
