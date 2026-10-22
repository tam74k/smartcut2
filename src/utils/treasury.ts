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
  if (!targetId) return false;

  // 1. Direct ID match
  if (tId && tId === targetId) return true;

  const treasuries = allTreasuries || [];
  const targetObj = treasuries.find(t => t.id === targetId || t.name === targetId);
  const sourceObj = tId ? treasuries.find(t => t.id === tId || t.name === tId) : undefined;

  // 2. Both resolve to the exact same configured treasury
  if (targetObj && sourceObj && targetObj.id === sourceObj.id) return true;

  // 3. Match by name or ID (case & whitespace insensitive)
  if (targetObj && tId) {
    const cleanT = tId.trim();
    if (cleanT === targetObj.name.trim() || cleanT.toLowerCase() === targetObj.id.toLowerCase()) {
      return true;
    }
  }

  const hasCashTreasury = treasuries.some(t => t.id === 'cash');
  const hasMainTreasury = treasuries.some(t => t.id === 'main' || t.isMain);

  // 4. Handling undefined or empty treasury ID
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

  // 5. Normalized cash aliases
  if (tId === 'cash' || tId === 'نقدي' || tId === 'كاش' || tId === 'cash_drawer' || tId === 'درج') {
    if (targetId === 'cash') return true;
    if (targetObj?.name?.includes('كاش') || targetObj?.name?.includes('درج')) return true;
    if (!hasCashTreasury && (targetId === 'main' || targetObj?.isMain)) {
      return true;
    }
    return false;
  }

  // 6. Normalized main treasury aliases
  if (tId === 'main' || tId === 'الرئيسية' || tId === 'الخزنة الرئيسية') {
    if (targetId === 'main') return true;
    if (targetObj?.isMain) return true;
    return false;
  }

  // 7. Normalized card aliases
  if (targetId === 'card' || targetObj?.name?.includes('شبكة') || targetObj?.name?.includes('مدى') || targetObj?.name?.includes('فيزا')) {
    const isCardAlias = (
      tId === 'card' ||
      tId === 'mada' ||
      tId === 'visa' ||
      tId === 'mastercard' ||
      tId === 'شبكة' ||
      tId === 'شبكة / مدى' ||
      tId === 'بطاقة' ||
      tId === 'فيزا'
    );
    if (isCardAlias && (targetId === 'card' || targetObj?.name?.includes('شبكة') || targetObj?.name?.includes('فيزا'))) {
      return true;
    }
  }

  // 8. Normalized bank transfer aliases
  if (targetId === 'bank_transfer' || targetId === 'transfer' || targetObj?.name?.includes('تحويل')) {
    const isTransferAlias = (
      tId === 'bank_transfer' ||
      tId === 'transfer' ||
      tId === 'bank' ||
      tId === 'تحويل بنكي' ||
      tId === 'تحويل'
    );
    if (isTransferAlias) return true;
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
