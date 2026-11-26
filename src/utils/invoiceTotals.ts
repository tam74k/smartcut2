import { Invoice } from '../types';

/**
 * Calculates effective line-item discounts across an invoice's items.
 */
export function calculateInvoiceLineDiscounts(items?: any[]): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  let total = 0;
  for (const item of items) {
    if (!item) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const itemPrice = Number(item.price) || 0;
    const explicitDisc = Number(item.discount || item.discountAmount || 0);
    const itemOrig = (item.originalPrice !== undefined && Number(item.originalPrice) > itemPrice)
      ? Number(item.originalPrice)
      : (explicitDisc > 0 ? itemPrice + explicitDisc : itemPrice);
    const diff = itemOrig > itemPrice ? itemOrig - itemPrice : 0;
    const lineDisc = Math.max(explicitDisc, diff);
    total += lineDisc * qty;
  }
  return total;
}

/**
 * Calculates total gross subtotal before any discounts across an invoice's items.
 */
export function calculateInvoiceGrossSubtotal(items?: any[]): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  let gross = 0;
  for (const item of items) {
    if (!item) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const itemPrice = Number(item.price) || 0;
    const explicitDisc = Number(item.discount || item.discountAmount || 0);
    const itemOrig = (item.originalPrice !== undefined && Number(item.originalPrice) > itemPrice)
      ? Number(item.originalPrice)
      : (explicitDisc > 0 ? itemPrice + explicitDisc : itemPrice);
    gross += itemOrig * qty;
  }
  return gross;
}

/**
 * Calculates total effective discount of an invoice.
 * Combines header discount, promo discount, and line item discounts,
 * preventing double counting if header discount was already set to match line discounts.
 */
export function getEffectiveInvoiceDiscount(inv?: Invoice | any): number {
  if (!inv) return 0;
  const headerDiscount = Number(inv.discount || 0);
  const promoDiscount = Number(inv.promoDiscount || 0);
  const lineDiscounts = calculateInvoiceLineDiscounts(inv.items);

  if (headerDiscount > 0 && lineDiscounts > 0) {
    if (Math.abs(headerDiscount - lineDiscounts) < 0.01) {
      return headerDiscount;
    }
    return headerDiscount + lineDiscounts;
  }

  const baseDisc = headerDiscount > 0 ? headerDiscount : lineDiscounts;
  return baseDisc + (promoDiscount > 0 && promoDiscount !== baseDisc ? promoDiscount : 0);
}

/**
 * Returns effective subtotal before discount.
 */
export function getEffectiveInvoiceSubtotal(inv?: Invoice | any): number {
  if (!inv) return 0;
  const grossFromItems = calculateInvoiceGrossSubtotal(inv.items);
  if (grossFromItems > 0) return grossFromItems;
  const effDiscount = getEffectiveInvoiceDiscount(inv);
  const total = Number(inv.total || 0);
  const subtotal = Number(inv.subtotal || 0);
  if (subtotal > 0 && subtotal >= total + effDiscount) return subtotal;
  return Math.max(subtotal, total + effDiscount);
}
