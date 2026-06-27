import type { Metadata } from 'next';
import { Legal } from '@/components/site/Legal';

export const metadata: Metadata = {
  title: 'Code of Conduct',
  description: 'The Quarter — the house rules.',
  alternates: { canonical: '/code-of-conduct' },
};

export default function CodeOfConductPage() {
  return (
    <Legal title="Code of Conduct" updated="Last updated June 2026">
      <p>
        The house rules. We keep these light, because The Quarter works on goodwill, not policing. The spirit is simple: treat the place, and each
        other, the way you&rsquo;d want a shared home treated. They sit alongside our <a href="/terms">Terms of Membership</a>.
      </p>

      <h2>Calls and noise</h2>
      <p>
        Keep the main workspace calm. Take calls and video meetings in a phone booth or a flexi room, and pop your headphones on for anything with
        sound. A bit of friendly chatter is part of the place; a long speakerphone call in the open space isn&rsquo;t.
      </p>

      <h2>Meeting rooms</h2>
      <p>Book what you need, and let it go if your plans change so someone else can use it. They&rsquo;re a shared resource, so fair use keeps them fair for everyone.</p>

      <h2>Refreshments</h2>
      <p>
        The breakfast, the pastries, the specialty coffee and the soft drinks are on us, so help yourself and enjoy them. We&rsquo;re not precious
        about it. Just keep it to enjoying here, rather than clearing the fridge or taking supplies home, so there&rsquo;s plenty for everyone.
      </p>

      <h2>The kitchen and your space</h2>
      <p>Clear up after yourself, wash your bits up, and leave your desk as you&rsquo;d like to find it. It&rsquo;s everyone&rsquo;s kitchen and everyone&rsquo;s space.</p>

      <h2>Guests</h2>
      <p>Sign your guests in, keep them with you, and check with us before bringing people in for a tour or to show them round. You&rsquo;re their host while they&rsquo;re here.</p>

      <h2>Dogs</h2>
      <p>We&rsquo;re dog-friendly and we love them — on a lead, well-behaved, and cleaned up after.</p>

      <h2>Out of hours</h2>
      <p>
        Regular members are welcome to work outside normal hours, just let us know in advance when you&rsquo;ll be in so we know who&rsquo;s in the
        building. It&rsquo;s a security thing, not a permission thing.
      </p>

      <h2>Respect</h2>
      <p>Everyone&rsquo;s welcome here, and everyone deserves to feel that way. Be considerate, be kind, and keep it professional.</p>

      <h2>Looking after the place</h2>
      <p>
        Tell us if something&rsquo;s broken or run out, and please don&rsquo;t alter or move things around (signage, furniture, fittings) without
        asking. It&rsquo;s a beautiful space and we&rsquo;d like to keep it that way, together.
      </p>

      <p>Thank you for helping keep The Quarter the warm, easy place it&rsquo;s meant to be. Any questions, just ask us.</p>
    </Legal>
  );
}
