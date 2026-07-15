import type { Metadata } from 'next';
import { Legal } from '@/components/site/Legal';

export const metadata: Metadata = {
  title: 'Terms of Membership',
  description: 'The Quarter — Terms of Membership.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <Legal title="Terms of Membership" updated="Last updated June 2026">
      <p>
        The Quarter is operated by <strong>SE1 Media Ltd</strong>, trading as the Digital Tourism Think Tank, a company registered in England and
        Wales (company number 05732153), registered office 1st &amp; 2nd Floor, 27–28 Burgate, Canterbury, Kent, CT1 2HA. In these terms, &ldquo;we&rdquo;,
        &ldquo;us&rdquo; and &ldquo;the Quarter&rdquo; mean SE1 Media Ltd; &ldquo;you&rdquo; means a member, day guest or anyone booking or using the
        space. Please read these alongside our <a href="/code-of-conduct">Code of Conduct</a> and <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>1. These terms</h2>
      <p>
        These terms apply to everyone who uses The Quarter, whether on a membership plan, a day pass, a carnet, or a room booking. By joining,
        buying a pass, or using the space, you agree to them and to the Code of Conduct. We may update them from time to time; the current version
        always lives on our site, and we&rsquo;ll tell members about any material change by email.
      </p>

      <h2>2. Your membership</h2>
      <p>
        Our plans, day passes and the day-pass carnet, with what each includes, are set out on our site. Membership gives you access to the open
        workspace, the phone pods and the things we lay on (fibre, a monitor at every desk, plug-and-play A/V, breakfast, specialty coffee and
        refreshments), used reasonably and in the spirit of the Code of Conduct. Plans are personal to you and can&rsquo;t be shared or transferred.
      </p>

      <h2>3. Payment and billing</h2>
      <p>
        Plans are paid in advance and renew automatically until cancelled. Day passes and carnet bundles are paid at purchase; a carnet is valid
        for 12 months from purchase and isn&rsquo;t refundable or extendable beyond that. We don&rsquo;t refund unused days on a monthly plan. If a
        payment fails, we may pause your access until it&rsquo;s settled, and we may charge reasonable costs we incur in recovering overdue amounts.
        Prices include VAT unless we say otherwise.
      </p>

      <h2>4. The business address service</h2>
      <p>If your plan includes use of our Canterbury address (for example as a registered or business address), the following apply, and they matter to us:</p>
      <ul>
        <li>
          You must <strong>tell us, and have our agreement, before you use our address</strong> for anything. We may ask for proof of identity and
          of your business (we have anti-money-laundering and know-your-customer obligations to meet).
        </li>
        <li>You may only use the address lawfully and accurately, and only while your membership is active.</li>
        <li>
          When your membership ends, you must <strong>stop using our address straight away and update it everywhere it appears</strong> (Companies
          House, your website, invoices, listings, mail). Continuing to use it is a breach of these terms.
        </li>
        <li>
          You may not use our address for anything unlawful, misleading, or that risks bringing The Quarter into disrepute. If you do, we may
          withdraw the service immediately and recover any costs or losses it causes us.
        </li>
      </ul>

      <h2>5. Access and security</h2>
      <p>
        Your access is personal to you and not transferable. Keep any fob, key or code to yourself, and tell us at once if one is lost. We may set
        and change opening hours. Regular members are welcome to use the space outside normal hours <strong>by prior arrangement</strong> — please
        let us know in advance when you&rsquo;ll be in, so we know who is in the building. Turning up out of hours without telling us, or letting
        others in, isn&rsquo;t on, for everyone&rsquo;s security.
      </p>

      <h2>6. Using the space properly</h2>
      <p>The Quarter is a place to work, and a shared one. So:</p>
      <ul>
        <li>Use it for work and the purposes your membership is for, not as a thoroughfare or simply to use the facilities.</li>
        <li>Don&rsquo;t bring people in for tours or to &ldquo;show them round&rdquo; without checking with us first, and sign in any guest (clause 7).</li>
        <li>Nothing unlawful, dangerous, or that creates a nuisance or risk for others or the building. The space isn&rsquo;t a residence, shop or public-facing premises.</li>
        <li>Treat people, staff and the place with respect. We want everyone here to feel welcome and able to work.</li>
      </ul>
      <p>If someone is in breach of this clause or the Code of Conduct, we may ask them to leave, and for serious or repeated breaches we may suspend or end their membership (clause 11).</p>

      <h2>7. Guests and visitors</h2>
      <p>
        You&rsquo;re welcome to bring the occasional guest. Sign them in at the desk or kiosk, keep them with you, and you&rsquo;re responsible for
        them and their conduct while they&rsquo;re here. Please don&rsquo;t host meetings or bring groups that go beyond a normal guest; book a
        meeting room for that.
      </p>

      <h2>8. Meeting rooms</h2>
      <p>
        Members may use the meeting rooms on a <strong>fair-use</strong> basis: book what you genuinely need and release it if your plans change.
        External and company bookings are charged at our published room rates. We may ask you to vacate or rebook if a room is needed for a
        confirmed paid booking, and a cancellation made at short notice may be charged.
      </p>

      <h2>9. Your belongings, insurance and our liability</h2>
      <p>
        Look after your own things; we&rsquo;re not responsible for property you leave here, and we&rsquo;d recommend you insure your own equipment
        and your business. You&rsquo;re responsible for any damage you cause beyond fair wear and tear. We provide the space and services with
        reasonable care and skill, but to the extent the law allows we&rsquo;re not liable for your business losses, or for interruptions outside
        our control (for example to power, internet or access). Nothing in these terms limits any liability that can&rsquo;t be limited by law.
      </p>

      <h2>10. Data protection</h2>
      <p>
        We handle personal data in line with our <a href="/privacy">Privacy Policy</a>, which explains what we collect, why, and your rights.
      </p>

      <h2>11. Suspending or ending membership</h2>
      <p>
        You can cancel a monthly plan at any time; it runs to the end of the paid period. We can end or suspend a membership on reasonable notice,
        or immediately for a serious or repeated breach of these terms or the Code of Conduct, for non-payment, or for unlawful use. When your
        membership ends, any unpaid sums fall due, you must stop using our address and update your records (clause 4), and we&rsquo;ll handle any
        mail and your data as set out in the Privacy Policy.
      </p>

      <h2>12. Changes</h2>
      <p>We may change these terms, our plans, our prices or the services. We&rsquo;ll give reasonable notice of anything material and post the current version on our site.</p>

      <h2>13. Law</h2>
      <p>These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction.</p>
    </Legal>
  );
}
