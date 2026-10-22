import { Treasury, Transaction } from '../types';

/**
 * Resolves the primary/main treasury from the list of treasuries.
 * Fallbacks safely to a default main treasury if none is explicitly configured.
 */
export function resolveMainTreasury(treasuries?: Treasury[]): Treasury {
  if (Array.isArray(treasuries) && treasuries.length > 0) {
    const mainByFlag = treasuries.find(t => t.isMain);
    if (mainByFlag) return mainByFlag;

    const mainById = treasuries.find(t => t.id === 'main');
    if (mainById) return mainById;

    const mainByName = treasuries.find(t => t.name?.includes('رئيسي') || t.name?.includes('الرئيسية'));
    if (mainByName) return mainByName;

    const nonCash = treasuries.find(t => t.id !== 'cash' && !t.name?.includes('كاش') && !t.name?.includes('درج'));
    if (nonCash) return { ...nonCash, isMain: true };
  }
  return { id: 'main', name: 'الخزنة الرئيسية', isMain: true };
}

/**
 * يحدد بشكل صارم وقطعي ومطلق الخزينة الوحيدة التي تنتمي إليها الحركة المالية
 * يمنع منعاً باتاً أي تداخل أو تسرب مالي بين الخزائن المختلفة
 */
export function getTransactionTargetTreasuryId(
  trx: Partial<Transaction> | any,
  treasuries: Treasury[] = []
): string {
  const mainTreasury = resolveMainTreasury(treasuries);
  const cashTreasury = treasuries.find(t => t.id === 'cash') || 
                       treasuries.find(t => t.name.includes('كاش') || t.name.includes('الدرج'));

  const raw = (
    trx?.treasury || 
    trx?.treasuryId || 
    trx?.treasury_id || 
    ''
  ).toString().trim();

  // 1. التطابق المباشر مع ID الخزينة
  const byId = treasuries.find(t => t.id === raw);
  if (byId) return byId.id;

  // 2. التطابق التام مع اسم الخزينة العربي أو الإنجليزي (مثل: "اورانج" أو "فودافون" أو "انستاباي")
  const byName = treasuries.find(t => t.name.trim() === raw || t.name.trim().toLowerCase() === raw.toLowerCase());
  if (byName) return byName.id;

  // 3. التحقق من treasuryName إذا كان مسجلاً صراحة مع الحركة
  const tName = (trx?.treasuryName || '').toString().trim();
  if (tName) {
    const byTName = treasuries.find(t => t.name.trim() === tName || t.id === tName);
    if (byTName) return byTName.id;
  }

  // 4. مرادفات الخزينة الرئيسية (تخص الخزينة الرئيسية فقط ولا تمس الكاش نهائياً)
  if (raw === 'main' || raw === 'الرئيسية' || raw === 'الخزنة الرئيسية' || raw === 'الخزينة الرئيسية') {
    return mainTreasury.id;
  }

  // 5. مرادفات كاش الدرج (تخص كاش الدرج فقط ولا تمس الخزينة الرئيسية نهائياً)
  if (raw === 'cash' || raw === 'كاش' || raw === 'درج' || raw === 'cash_drawer' || raw === 'نقدي') {
    if (cashTreasury) return cashTreasury.id;
    return mainTreasury.id;
  }

  // 6. مرادفات البطاقات والتحويلات المسجلة كمعرف للخزينة
  if (raw === 'card' || raw === 'mada' || raw === 'visa' || raw === 'شبكة' || raw === 'فيزا') {
    const cardT = treasuries.find(t => t.id === 'card' || t.name.includes('شبكة') || t.name.includes('فيزا') || t.name.includes('مدى'));
    if (cardT) return cardT.id;
  }

  if (raw === 'bank_transfer' || raw === 'transfer' || raw === 'تحويل بنكي' || raw === 'تحويل') {
    const transferT = treasuries.find(t => t.id === 'bank_transfer' || t.id === 'transfer' || t.name.includes('تحويل'));
    if (transferT) return transferT.id;
  }

  // 7. فقط إذا كان حقل treasury فارغاً تماماً في الحركة (حركات قديمة جداً بدون خزينة محددة)
  if (!raw) {
    const pMethod = (trx?.paymentMethod || trx?.payment_method || '').toString().trim();
    if (pMethod) {
      const pmTreasury = treasuries.find(t => t.id === pMethod || t.name.trim() === pMethod);
      if (pmTreasury) return pmTreasury.id;
      if (pMethod === 'cash' && cashTreasury) return cashTreasury.id;
      if (pMethod === 'card' || pMethod === 'mada' || pMethod === 'visa') {
        const cardT = treasuries.find(t => t.id === 'card' || t.name.includes('شبكة') || t.name.includes('فيزا'));
        if (cardT) return cardT.id;
      }
    }
    return cashTreasury ? cashTreasury.id : mainTreasury.id;
  }

  return raw;
}

/**
 * Normalizes treasury matching so aliases like 'cash', 'نقدي', 'كاش',
 * 'card', 'mada', 'visa', 'شبكة' match the appropriate target treasury ID.
 */
export function isMatchingTreasury(
  tId: string | undefined,
  targetId: string,
  allTreasuries?: Treasury[]
): boolean {
  if (!targetId) return false;
  const assigned = getTransactionTargetTreasuryId({ treasury: tId }, allTreasuries || []);
  return assigned === targetId;
}

/**
 * Resolves a human-readable label for a given treasury ID.
 */
export function getTreasuryLabel(tId: string | undefined, allTreasuries?: Treasury[]): string {
  if (!tId) {
    const cashT = (allTreasuries || []).find(t => t.id === 'cash');
    return cashT ? cashT.name : 'كاش (الدرج)';
  }
  const found = (allTreasuries || []).find(t => t.id === tId || t.name.trim() === tId.trim());
  if (found) return found.name;
  if (tId === 'cash') return 'كاش (الدرج)';
  if (tId === 'main') return 'الخزنة الرئيسية';
  if (tId === 'card' || tId === 'mada') return 'شبكة / مدى';
  if (tId === 'bank_transfer' || tId === 'transfer') return 'تحويل بنكي';
  return tId;
}
