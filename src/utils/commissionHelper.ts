import { Employee, CommissionTier } from '../types';

/**
 * Calculates earned commission for an employee based on their configured model:
 * 1. 'none': No commission (0)
 * 2. 'tiered_brackets': Progressive brackets calculation
 * 3. 'target_based': Target threshold
 * 4. 'fixed_rate': Standard fixed percentage rate
 */
export function calculateEmployeeCommission(emp: Employee, salesAmount: number): number {
  if (!emp || salesAmount <= 0) return 0;
  if (emp.commissionModel === 'none') return 0;

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
      return salesAmount * ((Number(emp.commissionRate) || 0) / 100);
    }
    return 0;
  }

  // 3. Fixed Rate (نسبة مئوية ثابتة)
  const rate = emp.commissionRate !== undefined && emp.commissionRate !== null ? Number(emp.commissionRate) : 0;
  return salesAmount * (rate / 100);
}

/**
 * Returns a human-readable description of the employee's commission model
 */
export function getCommissionModelLabel(emp: Employee): string {
  if (emp.commissionModel === 'none' || emp.commissionRate === 0) {
    return 'بدون عمولة ثابتة (0%)';
  }
  if (emp.commissionModel === 'tiered_brackets' && emp.commissionTiers && emp.commissionTiers.length > 0) {
    return `شرائح متدرجة (${emp.commissionTiers.length} شرائح)`;
  }
  if (emp.commissionModel === 'target_based' && emp.target > 0) {
    return `تارجت ${emp.target} (${emp.commissionRate ?? 0}%)`;
  }
  return `نسبة ثابتة ${emp.commissionRate ?? 0}%`;
}

/**
 * فحص ما إذا كان الموظف يتقاضى عمولة ثابتة (نسبة على إجمالي الشغل أو موديل عمولة)
 */
export function hasEmployeeFixedCommission(emp?: Employee | null): boolean {
  if (!emp) return false;
  if (emp.commissionModel === 'fixed_rate' || emp.commissionModel === 'tiered_brackets' || emp.commissionModel === 'target_based') {
    return true;
  }
  return emp.commissionRate !== undefined && Number(emp.commissionRate) > 0;
}

/**
 * حساب عمولة الموظف الإجمالية وفق القواعد المعتمدة:
 * 1. في حال كان الموظف يتقاضى عمولة ثابتة (نسبة على إجمالي الشغل):
 *    - إذا تم تحديد خيار (احتساب العمولتين معاً: العمولة الثابتة + عمولة الخدمات):
 *        تحسب العمولة الثابتة على إجمالي الشغل + عمولة تنفيذ الخدمات + عمولة الإحالة (فتح الشغل).
 *    - إذا لم يتم تحديد هذا الخيار:
 *        تحسب العمولة الثابتة على إجمالي الشغل + عمولة الإحالة فقط (فتح الشغل)، مع عدم احتساب عمولة تنفيذ الخدمات.
 * 2. في حال لم يكن للموظف عمولة ثابتة:
 *    - تحسب عمولة تنفيذ الخدمات + عمولة الإحالة.
 */
export function calculateEmployeeTotalCommission({
  employee,
  totalWork,
  serviceExecutionCommission,
  referralCommission = 0
}: {
  employee?: Employee | null;
  totalWork: number;
  serviceExecutionCommission: number;
  referralCommission?: number;
}): {
  fixedCommission: number;
  serviceExecutionCommission: number;
  referralCommission: number;
  totalCommission: number;
} {
  const safeTotalWork = Number(totalWork) || 0;
  const safeServiceComm = Number(serviceExecutionCommission) || 0;
  const safeRefComm = Number(referralCommission) || 0;

  if (!employee) {
    return {
      fixedCommission: 0,
      serviceExecutionCommission: safeServiceComm,
      referralCommission: safeRefComm,
      totalCommission: safeServiceComm + safeRefComm
    };
  }

  const hasFixed = hasEmployeeFixedCommission(employee);

  if (hasFixed) {
    const fixedCommission = calculateEmployeeCommission(employee, safeTotalWork);
    // إذا تم تحديد الخيار، تحسب عمولة تنفيذ الخدمات مع العمولة الثابتة، وإلا فلا تحسب عمولة التنفيذ
    const effectiveServiceComm = employee.allowDualCommission ? safeServiceComm : 0;
    return {
      fixedCommission,
      serviceExecutionCommission: effectiveServiceComm,
      referralCommission: safeRefComm,
      totalCommission: fixedCommission + effectiveServiceComm + safeRefComm
    };
  }

  return {
    fixedCommission: 0,
    serviceExecutionCommission: safeServiceComm,
    referralCommission: safeRefComm,
    totalCommission: safeServiceComm + safeRefComm
  };
}

