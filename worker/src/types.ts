export interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  ALLOWED_ORIGIN: string;
}

export interface Property {
  id: string;
  name: string;
  airbnb_ical: string | null;
  vrbo_ical: string | null;
  price_cents: number;
}

export interface Booking {
  id: string;
  property_id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_cents: number;
  stripe_payment_intent_id: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
}

export interface ICalEvent {
  uid: string;
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
}
