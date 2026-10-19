// Low-precision positional astronomy for the observer at the Temple Mount.
// Pure functions (no three.js). Angles in degrees unless noted, times as UTC milliseconds.
//
//  * Sun: NOAA Solar Calculator algorithm (Meeus, "Astronomical Algorithms" ch. 25 low-accuracy series):
//    ~0.01° in position, < 1 min in event times for the 1st–21st centuries' dates we use.
//  * Moon: Meeus ch. 47 truncated to its largest periodic terms (≈0.05° in longitude), with topocentric
//    parallax (up to ~1° — significant) and refraction.
//  * Sidereal time: IAU 1982 GMST (Meeus 12.4).
//  * Planets: JPL "Approximate Positions of the Planets" (Standish), Keplerian elements valid 1800–2050.

export const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** The observer: the Temple Mount, Jerusalem. Israel Standard Time (UTC+2) all year — no DST (see docs). */
export const SITE_GEO = { lat: 31.7780, lon: 35.2354, tzMinutes: 120, elevationM: 740 };

const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) * RAD;
const acos = (x) => Math.acos(Math.max(-1, Math.min(1, x))) * RAD;
const atan2 = (y, x) => Math.atan2(y, x) * RAD;
export const norm360 = (d) => ((d % 360) + 360) % 360;

export function julianDay(ms) { return ms / 86400000 + 2440587.5; }
export function julianCentury(jd) { return (jd - 2451545) / 36525; }

// ---------------------------------------------------------------- Sun (NOAA)

/** Geocentric apparent solar coordinates for Julian century T. */
export function sunCoords(T) {
  const L0 = norm360(280.46646 + T * (36000.76983 + 0.0003032 * T));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
  const trueLong = L0 + C;
  const trueAnom = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cos(trueAnom)); // AU
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * sin(omega); // apparent longitude
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cos(omega);
  const decl = asin(sin(eps) * sin(lambda));
  const ra = norm360(atan2(cos(eps) * sin(lambda), cos(lambda)));
  const y = tan(eps / 2) ** 2;
  const eqTime = 4 * RAD * (y * Math.sin(2 * L0 * DEG) - 2 * e * Math.sin(M * DEG)
    + 4 * e * y * Math.sin(M * DEG) * Math.cos(2 * L0 * DEG)
    - 0.5 * y * y * Math.sin(4 * L0 * DEG) - 1.25 * e * e * Math.sin(2 * M * DEG)); // minutes
  return { lambda, decl, ra, eqTime, eps, R, L0, M };
}

/** NOAA approximate atmospheric refraction (degrees to ADD to the geometric altitude). */
export function refraction(alt) {
  if (alt > 85) return 0;
  const te = tan(alt);
  let arcsec;
  if (alt > 5) arcsec = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (alt > -0.575) arcsec = 1735 + alt * (-518.2 + alt * (103.4 + alt * (-12.79 + alt * 0.711)));
  else arcsec = -20.774 / te;
  return arcsec / 3600;
}

/** Horizontal coordinates from hour angle / declination (azimuth from north, clockwise). */
export function hadecToHorizontal(ha, dec, lat) {
  const altitude = asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(ha));
  const x = -cos(dec) * sin(ha);
  const y = sin(dec) * cos(lat) - cos(dec) * sin(lat) * cos(ha);
  return { altitude, azimuth: norm360(atan2(x, y)) };
}

/** Sun position at UTC ms for observer (lat, lon east+). altitude = geometric; apparentAltitude incl. refraction. */
export function solarPosition(ms, lat = SITE_GEO.lat, lon = SITE_GEO.lon) {
  const jd = julianDay(ms);
  const s = sunCoords(julianCentury(jd));
  const utcMin = ((ms / 60000) % 1440 + 1440) % 1440;
  const trueSolarTime = utcMin + s.eqTime + 4 * lon; // minutes
  const ha = trueSolarTime / 4 - 180;
  const { altitude, azimuth } = hadecToHorizontal(ha, s.decl, lat);
  return {
    altitude, apparentAltitude: altitude + refraction(altitude), azimuth,
    decl: s.decl, ra: s.ra, lambda: s.lambda, eqTime: s.eqTime, distanceAU: s.R, hourAngle: ha,
  };
}

/**
 * UTC minutes (from 00:00 UTC of the given UTC day) at which the sun's geometric altitude crosses `alt`
 * (rising = morning). NOAA iteration: hour angle from declination, then re-evaluate at the found time.
 * Returns NaN if the sun never reaches that altitude that day.
 */
