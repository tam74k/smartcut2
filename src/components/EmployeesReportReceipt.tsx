import { AppSettings, Invoice, Employee, ServiceItem } from '../types';
import { calculateEmployeeCommission } from '../utils/commissionHelper';

export function EmployeesReportReceipt({
  settings,
  invoices,
  employees = [],
  services = [],
  products = [],
  dateLabel,
  userName = 'أحمد محمد'
}: {
  settings: AppSettings,
  invoices: Invoice[],
  employees: Employee[],
  services: ServiceItem[],
  products?: any[],
  dateLabel: string,
  userName?: string
}) {
  const empsMap: Record<string, { count: number, totalValue: number, totalCommission: number }> = {};
  let overallTotalValue = 0;
  let overallTotalCommission = 0;
  let overallCount = 0;

  invoices.forEach(inv => {
    if (inv.status === 'completed' && inv.items) {
      const totalBeforeDiscount = inv.items.reduce((s, item) => s + (item.price * (item.quantity || 1)), 0);
      const discount = inv.discount || 0;
      const discountRatio = totalBeforeDiscount > 0 ? (discount / totalBeforeDiscount) : 0;

      inv.items.forEach(item => {
        if (!item.technicianName) return;

        if (!empsMap[item.technicianName]) {
          empsMap[item.technicianName] = { count: 0, totalValue: 0, totalCommission: 0 };
        }

        const qty = item.quantity || 1;
        const itemTotal = item.price * qty;
        const effectivePrice = itemTotal - (itemTotal * discountRatio);

                const service = services.find(s => s.name === item.serviceName || s.id === item.itemId);
        const product = products && products.find(p => p.name === item.serviceName || p.id === item.itemId);
        const employee = employees.find(e => e.name === item.technicianName);
        let commissionAmount = 0;

        if (item.type === 'product' || (!service && product)) {
          if (product && product.commission > 0) {
            commissionAmount = product.commission * qty;
          } else if (employee) {
            commissionAmount = calculateEmployeeCommission(employee, effectivePrice);
          }
        } else {
          if (service && service.employeeCommissionAmount !== undefined && service.employeeCommissionAmount > 0) {
            commissionAmount = service.employeeCommissionAmount * qty;
          } else if (service && service.employeeCommissionPercentage !== undefined && service.employeeCommissionPercentage > 0) {
            commissionAmount = effectivePrice * (service.employeeCommissionPercentage / 100);
          } else if (employee) {
            commissionAmount = calculateEmployeeCommission(employee, effectivePrice);
          }
        }

        empsMap[item.technicianName].count += qty;
        empsMap[item.technicianName].totalValue += effectivePrice;
        empsMap[item.technicianName].totalCommission += commissionAmount;
        
        overallCount += qty;
        overallTotalValue += effectivePrice;
        overallTotalCommission += commissionAmount;
      });
    }
  });

  const sortedEmps = Object.entries(empsMap).sort((a, b) => b[1].totalValue - a[1].totalValue);

  return (
    <div className="w-[72mm] mx-auto bg-white text-black p-4 text-sm font-sans" id="print-employees-receipt" style={{ direction: 'rtl' }}>
      <div className="text-center border-b border-black pb-4 mb-4">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 mx-auto mb-2 object-contain grayscale" />
        )}
        <h2 className="text-xl font-bold mb-2">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-xl font-bold">أعمال وعمولات الموظفين</h1>
        <p className="text-xs mt-1">تاريخ: {dateLabel}</p>
        <p className="text-xs">المستخدم: {userName}</p>
      </div>

      <div className="mb-4">
        <table className="w-full text-right text-[11px]">
          <thead>
            <tr className="border-b border-black border-dashed">
              <th className="pb-1 font-bold w-1/3">الموظف</th>
              <th className="pb-1 font-bold text-center">العدد</th>
              <th className="pb-1 font-bold text-center">الدخل</th>
              <th className="pb-1 font-bold">العمولة</th>
            </tr>
          </thead>
          <tbody>
            {sortedEmps.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs">لا توجد أعمال</td>
              </tr>
            ) : (
              sortedEmps.map(([name, data]) => (
                <tr key={name} className="border-b border-slate-200">
                  <td className="py-2 leading-tight">{name}</td>
                  <td className="py-2 text-center">{data.count}</td>
                  <td className="py-2 text-center">{data.totalValue.toFixed(2)}</td>
                  <td className="py-2 font-bold">{data.totalCommission.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="border-t border-black border-dashed pt-2 mb-6">
        <div className="flex justify-between font-bold text-sm">
          <span>إجمالي الخدمات المنفذة:</span>
          <span>{overallCount}</span>
        </div>
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>إجمالي الدخل للموظفين:</span>
          <span dir="ltr">{overallTotalValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm mt-1 border-t border-slate-200 pt-1">
          <span>إجمالي العمولات المستحقة:</span>
          <span dir="ltr">{overallTotalCommission.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center mt-6 text-xs border-t border-black pt-2">
        <p>تم استخراج التقرير من النظام</p>
        <p>{new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}
