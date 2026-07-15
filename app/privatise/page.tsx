import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow } from '@/components/site/primitives';
import { Privatisation } from '@/components/site/Privatisation';

export const metadata: Metadata = {
  title: 'Privatise a team room',
  description:
    'Give your team a room of their own at The Quarter in Canterbury. Privatise The Hop Yard or The Vineyard on your chosen days — the whole room, everyone’s accounts included, invoiced quarterly.',
  alternates: { canonical: '/privatise' },
};

const STEPS = [
  { title: 'Choose your room and days', text: 'Pick The Hop Yard or The Vineyard and the days your team needs it — the whole room, everyone included, set up in minutes and invoiced quarterly.' },
  { title: 'Everyone’s set up', text: 'Your whole team get their own accounts and check in like any member — with all the usual: breakfast, coffee, fibre, the pods and the rewards.' },
  { title: 'One simple invoice', text: 'You pay for the full room at the pass rate for your frequency, invoiced quarterly from your start date. No per-desk admin, no surprises.' },
];

export default function PrivatisePage() {
  return (
    <>
      <Section tone="ink">
        <div style={{ maxWidth: 680 }}>
          <Eyebrow dark>For teams</Eyebrow>
          <SectionHead
            dark
            title="A room of your own"
            intro="Give your team a home within The Quarter. Privatise one of our two flexible team rooms on the days you need it — the whole room, everyone included, invoiced quarterly. Minimum five members."
            max={620}
          />
        </div>
      </Section>

      <Section tone="page">
        <SectionHead eyebrow="How it works" title="Simple to set up, simpler to run" max={600} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20, marginTop: 8 }}>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '26px 24px' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--gold-400)', letterSpacing: 'var(--tracking-caps)' }}>{`0${i + 1}`}</div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', margin: '10px 0 8px' }}>{s.title}</h3>
              <p style={{ fontSize: 'var(--text-body)', lineHeight: 1.55, color: 'var(--stone-700)', margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="card" id="configure">
        <SectionHead
          eyebrow="Build your plan"
          title="Choose your room, days & start"
          intro="Everything updates as you go. When you’re ready, set up your subscription and pay — invoiced quarterly from your start date."
          max={620}
        />
        <Privatisation />
      </Section>
    </>
  );
}
