// The backend's own words (kept in the console) are developer text; the
// callback tab says what happened and what to do next.
export const describeOAuthCallbackFailure = (error: unknown): string => {
  const data = (
    error as { data?: { detail?: unknown; error?: unknown } } | null
  )?.data;
  const text = [data?.detail, data?.error]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  if (/invalid state/i.test(text)) {
    return 'This sign-in link has expired or was already used. Close this tab and try again.';
  }
  if (/retrieve token|exchange auth token/i.test(text)) {
    return "The service didn't accept the sign-in. Check the app's Client ID and Client Secret, then try again.";
  }
  if (/no credentials found|client_secret/i.test(text)) {
    return "This service has no app credentials saved. Add them in the connector's settings, then try again.";
  }
  if (/respond in time/i.test(text)) {
    return "The service didn't answer in time. Close this tab and try again.";
  }
  return "We couldn't finish connecting. Close this tab and try again.";
};
