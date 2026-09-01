import { AppSettings, Employee, Booking } from '../types';

const DAYS_MAP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Converts formatted Arabic/English time slot (e.g. "03:00 م", "10:30 ص", "15:00") into 24-hour minutes (0 - 1440)
 */
export function timeSlotToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  
  // Check if 24h format (e.g. "15:30")
  if (/^\d{1,2}:\d{2}$/.test(clean)) {
    const [h, m] = clean.split(':').map(Number);
    return h * 60 + m;
  }

  // 12-hour format with Arabic markers ("ص" = AM, "م" = PM)
  const isPM = clean.includes('م') || clean.toLowerCase().includes('pm');
  const isAM = clean.includes('ص') || clean.toLowerCase().includes('am');

  const numbers = clean.replace(/[^\d:]/g, '').split(':');
  if (numbers.length < 2) return 0;

  let hours = parseInt(numbers[0], 10);
  const minutes = parseInt(numbers[1], 10);

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Converts minutes (e.g. 630) to formatted Arabic 12-hour string (e.g. "10:30 ص" or "02:00 م")
 */
export function minutesToFormattedSlot(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  
  const isPM = hours24 >= 12;
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  
  const padH = hours12 < 10 ? `0${hours12}` : `${hours12}`;
  const padM = mins < 10 ? `0${mins}` : `${mins}`;
  const marker = isPM ? 'م' : 'ص';

  return `${padH}:${padM} ${marker}`;
}

/**
 * Generates available time slots dynamically from salon opening time to 1 hour before closing time.
 * Step interval is controlled by settings (e.g. every 60 mins if max capacity is 1, or every 30 mins if max capacity is 2).
 */
export function generateSalonTimeSlots(settings: AppSettings): string[] {
  const openingStr = settings.bookingRules?.openingTime || '10:00';
  const closingStr = settings.bookingRules?.closingTime || '23:00';

  const openingMin = timeSlotToMinutes(openingStr);
  const closingMin = timeSlotToMinutes(closingStr);

  // End slots 1 hour (60 minutes) before salon closing
  const endLimitMin = Math.max(openingMin, closingMin - 60);

  // Determine interval: 30 mins or 60 mins
  let interval = settings.bookingRules?.slotIntervalMinutes;
  if (!interval) {
    const maxPerStaff = settings.bookingRules?.maxBookingsPerHour || 1;
    interval = maxPerStaff === 1 ? 60 : 30;
  }

  const slots: string[] = [];
  for (let currentMin = openingMin; currentMin <= endLimitMin; currentMin += interval) {
    slots.push(minutesToFormattedSlot(currentMin));
  }

  // Fallback if empty
  if (slots.length === 0) {
    return [
      '10:00 ص', '11:00 ص', '12:00 م', '01:00 م', 
      '02:00 م', '03:00 م', '04:00 م', '05:00 م', 
      '06:00 م', '07:00 م', '08:00 م', '09:00 م', '10:00 م'
    ];
  }

  return slots;
}

/**
 * Checks if a specific entire date is blocked by administration
 */
export function isDateBlocked(dateStr: string, settings: AppSettings): boolean {
  if (!settings.bookingRules?.blockedDates) return false;
  return settings.bookingRules.blockedDates.some(b => b.date === dateStr);
}

/**
 * Checks if a specific time slot on a date is blocked by administration
 */
export function isHourBlocked(dateStr: string, timeSlot: string, settings: AppSettings): boolean {
  if (!settings.bookingRules?.blockedHours) return false;
  return settings.bookingRules.blockedHours.some(b => {
    if (b.date !== dateStr) return false;
    return b.time === timeSlot || timeSlotToMinutes(b.time) === timeSlotToMinutes(timeSlot);
  });
}

/**
 * Checks if an employee is working and available on a specific date:
 * 1. Checks administration date-specific unavailability overrides.
 * 2. Checks regular weekly days off (e.g. Friday), UNLESS attendance/check-in was recorded.
 */
