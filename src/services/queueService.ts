import { QueueTicket, HeldInvoice, Client } from '../types';
import { DB } from './db';

const QUEUE_STORAGE_KEY = 'smartcut_queue_tickets';
const QUEUE_SEQ_KEY_PREFIX = 'smartcut_queue_seq_';

export const QueueService = {
  /**
   * توليد الرقم التسلسلي التالي للدور للفرع والوردية الحالية (يبدأ من 1)
   */
  getNextQueueNumber(salonId: string, branchId: string = 'b-main', shiftDate?: string): number {
    try {
      const today = shiftDate || new Date().toISOString().split('T')[0];
      const key = `${QUEUE_SEQ_KEY_PREFIX}${salonId || 'default'}_${branchId || 'main'}_${today}`;
      const current = localStorage.getItem(key);
      let nextNum = 1;
      if (current) {
        nextNum = parseInt(current, 10) + 1;
      }
      localStorage.setItem(key, nextNum.toString());
      return nextNum;
    } catch {
      return 1;
    }
  },

  /**
   * تصفير عداد الأدوار للوردية القادمة ليبدأ من 1
   */
  resetShiftQueue(salonId: string, branchId: string = 'b-main', shiftDate?: string): void {
    try {
      const today = shiftDate || new Date().toISOString().split('T')[0];
      const key = `${QUEUE_SEQ_KEY_PREFIX}${salonId || 'default'}_${branchId || 'main'}_${today}`;
      localStorage.setItem(key, '0');
    } catch (e) {
      console.warn('Failed to reset queue sequence:', e);
    }
  },

  /**
   * جلب قائمة تذاكر الانتظار للفرع
   */
  getTickets(salonId?: string, branchId?: string, shiftDate?: string): QueueTicket[] {
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (!saved) return [];
      let list: QueueTicket[] = JSON.parse(saved);
      if (salonId) {
        list = list.filter(t => !t.salonId || t.salonId === salonId);
      }
      if (branchId) {
        list = list.filter(t => !t.branchId || t.branchId === branchId);
      }
      if (shiftDate) {
        list = list.filter(t => !t.shiftDate || t.shiftDate === shiftDate);
      }
      return list;
    } catch {
      return [];
    }
  },

  /**
   * حفظ تذكرة انتظار جديدة
   */
  saveTicket(ticket: QueueTicket): QueueTicket {
    try {
      const current = this.getTickets();
      const existingIdx = current.findIndex(t => t.id === ticket.id);
      let updated: QueueTicket[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = ticket;
      } else {
        updated = [ticket, ...current];
      }
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));

      // تزامن اختياري مع Supabase DB إذا توفر الجدول
      try {
        DB.saveRecord('queue_tickets', ticket);
      } catch {}

      return ticket;
    } catch {
      return ticket;
    }
  },

  /**
   * تحديث حالة تذكرة الانتظار
   */
  updateTicket(ticketId: string, updates: Partial<QueueTicket>): QueueTicket | null {
    try {
      const current = this.getTickets();
      const idx = current.findIndex(t => t.id === ticketId);
      if (idx === -1) return null;

      const updatedTicket: QueueTicket = {
        ...current[idx],
        ...updates
      };
      current[idx] = updatedTicket;
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(current));

      // إذا كانت الحالة إلغاء أو لم يحضر، يتم حذف/إلغاء الفاتورة المعلقة المقترنة
      if (updates.status === 'cancelled' || updates.status === 'no_show') {
        this.cancelHeldInvoiceForTicket(ticketId);
      }

      try {
        DB.saveRecord('queue_tickets', updatedTicket);
      } catch {}

      return updatedTicket;
    } catch {
      return null;
    }
  },

  /**
   * تسجيل حضور عميل من الكيوسك / التابلت:
   * 1. إصدار تذكرة انتظار برقم تسلسلي.
   * 2. إنشاء فاتورة معلقة (Held Invoice) تلقائياً في POS مع رقم الدور.
   */
  createTicketFromKiosk(params: {
    salonId: string;
    branchId: string;
    client: Client;
    shiftDate?: string;
  }): { ticket: QueueTicket; heldInvoice: HeldInvoice } {
    const queueNumber = this.getNextQueueNumber(params.salonId, params.branchId, params.shiftDate);
    const now = new Date();
    const ticketId = 'QT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const heldInvoiceId = 'HELD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const ticket: QueueTicket = {
      id: ticketId,
      salonId: params.salonId,
      branchId: params.branchId,
      queueNumber,
      clientId: params.client.id,
      clientName: params.client.name,
      phone: params.client.phone,
      status: 'waiting',
      source: 'kiosk',
      heldInvoiceId,
      checkInTime: now.toISOString(),
      shiftDate: params.shiftDate || now.toISOString().split('T')[0]
    };

    this.saveTicket(ticket);

    // إنشاء فاتورة معلقة في شاشة الكاشير
    const heldInvoice: HeldInvoice = {
      id: heldInvoiceId,
      heldAt: now.toISOString(),
      timeStr: now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      client: params.client,
      clientSearch: `${params.client.name} - ${params.client.phone}`,
      cart: [],
      discount: { type: 'percentage', value: 0 },
      advanceDeduction: 0,
      note: `عميل واصل من الكيوسك - تذكرة دور #${queueNumber}`,
      queueNumber,
      queueTicketId: ticketId,
      salonId: params.salonId,
      branchId: params.branchId
    };

    // إضافة الفاتورة المعلقة إلى localStorage الخاص بـ POS
    try {
      const savedInvoices = localStorage.getItem('smartcut_held_invoices');
      const heldList: HeldInvoice[] = savedInvoices ? JSON.parse(savedInvoices) : [];
      localStorage.setItem('smartcut_held_invoices', JSON.stringify([heldInvoice, ...heldList]));
    } catch (e) {
      console.warn('Failed to add held invoice for kiosk ticket:', e);
    }

    return { ticket, heldInvoice };
  },

  /**
   * حذف / إلغاء الفاتورة المعلقة المقترنة بتذكرة الدور (في حال عدم الحضور)
   */
  cancelHeldInvoiceForTicket(ticketId: string): void {
    try {
      const savedInvoices = localStorage.getItem('smartcut_held_invoices');
      if (!savedInvoices) return;
      const heldList: HeldInvoice[] = JSON.parse(savedInvoices);
      const filtered = heldList.filter(h => h.queueTicketId !== ticketId && h.id !== ticketId);
      localStorage.setItem('smartcut_held_invoices', JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to cancel held invoice:', e);
    }
  }
};
