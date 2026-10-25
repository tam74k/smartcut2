import { Employee, Invoice, AppSettings, TargetCalculationPolicy } from '../types';
import { isWaselInvoice } from './commissionHelper';

export interface TargetCalculationParams {
  employee: Employee;
  settings: AppSettings;
  invoices: Invoice[];
  dateRange: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  isDaily: boolean; // true for daily timesheet/gauge, false for monthly payslip
  daysInMonth?: number; // Optional override for month days count, default 30
}

export interface TargetCalculationResult {
  policy: TargetCalculationPolicy;
  policyLabel: string;
  isDaily: boolean;
  targetType: 'none' | 'daily' | 'monthly';
  targetMethod?: string;
  targetMethodLabel: string;
  targetAmount: number;
  totalValidSales: number;
  baseSalaryDeduction: number;
  elapsedDays?: number;
  achievedAmount: number;
  eligibleAmount: number;
  targetCommissionRate: number;
  commissionAmount: number;
  completedSteps?: number;
  stepAmount?: number;
  achievementPercentage: number;
  remainingToTarget: number;
  isTargetAchieved: boolean;
  validInvoicesCount: number;
  validItemsCount: number;
  exemptSales: number;
  exemptCommission: number;
  exemptItemsCount: number;
}

/**
 * Returns human-readable Arabic label for a given target calculation policy
 */
export function getTargetPolicyLabel(policy: TargetCalculationPolicy = 1): string {
  switch (policy) {
    case 1:
      return 'تارجت صافي المبيعات (خصم الراتب الأساسي)';
    case 2:
      return 'تارجت إجمالي المبيعات (بدون خصم الراتب)';
    case 3:
      return 'تارجت الشرائح التراكمية المكتملة (خطوة الشريحة)';
    case 4:
      return 'تارجت المنتجات وفتح الشغل فقط (بدون الخدمات)';
    case 5:
      return 'تارجت مضاعف الراتب (العمولة على ما يزيد عن مضاعف الراتب)';
    default:
      return 'تارجت صافي المبيعات (السياسة 1)';
  }
}

/**
 * Calculates the exact discounted (actual paid) price for an invoice item.
 * Strictly guarantees non-canceled invoices and proportional discount application.
 * Note: Wasel (complimentary / 100% discount) invoices are counted at full gross service value
 * for employee commission and target achievement purposes, even though customer paid 0.
 */
export function calculateItemDiscountedPaidAmount(item: any, invoice: Invoice): number {
  if (!item || !invoice) return 0;
  
  // Rule 1: Exclude canceled / refunded invoices completely
  const status = (invoice.status || '').toLowerCase();
  if (status === 'canceled' || status === 'cancelled' || status === 'refunded') {
    return 0;
  }

  const price = Number(item.price || item.originalPrice) || 0;
  const quantity = Number(item.quantity) || 1;
  const itemGross = price * quantity;
  if (itemGross <= 0) return 0;

  // Rule 2: Wasel (واصل) invoices are complimentary for the customer,
  // but for the employee's commission and target achievement they are evaluated at full gross value!
  if (isWaselInvoice(invoice)) {
    return Math.round(itemGross * 100) / 100;
  }

  // Calculate gross total across all items in invoice
  const grossSubtotal = (invoice.items || []).reduce((sum, it) => {
    const p = Number(it.price || it.originalPrice) || 0;
    const q = Number(it.quantity) || 1;
    return sum + (p * q);
  }, 0);

  if (grossSubtotal <= 0) {
    return itemGross;
  }

  // Calculate total invoice-level discount (direct discount + promo discount)
  const directDiscount = Number(invoice.discount) || 0;
  const promoDiscount = Number(invoice.promoDiscount) || 0;
  const totalDiscount = Math.max(0, directDiscount + promoDiscount);

  // Proportional discount ratio: (grossSubtotal - totalDiscount) / grossSubtotal
  const netPaidRatio = Math.max(0, Math.min(1, (grossSubtotal - totalDiscount) / grossSubtotal));
  const paidAmount = itemGross * netPaidRatio;

  return Math.round(paidAmount * 100) / 100;
}

