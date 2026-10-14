import { Booking, HeldInvoice, CartItem, Client } from '../types';
import { DB } from './db';

/**
 * Creates or updates a Held Invoice (فاتورة معلقة) from a completed Booking
 * and saves it directly to MSSQL and local storage so it instantly appears
 * in the POS across all connected devices via SSE broadcast.
 */
export async function createHeldInvoiceFromBooking(
  booking: Booking,
  salonId?: string,
  branchId?: string,
  allClients?: Client[]
): Promise<HeldInvoice | null> {
  if (!booking) return null;

  const validSalonId = salonId || booking.salonId || '';
  const validBranchId = branchId || booking.branchId || '';

  // 1. Map booking services to CartItem[]
  let rawServices = booking.services;
  if (typeof rawServices === 'string') {
    try {
      rawServices = JSON.parse(rawServices);
    } catch {
      rawServices = [];
    }
  }
  if (!Array.isArray(rawServices)) rawServices = [];

  // Check discounts with strict mutual exclusivity
  const totalLineDiscounts = rawServices.reduce((sum: number, s: any) => sum + (Number(s.discount) || 0), 0);
  const hasLineDiscounts = totalLineDiscounts > 0;

  const rawOverallVal = Number(booking.discountValue) || 0;
  const hasOverallDiscount = !hasLineDiscounts && rawOverallVal > 0;

  // Invoice discount object to be passed to HeldInvoice (only for overall booking discount)
  let invoiceDiscount: { type: 'percentage' | 'fixed'; value: number } = { type: 'fixed', value: 0 };

  if (hasOverallDiscount) {
    invoiceDiscount = {
      type: booking.discountType || 'fixed',
      value: rawOverallVal
    };
  }

  const cart: CartItem[] = rawServices.map((s: any, idx: number) => {
    const isProduct = s.type === 'product';
    const origPrice = Number(s.price) || 0;
    const qty = Math.max(1, Number(s.quantity) || 1);
    const lineDiscount = hasLineDiscounts ? (Number(s.discount) || 0) : 0;
    const perUnitDiscount = lineDiscount > 0 ? lineDiscount / qty : 0;
    const effectivePrice = Math.max(0, origPrice - perUnitDiscount);

    const sId = s.serviceId || s.productId || s.id || `item-${idx}`;
    const sName = s.serviceName || s.productName || s.name || (isProduct ? 'منتج صالون' : 'خدمة صالون');
    const techId = (s.technicianId && s.technicianId !== 'any' && s.technicianId !== '-') ? s.technicianId : ((booking as any).employeeId || '');

    return {
      cartId: 'c_' + Math.random().toString(36).substring(2, 9),
      item: {
        id: sId,
        name: sName,
        price: effectivePrice,
        displayPrice: effectivePrice,
        categoryId: isProduct ? 'products' : 'services',
        isActive: true,
        type: isProduct ? 'product' : 'service',
        originalPrice: hasLineDiscounts && lineDiscount > 0 ? origPrice : undefined,
        discount: hasLineDiscounts && lineDiscount > 0 ? lineDiscount : undefined
      },
      quantity: qty,
      employeeId: techId,
      type: isProduct ? 'product' : 'service',
      price: effectivePrice,
      discount: hasLineDiscounts && lineDiscount > 0 ? lineDiscount : undefined,
      originalPrice: hasLineDiscounts && lineDiscount > 0 ? origPrice : undefined
    };
  });

  // 2. Client matching or fallback client object
  let clientObj: Client | null = null;
  if (allClients && allClients.length > 0 && booking.phone) {
    const cleanPhone = booking.phone.trim();
    clientObj = allClients.find(c => c.phone && c.phone.trim() === cleanPhone) || null;
  }
  if (!clientObj) {
    clientObj = {
      id: (booking as any).clientId || ('C-' + Math.random().toString(36).substr(2, 9).toUpperCase()),
      salonId: validSalonId,
      branchId: validBranchId,
      name: booking.clientName || 'عميل حجز',
      phone: booking.phone || '',
      totalVisits: 1,
      totalSpent: 0,
      points: 0,
      createdAt: new Date().toISOString()
    };
  }

  // 3. Calculate advance payment deduction
  let rawAdvances = booking.advancePayments;
  if (typeof rawAdvances === 'string') {
    try {
      rawAdvances = JSON.parse(rawAdvances);
    } catch {
      rawAdvances = [];
    }
  }
  if (!Array.isArray(rawAdvances)) rawAdvances = [];

  let advanceDeduction = rawAdvances.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  if (advanceDeduction === 0 && (booking as any).advancePayment) {
    const legacyAdv = Number((booking as any).advancePayment) || 0;
    if (legacyAdv > 0) {
      advanceDeduction = legacyAdv;
      rawAdvances = [{
        id: 'adv-' + booking.id,
        amount: legacyAdv,
        treasuryId: (booking as any).treasuryId || '',
        treasuryName: (booking as any).treasuryName || 'الخزينة',
        date: booking.date || new Date().toISOString().split('T')[0]
      }];
    }
  }

  // 4. Construct HeldInvoice with unique deterministic ID
  const now = new Date();
  const heldInvoiceId = 'HOLD-B-' + booking.id;

  const heldInvoice: HeldInvoice = {
    id: heldInvoiceId,
    salonId: validSalonId,
    branchId: validBranchId,
    heldAt: now.toISOString(),
    timeStr: now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    client: clientObj,
    clientSearch: `${clientObj.name} - ${clientObj.phone}`,
    cart,
    discount: invoiceDiscount,
    advanceDeduction,
    advancePayments: rawAdvances,
    bookingId: booking.id,
    queueNumber: booking.queueNumber,
    note: ''
  };

  // 5. Update local storage for POS on this machine
  try {
    const saved = localStorage.getItem('smartcut_held_invoices');
    const list: HeldInvoice[] = saved ? JSON.parse(saved) : [];
    const filtered = list.filter(h => h.id !== heldInvoiceId && h.bookingId !== booking.id);
    localStorage.setItem('smartcut_held_invoices', JSON.stringify([heldInvoice, ...filtered]));
  } catch (e) {
    console.warn('Failed to save held invoice to local storage:', e);
  }

  // 6. Save to DB (MSSQL) - this triggers the SSE broadcast event to all connected POS screens on LAN!
  try {
    await DB.saveHeldInvoice(heldInvoice);
  } catch (e) {
    console.error('Failed to save held invoice to DB:', e);
  }

  return heldInvoice;
}

/**
 * Marks a booking as completed in DB, updates its queue ticket if any,
 * and generates the Held Invoice for the POS with real-time SSE broadcast.
 */
export async function completeBookingAndCreateHeldInvoice(
  booking: Booking,
  salonId?: string,
  branchId?: string,
  allClients?: Client[]
): Promise<{ updatedBooking: Booking; heldInvoice: HeldInvoice | null }> {
  const updatedBooking: Booking = { ...booking, status: 'completed' };

  // 1. Update booking in DB
  try {
    await DB.patch('bookings', booking.id, { status: 'completed' });
  } catch (err) {
    console.warn('Failed to patch booking status to completed:', err);
  }

  // 2. Update matching queue ticket if exists
  try {
    const { QueueService } = await import('./queueService');
    await QueueService.updateTicket('QT-B-' + booking.id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  } catch (err) {}

  // 3. Create and broadcast the held invoice
  const heldInvoice = await createHeldInvoiceFromBooking(
    updatedBooking,
    salonId,
    branchId,
    allClients
  );

  return { updatedBooking, heldInvoice };
}
