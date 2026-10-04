import React from 'react';
import { AppSettings, SalesReturn } from '../types';

interface ThermalSalesReturnReceiptProps {
  salesReturn: SalesReturn;
  settings: AppSettings;
  id?: string;
  isA4?: boolean;
}

export const ThermalSalesReturnReceipt: React.FC<ThermalSalesReturnReceiptProps> = ({
  salesReturn,
  settings,
  id,
  isA4 = false
}) => {
  const containerId = id || `thermal-sales-return-${salesReturn.id}`;

  if (isA4) {
    return (
      <div 
        id={containerId} 
        className="bg-white p-8 max-w-4xl mx-auto text-slate-800 font-sans border border-slate-300 shadow-sm print:m-0 print:border-none print:shadow-none"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
          <div className="flex items-center gap-4">
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" className="w-20 h-20 object-contain rounded-lg" />
            )}
            <div>
              <h1 className="text-2xl font-black text-slate-900">{settings.salonName || 'صالون العناية'}</h1>
              <p className="text-sm text-slate-500 font-medium">{settings.address || ''}</p>
              {settings.taxNumber && (
                <p className="text-xs text-slate-600 font-mono mt-1">الرقم الضريبي: {settings.taxNumber}</p>
              )}
              {settings.commercialReg && (
                <p className="text-xs text-slate-600 font-mono">السجل التجاري: {settings.commercialReg}</p>
              )}
            </div>
          </div>
          <div className="text-left">
            <span className="inline-block bg-rose-600 text-white font-black px-4 py-1.5 rounded-lg text-sm mb-2">
              إشعار دائن • سند مرتجع مبيعات
            </span>
            <p className="text-xs font-mono font-bold text-slate-600">رقم السند: {salesReturn.id}</p>
            <p className="text-xs font-mono text-slate-500">التاريخ: {new Date(salesReturn.date).toLocaleString('ar-SA')}</p>
            <p className="text-xs font-mono text-slate-500">
              الفاتورة الأصلية: {salesReturn.isWithoutInvoice || salesReturn.originalInvoiceId === 'بدون فاتورة' ? 'بدون فاتورة (مرتجع عام)' : `#${salesReturn.originalInvoiceId}`}
            </p>
          </div>
        </div>

        {/* Client & Metadata Info */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl mb-6 text-sm border border-slate-200">
          <div>
            <p className="text-slate-500 text-xs">بيانات العميل:</p>
            <p className="font-bold text-slate-800 text-base">{salesReturn.clientName || 'عميل نقدي'}</p>
            {salesReturn.clientPhone && <p className="font-mono text-xs text-slate-600">{salesReturn.clientPhone}</p>}
          </div>
          <div className="text-left">
            <p className="text-slate-500 text-xs">طريقة الاسترجاع والخزينة:</p>
            <p className="font-bold text-rose-700">{salesReturn.treasuryName || 'الخزينة النقدية'}</p>
            <p className="text-xs text-slate-500 mt-1">نوع المرتجع: {salesReturn.returnType === 'full' ? 'مرتجع كلي' : 'مرتجع جزئي'}</p>
          </div>
        </div>

        {/* Reason */}
        {salesReturn.reason && (
          <div className="mb-4 bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
            <span className="font-bold">سبب الإرجاع: </span>
            <span>{salesReturn.reason}</span>
            {salesReturn.notes && <span className="mr-2 text-amber-700">({salesReturn.notes})</span>}
          </div>
        )}

        {/* Items Table */}
        <table className="w-full text-right text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-slate-900 text-white text-xs">
              <th className="py-2.5 px-3 rounded-r-lg">#</th>
              <th className="py-2.5 px-3">الصنف المسترد</th>
              <th className="py-2.5 px-3 text-center">النوع</th>
              <th className="py-2.5 px-3 text-center">الكمية</th>
              <th className="py-2.5 px-3 text-center">سعر الوحدة</th>
              <th className="py-2.5 px-3 text-left rounded-l-lg">المبلغ المسترد</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {salesReturn.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="py-3 px-3 font-mono text-xs text-slate-500">{idx + 1}</td>
                <td className="py-3 px-3">
                  <div className="font-bold text-slate-800">{item.name}</div>
                  {item.technicianName && (
                    <div className="text-[11px] text-slate-500">الفني: {item.technicianName}</div>
                  )}
                </td>
                <td className="py-3 px-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.type === 'product' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {item.type === 'product' ? 'منتج' : 'خدمة'}
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold">{item.returnQuantity}</td>
                <td className="py-3 px-3 text-center font-mono">{Number(item.price).toFixed(2)} {settings.currency}</td>
                <td className="py-3 px-3 text-left font-mono font-bold text-rose-600">
                  {Number(item.totalRefund).toFixed(2)} {settings.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Summary */}
        <div className="flex justify-end mb-8">
          <div className="w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>إجمالي البنود:</span>
              <span className="font-mono font-bold">{Number(salesReturn.subtotalRefund || salesReturn.totalRefund).toFixed(2)} {settings.currency}</span>
            </div>
            {Boolean(salesReturn.taxRefund && salesReturn.taxRefund > 0) && (
              <div className="flex justify-between text-slate-600">
                <span>الضريبة المستردة:</span>
                <span className="font-mono font-bold">{Number(salesReturn.taxRefund).toFixed(2)} {settings.currency}</span>
              </div>
            )}
            <div className="border-t border-slate-300 pt-2 flex justify-between font-black text-base text-rose-600">
              <span>صافي المبلغ المسترد:</span>
              <span className="font-mono text-lg">{Number(salesReturn.totalRefund).toFixed(2)} {settings.currency}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 mt-8 text-center text-xs text-slate-600">
          <div>
            <p className="font-bold mb-8">توقيع المستلم (العميل):</p>
            <div className="border-b border-dashed border-slate-400 w-48 mx-auto"></div>
          </div>
          <div>
            <p className="font-bold mb-8">توقيع الموظف المسؤول ({salesReturn.createdByName || 'الكاشير'}):</p>
            <div className="border-b border-dashed border-slate-400 w-48 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Thermal 80mm / 58mm view
  return (
    <div
      id={containerId}
      className="bg-white text-black p-4 mx-auto print:m-0 print:p-2"
      style={{
        width: '100%',
        maxWidth: settings.paperSize === '58mm' ? '54mm' : '76mm',
        fontFamily: '"Cairo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '11px',
        lineHeight: '1.3',
        direction: 'rtl',
        color: '#000'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        {settings.logoUrl && (
          <img
            src={settings.logoUrl}
            alt="Logo"
            style={{ maxWidth: '65px', maxHeight: '65px', margin: '0 auto 6px auto', display: 'block', objectFit: 'contain' }}
          />
        )}
        <h2 style={{ fontSize: '15px', fontWeight: '900', margin: '0 0 2px 0' }}>
          {settings.salonName || 'صالون العناية'}
        </h2>
        {settings.address && (
          <p style={{ fontSize: '9px', margin: '0 0 2px 0', color: '#333' }}>{settings.address}</p>
        )}
        {settings.taxNumber && (
          <p style={{ fontSize: '9px', margin: '0 0 2px 0', fontWeight: 'bold' }}>
            الرقم الضريبي: {settings.taxNumber}
          </p>
        )}

        <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>
        <div style={{
          display: 'inline-block',
          backgroundColor: '#000',
          color: '#fff',
          padding: '2px 8px',
          fontWeight: '900',
          fontSize: '11px',
          borderRadius: '3px'
        }}>
          إشعار دائن • مرتجع مبيعات
        </div>
        <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>
      </div>

      {/* Details Meta */}
      <div style={{ fontSize: '10px', marginBottom: '8px', lineHeight: '1.4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>رقم سند المرتجع:</span>
          <strong style={{ fontFamily: 'monospace' }}>{salesReturn.id}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>الفاتورة الأصلية:</span>
          <strong style={{ fontFamily: 'monospace' }}>
            {salesReturn.isWithoutInvoice || salesReturn.originalInvoiceId === 'بدون فاتورة' ? 'بدون فاتورة' : `#${salesReturn.originalInvoiceId}`}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>التاريخ والوقت:</span>
          <span>{new Date(salesReturn.date).toLocaleString('ar-SA')}</span>
        </div>
        {salesReturn.clientName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>العميل:</span>
            <strong>{salesReturn.clientName}</strong>
          </div>
        )}
        {salesReturn.clientPhone && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>الهاتف:</span>
            <span style={{ fontFamily: 'monospace' }}>{salesReturn.clientPhone}</span>
          </div>
        )}
        {salesReturn.createdByName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>الموظف:</span>
            <span>{salesReturn.createdByName}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>الخزينة:</span>
          <span>{salesReturn.treasuryName || 'الخزينة النقدية'}</span>
        </div>
      </div>

      {/* Reason */}
      {salesReturn.reason && (
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '4px',
          borderRadius: '3px',
          fontSize: '9px',
          marginBottom: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <strong>السبب: </strong>
          <span>{salesReturn.reason}</span>
          {salesReturn.notes && <div>{salesReturn.notes}</div>}
        </div>
      )}

      {/* Items Table */}
      <div style={{ borderBottom: '1px solid #000', paddingBottom: '3px', marginBottom: '4px' }}>
        <table style={{ width: '100%', fontSize: '10px', textAlign: 'right', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px dashed #000' }}>
              <th style={{ padding: '3px 0', textAlign: 'right' }}>الصنف</th>
              <th style={{ padding: '3px 0', textAlign: 'center', width: '22%' }}>الكمية</th>
              <th style={{ padding: '3px 0', textAlign: 'left', width: '32%' }}>المسترد</th>
            </tr>
          </thead>
          <tbody>
            {salesReturn.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                <td style={{ padding: '4px 0' }}>
                  <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                  <div style={{ fontSize: '8px', color: '#555' }}>
                    {item.type === 'product' ? 'منتج' : 'خدمة'}
                    {item.technicianName ? ` • ${item.technicianName}` : ''}
                  </div>
                </td>
                <td style={{ padding: '4px 0', textAlign: 'center', fontFamily: 'monospace' }}>
                  {item.returnQuantity} × {Number(item.price).toFixed(2)}
                </td>
                <td style={{ padding: '4px 0', textAlign: 'left', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {Number(item.totalRefund).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ marginTop: '6px', fontSize: '11px', lineHeight: '1.4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>إجمالي الأصناف:</span>
          <span style={{ fontFamily: 'monospace' }}>
            {Number(salesReturn.subtotalRefund || salesReturn.totalRefund).toFixed(2)} {settings.currency}
          </span>
        </div>
        {Boolean(salesReturn.taxRefund && salesReturn.taxRefund > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>الضريبة:</span>
            <span style={{ fontFamily: 'monospace' }}>
              {Number(salesReturn.taxRefund).toFixed(2)} {settings.currency}
            </span>
          </div>
        )}
        <div style={{
          borderTop: '1px solid #000',
          borderBottom: '1px solid #000',
          margin: '6px 0',
          padding: '4px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: '900',
          fontSize: '13px'
        }}>
          <span>صافي المسترد:</span>
          <span style={{ fontFamily: 'monospace' }}>
            {Number(salesReturn.totalRefund).toFixed(2)} {settings.currency}
          </span>
        </div>
      </div>

      {/* Footer Notes */}
      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '9px', color: '#444' }}>
        <p style={{ margin: '2px 0' }}>تم استرجاع المبلغ نقداً / لحساب العميل بنجاح</p>
        <p style={{ margin: '2px 0', fontSize: '8px' }}>شكراً لاختياركم {settings.salonName || 'صالوننا'}</p>
      </div>
    </div>
  );
};
