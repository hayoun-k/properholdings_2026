import type { Env, Property } from './types';
import { parseICal } from './ical';

async function fetchICal(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'ProperHoldings/1.0' } });
  if (!res.ok) throw new Error(`iCal fetch failed: ${res.status} ${url}`);
  return res.text();
}

async function syncPropertySource(
  db: D1Database,
  propertyId: string,
  source: 'airbnb' | 'vrbo',
  icalUrl: string,
): Promise<void> {
  const raw = await fetchICal(icalUrl);
  const events = parseICal(raw);

  if (events.length === 0) return;

  // Upsert each event — the unique index on (property_id, source, external_uid) handles dedup
  const stmts = events.map((ev) =>
    db.prepare(
      `INSERT INTO blocked_ranges (id, property_id, start_date, end_date, source, external_uid, synced_at)
       VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (property_id, source, external_uid) DO UPDATE SET
         start_date = excluded.start_date,
         end_date   = excluded.end_date,
         synced_at  = excluded.synced_at`,
    ).bind(propertyId, ev.start, ev.end, source, ev.uid),
  );

  // D1 batch — max 100 at a time
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100));
  }

  // Remove stale entries for this source that were not seen in this sync
  const placeholders = events.map(() => '?').join(',');
  await db
    .prepare(
      `DELETE FROM blocked_ranges
       WHERE property_id = ? AND source = ? AND external_uid NOT IN (${placeholders})`,
    )
    .bind(propertyId, source, ...events.map((e) => e.uid))
    .run();
}

export async function syncCalendars(env: Env): Promise<void> {
  const { results } = await env.DB.prepare('SELECT * FROM properties').all<Property>();

  await Promise.allSettled(
    results.flatMap((prop) => [
      prop.airbnb_ical
        ? syncPropertySource(env.DB, prop.id, 'airbnb', prop.airbnb_ical)
        : null,
      prop.vrbo_ical
        ? syncPropertySource(env.DB, prop.id, 'vrbo', prop.vrbo_ical)
        : null,
    ]).filter(Boolean) as Promise<void>[],
  );
}
