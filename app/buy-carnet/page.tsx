import type { Metadata } from 'next';
import { Section, SectionHead } from '@/components/site/primitives';
import { CarnetCheckout } from '@/components/site/CarnetCheckout';

export const metadata: Metadata = {
  title: 'Buy a day-pass carnet',
  description:
    'Buy a book of day passes for The Quarter, Canterbury — 10 for £194.40 or 30 for £550.80. Cheaper per day than a single pass, valid twelve months. Includes VAT.',
  robots: { index: false, follow: false },
};

export default function BuyCarnetPage() {
  return (
    <Section tone="page">
      <SectionHead
        align="center"
        eyebrow="Day-pass carnet"
        title="Buy a book of day passes"
        intro="Ten or thirty passes — cheaper per day than a single pass, valid twelve months. Pay now, then create your account and your passes land straight in your wallet. Prices include VAT."
        max={620}
      />
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <CarnetCheckout />
      </div>
    </Section>
  );
}
