import { QueueTicket, HeldInvoice, Client, Booking } from '../types';
import { DB, toCamel, toSnake, toSalonUUID } from './db';
import { SupabaseService } from './supabase';

const QUEUE_STORAGE_KEY = 'smartcut_queue_tickets';
const QUEUE_SEQ_KEY_PREFIX = 'smartcut_queue_seq_';

export const QueueService = {
  /**
   * توليد الرقم التسلسلي التالي للدور سحابياً مع مطابقة تذاكر الكيوسك والحجوزات وأجهزة الاستقبال
   */
  async getNextQueueNumberAsync(salonId: string, branchId: string = 'b-main', shiftDate?: string): Promise<number> {
    const today = shiftDate || new Date().toISOString().split('T')[0];
    let maxFound = 0;

    // 1. فحص أعلى رقم دور في تذاكر الانتظار السحابية (queue_tickets)
    try {
      const client = SupabaseService.getClient();
      const validSalonId = toSalonUUID(salonId);
      if (client && validSalonId) {
        let qTickets = client
          .from('queue_tickets')
          .select('queue_number')
          .eq('salon_id', validSalonId)
          .eq('shift_date', today)
          .order('queue_number', { ascending: false })
          .limit(1);

        if (branchId) {
          qTickets = qTickets.eq('branch_id', branchId);
        }

        const { data: tData } = await qTickets;
        if (tData && tData.length > 0) {
          maxFound = Math.max(maxFound, Number(tData[0].queue_number) || 0);
        }

        // فحص أعلى رقم دور في جدول الحجوزات السحابي (bookings)
        let qBookings = client
          .from('bookings')
          .select('queue_number')
          .eq('salon_id', validSalonId)
          .eq('date', today)
          .order('queue_number', { ascending: false })
          .limit(1);

        if (branchId) {
          qBookings = qBookings.eq('branch_id', branchId);
        }

        const { data: bData } = await qBookings;
        if (bData && bData.length > 0) {
          maxFound = Math.max(maxFound, Number(bData[0].queue_number) || 0);
        }
      }
    } catch (e) {
      console.warn('Supabase next queue query fallback:', e);
    }

    // 2. فحص التذاكر المخزنة محلياً في المتصفح
    try {
      const localTickets = this.getTickets(salonId, branchId, today);
      for (const t of localTickets) {
        if (t.queueNumber) maxFound = Math.max(maxFound, Number(t.queueNumber) || 0);
      }
    } catch {}

    // 3. فحص الحجوزات المخزنة محلياً في المتصفح
    try {
      const savedBookings = localStorage.getItem('smartcut_bookings');
      if (savedBookings) {
        const bList = JSON.parse(savedBookings);
        if (Array.isArray(bList)) {
          for (const b of bList) {
            if ((!salonId || b.salonId === salonId) &&
                (!branchId || b.branchId === branchId) &&
                (!today || b.date === today) &&
                b.queueNumber) {
              maxFound = Math.max(maxFound, Number(b.queueNumber) || 0);
            }
          }
        }
      }
    } catch {}

    // 4. فحص عداد التسلسل المخزن
    try {
      const key = `${QUEUE_SEQ_KEY_PREFIX}${salonId || 'default'}_${branchId || 'main'}_${today}`;
      const currentSeq = localStorage.getItem(key);
      if (currentSeq) {
        maxFound = Math.max(maxFound, parseInt(currentSeq, 10) || 0);
      }
    } catch {}

    const next = maxFound + 1;

    try {
      const key = `${QUEUE_SEQ_KEY_PREFIX}${salonId || 'default'}_${branchId || 'main'}_${today}`;
      localStorage.setItem(key, next.toString());
    } catch {}

    return next;
  },

  /**
   * توليد الرقم التسلسلي التالي للدور للفرع والوردية الحالية (يبدأ من 1) محلياً
   */
  getNextQueueNumber(salonId: string, branchId: string = 'b-main', shiftDate?: string): number {
    try {
      const today = shiftDate || new Date().toISOString().split('T')[0];
      let maxFound = 0;

      // 1. فحص التذاكر المحلية
      const localTickets = this.getTickets(salonId, branchId, today);
      for (const t of localTickets) {
        if (t.queueNumber) maxFound = Math.max(maxFound, Number(t.queueNumber) || 0);
      }

      // 2. فحص الحجوزات المحلية
      const savedBookings = localStorage.getItem('smartcut_bookings');
      if (savedBookings) {
        const bList = JSON.parse(savedBookings);
        if (Array.isArray(bList)) {
          for (const b of bList) {
            if ((!salonId || b.salonId === salonId) &&
                (!branchId || b.branchId === branchId) &&
                (!today || b.date === today) &&
                b.queueNumber) {
              maxFound = Math.max(maxFound, Number(b.queueNumber) || 0);
            }
          }
        }
      }

      // 3. فحص العداد
      const key = `${QUEUE_SEQ_KEY_PREFIX}${salonId || 'default'}_${branchId || 'main'}_${today}`;
      const current = localStorage.getItem(key);
      if (current) {
        maxFound = Math.max(maxFound, parseInt(current, 10) || 0);
      }

      const nextNum = maxFound + 1;
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
   * تسجيل حجز وإدراجه في طابور الانتظار (Queue Calling Screen) وفواتير POS المعلقة:
   * 1. إصدار تذكرة انتظار برقم الدور المحدد ومصدرها 'booking'.
   * 2. إنشاء فاتورة معلقة في الكاشير برقم الدور وبيانات العميل.
   */
  async createTicketFromBooking(params: {
    booking: Booking;
    salonId?: string;
    branchId?: string;
    client?: Client;
  }): Promise<{ ticket: QueueTicket; heldInvoice: HeldInvoice }> {
    const { booking } = params;
    const salonId = params.salonId || booking.salonId || '';
    const branchId = params.branchId || booking.branchId || 'b-main';
    const now = new Date();
    const ticketId = 'QT-B-' + booking.id;
    const heldInvoiceId = 'HELD-B-' + booking.id;

    // Services summary
    const servicesText = (booking.services || []).map(s => s.serviceName || (s as any).name).filter(Boolean).join(' + ');

    // Assigned staff if any
    const firstStaffId = booking.services?.[0]?.technicianId && booking.services[0].technicianId !== 'any' 
      ? booking.services[0].technicianId 
      : undefined;
    const firstStaffName = booking.services?.[0]?.technicianName && booking.services[0].technicianName !== 'أي خبير متاح'
      ? booking.services[0].technicianName
      : undefined;

    const ticket: QueueTicket = {
      id: ticketId,
      salonId,
      branchId,
      queueNumber: booking.queueNumber || 1,
      clientId: params.client?.id,
      clientName: booking.clientName,
      phone: booking.phone,
      status: 'waiting',
      source: 'booking',
      bookingId: booking.id,
      heldInvoiceId,
      assignedEmployeeId: firstStaffId,
      assignedEmployeeName: firstStaffName,
      checkInTime: now.toISOString(),
      shiftDate: booking.date || now.toISOString().split('T')[0],
      notes: `حجز موعد الساعة: ${booking.time || ''}${servicesText ? ` | خدمات: ${servicesText}` : ''}`
    };

    await this.saveTicket(ticket);

    // إنشاء فاتورة معلقة في شاشة الكاشير
    const heldInvoice: HeldInvoice = {
      id: heldInvoiceId,
      heldAt: now.toISOString(),
      timeStr: booking.time || now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      client: params.client || {
        id: 'C-' + Date.now(),
        name: booking.clientName,
        phone: booking.phone,
        loyaltyPoints: 0,
        cashback: 0,
        createdAt: now.toISOString()
      },
      clientSearch: `${booking.clientName} - ${booking.phone}`,
      cart: (booking.services || []).map(s => ({
        cartId: 'item-' + Math.random().toString(36).substr(2, 9),
        item: {
          id: s.serviceId,
          name: s.serviceName,
          price: s.price,
          duration: 30
        },
        quantity: 1,
        employeeId: s.technicianId && s.technicianId !== 'any' ? s.technicianId : '',
        type: 'service',
        price: s.price
      })),
      discount: { type: 'percentage', value: 0 },
      advanceDeduction: (booking.advancePayments || []).reduce((sum, p) => sum + p.amount, 0),
      note: `حجز موعد الساعة: ${booking.time || ''} - تذكرة دور #${booking.queueNumber}`,
      queueNumber: booking.queueNumber,
      queueTicketId: ticketId,
      salonId,
      branchId
    };

    // حفظ الفاتورة المعلقة محلياً
    try {
      const savedInvoices = localStorage.getItem('smartcut_held_invoices');
      const heldList: HeldInvoice[] = savedInvoices ? JSON.parse(savedInvoices) : [];
      const existingIdx = heldList.findIndex(h => h.id === heldInvoiceId || h.queueTicketId === ticketId);
      if (existingIdx >= 0) {
        heldList[existingIdx] = heldInvoice;
      } else {
        heldList.unshift(heldInvoice);
      }
      localStorage.setItem('smartcut_held_invoices', JSON.stringify(heldList));
    } catch (e) {
      console.warn('Failed to save held invoice for booking ticket locally:', e);
    }

    // حفظ الفاتورة المعلقة سحابياً في Supabase
    try {
      await DB.saveHeldInvoice(heldInvoice);
    } catch (e) {
      console.warn('Failed to save held invoice for booking ticket to cloud:', e);
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
  },

  /**
   * مزامنة حجوزات اليوم تلقائياً مع شاشة المناداة للتأكد من وجود تذكرة لكل حجز
   */
  async syncTodayBookingsToQueue(salonId: string, branchId: string = 'b-main', shiftDate?: string): Promise<void> {
    const today = shiftDate || new Date().toISOString().split('T')[0];
    try {
      // 1. فحص التذاكر الموجودة حالياً
      const currentTickets = await this.fetchTicketsAsync(salonId, branchId, today);
      const existingBookingTicketIds = new Set(
        currentTickets
          .filter(t => t.source === 'booking' || t.bookingId)
          .map(t => t.bookingId || t.id.replace('QT-B-', ''))
          .filter(Boolean)
      );

      // 2. جلب حجوزات اليوم من Supabase
      let todayBookings: Booking[] = [];
      const client = SupabaseService.getClient();
      const validSalonId = toSalonUUID(salonId);
      if (client && validSalonId) {
        let q = client
          .from('bookings')
          .select('*')
          .eq('salon_id', validSalonId)
          .eq('date', today);
        if (branchId) {
          q = q.eq('branch_id', branchId);
        }
        const { data } = await q;
        if (data && Array.isArray(data)) {
          todayBookings = data.map(toCamel);
        }
      }

      // وأيضاً فحص الحجوزات المخزنة محلياً
      try {
        const savedBookings = localStorage.getItem('smartcut_bookings');
        if (savedBookings) {
          const localList: Booking[] = JSON.parse(savedBookings);
          for (const lb of localList) {
            if ((!salonId || lb.salonId === salonId) &&
                (!branchId || lb.branchId === branchId) &&
                lb.date === today &&
                !todayBookings.some(b => b.id === lb.id)) {
              todayBookings.push(lb);
            }
          }
        }
      } catch {}

      // 3. لكل حجز ليس لديه تذكرة انتظار بعد، يتم إنشاء التذكرة وإدراجها فوراً
      for (const booking of todayBookings) {
        if (booking.status === 'cancelled') continue;
        if (!existingBookingTicketIds.has(booking.id)) {
          if (!booking.queueNumber) {
            booking.queueNumber = await this.getNextQueueNumberAsync(salonId, branchId, today);
            try {
              if (client) {
                await client.from('bookings').update({ queue_number: booking.queueNumber }).eq('id', booking.id);
              }
            } catch {}
          }

          await this.createTicketFromBooking({
            booking,
            salonId,
            branchId
          });
        }
      }
    } catch (e) {
      console.warn('Sync today bookings to queue error:', e);
    }
  }
};

