import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Clock, Scissors, User, Phone, 
  MapPin, CheckCircle2, AlertCircle, Sparkles, Building2, 
  ChevronRight, ArrowRight, ShieldCheck, Check, X, 
  LogOut, Plus, Trash2, Smartphone, Send, Lock, KeyRound,
  RefreshCw, MessageCircle, Star, Info, HelpCircle, Eye, EyeOff
} from 'lucide-react';
import { 
  AppSettings, Branch, ServiceItem, Employee, Booking, 
  Category, ClientPortalAccount, BookingService, Client 
} from '../types';
import { EvolutionApiService } from '../services/evolutionApiService';
import { SubscriptionService } from '../services/subscriptionService';
import { DB, dbClientToApp, dbEmployeeToApp, dbServiceToApp, toCamel } from '../services/db';
import { 
  isDateBlocked, isHourBlocked, isStaffAvailableOnDate, 
  isStaffAvailableAtTime, generateSalonTimeSlots, isStaffBookedAtSlot 
} from '../utils/bookingAvailability';

interface ClientReservationPortalProps {
  settings: AppSettings;
  branches: Branch[];
  services: ServiceItem[];
  employees: Employee[];
  categories: Category[];
  bookings: Booking[];
  clients?: Client[];
  onSaveClient?: (client: Client) => void;
  onSaveBooking: (booking: Booking) => void;
  onCancelBooking?: (bookingId: string) => void;
  onSwitchToMainApp?: () => void;
}

const ARAB_COUNTRIES = [
  'المملكة العربية السعودية',
  'مصر',
  'الإمارات العربية المتحدة',
  'الكويت',
  'قطر',
  'البحرين',
  'سلطنة عمان',
  'الأردن',
  'لبنان',
  'العراق',
  'المغرب',
  'الجزائر',
  'تونس',
  'ليبيا',
  'السودان',
  'فلسطين',
  'اليمن',
  'سوريا',
  'موريتانيا',
  'الصومال',
  'جيبوتي',
  'جزر القمر'
];