export function sunEventUTC(dayStartMs, alt, rising, lat = SITE_GEO.lat, lon = SITE_GEO.lon) {
  let tUTC = rising ? 360 - 4 * lon : 1080 - 4 * lon; // first guess
  for (let i = 0; i < 4; i++) {
    const s = sunCoords(julianCentury(julianDay(dayStartMs + tUTC * 60000)));
    const zen = 90 - alt;
    const cosH = cos(zen) / (cos(lat) * cos(s.decl)) - tan(lat) * tan(s.decl);
    if (cosH < -1 || cosH > 1) return NaN;
    const H = acos(cosH) * (rising ? 1 : -1);
    tUTC = 720 - 4 * (lon + H) - s.eqTime;
  }
  return tUTC;
}

/** UTC minutes of solar transit (true noon). */
export function solarNoonUTC(dayStartMs, lon = SITE_GEO.lon) {
  let t = 720 - 4 * lon;
  for (let i = 0; i < 3; i++) {
    const s = sunCoords(julianCentury(julianDay(dayStartMs + t * 60000)));
    t = 720 - 4 * lon - s.eqTime;
  }
  return t;
}

// ---------------------------------------------------------------- sidereal time & frames

/** Greenwich mean sidereal time (degrees). */
export function gmst(jd) {
  const T = julianCentury(jd);
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Local sidereal time (degrees) for east longitude. */
export function localSiderealTime(ms, lon = SITE_GEO.lon) { return norm360(gmst(julianDay(ms)) + lon); }

/** Ecliptic (lambda, beta) -> equatorial (ra, dec), degrees. */
export function eclipticToEquatorial(lambda, beta, eps) {
  const ra = norm360(atan2(sin(lambda) * cos(eps) - tan(beta) * sin(eps), cos(lambda)));
  const dec = asin(sin(beta) * cos(eps) + cos(beta) * sin(eps) * sin(lambda));
  return { ra, dec };
}

/** Equatorial -> horizontal for local sidereal time. */
export function equatorialToHorizontal(ra, dec, lst, lat = SITE_GEO.lat) {
  return hadecToHorizontal(lst - ra, dec, lat);
}

// ---------------------------------------------------------------- Moon (Meeus ch. 47, truncated)

const EARTH_RADIUS_KM = 6378.14;
const MOON_RADIUS_KM = 1737.4;
const AU_KM = 149597870.7;

export function moonPosition(ms, lat = SITE_GEO.lat, lon = SITE_GEO.lon) {
  const jd = julianDay(ms);
  const T = julianCentury(jd);
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.2720950 + 483202.0175233 * T;
  const E = 1 - 0.002516 * T; // eccentricity factor for terms with M
  const lambda = norm360(Lp
    + 6.288774 * sin(Mp) + 1.274027 * sin(2 * D - Mp) + 0.658314 * sin(2 * D)
    + 0.213618 * sin(2 * Mp) - 0.185116 * E * sin(M) - 0.114332 * sin(2 * F)
    + 0.058793 * sin(2 * D - 2 * Mp) + 0.057066 * E * sin(2 * D - M - Mp)
    + 0.053322 * sin(2 * D + Mp) + 0.045758 * E * sin(2 * D - M)
    - 0.040923 * E * sin(M - Mp) - 0.034720 * sin(D) - 0.030383 * E * sin(M + Mp)
    + 0.015327 * sin(2 * D - 2 * F) - 0.012528 * sin(Mp + 2 * F) + 0.010980 * sin(Mp - 2 * F)
    + 0.010675 * sin(4 * D - Mp) + 0.010034 * sin(3 * Mp) + 0.008548 * sin(4 * D - 2 * Mp)
    - 0.007888 * E * sin(2 * D + M - Mp) - 0.006783 * E * sin(2 * D + M)
    + 0.005162 * sin(Mp - D) + 0.005000 * E * sin(M + D));
  const beta = 5.128122 * sin(F) + 0.280602 * sin(Mp + F) + 0.277693 * sin(Mp - F)
    + 0.173237 * sin(2 * D - F) + 0.055413 * sin(2 * D - Mp + F) + 0.046271 * sin(2 * D - Mp - F)
    + 0.032573 * sin(2 * D + F) + 0.017198 * sin(2 * Mp + F) + 0.009266 * sin(2 * D + Mp - F)
    + 0.008822 * sin(2 * Mp - F) + 0.008216 * E * sin(2 * D - M - F) + 0.004324 * sin(2 * D - 2 * Mp - F);
  const distanceKm = 385000.56 - 20905.355 * cos(Mp) - 3699.111 * cos(2 * D - Mp) - 2955.968 * cos(2 * D)
    - 569.925 * cos(2 * Mp) + 48.888 * E * cos(M) + 246.158 * cos(2 * D - 2 * Mp)
    - 205.962 * E * cos(2 * D - M) - 170.733 * cos(2 * D + Mp) - 152.138 * E * cos(2 * D - M - Mp);

  const sun = sunCoords(T);
  const { ra, dec } = eclipticToEquatorial(lambda, beta, sun.eps);
  const lst = localSiderealTime(ms, lon);
  const geo = equatorialToHorizontal(ra, dec, lst, lat);
  // topocentric parallax (altitude only; azimuth shift is negligible)
  const parallax = asin(EARTH_RADIUS_KM / distanceKm);
  const topoAlt = geo.altitude - parallax * cos(geo.altitude);
  const apparentAltitude = topoAlt + refraction(topoAlt);

  // illumination: geocentric elongation psi, phase angle i (Meeus 48.2–48.3)
  const psi = acos(cos(beta) * cos(lambda - sun.lambda));
  const sunKm = sun.R * AU_KM;
  const phaseAngle = norm360(atan2(sunKm * sin(psi), distanceKm - sunKm * cos(psi)));
  const illumination = (1 + cos(phaseAngle)) / 2;
  const phase = norm360(lambda - sun.lambda) / 360; // 0 new, .25 first quarter, .5 full, .75 last quarter

  return {
    altitude: apparentAltitude, trueAltitude: topoAlt, azimuth: geo.azimuth, ra, dec, lambda, beta,
    distanceKm, angularRadius: asin(MOON_RADIUS_KM / distanceKm), phase, illumination,
    phaseAngle: phaseAngle > 180 ? 360 - phaseAngle : phaseAngle, elongation: psi,
  };
}

/**
 * Lunar illuminance at the top of the atmosphere (lux) on a surface facing the Moon.
 * Allen's phase law: m = -12.73 + 0.026|i| + 4e-9 i^4 (full Moon at mean distance ≈ 0.27 lx), scaled by distance.
 */
export function moonIlluminanceTOA(phaseAngle, distanceKm) {
  const i = Math.abs(phaseAngle);
  const dm = 0.026 * i + 4e-9 * i ** 4;
  return 0.267 * 10 ** (-0.4 * dm) * (384400 / distanceKm) ** 2;
}

// ---------------------------------------------------------------- planets (JPL approximate elements)

// [a, e, I, L, longPeri, longNode] and per-century rates (J2000 ecliptic), Standish table 1 (1800–2050)
const ELEMENTS = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
};

