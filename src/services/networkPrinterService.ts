/**
 * Smart Cut Network Thermal Printer Service
 * Enables silent printing from tablets to network thermal printers or PC print bridges on LAN.
 */

import { QueueSlipData } from '../utils/printQueueSlip';
import { SupabaseService } from './supabase';

export interface NetworkPrinterConfig {
  ip: string;
  port?: number;
  path?: string;
}

/**
 * Generate standard ESC/POS bytes for 80mm thermal printers
 */
export function generateEscPosBytes(data: QueueSlipData): Uint8Array {
  const bytes: number[] = [];

  const add = (...nums: number[]) => bytes.push(...nums);
  const addStr = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) & 0xFF);
    }
  };

  // 1. Initialize printer
  add(0x1B, 0x40);

  // 2. Alignment: Center
  add(0x1B, 0x61, 0x01);

  // 3. Salon Name (Double Height & Width)
  add(0x1B, 0x21, 0x30);
  addStr((data.salonName || 'Smart Cut') + '\n');

  // 4. Normal font
  add(0x1B, 0x21, 0x00);
  if (data.branchName) {
    addStr(`Branch: ${data.branchName}\n`);
  }
  addStr('--------------------------------\n');

  // 5. Date & Time
  const now = new Date();
  const dateStr = data.dateStr || now.toLocaleDateString('en-GB');
  const timeStr = data.timeStr || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  addStr(`Date: ${dateStr}  Time: ${timeStr}\n`);
  addStr(`Client: ${data.clientName || 'Walk-in'}\n`);
  addStr(`Phone: ${data.phone || ''}\n`);
  addStr('================================\n');

  // 6. Queue Title
  addStr('YOUR QUEUE NUMBER\n');

  // 7. Large Queue Number (Quad Size: 4x)
  add(0x1D, 0x21, 0x33);
  addStr(` #${data.queueNumber} \n`);

  // 8. Normal font
  add(0x1D, 0x21, 0x00);
  addStr('================================\n');

  // 9. Code 39 Barcode
  const cleanPhone = (data.phone || '0000000000').replace(/\D/g, '');
  if (cleanPhone.length >= 4) {
    add(0x1D, 0x68, 50); // Barcode height
    add(0x1D, 0x77, 2);  // Barcode width
    add(0x1D, 0x48, 2);  // Print barcode text below
    add(0x1D, 0x6B, 4);  // CODE 39
    addStr(cleanPhone);
    add(0x00);          // NULL terminator
    add(0x0A);          // Line feed
  }

  // 10. Footer Note
  addStr('Thank you for visiting\n');
  addStr('Please wait for your turn\n\n\n');

  // 11. Partial Cut
  add(0x1D, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
}

/**
 * Format plain text ticket for lightweight receipt bridges
 */
export function generateSlipPlainText(data: QueueSlipData): string {
  const now = new Date();
  const dateStr = data.dateStr || now.toLocaleDateString('ar-SA');
  const timeStr = data.timeStr || now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  return [
    '================================',
    `       ${data.salonName || 'صالون سمارت كت'}       `,
    data.branchName ? `         الفرع: ${data.branchName}         ` : '',
    '--------------------------------',
    `التاريخ: ${dateStr}   الوقت: ${timeStr}`,
    `العميل: ${data.clientName}`,
    `الهاتف: ${data.phone}`,
    '--------------------------------',
    '       رقم الدور الخاص بك       ',
    `            #${data.queueNumber}            `,
    '--------------------------------',
    `باركود: ${data.phone}`,
    '       شكراً لزيارتكم الكريمة     ',
    '    يرجى الانتظار لحين المناداة   ',
    '================================',
    '\n\n\n'
  ].filter(Boolean).join('\n');
}

/**
 * Send print command directly to network printer IP or print bridge on LAN
 */
export async function sendToNetworkPrinter(
  data: QueueSlipData,
  config: NetworkPrinterConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.ip || config.ip.trim() === '') {
    return { success: false, message: 'عنوان IP غير محدد' };
  }

  const cleanIp = config.ip.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  const port = config.port || 8080;
  const path = config.path || '/print';
  const url = `http://${cleanIp}:${port}${path}`;

  const escposBytes = generateEscPosBytes(data);
  let base64Escpos = '';
  try {
    let binary = '';
    const len = escposBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(escposBytes[i]);
    }
    base64Escpos = btoa(binary);
  } catch {}

  const payload = {
    action: 'print_queue_slip',
    printerType: 'thermal_80mm',
    queueNumber: data.queueNumber,
    clientName: data.clientName,
    phone: data.phone,
    salonName: data.salonName,
    branchName: data.branchName,
    slip: data,
    text: generateSlipPlainText(data),
    escposBase64: base64Escpos,
    timestamp: new Date().toISOString()
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      return { success: true, message: `تم إرسال أمر الطباعة بنجاح إلى ${cleanIp}:${port}` };
    } else {
      return { success: false, message: `استجاب خادم الطباعة بكود خطأ: ${res.status}` };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: `انتهت مهلة الاتصال بالـ IP: ${cleanIp}:${port} (لم يستجب خلال 4 ثوانٍ)` };
    }
    return { success: false, message: `تعذر الوصول إلى الطابعة على ${cleanIp}:${port} (${err.message || 'خطأ اتصال بالشبكة'})` };
  }
}

/**
 * Broadcast print job to reception PC stations via Supabase Realtime
 */
export async function broadcastKioskPrintJob(data: QueueSlipData, salonId?: string): Promise<boolean> {
  try {
    const client = SupabaseService.getClient();
    if (!client) return false;

    const channel = client.channel('smartcut_kiosk_print_jobs');
    await channel.send({
      type: 'broadcast',
      event: 'print_ticket',
      payload: {
        data,
        salonId,
        sentAt: new Date().toISOString()
      }
    });
    return true;
  } catch (e) {
    console.warn('Broadcast print job error:', e);
    return false;
  }
}

/**
 * Main Kiosk Print Dispatcher:
 * 1. Sends to network IP if configured (silent, zero screens on tablet).
 * 2. Broadcasts to Reception PC station (so reception PC prints it silently).
 */
export async function dispatchKioskSilentPrint(
  data: QueueSlipData,
  options: {
    printerIp?: string;
    printerPort?: number;
    salonId?: string;
  }
): Promise<{ success: boolean; method: string; message: string }> {
  // 1. If Network Printer IP is provided, attempt direct LAN print
  if (options.printerIp && options.printerIp.trim() !== '') {
    const netRes = await sendToNetworkPrinter(data, {
      ip: options.printerIp,
      port: options.printerPort || 8080
    });

    // Also broadcast to reception PC as standby
    broadcastKioskPrintJob(data, options.salonId);

    if (netRes.success) {
      return { success: true, method: 'network_ip', message: netRes.message };
    } else {
      // Direct IP failed, but broadcasted to reception PC
      return { 
        success: true, 
        method: 'reception_broadcast', 
        message: `تم تحويل الطباعة إلى جهاز الاستقبال (${netRes.message})` 
      };
    }
  }

  // 2. If no direct IP is set, broadcast to reception PC connected to printer
  const broadcastSuccess = await broadcastKioskPrintJob(data, options.salonId);
  return {
    success: broadcastSuccess,
    method: 'reception_broadcast',
    message: broadcastSuccess 
      ? 'تم إرسال أمر الطباعة تلقائياً إلى جهاز الاستقبال المتصل بالطابعة'
      : 'لم يتم تحديد IP الطابعة ولم يتم العثور على محطة طباعة'
  };
}
