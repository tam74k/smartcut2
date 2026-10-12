import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AppSettings, Invoice, Branch } from '../types';
import { generateCode39Svg } from '../utils/printQueueSlip';
import { generateZatcaQrBase64 } from '../utils/zatca';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize';

interface InvoiceReceiptCardProps {
  id?: string;
  invoice: Invoice;
  settings: AppSettings;
  branches?: Branch[];
  activeBranchId?: string;
  currentUser?: any;
  className?: string;
}

export const formatInvoiceDate = (dateRaw?: string): string => {
  if (!dateRaw) return new Date().toISOString().split('T')[0];
  const d = new Date(dateRaw);
  if (isNaN(d.getTime())) return dateRaw.split('T')[0] || dateRaw;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatInvoiceTime = (dateRaw?: string): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (!dateRaw) {
    const d = new Date();
    const hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? 'م' : 'ص';
    const formattedHours = pad(hours % 12 || 12);
    return `${formattedHours}:${minutes} ${ampm}`;
  }
  const d = new Date(dateRaw);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'م' : 'ص';
  const formattedHours = pad(hours % 12 || 12);
  return `${formattedHours}:${minutes} ${ampm}`;
};

export const formatInvoiceCreatedAt = (invoice: Invoice): string => {
  const createdRaw = invoice.date || (invoice as any).createdAt || (invoice as any).created_at;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (createdRaw) {
    const d = new Date(createdRaw);
    if (!isNaN(d.getTime())) {
      const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const hours = d.getHours();
      const minutes = pad(d.getMinutes());
      const ampm = hours >= 12 ? 'م' : 'ص';
      const formattedHours = pad(hours % 12 || 12);
      return `${datePart} - ${formattedHours}:${minutes} ${ampm}`;
    }
  }
  const d = new Date();
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'م' : 'ص';
  const formattedHours = pad(hours % 12 || 12);
  return `${datePart} - ${formattedHours}:${minutes} ${ampm}`;
};

export const getInvoiceCleanAddress = (invoice: Invoice, settings: AppSettings, branches?: Branch[], activeBranchId?: string): string => {
  const branchObj = branches?.find(b => b.id === (invoice.branchId || activeBranchId));
  const rawAddress = branchObj?.address || settings.address || '';
  return rawAddress
    .replace(/جمهورية مصر العربية/gi, '')
    .replace(/^[\s,-]+|[\s,-]+$/g, '')
    .trim();
};

export const getInvoiceContactPhones = (invoice: Invoice, settings: AppSettings, branches?: Branch[], activeBranchId?: string): string => {
  const branchObj = branches?.find(b => b.id === (invoice.branchId || activeBranchId));
  const phoneList = [branchObj?.phone, settings.phone].filter(Boolean) as string[];
  const uniquePhones = Array.from(new Set(phoneList.map(p => p.trim()))).join(' - ');
  return uniquePhones || settings.phone || '';
};

export const calculateInvoiceReceiptTotals = (invoice: Invoice, settings: AppSettings) => {
  let grossItems = 0;
  let lineDiscounts = 0;
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  items.forEach(item => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const itemPrice = Number(item.price) || 0;
    const itemOrig = item.originalPrice !== undefined && item.originalPrice > itemPrice 
      ? Number(item.originalPrice) 
      : (item.discountAmount ? itemPrice + Number(item.discountAmount) : itemPrice);
    const itemDisc = Number(item.discountAmount) || (itemOrig > itemPrice ? itemOrig - itemPrice : 0);

    grossItems += itemOrig * qty;
    lineDiscounts += itemDisc * qty;
  });

  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Math.max(1, Number(item.quantity) || 1)), 0);
  const generalDiscount = Number(invoice.discount) || 0;
  const netTotal = Math.max(0, subtotal - generalDiscount);
  const advanceDeduction = Number(invoice.advanceDeduction) || 0;
  const netPaidToday = invoice.total !== undefined ? Number(invoice.total) : Math.max(0, netTotal - advanceDeduction);

  const totalDiscounts = lineDiscounts + generalDiscount;

  let baseTotal = netTotal;
  let vatAmt = 0;
  if (settings.vatEnabled) {
    const rate = Number(settings.vatRate) || 15;
    baseTotal = netTotal / (1 + rate / 100);
    vatAmt = netTotal - baseTotal;
  }

  return {
    grossItems,
    lineDiscounts,
    subtotal,
    generalDiscount,
    totalDiscounts,
    netTotal,
    advanceDeduction,
    netPaidToday,
    baseTotal,
    vatAmt
  };
};

