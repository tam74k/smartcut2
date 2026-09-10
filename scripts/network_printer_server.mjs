/**
 * Smart Cut - Local Network Printer Bridge Server (Universal Default Printer Edition)
 * 
 * الميزة الرئيسية:
 * يطبع مباشرة إلى الطابعة الافتراضية (Default Printer) المعرفة في نظام الويندوز
 * لهذا الجهاز أياً كان نوعها أو اسمها (حرارية، ليزر، حبر، شبكة، USB... إلخ).
 */

import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';

const PORT = process.env.PORT || 8080;

// 1. استخراج عنوان الـ IP الفعلي للشبكة المحلية (تفضيل Wi-Fi / Ethernet على المحولات الوهمية)
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const physicalIps = [];
  const otherIps = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /vethernet|virtual|docker|hyper-v|wsl/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (isVirtual) {
          otherIps.push({ name, ip: iface.address });
        } else {
          physicalIps.push({ name, ip: iface.address });
        }
      }
    }
  }

  return [...physicalIps, ...otherIps];
}

// 2. جلب اسم الطابعة الافتراضية الحالية في نظام الويندوز أياً كان اسمها
function getDefaultPrinterName() {
  return new Promise((resolve) => {
    // الطريقة الأولى: استعلام WMI السريع والموثوق
    const cmd = 'powershell -NoProfile -Command "(Get-CimInstance Win32_Printer | Where-Object Default -eq $true).Name"';
    exec(cmd, (err, stdout) => {
      const name = stdout ? stdout.trim() : '';
      if (name) {
        resolve(name);
      } else {
        // بديل عبر سجل الويندوز (Registry)
        exec('powershell -NoProfile -Command "(Get-ItemProperty \'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows\').Device.Split(\',\')[0]"', (rErr, rStdout) => {
          resolve(rStdout ? rStdout.trim() : 'Default');
        });
      }
    });
  });
}

