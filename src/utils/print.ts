/**
 * Smart Cut Professional Receipt & Report Printing Utility
 * Supports 80mm / 58mm Thermal Printers and A4 Sheets with ZATCA QR
 */

/**
 * Sanitizes printable HTML content to prevent XSS execution while preserving styling and structure
 */
function sanitizePrintHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript:/gi, '');
}

export function getPrintStyles(paperSize: '80mm' | '58mm' | 'a4' = '80mm', isLandscape: boolean = false): string {
  const isA4 = paperSize === 'a4';
  const is58 = paperSize === '58mm';
  const widthMm = isA4 ? (isLandscape ? '280mm' : '200mm') : (is58 ? '52mm' : '72mm');

  return `
    * {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    }
    body {
      margin: 0 auto !important;
      padding: 0 !important;
      background-color: #fff !important;
      color: #000 !important;
      direction: rtl !important;
      text-align: right !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .justify-between { justify-content: space-between !important; }
    .justify-center { justify-content: center !important; }
    .items-center { align-items: center !important; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-left { text-align: left !important; }
    .font-bold { font-weight: 700 !important; }
    .font-extrabold { font-weight: 800 !important; }
    .font-black { font-weight: 900 !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-mono { font-family: ui-monospace, monospace !important; }
    .text-xs { font-size: 11px !important; line-height: 1.35 !important; }
    .text-sm { font-size: 13px !important; }
    .text-base { font-size: 15px !important; }
    .text-lg { font-size: 17px !important; }
    .text-xl { font-size: 19px !important; }
    .text-2xl { font-size: 22px !important; }
    .border-b { border-bottom: 1px solid #000 !important; }
    .border-t { border-top: 1px solid #000 !important; }
    .border-black { border-color: #000 !important; }
    .border-dashed { border-style: dashed !important; }
    .border { border: 1px solid #ccc !important; }
    .bg-gray-100, .bg-slate-50, .bg-slate-100 { background-color: #f1f5f9 !important; }
    .bg-emerald-50 { background-color: #ecfdf5 !important; }
    .text-emerald-700, .text-emerald-800 { color: #047857 !important; }
    .text-red-700 { color: #b91c1c !important; }
    .text-gray-700, .text-slate-700 { color: #334155 !important; }
    .text-slate-800 { color: #1e293b !important; }
    .p-1 { padding: 4px !important; }
    .p-2 { padding: 8px !important; }
    .p-4 { padding: 14px !important; }
    .px-1 { padding-left: 4px !important; padding-right: 4px !important; }
    .py-0\\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }
    .pb-1 { padding-bottom: 4px !important; }
    .pb-2 { padding-bottom: 8px !important; }
    .pb-3 { padding-bottom: 12px !important; }
    .pb-4 { padding-bottom: 14px !important; }
    .pt-1 { padding-top: 4px !important; }
    .pt-2 { padding-top: 8px !important; }
    .mb-1 { margin-bottom: 4px !important; }
    .mb-2 { margin-bottom: 8px !important; }
    .mb-3 { margin-bottom: 12px !important; }
    .mb-4 { margin-bottom: 14px !important; }
    .mb-6 { margin-bottom: 20px !important; }
    .mt-1 { margin-top: 4px !important; }
    .mt-2 { margin-top: 8px !important; }
    .mt-6 { margin-top: 20px !important; }
    .mx-auto { margin-left: auto !important; margin-right: auto !important; }
    .w-full { width: 100% !important; }
    .w-\\[72mm\\] { width: 72mm !important; }
    .w-\\[70mm\\] { width: 70mm !important; }
    .w-\\[52mm\\] { width: 52mm !important; }
    .w-24 { width: 5rem !important; }
    .h-24 { height: 5rem !important; }
    .rounded { border-radius: 4px !important; }
    .rounded-xl { border-radius: 8px !important; }
    .space-y-1 > * + * { margin-top: 4px !important; }
    .space-y-2 > * + * { margin-top: 8px !important; }
    .grayscale { filter: grayscale(100%) !important; }
    .object-contain { object-fit: contain !important; }
    .print\\:hidden { display: none !important; }
    table { width: 100% !important; border-collapse: collapse !important; }
    th, td { padding: 4px 6px !important; text-align: right !important; }
    @media print {
      @page {
        ${isA4
          ? (isLandscape ? 'size: A4 landscape; margin: 8mm;' : 'size: A4 portrait; margin: 8mm;')
          : (is58 ? 'size: 58mm auto; margin: 0;' : 'size: 80mm auto; margin: 0;')}
      }
      body {
        width: ${widthMm} !important;
        max-width: ${widthMm} !important;
        margin: 0 auto !important;
        padding: 0 !important;
      }
    }
  `;
}

