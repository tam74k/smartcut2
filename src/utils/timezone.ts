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
 * Priority: Country Auto-Detection (from registered salon/branch country) > Explicit Timezone > LocalStorage > 'Asia/Riyadh'
 */
export function getSalonTimezone(
  settings?: { timezone?: string; country?: string; currency?: string } | null, 
  branch?: { timezone?: string; country?: string; currency?: string } | null
): string {
  // 1. تحديد المنطقة الزمنية المعتمدة وفقاً للدولة والعملة المسجلة في بيانات الفرع أو الصالون أولاً
  const country = (branch?.country || settings?.country || '').trim();
  const currency = (branch?.currency || settings?.currency || '').trim();
  if (country || currency) {
    const countryTz = getCountryTimeZone(country, currency);
    if (countryTz) return countryTz;
  }

  // 2. إذا تم تحديد حقل timezone صراحة في الفرع أو الإعدادات
  if (branch?.timezone && branch.timezone.trim()) {
    return branch.timezone.trim();
  }
  if (settings?.timezone && settings.timezone.trim()) {
    return settings.timezone.trim();
  }

  // 3. التحقق من التخزين المحلي (LocalStorage) كاحتياطي موثوق
  try {
    if (typeof window !== 'undefined') {
      const rawSettings = localStorage.getItem('smartcut_settings');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed.country || parsed.currency) {
          const cTz = getCountryTimeZone(parsed.country, parsed.currency);
          if (cTz) return cTz;
        }
        if (parsed.timezone && parsed.timezone.trim()) return parsed.timezone.trim();
      }
      const rawSalon = localStorage.getItem('smartcut_salon');
      if (rawSalon) {
        const parsed = JSON.parse(rawSalon);
        if (parsed.country || parsed.currency) {
          const cTz = getCountryTimeZone(parsed.country, parsed.currency);
          if (cTz) return cTz;
        }
        if (parsed.timezone && parsed.timezone.trim()) return parsed.timezone.trim();
      }
    }
  } catch (e) {}

  // 4. Fallback to client device timezone if detectable
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolved && resolved.trim()) return resolved.trim();
    }
  } catch (e) {}

  return 'Asia/Riyadh';
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

/**
 * Parse any date/time string stored in the database without unwanted timezone shifts.
 * Extracts the exact literal numbers (year, month, day, hour, minute, second) recorded in the DB,
 * preventing browser timezone conversion from shifting the time (e.g. from 12:02 to 14:02).
 */
export function parseDbDateTime(dateRaw?: string | Date | null): Date {
  if (!dateRaw) return new Date();
  if (dateRaw instanceof Date) return dateRaw;

  if (typeof dateRaw === 'string') {
    const trimmed = dateRaw.trim();
    if (!trimmed) return new Date();

    // Match: YYYY-MM-DD or YYYY/MM/DD followed by T or space, then HH:mm(:ss)?
    const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      const second = match[6] ? parseInt(match[6], 10) : 0;
      return new Date(year, month, day, hour, minute, second);
    }

    // Match date only: YYYY-MM-DD or YYYY/MM/DD
    const dateOnly = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (dateOnly) {
      const year = parseInt(dateOnly[1], 10);
      const month = parseInt(dateOnly[2], 10) - 1;
      const day = parseInt(dateOnly[3], 10);
      return new Date(year, month, day, 0, 0, 0);
    }
  }

  const fallback = new Date(dateRaw);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

function formatDateTimeWithTz(
  d: Date,
  timeZone: string,
  locale: string = 'ar-EG',
  options?: Intl.DateTimeFormatOptions
): string {
  if (options) {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(d);
  }

  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = dtf.formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;

  const year = m.year;
  const month = m.month;
  const day = m.day;
  const hourNum = parseInt(m.hour, 10);
  const minute = m.minute;
  const second = m.second || '00';

  const isPm = hourNum >= 12;
  const hour12 = hourNum === 0 ? 12 : (hourNum > 12 ? hourNum - 12 : hourNum);
  const period = isPm ? 'م' : 'ص';

  return `${year}/${month}/${day}, ${hour12}:${minute}:${second} ${period}`;
}

/**
 * Returns today's local date in user's current environment as "YYYY-MM-DD".
 */
export function getTodayLocalDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns current local time string as "HH:mm:ss" in user's device/salon wall clock.
 */
