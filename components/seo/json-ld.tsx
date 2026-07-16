import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';

/**
 * Renders site-wide structured data (schema.org Organization + WebSite) as
 * JSON-LD. Server component — safe to place in the root layout. Per-page
 * structured data (e.g. a public mentor as a `Person`/`SoftwareApplication`)
 * can be added on the specific route with its own `<JsonLd data={...} />`.
 */
export function SiteJsonLd({ origin }: { origin: string }) {
  const graph = [organizationJsonLd(origin), websiteJsonLd(origin)];
  return (
    <script
      type="application/ld+json"
      // Content is app-controlled (no user input), so this is safe.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

/** Render an arbitrary JSON-LD object on a specific page. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