export function isStaffAvailableOnDate(
  employee: Employee,
  dateStr: string,
  settings: AppSettings,
  hasAttendanceCheckIn: boolean = false
): { available: boolean; reason?: string } {
  // 1. Explicit admin block for this staff member on this date
  const staffBlock = settings.bookingRules?.staffUnavailabilities?.find(
    s => s.employeeId === employee.id && s.date === dateStr
  );
  if (staffBlock) {
    return { available: false, reason: staffBlock.reason || 'إجازة / غير متاح إدارياً' };
  }

  // 2. Check Blacklist or Terminated
  if (employee.isBlacklisted || employee.isActive === false || employee.endOfService) {
    return { available: false, reason: 'الموظف غير نشط' };
  }

  // 3. Weekly Day Off Check
  const d = new Date(dateStr);
  const dayName = DAYS_MAP[d.getDay()];
  const weeklyDaysOff = employee.weeklyDaysOff || ['Friday'];

  if (weeklyDaysOff.includes(dayName)) {
    // If there is an explicit attendance/fingerprint log or check-in, allow booking!
    if (hasAttendanceCheckIn) {
      return { available: true };
    }
    const dayLabel = dayName === 'Friday' ? 'الجمعة' : dayName === 'Saturday' ? 'السبت' : dayName === 'Sunday' ? 'الأحد' : dayName === 'Monday' ? 'الإثنين' : dayName === 'Tuesday' ? 'الثلاثاء' : dayName === 'Wednesday' ? 'الأربعاء' : 'الخميس';
    return { available: false, reason: `يوم إجازة أسبوعية للموظف (${dayLabel})` };
  }

  return { available: true };
}

/**
 * Checks if an employee's shift hours cover the requested time slot:
 * e.g. If staff shift is 15:00 - 23:00 (03:00 PM to 11:00 PM),
 * he is UNAVAILABLE before 15:00 (03:00 PM).
 */
export function isStaffAvailableAtTime(
  employee: Employee,
  timeSlot: string
): { available: boolean; reason?: string } {
  const slotMin = timeSlotToMinutes(timeSlot);

  // Parse employee shift start and end (defaults: 09:00 to 22:00)
  const shiftStartMin = timeSlotToMinutes(employee.checkInTime || '09:00');
  const shiftEndMin = timeSlotToMinutes(employee.checkOutTime || '22:00');

  if (shiftStartMin && slotMin < shiftStartMin) {
    return { 
      available: false, 
      reason: `دوام الموظف يبدأ الساعة ${employee.checkInTime || '09:00'}` 
    };
  }

  if (shiftEndMin && slotMin >= shiftEndMin) {
    return { 
      available: false, 
      reason: `دوام الموظف ينتهي الساعة ${employee.checkOutTime || '22:00'}` 
    };
  }

  return { available: true };
}

/**
 * Checks if a specific staff member is already booked on a date & slot,
 * respecting max bookings per staff per hour capacity (e.g. 1 per hour vs 2 per hour / every 30 mins).
 */
export function isStaffBookedAtSlot(
  staffId: string,
  dateStr: string,
  timeSlot: string,
  bookings: Booking[],
  settings: AppSettings,
  branchId?: string
): { isBooked: boolean; bookingCode?: string; clientName?: string } {
  const maxPerStaff = settings.bookingRules?.maxBookingsPerHour || 1;
  const slotMin = timeSlotToMinutes(timeSlot);

  const staffBookings = bookings.filter(b => {
    if (b.status === 'cancelled') return false;
    if (branchId && b.branchId && b.branchId !== branchId) return false;
    if (b.date !== dateStr) return false;
    return b.services?.some(s => s.technicianId === staffId);
  });

  if (maxPerStaff === 1) {
    // If capacity is 1 booking per hour, any booking within the 60-minute window (e.g. 14:00 - 14:59) blocks the staff
    const found = staffBookings.find(b => {
      const bMin = timeSlotToMinutes(b.time);
      return Math.abs(bMin - slotMin) < 60;
    });
    if (found) {
      return { isBooked: true, bookingCode: found.bookingCode, clientName: found.clientName };
    }
  } else {
    // Capacity 2 or interval matching exact slot
    const found = staffBookings.find(b => {
      return b.time === timeSlot || timeSlotToMinutes(b.time) === slotMin;
    });
    if (found) {
      return { isBooked: true, bookingCode: found.bookingCode, clientName: found.clientName };
    }
  }

  return { isBooked: false };
}
