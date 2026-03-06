#!/usr/bin/env node
// Server wrapper to suppress HTMLElement errors during Next.js pre-warming

import { existsSync } from 'node:fs';

// Install error handler BEFORE importing Next.js server
process.on('unhandledRejection', (reason) => {
  if (reason?.message?.includes?.('HTMLElement is not defined')) {
    // Suppress these specific errors - they're from pre-warming and don't affect functionality
    console.log('ℹ Suppressed non-blocking HTMLElement error during route pre-warming');
    return;
  }
  // Re-throw other errors
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Now start the Next.js standalone server
// In Docker, server.js is in the same directory; locally it's in .next/standalone/apps/mentor/
const localPath = './.next/standalone/server.js';
const dockerPath = './server.js';

if (existsSync(localPath)) {
  import(localPath);
} else {
  import(dockerPath);
}
