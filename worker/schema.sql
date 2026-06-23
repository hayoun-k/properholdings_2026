-- Run: npm run db:init  (local)  or  npm run db:init:remote  (production)

CREATE TABLE IF NOT EXISTS properties (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  airbnb_ical   TEXT,                       -- iCal export URL from Airbnb listing
  vrbo_ical     TEXT,                       -- iCal export URL from VRBO listing
  price_cents   INTEGER NOT NULL            -- nightly rate in cents
);

CREATE TABLE IF NOT EXISTS bookings (
  id                       TEXT    PRIMARY KEY,
  property_id              TEXT    NOT NULL REFERENCES properties(id),
  guest_name               TEXT    NOT NULL,
  guest_email              TEXT    NOT NULL,
  check_in                 TEXT    NOT NULL,  -- YYYY-MM-DD
  check_out                TEXT    NOT NULL,  -- YYYY-MM-DD (exclusive, checkout day)
  nights                   INTEGER NOT NULL,
  total_cents              INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  status                   TEXT    NOT NULL DEFAULT 'pending',  -- pending | confirmed | cancelled
  created_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blocked_ranges (
  id           TEXT    PRIMARY KEY,
  property_id  TEXT    NOT NULL REFERENCES properties(id),
  start_date   TEXT    NOT NULL,  -- YYYY-MM-DD inclusive
  end_date     TEXT    NOT NULL,  -- YYYY-MM-DD exclusive (matches iCal DTEND semantics)
  source       TEXT    NOT NULL,  -- airbnb | vrbo
  external_uid TEXT,              -- iCal UID, used for upsert deduplication
  synced_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_dates
  ON bookings(property_id, check_in, check_out);

CREATE INDEX IF NOT EXISTS idx_blocked_dates
  ON blocked_ranges(property_id, start_date, end_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_uid
  ON blocked_ranges(property_id, source, external_uid)
  WHERE external_uid IS NOT NULL;
