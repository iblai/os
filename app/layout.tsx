import type { Metadata, Viewport } from 'next';
import { Open_Sans } from 'next/font/google';
import { Suspense } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

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
import { buildMetadata, getSiteUrl } from '@/lib/seo';
import { SiteJsonLd } from '@/components/seo/json-ld';

const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-open-sans',
});

export async function generateMetadata(): Promise<Metadata> {
  // Root defaults: title template, canonical/OG base derived from the request
  // host, icons, manifest, and noindex-by-default. Public pages opt in to
  // indexing via buildMetadata({ index: true }) in their own generateMetadata.
  return buildMetadata({ root: true });
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563EB',
};

// The root layout resolves the active locale from cookies (see i18n/request.ts),
// which is a dynamic API. Force dynamic rendering app-wide so the build does not
// try to statically prerender pages — calling cookies() during static
// generation crashes the page-data collection worker. Cookie-based locale means
// nothing under this layout can be static anyway.
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const origin = await getSiteUrl();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Site-wide structured data (Organization + WebSite). Viewport, icons,
            and the manifest are emitted by the metadata/viewport exports. */}
        <SiteJsonLd origin={origin} />
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
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
