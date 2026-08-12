/**
 * Mock implementation of @modelcontextprotocol/sdk/client/index.js for
 * testing. See ai-sdk.mock.ts for why this alias exists.
 */

export class Client {
  constructor() {
    throw new Error(
      '@modelcontextprotocol/sdk is not available in the test environment',
    );
  }
}

export default { Client };
