import React, { useState, useMemo } from 'react';
import { 
  Booking, AppSettings, ServiceItem, Employee, Client, Branch, 
  AppUser, BlockedDateEntry, BlockedHourEntry, StaffUnavailabilityEntry,
  AdvancePayment, Transaction, Product, BookingService, BookingRulesSettings
} from '../types';
import { 
  Calendar as CalendarIcon, Plus, Printer, Edit2, X, ShoppingCart, 
  Search, ChevronRight, ChevronLeft, Clock, User, Phone, 
  Scissors, CheckCircle2, AlertCircle, Sparkles, Filter, 
  List, Grid3X3, Eye, CalendarDays, ArrowRight, Sliders, 
  CalendarOff, ShieldAlert, Trash2, Lock, ShieldCheck, Check,
  DollarSign, Wallet, CreditCard, Banknote, XCircle, FileSpreadsheet,
  MapPin, ShoppingBag, Package, Pencil
} from 'lucide-react';
import { 
  isDateBlocked, isHourBlocked, isStaffAvailableOnDate, 
  isStaffAvailableAtTime, timeSlotToMinutes, generateSalonTimeSlots, 
  isStaffBookedAtSlot, minutesToFormattedSlot 
} from '../utils/bookingAvailability';
import { QueueService } from '../services/queueService';
import { DB } from '../services/db';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize';
import { isBarberEmployee } from '../utils/employeeHelper';
import { BookingsImportModal } from './BookingsImportModal';
import { generateCode39Svg } from '../utils/printQueueSlip';

// Format time string (e.g. "14:30" or "09:00") into 12-hour format with AM/PM (ص / م)
export function formatTo12Hour(timeStr?: string): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  if (clean.includes('ص') || clean.includes('م') || /am|pm/i.test(clean)) {
    return clean;
  }
  const parts = clean.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0').substring(0, 2);
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? 'م' : 'ص';
      const h12 = hours % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    }
  }
  return clean;
}

