import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AppSettings, Invoice, Branch } from '../types';
import { generateCode39Svg } from '../utils/printQueueSlip';
import { generateZatcaQrBase64 } from '../utils/zatca';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize';
import { parseDbDateTime } from '../utils/timezone';

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
 * Strictly requires the country setting to be Saudi Arabia (does not rely on currency)
 */
export const isSaudiSalon = (settings: AppSettings, branches?: Branch[], branchId?: string): boolean => {
  const branchObj = branches?.find(b => b.id === branchId);
  const country = (branchObj?.country || settings?.country || '').trim();

  if (!country) return false;

  // Explicit non-Saudi check: Egypt, UAE, Kuwait, Oman, Qatar, Bahrain, Jordan, Iraq, Syria, Lebanon, Palestine, Yemen, Libya, Tunisia, Algeria, Morocco, Sudan, etc.
  if (/مصر|egypt|إمارات|امارات|uae|كويت|kuwait|عمان|oman|قطر|qatar|بحرين|bahrain|أردن|اردن|jordan|عراق|iraq|سوريا|syria|لبنان|lebanon|فلسطين|palestine|يمن|yemen|ليبيا|libya|تونس|tunis|جزائر|algeria|مغرب|morocco|سودان|sudan|موريتانيا|mauritania|صومال|somalia|جيبوتي|djibouti|قمر|comoros|دولار|other|أخرى/i.test(country)) {
    return false;
  }

  // Strictly check for Saudi Arabia
  return /المملكة العربية السعودية|السعودية|Saudi Arabia|KSA|^sa$/i.test(country);
};

