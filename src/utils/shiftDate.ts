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
      if (fallbackBranchId && branchShifts[fallbackBranchId]?.isOpen && branchShifts[fallbackBranchId]?.date) {
        return branchShifts[fallbackBranchId].date;
      }
      const openShift = Object.values(branchShifts).find((s: any) => s && s.isOpen && s.date) as any;
      if (openShift && openShift.date) {
        return openShift.date;
      }
    }
  } catch (e) {}
  return null;
}

export function getEffectiveDateTime(shiftData?: { isOpen: boolean; date: string }, fallbackBranchId?: string): string {
  const shiftDate = getActiveShiftDate(shiftData, fallbackBranchId);
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  if (shiftDate) {
    return shiftDate + 'T' + timeStr;
  }
  return now.toISOString();
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