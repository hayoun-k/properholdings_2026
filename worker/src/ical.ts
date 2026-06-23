import type { ICalEvent } from './types';

// Unfolds RFC 5545 line continuations (lines starting with space/tab continue the previous line)
function unfold(raw: string): string {
  return raw.replace(/\r?\n[ \t]/g, '');
}

function parseDate(value: string): string {
  // Handles DATE (YYYYMMDD) and DATETIME (YYYYMMDDTHHmmssZ or local)
  const digits = value.replace(/[TZ]/g, '').slice(0, 8);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function parseICal(raw: string): ICalEvent[] {
  const lines = unfold(raw).split(/\r?\n/);
  const events: ICalEvent[] = [];

  let inEvent = false;
  let uid = '';
  let start = '';
  let end = '';

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      start = '';
      end = '';
      continue;
    }

    if (line === 'END:VEVENT') {
      inEvent = false;
      if (uid && start && end) {
        events.push({ uid, start, end });
      }
      continue;
    }

    if (!inEvent) continue;

    // Property name may have params: e.g. DTSTART;VALUE=DATE:20240301
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const name = line.slice(0, colonIdx).split(';')[0].toUpperCase();
    const value = line.slice(colonIdx + 1).trim();

    if (name === 'UID')     uid   = value;
    if (name === 'DTSTART') start = parseDate(value);
    if (name === 'DTEND')   end   = parseDate(value);
  }

  return events;
}