export const formatInvoiceDate = (dateRaw?: string): string => {
  if (!dateRaw) return new Date().toISOString().split('T')[0];
  const d = parseDbDateTime(dateRaw);
  if (isNaN(d.getTime())) return dateRaw.split(/[T\s]/)[0] || dateRaw;
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
  const d = parseDbDateTime(dateRaw);
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
    const d = parseDbDateTime(createdRaw);
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
  const invoiceTotal = invoice.total !== undefined ? Number(invoice.total) : Math.max(0, netTotal - advanceDeduction);

  // احتساب المبلغ المدفوع الفعلي والمبلغ المتبقي الآجل بدقة
  let actualPaid = 0;
  let remaining = 0;

  if (invoice.status === 'deferred') {
    actualPaid = 0;
    remaining = invoice.remaining !== undefined ? Number(invoice.remaining) : invoiceTotal;
  } else if (invoice.status === 'partially_paid') {
    actualPaid = invoice.paid !== undefined ? Number(invoice.paid) : 0;
    remaining = invoice.remaining !== undefined ? Number(invoice.remaining) : Math.max(0, invoiceTotal - actualPaid);
  } else if (invoice.remaining !== undefined && Number(invoice.remaining) > 0.009) {
    actualPaid = invoice.paid !== undefined ? Number(invoice.paid) : Math.max(0, invoiceTotal - Number(invoice.remaining));
    remaining = Number(invoice.remaining);
  } else {
    // فاتورة مسددة بالكامل
    actualPaid = invoice.paid !== undefined ? Number(invoice.paid) : invoiceTotal;
    remaining = 0;
  }

  const isDeferred = invoice.status === 'deferred' || invoice.status === 'partially_paid' || remaining > 0.009;
  const isFullyDeferred = invoice.status === 'deferred' || (remaining >= invoiceTotal - 0.01 && actualPaid <= 0.01);
  const isPartiallyDeferred = isDeferred && !isFullyDeferred && actualPaid > 0;

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
    invoiceTotal,
    netPaidToday: actualPaid,
    actualPaid,
    remaining,
    isDeferred,
    isFullyDeferred,
    isPartiallyDeferred,
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

  // 1. Electron Desktop App silent direct print (Zero dialogs!)
  if (typeof window !== 'undefined' && (window as any).desktopAPI?.printSilent) {
    try {
      (window as any).desktopAPI.printSilent({
        html: printContent,
        deviceName: ''
      });
      return;
    } catch (e) {
      console.warn('desktopAPI printSilent notice:', e);
    }
  }

  // 2. Direct hidden iframe print (No popup windows, silent printing if kiosk-printing is configured)
  try {
    const oldIframe = document.getElementById('direct-receipt-print-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'direct-receipt-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`<!DOCTYPE html>
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
</body>
</html>`);
      doc.close();

      const trigger = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error:', e);
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            iframe.remove();
          }
        }, 3000);
      };

      const img = doc.querySelector('img');
      if (img && !img.complete) {
        img.onload = () => setTimeout(trigger, 50);
        img.onerror = () => setTimeout(trigger, 50);
        setTimeout(trigger, 300);
      } else {
        setTimeout(trigger, 80);
      }
      return;
    }
  } catch (err) {
    console.error('Direct iframe print failed, falling back:', err);
  }

  // 3. Fallback to in-DOM print
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
    : (invoice.isWaselInvoice
      ? 'فاتورة واصل (خدمات مجانية)'
      : (invoice.isRemedyInvoice
        ? 'فاتورة إصلاح مجاني (ضمان)'
        : (totals.isFullyDeferred
          ? (settings.vatEnabled ? 'فاتورة ضريبية مبسطة (آجلة بالكامل)' : 'فاتورة مبيعات آجلة بالكامل')
          : totals.isPartiallyDeferred
            ? (settings.vatEnabled ? 'فاتورة ضريبية مبسطة (سداد جزئي + آجل)' : 'فاتورة مبيعات (سداد جزئي + آجل)')
            : (settings.vatEnabled ? 'فاتورة ضريبية مبسطة' : 'فاتورة مبيعات'))));

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
        {invoice.isWaselInvoice && (
          <div style={{ marginTop: '4px', padding: '3px 5px', border: '1px solid #000', backgroundColor: '#f9f9f9', fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
              <span>المستفيد من واصل:</span>
              <span style={{ fontWeight: 'bold' }}>{invoice.waselRecipientName || invoice.clientName || '-'}</span>
            </div>
            {invoice.waselReason && (
              <div style={{ marginTop: '2px', color: '#000' }}>
                <span>السبب / الملاحظة: </span>
                <span style={{ fontWeight: 'normal' }}>{invoice.waselReason}</span>
              </div>
            )}
          </div>
        )}
        {invoice.isRemedyInvoice && (
          <div style={{ marginTop: '4px', padding: '3px 5px', border: '1px solid #000', backgroundColor: '#f9f9f9', fontSize: '10px' }}>
            <div style={{ color: '#000', fontWeight: 'bold' }}>إصلاح مجاني (ضمان الصالون)</div>
            {invoice.remedyReason && (
              <div style={{ marginTop: '2px', color: '#000', fontWeight: 'normal' }}>{invoice.remedyReason}</div>
            )}
          </div>
        )}
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

        {/* إجمالي قيمة الفاتورة */}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', marginBottom: '2px', fontSize: '11px', fontWeight: 'bold' }}>
          <span>إجمالي قيمة الفاتورة:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>
            {totals.invoiceTotal.toFixed(2)} {settings.currency}
          </span>
        </div>

        {/* المبلغ المدفوع اليوم */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 'bold',
          fontSize: '12px',
          marginTop: '4px',
          paddingTop: '3px',
          borderTop: '1.5px solid #000',
          borderBottom: totals.isDeferred ? '1px dashed #000' : '1.5px solid #000',
          paddingBottom: '3px',
          color: '#000'
        }}>
          <span>
            {totals.isFullyDeferred 
              ? 'المبلغ المدفوع اليوم (تأجيل كلي):' 
              : totals.isPartiallyDeferred 
                ? 'المبلغ المدفوع اليوم (سداد جزئي):' 
                : 'الصافي المدفوع اليوم:'}
          </span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>
            {totals.actualPaid.toFixed(2)} {settings.currency}
          </span>
        </div>

        {/* المبلغ المتبقي الآجل على ذمة العميل */}
        {totals.isDeferred && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 'bold',
            fontSize: '11.5px',
            marginTop: '3px',
            padding: '2.5px 4px',
            border: '1.5px solid #000',
            backgroundColor: '#f5f5f5',
            color: '#000'
          }}>
            <span>المتبقي (آجل على ذمة العميل):</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#000' }}>
              {totals.remaining.toFixed(2)} {settings.currency}
            </span>
          </div>
        )}

        {/* تاريخ الاستحقاق إن وجد */}
        {totals.isDeferred && invoice.dueDate && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#000', marginTop: '2px', padding: '0 2px' }}>
            <span>تاريخ استحقاق الآجل:</span>
            <span style={{ fontFamily: 'monospace' }}>{invoice.dueDate.split('T')[0]}</span>
          </div>
        )}

        {/* طرق السداد */}
        {totals.isFullyDeferred ? (
          <div style={{ marginTop: '4px', paddingTop: '3px', borderTop: '1px dashed #000', fontSize: '10px', color: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontWeight: 'bold' }}>
              <span>طريقة السداد:</span>
              <span>آجل بالكامل (ذمم عملاء)</span>
            </div>
            {invoice.notes && (
              <div style={{ fontSize: '9px', marginTop: '1px', color: '#333' }}>
                ملاحظات: {invoice.notes}
              </div>
            )}
          </div>
        ) : (
          <>
            {((invoice.paymentMethods && invoice.paymentMethods.length > 0) || totals.isPartiallyDeferred) && (
              <div style={{ marginTop: '4px', paddingTop: '3px', borderTop: '1px dashed #000', fontSize: '10px', color: '#000' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '2px', color: '#000' }}>
                  {totals.isPartiallyDeferred ? 'طريقة سداد الدفعة المسددة اليوم:' : 'طرق الدفع:'}
                </div>
                {invoice.paymentMethods && invoice.paymentMethods.length > 0 ? (
                  invoice.paymentMethods
                    .filter(pm => Number(pm.amount || 0) > 0)
                    .map((pm, idx) => {
                      const tName = pm.treasuryId === 'cashback'
                        ? 'كاش باك'
                        : (pm.treasuryId === 'wasel_free'
                          ? 'خدمات مجانية (واصل)'
                          : (pm.treasuryId === 'remedy_free'
                            ? 'إصلاح مجاني (ضمان)'
                            : (settings.treasuries?.find(t => t.id === pm.treasuryId)?.name || (pm as any).paymentMethod || 'غير محدد')));
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          <span>• {tName}:</span>
                          <span>{Number(pm.amount || 0).toFixed(2)} {settings.currency}</span>
                        </div>
                      );
                    })
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    <span>• {settings.treasuries?.find(t => t.id === invoice.treasuryId || t.id === invoice.paymentMethod)?.name || invoice.paymentMethod || 'كاش'}:</span>
                    <span>{totals.actualPaid.toFixed(2)} {settings.currency}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* سجل دفعات سداد الفاتورة في حال وجود دفعات تاريخية */}
        {invoice.paymentsHistory && invoice.paymentsHistory.length > 1 && (
          <div style={{ marginTop: '4px', paddingTop: '3px', borderTop: '1px dotted #000', fontSize: '9px', color: '#000' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>سجل دفعات سداد الفاتورة:</div>
            {invoice.paymentsHistory.map((pmt: any, idx: number) => (
              <div key={pmt.id || idx} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
                <span>• {pmt.paymentMethod || 'دفعة'} ({pmt.date?.split('T')[0] || ''}):</span>
                <span>{Number(pmt.amount || 0).toFixed(2)} {settings.currency}</span>
              </div>
            ))}
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
