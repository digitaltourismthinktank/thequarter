/* The Quarter — JSON-LD structured data. Helps Google and AI answer engines
   (AEO) read and cite the business. Render inside any page/layout. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
