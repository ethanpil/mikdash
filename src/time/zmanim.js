// Zmanim (GRA seasonal hours) for one civil date at the Temple Mount, plus the Hebrew date.
// All times are minutes after local midnight, Israel Standard Time (UTC+2, no DST).
import { sunEventUTC, SITE_GEO } from './astro.js';

/** Solar depression angles used for each zman (degrees of geometric altitude). */
export const ZMAN_ANGLES = {
  alot: -16.1,      // "amud hashachar" ≈ 72 equinoctial minutes before sunrise in Jerusalem at the equinox
  sunrise: -0.833,  // sea-level visible sunrise: refraction 34' + solar semi-diameter 16'
  sunset: -0.833,
  tzeit: -8.5,      // three medium stars
};

/** Local-midnight (IST) epoch in UTC ms for a civil date. */
export function localMidnightUTC({ y, m, d }, tz = SITE_GEO.tzMinutes) {
  return Date.UTC(y, m - 1, d) - tz * 60000;
}

/**
 * Compute the zmanim for a date. Seasonal hours per the GRA: day = sunrise→sunset; night = sunset→sunrise.
 * Because the simulated clock wraps on a fixed date, the night is the complement of that date's day
 * (1440 − day length) so evening and pre-dawn hours join seamlessly across midnight (error < 1 min).
 */
export function computeZmanim(date, geo = SITE_GEO) {
  const dayUTC = Date.UTC(date.y, date.m - 1, date.d);
  const tz = geo.tzMinutes;
  const ev = (alt, rising) => sunEventUTC(dayUTC, alt, rising, geo.lat, geo.lon) + tz;
  const sunrise = ev(ZMAN_ANGLES.sunrise, true);
  const sunset = ev(ZMAN_ANGLES.sunset, false);
  const alot = ev(ZMAN_ANGLES.alot, true);
  const tzeit = ev(ZMAN_ANGLES.tzeit, false);
  const shaahDay = (sunset - sunrise) / 12;
  const shaahNight = (1440 - (sunset - sunrise)) / 12;
  const at = (h) => sunrise + h * shaahDay;
  return {
    alot,
    sunrise,
    sofZmanShma: at(3),
    sofZmanTefillah: at(4),
    chatzot: at(6),
    minchaGedola: at(6.5),
    minchaKetana: at(9.5),
    plagHamincha: at(10.75),
    sunset,
    tzeit,
    midnight: (sunset + 6 * shaahNight) % 1440,
    shaahDay,
    shaahNight,
  };
}

// ---------------------------------------------------------------- Hebrew date (Intl, calendar 'hebrew')

const MONTH_NUM = { // biblical numbering (Nisan = 1); Adar I = 12, Adar II = 13 in leap years
  Nisan: 1, Iyar: 2, Sivan: 3, Tamuz: 4, Av: 5, Elul: 6, Tishri: 7, Heshvan: 8, Kislev: 9, Tevet: 10,
  Shevat: 11, Adar: 12, 'Adar I': 12, 'Adar II': 13,
};

const HEB_ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const HEB_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HEB_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

/** Hebrew numerals with geresh/gershayim (15 = ט״ו, 16 = ט״ז). */
export function gematria(n) {
  let s = HEB_HUNDREDS[Math.floor(n / 100) % 10];
  const r = n % 100;
  if (r === 15) s += 'טו';
  else if (r === 16) s += 'טז';
  else s += HEB_TENS[Math.floor(r / 10)] + HEB_ONES[r % 10];
  return s.length > 1 ? `${s.slice(0, -1)}״${s.slice(-1)}` : `${s}׳`;
}

let fmtEn = null;
let fmtHe = null;

/** Hebrew calendar date of a civil date (the daytime of that date). */
export function hebrewDate({ y, m, d }) {
  try {
    fmtEn ||= new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
    fmtHe ||= new Intl.DateTimeFormat('he-u-ca-hebrew', { timeZone: 'UTC', month: 'long' });
    const at = new Date(Date.UTC(y, m - 1, d, 12));
    const parts = Object.fromEntries(fmtEn.formatToParts(at).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
    const day = parseInt(parts.day, 10);
    const year = parseInt(parts.year, 10);
    const monthName = parts.month;
    const monthHe = fmtHe.format(at);
    return {
      day, month: MONTH_NUM[monthName] ?? 0, monthName, year,
      he: `${gematria(day)} ב${monthHe} ${gematria(year % 1000)}`,
      en: `${day} ${monthName} ${year}`,
    };
  } catch {
    return { day: 0, month: 0, monthName: '', year: 0, he: '', en: '' };
  }
}
