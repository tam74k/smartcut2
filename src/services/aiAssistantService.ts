import { 
  AppSettings, Employee, Invoice, Booking, Transaction, Client, 
  ServiceItem, Product, AIChatMessage 
} from '../types';
import { calculateEmployeeCommission } from '../utils/commissionHelper';

export interface SystemDataContext {
  settings: AppSettings;
  employees: Employee[];
  invoices: Invoice[];
  bookings: Booking[];
  transactions: Transaction[];
  clients: Client[];
  services: ServiceItem[];
  products: Product[];
  currentUser?: any;
}

export interface AIExecutionResult {
  message: string;
  actionCard?: AIChatMessage['actionCard'];
  updatedData?: {
    bookings?: Booking[];
    transactions?: Transaction[];
    employees?: Employee[];
    clients?: Client[];
    services?: ServiceItem[];
  };
}

/**
 * Robust Arabic Text Normalization Helper
 * Handles Alef (أ, إ, آ, ا), Yaa (ي, ى), Taa Marbouta (ة, ه), Tashkeel, and Punctuation
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/[ةه]/g, 'ه')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[؟?.,!،:]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Natural Language Arabic Date Parser Helper
 */
function parseArabicRelativeDate(text: string, baseDate = new Date()): string {
  const d = new Date(baseDate);
  const norm = normalizeArabic(text);

  if (norm.includes('اليوم') || norm.includes('النهارده') || norm.includes('الليله')) {
    return d.toISOString().split('T')[0];
  }
  if (norm.includes('غدا') || norm.includes('بكره')) {
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  if (norm.includes('بعد غد') || norm.includes('بعد بكره')) {
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  }

  // Days of the week in Arabic normalized (الخميس, الجمعه, السبت, الاحد, الاثنين, الثلاثاء, الاربعاء)
  const dayNames = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعه', 'السبت'];
  const dayIndices = [0, 1, 2, 3, 4, 5, 6];

  for (let i = 0; i < dayNames.length; i++) {
    if (norm.includes(dayNames[i])) {
      const targetDay = dayIndices[i];
      const currentDay = d.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }
  }

  // Standard YYYY-MM-DD or DD-MM-YYYY / DD/MM/YYYY
  const isoMatch = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [_, y, m, day] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const slashMatch = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (slashMatch) {
    const [_, day, m, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Default to today
  return d.toISOString().split('T')[0];
}

/**
 * Natural Language Time Parser (e.g. "الساعة 7 مساء", "10:30 صباحا", "19:00")
 */
function parseArabicTime(text: string): string {
  const norm = normalizeArabic(text);
  
  // Explicit 24h or 12h formats like 19:00 or 07:30
  const timeRegexMatch = text.match(/(\d{1,2})[:.](\d{2})/);
  if (timeRegexMatch) {
    let hours = parseInt(timeRegexMatch[1], 10);
    const mins = timeRegexMatch[2];
    if ((norm.includes('مساء') || norm.includes('م') || norm.includes('العصر') || norm.includes('الظهر') || norm.includes('الليل')) && hours < 12) {
      hours += 12;
    }
    return `${hours.toString().padStart(2, '0')}:${mins}`;
  }

  // e.g. "الساعة 7 مساء" or "الساعة 10 صباحاً"
  const hourMatch = text.match(/(?:الساعة|ساعة|وقت|ساعه)\s*(\d{1,2})/);
  if (hourMatch) {
    let hours = parseInt(hourMatch[1], 10);
    if ((norm.includes('مساء') || norm.includes('م') || norm.includes('بالليل') || norm.includes('العصر') || norm.includes('ليل')) && hours < 12) {
      hours += 12;
    } else if (norm.includes('صباح') && hours === 12) {
      hours = 0;
    }
    return `${hours.toString().padStart(2, '0')}:00`;
  }

  // Raw number like "الساعة 7" or "7 مساء"
  const rawNumMatch = text.match(/\b(\d{1,2})\s*(?:مساء|صباحا|م|ص)/);
  if (rawNumMatch) {
    let hours = parseInt(rawNumMatch[1], 10);
    if ((norm.includes('مساء') || norm.includes('م')) && hours < 12) {
      hours += 12;
    }
    return `${hours.toString().padStart(2, '0')}:00`;
  }

  return '10:00';
}

/**
 * Extract Target Month from Query (e.g. "شهر أغسطس 2026" or "شهر 8")
 */
function extractMonthFromQuery(text: string): { yearMonth: string; monthName: string; year: number; month: number } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-12
  const norm = normalizeArabic(text);

  const arabicMonths: Record<string, number> = {
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'مايو': 5, 'يونيو': 6,
    'يوليو': 7, 'اغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12
  };

  for (const [mName, mIdx] of Object.entries(arabicMonths)) {
    if (norm.includes(mName)) {
      month = mIdx;
      break;
    }
  }

  // Check for digits month e.g. "شهر 8" or "شهر 08"
  const monthNumMatch = norm.match(/شهر\s*(\d{1,2})/);
  if (monthNumMatch) {
    const parsedM = parseInt(monthNumMatch[1], 10);
    if (parsedM >= 1 && parsedM <= 12) {
      month = parsedM;
    }
  }

  // Check for year like 2024, 2025, 2026, 2027
  const yearMatch = text.match(/\b(202\d)\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  const monthNamesArray = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  return {
    yearMonth: `${year}-${month.toString().padStart(2, '0')}`,
    monthName: monthNamesArray[month] || `شهر ${month}`,
    year,
    month
  };
}

/**
 * Helper to find an employee by matching raw or normalized query
 */
function matchEmployeeInQuery(text: string, employees: Employee[]): Employee | null {
  const normText = normalizeArabic(text);

  // Exact or full name match
  for (const emp of employees) {
    const normName = normalizeArabic(emp.name);
    if (normText.includes(normName)) {
      return emp;
    }
  }

  // First name or parts match (at least 3 characters)
  for (const emp of employees) {
    const nameParts = normalizeArabic(emp.name).split(' ').filter(p => p.length >= 3);
    for (const part of nameParts) {
      if (normText.includes(part)) {
        return emp;
      }
    }
  }

  return null;
}

/**
 * Helper to find a client by matching raw or normalized query
 */
function matchClientInQuery(text: string, clients: Client[]): Client | null {
  const normText = normalizeArabic(text);
  for (const cl of clients) {
    const normName = normalizeArabic(cl.name);
    if (normText.includes(normName)) return cl;
    const parts = normName.split(' ').filter(p => p.length >= 3);
    for (const p of parts) {
      if (normText.includes(p)) return cl;
    }
    if (cl.phone && text.includes(cl.phone)) return cl;
  }
  return null;
}

/**
 * Main AI & NLP Processing Engine
 */
export async function processAIChatMessage(
  userQuery: string,
  context: SystemDataContext
): Promise<AIExecutionResult> {
  const query = userQuery.trim();
  const normQuery = normalizeArabic(query);

  // =========================================================================
  // 1. ACTION: BOOKING CREATION (حجز موعد عبر الشات)
  // Example: "احجز للعميل تامر مصطفى رقم جوال 01014889704 يوم الخميس القادم الساعة 7 مساء مع الفني كريم ليعمل تنظيف بشرة وحلاقة ذقن"
  // =========================================================================
  const isBookingAction = (
    normQuery.includes('احجز') || 
    normQuery.includes('حجز موعد') || 
    normQuery.includes('تسجيل حجز') ||
    normQuery.includes('سجل حجز') ||
    normQuery.includes('ضيف حجز') ||
    (normQuery.includes('حجز') && (normQuery.includes('للعميل') || normQuery.includes('باسم') || normQuery.includes('رقم') || normQuery.includes('يوم') || normQuery.includes('الساعه') || normQuery.includes('الساعة')))
  );

  if (isBookingAction) {
    // 1. Extract Phone (10 digits)
    const phoneMatch = query.match(/(?:05\d{8}|01\d{9}|\+?\d{10,13})/);
    const phone = phoneMatch ? phoneMatch[0] : '0500000000';

    // 2. Extract Client Name
    let clientName = 'عميل جديد';
    const clientNameMatch = query.match(/(?:للعميل|للأستاذ|للاستاذ|للزبون|باسم|بإسم|حجز لـ|حجز ل)\s+([\u0621-\u064A\s]+?)(?=\s+(?:رقم|جوال|موبايل|يوم|الساعة|تاريخ|مع|ليعمل|خدمة)|$)/i);
    if (clientNameMatch && clientNameMatch[1].trim()) {
      clientName = clientNameMatch[1].trim();
    } else {
      const parts = query.split(/(?:للعميل|باسم|بإسم|لـ|ل)/i);
      if (parts.length > 1) {
        clientName = parts[1].split(/\s+(?:رقم|جوال|يوم|الساعة|مع|ليعمل)/)[0].trim() || 'عميل';
      }
    }

    // 3. Extract Date & Time
    const dateStr = parseArabicRelativeDate(query);
    const timeStr = parseArabicTime(query);

    // 4. Extract Technician / Employee
    const matchedTechnician = matchEmployeeInQuery(query, context.employees) || context.employees[0];

    // 5. Match Requested Services
    const selectedServices: {
      id: string;
      serviceId: string;
      serviceName: string;
      technicianId: string;
      technicianName: string;
      price: number;
    }[] = [];

    context.services.forEach(srv => {
      const normSrvName = normalizeArabic(srv.name);
      if (normQuery.includes(normSrvName) || (normSrvName.length > 3 && normQuery.includes(normSrvName.substring(0, 4)))) {
        selectedServices.push({
          id: Math.random().toString(36).substring(2, 9),
          serviceId: srv.id,
          serviceName: srv.name,
          technicianId: matchedTechnician.id,
          technicianName: matchedTechnician.name,
          price: srv.price
        });
      }
    });

    // If no specific service matched, assign default service
    if (selectedServices.length === 0) {
      const defaultSrv = context.services[0] || { id: 'srv-1', name: 'حلاقة وخدمات عناية', price: 50 };
      selectedServices.push({
        id: Math.random().toString(36).substring(2, 9),
        serviceId: defaultSrv.id,
        serviceName: defaultSrv.name,
        technicianId: matchedTechnician.id,
        technicianName: matchedTechnician.name,
        price: defaultSrv.price
      });
    }

    const totalAmount = selectedServices.reduce((sum, s) => sum + s.price, 0);

    const newBooking: Booking = {
      id: 'B-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      clientName,
      phone,
      date: dateStr,
      time: timeStr,
      status: 'confirmed',
      services: selectedServices,
      advancePayments: [],
      totalAmount
    };

    const updatedBookings = [newBooking, ...context.bookings];

    return {
      message: `✨ **تم تسجيل وتأكيد الحجز بنجاح في جدول الحجوزات والرزنامة!** ✅\n\n📋 **بيانات الحجز المسجل:**\n- **اسم العميل:** ${clientName}\n- **رقم الجوال:** ${phone}\n- **تاريخ الموعد:** ${dateStr}\n- **وقت الموعد:** ${timeStr}\n- **الفني / الموظف:** ${matchedTechnician.name}\n- **الخدمات:** ${selectedServices.map(s => `${s.serviceName} (${s.price} ${context.settings.currency})`).join(' + ')}\n- **إجمالي المبلغ:** **${totalAmount.toFixed(2)} ${context.settings.currency}**`,
      actionCard: {
        type: 'booking_created',
        title: `حجز موعد مؤكد #${newBooking.id} - ${clientName}`,
        data: newBooking,
        actions: [
          { label: '🛒 تحويل للكاشير POS', actionType: 'to_pos', targetId: newBooking.id },
          { label: '🖨️ طباعة إشعار الحجز', actionType: 'print_receipt', targetId: newBooking.id },
          { label: '📅 فتح جدول الحجوزات', actionType: 'open_screen', screenName: 'bookings' }
        ]
      },
      updatedData: {
        bookings: updatedBookings
      }
    };
  }

  // =========================================================================
  // 2. QUERY: EMPLOYEE ABSENCES & ATTENDANCE (الاستعلام عن غيابات وتأخيرات الموظف)
  // Example: "كم عدد ايام غياب الموظف احمد محمد لشهر اغسطس 2026"
  // =========================================================================
  const isAbsenceQuery = (
    normQuery.includes('غياب') || 
    normQuery.includes('ايام غياب') || 
    normQuery.includes('حضور') || 
    normQuery.includes('تاخير') || 
    normQuery.includes('داوم') || 
    normQuery.includes('دوام') || 
    normQuery.includes('اجاز') || 
    normQuery.includes('بصم')
  );

  if (isAbsenceQuery) {
    const targetEmp = matchEmployeeInQuery(query, context.employees) || context.employees[0];
    const { yearMonth, monthName, year, month } = extractMonthFromQuery(query);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Check Employee Leaves in this month
    const monthLeaves = (targetEmp.leaveRecords || []).filter(l => 
      l.startDate.startsWith(yearMonth) || l.endDate.startsWith(yearMonth)
    );
    const paidLeaveDays = monthLeaves.filter(l => l.type === 'paid').length;
    const unpaidLeaveDays = monthLeaves.filter(l => l.type !== 'paid').length;

    // Check Financial penalties / absence deductions recorded
    const penalties = (targetEmp.financialRecords || []).filter(r => 
      r.date.startsWith(yearMonth) && (r.type === 'penalty_days' || r.type === 'penalty_cash')
    );
    const penalizedDays = penalties.filter(r => r.type === 'penalty_days').reduce((sum, r) => sum + (r.days || 1), 0);

    // Active worked invoices in this month
    const empInvoices = context.invoices.filter(inv => 
      inv.date.startsWith(yearMonth) && 
      inv.status !== 'cancelled' &&
      inv.items?.some(i => i.employeeId === targetEmp.id || i.technicianName === targetEmp.name)
    );
    const activeWorkingDaysSet = new Set(empInvoices.map(i => i.date.split('T')[0]));
    const workedDaysCount = activeWorkingDaysSet.size;

    const weeklyOffDaysCount = 4; // e.g. 4 Fridays
    const expectedWorkingDays = daysInMonth - weeklyOffDaysCount;
    const calculatedAbsenceDays = unpaidLeaveDays + penalizedDays;
    const actualWorked = workedDaysCount > 0 ? workedDaysCount : Math.max(0, expectedWorkingDays - calculatedAbsenceDays);

    return {
      message: `📊 **تقرير وسجل حضور وغياب الموظف (${targetEmp.name}):**\n\n- **الفترة الزمنية:** ${monthName} ${year} (${daysInMonth} يوماً)\n- **كود البصمة:** #${targetEmp.fingerprintCode || targetEmp.id}\n- **المسمى الوظيفي:** ${targetEmp.role}\n\n📌 **الإحصائيات المعتمدة من واقع السجلات:**\n- **عدد أيام الغياب غير المبرر / الخصم:** **${calculatedAbsenceDays} يوم**\n- **أيام الإجازات المسجلة:** ${paidLeaveDays + unpaidLeaveDays} يوم (${paidLeaveDays} براتب، ${unpaidLeaveDays} بدون راتب)\n- **أيام العمل الفعلية المسجلة:** **${actualWorked} يوم عمل**\n- **الراتب الأساسي المعتمد:** ${targetEmp.baseSalary?.toFixed(2) || '0.00'} ${context.settings.currency}\n- **معدل الراتب اليومي:** ${targetEmp.baseSalary > 0 ? (targetEmp.baseSalary / daysInMonth).toFixed(2) : '0.00'} ${context.settings.currency} / يوم`,
      actionCard: {
        type: 'stats_summary',
        title: `كشف دوام الموظف: ${targetEmp.name} (${monthName} ${year})`,
        data: {
          employee: targetEmp.name,
          month: `${monthName} ${year}`,
          absenceDays: calculatedAbsenceDays,
          workedDays: actualWorked
        },
        actions: [
          { label: '⏱️ فتح شاشة شؤون العاملين والتايم شيت', actionType: 'open_screen', screenName: 'employees' }
        ]
      }
    };
  }

  // =========================================================================
  // 3. QUERY: EMPLOYEE SALARY & COMMISSIONS (الاستعلام عن الرواتب والعمولات)
  // Example: "كم صافي راتب الموظف فلان" or "ما هي عمولات فلان"
  // =========================================================================
  const isSalaryQuery = (
    normQuery.includes('راتب') || 
    normQuery.includes('رواتب') || 
    normQuery.includes('عمول') || 
    normQuery.includes('مستحق') || 
    normQuery.includes('سلف') || 
    normQuery.includes('مسير') || 
    normQuery.includes('مكافا') || 
    normQuery.includes('خصوم')
  );

  if (isSalaryQuery) {
    const targetEmp = matchEmployeeInQuery(query, context.employees) || context.employees[0];
    const { yearMonth, monthName, year } = extractMonthFromQuery(query);

    // Calculate Sales & Commissions
    let totalSales = 0;
    context.invoices.forEach(inv => {
      if (inv.date.startsWith(yearMonth) && inv.status !== 'cancelled') {
        inv.items?.forEach(item => {
          if (item.employeeId === targetEmp.id || item.technicianName === targetEmp.name) {
            totalSales += (item.price || 0) * (item.quantity || 1);
          }
        });
      }
    });

    const commissions = calculateEmployeeCommission(targetEmp, totalSales);

    let advances = 0;
    let bonuses = 0;
    let penalties = 0;

    (targetEmp.financialRecords || []).forEach(r => {
      if (r.date.startsWith(yearMonth)) {
        if (r.type === 'advance') advances += (r.amount || 0);
        if (r.type === 'bonus') bonuses += (r.amount || 0);
        if (r.type === 'penalty_cash') penalties += (r.amount || 0);
      }
    });

    const baseSalary = targetEmp.baseSalary || 0;
    const netSalary = Math.max(0, (baseSalary + commissions + bonuses) - (advances + penalties));

    return {
      message: `💰 **كشف مستحقات وصافي راتب الموظف (${targetEmp.name}):**\n\n- **الفترة:** ${monthName} ${year}\n- **نظام الراتب:** ${targetEmp.salaryType === 'commission_only' ? 'بالعمولة فقط' : targetEmp.salaryType === 'salary_plus_commission' ? 'راتب + عمولة' : 'راتب أساسي ثابت'}\n\n💵 **تفاصيل البنود المالية:**\n- **الراتب الأساسي:** ${baseSalary.toFixed(2)} ${context.settings.currency}\n- **إجمالي المبيعات المحققة:** ${totalSales.toFixed(2)} ${context.settings.currency}\n- **العمولة المستحقة (${targetEmp.commissionModel === 'tiered_brackets' ? 'شرائح متدرجة' : `${targetEmp.commissionRate || 10}%`}):** +${commissions.toFixed(2)} ${context.settings.currency}\n- **المكافآت والبدلات:** +${bonuses.toFixed(2)} ${context.settings.currency}\n- **السلف والمسحوبات:** -${advances.toFixed(2)} ${context.settings.currency}\n- **الخصومات والجزاءات:** -${penalties.toFixed(2)} ${context.settings.currency}\n\n💎 **الصافي النهائي المستحق للصرف:** **${netSalary.toFixed(2)} ${context.settings.currency}**`,
      actionCard: {
        type: 'stats_summary',
        title: `صافي راتب ${targetEmp.name}: ${netSalary.toFixed(2)} ${context.settings.currency}`,
        actions: [
          { label: '💰 مسير صرف الرواتب', actionType: 'open_screen', screenName: 'employees' }
        ]
      }
    };
  }

  // =========================================================================
  // 4. QUERY: TREASURY BALANCES & CASH (الاستعلام عن أرصدة الخزائن)
  // Example: "كم رصيد الخزنة" or "كم في الخزائن والكاشير"
  // =========================================================================
  const isTreasuryQuery = (
    normQuery.includes('خزن') || 
    normQuery.includes('كاش') || 
    normQuery.includes('درج') || 
    normQuery.includes('سيول') || 
    normQuery.includes('فلوس') || 
    (normQuery.includes('رصيد') && !normQuery.includes('نقاط'))
  );

  if (isTreasuryQuery) {
    const treasuriesInfo = (context.settings.treasuries || [
      { id: 'main', name: 'الخزينة الرئيسية', isMain: true },
      { id: 'cash', name: 'كاشير الفرع (الدرج)', isMain: false }
    ]).map(t => {
      const trxs = context.transactions.filter(trx => trx.treasury === t.id);
      const totalIn = trxs.filter(trx => trx.type === 'in').reduce((s, x) => s + x.amount, 0);
      const totalOut = trxs.filter(trx => trx.type === 'out').reduce((s, x) => s + x.amount, 0);
      const bal = totalIn - totalOut;
      return {
        name: t.name,
        isMain: t.isMain,
        balance: bal
      };
    });

    const grandTotal = treasuriesInfo.reduce((s, t) => s + t.balance, 0);
    const listStr = treasuriesInfo.map(t => `- **${t.name} ${t.isMain ? '(الرئيسية 🏦)' : ''}:** **${t.balance.toFixed(2)} ${context.settings.currency}**`).join('\n');

    return {
      message: `🏦 **الأرصدة النقدية المتوفرة في الخزائن حالياً:**\n\n${listStr}\n\n💰 **إجمالي السيولة النقدية المتاحة:** **${grandTotal.toFixed(2)} ${context.settings.currency}**`,
      actionCard: {
        type: 'stats_summary',
        title: `إجمالي رصيد الخزائن: ${grandTotal.toFixed(2)} ${context.settings.currency}`,
        actions: [
          { label: '🏦 فتح شاشة الخزائن والماليات', actionType: 'open_screen', screenName: 'treasury' }
        ]
      }
    };
  }

  // =========================================================================
  // 5. QUERY: SALES & REVENUE (المبيعات والفواتير)
  // Example: "كم مبيعات اليوم" or "إيرادات هذا الأسبوع"
  // =========================================================================
  const isSalesQuery = (
    normQuery.includes('مبيع') || 
    normQuery.includes('ايراد') || 
    normQuery.includes('دخل') || 
    normQuery.includes('ارباح') || 
    normQuery.includes('فاتور') || 
    normQuery.includes('فواتير')
  );

  if (isSalesQuery) {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayInvoices = context.invoices.filter(i => i.date.startsWith(todayStr) && i.status !== 'cancelled');
    const todayRevenue = todayInvoices.reduce((sum, i) => sum + (i.finalTotal || i.total || 0), 0);
    const totalAllRevenue = context.invoices.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + (i.finalTotal || i.total || 0), 0);

    return {
      message: `📊 **ملخص المبيعات والإيرادات من واقع الفواتير:**\n\n- **مبيعات اليوم (${todayStr}):** **${todayRevenue.toFixed(2)} ${context.settings.currency}** (${todayInvoices.length} فواتير)\n- **إجمالي المبيعات الكلية المسجلة:** **${totalAllRevenue.toFixed(2)} ${context.settings.currency}** (${context.invoices.length} فواتير)\n- **عدد الحجوزات المجدولة اليوم:** ${context.bookings.filter(b => b.date === todayStr).length} موعد`,
      actionCard: {
        type: 'stats_summary',
        title: `مبيعات اليوم: ${todayRevenue.toFixed(2)} ${context.settings.currency}`,
        actions: [
          { label: '🛒 نقطة البيع POS', actionType: 'open_screen', screenName: 'pos' },
          { label: '📈 التقارير المالية', actionType: 'open_screen', screenName: 'reports' }
        ]
      }
    };
  }

  // =========================================================================
  // 6. QUERY: INVENTORY SHORTAGES (النواقص والمخزن)
  // Example: "ما هي نواقص المخزن" or "منتجات قاربت على النفاد"
  // =========================================================================
  const isShortageQuery = (
    normQuery.includes('ناقص') || 
    normQuery.includes('نواقص') || 
    normQuery.includes('مخزن') || 
    normQuery.includes('مستودع') || 
    normQuery.includes('بضاع') || 
    normQuery.includes('منتج') || 
    normQuery.includes('صنف') || 
    normQuery.includes('اصناف')
  );

  if (isShortageQuery) {
    const shortages = context.products.filter(p => (p.stock || 0) <= (p.minStockAlert || 5));

    if (shortages.length === 0) {
      return {
        message: `✅ **حالة المخزون ممتازة!** لا توجد أي منتجات وصلت لحد النواقص أو إعادة الطلب حالياً.\nإجمالي الأصناف المعرفة في المستودع: **${context.products.length} صنف**.`,
        actionCard: {
          type: 'stats_summary',
          title: 'المخزون متوفر بالكامل 🟢',
          actions: [
            { label: '📦 فتح المخزن والمستودع', actionType: 'open_screen', screenName: 'warehouse' }
          ]
        }
      };
    }

    const shortList = shortages.map(p => `- ⚠️ **${p.name}:** الكمية المتبقية: **${p.stock || 0}** (حد إعادة الطلب: ${p.minStockAlert || 5})`).join('\n');

    return {
      message: `⚠️ **تنبيه نواقص المخزن (عدد ${shortages.length} منتجات وصلت لحد إعادة الطلب):**\n\n${shortList}\n\n💡 يُنصح بإصدار فاتورة مشتريات لتفادي نفاد الكميات.`,
      actionCard: {
        type: 'stats_summary',
        title: `تنبيه: ${shortages.length} أصناف وصلت لحد النواقص`,
        actions: [
          { label: '📦 إدارة المخزن والنواقص', actionType: 'open_screen', screenName: 'warehouse' }
        ]
      }
    };
  }

  // =========================================================================
  // 7. QUERY: CLIENTS & LOYALTY POINTS (الاستعلام عن العملاء ونقاط الولاء)
  // =========================================================================
  const isClientQuery = (
    normQuery.includes('عميل') || 
    normQuery.includes('عملاء') || 
    normQuery.includes('زبون') || 
    normQuery.includes('نقاط') || 
    normQuery.includes('ولاء')
  );

  if (isClientQuery) {
    const matchedCl = matchClientInQuery(query, context.clients);
    if (matchedCl) {
      const clientInvoices = context.invoices.filter(i => i.clientPhone === matchedCl.phone || i.clientName === matchedCl.name);
      const totalSpent = clientInvoices.reduce((s, i) => s + (i.finalTotal || i.total || 0), 0);

      return {
        message: `👤 **بيانات العميل (${matchedCl.name}):**\n\n- **رقم الجوال:** ${matchedCl.phone}\n- **رصيد نقاط الولاء:** **${matchedCl.loyaltyPoints || 0} نقطة**\n- **آخر زيارة:** ${matchedCl.lastVisit || 'غير مسجلة'}\n- **إجمالي المشتريات والإنفاق:** **${totalSpent.toFixed(2)} ${context.settings.currency}** (${clientInvoices.length} زيارات)`,
        actionCard: {
          type: 'stats_summary',
          title: `العميل: ${matchedCl.name} (${matchedCl.loyaltyPoints || 0} نقطة)`,
          actions: [
            { label: '👥 فتح سجل العملاء', actionType: 'open_screen', screenName: 'clients' }
          ]
        }
      };
    } else {
      return {
        message: `👥 **سجل العملاء ونقاط الولاء:**\n- إجمالي العملاء المسجلين: **${context.clients.length} عميل**\n- يمكنك البحث عن أي عميل بكتابة اسمه أو رقم جواله مباشرة!`,
        actionCard: {
          type: 'stats_summary',
          title: `إجمالي العملاء: ${context.clients.length}`,
          actions: [
            { label: '👥 فتح سجل العملاء', actionType: 'open_screen', screenName: 'clients' }
          ]
        }
      };
    }
  }

  // =========================================================================
  // 8. QUERY: SPECIFIC EMPLOYEE GENERAL OVERVIEW (إذا ذكر اسم موظف دون تحديد موضوع)
  // =========================================================================
  const matchedEmp = matchEmployeeInQuery(query, context.employees);
  if (matchedEmp) {
    const empInvoices = context.invoices.filter(i => 
      i.status !== 'cancelled' && 
      i.items?.some(it => it.employeeId === matchedEmp.id || it.technicianName === matchedEmp.name)
    );
    const totalEmpSales = empInvoices.reduce((s, i) => s + (i.finalTotal || i.total || 0), 0);

    return {
      message: `👤 **ملف الموظف (${matchedEmp.name}):**\n\n- **المسمى الوظيفي:** ${matchedEmp.role}\n- **كود البصمة:** #${matchedEmp.fingerprintCode || matchedEmp.id}\n- **الراتب الأساسي:** ${matchedEmp.baseSalary?.toFixed(2) || '0.00'} ${context.settings.currency}\n- **نسبة / نظام العمولة:** ${matchedEmp.commissionModel === 'tiered_brackets' ? 'شرائح متدرجة' : `${matchedEmp.commissionRate || 10}%`}\n- **إجمالي المبيعات المحققة في النظام:** ${totalEmpSales.toFixed(2)} ${context.settings.currency}\n- **رصيد الإجازات المتبقي:** ${matchedEmp.availableVacations || 21} يوم\n\n💡 *يمكنك أن تسألني عن غياباته، راتب شهر محدد، أو حجوزاته القادمة!*`,
      actionCard: {
        type: 'stats_summary',
        title: `الموظف: ${matchedEmp.name}`,
        actions: [
          { label: '👥 شؤون الموظفين', actionType: 'open_screen', screenName: 'employees' }
        ]
      }
    };
  }

  // =========================================================================
  // 9. EXTERNAL GENERATIVE AI / GEMINI LLM (عند تفعيل مفتاح API)
  // =========================================================================
  if (context.settings.aiApiKey && context.settings.aiProvider === 'gemini') {
    try {
      // Build a rich structured snapshot of all system tables
      const systemSnapshot = {
        salonName: context.settings.salonName,
        currency: context.settings.currency,
        currentDate: new Date().toISOString().split('T')[0],
        treasuries: (context.settings.treasuries || []).map(t => {
          const trxs = context.transactions.filter(trx => trx.treasury === t.id);
          const totalIn = trxs.filter(trx => trx.type === 'in').reduce((s, x) => s + x.amount, 0);
          const totalOut = trxs.filter(trx => trx.type === 'out').reduce((s, x) => s + x.amount, 0);
          return { name: t.name, balance: totalIn - totalOut, isMain: t.isMain };
        }),
        employees: context.employees.map(e => ({
          id: e.id,
          name: e.name,
          role: e.role,
          baseSalary: e.baseSalary,
          salaryType: e.salaryType,
          commissionRate: e.commissionRate,
          commissionModel: e.commissionModel,
          fingerprintCode: e.fingerprintCode,
          checkInTime: e.checkInTime,
          checkOutTime: e.checkOutTime,
          leavesCount: e.leaveRecords?.length || 0,
          penaltiesCount: e.financialRecords?.filter(r => r.type === 'penalty_cash' || r.type === 'penalty_days').length || 0,
          advancesTotal: e.financialRecords?.filter(r => r.type === 'advance').reduce((s, r) => s + (r.amount || 0), 0) || 0,
          isActive: e.isActive !== false && !e.isBlacklisted
        })),
        recentInvoices: context.invoices.slice(0, 30).map(i => ({
          id: i.id,
          date: i.date,
          client: i.clientName,
          total: i.finalTotal || i.total,
          status: i.status,
          items: i.items?.map(it => ({ service: it.serviceName, price: it.price, employee: it.technicianName }))
        })),
        shortageProducts: context.products.filter(p => (p.stock || 0) <= (p.minStockAlert || 5)).map(p => ({
          name: p.name,
          stock: p.stock,
          minStockAlert: p.minStockAlert,
          price: p.price
        })),
        todayBookings: context.bookings.filter(b => b.date === new Date().toISOString().split('T')[0]).map(b => ({
          id: b.id,
          client: b.clientName,
          phone: b.phone,
          time: b.time,
          status: b.status,
          total: b.totalAmount
        }))
      };

      const systemPrompt = `أنت المساعد الذكي المحترف والخبير الإداري والمالي لنظام إدارة الصالونات SMART CUT.
مهمتك تقديم إجابات دقيقة 100%، احترافية، ومفصلة باللغة العربية بناءً على البيانات الحية للنظام المزودة في هذا السياق:

سياق بيانات النظام المعتمدة (System Snapshot JSON):
${JSON.stringify(systemSnapshot, null, 2)}

قواعد وتعليمات الإجابة:
1. استخرج الأرقام والإحصائيات بدقة رياضية كاملة من البيانات المزودة ولا تخترع أو تخمن بيانات غير موجودة.
2. اذكر العملة المعتمدة (${context.settings.currency}) مع أي مبالغ مالية.
3. نسق إجابتك باستخدام Markdown الجميل، واستخدم النقاط والجداول والرموز التعبيرية المناسبة لسهولة القراءة.
4. إذا سأل المستخدم عن حسابات رواتب أو عمولات أو خصومات، فصل طريقة الحساب خطوة بخطوة.
5. أجب مباشرة على سؤال المستخدم باحترافية عالية.

سؤال المستخدم:
${query}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${context.settings.aiModel || 'gemini-1.5-flash'}:generateContent?key=${context.settings.aiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: systemPrompt }]
          }]
        })
      });

      const data = await response.json();
      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generatedText) {
        return { message: generatedText };
      }
    } catch (err) {
      console.warn('Gemini API Error, falling back to built-in response', err);
    }
  }

  // =========================================================================
  // 10. SYSTEM STATUS & SUMMARY OVERVIEW
  // =========================================================================
  const todayStr = new Date().toISOString().split('T')[0];
  const activeBookingsToday = context.bookings.filter(b => b.date === todayStr);

  return {
    message: `📊 **ملخص النظام والعمليات الحالية في (${context.settings.salonName || 'SMART CUT'}):**\n\n` +
      `- 👥 **الكادر والموظفون:** ${context.employees.filter(e => e.isActive !== false).length} موظف وفني نشط\n` +
      `- 📅 **حجوزات اليوم (${todayStr}):** ${activeBookingsToday.length} موعد\n` +
      `- 🧾 **إجمالي الفواتير المسجلة:** ${context.invoices.length} فاتورة\n` +
      `- ✂️ **الخدمات المتاحة:** ${context.services.length} خدمة\n` +
      `- 📦 **الأصناف في المخزن:** ${context.products.length} صنف\n\n` +
      `💡 **أمثلة لما يمكنك كتابته وسأجيبك فوراً:**\n` +
      `• *"كم غياب الموظف أحمد محمد لشهر أغسطس 2026؟"*\n` +
      `• *"احجز للعميل تامر مصطفى رقم 01014889704 يوم الخميس الساعة 7 مساء مع كريم ليعمل تنظيف بشرة"*\n` +
      `• *"كم صافي راتب الموظف كريم مع العمولات؟"*\n` +
      `• *"كم الرصيد المتوفر في الخزائن حالياً؟"*\n` +
      `• *"ما هي نواقص المخزن؟"*`
  };
}