export function ClientReservationPortal({
  settings,
  branches = [],
  services = [],
  employees = [],
  categories = [],
  bookings = [],
  clients = [],
  onSaveClient,
  onSaveBooking,
  onCancelBooking,
  onSwitchToMainApp
}: ClientReservationPortalProps) {
  // 0. Scoped Salon Code Auto-Detection for SaaS (?10a5n or ?salon=10a5n or ?code=10a5n)
  const [scopedSalonCode, setScopedSalonCode] = useState<string>(() => {
    if (typeof window === 'undefined') return settings.salonCode || settings.salonId || '';
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('salon') || params.get('code');
      if (fromQuery) {
        localStorage.setItem('smartcut_registered_salon_code', fromQuery);
        return fromQuery;
      }
      
      // Bare query check
      const rawSearch = window.location.search.replace(/^\?/, '').trim();
      if (rawSearch && !rawSearch.includes('=') && rawSearch.length <= 12) {
        localStorage.setItem('smartcut_registered_salon_code', rawSearch);
        return rawSearch;
      }

      // Hash check
      const rawHash = window.location.hash.replace(/^#/, '').trim();
      if (rawHash && !rawHash.includes('/') && rawHash.length <= 12 && rawHash !== 'reservation') {
        localStorage.setItem('smartcut_registered_salon_code', rawHash);
        return rawHash;
      }

      const saved = localStorage.getItem('smartcut_registered_salon_code');
      if (saved) return saved;
    } catch (e) {}

    return settings.salonCode || settings.salonId || '';
  });

  // 1. Client Auth State
  const [currentClient, setCurrentClient] = useState<ClientPortalAccount | null>(() => {
    try {
      const saved = localStorage.getItem('smartcut_current_client');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'otp' | 'profile'>('login');
  const [authForm, setAuthForm] = useState({
    phone: '',
    email: '',
    password: '',
    name: '',
    referredByPhone: '',
    country: 'المملكة العربية السعودية'
  });
  
  // OTP State
  const [enteredOtp, setEnteredOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpTimeLeft, setOtpTimeLeft] = useState(60);
  const [otpError, setOtpError] = useState('');
  const [otpSuccessMsg, setOtpSuccessMsg] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [showDemoOtpHelper, setShowDemoOtpHelper] = useState(false);
  const [platformLogoUrl, setPlatformLogoUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const loadPlatformLogo = async () => {
      try {
        const pSettings = await DB.fetchPlatformSettings();
        if ((pSettings?.logoUrl || pSettings?.platformLogoUrl) && isMounted) {
          setPlatformLogoUrl(pSettings.logoUrl || pSettings.platformLogoUrl || '');
        }
      } catch (e) {
        console.warn('Failed to load platform logo for client portal:', e);
      }
    };
    loadPlatformLogo();
    return () => { isMounted = false; };
  }, []);

  // Dynamic Scoped Salon Data State
  const [salonInfo, setSalonInfo] = useState<{
    id?: string;
    code?: string;
    name: string;
    logoUrl?: string;
    phone?: string;
    address?: string;
    country?: string;
    currency?: string;
    salonType?: string;
  }>({
    id: settings.salonId,
    code: scopedSalonCode,
    name: (settings.salonName && settings.salonName !== 'منظومة سمارت كت برو') ? settings.salonName : 'صالون العناية',
    logoUrl: settings.logoUrl || '',
    phone: settings.phone || '',
    address: settings.address || '',
    country: settings.country || 'المملكة العربية السعودية',
    currency: settings.currency || 'SAR',
    salonType: settings.salonType || 'men'
  });

  const [portalBranches, setPortalBranches] = useState<Branch[]>(branches);
  const [portalServices, setPortalServices] = useState<ServiceItem[]>(services);
  const [portalEmployees, setPortalEmployees] = useState<Employee[]>(employees);
  const [portalCategories, setPortalCategories] = useState<Category[]>(categories);

  useEffect(() => {
    let isMounted = true;
    const resolveTargetSalon = async () => {
      try {
        const cleanCode = (scopedSalonCode || '').trim().toLowerCase();
        if (!cleanCode) return;

        // 1. Check local storage / local salons
        const localSalons = SubscriptionService.getSalons();
        let matched = localSalons.find(s => s.code?.toLowerCase() === cleanCode || s.id?.toLowerCase() === cleanCode);

        // 2. Query Supabase Cloud Salons table
        const cloudSalons = await DB.fetchSalons();
        if (cloudSalons && cloudSalons.length > 0) {
          const cloudMatched = cloudSalons.find((s: any) => s.code?.toLowerCase() === cleanCode || s.id?.toLowerCase() === cleanCode);
          if (cloudMatched) {
            matched = cloudMatched;
          }
        }

        if (matched && isMounted) {
          const sId = matched.id;
          const [dbSettings, dbBranches, dbServices, dbEmployees, dbCategories] = await Promise.allSettled([
            DB.fetchSettings(sId),
            DB.fetchBranches(sId),
            DB.fetchServices(sId),
            DB.fetchEmployees(sId),
            DB.fetchCategories(sId)
          ]);

          const sData = dbSettings.status === 'fulfilled' ? dbSettings.value : null;
          const bData = dbBranches.status === 'fulfilled' ? dbBranches.value : [];
          const srvData = dbServices.status === 'fulfilled' ? dbServices.value : [];
          const empData = dbEmployees.status === 'fulfilled' ? dbEmployees.value : [];
          const catData = dbCategories.status === 'fulfilled' ? dbCategories.value : [];

          setSalonInfo({
            id: matched.id,
            code: matched.code,
            name: sData?.salonName || matched.name || 'صالون العناية',
            logoUrl: sData?.logoUrl || matched.logoUrl || '',
            phone: sData?.phone || matched.phone || '',
            address: sData?.address || matched.address || '',
            country: sData?.country || matched.country || 'المملكة العربية السعودية',
            currency: sData?.currency || matched.currency || 'SAR',
            salonType: sData?.salonType || matched.salonType || 'men'
          });

          if (bData && bData.length > 0) {
            setPortalBranches(bData.map((b: any) => ({
              ...b,
              salonId: matched.id,
              salonCode: matched.code
            })));
          } else {
            setPortalBranches([{
              id: 'b-main',
              salonId: matched.id,
              salonCode: matched.code,
              name: `الفرع الرئيسي (${matched.name})`,
              code: 'BR-01',
              country: matched.country || 'المملكة العربية السعودية',
              currency: matched.currency || 'SAR',
              isMain: true,
              address: matched.address || 'المركز الرئيسي',
              phone: matched.phone,
              isActive: true
            }]);
          }

          if (srvData && srvData.length > 0) setPortalServices(srvData.map(dbServiceToApp));
          if (empData && empData.length > 0) setPortalEmployees(empData.map(dbEmployeeToApp));
          if (catData && catData.length > 0) setPortalCategories(catData.map(toCamel));
        }
      } catch (err) {
        console.warn('Error resolving target salon in ClientReservationPortal:', err);
      }
    };

    resolveTargetSalon();
    return () => { isMounted = false; };
  }, [scopedSalonCode]);

  // Active View: 'booking_wizard' | 'my_bookings' | 'auth_modal'
  const [activePortalTab, setActivePortalTab] = useState<'wizard' | 'my_bookings'>('wizard');

  // 2. Booking Wizard Steps: 1: Branch -> 2: Services -> 3: Date & Staff -> 4: Time -> 5: Confirm
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Effective Client Country
  const clientCountry = currentClient?.country || authForm.country || salonInfo.country || 'المملكة العربية السعودية';

  // 3. Branches matching Client's Country
  const effectiveBranches = portalBranches.length > 0 ? portalBranches : branches;
  const effectiveServices = portalServices.length > 0 ? portalServices : services;
  const effectiveEmployees = portalEmployees.length > 0 ? portalEmployees : employees;
  const effectiveCategories = portalCategories.length > 0 ? portalCategories : categories;

  const countryBranches = useMemo(() => {
    if (!effectiveBranches || effectiveBranches.length === 0) {
      return [{
        id: 'b-main',
        name: `الفرع الرئيسي (${salonInfo.name})`,
        code: 'B01',
        country: clientCountry,
        currency: salonInfo.currency || settings.currency || 'SAR',
        isMain: true,
        address: salonInfo.address || settings.address || 'المركز الرئيسي',
        phone: salonInfo.phone || settings.phone,
        isActive: true
      }];
    }
    const filtered = effectiveBranches.filter(b => {
      if (!b.country) return true; // fallback
      return b.country.trim().toLowerCase().includes(clientCountry.trim().toLowerCase()) ||
             clientCountry.trim().toLowerCase().includes(b.country.trim().toLowerCase());
    });
    return filtered.length > 0 ? filtered : effectiveBranches;
  }, [effectiveBranches, clientCountry, salonInfo, settings]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return countryBranches[0]?.id || 'b-main';
  });

  // Ensure selectedBranchId stays valid when country changes
  useEffect(() => {
    if (countryBranches.length > 0 && !countryBranches.some(b => b.id === selectedBranchId)) {
      setSelectedBranchId(countryBranches[0].id);
    }
  }, [countryBranches, selectedBranchId]);

  const activeBranch = countryBranches.find(b => b.id === selectedBranchId) || countryBranches[0];
  const currency = activeBranch?.currency || salonInfo.currency || settings.currency || 'SAR';

  // 4. Branch Specific Services
  const branchServices = useMemo(() => {
    return effectiveServices.filter(s => {
      if (s.isActive === false) return false;
      if (!s.branchId) return true; // universal
      return s.branchId === selectedBranchId;
    });
  }, [effectiveServices, selectedBranchId]);

  // 5. Branch Specific Employees
  const branchEmployees = useMemo(() => {
    return effectiveEmployees.filter(e => {
      if (e.isActive === false || e.isBlacklisted) return false;
      if (!e.branchId) return true;
      return e.branchId === selectedBranchId;
    });
  }, [effectiveEmployees, selectedBranchId]);

  // Selected Services in Wizard
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Selected Date & Staff
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedStaffId, setSelectedStaffId] = useState<string>('any'); // 'any' or employeeId
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [completedBookingResult, setCompletedBookingResult] = useState<Booking | null>(null);

  // OTP Timer Countdown
  useEffect(() => {
    let timer: any = null;
    if (authMode === 'otp' && otpTimeLeft > 0) {
      timer = setInterval(() => {
        setOtpTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [authMode, otpTimeLeft]);

  // Handle Send OTP
  const handleSendOtp = async (targetPhone: string) => {
    if (!targetPhone || targetPhone.length < 8) {
      setOtpError('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    setIsSendingOtp(true);
    setOtpError('');
    setOtpSuccessMsg('');

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpTimeLeft(60);

    const msg = `🔐 رمز التحقق الخاص بك لتأكيد الدخول والحجز في ${settings.salonName || 'صالون العناية'}:\n\n*${code}*\n\n⚠️ ينتهي الرمز خلال 60 ثانية.`;

    try {
      if (EvolutionApiService.isConfigured(settings, selectedBranchId)) {
        const res = await EvolutionApiService.sendTextMessage(settings, targetPhone, msg, selectedBranchId);
        if (res.success) {
          setOtpSuccessMsg(`تم إرسال كود التحقق عبر الواتساب إلى الرقم ${targetPhone}`);
        } else {
          setOtpSuccessMsg(`تم إنشاء الكود (وضع تجريبي/غير متصل): ${code}`);
        }
      } else {
        setOtpSuccessMsg(`تم إنشاء الكود التجريبي: ${code}`);
      }
    } catch (e) {
      setOtpSuccessMsg(`تم إنشاء الكود التجريبي: ${code}`);
    }

    setIsSendingOtp(false);
    setAuthMode('otp');
  };

  // Handle Verify OTP
  const handleVerifyOtp = () => {
    setOtpError('');
    if (otpTimeLeft <= 0) {
      setOtpError('انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد');
      return;
    }
    if (enteredOtp.trim() !== generatedOtp.trim()) {
      setOtpError('رمز التحقق غير صحيح، يرجى التأكد وإعادة المحاولة');
      return;
    }

    // OTP Verified! If registering, go to profile completion. If login, finish.
    setAuthMode('profile');
  };

  // Handle Complete Registration / Profile
  const handleSaveProfile = () => {
    if (!authForm.name.trim()) {
      setOtpError('يرجى إدخال اسمك الكريم');
      return;
    }

    const cleanPhone = authForm.phone.trim();
    const cleanEmail = authForm.email.trim();
    const cleanReferredBy = (authForm.referredByPhone && authForm.referredByPhone.trim() !== cleanPhone) 
      ? authForm.referredByPhone.trim() 
      : undefined;

    const newAccount: ClientPortalAccount = {
      id: 'cli-' + Date.now(),
      phone: cleanPhone,
      email: cleanEmail,
      password: authForm.password,
      name: authForm.name.trim(),
      country: authForm.country,
      referredByPhone: cleanReferredBy,
      isVerified: true,
      createdAt: new Date().toISOString()
    };

    setCurrentClient(newAccount);
    try {
      localStorage.setItem('smartcut_current_client', JSON.stringify(newAccount));
      // Also persist to registered clients list
      const savedList = localStorage.getItem('smartcut_client_accounts');
      const list: ClientPortalAccount[] = savedList ? JSON.parse(savedList) : [];
      list.push(newAccount);
      localStorage.setItem('smartcut_client_accounts', JSON.stringify(list));
    } catch (e) {}

    // Auto-sync client to Central Salon Clients database if not exists
    if (onSaveClient) {
      const existingInSalon = clients.find(c => c.phone && c.phone.trim() === cleanPhone);
      if (!existingInSalon) {
        const newSalonClient: Client = {
          id: 'C-' + Date.now(),
          name: authForm.name.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          referredByPhone: cleanReferredBy,
          notes: `عميل مسجل أونلاين عبر كود الصالون (${scopedSalonCode}) - ${authForm.country}`,
          loyaltyPoints: 0,
          cashback: 0,
          createdAt: new Date().toISOString()
        };
        onSaveClient(newSalonClient);
      }
    }

    // Reset auth modal
    setAuthMode('login');
  };

  // Handle Direct Login for existing user via Phone (as Username) & Password
  const handleDirectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');

    const inputPhone = authForm.phone.trim();

    try {
      const savedList = localStorage.getItem('smartcut_client_accounts');
      const list: ClientPortalAccount[] = savedList ? JSON.parse(savedList) : [];
      
      // Match by phone number as username
      const found = list.find(c => 
        (c.phone === inputPhone || c.email === inputPhone || c.phone.endsWith(inputPhone) || inputPhone.endsWith(c.phone)) && 
        (!authForm.password || c.password === authForm.password)
      );

      if (found) {
        setCurrentClient(found);
        localStorage.setItem('smartcut_current_client', JSON.stringify(found));
        return;
      }

      // Also check existing salon clients
      const salonClient = clients.find(c => c.phone && (c.phone === inputPhone || c.phone.endsWith(inputPhone)));
      if (salonClient) {
        const synthAccount: ClientPortalAccount = {
          id: salonClient.id,
          name: salonClient.name,
          phone: salonClient.phone,
          email: salonClient.email || '',
          password: authForm.password || '123456',
          country: authForm.country || 'المملكة العربية السعودية',
          isVerified: true,
          createdAt: new Date().toISOString()
        };
        setCurrentClient(synthAccount);
        localStorage.setItem('smartcut_current_client', JSON.stringify(synthAccount));
        return;
      }
    } catch (e) {}

    // If not found, prompt to verify phone with OTP to create new account
    handleSendOtp(authForm.phone);
  };

  // Handle Logout
  const handleLogout = () => {
    if (confirm('هل ترغب في تسجيل الخروج؟')) {
      setCurrentClient(null);
      localStorage.removeItem('smartcut_current_client');
    }
  };

  // Selected Services Objects & Calculations
  const selectedServicesList = useMemo(() => {
    return branchServices.filter(s => selectedServiceIds.includes(s.id));
  }, [branchServices, selectedServiceIds]);

  const totalBookingPrice = useMemo(() => {
    return selectedServicesList.reduce((sum, s) => sum + (s.price || 0), 0);
  }, [selectedServicesList]);

  const totalEstimatedDuration = useMemo(() => {
    return selectedServicesList.reduce((sum, s) => sum + (s.durationMinutes || 30), 0);
  }, [selectedServicesList]);

  // Generate Available Dates (Next 14 Days)
  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('ar-SA', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('ar-SA', { month: 'short' });
      dates.push({ iso, dayName, dayNum, monthName, isToday: i === 0, isTomorrow: i === 1 });
    }
    return dates;
  }, []);

  // Check if selected date is fully blocked by administration
  const isSelectedDateBlocked = useMemo(() => {
    return isDateBlocked(selectedDate, settings);
  }, [selectedDate, settings]);

  // Generate Time Slots with dynamic opening/closing hours, shift timings, blocked hours, weekly off, and per-staff hourly capacity
  const timeSlots = useMemo(() => {
    if (isSelectedDateBlocked) return [];

    // Dynamically generated from salon opening time to 1 hour before closing
    const slots = generateSalonTimeSlots(settings);

    return slots.map(slot => {
      // 1. Is specific hour blocked by admin?
      if (isHourBlocked(selectedDate, slot, settings)) {
        return { time: slot, isAvailable: false, reason: 'ساعة مغلقة إدارياً' };
      }

      // 2. If a specific specialist was chosen, check his weekly off & shift start/end hours
      if (selectedStaffId !== 'any') {
        const emp = branchEmployees.find(e => e.id === selectedStaffId);
        if (emp) {
          const staffDayCheck = isStaffAvailableOnDate(emp, selectedDate, settings);
          if (!staffDayCheck.available) {
            return { time: slot, isAvailable: false, reason: staffDayCheck.reason };
          }
          const staffHourCheck = isStaffAvailableAtTime(emp, slot);
          if (!staffHourCheck.available) {
            return { time: slot, isAvailable: false, reason: staffHourCheck.reason };
          }

          // 3. Check if staff is already booked for this hour/slot (Capacity 1 per hour or 2 per hour)
          const staffBookingCheck = isStaffBookedAtSlot(
            selectedStaffId, 
            selectedDate, 
            slot, 
            bookings, 
            settings, 
            selectedBranchId
          );
          if (staffBookingCheck.isBooked) {
            return { time: slot, isAvailable: false, reason: 'محجوزة' };
          }
        }
      } else {
        // If "Any available staff", check if at least one eligible staff member is free
        const availableStaffList = branchEmployees.filter(emp => {
          const dayOk = isStaffAvailableOnDate(emp, selectedDate, settings).available;
          if (!dayOk) return false;
          const hourOk = isStaffAvailableAtTime(emp, slot).available;
          if (!hourOk) return false;
          const bookedOk = !isStaffBookedAtSlot(emp.id, selectedDate, slot, bookings, settings, selectedBranchId).isBooked;
          return bookedOk;
        });

        if (availableStaffList.length === 0) {
          return { time: slot, isAvailable: false, reason: 'محجوزة' };
        }
      }

      return {
        time: slot,
        isAvailable: true
      };
    });
  }, [bookings, selectedBranchId, selectedDate, selectedStaffId, isSelectedDateBlocked, settings, branchEmployees]);

  // Toggle Service Selection
  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  // Submit Final Booking
  const handleConfirmBooking = async () => {
    if (!currentClient) {
      alert('يرجى تسجيل الدخول أو إنشاء حساب لتأكيد حجزك');
      return;
    }
    if (selectedServicesList.length === 0) {
      alert('يرجى اختيار خدمة واحدة على الأقل');
      return;
    }
    if (!selectedTimeSlot) {
      alert('يرجى اختيار وقت الموعد المناسب');
      return;
    }

    const assignedStaff = selectedStaffId !== 'any' 
      ? branchEmployees.find(e => e.id === selectedStaffId) 
      : branchEmployees[0];

    const bookingCode = '#SC-' + Math.floor(100000 + Math.random() * 900000);

    const bookingServices: BookingService[] = selectedServicesList.map(s => ({
      id: 'bs-' + Math.random().toString(36).substr(2, 9),
      serviceId: s.id,
      serviceName: s.name,
      technicianId: assignedStaff?.id || 'any',
      technicianName: assignedStaff?.name || 'أي خبير متاح',
      price: s.price
    }));

    const newBooking: Booking = {
      id: 'b-online-' + Date.now(),
      salonId: settings.salonId,
      branchId: selectedBranchId,
      clientName: currentClient.name,
      phone: currentClient.phone,
      customerEmail: currentClient.email,
      date: selectedDate,
      time: selectedTimeSlot,
      status: 'pending',
      advancePayments: [],
      services: bookingServices,
      totalAmount: totalBookingPrice,
      notes: bookingNotes,
      source: 'online',
      bookingCode
    };

    // Auto-sync client to Central Salon Clients database if not exists
    if (onSaveClient && currentClient.phone) {
      const cleanP = currentClient.phone.trim();
      const existingInSalon = clients.find(c => c.phone && c.phone.trim() === cleanP);
      if (!existingInSalon) {
        const newSalonClient: Client = {
          id: currentClient.id || 'C-' + Date.now(),
          name: currentClient.name.trim(),
          phone: cleanP,
          email: currentClient.email || '',
          notes: `عميل أونلاين مسجل من كود صالون (${scopedSalonCode})`,
          loyaltyPoints: 0,
          cashback: 0,
          createdAt: new Date().toISOString()
        };
        onSaveClient(newSalonClient);
      }
    }

    // 1. Save in system state
    onSaveBooking(newBooking);
    setCompletedBookingResult(newBooking);

    // 2. Send WhatsApp confirmation message via Evolution API
    const waText = `✨ *${settings.salonName || 'صالون العناية'}*\n\nأهلاً بكِ ${currentClient.name} ✨\nتم استلام طلب حجزك بنجاح وسنقوم بتأكيده فوراً.\n\n📍 *الفرع:* ${activeBranch.name}\n📅 *الموعد:* ${selectedDate} • ${selectedTimeSlot}\n✂️ *الخبير:* ${assignedStaff?.name || 'طاقم العمل المتميز'}\n📋 *الخدمات:* ${selectedServicesList.map(s => s.name).join('، ')}\n💰 *الإجمالي:* ${totalBookingPrice} ${currency}\n🔖 *كود الحجز:* ${bookingCode}\n\nشكراً لثقتكم بنا ونسعد بخدمتكم دائماً! ❤️`;

    try {
      if (EvolutionApiService.isConfigured(settings, selectedBranchId)) {
        await EvolutionApiService.sendTextMessage(settings, currentClient.phone, waText, selectedBranchId);
      }
    } catch (e) {}

    // Reset wizard
    setSelectedServiceIds([]);
    setSelectedTimeSlot('');
    setBookingNotes('');
    setCurrentStep(1);
  };

  // Client's My Bookings List
  const myBookingsList = useMemo(() => {
    if (!currentClient) return [];
    return bookings.filter(b => {
      return b.phone === currentClient.phone || (b.customerEmail && b.customerEmail === currentClient.email);
    }).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [bookings, currentClient]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 select-none" dir="rtl">
      {/* 1. TOP CLIENT APP HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Logo & Salon Info */}
          <div className="flex items-center gap-3">
            {(salonInfo.logoUrl || settings.logoUrl || platformLogoUrl) ? (
              <img 
                src={salonInfo.logoUrl || settings.logoUrl || platformLogoUrl} 
                alt="Salon Logo" 
                className="w-10 h-10 rounded-2xl object-contain bg-white p-0.5 ring-2 ring-emerald-500/30 shadow-lg" 
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30">
                <Scissors size={20} />
              </div>
            )}
            <div>
              <h1 className="text-sm sm:text-base font-black text-white leading-tight truncate max-w-[160px] sm:max-w-xs">
                {salonInfo.name || settings.salonName || 'صالون العناية VIP'}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold mt-0.5">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-md font-mono">
                  🔒 كود: {scopedSalonCode}
                </span>
                <span>•</span>
                <span className="text-slate-300 font-semibold">{clientCountry}</span>
              </div>
            </div>
          </div>

          {/* Right Header: User Profile / Login */}
          <div className="flex items-center gap-2">
            {currentClient ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivePortalTab(activePortalTab === 'wizard' ? 'my_bookings' : 'wizard')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    activePortalTab === 'my_bookings'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                >
                  <CalendarIcon size={14} />
                  <span>حجوزاتي ({myBookingsList.length})</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthMode('login')}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <User size={14} />
                <span>تسجيل / دخول</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. AUTH MODAL / POPUP IF NOT LOGGED IN */}
      {!currentClient && (
        <div className="max-w-md mx-auto px-4 pt-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

            {/* Auth Title */}
            <div className="text-center mb-6">
              {(salonInfo.logoUrl || settings.logoUrl || platformLogoUrl) ? (
                <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white shadow-xl shadow-emerald-500/20 border border-slate-700 mx-auto mb-2.5 transform hover:scale-110 hover:rotate-3 transition-all duration-300">
                  <img src={salonInfo.logoUrl || settings.logoUrl || platformLogoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-xl" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2.5 transform hover:scale-110 hover:rotate-6 transition-all duration-300">
                  <Sparkles size={22} />
                </div>
              )}
              <h2 className="text-xl font-black text-white">
                {authMode === 'otp' 
                  ? '🔐 تأكيد رمز الواتساب (OTP)' 
                  : authMode === 'profile' 
                  ? '👤 استكمال بيانات حسابك' 
                  : authMode === 'register'
                  ? 'إنشاء حساب عميل جديد ✨'
                  : 'تسجيل الدخول لبوابة الحجز 🔑'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {authMode === 'otp' 
                  ? 'تم إرسال كود التحقق لرقمك عبر الواتساب' 
                  : authMode === 'profile'
                  ? 'خطوة أخيرة: أدخل اسمك ودولتك لحفظ حسابك'
                  : authMode === 'register'
                  ? 'سجّل برقم جوالك (اسم المستخدم) واستلم كود التحقق'
                  : 'أدخل رقم جوالك (اسم المستخدم) وكلمة المرور للدخول الفوري'}
              </p>
            </div>

            {otpError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3.5 py-2.5 rounded-2xl text-xs font-bold mb-4 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-400" />
                <span>{otpError}</span>
              </div>
            )}

            {otpSuccessMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3.5 py-2.5 rounded-2xl text-xs font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                <span>{otpSuccessMsg}</span>
              </div>
            )}

            {/* FORM 1A: LOGIN (Phone as Username + Password) */}
            {authMode === 'login' && (
              <form onSubmit={handleDirectLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    رقم الجوال (اسم المستخدم) 📱
                  </label>
                  <input
                    type="tel"
                    value={authForm.phone}
                    onChange={e => setAuthForm({ ...authForm, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3 text-xs font-bold font-mono outline-none focus:border-emerald-500"
                    dir="ltr"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    كلمة المرور 🔒
                  </label>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500 font-mono"
                    dir="ltr"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <KeyRound size={15} />
                  <span>تسجيل الدخول الفوري</span>
                </button>

                <div className="pt-2 text-center border-t border-slate-800/80">
                  <p className="text-xs text-slate-400">
                    عميل جديد؟{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setOtpError('');
                        setOtpSuccessMsg('');
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-black underline cursor-pointer"
                    >
                      إنشاء حساب جديد برقم الجوال والواتساب ✨
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* FORM 1B: REGISTER (Phone + Real Email + Password -> OTP) */}
            {authMode === 'register' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSendOtp(authForm.phone);
              }} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    رقم الجوال (سيكون اسم المستخدم الخاص بك) 📱 *
                  </label>
                  <input
                    type="tel"
                    value={authForm.phone}
                    onChange={e => setAuthForm({ ...authForm, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3 text-xs font-bold font-mono outline-none focus:border-emerald-500"
                    dir="ltr"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-500 mt-1">سيتم إرسال كود التحقق عبر الواتساب إلى هذا الرقم للتأكيد.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    البريد الإلكتروني الحقيقي (لاستلام إشعارات الحجز) ✉️ *
                  </label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                    placeholder="client@example.com"
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500 font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    كلمة المرور 🔒 *
                  </label>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500 font-mono"
                    dir="ltr"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSendingOtp ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>إرسال رمز التحقق عبر الواتساب (OTP)</span>
                      <Send size={14} className="rotate-180" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center border-t border-slate-800/80">
                  <p className="text-xs text-slate-400">
                    لديك حساب بالفعل؟{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setOtpError('');
                        setOtpSuccessMsg('');
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-black underline cursor-pointer"
                    >
                      تسجيل الدخول 🔑
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* FORM 2: Enter OTP Code (Expires in 60s) */}
            {authMode === 'otp' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1 rounded-full text-xs font-bold mb-3 font-mono">
                    <Clock size={13} />
                    <span>صلاحية الرمز: {Math.floor(otpTimeLeft / 60)}:{(otpTimeLeft % 60).toString().padStart(2, '0')}</span>
                  </div>

                  <input
                    type="text"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={e => setEnteredOtp(e.target.value)}
                    placeholder="••••••"
                    className="w-full max-w-[200px] mx-auto bg-slate-950 border-2 border-emerald-500 text-white text-center rounded-2xl py-3 text-2xl font-black font-mono tracking-widest outline-none focus:ring-4 focus:ring-emerald-500/20"
                    dir="ltr"
                  />
                </div>

                {/* Demo Helper Button */}
                {generatedOtp && showDemoOtpHelper && (
                  <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 font-bold mb-1">🧪 للاختبار السريع (الرمز المولّد):</p>
                    <button
                      type="button"
                      onClick={() => setEnteredOtp(generatedOtp)}
                      className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-mono font-black text-xs px-3 py-1 rounded-lg border border-emerald-500/40 cursor-pointer"
                    >
                      تعبئة تلقائية: {generatedOtp}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpTimeLeft <= 0 || !enteredOtp}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <CheckCircle2 size={16} />
                  <span>تأكيد الرمز والمتابعة</span>
                </button>

                {otpTimeLeft <= 0 && (
                  <button
                    type="button"
                    onClick={() => handleSendOtp(authForm.phone)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-2xl text-xs border border-slate-700 cursor-pointer"
                  >
                    إعادة إرسال رمز جديد 🔄
                  </button>
                )}
              </div>
            )}

            {/* FORM 3: Complete Profile Details */}
            {authMode === 'profile' && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل 👤</label>
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                    placeholder="أحمد محمد"
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الدولة (لعرض فروع بلدك) 🌍</label>
                  <select
                    value={authForm.country}
                    onChange={e => setAuthForm({ ...authForm, country: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {ARAB_COUNTRIES.map(c => (
                      <option key={c} value={c} className="bg-slate-900 text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center justify-between">
                    <span>رقم جوال العميل الذي رشحك (اختياري) 🎁</span>
                    <span className="text-[10px] text-amber-400/80 font-normal">كود الترشيح / الإحالة</span>
                  </label>
                  <input
                    type="tel"
                    value={authForm.referredByPhone}
                    onChange={e => setAuthForm({ ...authForm, referredByPhone: e.target.value })}
                    placeholder="مثال: 0501234567"
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-amber-500 font-mono"
                    dir="ltr"
                  />
                  {authForm.referredByPhone && authForm.referredByPhone.trim() === authForm.phone.trim() && (
                    <p className="text-[10px] text-rose-400 font-bold mt-1">⚠️ لا يمكنك إدخال رقم جوالك كمرشِح لنفسك.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>حفظ وبدء الحجز الآن ✨</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN BOOKING WIZARD OR MY BOOKINGS */}
      {currentClient && activePortalTab === 'wizard' && (
        <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          {/* Wizard Progress Stepper */}
          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-bold">
            {[
              { num: 1, label: 'الفرع' },
              { num: 2, label: 'الخدمات' },
              { num: 3, label: 'الموعد والخبير' },
              { num: 4, label: 'التأكيد' }
            ].map(s => (
              <div key={s.num} className="flex items-center gap-1.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                  currentStep === s.num
                    ? 'bg-emerald-500 text-slate-950 font-black ring-4 ring-emerald-500/20'
                    : currentStep > s.num
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-600'
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {currentStep > s.num ? '✓' : s.num}
                </span>
                <span className={`hidden sm:inline ${currentStep === s.num ? 'text-white' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* ================= STEP 1: SELECT BRANCH (In Client's Country) ================= */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Building2 size={16} className="text-emerald-400" />
                  <span>اختر فرع الصالون القريب منك ({countryBranches.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">دولة: <strong className="text-emerald-400">{clientCountry}</strong></span>
              </div>

              <div className="space-y-2.5">
                {countryBranches.map(b => {
                  const isSelected = b.id === selectedBranchId;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      className={`bg-slate-900 border rounded-3xl p-4 cursor-pointer transition-all shadow-lg relative ${
                        isSelected 
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-gradient-to-r from-slate-900 to-emerald-950/30' 
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-white text-base">{b.name}</h4>
                            {b.isMain && <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">الفرع الرئيسي ⭐</span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                            <MapPin size={13} className="text-emerald-400 shrink-0" />
                            <span>{b.address || b.city || clientCountry}</span>
                          </p>
                          {b.phone && (
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                              <Phone size={13} className="text-slate-500 shrink-0" />
                              <span dir="ltr">{b.phone}</span>
                            </p>
                          )}
                        </div>

                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-700'
                        }`}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>متابعة لاختيار الخدمات</span>
                <ChevronRight size={16} className="rotate-180" />
              </button>
            </div>
          )}

          {/* ================= STEP 2: SELECT SERVICES (Branch Scoped) ================= */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <Scissors size={16} className="text-emerald-400" />
                    <span>اختر الخدمات المطلوبة ({branchServices.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">فرع: <strong className="text-white">{activeBranch?.name}</strong></p>
                </div>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-slate-400 hover:text-white font-bold"
                >
                  ‹ تغيير الفرع
                </button>
              </div>

              {/* Categories Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                    selectedCategory === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  الكل ({branchServices.length})
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                      selectedCategory === c.id ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Services List */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {branchServices
                  .filter(s => selectedCategory === 'all' || s.categoryId === selectedCategory)
                  .map(s => {
                    const isSelected = selectedServiceIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleService(s.id)}
                        className={`bg-slate-900 border rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-md ${
                          isSelected ? 'border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/30' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center ${
                            isSelected ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-700'
                          }`}>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </div>
                          <div>
                            <p className="font-extrabold text-white text-xs sm:text-sm">{s.name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                              <Clock size={11} className="text-emerald-400" />
                              <span>{s.durationMinutes || 30} دقيقة</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-left font-mono font-black text-emerald-400 text-sm sm:text-base">
                          {s.price} <span className="text-xs font-normal text-slate-400">{currency}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Sticky Summary Bottom Bar */}
              {selectedServiceIds.length > 0 && (
                <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-4 shadow-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-300">
                      تم اختيار: <strong className="text-emerald-400">{selectedServiceIds.length} خدمات</strong> • {totalEstimatedDuration} دقيقة
                    </span>
                    <span className="text-base font-black text-white font-mono">
                      الإجمالي: <span className="text-emerald-400">{totalBookingPrice} {currency}</span>
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 rounded-2xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>المتابعة لاختيار الموعد والخبير</span>
                      <ChevronRight size={16} className="rotate-180" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 3: SELECT DATE, SPECIALIST & TIME ================= */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <CalendarIcon size={16} className="text-emerald-400" />
                  <span>اختر التاريخ والخبير والوقت</span>
                </h3>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-slate-400 hover:text-white font-bold"
                >
                  ‹ تعديل الخدمات
                </button>
              </div>

              {/* 1. Date Selector (Next 14 Days) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">1. تاريخ الحجز:</label>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
                  {availableDates.map(d => {
                    const isSelected = selectedDate === d.iso;
                    return (
                      <button
                        key={d.iso}
                        onClick={() => setSelectedDate(d.iso)}
                        className={`min-w-[65px] py-2 px-1 rounded-2xl text-center border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 scale-105' 
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-[10px] font-bold text-slate-300">{d.dayName}</p>
                        <p className="text-base font-black my-0.5">{d.dayNum}</p>
                        <p className="text-[9px] text-slate-400">{d.monthName}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Specialist Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">2. الخبير / الفني المفضل:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Any available option */}
                  <button
                    onClick={() => setSelectedStaffId('any')}
                    className={`p-3.5 rounded-3xl border text-right transition-all cursor-pointer flex items-center gap-3.5 ${
                      selectedStaffId === 'any'
                        ? 'bg-emerald-950/50 border-emerald-500 text-white ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-md">
                      ⭐
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-xs sm:text-sm text-emerald-400">أي خبير متاح (الأسرع)</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">سيتم تعيين أقرب خبير متاح لتنفيذ خدماتك فوراً دون انتظار</p>
                    </div>
                  </button>

                  {/* Branch Employees with Photos & Bios */}
                  {branchEmployees.map(emp => {
                    const isSelected = selectedStaffId === emp.id;
                    const staffAvail = isStaffAvailableOnDate(emp, selectedDate, settings);
                    const isUnavailable = !staffAvail.available;

                    return (
                      <button
                        key={emp.id}
                        disabled={isUnavailable}
                        onClick={() => setSelectedStaffId(emp.id)}
                        className={`p-3.5 rounded-3xl border text-right transition-all relative overflow-hidden flex flex-col justify-between ${
                          isUnavailable
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-gradient-to-br from-slate-900 to-emerald-950/40 border-emerald-500 text-white ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/50 cursor-pointer'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {/* Employee Photo */}
                          <div className="relative shrink-0">
                            {emp.avatarUrl ? (
                              <img
                                src={emp.avatarUrl}
                                alt={emp.name}
                                className="w-12 h-12 rounded-2xl object-cover ring-2 ring-emerald-500/30 shadow-md"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-black text-base shadow-inner">
                                {emp.name.slice(0, 2)}
                              </div>
                            )}
                            <div className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] font-black ${
                              isUnavailable ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'
                            }`}>
                              {isUnavailable ? '✕' : '✓'}
                            </div>
                          </div>

                          {/* Name & Role */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-black text-xs sm:text-sm text-white truncate">{emp.name}</h4>
                              {isUnavailable ? (
                                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-black px-2 py-0.5 rounded-full">
                                  {staffAvail.reason || 'إجازة'}
                                </span>
                              ) : isSelected ? (
                                <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full">
                                  مختار ✓
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-emerald-400/90 font-bold mt-0.5 truncate">{emp.role || 'فني كوافير ومصفف'}</p>
                            {emp.checkInTime && (
                              <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                ⏰ دوامه: من {emp.checkInTime} إلى {emp.checkOutTime || '22:00'}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Public Bio / Client Note Note */}
                        {emp.publicBio ? (
                          <div className="mt-2.5 w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2 text-[10px] text-amber-200/90 font-medium leading-relaxed flex items-start gap-1.5">
                            <Sparkles size={12} className="text-amber-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{emp.publicBio}</span>
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                            <span>كفاءة وخبرة عالية في تصفيف الشعر والعناية</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Time Slots Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">3. الوقت المناسب:</label>
                
                {isSelectedDateBlocked ? (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-2xl text-xs font-bold text-center space-y-1">
                    <p className="text-sm">⚠️ الصالون مغلق بالكامل في هذا اليوم</p>
                    <p className="text-[11px] text-rose-400/90 font-normal">
                      {settings.bookingRules?.blockedDates?.find(b => b.date === selectedDate)?.reason || 'عطلة رسمية أو صيانة دورية - يرجى اختيار تاريخ آخر من الأعلى'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                    {timeSlots.map((slot, idx) => {
                      const isSelected = selectedTimeSlot === slot.time;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => setSelectedTimeSlot(slot.time)}
                          title={slot.isAvailable ? 'متاح للحجز' : slot.reason || 'غير متاح'}
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold font-mono transition-all relative group ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                              : slot.isAvailable
                              ? 'bg-slate-900 border border-slate-800 text-slate-200 hover:border-emerald-500 cursor-pointer'
                              : 'bg-slate-950 border border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                          }`}
                        >
                          <span>{slot.time}</span>
                          {!slot.isAvailable && slot.reason && (
                            <span className="block text-[8px] text-rose-400 font-sans truncate mt-0.5">
                              {slot.reason}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Notes input */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">ملاحظات إضافية أو طلبات خاصة (اختياري):</label>
                <textarea
                  value={bookingNotes}
                  onChange={e => setBookingNotes(e.target.value)}
                  placeholder="مثال: يرجى تجهيز صبغة رقم 5، أو عناية خاصة بالبشرة..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-2xl p-3 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              {/* Confirm Step Button */}
              {selectedTimeSlot && (
                <button
                  onClick={() => setCurrentStep(4)}
                  className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>مراجعة وتأكيد الحجز</span>
                  <ChevronRight size={16} className="rotate-180" />
                </button>
              )}
            </div>
          )}

          {/* ================= STEP 4: FINAL CONFIRMATION ================= */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <span>ملخص وتأكيد الحجز</span>
                  </h3>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="text-xs text-slate-400 hover:text-white font-bold"
                  >
                    ‹ تعديل الموعد
                  </button>
                </div>

                {/* Booking Summary Card */}
                <div className="space-y-2.5 text-xs bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">الفرع:</span>
                    <span className="text-white font-bold">{activeBranch.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">التاريخ والوقت:</span>
                    <span className="text-emerald-400 font-bold font-mono">{selectedDate} • {selectedTimeSlot}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 font-semibold">الخبير / الفني:</span>
                    <div className="flex items-center gap-2 text-right">
                      {selectedStaffId !== 'any' && branchEmployees.find(e => e.id === selectedStaffId)?.avatarUrl ? (
                        <img 
                          src={branchEmployees.find(e => e.id === selectedStaffId)?.avatarUrl} 
                          alt="Specialist" 
                          className="w-7 h-7 rounded-xl object-cover ring-1 ring-emerald-500/40" 
                        />
                      ) : null}
                      <div>
                        <span className="text-white font-black block">
                          {selectedStaffId === 'any' ? '⭐ أي خبير متاح' : branchEmployees.find(e => e.id === selectedStaffId)?.name}
                        </span>
                        {selectedStaffId !== 'any' && branchEmployees.find(e => e.id === selectedStaffId)?.publicBio && (
                          <span className="text-[10px] text-amber-300 block font-medium">
                            {branchEmployees.find(e => e.id === selectedStaffId)?.publicBio}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">العميل:</span>
                    <span className="text-white font-bold">{currentClient.name} ({currentClient.phone})</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-slate-400 font-semibold block">الخدمات المختارة:</span>
                    {selectedServicesList.map(s => (
                      <div key={s.id} className="flex justify-between text-slate-300">
                        <span>• {s.name}</span>
                        <span className="font-mono">{s.price} {currency}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-black">
                    <span className="text-white">الإجمالي المستحق للدفع:</span>
                    <span className="text-emerald-400 font-mono text-base">{totalBookingPrice} {currency}</span>
                  </div>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-2xl text-[11px] text-emerald-300 flex items-center gap-2">
                  <MessageCircle size={15} className="shrink-0 text-emerald-400" />
                  <span>سيصلك إشعار فوري بتأكيد الحجز وتفاصيله عبر الواتساب على رقمك المسجل.</span>
                </div>

                <button
                  onClick={handleConfirmBooking}
                  className="w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-black py-4 rounded-2xl text-sm shadow-xl shadow-emerald-600/40 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Check size={18} strokeWidth={3} />
                  <span>تأكيد الحجز الآن ✓</span>
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* 4. MY BOOKINGS VIEW (Customer Dashboard) */}
      {currentClient && activePortalTab === 'my_bookings' && (
        <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <CalendarIcon size={16} className="text-emerald-400" />
              <span>سجل حجوزاتي ومواعيدي ({myBookingsList.length})</span>
            </h3>
            <button
              onClick={() => setActivePortalTab('wizard')}
              className="bg-emerald-600 text-white text-xs font-black px-3 py-1.5 rounded-xl cursor-pointer"
            >
              + حجز موعد جديد
            </button>
          </div>

          {myBookingsList.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
              <CalendarIcon size={36} className="mx-auto mb-2 text-slate-600 opacity-60" />
              <p className="font-bold text-sm text-slate-300">لا توجد حجوزات مسجلة باسمك بعد</p>
              <p className="text-xs text-slate-500 mt-1">ابدأ بحجز أول موعد لك في صالوننا المميز</p>
              <button
                onClick={() => setActivePortalTab('wizard')}
                className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                احجز الآن ✨
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myBookingsList.map(b => (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm font-mono">{b.bookingCode || b.id.slice(0, 8)}</span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : b.status === 'completed'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : b.status === 'cancelled'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {b.status === 'confirmed' ? '🟢 مؤكد' : b.status === 'completed' ? '✓ مكتمل' : b.status === 'cancelled' ? '🔴 ملغي' : '⏳ قيد الانتظار'}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-400 font-bold font-mono mt-1">
                        📅 {b.date} • {b.time}
                      </p>
                    </div>

                    <div className="text-left font-mono font-black text-white text-sm">
                      {b.totalAmount} {currency}
                    </div>
                  </div>

                  {/* Services summary */}
                  <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80 text-xs">
                    <p className="text-[10px] text-slate-400 font-bold mb-1">الخدمات:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {b.services?.map((s, idx) => (
                        <span key={idx} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg text-[11px] font-medium">
                          {s.serviceName}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Cancel button if pending/confirmed */}
                  {(b.status === 'pending' || b.status === 'confirmed') && onCancelBooking && (
                    <button
                      onClick={() => {
                        if (confirm('هل ترغب في إلغاء هذا الحجز؟')) {
                          onCancelBooking(b.id);
                        }
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer"
                    >
                      إلغاء الموعد ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* 5. CELEBRATORY SUCCESS MODAL */}
      {completedBookingResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-4 ring-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">تم استلام حجزك بنجاح! 🎉</h3>
              <p className="text-xs text-slate-400 mt-1">
                كود الحجز الخاص بك: <strong className="text-emerald-400 font-mono text-sm">{completedBookingResult.bookingCode}</strong>
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <p>📅 <strong>{completedBookingResult.date}</strong> الساعة <strong>{completedBookingResult.time}</strong></p>
              <p>📍 الفرع: {activeBranch.name}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCompletedBookingResult(null);
                  setActivePortalTab('my_bookings');
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                عرض حجوزاتي
              </button>
              <button
                onClick={() => setCompletedBookingResult(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
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