export function printViaHiddenIframe(htmlContent: string, isLandscape: boolean = false, paperSize: '80mm' | '58mm' | 'a4' = '80mm'): boolean {
  try {
    const oldIframe = document.getElementById('smartcut-print-hidden-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'smartcut-print-hidden-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return false;

    let widthStyle = 'width: 72mm; max-width: 72mm;';
    if (paperSize === '58mm') widthStyle = 'width: 52mm; max-width: 52mm;';
    if (paperSize === 'a4') widthStyle = isLandscape ? 'width: 280mm; max-width: 280mm;' : 'width: 200mm; max-width: 200mm;';

    const safeContent = sanitizePrintHtml(htmlContent);

    doc.open();
    doc.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>طباعة</title>
  <style>
    ${getPrintStyles(paperSize, isLandscape)}
  </style>
</head>
<body class="bg-white text-black text-xs">
  <div style="${widthStyle} margin: 0 auto; padding: 2mm;">
    ${safeContent}
  </div>
</body>
</html>`);
    doc.close();

    const trigger = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('Iframe print trigger failed:', e);
      }
      setTimeout(() => iframe.remove(), 2500);
    };

    const img = doc.querySelector('img');
    if (img && !img.complete) {
      img.onload = () => setTimeout(trigger, 60);
      img.onerror = () => setTimeout(trigger, 60);
      setTimeout(trigger, 300);
    } else {
      setTimeout(trigger, 80);
    }
    return true;
  } catch (err) {
    console.error('printViaHiddenIframe error:', err);
    return false;
  }
}

export const handlePrintReceipt = (elementId: string, isLandscape: boolean = false, paperSize: '80mm' | '58mm' | 'a4' = '80mm') => {
  const printElement = document.getElementById(elementId) || document.querySelector(`[id="${elementId}"]`);
  if (!printElement) {
    alert("لا يمكن العثور على التقرير أو الفاتورة للطباعة");
    return;
  }

  const safeContent = sanitizePrintHtml(printElement.innerHTML);

  // 1. Try opening popup window
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank');
  } catch (e) {
    printWindow = null;
  }

  // 2. If popup is blocked or unavailable, use bulletproof hidden iframe printing
  if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
    const success = printViaHiddenIframe(safeContent, isLandscape, paperSize);
    if (!success) {
      window.print();
    }
    return;
  }

  let widthStyle = 'width: 72mm; max-width: 72mm;';
  if (paperSize === '58mm') widthStyle = 'width: 52mm; max-width: 52mm;';
  if (paperSize === 'a4') widthStyle = isLandscape ? 'width: 280mm; max-width: 280mm;' : 'width: 200mm; max-width: 200mm;';

  printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>طباعة - Smart Cut</title>
  <style>
    ${getPrintStyles(paperSize, isLandscape)}
  </style>
</head>
<body class="bg-white text-black text-xs">
  <div style="${widthStyle} margin: 0 auto; padding: 2mm;">
    ${safeContent}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
        window.close();
      }, 150);
    });
    setTimeout(function() {
      window.focus();
      window.print();
      window.close();
    }, 450);
  </script>
</body>
</html>`);
  printWindow.document.close();
};

export const printHtml = (htmlContent: string, title: string = 'طباعة') => {
  const safeContent = sanitizePrintHtml(htmlContent);

  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank');
  } catch (e) {
    printWindow = null;
  }

  if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
    const success = printViaHiddenIframe(safeContent, false, '80mm');
    if (!success) window.print();
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    ${getPrintStyles('80mm', false)}
  </style>
</head>
<body class="bg-white text-black text-xs">
  <div style="width: 72mm; max-width: 72mm; margin: 0 auto; padding: 2mm;">
    ${safeContent}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
        window.close();
      }, 150);
    });
    setTimeout(function() {
      window.focus();
      window.print();
      window.close();
    }, 450);
  </script>
