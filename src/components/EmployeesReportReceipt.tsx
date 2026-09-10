import { AppSettings, Invoice, Employee, ServiceItem } from '../types';
import { calculateEmployeeCommission } from '../utils/commissionHelper';

export interface EmployeeWorkCommissionSummary {
  name: string;
  count: number;               // العدد (عدد الخدمات / المنتجات المنفذة)
  totalWork: number;           // اجمالي الشغل (قيمة الشغل الصافي بعد الخصم)
  executionCommission: number; // عمولة تنفيذ
  openingCommission: number;   // عمولة فتح شغل (إحالة)
  totalCommission: number;     // مجموع العمولة
}

export function EmployeesReportReceipt({
  settings,
  invoices = [],
  employees = [],
  services = [],
  products = [],
  dateLabel,
  userName = 'الكاشير'
}: {
  settings: AppSettings,
  invoices: Invoice[],
  employees: Employee[],
  services: ServiceItem[],
  products?: any[],
  dateLabel: string,
  userName?: string
}) {
  const empsMap: Record<string, EmployeeWorkCommissionSummary> = {};

  const getOrCreate = (name: string): EmployeeWorkCommissionSummary | null => {
    const cleanName = (name || '').trim();
    if (!cleanName || cleanName === 'غير محدد' || cleanName === 'بدون') return null;
    if (!empsMap[cleanName]) {
      empsMap[cleanName] = {
        name: cleanName,
        count: 0,
        totalWork: 0,
        executionCommission: 0,
        openingCommission: 0,
        totalCommission: 0
      };
    }
    return empsMap[cleanName];
  };

  (invoices || []).forEach(inv => {
    if (inv.status !== 'cancelled' && Array.isArray(inv.items)) {
      const totalBeforeDiscount = inv.items.reduce((s, item) => s + (Number(item.price || 0) * (item.quantity || 1)), 0);
      const discount = Number(inv.discount) || 0;
      const discountRatio = totalBeforeDiscount > 0 ? (discount / totalBeforeDiscount) : 0;

      inv.items.forEach(item => {
        const qty = item.quantity || 1;
        const itemTotal = (Number(item.price) || 0) * qty;
        const effectivePrice = Math.max(0, itemTotal - (itemTotal * discountRatio));

        const service = services.find(s => s.id === item.itemId || s.name === item.serviceName);
        const product = products && products.find(p => p.id === item.itemId || p.name === item.serviceName);

        // 1. عمولة التنفيذ (فني التنفيذ)
        const performerEmp = employees.find(e => (item.employeeId && e.id === item.employeeId) || (item.technicianName && e.name === item.technicianName));
        const performerName = performerEmp?.name || item.technicianName;
        const performerEntry = getOrCreate(performerName);

        if (performerEntry) {
          let execComm = 0;
          if (item.type === 'product' || (!service && product)) {
            if (product && product.commission > 0) {
              execComm = product.commission * qty;
            } else if (performerEmp) {
              execComm = calculateEmployeeCommission(performerEmp, effectivePrice);
            }
          } else {
            if (service && service.employeeCommissionAmount !== undefined && service.employeeCommissionAmount > 0) {
              execComm = service.employeeCommissionAmount * qty;
            } else if (service && service.employeeCommissionPercentage !== undefined && service.employeeCommissionPercentage > 0) {
              execComm = effectivePrice * (service.employeeCommissionPercentage / 100);
            } else if (performerEmp) {
              execComm = calculateEmployeeCommission(performerEmp, effectivePrice);
            }
          }

          performerEntry.count += qty;
          performerEntry.totalWork += effectivePrice;
          performerEntry.executionCommission += execComm;
          performerEntry.totalCommission += execComm;
        }

        // 2. عمولة فتح الشغل / الإحالة (فني فتح الشغل)
        const referrerEmp = employees.find(e => (item.referralEmployeeId && e.id === item.referralEmployeeId) || (item.referralEmployeeName && e.name === item.referralEmployeeName));
        const referrerName = referrerEmp?.name || item.referralEmployeeName;
        const referrerEntry = getOrCreate(referrerName);

        if (referrerEntry && (item.referralEmployeeId || item.referralEmployeeName)) {
          let openComm = 0;
          if (item.referralCommissionAmount !== undefined && item.referralCommissionAmount > 0) {
            openComm = item.referralCommissionAmount * qty;
          } else if (service && service.referralCommissionAmount !== undefined && service.referralCommissionAmount > 0) {
            if (service.referralCommissionType === 'fixed') {
              openComm = service.referralCommissionAmount * qty;
            } else {
              openComm = effectivePrice * (service.referralCommissionAmount / 100);
            }
          }

          if (openComm > 0) {
            referrerEntry.openingCommission += openComm;
            referrerEntry.totalCommission += openComm;
          }
        }
      });
    }
  });

  const sortedEmps = Object.entries(empsMap).sort((a, b) => b[1].totalWork - a[1].totalWork);

  let overallCount = 0;
  let overallTotalWork = 0;
  let overallExecutionCommission = 0;
  let overallOpeningCommission = 0;
  let overallTotalCommission = 0;

  sortedEmps.forEach(([_, data]) => {
    overallCount += data.count;
    overallTotalWork += data.totalWork;
    overallExecutionCommission += data.executionCommission;
    overallOpeningCommission += data.openingCommission;
    overallTotalCommission += data.totalCommission;
  });

  return (
    <div className="w-[78mm] sm:w-[80mm] mx-auto bg-white text-black p-3 text-xs font-sans" id="print-employees-receipt" style={{ direction: 'rtl' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-3 mb-3">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-20 h-20 mx-auto mb-1.5 object-contain grayscale" />
        )}
        <h2 className="text-base font-black mb-1">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-sm font-black text-slate-900 bg-slate-100 py-1 rounded-md mb-1">تقرير أعمال وعمولات الموظفين</h1>
        <div className="flex justify-between items-center text-[10px] text-slate-700 px-1 mt-1">
          <span>الفترة: {dateLabel}</span>
          <span>المستخدم: {userName}</span>
        </div>
      </div>

      {/* Main Table: 6 Columns as requested */}
      <div className="mb-3 overflow-x-auto">
        <table className="w-full text-right text-[10px]">
          <thead>
            <tr className="border-b-2 border-black font-black bg-slate-50">
              <th className="py-1 px-1 text-right">الموظف</th>
              <th className="py-1 px-0.5 text-center">العدد</th>
              <th className="py-1 px-0.5 text-center">اجمالي الشغل</th>
              <th className="py-1 px-0.5 text-center">عمولة تنفيذ</th>
              <th className="py-1 px-0.5 text-center">عمولة فتح شغل</th>
              <th className="py-1 px-1 text-left">مجموع العمولة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedEmps.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-xs text-slate-500 font-bold">
                  لا توجد أعمال أو عمولات مسجلة في هذه الفترة
                </td>
              </tr>
            ) : (
              sortedEmps.map(([name, data]) => (
                <tr key={name} className="hover:bg-slate-50">
                  <td className="py-1.5 px-1 font-bold leading-tight truncate max-w-[80px]">{name}</td>
                  <td className="py-1.5 px-0.5 text-center font-mono font-bold">{data.count}</td>
                  <td className="py-1.5 px-0.5 text-center font-mono font-bold">{data.totalWork.toFixed(2)}</td>
                  <td className="py-1.5 px-0.5 text-center font-mono text-emerald-800 font-bold">{data.executionCommission.toFixed(2)}</td>
                  <td className="py-1.5 px-0.5 text-center font-mono text-amber-800 font-bold">{data.openingCommission.toFixed(2)}</td>
                  <td className="py-1.5 px-1 text-left font-mono font-black">{data.totalCommission.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Summary Totals */}
      <div className="border-t-2 border-black border-dashed pt-2 mb-4 text-[11px] font-bold space-y-1 bg-slate-50 p-2 rounded-lg">
        <div className="flex justify-between">
          <span>إجمالي الخدمات والعمليات (العدد):</span>
          <span className="font-mono font-black">{overallCount}</span>
        </div>
        <div className="flex justify-between">
          <span>إجمالي الشغل المحقق:</span>
          <span className="font-mono font-black" dir="ltr">{overallTotalWork.toFixed(2)} {settings.currency}</span>
        </div>
        <div className="flex justify-between text-emerald-800">
          <span>إجمالي عمولات التنفيذ:</span>
          <span className="font-mono font-black" dir="ltr">+{overallExecutionCommission.toFixed(2)} {settings.currency}</span>
        </div>
        <div className="flex justify-between text-amber-800">
          <span>إجمالي عمولات فتح الشغل:</span>
          <span className="font-mono font-black" dir="ltr">+{overallOpeningCommission.toFixed(2)} {settings.currency}</span>
        </div>
        <div className="flex justify-between font-black text-xs border-t border-black pt-1.5 mt-1 text-slate-950">
          <span>مجموع العمولات المستحقة:</span>
          <span className="font-mono font-black" dir="ltr">{overallTotalCommission.toFixed(2)} {settings.currency}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[9px] text-slate-500 border-t border-slate-300 pt-2">
        <p>تم استخراج التقرير آلياً من نظام Smart Cut</p>
        <p dir="ltr" className="font-mono">{new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}