// Format date and time string into readable 12-hour format: YYYY-MM-DD hh:mm ص/م
export function formatDateTime(dtStr?: string): string {
  if (!dtStr) return '-';
  try {
    const clean = String(dtStr).trim();
    if (!clean) return '-';
    // If it's only YYYY-MM-DD without time
    if (clean.length === 10 && clean.split('-').length === 3 && !clean.includes('T') && !clean.includes(' ')) {
      return clean;
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return clean;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    const h12 = hours % 12 || 12;
    const h12Str = String(h12).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${h12Str}:${minutes} ${ampm}`;
  } catch {
    return dtStr;
  }
}

// Calculate discount amount for a single service line
export function calculateServiceLineDiscount(s: any): number {
  const qty = Math.max(1, Number(s.quantity) || 1);
  const base = Number(s.price || 0) * qty;
  const val = Number(s.discountValue || 0);
  if (val <= 0) return 0;
  if (s.discountType === 'percentage') {
    return (base * Math.min(100, Math.max(0, val))) / 100;
  }
  return Math.min(base, Math.max(0, val));
}

// Calculate final price for a service line after its discount
export function calculateServiceLinePrice(s: any): number {
  const qty = Math.max(1, Number(s.quantity) || 1);
  const base = Number(s.price || 0) * qty;
  return Math.max(0, base - calculateServiceLineDiscount(s));
}

// Calculate comprehensive booking financial totals including item discounts and general discount
export function calculateBookingTotals(b: Partial<Booking>) {
  const services = b.services || [];
  const grossServices = services.reduce((sum, s) => {
    const qty = Math.max(1, Number(s.quantity) || 1);
    return sum + (Number(s.price || 0) * qty);
  }, 0);
  const lineDiscounts = services.reduce((sum, s) => sum + calculateServiceLineDiscount(s), 0);
  const subtotalAfterLines = Math.max(0, grossServices - lineDiscounts);

  // قاعدة عدم الجمع بين خصمين: إذا وُجدت خصومات على بنود الخدمات، لا يُطبّق خصم الإجمالي
  let generalDiscount = 0;
  const genVal = Number(b.discountValue || 0);
  if (lineDiscounts === 0 && genVal > 0) {
    if (b.discountType === 'percentage') {
      generalDiscount = (grossServices * Math.min(100, Math.max(0, genVal))) / 100;
    } else {
      generalDiscount = Math.min(grossServices, Math.max(0, genVal));
    }
  }

  const totalDiscounts = lineDiscounts > 0 ? lineDiscounts : generalDiscount;
  const netTotal = Math.max(0, grossServices - totalDiscounts);
  const advances = (b.advancePayments || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const remaining = Math.max(0, netTotal - advances);

  return {
    grossServices,
    lineDiscounts,
    subtotalAfterLines,
    generalDiscount,
    totalDiscounts,
    netTotal,
    advances,
    remaining
  };
}

export function getBookingAdvances(b: any): AdvancePayment[] {
  if (!b) return [];
  const raw = b.advancePayments || b.advance_payments;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export function getBookingTotalAdvances(b: any): number {
  return getBookingAdvances(b).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
}

export function BookingsScreen({ 
  settings, 
  setSettings,
  bookings, 
  setBookings, 
  onToPOS, 
  services, 
  products = [],
  employees,
  clients = [],
  setClients,
  activeBranchId,
  branches = [],
  currentUser,
  transactions = [],
  setTransactions,
  shiftData
}: { 
  settings: AppSettings, 
  setSettings?: (s: AppSettings) => void,
  bookings: Booking[], 
  setBookings: (b: Booking[]) => void, 
  onToPOS: (b: Booking) => void, 
  services: ServiceItem[], 
  products?: Product[],
  employees: Employee[],
  clients?: Client[],
  setClients?: (c: Client[]) => void,
  activeBranchId?: string,
  branches?: Branch[],
  currentUser?: AppUser | null,
  transactions?: Transaction[],
  setTransactions?: (t: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void,
  shiftData?: { isOpen: boolean; date: string; initialCash?: number }
}) {
  // Permission to adjust booking rules
  const canManageBookingSettings = currentUser?.actions.includes('manage_booking_settings') || 
    currentUser?.actions.includes('*') || 
    currentUser?.role === 'admin' || 
    currentUser?.role === 'owner' || 
    currentUser?.role === 'programmer';

  // Permission to permanently delete bookings
  const canDeleteBooking = !currentUser || 
    currentUser.role === 'admin' || 
    currentUser.role === 'owner' || 
    currentUser.role === 'programmer' || 
    currentUser.actions?.includes('manage_bookings_delete') || 
    currentUser.actions?.includes('*');

  // Primary Screen Tab: 'table' (default) | 'calendar'
  const [activeMainTab, setActiveMainTab] = useState<'table' | 'calendar'>('table');

  // Excel Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);

  const defaultBookingDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : new Date().toISOString().split('T')[0];

  // New Booking State
  const [newBooking, setNewBooking] = useState<Partial<Booking>>({
    clientName: '',
    phone: '',
    date: defaultBookingDate,
    time: '10:00',
    status: 'confirmed',
    location: '',
    notes: '',
    internalNotes: '',
    services: [],
    advancePayments: [],
    totalAmount: 0,
    discountType: 'fixed',
    discountValue: 0
  });

  // Matching Client info & Phone Autocomplete during manual booking creation
  const [matchingClientInfo, setMatchingClientInfo] = useState<Client | null>(null);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [highlightedPhoneIndex, setHighlightedPhoneIndex] = useState(-1);

  // Combined clients pool (from clients prop + unique clients in previous bookings)
  const allAvailableClients = useMemo(() => {
    const list: Client[] = [...clients];
    const seen = new Set(clients.map(c => (c.phone || '').trim().replace(/\D/g, '')));
    
    bookings.forEach(b => {
      if (b.phone && b.clientName) {
        const cleanP = b.phone.trim().replace(/\D/g, '');
        if (cleanP && !seen.has(cleanP)) {
          seen.add(cleanP);
          list.push({
            id: b.customerId || `client-hist-${cleanP}`,
            name: b.clientName,
            phone: b.phone,
            loyaltyPoints: 0,
            cashback: 0
          });
        }
      }
    });
    return list;
  }, [clients, bookings]);

  // Live filtered suggestions based on phone input
  const phoneSuggestions = useMemo(() => {
    const input = (newBooking.phone || '').trim();
    if (!input) return [];
    const cleanDigits = input.replace(/\D/g, '');
    const lowerInput = input.toLowerCase();

    return allAvailableClients.filter(c => {
      const cPhoneClean = (c.phone || '').trim().replace(/\D/g, '');
      const cNameLower = (c.name || '').toLowerCase();

      // Check digits match
      if (cleanDigits.length > 0 && cPhoneClean.includes(cleanDigits)) {
        return true;
      }
      // Check name match
      if (cNameLower.includes(lowerInput)) {
        return true;
      }
      return false;
    }).slice(0, 8);
  }, [allAvailableClients, newBooking.phone]);

  const handleSelectClientSuggestion = (client: Client) => {
    setMatchingClientInfo(client);
    setNewBooking(prev => ({
      ...prev,
      phone: client.phone,
      clientName: client.name,
      customerId: client.id,
      notes: prev.notes || client.notes || ''
    }));
    setShowPhoneSuggestions(false);
    setHighlightedPhoneIndex(-1);
  };

  const handlePhoneChange = (phoneVal: string) => {
    const cleanPhone = phoneVal.trim();
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    
    // Check for exact / strong match
    const exactMatch = allAvailableClients.find(c => {
      if (!c.phone) return false;
      const cClean = c.phone.trim().replace(/\D/g, '');
      return cClean === cleanDigits || c.phone.trim() === cleanPhone || (cleanDigits.length >= 7 && (cClean.endsWith(cleanDigits) || cleanDigits.endsWith(cClean)));
    });

    if (exactMatch) {
      setMatchingClientInfo(exactMatch);
      setNewBooking(prev => ({
        ...prev,
        phone: phoneVal,
        clientName: prev.clientName && prev.clientName !== exactMatch.name && prev.clientName.trim().length > 0 ? prev.clientName : exactMatch.name,
        customerId: exactMatch.id
      }));
    } else {
      setMatchingClientInfo(null);
      setNewBooking(prev => ({
        ...prev,
        phone: phoneVal
      }));
    }

    if (cleanPhone.length > 0) {
      setShowPhoneSuggestions(true);
      setHighlightedPhoneIndex(-1);
    } else {
      setShowPhoneSuggestions(false);
    }
  };

  const [itemTypeToAdd, setItemTypeToAdd] = useState<'service' | 'product'>('service');
  const [serviceToAdd, setServiceToAdd] = useState('');
  const [techToAdd, setTechToAdd] = useState('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [productToAdd, setProductToAdd] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [serviceQtyToAdd, setServiceQtyToAdd] = useState<string>('1');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);

  // حالة تعديل سعر الخدمة أو المنتج داخل الحجز فقط (بالقلم)
  const [editingPriceServiceId, setEditingPriceServiceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');

  // Advance Payments State for Add/Edit Modal
  const [advAmountInput, setAdvAmountInput] = useState<number | ''>('');
  const [advTreasuryInput, setAdvTreasuryInput] = useState<string>('');
  const [advMethodInput, setAdvMethodInput] = useState<string>('cash');
  const [advDateInput, setAdvDateInput] = useState<string>(defaultBookingDate);
  const [advNotesInput, setAdvNotesInput] = useState<string>('');

  // Quick Advance Modal for Details View
  const [showQuickAdvanceModal, setShowQuickAdvanceModal] = useState<boolean>(false);
  const [quickAdvAmount, setQuickAdvAmount] = useState<number | ''>('');
  const [quickAdvTreasury, setQuickAdvTreasury] = useState<string>('');
  const [quickAdvMethod, setQuickAdvMethod] = useState<string>('cash');
  const [quickAdvDate, setQuickAdvDate] = useState<string>(defaultBookingDate);
  const [quickAdvNotes, setQuickAdvNotes] = useState<string>('');

  // List of operational payment methods / treasuries excluding the Main Treasury (الخزينة الرئيسية)
  const availableTreasuries = useMemo(() => {
    const rawList = (settings.treasuries || []).filter(t => 
      !t.isMain && 
      t.id !== 'main' && 
      !t.name.includes('الرئيسية')
    );

    if (rawList.length === 0) {
      return [
        { id: 'cash', name: 'كاش (الدرج)', isMain: false },
        { id: 'card', name: 'شبكة / مدى', isMain: false }
      ];
    }

    return rawList;
  }, [settings.treasuries]);

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

  // Filtered retail products for autocomplete search
  const retailProducts = useMemo(() => {
    return (products || []).filter(p => !p.productType || p.productType === 'retail');
  }, [products]);

  const filteredProductsForBooking = useMemo(() => {
    if (!productSearchQuery.trim()) return retailProducts;
    const q = productSearchQuery.toLowerCase().trim();
    return retailProducts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      p.sellPrice.toString().includes(q)
    );
  }, [retailProducts, productSearchQuery]);

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
      const bDate = b.date ? b.date.split('T')[0].trim() : '';
      if (dateFrom && bDate < dateFrom) return false;
      if (dateTo && bDate > dateTo) return false;

      // Status filter
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      // Technician filter
      if (selectedTech !== 'all') {
        const matchesTech = b.services?.some(s => s.technicianId === selectedTech);
        if (!matchesTech) return false;
      }

      // Search query (name, phone, service, booking ID / barcode)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = b.clientName?.toLowerCase().includes(q);
        const matchesPhone = b.phone?.includes(q);
        const matchesService = b.services?.some(s => s.serviceName?.toLowerCase().includes(q));
        const matchesId = b.id?.toLowerCase().includes(q)
          || (b.bookingCode && b.bookingCode.toLowerCase().includes(q))
          || (b.queueNumber && `b-${b.queueNumber}`.toLowerCase().includes(q));
        if (!matchesClient && !matchesPhone && !matchesService && !matchesId) return false;
      }

      return true;
    }).sort((a, b) => {
      const aKey = (a.date ? a.date.split('T')[0].trim() : '') + (a.time || '');
      const bKey = (b.date ? b.date.split('T')[0].trim() : '') + (b.time || '');
      return bKey.localeCompare(aKey);
    });
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
        const matchesId = b.id?.toLowerCase().includes(q)
          || (b.bookingCode && b.bookingCode.toLowerCase().includes(q))
          || (b.queueNumber && `b-${b.queueNumber}`.toLowerCase().includes(q));
        if (!matchesClient && !matchesPhone && !matchesService && !matchesId) return false;
      }

      return true;
    });
  }, [bookings, statusFilter, selectedTech, searchQuery, activeBranchId, isMainBranch]);

  // Group Bookings by Date and Hour Slot for quick lookup in calendar
  const bookingsByDateAndSlot = useMemo(() => {
    const map = new Map<string, Booking[]>();
    calendarFilteredBookings.forEach(b => {
      if (!b.date) return;
      const bDate = b.date.split('T')[0].trim();
      const hourPart = b.time ? b.time.substring(0, 2) + ':00' : '10:00';
      const key = `${bDate}_${hourPart}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [calendarFilteredBookings]);

  // Quick Open Modal on Empty Slot Click
  const handleEmptySlotClick = (dateStr: string, slotTime: string, technicianId?: string) => {
    if (!shiftData?.isOpen) {
      alert('لا يمكن تسجيل حجز جديد والوردية مغلقة. يرجى فتح وردية أولاً من شاشة الورديات.');
      return;
    }
    const openShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : dateStr;
    setEditingBooking(null);
    setItemTypeToAdd('service');
    setServiceSearchQuery('');
    setServiceToAdd('');
    setProductToAdd('');
    setProductSearchQuery('');
    setIsServiceDropdownOpen(false);
    setIsProductDropdownOpen(false);
    setServiceQtyToAdd('1');
    setEditingPriceServiceId(null);
    setEditingPriceValue('');
    setNewBooking({
      clientName: '',
      phone: '',
      date: openShiftDate,
      time: slotTime,
      status: 'confirmed',
      location: '',
      notes: '',
      internalNotes: '',
      services: [],
      advancePayments: [],
      totalAmount: 0,
      discountType: 'fixed',
      discountValue: 0
    });
    setShowPhoneSuggestions(false);
    setHighlightedPhoneIndex(-1);
    setMatchingClientInfo(null);
    setAdvTreasuryInput(availableTreasuries[0]?.id || 'cash');
    setAdvDateInput(openShiftDate);
    if (technicianId && technicianId !== 'all') {
      setTechToAdd(technicianId);
    } else {
      setTechToAdd('');
    }
    setShowAddModal(true);
  };

  // Add Service to Booking Form
  const addServiceToBooking = () => {
    const srv = services.find(s => s.id === serviceToAdd);
    if (!srv) return;
    const emp = employees.find(e => e.id === techToAdd);
    const parsedQty = parseInt(serviceQtyToAdd, 10);
    const qty = (!isNaN(parsedQty) && parsedQty > 0) ? parsedQty : 1;
    const bs: BookingService = {
      id: Math.random().toString(36).substr(2, 9),
      serviceId: srv.id,
      serviceName: srv.name,
      technicianId: emp ? emp.id : '',
      technicianName: emp ? emp.name : 'غير محدد',
      price: srv.price,
      quantity: qty,
      type: 'service',
      discountType: 'fixed',
      discountValue: 0
    };
    const updatedServices = [...(newBooking.services || []), bs];
    const totals = calculateBookingTotals({ ...newBooking, services: updatedServices });
    setNewBooking({
      ...newBooking,
      services: updatedServices,
      totalAmount: totals.netTotal
    });
    setServiceToAdd('');
    setServiceSearchQuery('');
    setTechToAdd('');
    setServiceQtyToAdd('1');
    setIsServiceDropdownOpen(false);
  };

  // Add Product to Booking Form
  const addProductToBooking = () => {
    const prd = retailProducts.find(p => p.id === productToAdd);
    if (!prd) return;
    const emp = employees.find(e => e.id === techToAdd);
    const parsedQty = parseInt(serviceQtyToAdd, 10);
    const qty = (!isNaN(parsedQty) && parsedQty > 0) ? parsedQty : 1;
    const bs: BookingService = {
      id: Math.random().toString(36).substr(2, 9),
      serviceId: prd.id,
      productId: prd.id,
      serviceName: prd.name,
      technicianId: emp ? emp.id : '',
      technicianName: emp ? emp.name : 'غير محدد',
      price: prd.sellPrice,
      quantity: qty,
      type: 'product',
      discountType: 'fixed',
      discountValue: 0
    };
    const updatedServices = [...(newBooking.services || []), bs];
    const totals = calculateBookingTotals({ ...newBooking, services: updatedServices });
    setNewBooking({
      ...newBooking,
      services: updatedServices,
      totalAmount: totals.netTotal
    });
    setProductToAdd('');
    setProductSearchQuery('');
    setTechToAdd('');
    setServiceQtyToAdd('1');
    setIsProductDropdownOpen(false);
  };

  // بدء تعديل سعر الخدمة أو المنتج بالقلم داخل الحجز فقط
  const handleStartEditPrice = (s: BookingService) => {
    setEditingPriceServiceId(s.id);
    setEditingPriceValue(String(s.price ?? 0));
  };

  // حفظ السعر المخصص داخل الحجز فقط دون تعديل السعر الأساسي للخدمة
  const handleSaveCustomServicePrice = (serviceLineId: string) => {
    const parsed = parseFloat(editingPriceValue);
    const newPrice = isNaN(parsed) ? 0 : Math.max(0, parsed);
    const updated = (newBooking.services || []).map(sx => {
      if (sx.id === serviceLineId) {
        return {
          ...sx,
          price: newPrice,
          isCustomPrice: true
        };
      }
      return sx;
    });
    const totals = calculateBookingTotals({ ...newBooking, services: updated });
    setNewBooking({
      ...newBooking,
      services: updated,
      totalAmount: totals.netTotal
    });
    setEditingPriceServiceId(null);
    setEditingPriceValue('');
  };

  // إلغاء تعديل السعر
  const handleCancelEditPrice = () => {
    setEditingPriceServiceId(null);
    setEditingPriceValue('');
  };

  // Helper to add advance payment inside Add/Edit modal
  const handleAddAdvanceInModal = () => {
    const amt = Number(advAmountInput);
    if (!amt || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح للدفعة المقدمة');
      return;
    }
    const currentTreasuries = availableTreasuries;
    const tId = advTreasuryInput || (currentTreasuries[0]?.id || 'cash');
    const selectedTreasuryObj = currentTreasuries.find(t => t.id === tId);
    const tName = selectedTreasuryObj?.name || (tId === 'cash' ? 'كاش (الدرج)' : 'طريقة الدفع');

    const effectiveShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : undefined;
    const advDate = effectiveShiftDate || advDateInput || new Date().toISOString().split('T')[0];

    const newAdv: AdvancePayment = {
      id: 'ADV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      amount: amt,
      treasuryId: tId,
      treasuryName: tName,
      date: advDate,
      paymentMethod: advMethodInput || 'cash',
      notes: advNotesInput.trim() || undefined
    };

    setNewBooking(prev => ({
      ...prev,
      advancePayments: [...(prev.advancePayments || []), newAdv]
    }));

    // Reset inputs
    setAdvAmountInput('');
    setAdvNotesInput('');
  };

  const handleRemoveAdvanceInModal = (advId: string) => {
    setNewBooking(prev => ({
      ...prev,
      advancePayments: (prev.advancePayments || []).filter(a => a.id !== advId)
    }));
  };

  // Quick Add Advance directly from Booking Details Modal
  const handleSaveQuickAdvance = async () => {
    if (!selectedBookingDetails) return;
    const amt = Number(quickAdvAmount);
    if (!amt || amt <= 0) {
      alert('يرجى إدخال مبلغ صالح للدفعة المقدمة');
      return;
    }

    const currentTreasuries = availableTreasuries;
    const tId = quickAdvTreasury || (currentTreasuries[0]?.id || 'cash');
    const selectedTreasuryObj = currentTreasuries.find(t => t.id === tId);
    const tName = selectedTreasuryObj?.name || (tId === 'cash' ? 'كاش (الدرج)' : 'طريقة الدفع');
    const effectiveShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : undefined;
    const advDate = effectiveShiftDate || quickAdvDate || new Date().toISOString().split('T')[0];

    const newAdv: AdvancePayment = {
      id: 'ADV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      amount: amt,
      treasuryId: tId,
      treasuryName: tName,
      date: advDate,
      paymentMethod: quickAdvMethod || 'cash',
      notes: quickAdvNotes.trim() || undefined
    };

    const nowIso = new Date().toISOString();
    const currentUserName = currentUser?.name || (currentUser as any)?.username || 'الكاشير';
    const currentUserId = currentUser?.id;

    const nowEpoch = Date.now();
    const updatedBooking: Booking = {
      ...selectedBookingDetails,
      advancePayments: [...(selectedBookingDetails.advancePayments || []), newAdv],
      updatedAt: nowIso,
      updated_at: nowIso,
      updatedBy: currentUserId,
      updated_by: currentUserId,
      updatedByName: currentUserName,
      updated_by_name: currentUserName,
      _localEditedAt: nowEpoch
    };

    // Update in bookings state & DB
    setBookings((prev: Booking[]) => prev.map(b => b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b));
    setSelectedBookingDetails(updatedBooking);
    await DB.saveBooking(updatedBooking);

    // Create immediate financial transaction for this advance on its specific date
    const bBranchId = updatedBooking.branchId || activeBranchId || mainBranchId;
    const newTrx: Transaction = {
      id: 'TRX-ADV-' + Math.random().toString(36).substr(2, 9),
      date: advDate + 'T' + new Date().toTimeString().split(' ')[0],
      shiftDate: effectiveShiftDate,
      type: 'in',
      amount: amt,
      category: 'مقدم حجز',
      description: `دفعة مقدمة / عربون لحجز #${updatedBooking.bookingCode || updatedBooking.id} - العميل: ${updatedBooking.clientName}`,
      treasury: tId,
      createdBy: currentUser?.name || 'الكاشير',
      userId: currentUser?.id,
      userName: currentUser?.name || 'الكاشير',
      branchId: bBranchId,
      salonId: settings.salonId
    };

    if (setTransactions) {
      setTransactions(prev => [...prev, newTrx]);
    }
    await DB.saveTransaction(newTrx);

    // Reset quick modal
    setShowQuickAdvanceModal(false);
    setQuickAdvAmount('');
    setQuickAdvNotes('');
    alert(`تم تسجيل الدفعة المقدمة بنجاح بقيمة ${amt} ${settings.currency} وتوريدها إلى الخزينة بتاريخ ${advDate}`);
  };

  // Save Booking
  const saveBooking = async () => {
    if (!editingBooking && !shiftData?.isOpen) {
      alert('لا يمكن تسجيل حجز جديد والوردية مغلقة. يرجى فتح وردية أولاً من شاشة الورديات.');
      return;
    }

    if (!newBooking.clientName || !newBooking.phone || !newBooking.date || !newBooking.time) {
      alert('يرجى ملء جميع الحقول الإلزامية: رقم الموبايل، اسم العميل، التاريخ، والوقت');
      return;
    }

    const effectiveBookingDate = newBooking.date || ((!editingBooking && shiftData?.isOpen && shiftData.date)
      ? shiftData.date
      : defaultBookingDate);

    const bBranchId = editingBooking?.branchId || activeBranchId || mainBranchId;
    let queueNumber = editingBooking?.queueNumber;
    if (!queueNumber) {
      queueNumber = await QueueService.getNextBookingQueueNumberAsync(settings.salonId, bBranchId, effectiveBookingDate);
    }

    const hasServiceDiscounts = (newBooking.services || []).some(s => Number(s.discountValue || 0) > 0);
    const hasTotalDiscount = Number(newBooking.discountValue || 0) > 0;

    const finalServices = (newBooking.services || []).map(s => ({
      ...s,
      quantity: Math.max(1, Number(s.quantity) || 1),
      discountType: s.discountType || 'fixed',
      discountValue: hasTotalDiscount ? 0 : Number(s.discountValue || 0)
    }));
    const finalDiscountValue = hasServiceDiscounts ? 0 : Number(newBooking.discountValue || 0);
    const finalDiscountType = newBooking.discountType || 'fixed';

    const totals = calculateBookingTotals({
      ...newBooking,
      services: finalServices,
      discountValue: finalDiscountValue,
      discountType: finalDiscountType
    });

    const currentUserName = currentUser?.name || (currentUser as any)?.username || 'الكاشير';
    const currentUserId = currentUser?.id;
    const nowIso = new Date().toISOString();

    const isEditing = Boolean(editingBooking);

    // تاريخ ووقت الإنشاء محمي تماماً ولا يتغير مع أي تعديلات تتم لاحقاً على الحجز
    const bookingCreatedAt = isEditing 
      ? (editingBooking?.createdAt || (editingBooking as any)?.created_at || (newBooking.createdAt as string) || nowIso)
      : nowIso;
    const bookingCreatedBy = isEditing
      ? (editingBooking?.createdBy || (editingBooking as any)?.created_by || newBooking.createdBy)
      : currentUserId;
    const bookingCreatedByName = isEditing
      ? (editingBooking?.createdByName || (editingBooking as any)?.created_by_name || editingBooking?.createdBy || newBooking.createdByName || currentUserName)
      : currentUserName;

    // تاريخ ووقت واسم المستخدم الذي قام بالتعديل
    const bookingUpdatedAt = isEditing ? nowIso : (editingBooking?.updatedAt || (editingBooking as any)?.updated_at || undefined);
    const bookingUpdatedBy = isEditing ? currentUserId : undefined;
    const bookingUpdatedByName = isEditing ? currentUserName : undefined;

    const effectiveClientId = newBooking.customerId || (newBooking as any).clientId || editingBooking?.clientId || (editingBooking as any)?.client_id || undefined;
    const effectiveCustomerEmail = newBooking.customerEmail || editingBooking?.customerEmail || (editingBooking as any)?.customer_email || undefined;
    const effectiveBookingCode = editingBooking?.bookingCode || (editingBooking as any)?.booking_code || (newBooking as any)?.bookingCode || undefined;
    const effectiveSource = editingBooking?.source || (newBooking as any)?.source || 'pos';
    const effectiveSalonId = settings.salonId || editingBooking?.salonId || (editingBooking as any)?.salon_id || undefined;

    const booking: Booking = {
      ...(editingBooking ? editingBooking : {}),
      id: editingBooking ? editingBooking.id : 'B-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      bookingCode: effectiveBookingCode,
      source: effectiveSource,
      salonId: effectiveSalonId,
      clientId: effectiveClientId,
      customerEmail: effectiveCustomerEmail,
      clientName: newBooking.clientName!,
      phone: newBooking.phone!,
      date: effectiveBookingDate,
      time: newBooking.time!,
      status: newBooking.status || editingBooking?.status || 'confirmed',
      location: newBooking.location?.trim() || undefined,
      notes: newBooking.notes?.trim() || undefined,
      internalNotes: newBooking.internalNotes?.trim() || undefined,
      services: finalServices,
      advancePayments: newBooking.advancePayments || [],
      totalAmount: totals.netTotal,
      discountType: finalDiscountType,
      discountValue: finalDiscountValue,
      branchId: bBranchId,
      queueNumber,
      createdAt: bookingCreatedAt,
      created_at: bookingCreatedAt,
      createdBy: bookingCreatedBy,
      created_by: bookingCreatedBy,
      createdByName: bookingCreatedByName,
      created_by_name: bookingCreatedByName,
      updatedAt: bookingUpdatedAt,
      updated_at: bookingUpdatedAt,
      updatedBy: bookingUpdatedBy,
      updated_by: bookingUpdatedBy,
      updatedByName: bookingUpdatedByName,
      updated_by_name: bookingUpdatedByName,
      _localEditedAt: Date.now()
    };

    // Calculate newly added advance payments to generate financial transactions
    const prevAdvIds = new Set((editingBooking?.advancePayments || []).map(a => a.id));
    const brandNewAdvances = (booking.advancePayments || []).filter(a => !prevAdvIds.has(a.id));

    if (editingBooking) {
      setBookings((prev: Booking[]) => prev.map(b => b.id === booking.id ? { ...b, ...booking, _localEditedAt: Date.now() } : b));
    } else {
      setBookings((prev: Booking[]) => [{ ...booking, _localEditedAt: Date.now() }, ...prev]);
    }

    try {
      const stored = localStorage.getItem('smartcut_bookings');
      const list = stored ? JSON.parse(stored) : [];
      const updatedList = editingBooking
        ? list.map((b: any) => b.id === booking.id ? { ...b, ...booking, _localEditedAt: Date.now() } : b)
        : [{ ...booking, _localEditedAt: Date.now() }, ...list.filter((b: any) => b.id !== booking.id)];
      localStorage.setItem('smartcut_bookings', JSON.stringify(updatedList));
    } catch (e) {}

    await DB.saveBooking(booking, settings.salonId);

    // Auto generate financial transactions for brand new advance payments on their payment date
    if (brandNewAdvances.length > 0) {
      const effectiveShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : undefined;
      const newTrxs: Transaction[] = brandNewAdvances.map(adv => {
        const transDate = (effectiveShiftDate || adv.date || new Date().toISOString().split('T')[0]) + 'T' + new Date().toTimeString().split(' ')[0];
        return {
          id: 'TRX-ADV-' + Math.random().toString(36).substr(2, 9),
          date: transDate,
          shiftDate: effectiveShiftDate,
          type: 'in',
          amount: adv.amount,
          category: 'مقدم حجز',
          description: `دفعة مقدمة / عربون لحجز #${booking.bookingCode || booking.id} - العميل: ${booking.clientName}`,
          treasury: adv.treasuryId,
          createdBy: currentUser?.name || 'الكاشير',
          userId: currentUser?.id,
          userName: currentUser?.name || 'الكاشير',
          branchId: bBranchId,
          salonId: settings.salonId
        };
      });

      if (setTransactions) {
        setTransactions(prev => [...prev, ...newTrxs]);
      }
      for (const t of newTrxs) {
        await DB.saveTransaction(t);
      }
    }

    // Auto add client to overall salon clients database if new
    let matchedClient = clients.find(c => c.phone && c.phone.trim() === newBooking.phone!.trim());
    if (setClients && newBooking.phone && !matchedClient) {
      const cleanInput = newBooking.phone.trim();
      matchedClient = {
        id: 'c-' + Date.now(),
        name: newBooking.clientName.trim(),
        phone: cleanInput,
        email: newBooking.customerEmail || '',
        notes: 'عميل مسجل تلقائياً من شاشة الحجوزات',
        loyaltyPoints: 0,
        cashback: 0,
        createdAt: new Date().toISOString()
      };
      setClients([matchedClient, ...clients]);
    }

    // إذا كان الحجز بتاريخ اليوم، يتم إدراجه في شاشة المناداة دون فتح فاتورة معلقة نهائياً
    const todayDateStr = new Date().toISOString().split('T')[0];
    if (newBooking.date === todayDateStr) {
      try {
        await QueueService.createTicketFromBooking({
          booking,
          salonId: settings.salonId,
          branchId: bBranchId,
          client: matchedClient
        });
      } catch (err) {
        console.warn('Failed to sync today booking ticket:', err);
      }
    }

    setShowAddModal(false);
    setEditingBooking(null);
    setSelectedBookingDetails(null);
    setMatchingClientInfo(null);
    setShowPhoneSuggestions(false);
    setHighlightedPhoneIndex(-1);
    setItemTypeToAdd('service');
    setServiceToAdd('');
    setServiceSearchQuery('');
    setProductToAdd('');
    setProductSearchQuery('');
    setIsServiceDropdownOpen(false);
    setIsProductDropdownOpen(false);
    setServiceQtyToAdd('1');
    setEditingPriceServiceId(null);
    setEditingPriceValue('');

    // عند تعديل الحجز أو حفظه لأول مرة تظهر مباشرة شاشة الإيصال لطباعته
    setTimeout(() => {
      printBooking(booking);
    }, 150);
  };

  const handleEdit = (b: Booking) => {
    setEditingBooking(b);
    setShowPhoneSuggestions(false);
    setHighlightedPhoneIndex(-1);
    const matched = clients.find(c => c.phone && b.phone && c.phone.trim().replace(/\D/g, '') === b.phone.trim().replace(/\D/g, ''));
    setMatchingClientInfo(matched || null);
    setItemTypeToAdd('service');
    setServiceToAdd('');
    setServiceSearchQuery('');
    setProductToAdd('');
    setProductSearchQuery('');
    setIsServiceDropdownOpen(false);
    setIsProductDropdownOpen(false);
    setTechToAdd('');
    setServiceQtyToAdd('1');
    setEditingPriceServiceId(null);
    setEditingPriceValue('');
    setNewBooking({ 
      ...b, 
      notes: b.notes || '',
      internalNotes: b.internalNotes || (b as any).internal_notes || '',
      createdAt: b.createdAt || (b as any).created_at,
      createdBy: b.createdBy || (b as any).created_by,
      createdByName: b.createdByName || (b as any).created_by_name || b.createdBy,
      updatedAt: b.updatedAt || (b as any).updated_at,
      updatedBy: b.updatedBy || (b as any).updated_by,
      updatedByName: b.updatedByName || (b as any).updated_by_name || b.updatedBy,
      location: b.location || '', 
      advancePayments: b.advancePayments || [],
      discountType: b.discountType || 'fixed',
      discountValue: b.discountValue || 0
    });
    setShowAddModal(true);
    setSelectedBookingDetails(null);
  };

  const cancelBooking = async (id: string) => {
    if (window.confirm('هل أنت متأكد من إلغاء هذا الحجز؟')) {
      try {
        const nowIso = new Date().toISOString();
        const currentUserName = currentUser?.name || (currentUser as any)?.username || 'المستخدم';
        const currentUserId = currentUser?.id;
        const patchData = {
          status: 'cancelled',
          updated_at: nowIso,
          updated_by: currentUserId || null,
          updated_by_name: currentUserName
        };
        await DB.patch('bookings', id, patchData);
        setBookings((prev: Booking[]) => prev.map(b => b.id === id ? { 
          ...b, 
          status: 'cancelled',
          updatedAt: nowIso,
          updated_at: nowIso,
          updatedBy: currentUserId,
          updated_by: currentUserId,
          updatedByName: currentUserName,
          updated_by_name: currentUserName
        } : b));
        try {
          const stored = localStorage.getItem('smartcut_bookings');
          if (stored) {
            const list = JSON.parse(stored);
            const updated = list.map((b: any) => b.id === id ? { ...b, ...patchData } : b);
            localStorage.setItem('smartcut_bookings', JSON.stringify(updated));
          }
        } catch (e) {}
        if (selectedBookingDetails?.id === id) {
          setSelectedBookingDetails(prev => prev ? { 
            ...prev, 
            status: 'cancelled',
            updatedAt: nowIso,
            updated_at: nowIso,
            updatedBy: currentUserId,
            updated_by: currentUserId,
            updatedByName: currentUserName,
            updated_by_name: currentUserName
          } : null);
        }
        QueueService.updateTicket('QT-B-' + id, { status: 'cancelled' });
      } catch (err) {
        console.error('Error cancelling booking:', err);
      }
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!canDeleteBooking) {
      alert('⛔ عذراً، لا تملك صلاحية حذف الحجز نهائياً.');
      return;
    }
    if (window.confirm('⚠️ تحذير: هل أنت متأكد من حذف هذا الحجز نهائياً من النظام وقاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        await DB.deleteBooking(id);
        setBookings((prev: Booking[]) => prev.filter(b => b.id !== id));
        try {
          const stored = localStorage.getItem('smartcut_bookings');
          if (stored) {
            const list = JSON.parse(stored);
            localStorage.setItem('smartcut_bookings', JSON.stringify(list.filter((b: any) => b.id !== id)));
          }
        } catch (e) {}
        if (selectedBookingDetails?.id === id) {
          setSelectedBookingDetails(null);
        }
        QueueService.updateTicket('QT-B-' + id, { status: 'cancelled' });
        alert('✅ تم حذف الحجز نهائياً بنجاح.');
      } catch (err) {
        console.error('Error deleting booking:', err);
        alert('حدث خطأ أثناء حذف الحجز');
      }
    }
  };

  // Helper to format booking creation date & time (تاريخ ووقت إنشاء الحجز) - 12-hour format
  const formatBookingCreatedAt = (booking: Booking): string => {
    const createdRaw = booking.createdAt || (booking as any).created_at;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (createdRaw) {
      const d = new Date(createdRaw);
      if (!isNaN(d.getTime())) {
        const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const hours = d.getHours();
        const minutes = pad(d.getMinutes());
        const ampm = hours >= 12 ? 'م' : 'ص';
        const formattedHours = pad(hours % 12 || 12);
        return `${datePart} - ${formattedHours}:${minutes} ${ampm}`;
      }
    }
    const d = new Date();
    const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? 'م' : 'ص';
    const formattedHours = pad(hours % 12 || 12);
    return `${datePart} - ${formattedHours}:${minutes} ${ampm}`;
  };

  // Helper to get clean salon/branch address without "جمهورية مصر العربية"
  const getBookingCleanAddress = (booking: Booking): string => {
    const branchObj = branches?.find(b => b.id === (booking.branchId || activeBranchId));
    const rawAddress = branchObj?.address || settings.address || '';
    return rawAddress
      .replace(/جمهورية مصر العربية/gi, '')
      .replace(/^[\s,-]+|[\s,-]+$/g, '')
      .trim();
  };

  // Execute Physical Print of Booking Receipt to thermal printer
  const executePrintBookingReceipt = (booking: Booking) => {
    const totals = calculateBookingTotals(booking);
    const totalAdv = totals.advances;
    const remainingAmt = totals.remaining;
    const createdDateTimeStr = formatBookingCreatedAt(booking);
    const cleanAddress = getBookingCleanAddress(booking);
    const branchObj = branches?.find(b => b.id === (booking.branchId || activeBranchId));
    const phoneList = [branchObj?.phone, settings.phone].filter(Boolean) as string[];
    const uniquePhones = Array.from(new Set(phoneList.map(p => p.trim()))).join(' - ');
    const contactPhones = uniquePhones || settings.phone || '';
    const salonTitle = settings.salonName || 'صالون سمارت كت';
    const barcodeCode = booking.id || 'B000000';
    const barcodeSvg = generateCode39Svg(barcodeCode, 20);

    const printWindow = document.createElement('div');
    printWindow.id = 'print-booking-receipt';
    printWindow.className = 'hidden print:block fixed inset-0 bg-white z-[9999] p-2 text-black';
    printWindow.dir = 'rtl';
    printWindow.innerHTML = `
      <div style="max-width: 280px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: bold; line-height: 1.35; color: #000; text-align: right; direction: rtl;">
        <div style="text-align: center; margin-bottom: 4px;">
          ${settings.logoUrl ? '<img src="' + sanitizeUrl(settings.logoUrl) + '" style="max-height: 40px; margin: 0 auto 3px; display: block;" />' : ''}
          <div style="font-size: 15px; font-weight: bold; margin: 0; color: #000;">${escapeHtml(salonTitle)}</div>
          <div style="display: inline-block; border: 1.5px solid #000; padding: 1px 8px; font-size: 11px; font-weight: bold; margin-top: 3px; color: #000;">إيصال حجز مؤكد</div>
        </div>

        <!-- Barcode section -->
        <div style="text-align: center; margin: 2px 0 4px; padding: 2px 0;">
          <div style="max-width: 170px; margin: 0 auto;">
            ${barcodeSvg}
          </div>
          <div style="font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #000; margin-top: 2px;">
            ${escapeHtml(barcodeCode)}
          </div>
        </div>

        <!-- Info List on single lines without booking number -->
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0; margin-bottom: 4px; font-size: 11px; font-weight: bold; color: #000; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; gap: 8px; white-space: nowrap;">
            <span>التاريخ: <span style="font-weight: bold;">${escapeHtml(booking.date)}</span></span>
            <span>الوقت: <span style="font-weight: bold;">${escapeHtml(formatTo12Hour(booking.time))}</span></span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px; white-space: nowrap;">
            <span style="overflow: hidden; text-overflow: ellipsis;">العميل: <span style="font-weight: bold;">${escapeHtml(booking.clientName)}</span></span>
            <span>المكان: <span style="font-weight: bold;">${escapeHtml(booking.location || 'داخل الصالون')}</span></span>
          </div>
          ${booking.phone ? `
          <div style="display: flex; justify-content: space-between; gap: 8px; white-space: nowrap;">
            <span>الهاتف: <span style="font-family: monospace; font-weight: bold;">${escapeHtml(booking.phone)}</span></span>
          </div>
          ` : ''}
        </div>

        <!-- Services & Products on single lines -->
        <div style="margin-bottom: 4px; font-size: 11px; font-weight: bold; color: #000;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1.5px solid #000; padding-bottom: 2px; margin-bottom: 2px; font-weight: bold; color: #000;">
            <span>البند (خدمة / منتج)</span>
            <span>السعر</span>
          </div>
          ${booking.services.map(s => {
            const isProd = s.type === 'product';
            const qty = Math.max(1, Number(s.quantity) || 1);
            const lineDisc = calculateServiceLineDiscount(s);
            const lineFinal = calculateServiceLinePrice(s);
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0; border-bottom: 1px dotted #000; font-weight: bold; color: #000; white-space: nowrap; gap: 6px;">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span style="font-weight: bold;">${escapeHtml(s.serviceName)}</span>
                  ${qty > 1 ? `<span style="font-weight: bold;"> (×${qty})</span>` : ''}
                  ${isProd ? '<span style="font-size: 9px; font-weight: bold; border: 1px solid #000; padding: 0 2px; margin-right: 2px;">منتج</span>' : ''}
                  ${lineDisc > 0 ? `<span style="font-size: 9px; font-weight: bold; margin-right: 2px;">[خصم: -${lineDisc.toFixed(2)}]</span>` : ''}
                </div>
                <div style="font-family: monospace; font-weight: bold; text-align: left; flex-shrink: 0; color: #000;">
                  ${lineFinal.toFixed(2)} ${escapeHtml(settings.currency)}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Totals on single lines -->
        <div style="border-top: 1px dashed #000; padding-top: 3px; margin-bottom: 4px; font-size: 11px; font-weight: bold; color: #000; line-height: 1.4;">
          ${totals.totalDiscounts > 0 ? `
            <div style="display: flex; justify-content: space-between; white-space: nowrap; margin-bottom: 1px; font-weight: bold; color: #000;">
              <span>إجمالي البنود:</span>
              <span style="font-family: monospace; font-weight: bold;">${totals.grossServices.toFixed(2)} ${escapeHtml(settings.currency)}</span>
            </div>
          ` : ''}

          ${totals.lineDiscounts > 0 ? `
            <div style="display: flex; justify-content: space-between; white-space: nowrap; margin-bottom: 1px; font-weight: bold; color: #000;">
              <span>خصم البنود:</span>
              <span style="font-family: monospace; font-weight: bold;">-${totals.lineDiscounts.toFixed(2)} ${escapeHtml(settings.currency)}</span>
            </div>
          ` : ''}

          ${totals.generalDiscount > 0 ? `
            <div style="display: flex; justify-content: space-between; white-space: nowrap; margin-bottom: 1px; font-weight: bold; color: #000;">
              <span>خصم الحجز (${booking.discountType === 'percentage' ? (booking.discountValue || 0) + '%' : 'مبلغ'}):</span>
              <span style="font-family: monospace; font-weight: bold;">-${totals.generalDiscount.toFixed(2)} ${escapeHtml(settings.currency)}</span>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; margin: 2px 0; white-space: nowrap; font-size: 11px; font-weight: bold; color: #000;">
            <span>الصافي الإجمالي:</span>
            <span style="font-family: monospace; font-weight: bold;">${totals.netTotal.toFixed(2)} ${escapeHtml(settings.currency)}</span>
          </div>

          ${totalAdv > 0 ? `
            <div style="display: flex; justify-content: space-between; white-space: nowrap; margin-bottom: 1px; font-weight: bold; color: #000;">
              <span>المدفوع مقدماً:</span>
              <span style="font-family: monospace; font-weight: bold;">-${totalAdv.toFixed(2)} ${escapeHtml(settings.currency)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1.5px solid #000; padding-top: 2px; margin-top: 2px; white-space: nowrap; font-size: 11px; font-weight: bold; color: #000;">
              <span>المتبقي للتحصيل:</span>
              <span style="font-family: monospace; font-weight: bold;">${remainingAmt.toFixed(2)} ${escapeHtml(settings.currency)}</span>
            </div>
            <div style="margin-top: 3px; font-size: 10px; font-weight: bold; border: 1px solid #000; padding: 2px 4px; color: #000;">
              <span style="display: block; margin-bottom: 1px; font-weight: bold;">تفاصيل الدفعات المقدمة:</span>
              ${(booking.advancePayments || []).map((adv, i) => `
                <div style="display: flex; justify-content: space-between; white-space: nowrap; font-family: monospace; font-weight: bold; color: #000;">
                  <span>• دفعة ${i+1} (${escapeHtml(adv.treasuryName || 'نقداً')}):</span>
                  <span>${Number(adv.amount || 0).toFixed(2)} ${escapeHtml(settings.currency)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Creation date & time on single line -->
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed #000; padding-top: 2px; margin-top: 3px; font-size: 10px; font-weight: bold; color: #000; white-space: nowrap;">
          <span>تاريخ ووقت إنشاء الحجز:</span>
          <span style="font-family: monospace; font-weight: bold;">${createdDateTimeStr}</span>
        </div>

        ${settings.bookingNotes ? `
          <div style="margin-top: 3px; padding: 3px 5px; border: 1px dashed #000; text-align: center; font-size: 10px; font-weight: bold; white-space: pre-wrap; color: #000;">
            ${escapeHtml(settings.bookingNotes)}
          </div>
        ` : ''}

        ${(cleanAddress || contactPhones) ? `
          <div style="margin-top: 4px; padding-top: 3px; border-top: 1px dashed #000; text-align: center; font-size: 10px; font-weight: bold; line-height: 1.35; color: #000;">
            ${cleanAddress ? `
              <div style="white-space: normal; word-break: break-word; font-weight: bold; color: #000; margin-bottom: 2px;">
                العنوان: ${escapeHtml(cleanAddress)}
              </div>
            ` : ''}
            ${contactPhones ? `
              <div style="white-space: normal; word-break: break-word; font-weight: bold; color: #000;">
                <span>أرقام الاتصال: </span>
                <span style="font-family: monospace; font-weight: bold;">${escapeHtml(contactPhones)}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
    document.body.appendChild(printWindow);
    window.print();
    setTimeout(() => {
      document.body.removeChild(printWindow);
    }, 100);
  };

  // Open Booking Receipt Print Preview (تظهر معاينة المطبوع أولاً في كل أزرار الطباعة)
  const printBooking = (booking: Booking) => {
    setPreviewBooking(booking);
  };

  // Open Preview directly from Add/Edit Modal
  const handlePreviewFromAddEditModal = () => {
    if (!newBooking.clientName?.trim() || !newBooking.phone?.trim()) {
      alert('يرجى إدخال اسم العميل ورقم الموبايل أولاً لمعاينة الإيصال');
      return;
    }

    const hasServiceDiscounts = (newBooking.services || []).some(s => Number(s.discountValue || 0) > 0);
    const hasTotalDiscount = Number(newBooking.discountValue || 0) > 0;

    const finalServices = (newBooking.services || []).map(s => ({
      ...s,
      quantity: Math.max(1, Number(s.quantity) || 1),
      discountType: s.discountType || 'fixed',
      discountValue: hasTotalDiscount ? 0 : Number(s.discountValue || 0)
    }));
    const finalDiscountValue = hasServiceDiscounts ? 0 : Number(newBooking.discountValue || 0);
    const finalDiscountType = newBooking.discountType || 'fixed';

    const totals = calculateBookingTotals({
      ...newBooking,
      services: finalServices,
      discountValue: finalDiscountValue,
      discountType: finalDiscountType
    });

    const defaultBookingDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : new Date().toISOString().split('T')[0];
    const effectiveBookingDate = newBooking.date || ((!editingBooking && shiftData?.isOpen && shiftData.date) ? shiftData.date : defaultBookingDate);
    const bBranchId = editingBooking?.branchId || activeBranchId || mainBranchId;

    const draftBooking: Booking = {
      id: editingBooking ? editingBooking.id : ('B-PREVIEW-' + Math.random().toString(36).substr(2, 5).toUpperCase()),
      bookingCode: editingBooking?.bookingCode || 'SC-PREVIEW',
      salonId: settings.salonId,
      clientName: newBooking.clientName.trim(),
      phone: newBooking.phone.trim(),
      customerEmail: newBooking.customerEmail?.trim() || undefined,
      notes: newBooking.notes?.trim() || undefined,
      internalNotes: newBooking.internalNotes?.trim() || undefined,
      date: effectiveBookingDate,
      time: newBooking.time || '10:00',
      status: newBooking.status || 'confirmed',
      location: newBooking.location?.trim() || undefined,
      services: finalServices,
      advancePayments: newBooking.advancePayments || [],
      totalAmount: totals.netTotal,
      discountType: finalDiscountType,
      discountValue: finalDiscountValue,
      branchId: bBranchId,
      queueNumber: editingBooking?.queueNumber || 1,
      createdAt: editingBooking?.createdAt || (newBooking.createdAt as string) || new Date().toISOString()
    };

    setPreviewBooking(draftBooking);
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

          {/* Excel Import Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            title="سحب حجوزات سابقة من ملف إكسل (نظام الورقتين المعتمد)"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>سحب من إكسل</span>
          </button>

          {/* Global New Booking Button */}
          <button
            onClick={() => {
              if (!shiftData?.isOpen) {
                alert('لا يمكن تسجيل حجز جديد والوردية مغلقة. يرجى فتح وردية أولاً من شاشة الورديات.');
                return;
              }
              const openShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : formatDateToYMD(currentDate);
              setEditingBooking(null);
              setItemTypeToAdd('service');
              setServiceToAdd('');
              setServiceSearchQuery('');
              setProductToAdd('');
              setProductSearchQuery('');
              setIsServiceDropdownOpen(false);
              setIsProductDropdownOpen(false);
              setNewBooking({
                clientName: '',
                phone: '',
                date: openShiftDate,
                time: '10:00',
                status: 'confirmed',
                location: '',
                notes: '',
                internalNotes: '',
                services: [],
                advancePayments: [],
                totalAmount: 0,
                discountType: 'fixed',
                discountValue: 0
              });
              setTechToAdd('');
              setServiceQtyToAdd('1');
              setEditingPriceServiceId(null);
              setEditingPriceValue('');
              setShowPhoneSuggestions(false);
              setHighlightedPhoneIndex(-1);
              setMatchingClientInfo(null);
              setAdvTreasuryInput(availableTreasuries[0]?.id || 'cash');
              setAdvDateInput(openShiftDate);
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div 
              onClick={() => setStatusFilter('all')}
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                statusFilter === 'all' 
                  ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-sm' 
                  : 'border-slate-200 shadow-xs hover:border-slate-300'
              }`}
              title="عرض كل الحجوزات"
            >
              <div>
                <p className="text-slate-500 text-[11px] font-bold">إجمالي الحجوزات</p>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">{bookings.length}</h4>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                📅
              </div>
            </div>

            <div 
              onClick={() => setStatusFilter(statusFilter === 'confirmed' ? 'all' : 'confirmed')}
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                statusFilter === 'confirmed' 
                  ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-sm' 
                  : 'border-slate-200 shadow-xs hover:border-slate-300'
              }`}
              title="تصفية الحجوزات المؤكدة"
            >
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

            <div 
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                statusFilter === 'pending' 
                  ? 'border-amber-400 ring-2 ring-amber-100 shadow-sm' 
                  : 'border-slate-200 shadow-xs hover:border-slate-300'
              }`}
              title="تصفية الحجوزات قيد الانتظار"
            >
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

            <div 
              onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                statusFilter === 'completed' 
                  ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' 
                  : 'border-slate-200 shadow-xs hover:border-slate-300'
              }`}
              title="تصفية الحجوزات المكتملة"
            >
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

            <div 
              onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}
              className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                statusFilter === 'cancelled' 
                  ? 'border-rose-400 ring-2 ring-rose-100 shadow-sm' 
                  : 'border-slate-200 shadow-xs hover:border-slate-300'
              }`}
              title="تصفية الحجوزات الملغية"
            >
              <div>
                <p className="text-rose-600 text-[11px] font-bold">حجوزات ملغية</p>
                <h4 className="text-xl font-black text-rose-700 mt-0.5">
                  {bookings.filter(b => b.status === 'cancelled').length}
                </h4>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <XCircle size={18} />
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
                placeholder="بحث باسم العميل أو الموبايل أو الخدمة..."
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
                    <th className="p-3.5 text-center">رقم الدور</th>
                    <th className="p-3.5">العميل</th>
                    <th className="p-3.5">الموبايل</th>
                    <th className="p-3.5">الخدمات المحجوزة</th>
                    <th className="p-3.5">الموظف / الفني</th>
                    <th className="p-3.5">تاريخ ووقت الموعد</th>
                    <th className="p-3.5">سجل الإنشاء والتعديل</th>
                    <th className="p-3.5 text-center">الإجمالي</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableFilteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400 font-bold">
                        لا توجد أي حجوزات تطابق البحث في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    tableFilteredBookings.map(b => {
                      const badge = getStatusBadge(b.status);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 text-center">
                            {b.queueNumber ? (
                              <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg text-xs shadow-2xs">
                                B-{b.queueNumber}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">-</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{b.clientName}</span>
                              {b.source === 'online' && (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-2xs">
                                  🌐 أونلاين
                                </span>
                              )}
                              {b.location && (
                                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5" title="مكان الحجز">
                                  <MapPin size={10} className="text-indigo-600" />
                                  <span>{b.location}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-indigo-600">{b.bookingCode || `#${b.id}`}</div>
                            {b.internalNotes && (
                              <div 
                                className="mt-1 text-[10px] text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1 max-w-xs truncate cursor-help shadow-2xs" 
                                title={`ملاحظة داخلية خاصة بالإدارة: ${b.internalNotes}`}
                              >
                                <Lock size={10} className="text-amber-700 shrink-0" />
                                <span className="font-black shrink-0 text-amber-800">ملاحظة داخلية:</span>
                                <span className="truncate font-medium">{b.internalNotes}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-slate-600">{b.phone}</td>
                          <td className="p-3.5 font-bold text-slate-700">
                            {b.services?.length > 0 ? b.services.map(s => (s.quantity && s.quantity > 1) ? `${s.serviceName} (×${s.quantity})` : s.serviceName).join(' + ') : '-'}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {b.services?.map(s => s.technicianName).join(', ') || '-'}
                          </td>
                          <td className="p-3.5 font-mono text-slate-800 font-bold" dir="ltr">
                            {b.time} • {b.date?.split('T')[0] || b.date}
                          </td>
                          <td className="p-3.5 text-[11px] space-y-1">
                            <div>
                              <div className="flex items-center gap-1 text-slate-700">
                                <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">أنشأه</span>
                                <span className="font-bold text-slate-900">{b.createdByName || (b as any).created_by_name || b.createdBy || 'غير محدد'}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5" dir="ltr">
                                {formatDateTime(b.createdAt || (b as any).created_at)}
                              </div>
                            </div>
                            {(b.updatedByName || (b as any).updated_by_name || b.updatedAt || (b as any).updated_at) && (
                              <div className="pt-1 border-t border-slate-100">
                                <div className="flex items-center gap-1 text-slate-600">
                                  <span className="text-[9px] font-black text-indigo-800 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">عدّله</span>
                                  <span className="font-bold text-slate-800">{b.updatedByName || (b as any).updated_by_name || 'مستخدم'}</span>
                                </div>
                                {(b.updatedAt || (b as any).updated_at) && (
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5" dir="ltr">
                                    {formatDateTime(b.updatedAt || (b as any).updated_at)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-slate-900">
                            <div>{b.totalAmount} {settings.currency}</div>
                            {(() => {
                              const totals = calculateBookingTotals(b);
                              return totals.totalDiscounts > 0 ? (
                                <div className="text-[10px] text-rose-500 font-bold">
                                  خصم: -{totals.totalDiscounts.toFixed(2)}
                                </div>
                              ) : null;
                            })()}
                            {getBookingTotalAdvances(b) > 0 && (
                              <div className="mt-1 inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                                <span>عربون: {getBookingTotalAdvances(b)}</span>
                                <span className="text-slate-400">|</span>
                                <span>متبقي: {Math.max(0, b.totalAmount - getBookingTotalAdvances(b))}</span>
                              </div>
                            )}
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
                                    onClick={() => onToPOS({
                                      ...b,
                                      advancePayments: getBookingAdvances(b)
                                    })}
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
                                    className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl cursor-pointer"
                                    title="إلغاء الحجز"
                                  >
                                    <XCircle size={13} />
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
                              {canDeleteBooking && (
                                <button
                                  onClick={() => handleDeleteBooking(b.id)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl cursor-pointer transition-colors"
                                  title="حذف الحجز نهائياً من قاعدة البيانات"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
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
                placeholder="بحث باسم العميل أو الموبايل أو الخدمة..."
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
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className="font-black text-slate-900 truncate">{b.clientName}</span>
                                      {b.internalNotes && (
                                        <Lock size={10} className="text-amber-700 shrink-0" title={`ملاحظة داخلية: ${b.internalNotes}`} />
                                      )}
                                    </div>
                                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${badge.dot}`} />
                                  </div>
                                  <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                    {b.services?.map(s => s.serviceName).join(', ') || 'موعد عام'}
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-mono mt-1 text-slate-500">
                                    <span>{b.time}</span>
                                    <span className="font-bold text-slate-700">{b.totalAmount} {settings.currency}</span>
                                  </div>
                                  {getBookingTotalAdvances(b) > 0 && (
                                    <div className="mt-1 text-[9px] font-bold text-emerald-700 bg-emerald-100/70 rounded px-1 py-0.5 flex justify-between">
                                      <span>عربون: {getBookingTotalAdvances(b)}</span>
                                      <span>متبقي: {Math.max(0, b.totalAmount - getBookingTotalAdvances(b))}</span>
                                    </div>
                                  )}
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
                          (b.date?.split('T')[0] || b.date) === dateStr &&
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
                                      <div className="flex items-center gap-1 min-w-0">
                                        <h4 className="font-black text-slate-900 text-xs truncate">{b.clientName}</h4>
                                        {b.internalNotes && (
                                          <Lock size={10} className="text-amber-700 shrink-0" title={`ملاحظة داخلية: ${b.internalNotes}`} />
                                        )}
                                      </div>
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
                                    {getBookingTotalAdvances(b) > 0 && (
                                      <div className="mt-1 text-[9px] font-bold text-emerald-700 bg-emerald-100/70 rounded px-1.5 py-0.5 flex justify-between">
                                        <span>عربون: {getBookingTotalAdvances(b)}</span>
                                        <span>متبقي: {Math.max(0, b.totalAmount - getBookingTotalAdvances(b))}</span>
                                      </div>
                                    )}
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
                  const dayBookings = calendarFilteredBookings.filter(b => (b.date?.split('T')[0] || b.date) === cell.dateStr);

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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    #{selectedBookingDetails.id}
                  </span>
                  {selectedBookingDetails.queueNumber && (
                    <span className="text-[11px] font-black font-mono text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                      دور B-{selectedBookingDetails.queueNumber}
                    </span>
                  )}
                </div>
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
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-wrap justify-between items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <CalendarIcon size={15} className="text-indigo-600" />
                <span>{selectedBookingDetails.date}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-700">
                <Clock size={15} className="text-indigo-600" />
                <span>{formatTo12Hour(selectedBookingDetails.time)}</span>
              </div>
              {selectedBookingDetails.location && (
                <div className="flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg text-[11px]">
                  <MapPin size={13} className="text-indigo-600" />
                  <span>{selectedBookingDetails.location}</span>
                </div>
              )}
              <div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getStatusBadge(selectedBookingDetails.status).bg}`}>
                  {getStatusBadge(selectedBookingDetails.status).label}
                </span>
              </div>
            </div>

            {/* Audit / Tracking Info: Created by, created at, updated by, updated at */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles size={14} className="text-emerald-600" />
                  <span>تاريخ ووقت الإنشاء:</span>
                </div>
                <div className="font-mono text-slate-800 font-bold" dir="ltr">
                  {formatDateTime(selectedBookingDetails.createdAt || (selectedBookingDetails as any).created_at)}
                </div>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-1.5 font-bold">
                  <User size={14} className="text-emerald-600" />
                  <span>المستخدم المنشئ:</span>
                </div>
                <span className="font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px]">
                  {selectedBookingDetails.createdByName || (selectedBookingDetails as any).created_by_name || selectedBookingDetails.createdBy || 'غير محدد'}
                </span>
              </div>

              {(selectedBookingDetails.updatedAt || (selectedBookingDetails as any).updated_at || selectedBookingDetails.updatedByName || (selectedBookingDetails as any).updated_by_name) && (
                <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Clock size={14} className="text-indigo-600" />
                      <span>تاريخ ووقت آخر تعديل:</span>
                    </div>
                    <div className="font-mono text-slate-800 font-bold" dir="ltr">
                      {formatDateTime(selectedBookingDetails.updatedAt || (selectedBookingDetails as any).updated_at)}
                    </div>
                  </div>
                  {(selectedBookingDetails.updatedByName || (selectedBookingDetails as any).updated_by_name) && (
                    <div className="flex items-center justify-between text-slate-600">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Edit2 size={13} className="text-indigo-600" />
                        <span>المستخدم المعدّل:</span>
                      </div>
                      <span className="font-black text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg text-[11px]">
                        {selectedBookingDetails.updatedByName || (selectedBookingDetails as any).updated_by_name}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Internal Admin Notes (ملاحظات داخلية خاصة بالإدارة) */}
            {selectedBookingDetails.internalNotes && (
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                    <Lock size={13} className="text-amber-700" />
                    <span>ملاحظات داخلية (خاصة بالإدارة):</span>
                  </div>
                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span>🔒 سرية • لا تظهر في الإيصال</span>
                  </span>
                </div>
                <p className="text-xs text-amber-950 font-medium whitespace-pre-wrap leading-relaxed pr-1">
                  {selectedBookingDetails.internalNotes}
                </p>
              </div>
            )}

            {selectedBookingDetails.notes && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1 text-xs">
                <span className="font-bold text-slate-700">ملاحظات عامة:</span>
                <p className="text-slate-800 whitespace-pre-wrap">{selectedBookingDetails.notes}</p>
              </div>
            )}

            {/* Services & Products List */}
            <div>
              <h4 className="text-xs font-black text-slate-800 mb-2">الخدمات والمنتجات المحجوزة:</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedBookingDetails.services?.map(s => {
                  const isProd = s.type === 'product';
                  const qty = Math.max(1, Number(s.quantity) || 1);
                  const lineDisc = calculateServiceLineDiscount(s);
                  const lineFinal = calculateServiceLinePrice(s);
                  return (
                    <div key={s.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {isProd && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                              🛍️ منتج
                            </span>
                          )}
                          <span>{s.serviceName}</span>
                          {qty > 1 && (
                            <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-mono font-bold">
                              ×{qty}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">{isProd ? 'البائع:' : 'الفني:'} {s.technicianName}</div>
                        {lineDisc > 0 && (
                          <div className="text-[10px] text-rose-600 font-bold">
                            خصم: -{lineDisc.toFixed(2)} {s.discountType === 'percentage' ? '(' + (s.discountValue || 0) + '%)' : settings.currency}
                          </div>
                        )}
                      </div>
                      <div className="text-left font-mono font-black text-slate-800">
                        <div>{lineFinal.toFixed(2)} {settings.currency}</div>
                        {(lineDisc > 0 || qty > 1) && (
                          <div className="text-[10px] text-slate-400">
                            {qty > 1 ? `${Number(s.price || 0).toFixed(2)} × ${qty}` : Number(s.price || 0).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Advance Payments (العربون والدفعات المقدمة) Section */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-black text-xs text-emerald-950">
                  <Banknote size={15} className="text-emerald-700" />
                  <span>الدفعات المقدمة (العربون المسدد):</span>
                </div>
                {selectedBookingDetails.status !== 'completed' && selectedBookingDetails.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!shiftData?.isOpen) {
                        alert('لا يمكن سداد دفعة مقدمة والوردية مغلقة. يرجى فتح وردية أولاً من شاشة الورديات.');
                        return;
                      }
                      const openShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : new Date().toISOString().split('T')[0];
                      setQuickAdvAmount('');
                      setQuickAdvTreasury(availableTreasuries[0]?.id || 'cash');
                      setQuickAdvMethod('cash');
                      setQuickAdvDate(openShiftDate);
                      setQuickAdvNotes('');
                      setShowQuickAdvanceModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                  >
                    <Plus size={13} />
                    <span>سداد دفعة مقدمة</span>
                  </button>
                )}
              </div>

              {getBookingAdvances(selectedBookingDetails).length > 0 ? (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {getBookingAdvances(selectedBookingDetails).map((adv, idx) => (
                    <div key={adv.id || idx} className="p-2 bg-white rounded-xl border border-emerald-100 flex justify-between items-center text-xs shadow-2xs">
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>دفعة #{idx + 1}:</span>
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold flex items-center gap-1">
                            <CreditCard size={11} />
                            <span>{adv.treasuryName || (adv.paymentMethod === 'card' ? 'شبكة / مدى' : 'كاش (الدرج)') || 'طريقة الدفع'}</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">تاريخ السداد: {adv.date} {adv.notes ? `• ${adv.notes}` : ''}</div>
                      </div>
                      <div className="font-mono font-black text-emerald-700">
                        {Number(adv.amount || 0).toFixed(2)} {settings.currency}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 text-center py-1">
                  لا توجد دفعات مقدمة مسجلة لهذا الحجز
                </div>
              )}
            </div>

            {/* Total Price & Advance Breakdown */}
            {(() => {
              const totals = calculateBookingTotals(selectedBookingDetails);
              return (
                <div className="pt-2 border-t border-slate-100 space-y-1.5 font-bold text-xs">
                  {totals.totalDiscounts > 0 && (
                    <div className="flex justify-between items-center text-slate-500">
                      <span>إجمالي البنود (قبل الخصم):</span>
                      <span className="font-mono">{totals.grossServices.toFixed(2)} {settings.currency}</span>
                    </div>
                  )}
                  {totals.lineDiscounts > 0 && (
                    <div className="flex justify-between items-center text-rose-600">
                      <span>خصومات البنود:</span>
                      <span className="font-mono">-{totals.lineDiscounts.toFixed(2)} {settings.currency}</span>
                    </div>
                  )}
                  {totals.generalDiscount > 0 && (
                    <div className="flex justify-between items-center text-rose-600">
                      <span>خصم إضافي على الحجز ({selectedBookingDetails.discountType === 'percentage' ? (selectedBookingDetails.discountValue || 0) + '%' : 'مبلغ ثابت'}):</span>
                      <span className="font-mono">-{totals.generalDiscount.toFixed(2)} {settings.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-900 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="font-black">صافي قيمة الحجز:</span>
                    <span className="text-sm font-mono font-black text-indigo-900">
                      {totals.netTotal.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                  {totals.advances > 0 && (
                    <>
                      <div className="flex justify-between items-center text-emerald-700">
                        <span>إجمالي العربون المسدد:</span>
                        <span className="text-sm font-mono font-black">
                          -{totals.advances.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-900 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200">
                        <span className="font-black">المتبقي للدفع عند الزيارة:</span>
                        <span className="text-base text-indigo-700 font-mono font-black">
                          {totals.remaining.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Actions */}
            <div className="pt-2 flex flex-wrap gap-2">
              {selectedBookingDetails.status !== 'completed' && selectedBookingDetails.status !== 'cancelled' && (
                <>
                  <button
                    onClick={() => {
                      onToPOS({
                        ...selectedBookingDetails,
                        advancePayments: getBookingAdvances(selectedBookingDetails)
                      });
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
                    className="bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="إلغاء الحجز"
                  >
                    <XCircle size={14} />
                    <span>إلغاء الحجز</span>
                  </button>
                </>
              )}
              {canDeleteBooking && (
                <button
                  onClick={() => handleDeleteBooking(selectedBookingDetails.id)}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="حذف الحجز نهائياً من قاعدة البيانات"
                >
                  <Trash2 size={14} />
                  <span>حذف الحجز</span>
                </button>
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

      {/* QUICK ADVANCE PAYMENT MODAL */}
      {showQuickAdvanceModal && selectedBookingDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Banknote size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">سداد دفعة مقدمة (عربون)</h3>
                  <p className="text-[11px] text-slate-500 font-mono">حجز #{selectedBookingDetails.bookingCode || selectedBookingDetails.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickAdvanceModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ المدفوع * 💰</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={quickAdvAmount}
                  onChange={e => setQuickAdvAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="أدخل مبلغ العربون..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:border-emerald-600 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <CreditCard size={14} className="text-emerald-600" />
                  <span>طريقة الدفع *</span>
                </label>
                <select
                  value={quickAdvTreasury || availableTreasuries[0]?.id || 'cash'}
                  onChange={e => setQuickAdvTreasury(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:border-emerald-600 outline-none"
                >
                  {availableTreasuries.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تاريخ سداد العربون * 📅</label>
                <input
                  type="date"
                  value={quickAdvDate}
                  onChange={e => setQuickAdvDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold focus:border-emerald-600 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">يدخل الحساب المالي ليوم السداد فقط</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات / مرجع الإيصال</label>
                <input
                  type="text"
                  value={quickAdvNotes}
                  onChange={e => setQuickAdvNotes(e.target.value)}
                  placeholder="مثلاً: تحويل بنكي على الراجحي..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-emerald-600 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowQuickAdvanceModal(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveQuickAdvance}
                disabled={!quickAdvAmount || Number(quickAdvAmount) <= 0}
                className="flex-1 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs"
              >
                تأكيد وتسجيل السداد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT BOOKING MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="flex justify-between items-center px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900">
                    {editingBooking ? 'تعديل بيانات الحجز' : 'حجز موعد جديد'}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                    تسجيل وتنسيق المواعيد مع ربط الخدمات والمنتجات والعربون
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 sm:p-5 md:p-6 overflow-y-auto space-y-4">
              {/* Audit Banner in Edit Mode */}
              {editingBooking && (
                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3 text-xs flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-slate-700 flex-wrap">
                    <span className="font-bold text-slate-600">تاريخ ووقت الإنشاء:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white border border-indigo-100 px-2 py-0.5 rounded-lg" dir="ltr">
                      {formatDateTime(editingBooking.createdAt || (editingBooking as any).created_at)}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-slate-600">المستخدم المنشئ:</span>
                    <span className="font-black text-indigo-900 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-lg">
                      {editingBooking.createdByName || (editingBooking as any).created_by_name || editingBooking.createdBy || 'غير محدد'}
                    </span>
                  </div>
                  {(editingBooking.updatedByName || (editingBooking as any).updated_by_name) && (
                    <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                      <span className="font-bold">آخر تعديل:</span>
                      <span className="font-black text-slate-800">
                        {editingBooking.updatedByName || (editingBooking as any).updated_by_name}
                      </span>
                      {(editingBooking.updatedAt || (editingBooking as any).updated_at) && (
                        <span className="font-mono text-slate-500" dir="ltr">
                          ({formatDateTime(editingBooking.updatedAt || (editingBooking as any).updated_at)})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 1. TOP CARD: CLIENT & SCHEDULE INFORMATION */}
              <div className="bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-200/80 space-y-3">
                {/* Row 1: Phone & Client Name */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Phone with Auto Lookup & Autocomplete Suggestions */}
                  <div className="md:col-span-7 space-y-1.5 relative">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Phone size={13} className="text-indigo-600" />
                        <span>رقم الموبايل (البحث والإكمال التلقائي) * 📱</span>
                      </label>
                      {phoneSuggestions.length > 0 && showPhoneSuggestions && (
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full font-bold">
                          {phoneSuggestions.length} عميل مطابق
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="tel"
                        value={newBooking.phone || ''}
                        onChange={e => handlePhoneChange(e.target.value)}
                        onFocus={() => {
                          if ((newBooking.phone || '').trim().length > 0) {
                            setShowPhoneSuggestions(true);
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (!showPhoneSuggestions) {
                              setShowPhoneSuggestions(true);
                            } else if (phoneSuggestions.length > 0) {
                              setHighlightedPhoneIndex(prev => (prev < phoneSuggestions.length - 1 ? prev + 1 : 0));
                            }
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (phoneSuggestions.length > 0) {
                              setHighlightedPhoneIndex(prev => (prev > 0 ? prev - 1 : phoneSuggestions.length - 1));
                            }
                          } else if (e.key === 'Enter') {
                            if (showPhoneSuggestions && highlightedPhoneIndex >= 0 && phoneSuggestions[highlightedPhoneIndex]) {
                              e.preventDefault();
                              handleSelectClientSuggestion(phoneSuggestions[highlightedPhoneIndex]);
                            }
                          } else if (e.key === 'Escape') {
                            setShowPhoneSuggestions(false);
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-mono font-bold focus:border-indigo-600 outline-none text-slate-900 shadow-xs pl-8"
                        placeholder="أدخل رقم الموبايل مثلاً: 05XXXXXXXX"
                        required
                        dir="ltr"
                        autoFocus
                      />

                      {/* Clear Input Button */}
                      {Boolean(newBooking.phone) && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewBooking(prev => ({ ...prev, phone: '', clientName: '', customerId: undefined }));
                            setMatchingClientInfo(null);
                            setShowPhoneSuggestions(false);
                            setHighlightedPhoneIndex(-1);
                          }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1 rounded-md text-xs cursor-pointer transition-colors"
                          title="مسح الرقم"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Dropdown Menu for Phone Autocomplete Suggestions */}
                    {showPhoneSuggestions && phoneSuggestions.length > 0 && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowPhoneSuggestions(false)} 
                        />
                        <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-72 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <span>⚡</span>
                              <span>اختر العميل لملء بياناته تلقائياً:</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ↑ ↓ للتنقل • Enter للاختيار
                            </span>
                          </div>

                          <div className="overflow-y-auto divide-y divide-slate-100 max-h-60 scrollbar-thin">
                            {phoneSuggestions.map((client, idx) => {
                              const isHighlighted = idx === highlightedPhoneIndex;
                              return (
                                <button
                                  key={client.id || `${client.phone}-${idx}`}
                                  type="button"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    handleSelectClientSuggestion(client);
                                  }}
                                  onMouseEnter={() => setHighlightedPhoneIndex(idx)}
                                  className={`w-full text-right p-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                                    isHighlighted ? 'bg-indigo-50 text-indigo-950 font-bold' : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                                      {client.name ? client.name.charAt(0) : '👤'}
                                    </div>
                                    <div className="min-w-0 text-right">
                                      <p className="font-extrabold text-xs text-slate-900 truncate">{client.name}</p>
                                      <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                                        📱 {client.phone}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                                    {(Number(client.loyaltyPoints) > 0 || Number(client.cashback) > 0) && (
                                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                                        {Number(client.loyaltyPoints) > 0 ? `⭐ ${client.loyaltyPoints} نقطة` : ''}
                                        {Number(client.cashback) > 0 ? ` • ${client.cashback} ${settings.currency}` : ''}
                                      </span>
                                    )}
                                    <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-lg font-bold">
                                      اختيار ✓
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Matching Client Found Banner */}
                    {matchingClientInfo ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 p-2 sm:p-2.5 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <span className="text-base">✨</span>
                          <div>
                            <p className="font-black text-emerald-900">عميل مسجل: {matchingClientInfo.name}</p>
                            <p className="text-[10px] text-emerald-700 font-bold">
                              نقاط الولاء: {matchingClientInfo.loyaltyPoints || 0} نقطة • الكاش باك: {matchingClientInfo.cashback || 0} {settings.currency}
                            </p>
                          </div>
                        </div>
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                          تم ملء البيانات ✓
                        </span>
                      </div>
                    ) : newBooking.phone && newBooking.phone.trim().length >= 8 ? (
                      <p className="text-[11px] text-indigo-600 font-bold">
                        💡 عميل جديد — سيتم تسجيله تلقائياً في قاعدة عملاء الصالون عند حفظ الحجز
                      </p>
                    ) : null}
                  </div>

                  {/* Client Name */}
                  <div className="md:col-span-5 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">اسم العميل * 👤</label>
                    <input
                      type="text"
                      value={newBooking.clientName || ''}
                      onChange={e => setNewBooking({ ...newBooking, clientName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold focus:border-indigo-600 outline-none shadow-xs text-slate-900"
                      placeholder="اسم العميل..."
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Date, Time, Status, Location */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>تاريخ الموعد * 📅</span>
                      {!editingBooking && shiftData?.isOpen && (
                        <span className="text-[9px] text-emerald-700 font-bold bg-emerald-100/70 px-1 py-0.2 rounded">
                          الوردية
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={newBooking.date}
                      onChange={e => setNewBooking({ ...newBooking, date: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs font-bold focus:border-indigo-600 outline-none shadow-xs"
                      required
                    />
                    {!editingBooking && shiftData?.isOpen && (
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                        وردية: {shiftData.date}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">وقت الموعد * ⏰</label>
                    <select
                      value={newBooking.time}
                      onChange={e => setNewBooking({ ...newBooking, time: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none shadow-xs"
                      required
                    >
                      {generateSalonTimeSlots(settings).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">حالة الحجز</label>
                    <select
                      value={newBooking.status}
                      onChange={e => setNewBooking({ ...newBooking, status: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs font-bold focus:border-indigo-600 outline-none shadow-xs"
                    >
                      <option value="confirmed">مؤكد</option>
                      <option value="pending">قيد الانتظار</option>
                      <option value="completed">مكتمل</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-indigo-600" />
                        <span>مكان الحجز</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-normal">اختياري</span>
                    </label>
                    <input
                      type="text"
                      list="booking-locations-list"
                      value={newBooking.location || ''}
                      onChange={e => setNewBooking({ ...newBooking, location: e.target.value })}
                      placeholder="داخل الصالون، خارجي..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs font-bold focus:border-indigo-600 outline-none text-slate-800 shadow-xs placeholder:font-normal placeholder:text-slate-400"
                    />
                    <datalist id="booking-locations-list">
                      <option value="داخل الصالون" />
                      <option value="منزل العميل" />
                      <option value="فندق / خارجي" />
                      <option value="قاعة مناسبات" />
                    </datalist>
                  </div>
                </div>

                {/* Row 3: Internal Notes (ملاحظات داخلية خاصة بالإدارة فقط) */}
                <div className="pt-2 border-t border-slate-200/60">
                  <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-2.5 sm:p-3 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <Lock size={13} className="text-amber-700" />
                        <span>ملاحظات داخلية (خاصة بالإدارة):</span>
                      </label>
                      <span className="text-[10px] font-black text-amber-800 bg-amber-100/90 border border-amber-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>🔒 سرية • لا تظهر نهائياً في الإيصال المطبوع</span>
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={newBooking.internalNotes || ''}
                      onChange={e => setNewBooking({ ...newBooking, internalNotes: e.target.value })}
                      placeholder="اكتب هنا أي ملاحظات إدارية خاصة بالحجز (مثل: تنبيهات الموظفين، تفضيلات العميل، مستحقات سابقة...) - ملاحظات سرية خاصة بالإدارة فقط ولا تظهر نهائياً في إيصال العميل المطبوع."
                      className="w-full bg-white border border-amber-200/80 rounded-xl p-2.5 text-xs font-medium focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-slate-900 placeholder:text-slate-400 placeholder:font-normal resize-none shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* 2. SERVICES, PRODUCTS & ADVANCES RESPONSIVE GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
                
                {/* RIGHT COLUMN (7 of 12 on desktop): Services & Products Selection and List */}
                <div className="lg:col-span-7 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <h3 className="text-xs font-black text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>✂️</span>
                      <span>الخدمات والمنتجات المطلوبة في الموعد:</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">بحث ذكي وإكمال تلقائي 🔍</span>
                  </h3>

                  {/* Switcher: إضافة خدمة / إضافة منتج */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setItemTypeToAdd('service');
                        setTechToAdd('');
                        setServiceQtyToAdd('1');
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        itemTypeToAdd === 'service'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>✂️ إضافة خدمة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setItemTypeToAdd('product');
                        setTechToAdd('');
                        setServiceQtyToAdd('1');
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        itemTypeToAdd === 'product'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <ShoppingBag size={14} />
                      <span>🛍️ إضافة منتج</span>
                    </button>
                  </div>
                  
                  {itemTypeToAdd === 'service' ? (
                    /* ============ FORM: ADD SERVICE ============ */
                    <div className="space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        
                        {/* 1. SERVICE SEARCHABLE AUTOCOMPLETE */}
                        <div className="relative sm:col-span-6">
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
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span>الموظف المنفذ</span>
                            <span className="text-[10px] text-slate-400 font-normal">اختياري</span>
                          </label>
                          <select
                            value={techToAdd}
                            onChange={e => setTechToAdd(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600 shadow-xs"
                          >
                            <option value="">(غير محدد)</option>
                            {employees.filter(e => isBarberEmployee(e)).map(e => (
                              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                            ))}
                          </select>
                        </div>

                        {/* 3. QUANTITY INPUT (كتابة مباشرة ورقم افتراضي 1) */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                            الكمية
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={serviceQtyToAdd}
                            onChange={e => setServiceQtyToAdd(e.target.value)}
                            onBlur={() => {
                              const parsed = parseInt(serviceQtyToAdd, 10);
                              if (isNaN(parsed) || parsed < 1) {
                                setServiceQtyToAdd('1');
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-black text-center outline-none focus:border-indigo-600 shadow-xs font-mono"
                            placeholder="1"
                            title="الكمية المطلوبة (قابلة للكتابة المباشرة)"
                          />
                        </div>
                      </div>

                      {/* Add Service Button */}
                      <button
                        type="button"
                        onClick={addServiceToBooking}
                        disabled={!serviceToAdd}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>+ إضافة الخدمة إلى جدول الموعد {parseInt(serviceQtyToAdd, 10) > 1 ? `(الكمية: ${serviceQtyToAdd})` : ''}</span>
                      </button>
                    </div>
                  ) : (
                    /* ============ FORM: ADD PRODUCT ============ */
                    <div className="space-y-2.5 bg-amber-50/50 p-3 rounded-2xl border border-amber-200/80">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        {/* Product Autocomplete */}
                        <div className="relative sm:col-span-6">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            المنتج (ابحث بالاسم أو الباركود أو السعر) *
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={productSearchQuery}
                              onChange={e => {
                                setProductSearchQuery(e.target.value);
                                setIsProductDropdownOpen(true);
                                const exactMatch = retailProducts.find(p => p.name.toLowerCase() === e.target.value.toLowerCase().trim() || p.barcode === e.target.value.trim());
                                if (exactMatch) {
                                  setProductToAdd(exactMatch.id);
                                } else {
                                  setProductToAdd('');
                                }
                              }}
                              onFocus={() => setIsProductDropdownOpen(true)}
                              placeholder="🔍 اكتب اسم المنتج أو الباركود..."
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none text-slate-900 shadow-xs"
                            />
                            {productSearchQuery && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProductSearchQuery('');
                                  setProductToAdd('');
                                  setIsProductDropdownOpen(true);
                                }}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Dropdown Menu for Product Autocomplete */}
                          {isProductDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setIsProductDropdownOpen(false)}
                              />
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto p-1.5 space-y-1 text-right">
                                {filteredProductsForBooking.length > 0 ? (
                                  filteredProductsForBooking.map(p => {
                                    const isSelected = productToAdd === p.id;
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                          setProductToAdd(p.id);
                                          setProductSearchQuery(p.name);
                                          setIsProductDropdownOpen(false);
                                        }}
                                        className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                                          isSelected 
                                            ? 'bg-amber-100 text-amber-900 font-black border border-amber-300' 
                                            : 'hover:bg-slate-100 text-slate-800'
                                        }`}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-bold flex items-center gap-1.5">
                                            <ShoppingBag size={12} className="text-amber-600" />
                                            <span>{p.name}</span>
                                          </span>
                                          {p.barcode && (
                                            <span className="text-[10px] text-slate-400 font-mono">باركود: {p.barcode}</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="bg-emerald-50 text-emerald-700 font-mono font-black px-2 py-0.5 rounded-lg text-[11px] border border-emerald-200">
                                            {p.sellPrice} {settings.currency}
                                          </span>
                                          {p.stock !== undefined && (
                                            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                                              المخزون: {p.stock}
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="p-3 text-center text-xs text-slate-400">
                                    {retailProducts.length === 0 ? 'لا توجد منتجات متاحة للبيع' : `لا توجد منتجات مطابقة لـ "${productSearchQuery}"`}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Employee / Seller Selector */}
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span>موظف البيع</span>
                            <span className="text-[10px] text-slate-400 font-normal">اختياري</span>
                          </label>
                          <select
                            value={techToAdd}
                            onChange={e => setTechToAdd(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-600 shadow-xs"
                          >
                            <option value="">(غير محدد)</option>
                            {employees.map(e => (
                              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity Input (كتابة مباشرة) */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1 text-center">
                            الكمية
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={serviceQtyToAdd}
                            onChange={e => setServiceQtyToAdd(e.target.value)}
                            onBlur={() => {
                              const parsed = parseInt(serviceQtyToAdd, 10);
                              if (isNaN(parsed) || parsed < 1) {
                                setServiceQtyToAdd('1');
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-black text-center outline-none focus:border-indigo-600 shadow-xs font-mono"
                            placeholder="1"
                            title="الكمية المطلوبة (قابلة للكتابة المباشرة)"
                          />
                        </div>
                      </div>

                      {/* Add Product Button */}
                      <button
                        type="button"
                        onClick={addProductToBooking}
                        disabled={!productToAdd}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <ShoppingBag size={14} />
                        <span>+ إضافة المنتج إلى الحجز {parseInt(serviceQtyToAdd, 10) > 1 ? `(الكمية: ${serviceQtyToAdd})` : ''}</span>
                      </button>
                    </div>
                  )}

                  {(() => {
                    const hasServiceDiscounts = (newBooking.services || []).some(s => Number(s.discountValue || 0) > 0);
                    const hasTotalDiscount = Number(newBooking.discountValue || 0) > 0;

                    return (
                      <>
                        {hasTotalDiscount && (
                          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-2 px-3 text-[11px] text-amber-800 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold">
                              <span>⚠️</span>
                              <span>خصومات بنود الخدمات والمنتجات معطلة لتفعيل الخصم على إجمالي الحجز (لا يجوز الجمع بين خصمين).</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const totals = calculateBookingTotals({ ...newBooking, discountValue: 0 });
                                setNewBooking({ ...newBooking, discountValue: 0, totalAmount: totals.netTotal });
                              }}
                              className="font-bold underline text-amber-900 hover:text-amber-950 cursor-pointer text-[10px] whitespace-nowrap mr-2"
                            >
                              مسح خصم الإجمالي
                            </button>
                          </div>
                        )}

                        {/* Services & Products List with Discount per line */}
                        <div className="space-y-2 max-h-64 sm:max-h-72 overflow-y-auto pr-0.5">
                          {newBooking.services?.map(s => {
                            const isProduct = s.type === 'product';
                            const qty = Math.max(1, Number(s.quantity) || 1);
                            const lineDisc = calculateServiceLineDiscount(s);
                            const lineFinal = calculateServiceLinePrice(s);
                            const lineGross = Number(s.price || 0) * qty;
                            return (
                              <div key={s.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                                <div className="flex flex-wrap justify-between items-start gap-2">
                                  <div>
                                    <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                                      {isProduct ? (
                                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                          <ShoppingBag size={10} />
                                          <span>منتج</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded-md">
                                          خدمة
                                        </span>
                                      )}
                                      <span>{s.serviceName}</span>
                                      {qty > 1 && (
                                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-md">
                                          ×{qty}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {isProduct ? 'البائع:' : 'الفني:'} {s.technicianName}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mr-auto">
                                    {/* تعديل الكمية مباشرة بالكتابة */}
                                    <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs" title="تعديل الكمية مباشرة بالكتابة">
                                      <span className="text-[10px] text-slate-500 font-bold">الكمية:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={s.quantity ?? 1}
                                        onChange={e => {
                                          const parsed = parseInt(e.target.value, 10);
                                          const qVal = isNaN(parsed) ? 1 : Math.max(1, parsed);
                                          const updated = (newBooking.services || []).map(sx => sx.id === s.id ? { ...sx, quantity: qVal } : sx);
                                          const totals = calculateBookingTotals({ ...newBooking, services: updated });
                                          setNewBooking({ ...newBooking, services: updated, totalAmount: totals.netTotal });
                                        }}
                                        className="w-12 border border-slate-200 rounded px-1 text-center font-mono font-bold text-xs outline-none focus:border-indigo-600"
                                      />
                                    </div>
                                    {/* تعديل سعر الخدمة داخل الحجز فقط بالقلم */}
                                    {editingPriceServiceId === s.id ? (
                                      <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-indigo-400 shadow-2xs">
                                        <span className="text-[10px] text-indigo-700 font-bold">السعر:</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          autoFocus
                                          value={editingPriceValue}
                                          onChange={e => setEditingPriceValue(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleSaveCustomServicePrice(s.id);
                                            } else if (e.key === 'Escape') {
                                              e.preventDefault();
                                              handleCancelEditPrice();
                                            }
                                          }}
                                          className="w-16 border border-indigo-200 rounded px-1 text-center font-mono font-bold text-xs outline-none focus:border-indigo-600"
                                          placeholder="0"
                                          title="تعديل سعر الوحدة لهذا الحجز فقط"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveCustomServicePrice(s.id)}
                                          className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded hover:bg-emerald-50 cursor-pointer"
                                          title="حفظ السعر الجديد لهذا الحجز"
                                        >
                                          <Check size={14} className="stroke-[2.5]" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleCancelEditPrice}
                                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 cursor-pointer"
                                          title="إلغاء التعديل"
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <div className="flex items-center gap-1 font-mono font-bold text-slate-700">
                                          <span>{lineGross.toFixed(2)} {settings.currency}</span>
                                          {qty > 1 && (
                                            <span className="text-[10px] text-slate-400 font-normal">
                                              ({Number(s.price || 0).toFixed(2)}/وحدة)
                                            </span>
                                          )}
                                        </div>
                                        {s.isCustomPrice && (
                                          <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-md border border-amber-200" title="سعر مخصص لهذا الحجز مع بقاء السعر الأساسي للخدمة دون تغيير">
                                            معدل
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditPrice(s)}
                                          className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-colors cursor-pointer"
                                          title="تعديل سعر الخدمة في هذا الحجز فقط (قلم التعديل)"
                                        >
                                          <Pencil size={13} />
                                        </button>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = newBooking.services?.filter(sx => sx.id !== s.id) || [];
                                        const totals = calculateBookingTotals({ ...newBooking, services: updated });
                                        setNewBooking({
                                          ...newBooking,
                                          services: updated,
                                          totalAmount: totals.netTotal
                                        });
                                      }}
                                      className="text-rose-500 hover:text-rose-700 cursor-pointer p-0.5"
                                      title={isProduct ? "حذف المنتج" : "حذف الخدمة"}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* خصم سطر الخدمة أو المنتج */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 bg-white/70 px-2 py-1 rounded-lg">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-slate-600">خصم السطر:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      disabled={hasTotalDiscount}
                                      value={s.discountValue ?? ''}
                                      onChange={e => {
                                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        const updated = (newBooking.services || []).map(sx => sx.id === s.id ? { ...sx, discountValue: val } : sx);
                                        const totals = calculateBookingTotals({ ...newBooking, services: updated, discountValue: 0 });
                                        setNewBooking({ ...newBooking, services: updated, discountValue: 0, totalAmount: totals.netTotal });
                                      }}
                                      placeholder="0"
                                      title={hasTotalDiscount ? "معطل: تم تطبيق خصم عام على إجمالي الحجز (لا يجوز الجمع بين خصمين)" : undefined}
                                      className={`w-14 border rounded px-1.5 py-0.5 text-xs text-center font-mono font-bold outline-none ${
                                        hasTotalDiscount
                                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                          : 'bg-white border-slate-300 focus:border-indigo-600'
                                      }`}
                                    />
                                    <button
                                      type="button"
                                      disabled={hasTotalDiscount}
                                      onClick={() => {
                                        const nextType = s.discountType === 'percentage' ? 'fixed' : 'percentage';
                                        const updated = (newBooking.services || []).map(sx => sx.id === s.id ? { ...sx, discountType: nextType } : sx);
                                        const totals = calculateBookingTotals({ ...newBooking, services: updated, discountValue: 0 });
                                        setNewBooking({ ...newBooking, services: updated, discountValue: 0, totalAmount: totals.netTotal });
                                      }}
                                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                        hasTotalDiscount
                                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 cursor-pointer'
                                      }`}
                                      title={hasTotalDiscount ? "معطل: تم تطبيق خصم عام على إجمالي الحجز" : "تبديل الخصم: نسبة مئوية أو مبلغ ثابت"}
                                    >
                                      {s.discountType === 'percentage' ? '%' : settings.currency}
                                    </button>
                                  </div>
                                  <div className="text-[11px] font-bold text-slate-700">
                                    الصافي: <span className="font-mono text-emerald-700 font-black">{lineFinal.toFixed(2)} {settings.currency}</span>
                                    {lineDisc > 0 && (
                                      <span className="text-[10px] text-rose-500 mr-1 font-mono">(-{lineDisc.toFixed(2)})</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(!newBooking.services || newBooking.services.length === 0) && (
                            <div className="text-center text-xs text-slate-400 py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                              لم يتم إضافة أي خدمات أو منتجات بعد
                            </div>
                          )}
                        </div>

                        {/* خصم إضافي على إجمالي الحجز (نسبة أو مبلغ) */}
                        {(newBooking.services || []).length > 0 && (
                          hasServiceDiscounts ? (
                            <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 space-y-1.5 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                                  <span>🏷️</span>
                                  <span>خصم إجمالي الحجز (مبلغ أو نسبة):</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    disabled={true}
                                    value=""
                                    placeholder="معطل"
                                    className="w-16 bg-slate-100 border border-slate-200 text-slate-400 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold cursor-not-allowed outline-none"
                                  />
                                  <span className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed">
                                    {newBooking.discountType === 'percentage' ? '%' : settings.currency}
                                  </span>
                                </div>
                              </div>
                              <div className="text-[11px] text-amber-800 flex items-center justify-between pt-1 border-t border-amber-200/60 font-bold">
                                <span className="flex items-center gap-1">
                                  <span>⚠️</span>
                                  <span>لا يمكن تطبيق خصم إجمالي لوجود خصم على مستوى الخدمات أو المنتجات (لا يجوز الجمع بين خصمين).</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const clearedServices = (newBooking.services || []).map(sx => ({ ...sx, discountValue: 0 }));
                                    const totals = calculateBookingTotals({ ...newBooking, services: clearedServices });
                                    setNewBooking({ ...newBooking, services: clearedServices, totalAmount: totals.netTotal });
                                  }}
                                  className="font-bold underline text-amber-900 hover:text-amber-950 cursor-pointer text-[10px] whitespace-nowrap mr-2"
                                >
                                  مسح خصومات البنود
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                                <span>🏷️</span>
                                <span>خصم على إجمالي الحجز (مبلغ أو نسبة):</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={newBooking.discountValue ?? ''}
                                  onChange={e => {
                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    const clearedServices = (newBooking.services || []).map(sx => ({ ...sx, discountValue: 0 }));
                                    const totals = calculateBookingTotals({ ...newBooking, services: clearedServices, discountValue: val });
                                    setNewBooking({ ...newBooking, services: clearedServices, discountValue: val, totalAmount: totals.netTotal });
                                  }}
                                  placeholder="0"
                                  className="w-16 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold focus:border-indigo-600 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextType = newBooking.discountType === 'percentage' ? 'fixed' : 'percentage';
                                    const totals = calculateBookingTotals({ ...newBooking, discountType: nextType });
                                    setNewBooking({ ...newBooking, discountType: nextType, totalAmount: totals.netTotal });
                                  }}
                                  className="px-2 py-1 text-[11px] font-bold rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-800 hover:bg-indigo-200 cursor-pointer transition-colors"
                                  title="تبديل نوع الخصم: نسبة مئوية أو مبلغ ثابت"
                                >
                                  {newBooking.discountType === 'percentage' ? 'نسبة مئوية (%)' : `مبلغ ثابت (${settings.currency})`}
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* LEFT COLUMN (5 of 12 on desktop): Advance Payments & Financial Summary */}
                <div className="lg:col-span-5 space-y-3">
                  {/* ADVANCE PAYMENTS SECTION (العربون والدفعات المقدمة) */}
                  <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200 shadow-xs space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <Banknote size={16} className="text-emerald-700" />
                        <span>العربون والدفعات المقدمة (سداد مسبق)</span>
                      </label>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                        اختياري
                      </span>
                    </div>

                    {/* Form inputs for new advance */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">المبلغ المدفوع * 💰</label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          value={advAmountInput}
                          onChange={e => setAdvAmountInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="أدخل مبلغ العربون..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:border-emerald-600 outline-none shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <CreditCard size={13} className="text-emerald-600" />
                          <span>طريقة الدفع *</span>
                        </label>
                        <select
                          value={advTreasuryInput || availableTreasuries[0]?.id || 'cash'}
                          onChange={e => setAdvTreasuryInput(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:border-emerald-600 outline-none shadow-xs"
                        >
                          {availableTreasuries.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ السداد * 📅</label>
                        <input
                          type="date"
                          value={advDateInput}
                          onChange={e => setAdvDateInput(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:border-emerald-600 outline-none shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات على الدفعة</label>
                        <input
                          type="text"
                          value={advNotesInput}
                          onChange={e => setAdvNotesInput(e.target.value)}
                          placeholder="مثلاً: تحويل بنكي..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:border-emerald-600 outline-none shadow-xs"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddAdvanceInModal}
                      disabled={!advAmountInput || Number(advAmountInput) <= 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-2 rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>+ إضافة الدفعة المقدمة إلى الحجز</span>
                    </button>

                    {/* Advances List */}
                    {(newBooking.advancePayments || []).length > 0 && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                        {newBooking.advancePayments?.map(adv => (
                          <div key={adv.id} className="flex justify-between items-center bg-white p-2 rounded-xl border border-emerald-100 text-xs shadow-2xs">
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="font-mono text-emerald-700 font-black">{Number(adv.amount || 0).toFixed(2)} {settings.currency}</span>
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold flex items-center gap-1">
                                  <CreditCard size={11} />
                                  <span>{adv.treasuryName || 'طريقة الدفع'}</span>
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                تاريخ: {adv.date} {adv.notes ? `• ${adv.notes}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAdvanceInModal(adv.id)}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                              title="حذف هذه الدفعة"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Financial Balance Summary Card */}
                  {(() => {
                    const totals = calculateBookingTotals(newBooking);
                    return (
                      <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                        <h4 className="font-black text-slate-800 flex items-center gap-1.5">
                          <span>📊</span>
                          <span>ملخص المبالغ المالية للموعد:</span>
                        </h4>
                        <div className="space-y-1.5 text-slate-600 font-medium">
                          <div className="flex justify-between items-center">
                            <span>إجمالي البنود:</span>
                            <span className="font-mono font-bold text-slate-900">{totals.grossServices.toFixed(2)} {settings.currency}</span>
                          </div>
                          {totals.totalDiscounts > 0 && (
                            <div className="flex justify-between items-center text-rose-600 font-bold">
                              <span>إجمالي الخصومات:</span>
                              <span className="font-mono">-{totals.totalDiscounts.toFixed(2)} {settings.currency}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-1 border-t border-slate-200/80 font-black text-indigo-950">
                            <span>المبلغ الصافي:</span>
                            <span className="font-mono text-sm text-indigo-600">{totals.netTotal.toFixed(2)} {settings.currency}</span>
                          </div>
                          {totals.advances > 0 && (
                            <div className="flex justify-between items-center text-emerald-700 font-bold">
                              <span>العربون المسدد مسبقاً:</span>
                              <span className="font-mono">-{totals.advances.toFixed(2)} {settings.currency}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-1 border-t border-slate-200/80 font-black text-slate-900 bg-white p-2 rounded-xl border border-indigo-100">
                            <span>المتبقي للتحصيل عند الحضور:</span>
                            <span className="font-mono text-sm text-emerald-600">{totals.remaining.toFixed(2)} {settings.currency}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4.5 border-t border-slate-100 bg-slate-50/95 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 shrink-0">
              {(() => {
                const totals = calculateBookingTotals(newBooking);
                return (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-600 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>إجمالي الخدمات: <span className="font-mono text-slate-900 font-bold">{totals.grossServices.toFixed(2)} {settings.currency}</span></span>
                      {totals.totalDiscounts > 0 && (
                        <span className="text-rose-600 font-mono font-bold text-[11px]">
                          (إجمالي الخصم: -{totals.totalDiscounts.toFixed(2)})
                        </span>
                      )}
                      <span className="hidden sm:inline text-slate-300">|</span>
                      <span className="text-indigo-900 font-black">
                        الصافي: <span className="font-mono text-sm text-indigo-700">{totals.netTotal.toFixed(2)} {settings.currency}</span>
                      </span>
                    </div>
                    {((newBooking.advancePayments || []).length > 0) && (
                      <div className="text-xs font-bold text-emerald-700 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span>العربون: -{totals.advances.toFixed(2)} {settings.currency}</span>
                        <span className="hidden sm:inline text-slate-300">|</span>
                        <span className="text-indigo-700 font-black">
                          المتبقي للدفع: {totals.remaining.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handlePreviewFromAddEditModal}
                  className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                  title="معاينة إيصال الحجز قبل الحفظ"
                >
                  <Printer size={14} />
                  <span>معاينة الإيصال</span>
                </button>
                <button
                  type="button"
                  onClick={saveBooking}
                  className="flex-1 sm:flex-initial px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm cursor-pointer transition-all active:scale-98"
                >
                  {editingBooking ? 'حفظ وتثبيت التعديلات' : 'حفظ وتأكيد الحجز'}
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

      {/* Bookings Excel Import Modal */}
      <BookingsImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        settings={settings}
        existingBookings={bookings}
        clients={clients}
        employees={employees}
        services={services}
        activeBranchId={activeBranchId}
        currentUser={currentUser}
        shiftData={shiftData}
        onImportComplete={(newB, newC, newT) => {
          if (newB.length > 0) {
            setBookings([...newB, ...bookings]);
          }
          if (newC.length > 0 && setClients) {
            setClients([...clients, ...newC]);
          }
          if (newT.length > 0 && setTransactions) {
            setTransactions(prev => [...prev, ...newT]);
          }
        }}
      />

      {/* ========================================================================= */}
      {/* BOOKING RECEIPT PRINT PREVIEW MODAL (معاينة إيصال الحجز) */}
      {/* ========================================================================= */}
      {previewBooking && (() => {
        const totals = calculateBookingTotals(previewBooking);
        const totalAdv = totals.advances;
        const remainingAmt = totals.remaining;
        const createdDateTimeStr = formatBookingCreatedAt(previewBooking);
        const cleanAddress = getBookingCleanAddress(previewBooking);
        const branchObj = branches?.find(b => b.id === (previewBooking.branchId || activeBranchId));
        const phoneList = [branchObj?.phone, settings.phone].filter(Boolean) as string[];
        const uniquePhones = Array.from(new Set(phoneList.map(p => p.trim()))).join(' - ');
        const contactPhones = uniquePhones || settings.phone || '';
        const salonTitle = settings.salonName || 'صالون سمارت كت';
        const barcodeCode = previewBooking.id || 'B000000';
        const barcodeSvg = generateCode39Svg(barcodeCode, 20);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]" dir="rtl">
              {/* Header */}
              <div className="flex justify-between items-center p-4 px-5 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Printer size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">معاينة إيصال الحجز</h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {previewBooking.id} • {previewBooking.clientName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewBooking(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Body: Thermal Paper Style */}
              <div className="p-3 sm:p-5 bg-slate-100/90 overflow-y-auto flex justify-center">
                <div className="bg-white p-3.5 rounded-xl shadow-xs border border-black w-full max-w-[300px] text-black font-sans space-y-1 text-[11px] font-bold select-text">
                  {/* Salon Header */}
                  <div className="text-center space-y-0.5">
                    {settings.logoUrl && (
                      <img src={settings.logoUrl} alt="Logo" className="max-h-10 mx-auto mb-1" />
                    )}
                    <h2 className="text-base font-bold text-black">{salonTitle}</h2>
                    <div className="inline-block border border-black px-2 py-0.5 font-bold text-[11px] text-black mt-0.5">
                      إيصال حجز مؤكد
                    </div>
                  </div>

                  {/* Barcode section */}
                  <div className="text-center py-0.5 bg-white">
                    <div className="max-w-[170px] mx-auto" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
                    <div className="font-mono text-xs font-bold tracking-wider text-black mt-0.5">
                      {barcodeCode}
                    </div>
                  </div>

                  {/* Info list on single lines without booking number */}
                  <div className="space-y-0.5 text-[11px] font-bold text-black border-y border-dashed border-black py-1 leading-tight">
                    <div className="flex justify-between gap-2 whitespace-nowrap">
                      <span>التاريخ: {previewBooking.date}</span>
                      <span>الوقت: {formatTo12Hour(previewBooking.time)}</span>
                    </div>
                    <div className="flex justify-between gap-2 whitespace-nowrap">
                      <span className="truncate">العميل: {previewBooking.clientName}</span>
                      <span>المكان: {previewBooking.location || 'داخل الصالون'}</span>
                    </div>
                    {previewBooking.phone && (
                      <div className="flex justify-between gap-2 whitespace-nowrap">
                        <span>الهاتف: <span className="font-mono font-bold">{previewBooking.phone}</span></span>
                      </div>
                    )}
                  </div>

                  {/* Services & Products Table */}
                  <div className="space-y-0.5 text-[11px] font-bold text-black">
                    <div className="border-b border-black pb-0.5 flex justify-between font-bold text-black">
                      <span>البند (خدمة / منتج)</span>
                      <span>السعر</span>
                    </div>
                    <div className="divide-y divide-dotted divide-black">
                      {previewBooking.services?.map(s => {
                        const isProd = s.type === 'product';
                        const qty = Math.max(1, Number(s.quantity) || 1);
                        const lineDisc = calculateServiceLineDiscount(s);
                        const lineFinal = calculateServiceLinePrice(s);
                        return (
                          <div key={s.id} className="py-0.5 flex justify-between items-center whitespace-nowrap gap-1.5 font-bold text-black">
                            <div className="truncate">
                              <span>{s.serviceName}</span>
                              {qty > 1 && <span> (×{qty})</span>}
                              {isProd && (
                                <span className="text-[9px] border border-black px-1 py-0 mr-1 font-bold">
                                  منتج
                                </span>
                              )}
                              {lineDisc > 0 && (
                                <span className="text-[9px] mr-1 font-bold">
                                  [خصم: -${lineDisc.toFixed(2)}]
                                </span>
                              )}
                            </div>
                            <div className="text-left font-mono flex-shrink-0 text-black font-bold">
                              {lineFinal.toFixed(2)} {settings.currency}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Totals Section */}
                  <div className="border-t border-dashed border-black pt-1 space-y-0.5 text-[11px] font-bold text-black leading-tight">
                    {totals.totalDiscounts > 0 && (
                      <div className="flex justify-between whitespace-nowrap">
                        <span>إجمالي البنود:</span>
                        <span className="font-mono font-bold">{totals.grossServices.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                    {totals.lineDiscounts > 0 && (
                      <div className="flex justify-between whitespace-nowrap">
                        <span>خصم البنود:</span>
                        <span className="font-mono font-bold">-{totals.lineDiscounts.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                    {totals.generalDiscount > 0 && (
                      <div className="flex justify-between whitespace-nowrap">
                        <span>خصم الحجز ({previewBooking.discountType === 'percentage' ? (previewBooking.discountValue || 0) + '%' : 'مبلغ'}):</span>
                        <span className="font-mono font-bold">-{totals.generalDiscount.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-black border-y border-dashed border-black py-0.5 whitespace-nowrap">
                      <span>الصافي الإجمالي:</span>
                      <span className="font-mono font-bold">{totals.netTotal.toFixed(2)} {settings.currency}</span>
                    </div>

                    {totalAdv > 0 && (
                      <div className="space-y-0.5 pt-0.5">
                        <div className="flex justify-between whitespace-nowrap">
                          <span>المدفوع مقدماً:</span>
                          <span className="font-mono font-bold">-{totalAdv.toFixed(2)} {settings.currency}</span>
                        </div>
                        <div className="flex justify-between font-bold text-black border-t border-black pt-0.5 whitespace-nowrap">
                          <span>المتبقي للتحصيل:</span>
                          <span className="font-mono font-bold">{remainingAmt.toFixed(2)} {settings.currency}</span>
                        </div>
                        <div className="p-1 rounded-sm text-[10px] space-y-0.5 mt-0.5 border border-black text-black font-bold">
                          <span className="block mb-0.5">تفاصيل الدفعات المقدمة:</span>
                          {(previewBooking.advancePayments || []).map((adv, i) => (
                            <div key={adv.id || i} className="flex justify-between whitespace-nowrap font-mono text-black font-bold">
                              <span>• دفعة {i + 1} ({adv.treasuryName || 'نقداً'}):</span>
                              <span>{Number(adv.amount || 0).toFixed(2)} {settings.currency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Creation date & time on single line */}
                  <div className="flex justify-between border-t border-dashed border-black pt-1 mt-1 text-[10px] font-bold text-black whitespace-nowrap">
                    <span>تاريخ ووقت إنشاء الحجز:</span>
                    <span className="font-mono font-bold">{createdDateTimeStr}</span>
                  </div>

                  {/* Salon Notes */}
                  {settings.bookingNotes && (
                    <div className="p-1 border border-dashed border-black text-center text-[10px] font-bold whitespace-pre-wrap text-black">
                      {settings.bookingNotes}
                    </div>
                  )}

                  {/* Footer (address on multiple lines & phone numbers below it) */}
                  {(cleanAddress || contactPhones) && (
                    <div className="pt-1.5 border-t border-dashed border-black text-center text-[10px] font-bold text-black space-y-0.5">
                      {cleanAddress && (
                        <div className="leading-tight break-words whitespace-normal font-bold text-black">
                          العنوان: {cleanAddress}
                        </div>
                      )}
                      {contactPhones && (
                        <div className="leading-tight font-bold text-black">
                          <span>أرقام الاتصال: </span>
                          <span className="font-mono font-bold">{contactPhones}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="p-4 bg-white border-t border-slate-100 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewBooking(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={() => executePrintBookingReceipt(previewBooking)}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  <Printer size={15} />
                  <span>طباعة الإيصال الآن</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
