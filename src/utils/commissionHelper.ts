import { Employee, CommissionTier } from '../types';

/**
 * Calculates earned commission for an employee based on their configured model:
 * 1. 'tiered_brackets': Progressive brackets calculation
 * 2. 'target_based': Target threshold
 * 3. 'fixed_rate': Standard fixed percentage rate
 */
export function calculateEmployeeCommission(emp: Employee, salesAmount: number): number {
  if (!emp || salesAmount <= 0) return 0;

  // 1. Tiered Brackets (شرائح العمولات المتدرجة)
  if (emp.commissionModel === 'tiered_brackets' && emp.commissionTiers && emp.commissionTiers.length > 0) {
    const sortedTiers = [...emp.commissionTiers].sort((a, b) => a.fromAmount - b.fromAmount);
    let totalCommission = 0;

    for (const tier of sortedTiers) {
      if (salesAmount > tier.fromAmount) {
        const tierLimit = tier.toAmount && tier.toAmount > 0 ? tier.toAmount : Infinity;
        const taxableInTier = Math.min(salesAmount, tierLimit) - tier.fromAmount;
        if (taxableInTier > 0) {
          totalCommission += taxableInTier * (tier.percentage / 100);
        }
      }
    }
    return totalCommission;
  }

  // 2. Target-Based (تحقيق التارجت)
  if (emp.commissionModel === 'target_based' && emp.target > 0) {
    if (salesAmount >= emp.target) {
      return salesAmount * ((emp.commissionRate || 0) / 100);
    }
    return 0;
  }

  // 3. Fixed Rate (نسبة مئوية ثابتة)
  const rate = emp.commissionRate !== undefined && emp.commissionRate !== null ? emp.commissionRate : 10;
  return salesAmount * (rate / 100);
}

/**
 * Returns a human-readable description of the employee's commission model
 */
export function getCommissionModelLabel(emp: Employee): string {
  if (emp.commissionModel === 'tiered_brackets' && emp.commissionTiers && emp.commissionTiers.length > 0) {
    return `شرائح متدرجة (${emp.commissionTiers.length} شرائح)`;
  }
  if (emp.commissionModel === 'target_based' && emp.target > 0) {
    return `تارجت ${emp.target} (${emp.commissionRate || 0}%)`;
  }
  return `نسبة ثابتة ${emp.commissionRate || 10}%`;
}
