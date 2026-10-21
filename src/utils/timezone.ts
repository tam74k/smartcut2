/**
 * Smart Cut Multi-Tenant Timezone Utility Engine
 * ===============================================
 * Provides strict timezone-aware date/time handling across all operations.
 * Bypasses local browser/device timezone offsets and guarantees all operations
 * conform strictly to the physical IANA timezone of the Salon or Branch.
 */

import { getCountryTimeZone } from './excelHelper';

/**
 * Returns the effective IANA timezone for a Salon / Branch.
 * Priority: Branch Timezone > Salon Settings Timezone > Country Auto-Detection > 'Asia/Riyadh'
 */
export function getSalonTimezone(settings?: { timezone?: string; country?: string; currency?: string } | null, branch?: { timezone?: string; country?: string; currency?: string } | null): string {
  if (branch?.timezone && branch.timezone.trim()) {
    return branch.timezone.trim();
  }
  if (settings?.timezone && settings.timezone.trim()) {
    return settings.timezone.trim();
  }
  return getCountryTimeZone(branch?.country || settings?.country, branch?.currency || settings?.currency);
}

/**
 * Convert Local Salon Wall-Clock (Date + Time) -> Strict UTC ISO String.
 * Ignores user's device/browser timezone.
 *
 * Example:
 *   localDate: "2026-10-21"
 *   localTime: "14:30"
 *   timeZone:  "Asia/Riyadh" (UTC+3)
 *   Returns:   "2026-10-21T11:30:00.000Z"
 */
export function localSalonTimeToUtcIso(
  localDateStr: string, // "YYYY-MM-DD"
  localTimeStr: string, // "HH:mm" or "HH:mm:ss"
  timeZone: string = 'Asia/Riyadh'
): string {
  if (!localDateStr) return new Date().toISOString();
  
  const cleanDate = localDateStr.split('T')[0].trim();
  const [year, month, day] = cleanDate.split('-').map(Number);
  const timeParts = (localTimeStr || '10:00').split(':').map(Number);
  const hour = timeParts[0] || 0;
  const minute = timeParts[1] || 0;
  const second = timeParts[2] || 0;

  // 1. Initial naive UTC epoch
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  // 2. Intl Formatter configured to the target IANA timezone
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const getTzEpoch = (ms: number): number => {
    const parts = dtf.formatToParts(new Date(ms));
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    const h = parseInt(map.hour, 10) === 24 ? 0 : parseInt(map.hour, 10);
    return Date.UTC(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      h,
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    );
  };

  // 3. Offset calculation including DST
  const tzEpoch = getTzEpoch(naiveUtcMs);
  const offset = tzEpoch - naiveUtcMs;
  const targetUtcMs = naiveUtcMs - offset;

  // 4. Refinement pass for DST boundary hour transitions
  const finalTzEpoch = getTzEpoch(targetUtcMs);
  const delta = finalTzEpoch - naiveUtcMs;
  const exactUtcMs = targetUtcMs - delta;

  return new Date(exactUtcMs).toISOString();
}

/**
 * Convert UTC ISO string (or Date object) -> Salon Wall-Clock Components & Formatted Strings.
 * Forces rendering strictly in the Salon's IANA timezone regardless of the user's browser.
 *
 * Example:
 *   utcIsoStr: "2026-10-21T11:30:00.000Z"
 *   timeZone:  "Asia/Riyadh"
 *   Returns:
 *     dateStr: "2026-10-21"
 *     timeStr: "14:30"
 *     formatted12h: "02:30 PM"
 *     formattedArabic: "02:30 م"
 */
export function utcToSalonLocal(
  utcIsoOrDate: string | Date,
  timeZone: string = 'Asia/Riyadh'
): {
  dateStr: string; // "YYYY-MM-DD"
  timeStr: string; // "HH:mm" (24h)
  timeWithSeconds: string; // "HH:mm:ss"
  formatted12h: string; // "02:30 PM"
  formattedArabic: string; // "02:30 م"
  fullDisplay: string; // "2026-10-21 02:30 م"
} {
  const dateObj = typeof utcIsoOrDate === 'string' ? new Date(utcIsoOrDate) : utcIsoOrDate;
  if (!dateObj || isNaN(dateObj.getTime())) {
    return {
      dateStr: '',
      timeStr: '',
      timeWithSeconds: '',
      formatted12h: '',
      formattedArabic: '',
      fullDisplay: '',
    };
  }

  // 1. ISO-compatible date parts using 'en-CA' (outputs YYYY-MM-DD)
  const dtfIso = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtfIso.formatToParts(dateObj);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;
  const timeWithSeconds = `${map.hour}:${map.minute}:${map.second}`;

  // 2. 12-hour English format
  const dtf12h = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const formatted12h = dtf12h.format(dateObj);

  // 3. 12-hour Arabic format
  const dtfAr = new Intl.DateTimeFormat('ar-SA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const formattedArabic = dtfAr.format(dateObj);

  return {
    dateStr,
    timeStr,
    timeWithSeconds,
    formatted12h,
    formattedArabic,
    fullDisplay: `${dateStr} ${formattedArabic}`,
  };
}

/**
 * Calculate the exact Start and End of a given date within the Salon's Timezone as UTC bounds.
 * Essential for Supabase day-range queries (gte startUtc, lte endUtc).
 *
 * Example:
 *   targetDate: "2026-10-21"
 *   timeZone:   "Asia/Riyadh" (UTC+3)
 *   Returns:
 *     startUtc: "2026-10-20T21:00:00.000Z" (00:00:00 in Riyadh)
 *     endUtc:   "2026-10-21T20:59:59.999Z" (23:59:59 in Riyadh)
 */
export function getSalonDayBoundsUTC(
  salonDateStr: string, // "YYYY-MM-DD"
  timeZone: string = 'Asia/Riyadh'
): {
  startUtc: string;
  endUtc: string;
} {
  const startUtc = localSalonTimeToUtcIso(salonDateStr, '00:00:00', timeZone);
  const endUtc = localSalonTimeToUtcIso(salonDateStr, '23:59:59', timeZone);
  return { startUtc, endUtc };
}

/**
 * Returns current Date & Time explicitly inside the Salon's physical timezone.
 */
export function getSalonNow(timeZone: string = 'Asia/Riyadh'): {
  todayStr: string; // "YYYY-MM-DD"
  timeStr: string;  // "HH:mm"
  timeWithSeconds: string; // "HH:mm:ss"
  isoUtc: string;   // Current UTC ISO
} {
  const now = new Date();
  const local = utcToSalonLocal(now, timeZone);
  return {
    todayStr: local.dateStr,
    timeStr: local.timeStr,
    timeWithSeconds: local.timeWithSeconds,
    isoUtc: now.toISOString(),
  };
}

/**
 * Human-readable localized formatting in Salon timezone.
 */
export function formatSalonDateTime(
  dateOrIso: string | Date | undefined,
  timeZone: string = 'Asia/Riyadh',
  locale: 'ar' | 'en' = 'ar'
): string {
  if (!dateOrIso) return '-';
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return String(dateOrIso);

  const loc = locale === 'ar' ? 'ar-SA' : 'en-US';
  const dtf = new Intl.DateTimeFormat(loc, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return dtf.format(d);
}