</body>
</html>`);
  printWindow.document.close();
};

/**
 * Detects if the current device is a mobile phone or tablet (Android, iOS, iPad, etc.)
 */
export function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();

  // 1. Mobile & tablet user agent pattern
  const mobileRegex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i;
  if (mobileRegex.test(ua)) return true;

  // 2. iOS 13+ iPad detection (reports as MacIntel with touch points)
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;

  // 3. Touch device with tablet or mobile viewport width (<= 1024px)
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isTabletOrMobileWidth = window.innerWidth <= 1024;
  if (hasTouch && isTabletOrMobileWidth) return true;

  return false;
}

/**
 * Sends a silent print command to the printer physically connected to the main PC/server
 * via the backend server printer bridge without opening any local dialog or popup.
 */
export async function printHtmlToMainServer(htmlContent: string, printerName?: string): Promise<boolean> {
  const safeContent = sanitizePrintHtml(htmlContent);

  const candidateUrls: string[] = ['/api/printer/print-receipt'];
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const directUrl = `${window.location.protocol}//${window.location.hostname}:3001/api/printer/print-receipt`;
    if (!candidateUrls.includes(directUrl)) {
      candidateUrls.push(directUrl);
    }
  }

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: safeContent,
          printerName: printerName || ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          console.log('[Print] Silent remote print job delivered to main PC printer successfully');
          return true;
        }
      }
    } catch (e) {
      // try next candidate
    }
  }

  return false;
}

/**
 * Direct Silent Print (zero dialogs in Electron desktop, or direct hidden iframe in browser)
 */
export async function directPrintHtml(htmlContent: string, printerName?: string): Promise<boolean> {
  const safeContent = sanitizePrintHtml(htmlContent);

  // If on mobile or tablet, ALWAYS send silently to the main server printer and NEVER open local dialogs or iframes
  if (isMobileOrTablet()) {
    return await printHtmlToMainServer(safeContent, printerName);
  }

  // 1. Electron Desktop App silent printing (Zero dialogs!)
  if (typeof window !== 'undefined' && (window as any).desktopAPI?.printSilent) {
    try {
      const res = await (window as any).desktopAPI.printSilent({
        html: safeContent,
        deviceName: printerName || ''
      });
      if (res?.success) return true;
    } catch (e) {
      console.warn('desktopAPI printSilent notice:', e);
    }
  }

  // 2. Local network printer bridge
  const serverPrinted = await printHtmlToMainServer(safeContent, printerName);
  if (serverPrinted) return true;

  // 3. Browser hidden iframe with auto-print
  try {
    const oldIframe = document.getElementById('direct-silent-print-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'direct-silent-print-iframe';
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
  <title>طباعة مباشرة</title>
  <style>
    ${getPrintStyles('80mm', false)}
  </style>
</head>
<body class="bg-white text-black text-xs">
  <div style="width: 72mm; max-width: 72mm; margin: 0 auto; padding: 2mm;">
    ${safeContent}
  </div>
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
        setTimeout(() => iframe.remove(), 2500);
      };

      const img = doc.querySelector('img');
      if (img && !img.complete) {
        img.onload = () => setTimeout(trigger, 50);
        img.onerror = () => setTimeout(trigger, 50);
        setTimeout(trigger, 350);
      } else {
        setTimeout(trigger, 100);
      }
      return true;
    }
  } catch (e) {
    console.error('Direct print failed:', e);
  }

  return false;
}