// 3. جلب قائمة جميع الطابعات المثبتة في الويندوز للعرض والتشخيص
function getAllInstalledPrinters() {
  return new Promise((resolve) => {
    exec('powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PortName | ConvertTo-Json"', (err, stdout) => {
      try {
        if (!stdout) return resolve([]);
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch {
        resolve([]);
      }
    });
  });
}

// 4. تنفيذ الطباعة الصامتة المباشرة إلى الطابعة الافتراضية للويندوز عبر محرك ويندوز الأصيل (.NET PrintDocument)
async function printToWindowsDefaultPrinter(data, specifiedPrinter = '') {
  const defaultPrinter = specifiedPrinter || await getDefaultPrinterName();
  console.log(`[${new Date().toLocaleTimeString('ar-SA')}] توجيه أمر الطباعة إلى الطابعة الافتراضية: [${defaultPrinter}]`);

  const ticketData = {
    salonName: data.salonName || data.slip?.salonName || 'صالون سمارت كت',
    branchName: data.branchName || data.slip?.branchName || '',
    queueNumber: data.queueNumber || data.slip?.queueNumber || 'TEST',
    clientName: data.clientName || data.slip?.clientName || 'عميل',
    phone: data.phone || data.slip?.phone || '',
    dateStr: data.dateStr || new Date().toLocaleDateString('ar-SA'),
    timeStr: data.timeStr || new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
  };

  const jsonPath = path.join(os.tmpdir(), `smartcut_ticket_${Date.now()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(ticketData), 'utf-8');

  const psScript = `
Add-Type -AssemblyName System.Drawing

$jsonPath = '${jsonPath.replace(/\\/g, '\\\\')}'
$rawJson = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$data = $rawJson | ConvertFrom-Json

$targetPrinter = '${(defaultPrinter || '').replace(/'/g, "''")}'
if (-not $targetPrinter -or $targetPrinter -eq 'Default') {
    $targetPrinter = (Get-CimInstance Win32_Printer | Where-Object Default -eq $true).Name
}

$doc = New-Object System.Drawing.Printing.PrintDocument
if ($targetPrinter) {
    $doc.PrinterSettings.PrinterName = $targetPrinter
}

$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(10, 10, 10, 10)

$doc.add_PrintPage({
    param($sender, $ev)
    $g = $ev.Graphics
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $fontHeader = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)
    $fontSub = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Regular)
    $fontQueueTitle = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Bold)
    $fontQueueNum = New-Object System.Drawing.Font("Arial", 38, [System.Drawing.FontStyle]::Bold)
    $fontBody = New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)
    $fontSmall = New-Object System.Drawing.Font("Arial", 9, [System.Drawing.FontStyle]::Regular)

    $brushBlack = [System.Drawing.Brushes]::Black
    $penDash = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1)
    $penDash.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $penSolid = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)

    $fmtCenter = New-Object System.Drawing.StringFormat
    $fmtCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $fmtCenter.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft

    $pageWidth = 280
    $y = 15

    # Salon Name
    $rectHeader = New-Object System.Drawing.RectangleF(0, $y, $pageWidth, 30)
    $g.DrawString($data.salonName, $fontHeader, $brushBlack, $rectHeader, $fmtCenter)
    $y += 30

    # Branch
    if ($data.branchName) {
        $rectBranch = New-Object System.Drawing.RectangleF(0, $y, $pageWidth, 20)
        $g.DrawString(([string]"فرع: " + $data.branchName), $fontSub, $brushBlack, $rectBranch, $fmtCenter)
        $y += 22
    }

    # Separator
    $g.DrawLine($penDash, 10, $y, $pageWidth - 10, $y)
    $y += 8

    # Date & Time
    $dateText = [string]"التاريخ: " + $data.dateStr + "   " + $data.timeStr
    $rectDate = New-Object System.Drawing.RectangleF(0, $y, $pageWidth, 20)
    $g.DrawString($dateText, $fontSmall, $brushBlack, $rectDate, $fmtCenter)
    $y += 25

    # Queue Box
    $boxX = 20
    $boxWidth = $pageWidth - 40
    $boxHeight = 85
    $g.DrawRectangle($penSolid, $boxX, $y, $boxWidth, $boxHeight)

    $yTitle = $y + 6
    $rectQTitle = New-Object System.Drawing.RectangleF($boxX, $yTitle, $boxWidth, 20)
    $g.DrawString("رقم الدور الخاص بك", $fontQueueTitle, $brushBlack, $rectQTitle, $fmtCenter)

    $yNum = $y + 26
    $rectQNum = New-Object System.Drawing.RectangleF($boxX, $yNum, $boxWidth, 55)
    $g.DrawString(("#" + $data.queueNumber), $fontQueueNum, $brushBlack, $rectQNum, $fmtCenter)
    $y += $boxHeight + 12

    # Client Name
    $clientText = [string]"العميل: " + $data.clientName
    $rectClient = New-Object System.Drawing.RectangleF(0, $y, $pageWidth, 22)
    $g.DrawString($clientText, $fontBody, $brushBlack, $rectClient, $fmtCenter)
    $y += 24

    # Phone
    if ($data.phone) {
        $phoneText = [string]"الجوال: " + $data.phone
        $rectPhone = New-Object System.Drawing.RectangleF(0, $y, $pageWidth, 20)
        $g.DrawString($phoneText, $fontSub, $brushBlack, $rectPhone, $fmtCenter)
        $y += 22
    }

    # Separator
    $g.DrawLine($penDash, 10, $y, $pageWidth - 10, $y)
    $y += 10

    # Footer note
    $rectFoot1 = New-Object System.Drawing.RectangleF(0, $y, $pageWidth, 18)
    $g.DrawString("أهلاً بكم.. نسعد بخدمتكم دائماً", $fontSmall, $brushBlack, $rectFoot1, $fmtCenter)
    $y += 20

    $rectFoot2 = New-Object System.Drawing.RectangleF(0, $y, $pageWidth, 18)
    $g.DrawString("يرجى الانتظار لحين المناداة على دورك", $fontSmall, $brushBlack, $rectFoot2, $fmtCenter)

    $ev.HasMorePages = $false
})