export const executePrintInvoiceReceipt = (elementId: string, invoiceId?: string) => {
  const printElement = document.getElementById(elementId) || document.querySelector(`[id="${elementId}"]`);
  if (!printElement) {
    console.warn(`Could not find print element with id: ${elementId}`);
    return;
  }

  const printContent = printElement.outerHTML;

  // Try popup window first
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '', 'width=450,height=650');
  } catch {
    printWindow = null;
  }

  if (printWindow && !printWindow.closed) {
    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>طباعة الفاتورة${invoiceId ? ' - ' + escapeHtml(invoiceId) : ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      margin: 0 auto;
      padding: 2mm;
      background-color: #fff;
      direction: rtl;
      text-align: right;
      font-family: system-ui, -apple-system, sans-serif;
      color: #000;
      font-size: 11px;
      font-weight: bold;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: 80mm auto; margin: 0; }
    @media print { body { padding: 0; margin: 0 auto; width: 280px; } }
    .flex { display: flex !important; }
    .justify-between { justify-content: space-between !important; }
    .items-center { align-items: center !important; }
    .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    .whitespace-nowrap { white-space: nowrap !important; }
    .whitespace-normal { white-space: normal !important; }
    .break-words { word-break: break-word !important; }
    .font-mono { font-family: monospace !important; }
    .font-bold { font-weight: bold !important; }
    .text-center { text-align: center !important; }
    .text-left { text-align: left !important; }
    .border-y { border-top: 1px solid #000 !important; border-bottom: 1px solid #000 !important; }
    .border-t { border-top: 1px solid #000 !important; }
    .border-b { border-bottom: 1px solid #000 !important; }
    .border-dashed { border-style: dashed !important; }
    .border-dotted { border-style: dotted !important; }
    .border { border: 1px solid #000 !important; }
    .border-black { border-color: #000 !important; }
  </style>
</head>
<body>
  ${printContent}
</body>
</html>`);
    printWindow.document.close();

    printWindow.setTimeout(() => {
      try {
        printWindow?.focus();
        printWindow?.print();
        printWindow?.close();
      } catch (e) {
        console.warn('Print popup closed or failed:', e);
      }
    }, 350);
    return;
  }

  // Direct DOM insertion fallback matching BookingsScreen
  const printEl = document.createElement('div');
  printEl.id = 'print-invoice-receipt-direct';
  printEl.className = 'hidden print:block fixed inset-0 bg-white z-[9999] p-2 text-black';
  printEl.dir = 'rtl';
  printEl.innerHTML = printContent;
  document.body.appendChild(printEl);
  window.print();
  setTimeout(() => {
    if (document.body.contains(printEl)) {
      document.body.removeChild(printEl);
    }
  }, 200);
};

export const InvoiceReceiptCard: React.FC<InvoiceReceiptCardProps> = ({
  id,
  invoice,
  settings,
  branches,
  activeBranchId,
  currentUser,
  className = ''
}) => {
  const totals = calculateInvoiceReceiptTotals(invoice, settings);
  const createdDateTimeStr = formatInvoiceCreatedAt(invoice);
  const invoiceDateStr = formatInvoiceDate(invoice.date);
  const invoiceTimeStr = formatInvoiceTime(invoice.date);
  const cleanAddress = getInvoiceCleanAddress(invoice, settings, branches, activeBranchId);
  const contactPhones = getInvoiceContactPhones(invoice, settings, branches, activeBranchId);
  const branchObj = branches?.find(b => b.id === (invoice.branchId || activeBranchId));
  const branchName = branchObj?.name || 'داخل الصالون';
  const salonTitle = settings.salonName || 'صالون سمارت كت';
  const barcodeCode = invoice.id || 'INV000000';
  const barcodeSvg = generateCode39Svg(barcodeCode, 20);

  const cashierName = invoice.createdByName || 
    (invoice as any).created_by_name || 
    invoice.cashierName || 
    invoice.createdBy || 
    currentUser?.name || 
    (currentUser as any)?.username || 
    'الكاشير';

  const zatcaQrValue = invoice.zatcaQr || (settings.taxNumber ? generateZatcaQrBase64({
    sellerName: salonTitle,
    vatRegistrationNumber: settings.taxNumber,
    timestamp: invoice.date || new Date().toISOString(),
    invoiceTotal: invoice.total,
    vatTotal: totals.vatAmt
  }) : '');

  const invoiceBadge = invoice.status === 'cancelled'
    ? 'فاتورة ملغاة'
    : (settings.vatEnabled ? 'فاتورة ضريبية مبسطة' : 'فاتورة مبيعات');

  const advanceList = invoice.advancePayments || [];

  return (
    <div
      id={id}
      className={`bg-white p-3.5 rounded-xl shadow-xs border border-black w-full max-w-[300px] text-black font-sans space-y-1 text-[11px] font-bold select-text ${className}`}
      dir="rtl"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#000', direction: 'rtl', textAlign: 'right' }}
    >
      {/* 1. Salon Header */}
      <div className="text-center space-y-0.5" style={{ textAlign: 'center' }}>
        {settings.logoUrl && (
          <img
            src={sanitizeUrl(settings.logoUrl)}
            alt="Logo"
            className="max-h-10 mx-auto mb-1"
            style={{ maxHeight: '40px', margin: '0 auto 3px', display: 'block' }}
          />
        )}
        <h2 className="text-base font-bold text-black" style={{ fontSize: '15px', fontWeight: 'bold', margin: '0', color: '#000' }}>
          {salonTitle}
        </h2>
        <div
          className="inline-block border border-black px-2 py-0.5 font-bold text-[11px] text-black mt-0.5"
          style={{ display: 'inline-block', border: '1.5px solid #000', padding: '1px 8px', fontSize: '11px', fontWeight: 'bold', marginTop: '3px', color: '#000' }}
        >
          {invoiceBadge}
        </div>
      </div>

      {/* 2. Barcode section */}
      <div className="text-center py-0.5 bg-white" style={{ textAlign: 'center', margin: '2px 0 4px', padding: '2px 0' }}>
        <div
          className="max-w-[170px] mx-auto"
          style={{ maxWidth: '170px', margin: '0 auto' }}
          dangerouslySetInnerHTML={{ __html: barcodeSvg }}
        />
        <div
          className="font-mono text-xs font-bold tracking-wider text-black mt-0.5"
          style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', color: '#000', marginTop: '2px' }}
        >
          {barcodeCode}
        </div>
      </div>

      {/* 3. Info List on single lines */}
      <div
        className="space-y-0.5 text-[11px] font-bold text-black border-y border-dashed border-black py-1 leading-tight"
        style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: '#000', lineHeight: '1.45' }}
      >
        <div className="flex justify-between gap-2 whitespace-nowrap" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', whiteSpace: 'nowrap' }}>
          <span>التاريخ: <span style={{ fontWeight: 'bold' }}>{invoiceDateStr}</span></span>
          <span>الوقت: <span style={{ fontWeight: 'bold' }}>{invoiceTimeStr}</span></span>
        </div>
        <div className="flex justify-between gap-2 whitespace-nowrap" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', whiteSpace: 'nowrap' }}>
          <span className="truncate" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            العميل: <span style={{ fontWeight: 'bold' }}>{invoice.clientName || 'عميل نقدي'}</span>
          </span>
          <span>الفرع: <span style={{ fontWeight: 'bold' }}>{branchName}</span></span>
        </div>
        {invoice.clientPhone && (
          <div className="flex justify-between gap-2 whitespace-nowrap" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', whiteSpace: 'nowrap' }}>
            <span>
              جوال العميل: <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }} dir="ltr">{invoice.clientPhone}</span>
            </span>
          </div>
        )}
        {settings.taxNumber && (
          <div className="flex justify-between gap-2 whitespace-nowrap" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', whiteSpace: 'nowrap' }}>
            <span>الرقم الضريبي:</span>
            <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{settings.taxNumber}</span>
          </div>
        )}
        <div
          className="flex justify-between gap-2 whitespace-nowrap border-t border-dotted border-black pt-0.5 mt-0.5"
          style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', whiteSpace: 'nowrap', borderTop: '1px dotted #ccc', marginTop: '2px', paddingTop: '2px' }}
        >
          <span>منفذ العملية (الكاشير):</span>
          <span style={{ fontWeight: 'bold' }}>{cashierName}</span>
        </div>
      </div>

      {/* 4. Services & Products Table */}
      <div className="space-y-0.5 text-[11px] font-bold text-black" style={{ marginBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: '#000' }}>
        <div
          className="border-b border-black pb-0.5 flex justify-between font-bold text-black"
          style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000', paddingBottom: '2px', marginBottom: '2px', fontWeight: 'bold', color: '#000' }}
        >
          <span>البند (خدمة / منتج)</span>
          <span>السعر</span>
        </div>
        <div className="divide-y divide-dotted divide-black">
          {invoice.items?.map((item, idx) => {
            const isProd = item.type === 'product';
            const qty = Math.max(1, Number(item.quantity) || 1);
            const lineDisc = Number(item.discountAmount) || 0;
            const lineFinal = (Number(item.price) || 0) * qty;

            return (
              <div
                key={item.id || idx}
                className="py-0.5 flex justify-between items-center whitespace-nowrap gap-1.5 font-bold text-black"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderBottom: '1px dotted #000', fontWeight: 'bold', color: '#000', whiteSpace: 'nowrap', gap: '6px' }}
              >
                <div className="truncate" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 'bold' }}>{item.serviceName}</span>
                  {qty > 1 && <span style={{ fontWeight: 'bold' }}> (×{qty})</span>}
                  {isProd && (
                    <span
                      className="text-[9px] border border-black px-1 py-0 mr-1 font-bold"
                      style={{ fontSize: '9px', fontWeight: 'bold', border: '1px solid #000', padding: '0 2px', marginRight: '2px' }}
                    >
                      منتج
                    </span>
                  )}
                  {item.technicianName && (
                    <span
                      className="text-[9px] mr-1 font-normal text-slate-800"
                      style={{ fontSize: '9px', fontWeight: 'bold', marginRight: '2px', color: '#333' }}
                    >
                      ({item.technicianName})
                    </span>
                  )}
                  {lineDisc > 0 && (
                    <span
                      className="text-[9px] mr-1 font-bold"
                      style={{ fontSize: '9px', fontWeight: 'bold', marginRight: '2px' }}
                    >
                      [خصم: -{lineDisc.toFixed(2)}]
                    </span>
                  )}
                </div>
                <div
                  className="text-left font-mono flex-shrink-0 text-black font-bold"
                  style={{ fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'left', flexShrink: 0, color: '#000' }}
                >
                  {lineFinal.toFixed(2)} {settings.currency}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Totals Section */}
      <div
        className="border-t border-dashed border-black pt-1 space-y-0.5 text-[11px] font-bold text-black leading-tight"
        style={{ borderTop: '1px dashed #000', paddingTop: '3px', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: '#000', lineHeight: '1.4' }}
      >
        {totals.totalDiscounts > 0 && (
          <div className="flex justify-between whitespace-nowrap" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', marginBottom: '1px', fontWeight: 'bold', color: '#000' }}>
            <span>إجمالي البنود:</span>
            <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{totals.grossItems.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {totals.lineDiscounts > 0 && (
          <div className="flex justify-between whitespace-nowrap" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', marginBottom: '1px', fontWeight: 'bold', color: '#000' }}>
            <span>خصم البنود:</span>
            <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>-{totals.lineDiscounts.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {totals.generalDiscount > 0 && (
          <div className="flex justify-between whitespace-nowrap" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', marginBottom: '1px', fontWeight: 'bold', color: '#000' }}>
            <span>الخصم الإضافي:</span>
            <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>-{totals.generalDiscount.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {settings.vatEnabled && (
          <>
            <div className="flex justify-between whitespace-nowrap text-[10px]" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', marginBottom: '1px', fontWeight: 'bold', color: '#000', fontSize: '10px' }}>
              <span>المبلغ الخاضع للضريبة:</span>
              <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{totals.baseTotal.toFixed(2)} {settings.currency}</span>
            </div>
            <div className="flex justify-between whitespace-nowrap text-[10px]" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', marginBottom: '1px', fontWeight: 'bold', color: '#000', fontSize: '10px' }}>
              <span>ضريبة القيمة المضافة ({settings.vatRate || 15}%):</span>
              <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{totals.vatAmt.toFixed(2)} {settings.currency}</span>
            </div>
          </>
        )}

        <div
          className="flex justify-between font-bold text-black border-y border-dashed border-black py-0.5 whitespace-nowrap"
          style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '2px 0', margin: '2px 0', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 'bold', color: '#000' }}
        >
          <span>الصافي الإجمالي:</span>
          <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{totals.netTotal.toFixed(2)} {settings.currency}</span>
        </div>

        {totals.advanceDeduction > 0 && (
          <div className="space-y-0.5 pt-0.5">
            <div className="flex justify-between whitespace-nowrap" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', marginBottom: '1px', fontWeight: 'bold', color: '#000' }}>
              <span>المدفوع مقدماً (عربون الحجز):</span>
              <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>-{totals.advanceDeduction.toFixed(2)} {settings.currency}</span>
            </div>
            <div
              className="flex justify-between font-bold text-black border-t border-black pt-0.5 whitespace-nowrap"
              style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #000', paddingTop: '2px', marginTop: '2px', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 'bold', color: '#000' }}
            >
              <span>الصافي المدفوع اليوم:</span>
              <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{totals.netPaidToday.toFixed(2)} {settings.currency}</span>
            </div>
            {advanceList.length > 0 && (
              <div
                className="p-1 rounded-sm text-[10px] space-y-0.5 mt-0.5 border border-black text-black font-bold"
                style={{ marginTop: '3px', fontSize: '10px', fontWeight: 'bold', border: '1px solid #000', padding: '2px 4px', color: '#000' }}
              >
                <span className="block mb-0.5" style={{ display: 'block', marginBottom: '1px', fontWeight: 'bold' }}>تفاصيل الدفعات المقدمة:</span>
                {advanceList.map((adv, i) => (
                  <div key={adv.id || i} className="flex justify-between whitespace-nowrap font-mono text-black font-bold" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>
                    <span>• دفعة {i + 1} ({adv.treasuryName || (adv as any).paymentMethod || 'نقداً'}):</span>
                    <span>{Number(adv.amount || 0).toFixed(2)} {settings.currency}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Payment Methods */}
        {invoice.paymentMethods && invoice.paymentMethods.length > 0 && (
          <div
            className="p-1 rounded-sm text-[10px] space-y-0.5 mt-1 border border-black text-black font-bold"
            style={{ marginTop: '3px', fontSize: '10px', fontWeight: 'bold', border: '1px solid #000', padding: '2px 4px', color: '#000' }}
          >
            <span className="block mb-0.5" style={{ display: 'block', marginBottom: '1px', fontWeight: 'bold' }}>طرق الدفع:</span>
            {invoice.paymentMethods.map((pm, idx) => {
              const tName = pm.treasuryId === 'cashback'
                ? 'كاش باك'
                : (settings.treasuries?.find(t => t.id === pm.treasuryId)?.name || (pm as any).paymentMethod || 'نقداً');
              return (
                <div key={idx} className="flex justify-between whitespace-nowrap font-mono text-black font-bold" style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>
                  <span>• {tName}:</span>
                  <span>{Number(pm.amount || 0).toFixed(2)} {settings.currency}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Issuance date & time on single line */}
      <div
        className="flex justify-between border-t border-dashed border-black pt-1 mt-1 text-[10px] font-bold text-black whitespace-nowrap"
        style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000', paddingTop: '2px', marginTop: '3px', fontSize: '10px', fontWeight: 'bold', color: '#000', whiteSpace: 'nowrap' }}
      >
        <span>تاريخ ووقت إصدار الفاتورة:</span>
        <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{createdDateTimeStr}</span>
      </div>

      {/* 7. ZATCA QR Code (if applicable) */}
      {zatcaQrValue && (
        <div className="pt-1 flex flex-col items-center justify-center" style={{ paddingTop: '4px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#fff', padding: '2px' }}>
            <QRCodeSVG value={zatcaQrValue} size={84} level="M" />
          </div>
          <div className="text-[9px] text-black font-bold mt-0.5" style={{ fontSize: '9px', fontWeight: 'bold', color: '#000', marginTop: '2px' }}>
            رمز الفاتورة الإلكترونية (ZATCA)
          </div>
        </div>
      )}

      {/* 8. Salon Notes */}
      {settings.bookingNotes && (
        <div
          className="p-1 border border-dashed border-black text-center text-[10px] font-bold whitespace-pre-wrap text-black"
          style={{ marginTop: '3px', padding: '3px 5px', border: '1px dashed #000', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'pre-wrap', color: '#000' }}
        >
          {settings.bookingNotes}
        </div>
      )}

      {/* 9. Footer: Address, contact phones, appreciation message */}
      {(cleanAddress || contactPhones) && (
        <div
          className="pt-1.5 border-t border-dashed border-black text-center text-[10px] font-bold text-black space-y-0.5"
          style={{ marginTop: '4px', paddingTop: '3px', borderTop: '1px dashed #000', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', lineHeight: '1.35', color: '#000' }}
        >
          {cleanAddress && (
            <div className="leading-tight break-words whitespace-normal font-bold text-black" style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 'bold', color: '#000', marginBottom: '2px' }}>
              العنوان: {cleanAddress}
            </div>
          )}
          {contactPhones && (
            <div className="leading-tight font-bold text-black" style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 'bold', color: '#000' }}>
              <span>أرقام الاتصال: </span>
              <span className="font-mono font-bold" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{contactPhones}</span>
            </div>
          )}
        </div>
      )}

      <div
        className="text-center text-[10px] font-bold text-black pt-0.5"
        style={{ textAlign: 'center', marginTop: '3px', fontSize: '10px', fontWeight: 'bold', color: '#000' }}
      >
        شكراً لزيارتكم!
      </div>
    </div>
  );
};
