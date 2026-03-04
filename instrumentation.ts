export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Suppress HTMLElement errors during server startup pre-warming
    // These errors occur when Next.js pre-warms routes that use browser APIs
    // but don't affect actual request handling
    process.on('unhandledRejection', (reason: any) => {
      if (reason?.message?.includes?.('HTMLElement is not defined')) {
        // Suppress these specific errors during pre-warming
        console.warn(
          '[Next.js] Suppressed HTMLElement error during route pre-warming (non-blocking)',
        );
        return;
      }
      // Let other unhandled rejections be handled normally (by Sentry, etc.)
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
