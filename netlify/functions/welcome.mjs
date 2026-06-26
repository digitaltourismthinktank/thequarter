/**
 * The Quarter — post-payment helper. Given a Stripe Checkout Session id (passed in
 * the Payment Link success redirect as ?session_id={CHECKOUT_SESSION_ID}), return
 * the email the customer paid with, so /welcome can pre-fill it and the Memberstack
 * account email matches the Stripe email. Falls back to null (manual entry) if the
 * session can't be read (e.g. the restricted key lacks Checkout Sessions: Read).
 */
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  const sid = new URL(req.url).searchParams.get('session_id');
  if (!sid || !STRIPE_SECRET) return json({ email: null });
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, {
      headers: { authorization: `Bearer ${STRIPE_SECRET}` },
    });
    const s = await res.json();
    const email = s?.customer_details?.email || s?.customer_email || null;
    return json({ email });
  } catch {
    return json({ email: null });
  }
}
