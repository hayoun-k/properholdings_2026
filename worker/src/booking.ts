import type { Env, Property } from './types';
import { createPaymentIntent } from './stripe';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
}

// Returns true if the date range [checkIn, checkOut) is fully available
async function isAvailable(
  db: D1Database,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  // Overlap condition: existing.start < requested.end AND existing.end > requested.start
  const [blocked, booked] = await db.batch([
    db
      .prepare(
        `SELECT 1 FROM blocked_ranges
         WHERE property_id = ? AND start_date < ? AND end_date > ?
         LIMIT 1`,
      )
      .bind(propertyId, checkOut, checkIn),
    db
      .prepare(
        `SELECT 1 FROM bookings
         WHERE property_id = ? AND status != 'cancelled'
           AND check_in < ? AND check_out > ?
         LIMIT 1`,
      )
      .bind(propertyId, checkOut, checkIn),
  ]);

  return blocked.results.length === 0 && booked.results.length === 0;
}

export async function handleAvailability(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId');
  const checkIn    = url.searchParams.get('checkIn');
  const checkOut   = url.searchParams.get('checkOut');

  if (!propertyId || !checkIn || !checkOut) {
    return json({ error: 'propertyId, checkIn, checkOut are required' }, 400);
  }

  if (checkIn >= checkOut) return json({ error: 'checkOut must be after checkIn' }, 400);
  if (checkIn < new Date().toISOString().slice(0, 10)) {
    return json({ error: 'checkIn must be in the future' }, 400);
  }

  const available = await isAvailable(env.DB, propertyId, checkIn, checkOut);
  return json({ available });
}

export async function handleCreateBooking(req: Request, env: Env): Promise<Response> {
  let body: {
    propertyId?: string;
    checkIn?: string;
    checkOut?: string;
    guestName?: string;
    guestEmail?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { propertyId, checkIn, checkOut, guestName, guestEmail } = body;

  if (!propertyId || !checkIn || !checkOut || !guestName || !guestEmail) {
    return json({ error: 'Missing required fields' }, 400);
  }

  if (checkIn >= checkOut) return json({ error: 'checkOut must be after checkIn' }, 400);
  if (checkIn < new Date().toISOString().slice(0, 10)) {
    return json({ error: 'checkIn must be in the future' }, 400);
  }

  const prop = await env.DB
    .prepare('SELECT * FROM properties WHERE id = ?')
    .bind(propertyId)
    .first<Property>();

  if (!prop) return json({ error: 'Property not found' }, 404);

  const available = await isAvailable(env.DB, propertyId, checkIn, checkOut);
  if (!available) return json({ error: 'Selected dates are not available' }, 409);

  const nights = daysBetween(checkIn, checkOut);
  const totalCents = nights * prop.price_cents;

  // Create Stripe PaymentIntent
  const intent = await createPaymentIntent(env.STRIPE_SECRET_KEY, totalCents, {
    propertyId,
    propertyName: prop.name,
    checkIn,
    checkOut,
    guestEmail,
  });

  // Persist a pending booking
  const bookingId = crypto.randomUUID();
  await env.DB
    .prepare(
      `INSERT INTO bookings
         (id, property_id, guest_name, guest_email, check_in, check_out, nights, total_cents, stripe_payment_intent_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .bind(bookingId, propertyId, guestName, guestEmail, checkIn, checkOut, nights, totalCents, intent.id)
    .run();

  return json({
    bookingId,
    clientSecret: intent.client_secret,
    totalCents,
    nights,
  });
}
