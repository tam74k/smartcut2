import { Employee } from '../types';

/**
 * المسميات الوظيفية المعتمدة للموظفين في الصالون
 */
export const EMPLOYEE_ROLES = [
  'حلاق / كوافير',
  'مساعد',
  'كاشير',
  'اداري',
  'عامل'
] as const;

export type StandardEmployeeRole = typeof EMPLOYEE_ROLES[number];

/**
 * فحص ما إذا كان الموظف يحمل مسمى حلاق / كوافير
 * يُستخدم لعرض الفنيين المنفذين فقط في الفواتير والحجوزات
 */
export function isBarberEmployee(emp?: Employee | null): boolean {
  if (!emp || emp.isActive === false) return false;
  const role = (emp.role || '').trim();
  if (role === 'حلاق / كوافير') return true;

  // استبعاد أي مسمى وظيفي آخر بشكل صارم
  const lower = role.toLowerCase();
  if (
    role.includes('مساعد') ||
    role.includes('كاشير') ||
    role.includes('اداري') ||
    role.includes('إداري') ||
    role.includes('عامل') ||
    lower.includes('cashier') ||
    lower.includes('admin') ||
    lower.includes('worker') ||
    lower.includes('cleaner') ||
    lower.includes('assistant')
  ) {
    return false;
  }

  // التوافقية السابقة مع المسميات القديمة المشتقة من الحلاقة والتصفيف
  return (
    role.includes('حلاق') ||
    role.includes('كوافير') ||
    role.includes('مصفف') ||
    lower.includes('barber') ||
    lower.includes('hair')
  );
}

/**
 * فحص ما إذا كان الموظف مؤهلاً لعمولة الإحالة (فتح شغل)
 * تشمل حصراً: حلاق / كوافير - مساعد
 */
export function isReferralEligibleEmployee(emp?: Employee | null): boolean {
  if (!emp || emp.isActive === false) return false;
  const role = (emp.role || '').trim();
  if (role === 'حلاق / كوافير' || role === 'مساعد') return true;

  // استبعاد أي وظائف أخرى (كاشير، إداري، عامل، إلخ)
  const lower = role.toLowerCase();
  if (
    role.includes('كاشير') ||
    role.includes('اداري') ||
    role.includes('إداري') ||
    role.includes('عامل') ||
    lower.includes('cashier') ||
    lower.includes('admin') ||
    lower.includes('worker') ||
    lower.includes('cleaner')
  ) {
    return false;
  }

  // التوافقية السابقة
  return (
    role.includes('مساعد') ||
    role.includes('حلاق') ||
    role.includes('كوافير') ||
    role.includes('مصفف') ||
    lower.includes('assistant') ||
    lower.includes('barber') ||
    lower.includes('hair')
  );
}
