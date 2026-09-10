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
 * Direct Print Queue Slip (80mm x 80mm, Single Copy)
 * Uses a hidden iframe to print instantly without blocking or navigating away.
 */
export function printQueueSlipDirect(data: QueueSlipData): void {
  try {
    const now = new Date();
    const dateStr = data.dateStr || now.toISOString().split('T')[0];
    const timeStr = data.timeStr || now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const barcodeSvg = generateCode39Svg(data.phone || '0500000000', 26);

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

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>تذكرة انتظار - ${data.queueNumber}</title>
          <style>
            @page {
              size: 80mm 80mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            html, body {
              width: 80mm;
              height: 80mm;
              max-height: 80mm;
              overflow: hidden;
              background: #fff;
              color: #000;
            }
            .slip-container {
              width: 76mm;
              height: 76mm;
              margin: 2mm auto;
              padding: 2mm;
              border: 1px dashed #000;
              border-radius: 4px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              page-break-inside: avoid;
            }
            .header {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
              border-bottom: 1px solid #000;
              padding-bottom: 1.5mm;
            }
            .logo {
              max-height: 18px;
              max-width: 28px;
              object-contain: contain;
            }
            .salon-name {
              font-size: 11px;
              font-weight: 900;
              line-height: 1.1;
            }
            .meta-row {
              width: 100%;
              display: flex;
              justify-content: space-between;
              font-size: 8px;
              font-weight: bold;
              color: #333;
              margin-top: 1mm;
            }
            .client-info {
              font-size: 9px;
              font-weight: 800;
              margin-top: 1mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .queue-box {
              width: 100%;
              background: #f4f4f4;
              border: 1.5px solid #000;
              border-radius: 6px;
              padding: 1.5mm 0;
              margin: 1mm 0;
            }
            .queue-label {
              font-size: 8px;
              font-weight: 800;
              letter-spacing: 0.5px;
            }
            .queue-number {
              font-size: 26px;
              font-weight: 900;
              font-family: monospace;
              line-height: 1;
              margin-top: 0.5mm;
            }
            .barcode-section {
              width: 100%;
              margin-top: 0.5mm;
            }
            .barcode-text {
              font-size: 8px;
              font-weight: bold;
              font-family: monospace;
              letter-spacing: 1px;
              margin-top: 0.5mm;
            }
            .footer-note {
              font-size: 7.5px;
              font-weight: bold;
              border-top: 1px dotted #666;
              padding-top: 1mm;
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="slip-container">
            
            {/* Header: Salon Logo & Name */}
            <div class="header">
              ${data.salonLogo ? `<img src="${data.salonLogo}" class="logo" alt="Logo" />` : ''}
              <div class="salon-name">${data.salonName || 'منظومة الصالون'}</div>
            </div>

            {/* Date, Time & Branch */}
            <div class="meta-row">
              <span>📅 ${dateStr}</span>
              <span>⏰ ${timeStr}</span>
              ${data.branchName ? `<span>📍 ${data.branchName}</span>` : ''}
            </div>

            {/* Client Info */}
            <div class="client-info">
              العميل: ${data.clientName}
            </div>

            {/* Turn Number Box */}
            <div class="queue-box">
              <div class="queue-label">رقم الدور الخاص بك</div>
              <div class="queue-number">#${data.queueNumber}</div>
            </div>

            {/* Phone Barcode */}
            <div class="barcode-section">
              ${barcodeSvg}
              <div class="barcode-text">${data.phone}</div>
            </div>

            {/* Footer */}
            <div class="footer-note">
              يرجى التفضل بالانتظار لحين المناداة على رقمك • نسخة واحدة
            </div>

          </div>
        </body>
      </html>
    `);
    doc.close();

    // Trigger silent print after short rendering tick
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print error:', err);
      }
    }, 250);

  } catch (e) {
    console.error('Failed to direct print queue slip:', e);
  }
}
