// Stripe API via fetch — avoids Node.js SDK incompatibilities in Workers

function toFormData(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export async function createPaymentIntent(
  secretKey: string,
  amountCents: number,
  metadata: Record<string, string>,
): Promise<{ id: string; client_secret: string }> {
  const body = toFormData({
    amount: amountCents,
    currency: 'usd',
    payment_method_types: 'card',
    ...Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v]),
    ),
  });

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const err = await res.json<{ error: { message: string } }>();
    throw new Error(`Stripe error: ${err.error.message}`);
  }

  return res.json();
}

// Stripe webhook signature verification using Web Crypto (no Node.js required)
export async function verifyWebhookSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    sigHeader.split(',').map((p) => p.split('=')),
  ) as Record<string, string>;

  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  // Reject if timestamp is older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );

  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (expected.length !== v1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return mismatch === 0;
}