$doc.Print()
Write-Output "SUCCESS: Printed ticket #$($data.queueNumber) to $targetPrinter"
`;

  const psPath = path.join(os.tmpdir(), `smartcut_print_${Date.now()}.ps1`);
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  fs.writeFileSync(psPath, Buffer.concat([bom, Buffer.from(psScript, 'utf-8')]));

  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${psPath}"`;

  return new Promise((resolve) => {
    exec(cmd, (error, stdout) => {
      setTimeout(() => {
        try { fs.unlinkSync(jsonPath); } catch {}
        try { fs.unlinkSync(psPath); } catch {}
      }, 5000);

      if (error) {
        console.warn(`[خطأ أثناء الطباعة]:`, error.message);
      } else {
        console.log(`[✓ نجاح الطباعة]: تم إرسال التذكرة #${ticketData.queueNumber} بنجاح إلى الطابعة [${defaultPrinter}]`);
      }
    });

    // استجابة فورية للتابلت والكيوسك
    setTimeout(() => {
      resolve({ success: true, printer: defaultPrinter });
    }, 150);
  });
}

// 7. خادم الـ HTTP
const server = http.createServer(async (req, res) => {
  // ترويسات CORS للسماح بالوصول من التابلت والمتصفحات في الشبكة
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // واجهة فحص الحالة في المتصفح (GET /)
  if (req.method === 'GET' && (pathname === '/' || pathname === '/status')) {
    const ips = getLocalIps();
    const defaultPrinter = await getDefaultPrinterName();
    const allPrinters = await getAllInstalledPrinters();

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>خادم طباعة سمارت كت | الطابعة الافتراضية</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; text-align: center; }
          .card { background: #161e2e; max-width: 650px; margin: 0 auto; border-radius: 24px; padding: 32px; box-shadow: 0 12px 30px rgba(0,0,0,0.6); border: 1px solid #273549; }
          h1 { color: #38bdf8; margin-top: 0; font-size: 22px; }
          .ip-box { background: #0b0f19; padding: 16px; border-radius: 14px; margin: 18px 0; border: 1px solid #1e293b; text-align: right; }
          .ip-row { font-family: monospace; font-size: 16px; color: #38bdf8; margin: 6px 0; display: flex; justify-content: space-between; align-items: center; }
          .badge { background: #0284c7; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 6px; }
          .default-printer-box { background: #064e3b; border: 1px solid #059669; border-radius: 14px; padding: 16px; margin: 18px 0; text-align: right; }
          .default-title { font-size: 12px; color: #a7f3d0; font-weight: bold; margin-bottom: 4px; }
          .default-name { font-size: 18px; color: #ffffff; font-weight: 900; font-family: monospace; }
          .btn { background: #38bdf8; color: #0b0f19; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 900; cursor: pointer; font-size: 14px; margin-top: 10px; transition: all 0.2s; }
          .btn:hover { background: #0ea5e9; transform: scale(1.02); }
          .note { background: #1e293b; padding: 12px; border-radius: 10px; font-size: 12px; color: #94a3b8; margin-top: 20px; line-height: 1.6; text-align: right; }
          .printer-list { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; text-align: right; }
          .printer-list th { background: #1e293b; padding: 8px 12px; border-radius: 6px; }
          .printer-list td { padding: 8px 12px; border-bottom: 1px solid #1e293b; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🖨️ خادم طباعة سمارت كت (الطابعة الافتراضية)</h1>
          <p style="color:#94a3b8; font-size:13px;">يطبع فورياً وصامتاً إلى الطابعة الافتراضية المعرفة في هذا الجهاز أياً كان نوعها</p>

          <div class="default-printer-box">
            <div class="default-title">🎯 الطابعة الافتراضية المستهدفة حالياً في الويندوز:</div>
            <div class="default-name">${defaultPrinter || 'غير محددة'}</div>
            <div style="font-size:11px; color:#6ee7b7; margin-top:4px;">✓ يتم توجيه جميع تذاكر التابلت والكيوسك تلقائياً إلى هذه الطابعة</div>
          </div>

          <div class="ip-box">
            <div style="font-size:12px; color:#cbd5e1; font-weight:bold; margin-bottom:8px;">📌 عنوان الـ IP الذي تدخله في شاشة التابلت:</div>
            ${ips.map(entry => `
              <div class="ip-row">
                <span>http://${entry.ip}:${PORT}</span>
                <span class="badge">${entry.name}</span>
              </div>
            `).join('')}
          </div>

          <form action="/test" method="POST">
            <button type="submit" class="btn">🖨️ تجربة طباعة تذكرة الآن على الطابعة الافتراضية</button>
          </form>

          <div class="note">
            💡 <strong>تغيير الطابعة:</strong> لتغيير الطابعة التي يتم الطباعة إليها، فقط قم بتعيين الطابعة المطلوبة كـ <strong>"طابعة افتراضية (Default Printer)"</strong> من لوحة تحكم الويندوز (Windows Settings / Control Panel)، وسيعتمدها الخادم تلقائياً وفوراً دون الحاجة لإعادة تشغيل أو أي إعدادات أخرى.
          </div>

          <h4 style="color:#94a3b8; text-align:right; margin-top:24px; margin-bottom:8px;">جميع الطابعات المثبتة في هذا الجهاز:</h4>
          <table class="printer-list">
            <thead>
              <tr><th>اسم الطابعة</th><th>المنفذ</th><th>النوع</th></tr>
            </thead>
            <tbody>
              ${allPrinters.map(p => `
                <tr style="${p.Default ? 'color:#38bdf8; font-weight:bold;' : ''}">
                  <td>${p.Default ? '⭐ ' : ''}${p.Name}</td>
                  <td><code>${p.PortName || '-'}</code></td>
                  <td>${p.Default ? 'الافتراضية الحالية' : 'مثبتة'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // استقبال أمر الطباعة من التابلت أو الكيوسك (POST /print أو POST /test)
  if (req.method === 'POST' && (pathname === '/print' || pathname === '/test' || pathname === '/')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        let payload = {};
        if (body) {
          try {
            payload = JSON.parse(body);
          } catch {
            const params = new URLSearchParams(body);
            payload = Object.fromEntries(params.entries());
          }
        }

        const ticketNum = payload.queueNumber || payload.slip?.queueNumber || 'TEST';
        const clientName = payload.clientName || payload.slip?.clientName || 'عميل';

        console.log(`[${new Date().toLocaleTimeString()}] استلام طلب طباعة للدور #${ticketNum} (${clientName})`);

        // تنفيذ الطباعة إلى الطابعة الافتراضية
        const result = await printToWindowsDefaultPrinter(payload);

        // إذا كان الطلب من نموذج المتصفح
        if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          res.writeHead(302, { 'Location': '/?printed=true' });
          res.end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: result.success,
          message: result.success 
            ? `تمت الطباعة بنجاح على الطابعة الافتراضية [${result.printer}]`
            : `تعذرت الطباعة على الطابعة [${result.printer}]: ${result.error}`,
          printer: result.printer,
          queueNumber: ticketNum
        }));
      } catch (err) {
        console.error('خطأ في معالجة طلب الطباعة:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// تشغيل الخادم
server.listen(PORT, '0.0.0.0', async () => {
  const ips = getLocalIps();
  const defaultPrinter = await getDefaultPrinterName();

  console.log('====================================================');
  console.log(`  Smart Cut Universal Print Server`);
  console.log(`  الخادم يستمع الآن على المنفذ: ${PORT}`);
  console.log(`  الطابعة الافتراضية الحالية: [${defaultPrinter}]`);
  console.log(`  العنوان المقترح للتابلت:`);
  ips.forEach(entry => {
    console.log(`  -> http://${entry.ip}:${PORT}  (${entry.name})`);
  });
  console.log('====================================================');
});
