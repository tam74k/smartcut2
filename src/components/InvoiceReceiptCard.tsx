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

/**
 * Check if the salon or branch is located in Saudi Arabia
 */
export const isSaudiSalon = (settings: AppSettings, branches?: Branch[], branchId?: string): boolean => {
  const branchObj = branches?.find(b => b.id === branchId);
  const country = (branchObj?.country || settings.country || '').trim();
  const currency = (branchObj?.currency || settings.currency || '').trim().toUpperCase();

  // If currency is SAR, it is Saudi Arabia
  if (currency === 'SAR') return true;
  // If country name indicates Saudi Arabia
  if (/السعودية|saudi|ksa|^sa$/i.test(country)) return true;
  // If explicitly non-Saudi
  if (/مصر|egypt|egp|إمارات|امارات|uae|aed|كويت|kuwait|kwd|عمان|oman|قطر|qatar|بحرين|bahrain|أردن|اردن|jordan/i.test(country)) return false;

  return false;
};

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
    * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; }
    body {
      margin: 0 auto;
      padding: 1.5mm 2.5mm;
      background-color: #fff;
      direction: rtl;
      text-align: right;
      font-family: "Cairo", system-ui, -apple-system, sans-serif;
      color: #000 !important;
      font-size: 10.5px;
      font-weight: bold;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: 80mm auto; margin: 0; }
    @media print { 
      body { padding: 0; margin: 0 auto; width: 280px; color: #000 !important; }
      * { color: #000 !important; }
    }
    table { width: 100% !important; border-collapse: collapse !important; color: #000 !important; }
    th, td { color: #000 !important; }
    .flex { display: flex !important; }
    .justify-between { justify-content: space-between !important; }
    .items-center { align-items: center !important; }
    .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    .font-mono { font-family: monospace !important; }
    .font-bold { font-weight: bold !important; }
    .text-center { text-align: center !important; }
    .text-left { text-align: left !important; }
  </style>
</head>
<body>
  ${printContent}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
        setTimeout(function() { window.close(); }, 500);
      }, 150);
    });
    setTimeout(function() {
      window.focus();
      window.print();
      setTimeout(function() { window.close(); }, 500);
    }, 450);
  </script>
