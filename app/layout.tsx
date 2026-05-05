import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import { Suspense } from 'react';

import Providers from '@/providers';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

import Script from 'next/script';
import { StoreProvider } from '@/providers/store-provider';
import { Spinner } from '@/components/spinner';
import ConsoleSetup from '@/lib/logger';
import { IblDataHandler } from '@/components/ibl-data-handler';
import { ServiceWorkerProvider } from '@/components/service-worker-provider';
import { ChunkErrorRecovery } from '@/components/chunk-error-recovery';

const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-open-sans',
});

export const metadata: Metadata = {
  title: 'ibl.ai | Agentic OS',
  description: 'ibl.ai | Agentic OS',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
        {/* Inline styles for initial loader - shows immediately for better FCP */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              #initial-loader {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: white;
                z-index: 9999;
                transition: opacity 0.2s ease-out;
              }
              #initial-loader.hidden {
                opacity: 0;
                pointer-events: none;
                visibility: hidden;
              }
              #initial-loader svg {
                width: 2rem;
                height: 2rem;
                color: #2563EB;
                animation: spin 1s linear infinite;
              }
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `,
          }}
        />
      </head>
      <body className={`${openSans.variable} antialiased`}>
        {/* Initial loader - shows immediately before React hydrates */}
        <div id="initial-loader" role="status" aria-label="Loading...">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <ConsoleSetup />
        <Script src="/env.js" strategy="afterInteractive" />
        <StoreProvider>
          <ChunkErrorRecovery />
          <ServiceWorkerProvider>
            <Suspense
              fallback={
                <div className="flex h-dvh w-screen items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <IblDataHandler />
              <Providers>{children}</Providers>
            </Suspense>
          </ServiceWorkerProvider>
        </StoreProvider>
        <Toaster />
      </body>
    </html>
  );
}
