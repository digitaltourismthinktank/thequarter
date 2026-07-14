import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow } from '@/components/site/primitives';
import { TourBooking } from '@/components/site/TourBooking';

export const metadata: Metadata = {
  title: 'Book a tour',
  description:
    'Come and see The Quarter before you join. Book a free, no-obligation tour of our co-working home in Canterbury’s Cathedral Quarter — weekdays, 09:30–17:00.',
  alternates: { canonical: '/tour' },
};

export default function TourPage() {
  return (
    <>
      <Section tone="ink">
        <div style={{ maxWidth: 680 }}>
          <Eyebrow dark>Come and have a look</Eyebrow>
          <SectionHead
            dark
            title="Book a tour"
            intro="The best way to know if The Quarter is for you is to see it. Pick a time that suits — we’ll show you around, put the kettle on, and answer anything you like. Free, no obligation."
            max={620}
          />
        </div>
      </Section>

      <Section tone="page">
        <SectionHead eyebrow="Pick a time" title="When would you like to come in?" intro="Weekdays, 09:30–17:00. Choose a day and we’ll show you what’s free." max={600} />
        <TourBooking />
      </Section>
    </>
  );
}
