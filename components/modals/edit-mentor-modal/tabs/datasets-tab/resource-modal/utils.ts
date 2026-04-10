// Define common API error structures
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
