export const customErrorMessages = {
  mentorNotFound: {
    key: 'mentorNotFound',
    header: 'Mentor Not Found',
    message:
      'The mentor you are looking for does not exist. Please contact our support team if you believe this is an error.',
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
