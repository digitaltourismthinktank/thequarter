import type { Metadata } from 'next';
import Script from 'next/script';
import { Legal } from '@/components/site/Legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How The Quarter (SE1 Media Ltd) collects and uses personal data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <Legal title="Privacy Policy" updated="Last updated June 2026">
      <p>This policy explains how we collect and use personal data in connection with The Quarter co-working space, its membership app, and this website.</p>

      <h2>Who we are</h2>
      <p>
        The data controller is <strong>SE1 Media Ltd</strong>, trading as the Digital Tourism Think Tank, a company registered in England and
        Wales (company number 05732153), which operates The Quarter.
      </p>
      <p>
        <strong>Registered address</strong> 1st Floor, 27–28 Burgate, Canterbury, Kent, CT1 2HA, United Kingdom
        <br />
        <strong>Privacy contact</strong> <a href="mailto:info@thinkdigital.travel">info@thinkdigital.travel</a>
        <br />
        <strong>VAT number</strong> GB 888686925
      </p>

      <h2>What data we collect</h2>
      <ul>
        <li>
          <strong>Membership accounts.</strong> Your name, email, and the details tied to your account: plan, day balance, bookings, check-ins,
          and (if you provide it) your company and your birthday (day and month only).
        </li>
        <li>
          <strong>Payments.</strong> Plan, day-pass, carnet and room-hire payments are processed by our payment provider. We don&rsquo;t hold your
          card details.
        </li>
        <li>
          <strong>Rewards and perks.</strong> Points earned and redeemed, and which partner offers you&rsquo;ve used, so we can run the rewards
          programme and confirm perks at partner businesses.
        </li>
        <li>
          <strong>Bookings and access.</strong> Room and pod bookings, and, where relevant, door access and out-of-hours arrangements.
        </li>
        <li>
          <strong>Guests.</strong> If you sign in as a visitor: your name, who you&rsquo;re here to see, your arrival time, and your company if you
          give it. Held for the day as a fire-safety record and cleared each evening.
        </li>
        <li>
          <strong>Communications.</strong> If you opt in, your contact details for our member emails, and the content of any message you send us.
        </li>
        <li>
          <strong>Site analytics.</strong> Anonymised data about how the site is used: pages visited, device type and approximate location from an
          anonymised IP address.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <p>We process personal data only where we have a lawful basis under UK GDPR.</p>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Lawful basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Setting up and running your membership, bookings and account</td>
            <td>Performance of a contract</td>
          </tr>
          <tr>
            <td>Taking payment for plans, passes, carnet and room hire</td>
            <td>Performance of a contract</td>
          </tr>
          <tr>
            <td>Running the rewards programme and confirming perks at partners</td>
            <td>Legitimate interests</td>
          </tr>
          <tr>
            <td>Keeping a daily roll-call of who is in the building (fire safety)</td>
            <td>Legal obligation / legitimate interests</td>
          </tr>
          <tr>
            <td>Sending practical updates about the space, your plan and events</td>
            <td>Legitimate interests</td>
          </tr>
          <tr>
            <td>Member emails, where you opted in</td>
            <td>Consent</td>
          </tr>
          <tr>
            <td>Understanding how the site is used and improving it</td>
            <td>Legitimate interests</td>
          </tr>
        </tbody>
      </table>

      <h2>Who we share it with</h2>
      <p>Each acts as a data processor under a written contract with us; where a processor is outside the UK, transfers are covered by appropriate safeguards such as Standard Contractual Clauses.</p>
      <ul>
        <li>
          <strong>Stripe</strong> — payment processing. We don&rsquo;t hold card details.
        </li>
        <li>
          <strong>Our membership and authentication provider</strong> — account sign-in and member records.
        </li>
        <li>
          <strong>Intercom</strong> — member email, CRM and live chat.
        </li>
        <li>
          <strong>Airtable</strong> — editing perks and events content.
        </li>
        <li>
          <strong>Apple Wallet</strong> — your membership pass, where you add one.
        </li>
        <li>
          <strong>Cookie-Script</strong> — recording your cookie preferences.
        </li>
        <li>
          <strong>Web analytics</strong> — anonymised site analytics.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Member and booking data</strong> — for as long as you&rsquo;re a member, then a reasonable period after you leave.
        </li>
        <li>
          <strong>Financial records</strong> — six years from the end of the relevant tax year (a statutory requirement).
        </li>
        <li>
          <strong>Guest roll-call</strong> — cleared at the end of each day once the building is empty.
        </li>
        <li>
          <strong>Marketing consent</strong> — until you withdraw it.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Under UK GDPR you have the right to access the data we hold about you, have inaccurate data corrected, have your data erased where we no
        longer have a lawful basis to hold it, restrict or object to certain processing, receive your data in a portable format, and withdraw
        marketing consent at any time. To exercise any of these, contact us at <a href="mailto:info@thinkdigital.travel">info@thinkdigital.travel</a>.
        We&rsquo;ll respond within one calendar month.
      </p>

      <h2>Complaints</h2>
      <p>
        If you believe we&rsquo;ve not handled your data correctly, you can complain to the Information Commissioner&rsquo;s Office (ICO):
        ico.org.uk · 0303 123 1113.
      </p>

      <h2>Cookies</h2>
      <p>We use a small number of cookies to run the site, remember your preferences and understand usage. You can change your choices any time via the cookie banner. The current list of cookies on this site:</p>
      <Script src="https://report.cookie-script.com/r/064e38604f7ba35680d8f547f21c404a.js" strategy="afterInteractive" data-cookiescriptreport="report" />

      <h2>Changes to this policy</h2>
      <p>We&rsquo;ll update this page if our data practices change. The date at the top shows when it was last revised.</p>
    </Legal>
  );
}
