import React from 'react';
import { AppSettings, Invoice } from '../types';

export function ServicesReportReceipt({
  settings,
  invoices,
  dateLabel,
  userName = 'أحمد محمد'
}: {
  settings: AppSettings,
  invoices: Invoice[],
  dateLabel: string,
  userName?: string
}) {
  const servicesMap: Record<string, { count: number, total: number }> = {};
  let overallTotal = 0;
  let overallCount = 0;

  invoices.forEach(inv => {
    if (inv.status === 'completed' && inv.items) {
      const totalBeforeDiscount = inv.items.reduce((s, item) => s + (item.price * (item.quantity || 1)), 0);
      const discount = inv.discount || 0;
      const discountRatio = totalBeforeDiscount > 0 ? (discount / totalBeforeDiscount) : 0;

      inv.items.forEach(item => {
        if (!servicesMap[item.serviceName]) {
          servicesMap[item.serviceName] = { count: 0, total: 0 };
        }
        const qty = item.quantity || 1;
        const itemTotal = item.price * qty;
        const effectivePrice = itemTotal - (itemTotal * discountRatio);
        servicesMap[item.serviceName].count += qty;
        servicesMap[item.serviceName].total += effectivePrice;
        
        overallCount += qty;
        overallTotal += effectivePrice;
      });
    }
  });

  const sortedServices = Object.entries(servicesMap).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="w-[72mm] mx-auto bg-white text-black p-4 text-sm font-sans" id="print-services-receipt" style={{ direction: 'rtl' }}>
      <div className="text-center border-b border-black pb-4 mb-4">
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 mx-auto mb-2 object-contain grayscale" />
        )}
        <h2 className="text-xl font-bold mb-2">{settings.salonName || 'اسم الصالون'}</h2>
        <h1 className="text-xl font-bold">تقرير الخدمات</h1>
        <p className="text-xs mt-1">تاريخ: {dateLabel}</p>
        <p className="text-xs">المستخدم: {userName}</p>
      </div>

      <div className="mb-4">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-black border-dashed">
              <th className="pb-1 font-bold w-1/2">الخدمة</th>
              <th className="pb-1 font-bold text-center">العدد</th>
              <th className="pb-1 font-bold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {sortedServices.map(([name, data]) => (
              <tr key={name} className="border-b border-slate-200">
                <td className="py-1">{name}</td>
                <td className="py-1 text-center">{data.count}</td>
                <td className="py-1 font-bold">{data.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="border-t border-black border-dashed pt-2 mb-6">
        <div className="flex justify-between font-bold text-sm">
          <span>إجمالي الخدمات:</span>
          <span>{overallCount}</span>
        </div>
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>إجمالي الدخل:</span>
          <span dir="ltr">{overallTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center mt-6 text-xs border-t border-black pt-2">
        <p>تم استخراج التقرير من النظام</p>
        <p>{new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}
