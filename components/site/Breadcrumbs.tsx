/* The Quarter — BreadcrumbList JSON-LD for a page. Renders a single
   application/ld+json script via JsonLd. Always leads with Home ("/"); pass the
   trail after Home, e.g. <Breadcrumbs trail={[{ name: 'Plans', path: '/plans' }]} />.
   Item URLs are absolute (built from SITE.url). */
import { JsonLd } from './JsonLd';
import { breadcrumbLd, type Crumb } from '@/lib/site';

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return <JsonLd data={breadcrumbLd(trail)} />;
}
