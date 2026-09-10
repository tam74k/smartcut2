import { QueueTicket, HeldInvoice, Client } from '../types';
import { DB, toCamel, toSnake, toSalonUUID } from './db';
import { SupabaseService } from './supabase';

const QUEUE_STORAGE_KEY = 'smartcut_queue_tickets';
const QUEUE_SEQ_KEY_PREFIX = 'smartcut_queue_seq_';

export const QueueService = {
  /**
   * توليد الرقم التسلسلي التالي للدور سحابياً مع مطابقة أجهزة الاستقبال والتابلت
   */
  async getNextQueueNumberAsync(salonId: string, branchId: string = 'b-main', shiftDate?: string): Promise<number> {
    const today = shiftDate || new Date().toISOString().split('T')[0];
    try {
      const client = SupabaseService.getClient();
      const validSalonId = toSalonUUID(salonId);
      if (client && validSalonId) {
        let query = client
          .from('queue_tickets')
          .select('queue_number')
          .eq('salon_id', validSalonId)
          .eq('shift_date', today)
          .order('queue_number', { ascending: false })
          .limit(1);

        if (branchId) {
          query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const maxNum = Number(data[0].queue_number) || 0;
          const next = maxNum + 1;
          const key = `${QUEUE_SEQ_KEY_PREFIX}${validSalonId}_${branchId || 'main'}_${today}`;
          localStorage.setItem(key, next.toString());
          return next;
        }
      }
    } catch (e) {
      console.warn('Supabase next queue query fallback:', e);
    }
    return this.getNextQueueNumber(salonId, branchId, shiftDate);
  },

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
   * جلب قائمة تذاكر الانتظار للفرع (محلياً)
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
   * جلب تذاكر الانتظار سحابياً من Supabase مع حفظها في التخزين المحلي
   */
  async fetchTicketsAsync(salonId?: string, branchId?: string, shiftDate?: string): Promise<QueueTicket[]> {
    const today = shiftDate || new Date().toISOString().split('T')[0];
    try {
      const client = SupabaseService.getClient();
      const validSalonId = toSalonUUID(salonId);
      if (client && validSalonId) {
        let query = client
          .from('queue_tickets')
          .select('*')
          .eq('salon_id', validSalonId)
          .eq('shift_date', today)
          .order('created_at', { ascending: false });

        if (branchId) {
          query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          const remoteTickets: QueueTicket[] = data.map(row => toCamel(row));
          // تحديث الكاش المحلي
          try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remoteTickets));
          } catch {}
          return remoteTickets;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch queue tickets from cloud:', e);
    }
    return this.getTickets(salonId, branchId, shiftDate);
  },

  /**
   * اشتراك لحظي (Real-time WebSockets) في جدول تذاكر الانتظار
   */
  subscribe(salonId: string, onUpdate: () => void): () => void {
    try {
      const client = SupabaseService.getClient();
      if (!client) return () => {};

      const channelName = `queue_tickets_${Date.now()}`;
      const channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'queue_tickets' },
          () => {
            onUpdate();
          }
        )
        .subscribe();

      return () => {
        try {
          client.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  },

  /**
   * حفظ تذكرة انتظار جديدة (محلياً وسحابياً)
   */
  async saveTicket(ticket: QueueTicket): Promise<QueueTicket> {
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

      // تزامن سحابي فوري مع Supabase
      try {
        const client = SupabaseService.getClient();
        if (client) {
          const snake: any = toSnake(ticket);
          if (ticket.salonId) {
            snake.salon_id = toSalonUUID(ticket.salonId) || ticket.salonId;
          }
          await client.from('queue_tickets').upsert(snake, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Cloud save ticket error:', err);
      }

      return ticket;
    } catch {
      return ticket;
    }
  },

  /**
   * تحديث حالة تذكرة الانتظار (محلياً وسحابياً)
   */
  async updateTicket(ticketId: string, updates: Partial<QueueTicket>): Promise<QueueTicket | null> {
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

      // تزامن سحابي مع Supabase
      try {
        const client = SupabaseService.getClient();
        if (client) {
          const snakeUpdates = toSnake(updates);
          await client.from('queue_tickets').update(snakeUpdates).eq('id', ticketId);
        }
      } catch (err) {
        console.warn('Cloud update ticket error:', err);
      }

      return updatedTicket;
    } catch {
      return null;
    }
  },

  /**
   * تسجيل حضور عميل من الكيوسك / التابلت:
   * 1. إصدار تذكرة انتظار برقم تسلسلي موحد عبر السحابة.
   * 2. إنشاء فاتورة معلقة (Held Invoice) تلقائياً في POS مع رقم الدور.
   */
  async createTicketFromKiosk(params: {
    salonId: string;
    branchId: string;
    client: Client;
    shiftDate?: string;
  }): Promise<{ ticket: QueueTicket; heldInvoice: HeldInvoice }> {
    const queueNumber = await this.getNextQueueNumberAsync(params.salonId, params.branchId, params.shiftDate);
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

    await this.saveTicket(ticket);

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

    // حفظ الفاتورة المعلقة سحابياً في Supabase لتظهر فوراً على أجهزة الكاشير والاستقبال
    try {
      await DB.saveHeldInvoice(heldInvoice);
    } catch (e) {
      console.warn('Failed to save held invoice to cloud:', e);
    }

    return { ticket, heldInvoice };
  },

  /**
   * حذف / إلغاء الفاتورة المعلقة المقترنة بتذكرة الدور (في حال عدم الحضور أو الإلغاء)
   */
  async cancelHeldInvoiceForTicket(ticketId: string): Promise<void> {
    try {
      const savedInvoices = localStorage.getItem('smartcut_held_invoices');
      if (savedInvoices) {
        const heldList: HeldInvoice[] = JSON.parse(savedInvoices);
        const filtered = heldList.filter(h => h.queueTicketId !== ticketId && h.id !== ticketId);
        localStorage.setItem('smartcut_held_invoices', JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('Failed to cancel held invoice locally:', e);
    }

    try {
      await DB.removeHeldInvoiceByTicket(ticketId);
    } catch (e) {
      console.warn('Failed to cancel held invoice in cloud:', e);
    }
  }
};

