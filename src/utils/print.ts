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

export const handlePrintReceipt = (elementId: string, isLandscape: boolean = false, paperSize: '80mm' | '58mm' | 'a4' = '80mm') => {
  const printElement = document.getElementById(elementId) || document.querySelector(`[id="${elementId}"]`);
  if (!printElement) {
    console.warn(`Print element not found by ID: ${elementId}, falling back to window.print()`);
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    let widthClass = 'w-[76mm]';
    if (paperSize === '58mm') widthClass = 'w-[52mm]';
    if (paperSize === 'a4') widthClass = isLandscape ? 'w-[280mm]' : 'w-[200mm]';

    const safeContent = sanitizePrintHtml(printElement.innerHTML);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>طباعة - Smart Cut</title>
          <base href="${window.location.origin}">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            * {
              font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
              box-sizing: border-box;
            }
            .flex { display: flex !important; }
            .justify-between { justify-content: space-between !important; }
            .items-center { align-items: center !important; }
            .text-center { text-align: center !important; }
            .font-bold { font-weight: bold !important; }
            .border-b { border-bottom: 1px solid #000 !important; }
            .border-t { border-top: 1px solid #000 !important; }
            .border-dashed { border-style: dashed !important; }
            .font-mono { font-family: monospace, sans-serif !important; }
            @media print {
              @page {
                ${paperSize === 'a4' 
                  ? (isLandscape ? 'size: A4 landscape; margin: 10mm;' : 'size: A4 portrait; margin: 10mm;') 
                  : (paperSize === '58mm' ? 'size: 58mm auto; margin: 0;' : 'size: 80mm auto; margin: 0;')}
              }
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background-color: #fff !important;
                color: #000 !important;
              }
              .print\\:hidden { display: none !important; }
            }
          </style>
        </head>
        <body class="bg-white text-black text-xs" onload="setTimeout(() => { try { window.focus(); window.print(); window.close(); } catch(e){} }, 500)">
          <div class="${widthClass} mx-auto p-2">
            ${safeContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      } catch (err) {
        console.warn('Popup print trigger:', err);
      }
    }, 500);
  } else {
    window.print();
  }
};

export const printHtml = (htmlContent: string, title: string = 'طباعة') => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    const safeContent = sanitizePrintHtml(htmlContent);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <base href="${window.location.origin}">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            * {
              font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
              box-sizing: border-box;
            }
            .flex { display: flex !important; }
            .justify-between { justify-content: space-between !important; }
            .items-center { align-items: center !important; }
            .text-center { text-align: center !important; }
            .font-bold { font-weight: bold !important; }
            .border-b { border-bottom: 1px solid #000 !important; }
            .border-t { border-top: 1px solid #000 !important; }
            .border-dashed { border-style: dashed !important; }
            .font-mono { font-family: monospace, sans-serif !important; }
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background-color: #fff !important;
                color: #000 !important;
              }
            }
          </style>
        </head>
        <body class="bg-white text-black text-xs" onload="setTimeout(() => { try { window.focus(); window.print(); window.close(); } catch(e){} }, 500)">
          <div class="w-[78mm] mx-auto p-1">
            ${safeContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      } catch (err) {
        console.warn('Popup print trigger:', err);
      }
    }, 500);
  } else {
    window.print();
  }
};
