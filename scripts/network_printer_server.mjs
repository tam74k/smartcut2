/**
 * Smart Cut - Local Network Printer Bridge Server
 * Runs on the PC connected to the thermal printer (e.g. Reception PC).
 * Listens on port 8080 for print requests from tablet / kiosk.
 * Zero external npm dependencies required!
 */

import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';

const PORT = process.env.PORT || 8080;

// Helper to find local IPv4 addresses
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Print text file directly on Windows using PowerShell Out-Printer
function printTextWindows(text) {
  return new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), `smartcut_ticket_${Date.now()}.txt`);
    fs.writeFileSync(tempFile, text, 'utf-8');

    // Windows PowerShell print command
    const cmd = `powershell -Command "Get-Content -Path '${tempFile}' | Out-Printer"`;
    exec(cmd, (error) => {
      // Clean up after 5 seconds
      setTimeout(() => {
        try { fs.unlinkSync(tempFile); } catch {}
      }, 5000);

      if (error) {
        console.error('Print command error:', error.message);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers for tablet access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url || '/';

  // Health check / Status page
  if (req.method === 'GET') {
    const ips = getLocalIps();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head><meta charset="utf-8"><title>خادم طباعة سمارت كت</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:40px; background:#0f172a; color:#fff;">
        <h1 style="color:#f59e0b;">🖨️ خادم طباعة سمارت كت للشبكة يعمل بنجاح!</h1>
        <p>استخدم أحد العناوين التالية في شاشة إعدادات التابلت:</p>
        <div style="background:#1e293b; padding:20px; border-radius:12px; display:inline-block; font-family:monospace; font-size:18px; color:#38bdf8;">
          ${ips.map(ip => `<div>http://${ip}:${PORT}</div>`).join('')}
        </div>
        <p style="margin-top:20px; color:#94a3b8; font-size:13px;">المنفذ: ${PORT} | الحالة: جاهز لاستقبال تذاكر الانتظار</p>
      </body>
      </html>
    `);
    return;
  }

  // Print Endpoint
  if (req.method === 'POST' && (url === '/print' || url === '/' || url === '/test')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const ticketNum = payload.queueNumber || payload.slip?.queueNumber || 'TEST';
        const client = payload.clientName || payload.slip?.clientName || 'عميل';
        const textToPrint = payload.text || `تذكرة دور #${ticketNum}\nالعميل: ${client}\nالتاريخ: ${new Date().toLocaleString('ar-SA')}\n\n\n`;

        console.log(`[${new Date().toLocaleTimeString()}] استلام أمر طباعة للتذكرة #${ticketNum} (${client})`);

        await printTextWindows(textToPrint);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: `تم إرسال تذكرة الدور #${ticketNum} إلى طابعة الويندوز الافتراضية بنجاح`,
          queueNumber: ticketNum 
        }));
      } catch (err) {
        console.error('Error handling print request:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIps();
  console.log('====================================================');
  console.log(`  Smart Cut Network Thermal Printer Server`);
  console.log(`  الخادم يعمل الآن على المنفذ: ${PORT}`);
  console.log(`  عناوين IP المتاحة للتابلت في الشبكة:`);
  ips.forEach(ip => console.log(`  -> http://${ip}:${PORT}`));
  console.log('====================================================');
});
