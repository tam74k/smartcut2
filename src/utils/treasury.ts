import { Treasury } from '../types';

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
 * Normalizes treasury matching so aliases like 'cash', 'نقدي', 'كاش',
 * 'card', 'mada', 'visa', 'شبكة' match the appropriate target treasury ID.
 */
export function isMatchingTreasury(
  tId: string | undefined,
  targetId: string,
  allTreasuries?: Treasury[]
): boolean {
  // 1. Direct ID match
  if (tId && tId === targetId) return true;

  const treasuries = allTreasuries || [];
  const hasCashTreasury = treasuries.some(t => t.id === 'cash');
  const hasMainTreasury = treasuries.some(t => t.id === 'main' || t.isMain);

  // 2. Handling undefined or empty treasury ID
  if (!tId) {
    if (hasCashTreasury) {
      return targetId === 'cash';
    }
    if (hasMainTreasury) {
      const mainObj = treasuries.find(t => t.id === targetId && (t.isMain || t.id === 'main'));
      return Boolean(mainObj);
    }
    return targetId === treasuries[0]?.id || targetId === 'cash';
  }

  // 3. Normalized cash aliases
  if (tId === 'cash' || tId === 'نقدي' || tId === 'كاش' || tId === 'cash_drawer' || tId === 'درج') {
    if (targetId === 'cash') return true;
    if (!hasCashTreasury && (targetId === 'main' || treasuries.find(t => t.id === targetId)?.isMain)) {
      return true;
    }
    return false;
  }

  // 4. Normalized main treasury aliases
  if (tId === 'main' || tId === 'الرئيسية' || tId === 'الخزنة الرئيسية') {
    if (targetId === 'main') return true;
    const targetObj = treasuries.find(t => t.id === targetId);
    if (targetObj?.isMain && !hasCashTreasury) return true;
    return Boolean(targetObj?.isMain && targetId !== 'cash');
  }

  // 5. Normalized card aliases
  if (targetId === 'card') {
    return (
      tId === 'card' ||
      tId === 'mada' ||
      tId === 'visa' ||
      tId === 'mastercard' ||
      tId === 'شبكة' ||
      tId === 'شبكة / مدى' ||
      tId === 'بطاقة' ||
      tId === 'فيزا'
    );
  }

  // 6. Normalized bank transfer aliases
  if (targetId === 'bank_transfer' || targetId === 'transfer') {
    return (
      tId === 'bank_transfer' ||
      tId === 'transfer' ||
      tId === 'bank' ||
      tId === 'تحويل بنكي' ||
      tId === 'تحويل'
    );
  }

  return false;
}

/**
 * Resolves a human-readable label for a given treasury ID.
 */
export function getTreasuryLabel(tId: string | undefined, allTreasuries?: Treasury[]): string {
  if (!tId) {
    const cashT = (allTreasuries || []).find(t => t.id === 'cash');
    return cashT ? cashT.name : 'كاش (الدرج)';
  }
  const found = (allTreasuries || []).find(t => t.id === tId);
  if (found) return found.name;
  if (tId === 'cash') return 'كاش (الدرج)';
  if (tId === 'main') return 'الخزنة الرئيسية';
  if (tId === 'card' || tId === 'mada') return 'شبكة / مدى';
  if (tId === 'bank_transfer' || tId === 'transfer') return 'تحويل بنكي';
  return tId;
}
