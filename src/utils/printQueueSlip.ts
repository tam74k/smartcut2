/**
 * Smart Cut Thermal Queue Ticket Direct Printer
 * Prints directly to 80mm x 80mm thermal receipt without extra popups or screens.
 */

export interface QueueSlipData {
  salonName: string;
  salonLogo?: string;
  branchName?: string;
  clientName: string;
  phone: string;
  queueNumber: number;
  dateStr?: string;
  timeStr?: string;
}

/**
 * Generate a clean, crisp Code 39 Barcode SVG string (100% offline, zero dependencies)
 */
function generateCode39Svg(text: string, height: number = 30): string {
  const clean = text.replace(/[^0-9A-Z\-]/gi, '').toUpperCase() || '123456789';
  const fullText = `*${clean}*`;

  // Code 39 encoding table (0 = narrow bar, 1 = wide bar)
  const code39Patterns: Record<string, string> = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
    '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010'
  };

  const narrowWidth = 1.2;
  const wideWidth = 2.8;
  const gap = 1.2;

  let x = 4;
  const rects: string[] = [];

  for (let i = 0; i < fullText.length; i++) {
    const char = fullText[i];
    const pattern = code39Patterns[char] || code39Patterns['*'];

    for (let b = 0; b < 9; b++) {
      const isBar = b % 2 === 0;
      const isWide = pattern[b] === '1';
      const w = isWide ? wideWidth : narrowWidth;

      if (isBar) {
        rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="#000" />`);
      }
      x += w;
    }
    x += gap; // space between characters
  }

  const totalWidth = x + 4;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" style="display:block; margin:0 auto;">
      ${rects.join('')}
    </svg>
  `;
}

/**
 * Direct Print Queue Slip (80mm Thermal Receipt, Single Copy)
 * Uses a hidden iframe to print directly without on-screen popups or preview modals.
 */
export function printQueueSlipDirect(data: QueueSlipData): void {
  try {
    const now = new Date();
    
    // Clean formatted Date (YYYY/MM/DD)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = data.dateStr || `${year}/${month}/${day}`;

    // Clean formatted Time (12h format with ص / م)
    const hours24 = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours24 >= 12 ? 'م' : 'ص';
    const hours12 = hours24 % 12 || 12;
    const timeStr = data.timeStr || `${hours12}:${mins} ${ampm}`;

    const barcodeSvg = generateCode39Svg(data.phone || '0000000000', 24);

    // Remove any existing print iframes
    const oldIframe = document.getElementById('queue-print-iframe');
    if (oldIframe) {
      oldIframe.remove();
    }

    // Create hidden iframe for direct printing
    const iframe = document.createElement('iframe');
    iframe.id = 'queue-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Build pure HTML (Zero JSX comments!)
    const logoHtml = data.salonLogo 
      ? `<div style="text-align:center; margin-bottom: 2px;"><img src="${data.salonLogo}" alt="Logo" style="max-height: 30px; max-width: 60px; object-fit: contain;" /></div>`
      : '';

    const branchHtml = data.branchName 
      ? `<div style="font-size: 8px; color: #444; margin-top: 1px;">الفرع: ${data.branchName}</div>` 
      : '';

    const clientDisplayName = data.clientName || 'عميل';
    const clientPhone = data.phone || '';

    const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تذكرة انتظار #${data.queueNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      width: 72mm;
      margin: 0 auto;
      padding: 4px 2px;
      background: #fff;
      color: #000;
      text-align: center;
    }
    .slip {
      width: 100%;
      border: 1.5px dashed #000;
      border-radius: 6px;
      padding: 6px 4px;
    }
    .salon-name {
      font-size: 13px;
      font-weight: 900;
      line-height: 1.2;
      color: #000;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 4px 0;
    }
    .meta-line {
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      font-weight: bold;
      color: #111;
      padding: 0 2px;
    }
    .client-box {
      font-size: 10px;
      font-weight: 800;
      color: #000;
      margin: 3px 0;
      padding: 2px;
      background: #f8f8f8;
      border-radius: 4px;
    }
    .queue-container {
      margin: 4px 0;
      padding: 4px 2px;
      background: #000;
      color: #fff;
      border-radius: 6px;
    }
    .queue-title {
      font-size: 8px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .queue-num {
      font-size: 32px;
      font-weight: 900;
      line-height: 1;
      font-family: monospace, sans-serif;
      margin-top: 2px;
    }
    .barcode-wrap {
      margin-top: 4px;
    }
    .phone-text {
      font-size: 9px;
      font-weight: bold;
      letter-spacing: 1px;
      font-family: monospace, sans-serif;
      margin-top: 1px;
      direction: ltr;
    }
    .footer-text {
      font-size: 7.5px;
      font-weight: bold;
      color: #333;
      margin-top: 4px;
      border-top: 1px dotted #888;
      padding-top: 3px;
    }
  </style>
</head>
<body>
  <div class="slip">
    ${logoHtml}
    <div class="salon-name">${data.salonName || 'صالون الحلاقة'}</div>
    ${branchHtml}
    
    <div class="divider"></div>
    
    <div class="meta-line">
      <span>التاريخ: ${dateStr}</span>
      <span>الوقت: ${timeStr}</span>
    </div>

    <div class="client-box">
      العميل: ${clientDisplayName}
    </div>

    <div class="queue-container">
      <div class="queue-title">رقم الدور الخاص بك</div>
      <div class="queue-num">#${data.queueNumber}</div>
    </div>

    <div class="barcode-wrap">
      ${barcodeSvg}
      <div class="phone-text">${clientPhone}</div>
    </div>

    <div class="footer-text">
      شكراً لزيارتكم • يرجى الانتظار لحين المناداة
    </div>
  </div>
</body>
</html>`;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Trigger printing once DOM is ready
    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print error:', err);
      }
    };

    // If there is a logo image, wait for it or fallback after 300ms
    const img = doc.querySelector('img');
    if (img && !img.complete) {
      img.onload = () => setTimeout(triggerPrint, 50);
      img.onerror = () => setTimeout(triggerPrint, 50);
      setTimeout(triggerPrint, 350);
    } else {
      setTimeout(triggerPrint, 100);
    }

  } catch (e) {
    console.error('Failed to direct print queue slip:', e);
  }
}