/**
 * Core Target & Commission Calculation Engine
 * Supports individual per-employee target configurations (daily/monthly, excess vs full, gross vs net of salary)
 * Excludes target-exempt services and uses commissionableAmount as target base when provided.
 */
export function calculateEmployeeTargetCommission({
  employee,
  settings,
  invoices = [],
  dateRange,
  isDaily,
  daysInMonth = 30
}: TargetCalculationParams): TargetCalculationResult {
  const policy: TargetCalculationPolicy = (settings?.targetCalculationPolicy as TargetCalculationPolicy) || 1;
  const policyLabel = getTargetPolicyLabel(policy);

  // 1. Determine Employee Target Configuration
  const rawTargetType = employee?.targetType || ((Number(employee?.dailyTargetAmount) > 0) ? 'daily' : ((Number(employee?.monthlyTargetAmount || employee?.target) > 0) ? 'monthly' : 'none'));
  const targetType: 'none' | 'daily' | 'monthly' = rawTargetType as 'none' | 'daily' | 'monthly';

  let targetAmount = 0;
  let targetMethod = '';
  let targetMethodLabel = 'بدون تارجت';

  const rawTargetMultiplier = Number(
    isDaily 
      ? (employee.dailyTargetMultiplier ?? employee.targetSalaryMultiplier ?? 1)
      : (employee.monthlyTargetMultiplier ?? employee.targetSalaryMultiplier ?? 1)
  );
  const targetMultiplier = isNaN(rawTargetMultiplier) || rawTargetMultiplier <= 0 ? 1 : rawTargetMultiplier;

  if (targetType === 'none') {
    targetAmount = 0;
    targetMethod = 'none';
    targetMethodLabel = 'الموظف غير خاضع لنظام التارجت';
  } else if (isDaily) {
    if (targetType === 'daily') {
      targetMethod = employee.dailyTargetMethod || 'excess_only';
      if (targetMethod === 'salary_multiplier' || policy === 5) {
        targetMethod = 'salary_multiplier';
        const baseSalary = Number(employee.baseSalary ?? (employee as any).basicSalary ?? 0);
        const dailySalary = baseSalary / (daysInMonth || 30);
        targetAmount = Math.round((dailySalary * targetMultiplier) * 100) / 100;
        targetMethodLabel = `تارجت يومي: مضاعف الراتب (${targetMultiplier}x الراتب اليومي)`;
      } else if (targetMethod === 'full_amount') {
        targetAmount = Number(employee.dailyTargetAmount || employee.target || 0);
        targetMethodLabel = 'تارجت يومي: على كامل المبلغ عند تجاوز التارجت';
      } else {
        targetAmount = Number(employee.dailyTargetAmount || employee.target || 0);
        targetMethodLabel = 'تارجت يومي: على ما فوق التارجت فقط (الفائض)';
      }
    } else {
      // Monthly target employee being evaluated on a daily scope
      targetAmount = 0;
      targetMethod = 'monthly_deferred';
      targetMethodLabel = 'تارجت شهري (يؤجل حسابه لمسير الرواتب وتقرير التارجت)';
    }
  } else {
    // Monthly evaluation
    if (targetType === 'monthly' || targetType === 'daily') {
      targetMethod = employee.monthlyTargetMethod || (policy === 5 ? 'salary_multiplier' : (policy === 2 ? 'gross_sales' : 'deduct_salary'));
      if (targetMethod === 'salary_multiplier') {
        const baseSalary = Number(employee.baseSalary ?? (employee as any).basicSalary ?? 0);
        targetAmount = Math.round((baseSalary * targetMultiplier) * 100) / 100;
        targetMethodLabel = `تارجت شهري: مضاعف الراتب (${targetMultiplier}x الراتب الشهري)`;
      } else if (targetMethod === 'gross_sales') {
        targetAmount = Number(employee.monthlyTargetAmount || employee.target || 0);
        targetMethodLabel = 'تارجت شهري: على إجمالي الشغل بدون خصم الراتب';
      } else {
        targetAmount = Number(employee.monthlyTargetAmount || employee.target || 0);
        targetMethodLabel = 'تارجت شهري: خصم الراتب الأساسي ثم النسبة على ما فوق التارجت';
      }
    }
  }
  targetAmount = Math.max(0, targetAmount || 0);

  // 2. Determine Target Commission Rate
  const targetCommissionRate = Math.max(0, Number(
    employee.targetCommissionRate !== undefined && employee.targetCommissionRate !== null 
      ? employee.targetCommissionRate 
      : (employee.commissionRate ?? 0)
  ) || 0);

  // 3. Process Non-Canceled Invoices within Date Range
  const startStr = dateRange.start;
  const endStr = dateRange.end;
  let totalValidSales = 0;
  let validInvoicesCount = 0;
  let validItemsCount = 0;

  let exemptSales = 0;
  let exemptCommission = 0;
  let exemptItemsCount = 0;

  const validInvoices = invoices.filter(inv => {
    if (!inv) return false;
    const st = (inv.status || '').toLowerCase();
    if (st === 'canceled' || st === 'cancelled' || st === 'refunded') return false;

    const invDate = (inv.date || (inv as any).createdAt || (inv as any).shift_date || '').split('T')[0];
    if (!invDate) return false;
    return invDate >= startStr && invDate <= endStr;
  });

  const empId = employee.id;
  const empName = (employee.name || '').trim().toLowerCase();

  validInvoices.forEach(inv => {
    let invoiceContributed = false;

    (inv.items || []).forEach(item => {
      const itemEmpId = item.employeeId || (item as any).employee_id || (item as any).technicianId;
      const itemEmpName = (item.technicianName || (item as any).employee_name || '').trim().toLowerCase();
      const isExecution = (itemEmpId && itemEmpId === empId) || (empName && itemEmpName === empName);

      const refEmpId = item.referralEmployeeId || (item as any).referral_employee_id;
      const refEmpName = (item.referralEmployeeName || (item as any).referral_employee_name || '').trim().toLowerCase();
      const isReferral = (refEmpId && refEmpId === empId) || (empName && refEmpName === empName);

      if (!isExecution && !isReferral) return;

      const paidAmount = calculateItemDiscountedPaidAmount(item, inv);
      const isExempt = Boolean(item.isTargetExempt);
      const itemComm = Number(item.employeeCommission ?? item.commissionAmount ?? (item as any).commission ?? 0);
      const qty = Number(item.quantity) || 1;

      // Handle target-exempt services (immediate commission, excluded from target sales pool)
      if (isExempt) {
        exemptSales += paidAmount;
        exemptCommission += itemComm;
        exemptItemsCount += qty;
        return;
      }

      // Target Eligible Base calculation:
      // If service specifies commissionableAmount, use it as the base amount for target achievement
      let itemTargetRevenue = paidAmount;
      const rawCommBase = Number(item.commissionableAmount);
      if (!isNaN(rawCommBase) && rawCommBase > 0) {
        // Apply proportional discount ratio if any
        const itemGross = (Number(item.price || item.originalPrice) || 0) * qty;
        const discountRatio = itemGross > 0 ? (paidAmount / itemGross) : 1;
        itemTargetRevenue = Math.round(rawCommBase * qty * discountRatio * 100) / 100;
      }

      totalValidSales += itemTargetRevenue;
      validItemsCount += qty;
      invoiceContributed = true;
    });

    if (invoiceContributed) {
      validInvoicesCount++;
    }
  });

  totalValidSales = Math.round(totalValidSales * 100) / 100;
  exemptSales = Math.round(exemptSales * 100) / 100;
  exemptCommission = Math.round(exemptCommission * 100) / 100;

  // 4. Calculate Commission & Eligible Amount
  let eligibleAmount = 0;
  let achievedAmount = 0;
  let baseSalaryDeduction = 0;
  let elapsedDays: number | undefined = undefined;
  let commissionAmount = 0;

  const rateMultiplier = targetCommissionRate / 100;

  if (targetType === 'none' || targetAmount <= 0) {
    // No target configured
    achievedAmount = totalValidSales;
    eligibleAmount = 0;
    commissionAmount = 0;
  } else if (isDaily) {
    // DAILY TARGET EVALUATION
    if (targetType === 'daily') {
      achievedAmount = totalValidSales;
      if (totalValidSales >= targetAmount) {
        if (targetMethod === 'full_amount') {
          // Method 2: Commission on the full achieved amount once threshold is met
          eligibleAmount = totalValidSales;
        } else {
          // Method 1: Commission strictly on excess over the threshold
          eligibleAmount = Math.max(0, totalValidSales - targetAmount);
        }
        commissionAmount = eligibleAmount * rateMultiplier;
      } else {
        eligibleAmount = 0;
        commissionAmount = 0;
      }
    } else {
      // Monthly target: 0 target commission for today (calculated at month end)
      achievedAmount = totalValidSales;
      eligibleAmount = 0;
      commissionAmount = 0;
    }
  } else {
    // MONTHLY TARGET EVALUATION
    if (targetMethod === 'salary_multiplier') {
      // Method 3 / Policy 5: Salary multiplier (Commission on excess sales above baseSalary * multiplier)
      baseSalaryDeduction = 0;
      achievedAmount = totalValidSales;
      if (totalValidSales >= targetAmount) {
        eligibleAmount = Math.max(0, totalValidSales - targetAmount);
        commissionAmount = eligibleAmount * rateMultiplier;
      } else {
        eligibleAmount = 0;
        commissionAmount = 0;
      }
    } else if (targetMethod === 'gross_sales') {
      // Method 2: Gross sales without deducting salary
      baseSalaryDeduction = 0;
      achievedAmount = totalValidSales;
      if (totalValidSales >= targetAmount) {
        eligibleAmount = totalValidSales;
        commissionAmount = eligibleAmount * rateMultiplier;
      } else {
        eligibleAmount = 0;
        commissionAmount = 0;
      }
    } else {
      // Method 1: Deduct base salary first, remainder above target earns commission
      const monthlySalary = Number(employee.baseSalary ?? (employee as any).basicSalary ?? 0);
      baseSalaryDeduction = monthlySalary;
      const netAfterSalary = Math.max(0, totalValidSales - baseSalaryDeduction);
      achievedAmount = netAfterSalary;

      if (netAfterSalary >= targetAmount) {
        eligibleAmount = Math.max(0, netAfterSalary - targetAmount);
        commissionAmount = eligibleAmount * rateMultiplier;
      } else {
        eligibleAmount = 0;
        commissionAmount = 0;
      }
    }
  }

  commissionAmount = Math.round(commissionAmount * 100) / 100;
  eligibleAmount = Math.round(eligibleAmount * 100) / 100;
  achievedAmount = Math.round(achievedAmount * 100) / 100;

  // 5. Achievement Metrics for Progress Tracker
  const achievementPercentage = targetAmount > 0 
    ? Math.min(100, Math.round((achievedAmount / targetAmount) * 100))
    : (achievedAmount > 0 ? 100 : 0);

  const remainingToTarget = Math.max(0, Math.round((targetAmount - achievedAmount) * 100) / 100);
  const isTargetAchieved = targetAmount > 0 && achievedAmount >= targetAmount;

  return {
    policy,
    policyLabel,
    isDaily,
    targetType,
    targetMethod,
    targetMethodLabel,
    targetAmount,
    totalValidSales,
    baseSalaryDeduction,
    elapsedDays,
    achievedAmount,
    eligibleAmount,
    targetCommissionRate,
    commissionAmount,
    achievementPercentage,
    remainingToTarget,
    isTargetAchieved,
    validInvoicesCount,
    validItemsCount,
    exemptSales,
    exemptCommission,
    exemptItemsCount
  };
}