export function getCurrentLocalTimeStr(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Returns current local timestamp as "YYYY-MM-DDTHH:mm:ss" (without Z or UTC offsets),
 * respecting an optional baseDate (such as an open shift date or custom user date).
 */
export function getNowLocalDateTimeStr(baseDate?: string): string {
  const datePart = (baseDate && baseDate.trim()) ? baseDate.trim().split('T')[0] : getTodayLocalDateStr();
  const timePart = getCurrentLocalTimeStr();
  return `${datePart}T${timePart}`;
}

/**
 * Ensures any date/time string is normalized to local wall-clock timestamp "YYYY-MM-DDTHH:mm:ss" (without Z or UTC offsets).
 * If the input is in UTC (ends with 'Z' or '+00:00'), it is converted to salon/local wall-clock time.
 */
export function ensureLocalDateTimeStr(dateRaw?: string | Date | null, timeZone?: string): string {
  if (!dateRaw) return getNowLocalDateTimeStr();
  const effectiveTz = timeZone || getSalonTimezone();

  if (dateRaw instanceof Date) {
    if (isNaN(dateRaw.getTime())) return getNowLocalDateTimeStr();
    const local = utcToSalonLocal(dateRaw, effectiveTz);
    return `${local.dateStr}T${local.timeWithSeconds}`;
  }

  const trimmed = String(dateRaw).trim();
  if (!trimmed) return getNowLocalDateTimeStr();

  const hasTzOffset = trimmed.endsWith('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(trimmed);
  if (hasTzOffset) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const local = utcToSalonLocal(d, effectiveTz);
      return `${local.dateStr}T${local.timeWithSeconds}`;
    }
  }

  // Already a local naive timestamp (e.g. "2026-11-25T14:30:00" or "2026-11-25 14:30:00")
  if (trimmed.includes(' ') && !trimmed.includes('T')) {
    return trimmed.replace(' ', 'T');
  }
  return trimmed;
}

/**
 * Format invoice, transaction, advance, expense and receipt date & time.
 * Strictly formats according to the salon/local wall-clock time.
 * If the string has an explicit UTC/timezone indicator, converts it to salon timezone.
 * If naive, directly extracts exact wall-clock digits.
 */
export function formatInvoiceDateTimeDisplay(
  dateRaw?: string | Date | null,
  locale: string = 'ar-EG',
  options?: Intl.DateTimeFormatOptions,
  timeZone?: string
): string {
  if (!dateRaw) return '-';
  const effectiveTz = timeZone || getSalonTimezone();

  if (dateRaw instanceof Date) {
    if (isNaN(dateRaw.getTime())) return '-';
    return formatDateTimeWithTz(dateRaw, effectiveTz, locale, options);
  }

  if (typeof dateRaw === 'string') {
    const trimmed = dateRaw.trim();
    if (!trimmed) return '-';

    // 1. If explicit UTC indicator (Z or +00:00), convert to target salon timezone
    const hasTzOffset = trimmed.endsWith('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(trimmed);
    if (hasTzOffset) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return formatDateTimeWithTz(d, effectiveTz, locale, options);
      }
    }

    // 2. Extract exact literal digits: YYYY-MM-DD or YYYY/MM/DD followed by T or space, then HH:mm(:ss)?
    const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      const hourNum = parseInt(match[4], 10);
      const minute = match[5].padStart(2, '0');
      const second = match[6] ? match[6].padStart(2, '0') : '00';

      const isPm = hourNum >= 12;
      const hour12 = hourNum === 0 ? 12 : (hourNum > 12 ? hourNum - 12 : hourNum);
      const period = isPm ? 'م' : 'ص';

      if (!options) {
        return `${year}/${month}/${day}, ${hour12}:${minute}:${second} ${period}`;
      }
      const naiveDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hourNum, parseInt(minute, 10), parseInt(second, 10));
      return naiveDate.toLocaleString(locale, options);
    }
  }

  const d = parseDbDateTime(dateRaw);
  return d.toLocaleString(locale, options);
}

/**
 * Format shift date & time specifically for work_shifts table (opened_at, closed_at),
 * which are stored as true UTC ISO timestamps and must be converted to salon timezone.
 */
export function formatShiftDateTimeDisplay(
  dateRaw?: string | Date | null,
  locale: string = 'ar-EG',
  options?: Intl.DateTimeFormatOptions,
  timeZone?: string
): string {
  if (!dateRaw) return '-';
  const effectiveTz = timeZone || getSalonTimezone();

  if (dateRaw instanceof Date) {
    if (isNaN(dateRaw.getTime())) return '-';
    return formatDateTimeWithTz(dateRaw, effectiveTz, locale, options);
  }

  if (typeof dateRaw === 'string') {
    const trimmed = dateRaw.trim();
    if (!trimmed) return '-';

    const hasTzOffset = trimmed.endsWith('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(trimmed);
    if (hasTzOffset) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return formatDateTimeWithTz(d, effectiveTz, locale, options);
      }
    }
  }

  return formatInvoiceDateTimeDisplay(dateRaw, locale, options, timeZone);
}
