import React, { useState, useMemo } from 'react';
import { 
  Booking, AppSettings, ServiceItem, Employee, Client, Branch, 
  AppUser, BlockedDateEntry, BlockedHourEntry, StaffUnavailabilityEntry 
} from '../types';
import { 
  Calendar as CalendarIcon, Plus, Printer, Edit2, X, ShoppingCart, 
  Search, ChevronRight, ChevronLeft, Clock, User, Phone, 
  Scissors, CheckCircle2, AlertCircle, Sparkles, Filter, 
  List, Grid3X3, Eye, CalendarDays, ArrowRight, Sliders, 
  CalendarOff, ShieldAlert, Trash2, Lock, ShieldCheck, Check
} from 'lucide-react';
import { 
  isDateBlocked, isHourBlocked, isStaffAvailableOnDate, 
  isStaffAvailableAtTime, timeSlotToMinutes, generateSalonTimeSlots, 
  isStaffBookedAtSlot, minutesToFormattedSlot 
} from '../utils/bookingAvailability';

export function BookingsScreen({ 
  settings, 
  setSettings,
  bookings, 
  setBookings, 
  onToPOS, 
  services, 
  employees,
  clients = [],
  setClients,
  activeBranchId,
  branches = [],
  currentUser
}: { 
  settings: AppSettings, 
  setSettings?: (s: AppSettings) => void,
  bookings: Booking[], 
  setBookings: (b: Booking[]) => void, 
  onToPOS: (b: Booking) => void, 
  services: ServiceItem[], 
  employees: Employee[],
  clients?: Client[],
  setClients?: (c: Client[]) => void,
  activeBranchId?: string,
  branches?: Branch[],
  currentUser?: AppUser | null
}) {
  // Permission to adjust booking rules
  const canManageBookingSettings = currentUser?.actions.includes('manage_booking_settings') || 
    currentUser?.actions.includes('*') || 
    currentUser?.role === 'admin' || 
    currentUser?.role === 'owner' || 
    currentUser?.role === 'programmer';

  // Primary Screen Tab: 'table' (default) | 'calendar'
  const [activeMainTab, setActiveMainTab] = useState<'table' | 'calendar'>('table');

  // Matching Client info during manual booking creation
  const [matchingClientInfo, setMatchingClientInfo] = useState<Client | null>(null);

  const handlePhoneChange = (phoneVal: string) => {
    const cleanPhone = phoneVal.trim();
    const found = clients.find(c => {
      if (!c.phone) return false;
      const cClean = c.phone.trim().replace(/\D/g, '');
      const inputClean = cleanPhone.replace(/\D/g, '');
      return cClean === inputClean || c.phone === cleanPhone || (inputClean.length >= 7 && (cClean.endsWith(inputClean) || inputClean.endsWith(cClean)));
    });

    if (found) {
      setMatchingClientInfo(found);
      setNewBooking(prev => ({
        ...prev,
        phone: phoneVal,
        clientName: found.name,
        customerId: found.id
      }));
    } else {
      setMatchingClientInfo(null);
      setNewBooking(prev => ({
        ...prev,
        phone: phoneVal
      }));
    }
  };

  // Booking Rules Modal State
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesActiveTab, setRulesActiveTab] = useState<'blocked_dates' | 'blocked_hours' | 'staff_unavail' | 'capacity'>('capacity');
  
  // Forms inside rules modal
  const [blockDateInput, setBlockDateInput] = useState({ date: new Date().toISOString().split('T')[0], reason: 'عطلة رسمية / إغلاق للصيانة' });
  const [blockHourInput, setBlockHourInput] = useState({ date: new Date().toISOString().split('T')[0], time: '14:00', reason: 'فترة صيانة / راحة' });
  const [staffUnavailInput, setStaffUnavailInput] = useState({ employeeId: employees[0]?.id || '', date: new Date().toISOString().split('T')[0], reason: 'إجازة خاصة' });
  
  // Advanced Booking Capacity & Timing Config
  const [maxPerStaffInput, setMaxPerStaffInput] = useState<number>(settings.bookingRules?.maxBookingsPerHour || 1);
  const [slotIntervalInput, setSlotIntervalInput] = useState<30 | 60>(settings.bookingRules?.slotIntervalMinutes || (settings.bookingRules?.maxBookingsPerHour === 1 ? 60 : 30));
  const [openingTimeInput, setOpeningTimeInput] = useState<string>(settings.bookingRules?.openingTime || '10:00');
  const [closingTimeInput, setClosingTimeInput] = useState<string>(settings.bookingRules?.closingTime || '23:00');

  // Calendar Navigation & View State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedTech, setSelectedTech] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table List Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals & Details State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Booking | null>(null);

  // New Booking State
  const [newBooking, setNewBooking] = useState<Partial<Booking>>({
    clientName: '',
    phone: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    status: 'confirmed',
    services: [],
    advancePayments: [],
    totalAmount: 0
  });

  const [serviceToAdd, setServiceToAdd] = useState('');
  const [techToAdd, setTechToAdd] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);

  // Filtered services for autocomplete search
  const filteredServicesForBooking = useMemo(() => {
    if (!serviceSearchQuery.trim()) return services;
    const q = serviceSearchQuery.toLowerCase().trim();
    return services.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.category && s.category.toLowerCase().includes(q)) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      s.price.toString().includes(q)
    );
  }, [services, serviceSearchQuery]);

  // Helper date functions
  const formatDateToYMD = (d: Date) => d.toISOString().split('T')[0];

  const getWeekDays = (baseDate: Date) => {
    const d = new Date(baseDate);
    const day = d.getDay(); // 0 = Sunday
    const diff = d.getDate() - day;
    const sunday = new Date(d.setDate(diff));

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(sunday);
      nextDay.setDate(sunday.getDate() + i);
      weekDays.push(nextDay);
    }
    return weekDays;
  };

  const getMonthGrid = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean; dateStr: string }[] = [];

    // Prepend previous month days
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false, dateStr: formatDateToYMD(prevDate) });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const curDate = new Date(year, month, i);
      days.push({ date: curDate, isCurrentMonth: true, dateStr: formatDateToYMD(curDate) });
    }

    // Append next month days
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({ date: nextDate, isCurrentMonth: false, dateStr: formatDateToYMD(nextDate) });
    }

    return days;
  };

  // Time Slots for Day / Week views (09:00 AM to 11:00 PM)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 9; hour <= 23; hour++) {
      const hStr = hour.toString().padStart(2, '0');
      slots.push(`${hStr}:00`);
    }
    return slots;
  }, []);

  const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const arabicMonthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  // Navigate Calendar
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (activeView === 'day') d.setDate(d.getDate() - 1);
    else if (activeView === 'week') d.setDate(d.getDate() - 7);
    else if (activeView === 'month') d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (activeView === 'day') d.setDate(d.getDate() + 1);
    else if (activeView === 'week') d.setDate(d.getDate() + 7);
    else if (activeView === 'month') d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar Header Title
  const headerTitle = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (activeView === 'month') {
      return `${arabicMonthNames[month]} ${year}`;
    } else if (activeView === 'week') {
      const weekDays = getWeekDays(currentDate);
      const startDay = weekDays[0];
      const endDay = weekDays[6];
      if (startDay.getMonth() === endDay.getMonth()) {
        return `${startDay.getDate()} - ${endDay.getDate()} ${arabicMonthNames[startDay.getMonth()]} ${year}`;
      }
      return `${startDay.getDate()} ${arabicMonthNames[startDay.getMonth()]} - ${endDay.getDate()} ${arabicMonthNames[endDay.getMonth()]} ${year}`;
    } else {
      const dayName = arabicDayNames[currentDate.getDay()];
      return `${dayName}، ${currentDate.getDate()} ${arabicMonthNames[month]} ${year}`;
    }
  }, [currentDate, activeView]);

  const mainBranch = (branches && branches[0]) || { id: 'b-main', name: 'الفرع الرئيسي' };
  const mainBranchId = mainBranch.id;
  const isMainBranch = !activeBranchId || activeBranchId === mainBranchId || activeBranchId === 'b-main';

  const matchesActiveBranch = (itemBranchId?: string) => {
    if (itemBranchId) {
      return itemBranchId === activeBranchId;
    }
    return isMainBranch;
  };

  // Filtered Bookings for Table View (with Date Range, Search & Branch)
  const tableFilteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Branch filter
      if (!matchesActiveBranch((b as any).branchId)) return false;

      // Date range filter
      if (dateFrom && b.date < dateFrom) return false;
      if (dateTo && b.date > dateTo) return false;

      // Status filter
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      // Technician filter
      if (selectedTech !== 'all') {
        const matchesTech = b.services?.some(s => s.technicianId === selectedTech);
        if (!matchesTech) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = b.clientName?.toLowerCase().includes(q);
        const matchesPhone = b.phone?.includes(q);
        const matchesService = b.services?.some(s => s.serviceName?.toLowerCase().includes(q));
        if (!matchesClient && !matchesPhone && !matchesService) return false;
      }

      return true;
    }).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [bookings, dateFrom, dateTo, statusFilter, selectedTech, searchQuery, activeBranchId, isMainBranch]);

  // Filtered Bookings for Calendar View
  const calendarFilteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Branch filter
      if (!matchesActiveBranch((b as any).branchId)) return false;

      // Status filter
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      // Technician filter
      if (selectedTech !== 'all') {
        const matchesTech = b.services?.some(s => s.technicianId === selectedTech);
        if (!matchesTech) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = b.clientName?.toLowerCase().includes(q);
        const matchesPhone = b.phone?.includes(q);
        const matchesService = b.services?.some(s => s.serviceName?.toLowerCase().includes(q));
        if (!matchesClient && !matchesPhone && !matchesService) return false;
      }

      return true;
    });
  }, [bookings, statusFilter, selectedTech, searchQuery, activeBranchId, isMainBranch]);

  // Group Bookings by Date and Hour Slot for quick lookup in calendar
  const bookingsByDateAndSlot = useMemo(() => {
    const map = new Map<string, Booking[]>();
    calendarFilteredBookings.forEach(b => {
      if (!b.date) return;
      const hourPart = b.time ? b.time.substring(0, 2) + ':00' : '10:00';
      const key = `${b.date}_${hourPart}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [calendarFilteredBookings]);

  // Quick Open Modal on Empty Slot Click
  const handleEmptySlotClick = (dateStr: string, slotTime: string, technicianId?: string) => {
    setEditingBooking(null);
    setServiceSearchQuery('');
    setServiceToAdd('');
    setIsServiceDropdownOpen(false);
    setNewBooking({
      clientName: '',
      phone: '',
      date: dateStr,
      time: slotTime,
      status: 'confirmed',
      services: [],
      advancePayments: [],
      totalAmount: 0
    });
    if (technicianId && technicianId !== 'all') {
      setTechToAdd(technicianId);
    }
    setShowAddModal(true);
  };

  // Add Service to Booking Form
  const addServiceToBooking = () => {
    const srv = services.find(s => s.id === serviceToAdd);
    const emp = employees.find(e => e.id === techToAdd);
    if (srv && emp) {
      const bs = {
        id: Math.random().toString(36).substr(2, 9),
        serviceId: srv.id,
        serviceName: srv.name,
        technicianId: emp.id,
        technicianName: emp.name,
        price: srv.price
      };
      setNewBooking({
        ...newBooking,
        services: [...(newBooking.services || []), bs],
        totalAmount: (newBooking.totalAmount || 0) + bs.price
      });
      setServiceToAdd('');
      setServiceSearchQuery('');
      setIsServiceDropdownOpen(false);
    }
  };

  // Save Booking
  const saveBooking = () => {
    if (!newBooking.clientName || !newBooking.phone || !newBooking.date || !newBooking.time) {
      alert('يرجى ملء جميع الحقول الإلزامية: رقم الجوال، اسم العميل، التاريخ، والوقت');
      return;
    }

    const booking: Booking = {
      id: editingBooking ? editingBooking.id : 'B-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      clientName: newBooking.clientName!,
      phone: newBooking.phone!,
      date: newBooking.date!,
      time: newBooking.time!,
      status: newBooking.status || 'confirmed',
      services: newBooking.services || [],
      advancePayments: newBooking.advancePayments || [],
      totalAmount: (newBooking.services || []).reduce((sum, s) => sum + s.price, 0),
      branchId: editingBooking?.branchId || activeBranchId || mainBranchId
    };

    if (editingBooking) {
      setBookings(bookings.map(b => b.id === booking.id ? booking : b));
    } else {
      setBookings([booking, ...bookings]);
    }

    // Auto add client to overall salon clients database if new
    if (setClients && newBooking.phone) {
      const cleanInput = newBooking.phone.trim();
      const clientExists = clients.some(c => c.phone && c.phone.trim() === cleanInput);
      if (!clientExists) {
        const newClientRecord: Client = {
          id: 'C-' + Date.now(),
          name: newBooking.clientName.trim(),
          phone: cleanInput,
          email: newBooking.customerEmail || '',
          notes: 'عميل مسجل تلقائياً من شاشة الحجوزات',
          loyaltyPoints: 0,
          cashback: 0,
          createdAt: new Date().toISOString()
        };
        setClients([newClientRecord, ...clients]);
      }
    }

    setShowAddModal(false);
    setEditingBooking(null);
    setSelectedBookingDetails(null);
    setMatchingClientInfo(null);
  };

  const handleEdit = (b: Booking) => {
    setEditingBooking(b);
    setNewBooking({ ...b });
    setShowAddModal(true);
    setSelectedBookingDetails(null);
  };

  const cancelBooking = (id: string) => {
    if (window.confirm('هل أنت متأكد من إلغاء هذا الحجز؟')) {
      setBookings(bookings.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
      setSelectedBookingDetails(null);
    }
  };

  // Print Booking Receipt
  const printBooking = (booking: Booking) => {
    const printWindow = document.createElement('div');
    printWindow.id = 'print-booking-receipt';
    printWindow.className = 'hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black';
    printWindow.dir = 'rtl';
    printWindow.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        ${settings.logoUrl ? '<img src="' + settings.logoUrl + '" style="max-height: 80px; margin: 0 auto 10px;" />' : ''}
        <h2 style="font-size: 20px; font-weight: bold; margin: 0;">${settings.printerName || 'إشعار حجز موعد'}</h2>
        <p style="font-size: 14px; margin: 5px 0;">${settings.address || ''}</p>
        <p style="font-size: 14px; margin: 5px 0;">${settings.phone || ''}</p>
        <h3 style="font-size: 18px; font-weight: bold; border: 1px solid #000; display: inline-block; padding: 5px 15px; margin-top: 10px;">إيصال حجز موعد مؤكد</h3>
      </div>
      <div style="margin-bottom: 20px; font-size: 14px;">
        <p><strong>رقم الحجز:</strong> ${booking.id}</p>
        <p><strong>تاريخ الموعد:</strong> ${booking.date}</p>
        <p><strong>الوقت:</strong> ${booking.time}</p>
        <p><strong>العميل:</strong> ${booking.clientName}</p>
        <p><strong>الجوال:</strong> ${booking.phone}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; text-align: right;">
        <thead>
          <tr style="border-bottom: 2px solid #000;">
            <th style="padding: 8px 0;">الخدمة</th>
            <th style="padding: 8px 0;">الموظف / الفني</th>
            <th style="padding: 8px 0; text-align: left;">السعر</th>
          </tr>
        </thead>
        <tbody>
          ${booking.services.map(s => `
            <tr style="border-bottom: 1px dotted #ccc;">
              <td style="padding: 8px 0;">${s.serviceName}</td>
              <td style="padding: 8px 0;">${s.technicianName}</td>
              <td style="padding: 8px 0; text-align: left;">${s.price.toFixed(2)} ${settings.currency}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-bottom: 20px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;">
          <span>الإجمالي:</span>
          <span>${booking.services.reduce((sum, s) => sum + s.price, 0).toFixed(2)} ${settings.currency}</span>
        </div>
      </div>
      ${settings.bookingNotes ? `
        <div style="margin-top: 30px; text-align: center; font-size: 13px; font-weight: bold; white-space: pre-wrap;">
          ${settings.bookingNotes}
        </div>
      ` : ''}
    `;
    document.body.appendChild(printWindow);
    window.print();
    setTimeout(() => {
      document.body.removeChild(printWindow);
    }, 100);
  };

  // Status Styling Helper
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500',
          label: 'مؤكد'
        };
      case 'pending':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
          label: 'انتظار'
        };
      case 'completed':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-300',
          dot: 'bg-blue-500',
          label: 'مكتمل'
        };
      case 'cancelled':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-300',
          dot: 'bg-rose-500',
          label: 'ملغي'
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          label: 'غير محدد'
        };
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto space-y-5 bg-slate-50 font-sans" dir="rtl">
      
      {/* Top Primary Navigation Sub-Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveMainTab('table')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeMainTab === 'table'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List size={16} className={activeMainTab === 'table' ? 'text-indigo-600' : 'text-slate-500'} />
            <span>📋 جدول الحجوزات (الرئيسي)</span>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {bookings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('calendar')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeMainTab === 'calendar'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays size={16} className={activeMainTab === 'calendar' ? 'text-indigo-600' : 'text-slate-500'} />
            <span>📅 رزنامة وتقويم الحجوزات</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canManageBookingSettings && (
            <button
              onClick={() => setShowRulesModal(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="ضبط إغلاق الأيام والساعات وسعة الحجوزات"
            >
              <Sliders size={15} className="text-indigo-600" />
              <span>إعدادات وتوافر الحجوزات ⚙️</span>
            </button>
          )}

          {/* Global New Booking Button */}
          <button
            onClick={() => {
              setEditingBooking(null);
              setNewBooking({
                clientName: '',
                phone: '',
                date: formatDateToYMD(currentDate),
                time: '10:00',
                status: 'confirmed',
                services: [],
                advancePayments: [],
                totalAmount: 0
              });
              setShowAddModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>+ حجز موعد جديد</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CLASSIC TABLE VIEW (الافتراضي بكل تفاصيله وعملياته) */}
      {/* ========================================================================= */}
      {activeMainTab === 'table' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[11px] font-bold">إجمالي الحجوزات</p>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">{bookings.length}</h4>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                📅
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-emerald-600 text-[11px] font-bold">حجوزات مؤكدة</p>
                <h4 className="text-xl font-black text-emerald-700 mt-0.5">
                  {bookings.filter(b => b.status === 'confirmed').length}
                </h4>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                ✓
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-amber-600 text-[11px] font-bold">قيد الانتظار</p>
                <h4 className="text-xl font-black text-amber-700 mt-0.5">
                  {bookings.filter(b => b.status === 'pending').length}
                </h4>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                ⏳
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-[11px] font-bold">حجوزات مكتملة</p>
                <h4 className="text-xl font-black text-blue-700 mt-0.5">
                  {bookings.filter(b => b.status === 'completed').length}
                </h4>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                🛒
              </div>
            </div>
          </div>

          {/* Table Filters & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Date From */}
              <div className="flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500">من:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              {/* Date To */}
              <div className="flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500">إلى:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 cursor-pointer"
                >
                  إلغاء التصفية
                </button>
              )}

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Filter size={14} className="text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="confirmed">المؤكدة فقط</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="completed">المكتملة</option>
                  <option value="cancelled">الملغاة</option>
                </select>
              </div>

              {/* Technician Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <User size={14} className="text-slate-400" />
                <select
                  value={selectedTech}
                  onChange={e => setSelectedTech(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">كل الموظفين والفنيين</option>
                  {employees.filter(e => e.isActive !== false).map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث باسم العميل أو الجوال أو الخدمة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold focus:border-indigo-600 outline-none"
              />
            </div>
          </div>

          {/* Bookings Directory Table */}
          <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">العميل</th>
                    <th className="p-3.5">الجوال</th>
                    <th className="p-3.5">الخدمات المحجوزة</th>
                    <th className="p-3.5">الموظف / الفني</th>
                    <th className="p-3.5">تاريخ ووقت الموعد</th>
                    <th className="p-3.5 text-center">الإجمالي</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableFilteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-bold">
                        لا توجد أي حجوزات تطابق البحث في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    tableFilteredBookings.map(b => {
                      const badge = getStatusBadge(b.status);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{b.clientName}</span>
                              {b.source === 'online' && (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-2xs">
                                  🌐 أونلاين
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-indigo-600">{b.bookingCode || `#${b.id}`}</div>
                          </td>
                          <td className="p-3.5 font-mono text-slate-600">{b.phone}</td>
                          <td className="p-3.5 font-bold text-slate-700">
                            {b.services?.length > 0 ? b.services.map(s => s.serviceName).join(' + ') : '-'}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {b.services?.map(s => s.technicianName).join(', ') || '-'}
                          </td>
                          <td className="p-3.5 font-mono text-slate-800 font-bold" dir="ltr">
                            {b.time} • {b.date}
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-slate-900">
                            {b.totalAmount} {settings.currency}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {b.status !== 'completed' && b.status !== 'cancelled' && (
                                <>
                                  <button
                                    onClick={() => onToPOS(b)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-xs cursor-pointer"
                                    title="تحويل مباشر لنقطة البيع POS"
                                  >
                                    <ShoppingCart size={13} />
                                    <span>كاشير</span>
                                  </button>
                                  <button
                                    onClick={() => handleEdit(b)}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
                                    title="تعديل"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => cancelBooking(b.id)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl cursor-pointer"
                                    title="إلغاء الحجز"
                                  >
                                    <X size={13} />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => printBooking(b)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer"
                                title="طباعة إشعار الحجز"
                              >
                                <Printer size={13} />
                              </button>
                              <button
                                onClick={() => setSelectedBookingDetails(b)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-indigo-700 rounded-xl cursor-pointer"
                                title="عرض التفاصيل"
                              >
                                <Eye size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GOOGLE CALENDAR VIEW (الأسبوع، اليوم، الشهر) */}
      {/* ========================================================================= */}
      {activeMainTab === 'calendar' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* Top Google Calendar Navigation Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            
            {/* Left: Date Nav Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToday}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border border-slate-200"
                >
                  اليوم
                </button>

                <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                  <button
                    onClick={handlePrev}
                    className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                    title="السابق"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    onClick={handleNext}
                    className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                    title="التالي"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>

                <h2 className="text-base sm:text-lg font-black text-slate-900 mr-2 font-mono">
                  {headerTitle}
                </h2>
              </div>
            </div>

            {/* Right: View Mode Toggle */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Mode Buttons */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setActiveView('day')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeView === 'day' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  يوم
                </button>
                <button
                  onClick={() => setActiveView('week')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeView === 'week' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  أسبوع
                </button>
                <button
                  onClick={() => setActiveView('month')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeView === 'month' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  شهر
                </button>
              </div>
            </div>
          </div>

          {/* Filter Bar (Technician, Status, Search) */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Technician Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <User size={14} className="text-slate-400" />
                <select
                  value={selectedTech}
                  onChange={e => setSelectedTech(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">كل الموظفين والفنيين</option>
                  {employees.filter(e => e.isActive !== false).map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Filter size={14} className="text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="confirmed">المؤكدة فقط</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="completed">المكتملة</option>
                  <option value="cancelled">الملغاة</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث باسم العميل أو الجوال أو الخدمة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold focus:border-indigo-600 outline-none"
              />
            </div>
          </div>

          {/* 1. WEEK VIEW (Google Calendar Standard 7 Days Grid) */}
          {activeView === 'week' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Days Header */}
              <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200 text-center text-xs font-bold text-slate-700 sticky top-0 z-10">
                <div className="p-3 border-l border-slate-200 text-slate-400 flex items-center justify-center font-mono">
                  <Clock size={15} />
                </div>
                {getWeekDays(currentDate).map((day, idx) => {
                  const isToday = formatDateToYMD(day) === formatDateToYMD(new Date());
                  return (
                    <div 
                      key={idx} 
                      className={`p-3 border-l last:border-l-0 border-slate-200 ${
                        isToday ? 'bg-indigo-50/80 text-indigo-900 font-black' : ''
                      }`}
                    >
                      <div className="text-[11px] text-slate-500">{arabicDayNames[day.getDay()]}</div>
                      <div className={`text-base font-mono mt-0.5 inline-block px-2 py-0.5 rounded-lg ${
                        isToday ? 'bg-indigo-600 text-white' : 'text-slate-800'
                      }`}>
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time Slots Grid */}
              <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                {timeSlots.map(timeSlot => (
                  <div key={timeSlot} className="grid grid-cols-8 min-h-[85px] group">
                    {/* Time Column */}
                    <div className="p-2 border-l border-slate-200 bg-slate-50/60 text-slate-400 font-mono text-[11px] flex items-start justify-center pt-2 select-none">
                      {timeSlot}
                    </div>

                    {/* 7 Days Columns */}
                    {getWeekDays(currentDate).map((day, dayIdx) => {
                      const dateStr = formatDateToYMD(day);
                      const isToday = dateStr === formatDateToYMD(new Date());
                      const key = `${dateStr}_${timeSlot}`;
                      const slotBookings = bookingsByDateAndSlot.get(key) || [];

                      return (
                        <div
                          key={dayIdx}
                          className={`p-1.5 border-l last:border-l-0 border-slate-100 transition-colors relative flex flex-col gap-1.5 ${
                            isToday ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {slotBookings.length > 0 ? (
                            slotBookings.map(b => {
                              const badge = getStatusBadge(b.status);
                              return (
                                <div
                                  key={b.id}
                                  onClick={() => setSelectedBookingDetails(b)}
                                  className={`p-2 rounded-xl border text-xs shadow-xs cursor-pointer hover:shadow-md transition-all ${badge.bg}`}
                                >
                                  <div className="flex justify-between items-start gap-1">
                                    <span className="font-black text-slate-900 truncate">{b.clientName}</span>
                                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${badge.dot}`} />
                                  </div>
                                  <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                    {b.services?.map(s => s.serviceName).join(', ') || 'موعد عام'}
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-mono mt-1 text-slate-500">
                                    <span>{b.time}</span>
                                    <span className="font-bold text-slate-700">{b.totalAmount} {settings.currency}</span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <button
                              onClick={() => handleEmptySlotClick(dateStr, timeSlot, selectedTech)}
                              className="w-full h-full min-h-[60px] rounded-xl border border-dashed border-transparent hover:border-indigo-300 hover:bg-indigo-50/30 text-indigo-600 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer"
                            >
                              <Plus size={14} />
                              <span>حجز فارغ</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. DAY VIEW (Detailed Columns by Technician) */}
          {activeView === 'day' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Technicians Header */}
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 sticky top-0 z-10">
                <div className="p-3 border-l border-slate-200 text-slate-400 font-mono text-center flex items-center justify-center">
                  <Clock size={15} />
                </div>
                {employees.filter(e => e.isActive !== false && (selectedTech === 'all' || e.id === selectedTech)).map(emp => (
                  <div key={emp.id} className="p-3 border-l last:border-l-0 border-slate-200 text-center">
                    <div className="font-black text-slate-900 text-sm">{emp.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{emp.role}</div>
                  </div>
                ))}
              </div>

              {/* Time Slots Grid */}
              <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                {timeSlots.map(timeSlot => {
                  const activeTechs = employees.filter(e => e.isActive !== false && (selectedTech === 'all' || e.id === selectedTech));

                  return (
                    <div key={timeSlot} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 min-h-[90px] group">
                      {/* Time Column */}
                      <div className="p-2 border-l border-slate-200 bg-slate-50/60 text-slate-400 font-mono text-xs flex items-start justify-center pt-2 select-none">
                        {timeSlot}
                      </div>

                      {/* Technicians Columns */}
                      {activeTechs.map(emp => {
                        const dateStr = formatDateToYMD(currentDate);
                        const empBookings = calendarFilteredBookings.filter(b => 
                          b.date === dateStr &&
                          (b.time ? b.time.substring(0, 2) + ':00' : '10:00') === timeSlot &&
                          b.services?.some(s => s.technicianId === emp.id)
                        );

                        return (
                          <div
                            key={emp.id}
                            className="p-1.5 border-l last:border-l-0 border-slate-100 hover:bg-slate-50/80 transition-colors relative flex flex-col gap-1.5"
                          >
                            {empBookings.length > 0 ? (
                              empBookings.map(b => {
                                const badge = getStatusBadge(b.status);
                                return (
                                  <div
                                    key={b.id}
                                    onClick={() => setSelectedBookingDetails(b)}
                                    className={`p-2.5 rounded-2xl border shadow-xs cursor-pointer hover:shadow-md transition-all ${badge.bg}`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <h4 className="font-black text-slate-900 text-xs">{b.clientName}</h4>
                                      <span className={`w-2 h-2 rounded-full mt-1 ${badge.dot}`} />
                                    </div>
                                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">{b.phone}</div>
                                    <div className="text-[11px] font-bold text-slate-700 mt-1">
                                      {b.services?.map(s => s.serviceName).join(' + ')}
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-1.5 pt-1 border-t border-slate-200/50">
                                      <span>{b.time}</span>
                                      <span className="font-black text-slate-800">{b.totalAmount} {settings.currency}</span>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <button
                                onClick={() => handleEmptySlotClick(dateStr, timeSlot, emp.id)}
                                className="w-full h-full min-h-[60px] rounded-xl border border-dashed border-transparent hover:border-indigo-300 hover:bg-indigo-50/30 text-indigo-600 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold cursor-pointer"
                              >
                                <Plus size={14} />
                                <span>متاح للحجز ({emp.name.split(' ')[0]})</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. MONTH VIEW (Monthly Overview Grid) */}
          {activeView === 'month' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Weekday Titles */}
              <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-xs font-black text-slate-700 py-3">
                {arabicDayNames.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 border-b border-slate-100">
                {getMonthGrid(currentDate).map((cell, idx) => {
                  const isToday = cell.dateStr === formatDateToYMD(new Date());
                  const dayBookings = calendarFilteredBookings.filter(b => b.date === cell.dateStr);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentDate(cell.date);
                        setActiveView('day');
                      }}
                      className={`min-h-[110px] p-2 transition-all cursor-pointer flex flex-col justify-between ${
                        cell.isCurrentMonth ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/50 text-slate-400'
                      } ${isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/20' : ''}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                          isToday ? 'bg-indigo-600 text-white font-black' : 'text-slate-700'
                        }`}>
                          {cell.date.getDate()}
                        </span>

                        {dayBookings.length > 0 && (
                          <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full">
                            {dayBookings.length} موعد
                          </span>
                        )}
                      </div>

                      {/* Booking Preview Pills */}
                      <div className="space-y-1 my-1">
                        {dayBookings.slice(0, 2).map(b => (
                          <div
                            key={b.id}
                            className="text-[10px] font-bold p-1 rounded-lg bg-slate-100 text-slate-800 truncate flex items-center gap-1"
                          >
                            <span className="font-mono text-[9px] text-slate-500">{b.time}</span>
                            <span className="truncate">{b.clientName}</span>
                          </div>
                        ))}
                        {dayBookings.length > 2 && (
                          <div className="text-[9px] font-black text-indigo-600 text-center">
                            +{dayBookings.length - 2} مواعيد أخرى
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 text-center font-bold opacity-0 hover:opacity-100">
                        عرض اليومية ⬅
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK BOOKING DETAILS MODAL (Interactive Popover) */}
      {/* ========================================================================= */}
      {selectedBookingDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  #{selectedBookingDetails.id}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">{selectedBookingDetails.clientName}</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedBookingDetails.phone}</p>
              </div>
              <button
                onClick={() => setSelectedBookingDetails(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Date & Time info */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <CalendarIcon size={15} className="text-indigo-600" />
                <span>{selectedBookingDetails.date}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-700">
                <Clock size={15} className="text-indigo-600" />
                <span>{selectedBookingDetails.time}</span>
              </div>
              <div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getStatusBadge(selectedBookingDetails.status).bg}`}>
                  {getStatusBadge(selectedBookingDetails.status).label}
                </span>
              </div>
            </div>

            {/* Services List */}
            <div>
              <h4 className="text-xs font-black text-slate-800 mb-2">الخدمات والموظفون:</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedBookingDetails.services?.map(s => (
                  <div key={s.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{s.serviceName}</div>
                      <div className="text-[10px] text-slate-500">الفني: {s.technicianName}</div>
                    </div>
                    <div className="font-mono font-black text-slate-800">
                      {s.price.toFixed(2)} {settings.currency}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Price */}
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-black">
              <span className="text-xs text-slate-600">المبلغ الإجمالي:</span>
              <span className="text-base text-indigo-700 font-mono">
                {selectedBookingDetails.totalAmount} {settings.currency}
              </span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-wrap gap-2">
              {selectedBookingDetails.status !== 'completed' && selectedBookingDetails.status !== 'cancelled' && (
                <>
                  <button
                    onClick={() => {
                      onToPOS(selectedBookingDetails);
                      setSelectedBookingDetails(null);
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <ShoppingCart size={15} />
                    <span>تحويل للكاشير POS</span>
                  </button>
                  <button
                    onClick={() => handleEdit(selectedBookingDetails)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={14} />
                    <span>تعديل</span>
                  </button>
                  <button
                    onClick={() => cancelBooking(selectedBookingDetails.id)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => printBooking(selectedBookingDetails)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="طباعة"
              >
                <Printer size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT BOOKING MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <CalendarIcon size={18} />
                </div>
                <h2 className="text-base font-black text-slate-900">
                  {editingBooking ? 'تعديل بيانات الحجز' : 'حجز موعد جديد'}
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-3">
                {/* 1. FIRST FIELD: Phone Number with Instant Lookup */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    رقم الجوال (اسم المستخدم والبحث الفوري) * 📱
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={newBooking.phone || ''}
                      onChange={e => handlePhoneChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold focus:border-indigo-600 outline-none text-slate-900 shadow-xs"
                      placeholder="أدخل رقم الجوال مثلاً: 05XXXXXXXX"
                      required
                      dir="ltr"
                      autoFocus
                    />
                  </div>

                  {/* Matching Client Found Banner */}
                  {matchingClientInfo ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 p-2.5 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <span className="text-base">✨</span>
                        <div>
                          <p className="font-black text-emerald-900">عميل مسجل: {matchingClientInfo.name}</p>
                          <p className="text-[10px] text-emerald-700 font-bold">
                            نقاط الولاء: {matchingClientInfo.loyaltyPoints || 0} نقطة • الكاش باك: {matchingClientInfo.cashback || 0} {settings.currency}
                          </p>
                        </div>
                      </div>
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        تم الاسترجاع ✓
                      </span>
                    </div>
                  ) : newBooking.phone && newBooking.phone.trim().length >= 8 ? (
                    <p className="text-[11px] text-indigo-600 font-bold">
                      💡 عميل جديد — سيتم تسجيله تلقائياً في قاعدة عملاء الصالون عند حفظ الحجز
                    </p>
                  ) : null}
                </div>

                {/* 2. Client Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل * 👤</label>
                  <input
                    type="text"
                    value={newBooking.clientName || ''}
                    onChange={e => setNewBooking({ ...newBooking, clientName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                    placeholder="اسم العميل..."
                    required
                  />
                </div>

                {/* 3. Date & Time Slots */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الموعد * 📅</label>
                    <input
                      type="date"
                      value={newBooking.date}
                      onChange={e => setNewBooking({ ...newBooking, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">وقت الموعد * ⏰</label>
                    <select
                      value={newBooking.time}
                      onChange={e => setNewBooking({ ...newBooking, time: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                      required
                    >
                      {generateSalonTimeSlots(settings).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة الحجز</label>
                  <select
                    value={newBooking.status}
                    onChange={e => setNewBooking({ ...newBooking, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                  >
                    <option value="confirmed">مؤكد</option>
                    <option value="pending">قيد الانتظار</option>
                    <option value="completed">مكتمل</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>
              </div>

              {/* Add Services Sub-Section with Searchable Autocomplete */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                <h3 className="text-xs font-black text-slate-800 mb-2.5 flex items-center justify-between">
                  <span>إضافة الخدمات والموظفين للحجز:</span>
                  <span className="text-[10px] text-slate-400 font-normal">بحث ذكي وإكمال تلقائي 🔍</span>
                </h3>
                
                <div className="space-y-2.5 mb-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    
                    {/* 1. SERVICE SEARCHABLE AUTOCOMPLETE */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        الخدمة (ابحث بالاسم أو السعر) *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={serviceSearchQuery}
                          onChange={e => {
                            setServiceSearchQuery(e.target.value);
                            setIsServiceDropdownOpen(true);
                            // If typed text doesn't match selected, clear serviceToAdd
                            const exactMatch = services.find(s => s.name.toLowerCase() === e.target.value.toLowerCase().trim());
                            if (exactMatch) {
                              setServiceToAdd(exactMatch.id);
                            } else {
                              setServiceToAdd('');
                            }
                          }}
                          onFocus={() => setIsServiceDropdownOpen(true)}
                          placeholder="🔍 اكتب اسم الخدمة أو السعر..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none text-slate-900 shadow-xs"
                        />
                        {serviceSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setServiceSearchQuery('');
                              setServiceToAdd('');
                              setIsServiceDropdownOpen(true);
                            }}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Dropdown Menu for Autocomplete */}
                      {isServiceDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsServiceDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto p-1.5 space-y-1 text-right">
                            {filteredServicesForBooking.length > 0 ? (
                              filteredServicesForBooking.map(s => {
                                const isSelected = serviceToAdd === s.id;
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setServiceToAdd(s.id);
                                      setServiceSearchQuery(s.name);
                                      setIsServiceDropdownOpen(false);
                                      // If no tech is selected yet, default to first active employee
                                      if (!techToAdd && employees.length > 0) {
                                        const firstActive = employees.find(e => e.isActive !== false);
                                        if (firstActive) setTechToAdd(firstActive.id);
                                      }
                                    }}
                                    className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                                      isSelected 
                                        ? 'bg-indigo-50 text-indigo-900 font-black border border-indigo-200' 
                                        : 'hover:bg-slate-100 text-slate-800'
                                    }`}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-bold">{s.name}</span>
                                      {s.category && (
                                        <span className="text-[10px] text-slate-400">{s.category}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="bg-emerald-50 text-emerald-700 font-mono font-black px-2 py-0.5 rounded-lg text-[11px] border border-emerald-200">
                                        {s.price} {settings.currency}
                                      </span>
                                      {s.durationMinutes && (
                                        <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                                          {s.durationMinutes} د
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-400">
                                لا توجد خدمات مطابقة لـ "{serviceSearchQuery}"
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 2. EMPLOYEE SELECTOR */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        الموظف المنفذ *
                      </label>
                      <select
                        value={techToAdd}
                        onChange={e => setTechToAdd(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600 shadow-xs"
                      >
                        <option value="">اختر الموظف...</option>
                        {employees.filter(e => e.isActive !== false).map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Add Button */}
                  <button
                    type="button"
                    onClick={addServiceToBooking}
                    disabled={!serviceToAdd || !techToAdd}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>+ إضافة الخدمة إلى جدول الموعد</span>
                  </button>
                </div>

                {/* Services List */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {newBooking.services?.map(s => (
                    <div key={s.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{s.serviceName}</div>
                        <div className="text-[10px] text-slate-500">الفني: {s.technicianName}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-800">{s.price} {settings.currency}</span>
                        <button
                          type="button"
                          onClick={() => setNewBooking({
                            ...newBooking,
                            services: newBooking.services?.filter(sx => sx.id !== s.id)
                          })}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!newBooking.services || newBooking.services.length === 0) && (
                    <div className="text-center text-xs text-slate-400 py-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      لم يتم إضافة أي خدمات بعد
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="text-xs font-bold text-slate-700">
                الإجمالي: <span className="font-mono text-indigo-700 text-sm font-black">
                  {(newBooking.services || []).reduce((sum, s) => sum + s.price, 0)} {settings.currency}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={saveBooking}
                  className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm cursor-pointer"
                >
                  حفظ وتأكيد الحجز
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* ENLARGED BOOKING AVAILABILITY & RULES MODAL (إدارة السعة والمواعيد والأيام) */}
      {/* ========================================================================= */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 border border-slate-200 my-auto">
            {/* 1. Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-black shadow-lg">
                  <Sliders size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg sm:text-xl text-white">إعدادات وقواعد توافر الحجوزات</h3>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      نظام ذكي متقدم ⚡
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 font-medium">
                    ضبط سعة الحجوزات للموظفين، فترات الساعات، مواعيد العمل، وإغلاق الأيام والساعات
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowRulesModal(false)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* 2. Modal Sub-Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-2 overflow-x-auto">
              {[
                { id: 'capacity', label: 'سعة الحجوزات ومواعيد العمل ⏱️' },
                { id: 'blocked_dates', label: 'إغلاق أيام كاملة 📅' },
                { id: 'blocked_hours', label: 'إغلاق ساعات معينة ⏰' },
                { id: 'staff_unavail', label: 'إجازات وعدم إتاحة موظف 👤' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRulesActiveTab(tab.id as any)}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                    rulesActiveTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* 3. Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
              
              {/* ================= TAB: CAPACITY & SALON TIMING ================= */}
              {rulesActiveTab === 'capacity' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* Card 1: Per-Staff Capacity Rule */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                          <User size={18} className="text-indigo-600" />
                          <span>سعة الحجوزات للموظف الواحد في الساعة:</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          تحديد الحد الأقصى لعدد العملاء الذين يمكن للموظف استقبالهم في الساعة الواحدة
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Option 1: 1 Booking Per Hour */}
                      <label 
                        onClick={() => {
                          setMaxPerStaffInput(1);
                          setSlotIntervalInput(60);
                        }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                          maxPerStaffInput === 1 
                            ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/20' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="maxPerStaff"
                          checked={maxPerStaffInput === 1}
                          onChange={() => {
                            setMaxPerStaffInput(1);
                            setSlotIntervalInput(60);
                          }}
                          className="mt-1 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="font-black text-sm text-slate-900">1 حجز في الساعة (الافتراضي والموصى به) ⭐</p>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            تُغلق الساعة بالكامل للموظف عند حجزه وتظهر للعملاء بكلمة <span className="font-bold text-rose-600">"محجوزة"</span>، لمنع التزاحم وضمان راحة الخدمة.
                          </p>
                        </div>
                      </label>

                      {/* Option 2: 2 Bookings Per Hour */}
                      <label 
                        onClick={() => {
                          setMaxPerStaffInput(2);
                          setSlotIntervalInput(30);
                        }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                          maxPerStaffInput === 2 
                            ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/20' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="maxPerStaff"
                          checked={maxPerStaffInput === 2}
                          onChange={() => {
                            setMaxPerStaffInput(2);
                            setSlotIntervalInput(30);
                          }}
                          className="mt-1 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="font-black text-sm text-slate-900">2 حجز في الساعة (تقسيم نصف ساعة) ⏱️</p>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            يتم تقسيم كل ساعة إلى نصفين (كل 30 دقيقة)، مما يسمح للعميل باختيار موعد كل نصف ساعة وحجزين لنفس الموظف بالساعة.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Card 2: Salon Opening & Closing Hours */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                        <Clock size={18} className="text-indigo-600" />
                        <span>مواعيد فتح وإغلاق الصالون اليومية:</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        تتولد أوقات الحجوزات تلقائياً من وقت الفتح وتنتهي دائماً قبل موعد الإغلاق بساعة واحدة
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">وقت فتح الصالون (بدء العمل):</label>
                        <input
                          type="time"
                          value={openingTimeInput}
                          onChange={e => setOpeningTimeInput(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-black font-mono outline-none focus:border-indigo-600"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">أول موعد حجز يبدأ في هذا التوقيت</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">موعد إغلاق الصالون (نهاية العمل):</label>
                        <input
                          type="time"
                          value={closingTimeInput}
                          onChange={e => setClosingTimeInput(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-black font-mono outline-none focus:border-indigo-600"
                        />
                        <p className="text-[11px] text-indigo-600 font-bold mt-1">تنتهي الحجوزات تلقائياً قبل هذا التوقيت بـ 60 دقيقة</p>
                      </div>
                    </div>

                    {/* Notice Alert */}
                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 p-3.5 rounded-2xl text-xs flex items-start gap-2.5">
                      <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold">قاعدة انتهاء المواعيد قبل الإغلاق:</span> عند ضبط الإغلاق الساعة <strong>{closingTimeInput}</strong>، فإن آخر موعد متاح للحجز هو <strong>{timeSlotToMinutes(closingTimeInput) >= 60 ? minutesToFormattedSlot(timeSlotToMinutes(closingTimeInput) - 60) : 'الموعد الأخير'}</strong> لضمان إنهاء الخدمات قبل مغادرة الموظفين.
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Live Preview of Generated Time Slots */}
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-3xl shadow-lg border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-emerald-400" />
                        <h4 className="text-xs sm:text-sm font-black text-white">معاينة حية ومباشرة للساعات المتولدة للعملاء:</h4>
                      </div>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-lg">
                        {generateSalonTimeSlots({
                          ...settings,
                          bookingRules: {
                            ...settings.bookingRules,
                            openingTime: openingTimeInput,
                            closingTime: closingTimeInput,
                            slotIntervalMinutes: slotIntervalInput,
                            maxBookingsPerHour: maxPerStaffInput
                          }
                        }).length} موعد متاح
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-slate-950/60 rounded-2xl border border-slate-800">
                      {generateSalonTimeSlots({
                        ...settings,
                        bookingRules: {
                          ...settings.bookingRules,
                          openingTime: openingTimeInput,
                          closingTime: closingTimeInput,
                          slotIntervalMinutes: slotIntervalInput,
                          maxBookingsPerHour: maxPerStaffInput
                        }
                      }).map((slot, idx) => (
                        <span 
                          key={idx} 
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono font-bold"
                        >
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Save Button for Tab 1 */}
                  <button
                    type="button"
                    onClick={() => {
                      const updatedRules: BookingRulesSettings = {
                        ...settings.bookingRules,
                        maxBookingsPerHour: maxPerStaffInput,
                        slotIntervalMinutes: slotIntervalInput,
                        openingTime: openingTimeInput,
                        closingTime: closingTimeInput
                      };
                      if (setSettings) {
                        const newSettings = { ...settings, bookingRules: updatedRules };
                        setSettings(newSettings);
                        try { localStorage.setItem('smartcut_app_settings', JSON.stringify(newSettings)); } catch(e){}
                        alert('تم حفظ إعدادات السعة ومواعيد العمل بنجاح ✓');
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-2xl text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <Check size={18} />
                    <span>حفظ وتطبيق إعدادات السعة والمواعيد فوراً</span>
                  </button>
                </div>
              )}

              {/* ================= TAB 2: BLOCKED DATES ================= */}
              {rulesActiveTab === 'blocked_dates' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
                    <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <CalendarOff size={16} className="text-indigo-600" />
                      <span>إضافة تاريخ إغلاق كامل للصالون:</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ المطلوب إغلاقه:</label>
                        <input
                          type="date"
                          value={blockDateInput.date}
                          onChange={e => setBlockDateInput({ ...blockDateInput, date: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">سبب الإغلاق:</label>
                        <input
                          type="text"
                          value={blockDateInput.reason}
                          onChange={e => setBlockDateInput({ ...blockDateInput, reason: e.target.value })}
                          placeholder="عطلة رسمية / صيانة دورية..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!blockDateInput.date) return;
                        const newEntry: BlockedDateEntry = {
                          id: 'bd-' + Date.now(),
                          date: blockDateInput.date,
                          reason: blockDateInput.reason
                        };
                        const updatedRules = {
                          ...settings.bookingRules,
                          blockedDates: [...(settings.bookingRules?.blockedDates || []), newEntry]
                        };
                        if (setSettings) {
                          const newSettings = { ...settings, bookingRules: updatedRules };
                          setSettings(newSettings);
                          try { localStorage.setItem('smartcut_app_settings', JSON.stringify(newSettings)); } catch(e){}
                        }
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      + إغلاق هذا اليوم وحجبه عن الحجوزات
                    </button>
                  </div>

                  {/* List of Blocked Dates */}
                  <div>
                    <h5 className="font-black text-xs text-slate-700 mb-2">سجل الأيام المغلقة حالياً ({(settings.bookingRules?.blockedDates || []).length}):</h5>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(settings.bookingRules?.blockedDates || []).map(bd => (
                        <div key={bd.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 text-xs shadow-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-indigo-700 text-sm">{bd.date}</span>
                            <span className="text-slate-600 font-bold">({bd.reason || 'إغلاق'})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedRules = {
                                ...settings.bookingRules,
                                blockedDates: (settings.bookingRules?.blockedDates || []).filter(d => d.id !== bd.id)
                              };
                              if (setSettings) {
                                const newSettings = { ...settings, bookingRules: updatedRules };
                                setSettings(newSettings);
                                try { localStorage.setItem('smartcut_app_settings', JSON.stringify(newSettings)); } catch(e){}
                              }
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} />
                            <span>إلغاء الإغلاق</span>
                          </button>
                        </div>
                      ))}
                      {(!settings.bookingRules?.blockedDates || settings.bookingRules.blockedDates.length === 0) && (
                        <div className="text-center text-slate-400 py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          لا توجد أيام مغلقة حالياً
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 3: BLOCKED HOURS ================= */}
              {rulesActiveTab === 'blocked_hours' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
                    <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <Clock size={16} className="text-indigo-600" />
                      <span>إغلاق ساعات معينة في تاريخ محدد:</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ:</label>
                        <input
                          type="date"
                          value={blockHourInput.date}
                          onChange={e => setBlockHourInput({ ...blockHourInput, date: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">الساعة:</label>
                        <select
                          value={blockHourInput.time}
                          onChange={e => setBlockHourInput({ ...blockHourInput, time: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                        >
                          {generateSalonTimeSlots(settings).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">السبب:</label>
                        <input
                          type="text"
                          value={blockHourInput.reason}
                          onChange={e => setBlockHourInput({ ...blockHourInput, reason: e.target.value })}
                          placeholder="صيانة / استراحة"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!blockHourInput.date || !blockHourInput.time) return;
                        const newEntry: BlockedHourEntry = {
                          id: 'bh-' + Date.now(),
                          date: blockHourInput.date,
                          time: blockHourInput.time,
                          reason: blockHourInput.reason
                        };
                        const updatedRules = {
                          ...settings.bookingRules,
                          blockedHours: [...(settings.bookingRules?.blockedHours || []), newEntry]
                        };
                        if (setSettings) {
                          const newSettings = { ...settings, bookingRules: updatedRules };
                          setSettings(newSettings);
                          try { localStorage.setItem('smartcut_app_settings', JSON.stringify(newSettings)); } catch(e){}
                        }
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      + إغلاق هذه الساعة في التاريخ المحدد
                    </button>
                  </div>

                  {/* List of Blocked Hours */}
                  <div>
                    <h5 className="font-black text-xs text-slate-700 mb-2">قائمة الساعات المغلقة ({(settings.bookingRules?.blockedHours || []).length}):</h5>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(settings.bookingRules?.blockedHours || []).map(bh => (
                        <div key={bh.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 text-xs shadow-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-900">{bh.date}</span>
                            <span className="font-mono text-indigo-700 font-black text-sm">الساعة: {bh.time}</span>
                            <span className="text-slate-500 font-bold">({bh.reason || 'مغلقة'})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedRules = {
                                ...settings.bookingRules,
                                blockedHours: (settings.bookingRules?.blockedHours || []).filter(h => h.id !== bh.id)
                              };
                              if (setSettings) {
                                const newSettings = { ...settings, bookingRules: updatedRules };
                                setSettings(newSettings);
                                try { localStorage.setItem('smartcut_app_settings', JSON.stringify(newSettings)); } catch(e){}
                              }
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>إلغاء الإغلاق</span>
                          </button>
                        </div>
                      ))}
                      {(!settings.bookingRules?.blockedHours || settings.bookingRules.blockedHours.length === 0) && (
                        <div className="text-center text-slate-400 py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          لا توجد ساعات مغلقة
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 4: STAFF UNAVAILABILITY ================= */}
              {rulesActiveTab === 'staff_unavail' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
                    <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <User size={16} className="text-indigo-600" />
                      <span>تسجيل عدم إتاحة / إجازة لموظف في يوم معين:</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">الموظف:</label>
                        <select
                          value={staffUnavailInput.employeeId}
                          onChange={e => setStaffUnavailInput({ ...staffUnavailInput, employeeId: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                        >
                          {employees.filter(e => e.isActive !== false).map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ:</label>
                        <input
                          type="date"
                          value={staffUnavailInput.date}
                          onChange={e => setStaffUnavailInput({ ...staffUnavailInput, date: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">السبب:</label>
                        <input
                          type="text"
                          value={staffUnavailInput.reason}
                          onChange={e => setStaffUnavailInput({ ...staffUnavailInput, reason: e.target.value })}
                          placeholder="ظرف طارئ / إجازة خاصة"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!staffUnavailInput.employeeId || !staffUnavailInput.date) return;
                        const emp = employees.find(e => e.id === staffUnavailInput.employeeId);
                        const newEntry: StaffUnavailabilityEntry = {
                          id: 'su-' + Date.now(),
                          employeeId: staffUnavailInput.employeeId,
                          employeeName: emp?.name || '',
                          date: staffUnavailInput.date,
                          reason: staffUnavailInput.reason
                        };
                        const updatedRules = {
                          ...settings.bookingRules,
                          staffUnavailabilities: [...(settings.bookingRules?.staffUnavailabilities || []), newEntry]
                        };
                        if (setSettings) {
                          const newSettings = { ...settings, bookingRules: updatedRules };
                          setSettings(newSettings);
                          try { localStorage.setItem('smartcut_app_settings', JSON.stringify(newSettings)); } catch(e){}
                        }
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      + حجب الموظف عن الحجوزات في هذا اليوم
                    </button>
                  </div>

                  {/* List of Staff Unavailabilities */}
                  <div>
                    <h5 className="font-black text-xs text-slate-700 mb-2">سجل الموظفين غير المتاحين ({(settings.bookingRules?.staffUnavailabilities || []).length}):</h5>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(settings.bookingRules?.staffUnavailabilities || []).map(su => (
                        <div key={su.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 text-xs shadow-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-slate-900">{su.employeeName || employees.find(e => e.id === su.employeeId)?.name}</span>
                            <span className="font-mono text-indigo-700 font-bold">التاريخ: {su.date}</span>
                            <span className="text-slate-500 font-bold">({su.reason || 'إجازة'})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedRules = {
                                ...settings.bookingRules,
                                staffUnavailabilities: (settings.bookingRules?.staffUnavailabilities || []).filter(u => u.id !== su.id)
                              };
                              if (setSettings) {
                                const newSettings = { ...settings, bookingRules: updatedRules };
                                setSettings(newSettings);
                                try { localStorage.setItem('smartcut_app_settings', JSON.stringify(newSettings)); } catch(e){}
                              }
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>إلغاء الحجب</span>
                          </button>
                        </div>
                      ))}
                      {(!settings.bookingRules?.staffUnavailabilities || settings.bookingRules.staffUnavailabilities.length === 0) && (
                        <div className="text-center text-slate-400 py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          لا توجد استثناءات مسجلة
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* 4. Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                تطبق هذه القواعد فوراً على حجز الكاشير وبوابة الحجز الأونلاين للعملاء 🌐
              </span>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2.5 rounded-xl text-xs cursor-pointer shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
