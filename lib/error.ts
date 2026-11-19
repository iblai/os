export const customErrorMessages = {
  mentorNotFound: {
    key: 'mentorNotFound',
    header: 'Agent Not Found',
    message:
      'The agent you are looking for does not exist. Please contact our support team if you believe this is an error.',
  },
  browserAgentRefused: {
    key: 'browserAgentRefused',
    header: 'Cannot Be Set Up Here',
    message:
      'The browser assistant could not be set up for this organization, and trying again will not help. Someone who manages it will need to look at what this organization is allowed to create.',
  },
  browserAgentNotSetUp: {
    key: 'browserAgentNotSetUp',
    header: 'Not Set Up Yet',
    message:
      'The browser assistant has not been set up for your organization yet, so it cannot be used here. Someone who manages your organization can set it up by opening this panel once. Contact them to ask.',
  },
  sessionNotFound: {
    key: 'sessionNotFound',
    header: 'Session not found',
    message:
      'The session you are looking for does not exist. Please contact our support team if you believe this is an error.',
  },
};

export interface ApiError {
  status?: number;
  data?: {
    error?: string;
  };
  error?: {
    error?: string;
  };
}

export const extractErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  const apiError = error as ApiError;
  return apiError?.data?.error || apiError?.error?.error || fallback;
};
