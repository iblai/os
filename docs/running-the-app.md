# Running the Mentor App

## Development Mode

For development with hot reload:

```bash
cd apps/mentor
pnpm dev
```

This starts the Next.js dev server on **http://localhost:3001**

## Production Mode

The app is configured with `output: 'standalone'` for optimized production builds.

### Option 1: Standalone Server (Recommended)

After building with `pnpm build`, run the standalone server:

```bash
# From apps/mentor directory
node .next/standalone/apps/mentor/server.js

# Or from monorepo root
node apps/mentor/.next/standalone/apps/mentor/server.js
```

The server runs on **http://localhost:3000**

### Option 2: Using `next start`

`next start` doesn't work with `output: 'standalone'`. If you need to use it:

1. Comment out `output: 'standalone'` in `next.config.ts`
2. Rebuild: `pnpm build`
3. Run: `pnpm start`

**Note:** For production deployments (Docker, etc.), always use the standalone output.

## Common Issues

### Error: HTMLElement is not defined

If you see this error during server start, a page is trying to use browser APIs during SSR.

**Fix:** Add `export const dynamic = 'force-dynamic'` to the page:

```typescript
'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

export default function MyPage() {
  // ...
}
```

### Error: "next start" does not work with standalone

This is expected. Use `node .next/standalone/apps/mentor/server.js` instead.

## Tauri iOS Development

For iOS development with Tauri:

```bash
# Start the dev server first
pnpm dev

# In another terminal, run the iOS app
make tauri-ios-dev
```

The Tauri app connects to http://localhost:3001 in debug mode.

For release builds (TestFlight/App Store):

```bash
make tauri-ios-build
# Then open Xcode and archive
```

Release builds use https://mentorai.iblai.app instead of localhost.
