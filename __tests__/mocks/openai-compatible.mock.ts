/**
 * Mock implementation of @ai-sdk/openai-compatible for testing.
 * See ai-sdk.mock.ts for why this alias exists.
 */

export const createOpenAICompatible = () => {
  throw new Error(
    '@ai-sdk/openai-compatible is not available in the test environment',
  );
};

export default { createOpenAICompatible };