function heliocentric(name, T) {
  const [el, rate] = ELEMENTS[name];
  const a = el[0] + rate[0] * T, e = el[1] + rate[1] * T, I = el[2] + rate[2] * T;
  const L = el[3] + rate[3] * T, wbar = el[4] + rate[4] * T, node = el[5] + rate[5] * T;
  const w = wbar - node;
  let M = norm360(L - wbar); if (M > 180) M -= 360;
  let Ecc = M + RAD * e * sin(M);
  for (let k = 0; k < 6; k++) {
    const dM = M - (Ecc - RAD * e * sin(Ecc));
    Ecc += dM / (1 - e * cos(Ecc));
  }
  const xp = a * (cos(Ecc) - e), yp = a * Math.sqrt(1 - e * e) * sin(Ecc);
  const cw = cos(w), sw = sin(w), cO = cos(node), sO = sin(node), cI = cos(I), sI = sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    (sw * sI) * xp + (cw * sI) * yp,
  ];
}

/** Bright planets: { name, ra, dec, altitude, azimuth, mag } (apparent altitude incl. refraction). */
export function planetPositions(ms, lat = SITE_GEO.lat, lon = SITE_GEO.lon) {
  const T = julianCentury(julianDay(ms));
  const eps = 23.43928 - 0.0130042 * T;
  const earth = heliocentric('earth', T);
  const lst = localSiderealTime(ms, lon);
  const out = [];
  for (const name of ['mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
    const p = heliocentric(name, T);
    const g = [p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]];
    const r = Math.hypot(...p), delta = Math.hypot(...g), R = Math.hypot(...earth);
    const lambda = norm360(atan2(g[1], g[0]));
    const beta = asin(g[2] / delta);
    const { ra, dec } = eclipticToEquatorial(lambda, beta, eps);
    const h = equatorialToHorizontal(ra, dec, lst, lat);
    const i = acos((r * r + delta * delta - R * R) / (2 * r * delta)); // phase angle
    const l5 = 5 * Math.log10(r * delta);
    const mag = {
      mercury: -0.42 + l5 + 0.0380 * i - 0.000273 * i * i + 2e-6 * i ** 3,
      venus: -4.40 + l5 + 0.0009 * i + 0.000239 * i * i - 6.5e-7 * i ** 3,
      mars: -1.52 + l5 + 0.016 * i,
      jupiter: -9.40 + l5 + 0.005 * i,
      saturn: -8.88 + l5 + 0.044 * i, // rings ignored (±0.5 mag)
    }[name];
    out.push({ name, ra, dec, altitude: h.altitude + refraction(h.altitude), azimuth: h.azimuth, mag, elongation: acos((R * R + delta * delta - r * r) / (2 * R * delta)) });
  }
  return out;
}
