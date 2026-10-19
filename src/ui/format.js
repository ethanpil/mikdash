// Formatting helpers: civil clock, seasonal hours (sha'ot zmaniyot, GRA), Hebrew numerals, dates.

export const wrap = (t) => ((t % 1440) + 1440) % 1440;
const pad2 = (n) => String(n).padStart(2, '0');

/** minutes → "HH:MM" (Israel Standard Time) */
export function clock(t) {
  if (!Number.isFinite(t)) return '--:--';
  const m = Math.round(wrap(t)) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function ordinal(n) {
  const s = (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${s}`;
}

const HE_ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const HE_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
/** 1..99 → Hebrew numeral with geresh / gershayim (15 = ט״ו, 16 = ט״ז) */
export function heNum(n) {
  n = Math.round(n);
  if (!(n > 0 && n < 100)) return String(n);
  let s;
  if (n === 15) s = 'טו';
  else if (n === 16) s = 'טז';
  else s = HE_TENS[Math.floor(n / 10)] + HE_ONES[n % 10];
  return s.length === 1 ? `${s}׳` : `${s.slice(0, -1)}״${s.slice(-1)}`;
}

/** 10.74 → "10¾" (nearest quarter) */
export function quarters(x) {
  const q = Math.round(x * 4);
  const whole = Math.floor(q / 4);
  const f = ['', '¼', '½', '¾'][q % 4];
  return whole === 0 && f ? f : `${whole}${f}`;
}

/**
 * Seasonal position of t. s ∈ [0, 24): 0 = sunrise, 6 = midday, 12 = sunset, 18 = midnight.
 * Returns { half, elapsed (hours since sunrise/sunset), hour (1..12, the current hour), frac (within it), s, lenMin }.
 */
export function seasonal(time, t = time?.t) {
  const z = time?.zmanim;
  if (!z || !Number.isFinite(t)) return null;
  const tt = wrap(t);
  const day = tt >= z.sunrise && tt < z.sunset;
  const elapsed = day ? (tt - z.sunrise) / z.shaahDay : wrap(tt - z.sunset) / z.shaahNight;
  const hour = Math.min(12, Math.floor(elapsed) + 1);
  return {
    half: day ? 'day' : 'night',
    elapsed,
    hour,
    frac: elapsed - (hour - 1),
    s: day ? elapsed : 12 + elapsed,
    lenMin: day ? z.shaahDay : z.shaahNight,
  };
}

/** dial position s (0..24) → t, via ctx.time.fromZmani */
export function fromDial(time, s) {
  s = ((s % 24) + 24) % 24;
  return s < 12 ? time.fromZmani('day', s) : time.fromZmani('night', s - 12);
}

export function seasonalLabel(info, { long = false } = {}) {
  if (!info) return '';
  const half = info.half === 'day' ? 'Day' : 'Night';
  return long ? `${ordinal(info.hour)} hour of the ${info.half}` : `${half} · hour ${info.hour} of 12`;
}

export function seasonalLabelHe(info) {
  if (!info) return '';
  return `שעה ${heNum(info.hour)} ${info.half === 'day' ? 'ביום' : 'בלילה'}`;
}

/** an event time as a seasonal reference, e.g. "day 8½" */
export function seasonalShort(time, t) {
  const i = seasonal(time, t);
  if (!i) return '';
  return `${i.half} ${quarters(i.elapsed)}`;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbat'];
export const WEEKDAYS_HE = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
/** The Levites' psalm of the day (Tamid 7:4) */
export const PSALM_OF_DAY = [24, 48, 82, 94, 81, 93, 92];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_FIX = { Tishri: 'Tishrei', Heshvan: 'Cheshvan', Tamuz: 'Tammuz' };

export function hebrewMonthEn(name) { return MONTH_FIX[name] || name || ''; }

/** the Hebrew date in force at t (the day begins at sunset) */
export function hebrewAt(time, t = time?.t) {
  const h = time?.hebrewAt ? time.hebrewAt(t) : time?.hebrew;
  if (!h) return null;
  return { ...h, monthEn: hebrewMonthEn(h.monthName), en: h.day ? `${h.day} ${hebrewMonthEn(h.monthName)} ${h.year}` : '' };
}

export function civilDate(time) {
  const d = time?.date;
  if (!d) return '';
  return `${WEEKDAYS[time.weekday] === 'Shabbat' ? 'Saturday' : WEEKDAYS[time.weekday]}, ${d.d} ${MONTHS_EN[d.m - 1]} ${d.y}`;
}

/** "Mon 2 Nov" */
export function civilShort(time) {
  const d = time?.date;
  if (!d) return '';
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][time.weekday]} ${d.d} ${MONTHS_EN[d.m - 1].slice(0, 3)}`;
}

export const DAY_TYPE_LABEL ={ weekday: 'Weekday', friday: 'Erev Shabbat', shabbat: 'Shabbat' };

/** shift a YYYY-MM-DD string by n days */
export function addDays(dateString, n) {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** prettify a zone id: 'har-habayit' → 'Har Habayit' */
export function prettyId(id) {
  return String(id || '').split(/[-_.]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/**
 * The lead of a zone's `access` text: its first sentence, or the first two when the first is only a terse heading
 * ("Kohanim.", "As the court.") — the zone content puts the substance in the sentence after it.
 */
export function accessLead(text) {
  const t = String(text || '').trim();
  const sentences = t.match(/[^.]*?\.(?=\s|$)|[^.]+$/g) || [];
  let out = '';
  for (const s of sentences.slice(0, 2)) {
    out = `${out} ${s.trim()}`.trim();
    if (out.length >= 40) break;
  }
  return out || t;
}

