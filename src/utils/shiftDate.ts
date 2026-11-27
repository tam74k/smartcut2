/**
 * Utility to ensure all invoices, expenses, advances, bookings, movements,
 * and financial transactions use the accounting date of the open shift.
 */

export function getActiveShiftDate(shiftData?: { isOpen: boolean; date: string }, fallbackBranchId?: string): string | null {
  if (shiftData && shiftData.isOpen && shiftData.date) {
    return shiftData.date;
  }
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('smartcut_work_shifts_state') : null;
    if (raw) {
      const branchShifts = JSON.parse(raw);
      if (fallbackBranchId) {
        if (branchShifts[fallbackBranchId]?.isOpen && branchShifts[fallbackBranchId]?.date) {
          return branchShifts[fallbackBranchId].date;
        }
        if (fallbackBranchId === 'b-main' && branchShifts['b-main']?.isOpen && branchShifts['b-main']?.date) {
          return branchShifts['b-main'].date;
        }
        return null;
      }
      if (branchShifts['b-main']?.isOpen && branchShifts['b-main']?.date) {
        return branchShifts['b-main'].date;
      }
    }
  } catch (e) {}
  return null;
}

export function getEffectiveDateTime(shiftData?: { isOpen: boolean; date: string }, fallbackBranchId?: string): string {
  const shiftDate = getActiveShiftDate(shiftData, fallbackBranchId);
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;
  if (shiftDate) {
    return shiftDate + 'T' + timeStr;
  }
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  return `${localYear}-${localMonth}-${localDay}T${timeStr}`;
}

export function getEffectiveDateOnly(shiftData?: { isOpen: boolean; date: string }, fallbackBranchId?: string): string {
  const shiftDate = getActiveShiftDate(shiftData, fallbackBranchId);
  if (shiftDate) {
    return shiftDate;
  }
  const now = new Date();
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  return localYear + '-' + localMonth + '-' + localDay;
}