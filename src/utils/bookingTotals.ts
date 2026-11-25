import { Booking } from '../types';

export function calculateServiceLineDiscount(s: any): number {
  const qty = Math.max(1, Number(s.quantity) || 1);
  const base = Number(s.price || 0) * qty;
  const val = Number(s.discountValue || 0);
  if (val <= 0) return 0;
  if (s.discountType === 'percentage') {
    return (base * Math.min(100, Math.max(0, val))) / 100;
  }
  return Math.min(base, Math.max(0, val));
}

// Calculate final price for a service line after its discount
export function calculateServiceLinePrice(s: any): number {
  const qty = Math.max(1, Number(s.quantity) || 1);
  const base = Number(s.price || 0) * qty;
  return Math.max(0, base - calculateServiceLineDiscount(s));
}

// Calculate comprehensive booking financial totals including item discounts and general discount
export function calculateBookingTotals(b: Partial<Booking>) {
  let rawServices = b?.services;
  if (typeof rawServices === 'string') {
    try { rawServices = JSON.parse(rawServices); } catch { rawServices = []; }
  }
  const services = Array.isArray(rawServices) ? rawServices : [];
  const grossServices = services.reduce((sum, s) => {
    const qty = Math.max(1, Number(s?.quantity) || 1);
    return sum + (Number(s?.price || 0) * qty);
  }, 0);
  const lineDiscounts = services.reduce((sum, s) => sum + (s ? calculateServiceLineDiscount(s) : 0), 0);
  const subtotalAfterLines = Math.max(0, grossServices - lineDiscounts);

  // قاعدة عدم الجمع بين خصمين: إذا وُجدت خصومات على بنود الخدمات، لا يُطبّق خصم الإجمالي
  let generalDiscount = 0;
  const genVal = Number(b?.discountValue || 0);
  if (lineDiscounts === 0 && genVal > 0) {
    if (b?.discountType === 'percentage') {
      generalDiscount = (grossServices * Math.min(100, Math.max(0, genVal))) / 100;
    } else {
      generalDiscount = Math.min(grossServices, Math.max(0, genVal));
    }
  }

  const totalDiscounts = lineDiscounts > 0 ? lineDiscounts : generalDiscount;
  const netTotal = Math.max(0, grossServices - totalDiscounts);

  let rawAdvances = b?.advancePayments || (b as any)?.advance_payments;
  if (typeof rawAdvances === 'string') {
    try { rawAdvances = JSON.parse(rawAdvances); } catch { rawAdvances = []; }
  }
  const advancesList = Array.isArray(rawAdvances) ? rawAdvances : [];
  const advances = advancesList.reduce((sum, a) => sum + Number(a?.amount || 0), 0);
  const remaining = Math.max(0, netTotal - advances);

  return {
    grossServices,
    lineDiscounts,
    subtotalAfterLines,
    generalDiscount,
    totalDiscounts,
    netTotal,
    advances,
    remaining
  };
}
