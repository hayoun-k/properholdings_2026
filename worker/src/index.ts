import type { Env } from './types';
import { syncCalendars } from './sync';
import { handleAvailability, handleCreateBooking } from './booking';
import { verifyWebhookSignature } from './stripe';

function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function cors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

async function handleStripeWebhook(req: Request, env: Env): Promise<Response> {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return json({ error: 'Missing signature' }, 400);

  const payload = await req.text();
  const valid = await verifyWebhookSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return json({ error: 'Invalid signature' }, 401);

  const event = JSON.parse(payload) as { type: string; data: { object: { id: string; metadata: Record<string, string> } } };

  if (event.type === 'payment_intent.succeeded') {
    const intentId = event.data.object.id;
    await env.DB
      .prepare(`UPDATE bookings SET status = 'confirmed' WHERE stripe_payment_intent_id = ?`)
      .bind(intentId)
      .run();
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intentId = event.data.object.id;
    await env.DB
      .prepare(`UPDATE bookings SET status = 'cancelled' WHERE stripe_payment_intent_id = ?`)
      .bind(intentId)
      .run();
  }

  return json({ received: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const corsHeaders = cors(env.ALLOWED_ORIGIN);

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let res: Response;

      // Stripe webhook must NOT have CORS headers and reads raw body — handle first
      if (url.pathname === '/api/webhook/stripe' && method === 'POST') {
        return handleStripeWebhook(request, env);
      }

      if (url.pathname === '/api/availability' && method === 'GET') {
        res = await handleAvailability(request, env);
      } else if (url.pathname === '/api/booking' && method === 'POST') {
        res = await handleCreateBooking(request, env);
      } else if (url.pathname === '/api/sync' && method === 'POST') {
        // Manual trigger for testing; in production the cron fires automatically
        await syncCalendars(env);
        res = json({ ok: true });
      } else {
        res = json({ error: 'Not found' }, 404);
      }

      // Attach CORS headers
      const out = new Response(res.body, res);
      Object.entries(corsHeaders).forEach(([k, v]) => out.headers.set(k, v));
      return out;
    } catch (err) {
      console.error(err);
      return json({ error: 'Internal server error' }, 500, corsHeaders);
    }
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await syncCalendars(env);
  },
} satisfies ExportedHandler<Env>;