</body>
</html>`);
    printWindow.document.close();

    printWindow.setTimeout(() => {
      try {
        printWindow?.focus();
        printWindow?.print();
      } catch (e) {
        console.warn('Print popup closed or failed:', e);
      }
    }, 400);
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
  }, 1500);
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
  const invoiceDateStr = formatInvoiceDate(invoice.date);
  const invoiceTimeStr = formatInvoiceTime(invoice.date);
  const cleanAddress = getInvoiceCleanAddress(invoice, settings, branches, activeBranchId);
  const contactPhones = getInvoiceContactPhones(invoice, settings, branches, activeBranchId);
  const branchObj = branches?.find(b => b.id === (invoice.branchId || activeBranchId));
  const branchName = branchObj?.name || 'داخل الصالون';
  const salonTitle = settings.salonName || 'صالون العناية';
  const barcodeCode = invoice.id || 'INV000000';
  const barcodeSvg = generateCode39Svg(barcodeCode, 24);

  const cashierName = invoice.createdByName || 
    (invoice as any).created_by_name || 
    invoice.cashierName || 
    invoice.createdBy || 
    currentUser?.name || 
    (currentUser as any)?.username || 
    'الكاشير';

  // Check if salon is in Saudi Arabia for ZATCA QR
  const showZatcaQr = isSaudiSalon(settings, branches, invoice.branchId || activeBranchId);
  const zatcaQrValue = showZatcaQr ? (invoice.zatcaQr || (settings.taxNumber ? generateZatcaQrBase64({
    sellerName: salonTitle,
    vatRegistrationNumber: settings.taxNumber,
    timestamp: invoice.date || new Date().toISOString(),
    invoiceTotal: invoice.total,
    vatTotal: totals.vatAmt
  }) : '')) : '';

  const invoiceBadge = invoice.status === 'cancelled'
    ? 'فاتورة ملغاة'
    : (settings.vatEnabled ? 'فاتورة ضريبية مبسطة' : 'فاتورة مبيعات');

  const advanceList = invoice.advancePayments || [];

  return (
    <div
      id={id}
      className={`bg-white shadow-sm w-full max-w-[280px] text-black font-sans select-text ${className}`}
      dir="rtl"
      style={{
        width: '100%',
        maxWidth: '72mm',
        padding: '3.5mm 4mm',
        fontFamily: '"Cairo", system-ui, -apple-system, sans-serif',
        color: '#000',
        backgroundColor: '#fff',
        direction: 'rtl',
        textAlign: 'right',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}
    >
      {/* 1. Salon Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        {settings.logoUrl && (
          <img
            src={sanitizeUrl(settings.logoUrl)}
            alt="Logo"
            style={{ maxWidth: '70px', maxHeight: '70px', margin: '0 auto 4px auto', display: 'block' }}
          />
        )}
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 3px 0', color: '#000', lineHeight: '1.25' }}>
          {salonTitle}
        </h2>
        <div
          style={{
            display: 'inline-block',
            border: '1px solid #000',
            padding: '1px 7px',
            fontSize: '10px',
            fontWeight: 'bold',
            marginTop: '2px',
            color: '#000'
          }}
        >
          {invoiceBadge}
        </div>

        {/* 2. Barcode section under Salon Name */}
        {barcodeCode && (
          <div style={{ margin: '5px auto 3px auto', maxWidth: '180px', textAlign: 'center' }}>
            <div
              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
              style={{ display: 'flex', justifyContent: 'center' }}
            />
            <div style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginTop: '1px', color: '#000' }}>
              {barcodeCode}
            </div>
          </div>
        )}
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

      {/* 3. Invoice Metadata List (Each on its own line) */}
      <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#000', lineHeight: '1.45', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
          <span>رقم الفاتورة:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>{invoice.id}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
          <span>التاريخ:</span>
          <span style={{ color: '#000' }}>{invoiceDateStr} {invoiceTimeStr}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
          <span>العميل:</span>
          <span style={{ fontWeight: 'bold', color: '#000' }}>{invoice.clientName || 'عميل نقدي'}</span>
        </div>
        {invoice.clientPhone && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
            <span>جوال العميل:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }} dir="ltr">{invoice.clientPhone}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
          <span>الفرع:</span>
          <span style={{ color: '#000' }}>{branchName}</span>
        </div>
        {settings.taxNumber && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
            <span>الرقم الضريبي:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>{settings.taxNumber}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dotted #000', marginTop: '2px', paddingTop: '2px', color: '#000' }}>
          <span>منفذ العملية (الكاشير):</span>
          <span style={{ fontWeight: 'bold', color: '#000' }}>{cashierName}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

      {/* 4. Services & Products Table */}
      <table style={{ width: '100%', fontSize: '10.5px', textAlign: 'right', borderCollapse: 'collapse', color: '#000', margin: '4px 0' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #000', color: '#000' }}>
            <th style={{ padding: '3px 0', width: '52%', textAlign: 'right', color: '#000', fontWeight: 'bold' }}>الصنف</th>
            <th style={{ padding: '3px 0', width: '18%', textAlign: 'center', color: '#000', fontWeight: 'bold' }}>الكمية</th>
            <th style={{ padding: '3px 0', width: '30%', textAlign: 'left', color: '#000', fontWeight: 'bold' }}>السعر</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, idx) => {
            const isProd = item.type === 'product';
            const qty = Math.max(1, Number(item.quantity) || 1);
            const lineDisc = Number(item.discountAmount) || 0;
            const lineFinal = (Number(item.price) || 0) * qty;

            return (
              <tr key={item.id || idx} style={{ borderBottom: '1px dotted #000', color: '#000' }}>
                <td style={{ padding: '3px 0', textAlign: 'right', color: '#000' }}>
                  <div style={{ fontWeight: 'bold', color: '#000', lineHeight: '1.25' }}>
                    {item.serviceName}
                    {isProd && (
                      <span style={{ fontSize: '9px', border: '1px solid #000', padding: '0 2px', marginRight: '3px', fontWeight: 'bold', color: '#000' }}>
                        منتج
                      </span>
                    )}
                  </div>
                  {item.technicianName && (
                    <div style={{ fontSize: '9.5px', color: '#000', fontWeight: 'bold', marginTop: '1px' }}>
                      بواسطة: {item.technicianName}
                    </div>
                  )}
                  {lineDisc > 0 && (
                    <div style={{ fontSize: '9px', color: '#000', fontWeight: 'bold' }}>
                      خصم: -{lineDisc.toFixed(2)}
                    </div>
                  )}
                </td>
                <td style={{ padding: '3px 0', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>
                  {qty}
                </td>
                <td style={{ padding: '3px 0', textAlign: 'left', fontWeight: 'bold', color: '#000', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {lineFinal.toFixed(2)} {settings.currency}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

      {/* 5. Totals Section */}
      <div style={{ fontSize: '10.5px', lineHeight: '1.45', color: '#000', fontWeight: 'bold' }}>
        {totals.totalDiscounts > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', marginBottom: '1px' }}>
            <span>المجموع:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>{totals.grossItems.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {totals.lineDiscounts > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', marginBottom: '1px' }}>
            <span>خصم البنود:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>-{totals.lineDiscounts.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {totals.generalDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', marginBottom: '1px' }}>
            <span>الخصم الإضافي:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>-{totals.generalDiscount.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {settings.vatEnabled && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontSize: '10px', marginBottom: '1px' }}>
              <span>المبلغ قبل الضريبة:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>{totals.baseTotal.toFixed(2)} {settings.currency}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontSize: '10px', marginBottom: '1px' }}>
              <span>الضريبة ({settings.vatRate || 15}%):</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>{totals.vatAmt.toFixed(2)} شامل</span>
            </div>
          </>
        )}

        {totals.advanceDeduction > 0 && (
          <div style={{ margin: '3px 0', padding: '2px 0', borderTop: '1px dotted #000', borderBottom: '1px dotted #000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontWeight: 'bold' }}>
              <span>المدفوع مقدماً (عربون الحجز):</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>-{totals.advanceDeduction.toFixed(2)} {settings.currency}</span>
            </div>
            {advanceList.length > 0 && (
              <div style={{ fontSize: '9.5px', color: '#000', marginTop: '2px' }}>
                {advanceList.map((adv, idx) => (
                  <div key={adv.id || idx} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '4px', color: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    <span>• {adv.treasuryName || (adv as any).paymentMethod || 'دفعة'} ({adv.date?.split('T')[0] || ''}):</span>
                    <span>{Number(adv.amount || 0).toFixed(2)} {settings.currency}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 'bold',
          fontSize: '12px',
          marginTop: '4px',
          paddingTop: '3px',
          borderTop: '1.5px solid #000',
          borderBottom: '1.5px solid #000',
          paddingBottom: '3px',
          color: '#000'
        }}>
          <span>الصافي المدفوع اليوم:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>{totals.netPaidToday.toFixed(2)} {settings.currency}</span>
        </div>

        {/* Payment Methods */}
        {invoice.paymentMethods && invoice.paymentMethods.length > 0 && (
          <div style={{ marginTop: '4px', paddingTop: '3px', borderTop: '1px dashed #000', fontSize: '10px', color: '#000' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '2px', color: '#000' }}>طرق الدفع:</div>
            {invoice.paymentMethods.map((pm, idx) => {
              const tName = pm.treasuryId === 'cashback'
                ? 'كاش باك'
                : (settings.treasuries?.find(t => t.id === pm.treasuryId)?.name || (pm as any).paymentMethod || 'غير محدد');
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  <span>• {tName}:</span>
                  <span>{Number(pm.amount || 0).toFixed(2)} {settings.currency}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. ZATCA QR Code (Shown ONLY for Saudi Arabia) */}
      {showZatcaQr && zatcaQrValue && (
        <div style={{ paddingTop: '6px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#fff', padding: '2px' }}>
            <QRCodeSVG value={zatcaQrValue} size={75} level="M" />
          </div>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#000', marginTop: '2px' }}>
            رمز الفاتورة الإلكترونية (ZATCA)
          </div>
        </div>
      )}

      {/* 7. Footer: Appreciation, address, and phones */}
      <div style={{ textAlign: 'center', marginTop: '8px', paddingTop: '5px', borderTop: '1px dashed #000', fontSize: '10px', fontWeight: 'bold', color: '#000' }}>
        <p style={{ margin: '0 0 3px 0', color: '#000' }}>شكراً لزيارتكم!</p>
        {cleanAddress && (
          <p style={{ fontSize: '9.5px', fontWeight: 'bold', margin: '2px 0', color: '#000', whiteSpace: 'normal', wordBreak: 'break-word' }}>
            العنوان: {cleanAddress}
          </p>
        )}
        {contactPhones && (
          <p style={{ fontSize: '9.5px', fontWeight: 'bold', margin: '2px 0', color: '#000' }}>
            جوال: <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }} dir="ltr">{contactPhones}</span>
          </p>
        )}
      </div>
    </div>
  );
};
