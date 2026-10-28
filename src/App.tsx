/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Scissors, LayoutDashboard, Users, Settings, LogOut,
  Calendar, Wallet, Receipt, Banknote, FileText,
  UsersRound, List, Menu, X, Printer, Package, Truck, 
  ShoppingCart, ClipboardList, Shield, User as UserIcon, Sparkles, BarChart3, Boxes, Bot,
  AlertCircle, Smartphone, ShieldAlert, ShieldCheck, Tag, HeartHandshake, Briefcase, Fingerprint, Radio,
  Key, AlertTriangle, Clock, Lock, ChevronUp, ChevronDown, Zap, MessageSquare, Hourglass, Sliders, TableProperties
} from 'lucide-react';
import { DailySheetScreen } from './components/DailySheetScreen';
import { POSScreen } from './components/POSScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { HRScreen } from './components/HRScreen';
import { EmployeesScreen } from './components/EmployeesScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { OwnerExecutivePortal } from './components/OwnerExecutivePortal';
import { BookingsScreen } from './components/BookingsScreen';
import { InvoicesScreen } from './components/InvoicesScreen';
import { DeferredInvoicesScreen } from './components/DeferredInvoicesScreen';
import { ClientsScreen } from './components/ClientsScreen';
import { ComplaintsScreen } from './components/ComplaintsScreen';
import { TreasuryScreen } from './components/TreasuryScreen';
import { ExpensesScreen } from './components/ExpensesScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { ServicesScreen } from './components/ServicesScreen';
import { ProductsScreen } from './components/ProductsScreen';
import { PermissionsScreen } from './components/PermissionsScreen';
import { EmployeeAnalyticsScreen } from './components/EmployeeAnalyticsScreen';
import { WarehouseScreen } from './components/WarehouseScreen';
import { PartnersScreen } from './components/PartnersScreen';
import { PromoCodesScreen } from './components/PromoCodesScreen';
import { TipsScreen } from './components/TipsScreen';
import { FingerprintLogsScreen } from './components/FingerprintLogsScreen';
import { LoginScreen } from './components/LoginScreen';
import { BarberLoginScreen } from './components/BarberLoginScreen';
import { BarberPortalScreen } from './components/BarberPortalScreen';
import { SaaSProgrammerPortal } from './components/SaaSProgrammerPortal';
import { ClientReservationPortal } from './components/ClientReservationPortal';
import { KioskTabletScreen } from './components/KioskTabletScreen';
import { QueueCallingScreen } from './components/QueueCallingScreen';
import { ManagerAIChatScreen } from './components/ManagerAIChatScreen';
import { LicenseModal, LicenseInfo } from './components/LicenseModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { UserAccountMenu } from './components/UserAccountMenu';
import { UserProfileModal } from './components/UserProfileModal';
import { TursoCloudSyncModal } from './components/TursoCloudSyncModal';
import { InitialSalonSetupModal, DEFAULT_INITIAL_TREASURIES } from './components/InitialSalonSetupModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { ClosingReportReceipt } from './components/ClosingReportReceipt';
import { handlePrintReceipt, directPrintHtml } from './utils/print';
import { printQueueSlipDirect } from './utils/printQueueSlip';
import { AuthService, ROLE_LABELS } from './services/auth';
import { SupabaseService } from './services/supabase';
import { RealtimeSync } from './services/realtimeSync';
import { DB, dbClientToApp, dbEmployeeToApp, dbServiceToApp, dbProductToApp, dbBookingToApp, dbInvoiceToApp, toCamel } from './services/db';
import { SubscriptionService, evictExcessLocalStorage } from './services/subscriptionService';
import { QueueService } from './services/queueService';
import { completeBookingAndCreateHeldInvoice } from './services/bookingHeldInvoiceService';
import { EvolutionApiService } from './services/evolutionApiService';
import { hasEmployeeFixedCommission } from './utils/commissionHelper';
import { 
  AppSettings, Transaction, Booking, Invoice, ServiceItem, Category, Employee, Product, AppUser, 
  SaaSSubscription, Branch, Partner, PartnerTransaction, PromoCode, PromoCodeUsage, TipRecord, 
  EmployeeCustody, FingerprintLog, WorkShift, Client, HeldInvoice, SalesReturn, isClientInBranch 
} from './types';


export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      return AuthService.getCurrentUser();
    } catch {
      return null;
    }
  });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showUserHeaderMenu, setShowUserHeaderMenu] = useState(false);
  const [showUserSidebarMenu, setShowUserSidebarMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('pos');
  const [showSidebar, setShowSidebar] = useState(false);

  const getUserInitials = (name?: string) => {
    if (!name) return 'ما';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).substring(0, 2);
    }
    return name.substring(0, 2);
  };

  const handleOpenSettingsFromUserMenu = () => {
    setShowUserHeaderMenu(false);
    setShowUserSidebarMenu(false);
    if (
      AuthService.canDo('manage_settings', currentUser) ||
      currentUser?.role === 'owner' ||
      currentUser?.role === 'admin' ||
      currentUser?.role === 'programmer' ||
      currentUser?.screens?.includes('settings') ||
      currentUser?.screens?.includes('*')
    ) {
      setActiveTab('settings');
    } else {
      alert('عذراً، الوصول إلى الإعدادات يتطلب صلاحية إدارة الإعدادات.');
    }
  };
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isTursoConnected, setIsTursoConnected] = useState(false);
  const [showTursoModal, setShowTursoModal] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Dedicated Route for Standalone Barber & Technician Portal (/barber or /staff)
  const isBarberQuery = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.endsWith('/barber') || path.includes('/barber/') ||
      path.endsWith('/staff') || path.includes('/staff/') ||
      hash.includes('barber') || search.includes('barber') ||
      search.includes('portal=barber')
    );
  };

  // Dedicated Route for Standalone Tablet Kiosk Check-In (/kiosk, /koisk, /queue, ?kiosk=true, ?koisk=true, #/koisk, #/kiosk)
  const isKioskQuery = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();

    // Direct path match
    if (
      path.includes('kiosk') || path.includes('koisk') ||
      path.endsWith('/queue') || path.includes('/queue/')
    ) return true;

    // Hash match (e.g. #/koisk, #/kiosk, #koisk, #kiosk, #/koisk?salon=xxx)
    if (
      hash.includes('kiosk') || hash.includes('koisk') ||
      hash.includes('queue')
    ) return true;

    // Query parameters match (e.g. ?kiosk=true, ?koisk=true, ?portal=kiosk, ?portal=koisk)
    if (
      search.includes('kiosk') || search.includes('koisk') ||
      search.includes('portal=kiosk') || search.includes('portal=koisk')
    ) return true;

    return false;
  };

  // Dedicated Route for Standalone Online Client Reservation Portal (/reservation, /booking, or ?salonCode)
  const isReservationQuery = () => {
    if (typeof window === 'undefined') return false;
    // CRITICAL: Kiosk and Barber routes must NOT be intercepted by reservation portal!
    if (isKioskQuery()) return false;
    if (isBarberQuery()) return false;

    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    if (path.endsWith('/reservation') || path.includes('/reservation/') || path.endsWith('/booking') || path.includes('/booking/')) return true;
    if (hash.includes('reservation') || hash.includes('booking') || search.includes('portal=reservation') || search.includes('salon=') || search.includes('code=')) return true;
    if (search.length > 1 && !search.includes('tab=') && !search.includes('owner') && !search.includes('barber') && !search.includes('admin')) {
      return true;
    }
    return false;
  };

  const [isBarberRoute, setIsBarberRoute] = useState<boolean>(isBarberQuery);
  const [isReservationRoute, setIsReservationRoute] = useState<boolean>(isReservationQuery);
  const [isKioskRoute, setIsKioskRoute] = useState<boolean>(isKioskQuery);

  useEffect(() => {
    const checkRoutes = () => {
      setIsBarberRoute(isBarberQuery());
      setIsReservationRoute(isReservationQuery());
      setIsKioskRoute(isKioskQuery());
    };
    window.addEventListener('popstate', checkRoutes);
    window.addEventListener('hashchange', checkRoutes);
    return () => {
      window.removeEventListener('popstate', checkRoutes);
      window.removeEventListener('hashchange', checkRoutes);
    };
  }, []);

  // 1. App Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const activeUser = AuthService.getCurrentUser();
      const activeUserSalonId = activeUser?.salonId || (activeUser as any)?.salon_id;
      const savedActiveId = localStorage.getItem('smartcut_active_salon_id');
      const targetSalonId = activeUserSalonId || savedActiveId;

      const saved = localStorage.getItem('smartcut_app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure saved settings belong to the active user's salon
        if (!targetSalonId || parsed.salonId === targetSalonId) {
          if (parsed.treasuries && Array.isArray(parsed.treasuries)) {
            const hasMain = parsed.treasuries.some((t: any) => t.isMain || t.id === 'main' || (t.name && t.name.includes('الرئيسية')));
            if (!hasMain) {
              parsed.treasuries = [{ id: 'main', name: 'الخزينة الرئيسية', isMain: true }, ...parsed.treasuries];
            }
          } else {
            parsed.treasuries = DEFAULT_INITIAL_TREASURIES;
          }
          return parsed;
        }
      }

      const regSalons = SubscriptionService.getSalons();
      const targetSalon = targetSalonId 
        ? regSalons.find(s => s.id === targetSalonId || s.code === targetSalonId)
        : (regSalons.length > 0 ? regSalons[0] : null);

      if (targetSalon) {
        const sBranches = SubscriptionService.getBranches(targetSalon.id);
        const firstBranch = (activeUser?.branchId && sBranches.find(b => b.id === activeUser.branchId)) || sBranches[0];
        return {
          salonId: targetSalon.id,
          salonCode: targetSalon.code,
          branchId: firstBranch?.id || '',
          branchCode: firstBranch?.code || 'BR-01',
          salonName: targetSalon.name,
          salonType: targetSalon.salonType || (targetSalon as any).salon_type || 'men',
          taxNumber: '',
          commercialReg: '',
          vatEnabled: false,
          vatRate: 0,
          currency: targetSalon.currency || 'EGP',
          country: targetSalon.country || 'جمهورية مصر العربية',
          waInstantName: '',
          waApiKey: '',
          printerName: 'طابعة الكاشير',
          paperSize: '80mm',
          printAutomatically: false,
          zatcaEnabled: false,
          receiptHeaderNote: 'أهلاً بكم في صالونكم المميز',
          receiptFooterNote: 'شكراً لزيارتكم ونسعد بخدمتكم دائماً',
          logoUrl: targetSalon.logoUrl || '',
          phone: targetSalon.phone || '',
          address: targetSalon.address || '',
          expenseCategories: ['إيجار', 'كهرباء ومياه', 'صيانة ومطبوعات', 'أدوات ومستهلكات', 'ضيافة ونظافة', 'أخرى'],
          bookingNotes: '',
          showDashboardAnalytics: true,
          showEmployeeAnalytics: true,
          treasuries: DEFAULT_INITIAL_TREASURIES
        };
      }
    } catch (e) {}
    return {
      salonId: '',
      salonCode: '',
      branchId: '',
      branchCode: '',
      salonName: '',
      taxNumber: '',
      commercialReg: '',
      vatEnabled: false,
      vatRate: 0,
      currency: 'EGP',
      country: 'جمهورية مصر العربية',
      waInstantName: '',
      waApiKey: '',
      printerName: 'طابعة الكاشير',
      paperSize: '80mm',
      printAutomatically: false,
      zatcaEnabled: false,
      receiptHeaderNote: '',
      receiptFooterNote: '',
      logoUrl: '',
      phone: '',
      address: '',
      expenseCategories: ['إيجار', 'كهرباء ومياه', 'صيانة ومطبوعات', 'أدوات ومستهلكات', 'ضيافة ونظافة', 'أخرى'],
      bookingNotes: '',
      showDashboardAnalytics: true,
      showEmployeeAnalytics: true,
      treasuries: DEFAULT_INITIAL_TREASURIES
    };
  });

  // SaaS Subscription & Branches State
  const [subscription, setSubscription] = useState<SaaSSubscription>(() => {
    try {
      const activeUser = AuthService.getCurrentUser();
      const activeUserSalonId = activeUser?.salonId || (activeUser as any)?.salon_id;
      const savedSettings = localStorage.getItem('smartcut_app_settings');
      const s = savedSettings ? JSON.parse(savedSettings) : null;
      const targetSalonId = activeUserSalonId || s?.salonId;
      if (targetSalonId) {
        const salons = SubscriptionService.getSalons();
        const salon = salons.find((item: any) => item.id === targetSalonId || item.code === targetSalonId);
        if (salon) {
          return {
            id: salon.id,
            salonId: salon.id,
            salonCode: salon.code,
            organizationName: salon.name,
            ownerEmail: salon.email,
            phone: salon.phone,
            country: salon.country,
            plan: salon.subscriptionPlan || 'pro',
            status: salon.subscriptionStatus || 'trial',
            isActive: salon.isActive !== false,
            startDate: salon.subscriptionStartDate,
            endDate: salon.subscriptionEndDate,
            maxBranches: salon.maxBranches || 3,
            maxUsers: salon.maxUsers || 10,
            trialDays: salon.trialDays || 7
          };
        }
      }
    } catch (e) {}
    return {
      id: '',
      salonId: '',
      salonCode: '',
      organizationName: '',
      plan: 'pro',
      status: 'trial',
      isActive: true,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      maxBranches: 3,
      maxUsers: 10
    };
  });

  const [branches, setBranches] = useState<Branch[]>(() => {
    try {
      const activeUser = AuthService.getCurrentUser();
      const activeUserSalonId = activeUser?.salonId || (activeUser as any)?.salon_id;
      const savedSettings = localStorage.getItem('smartcut_app_settings');
      const sId = activeUserSalonId || (savedSettings ? JSON.parse(savedSettings).salonId : '');
      if (sId) {
        const list = SubscriptionService.getBranches(sId);
        if (list && list.length > 0) return list;
      }
    } catch (e) {}
    return [];
  });

  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    try {
      const activeUser = AuthService.getCurrentUser();
      if (activeUser?.branchId) return activeUser.branchId;
      const activeUserSalonId = activeUser?.salonId || (activeUser as any)?.salon_id;
      const savedSettings = localStorage.getItem('smartcut_app_settings');
      const sId = activeUserSalonId || (savedSettings ? JSON.parse(savedSettings).salonId : '');
      if (sId) {
        const list = SubscriptionService.getBranches(sId);
        if (list && list.length > 0) {
          const main = list.find((b: any) => b.isMain);
          return main ? main.id : list[0].id;
        }
      }
    } catch (e) {}
    return 'b-main';
  });

  const [allSalons, setAllSalons] = useState<any[]>(() => SubscriptionService.getSalons());

  // Shift State scoped per active branch & persisted in localStorage + Supabase
  const [branchShifts, setBranchShifts] = useState<Record<string, { 
    isOpen: boolean, 
    date: string, 
    initialCash: number, 
    shiftId?: string,
    shiftCode?: string,
    openedAt?: string,
    openedByUserId?: string,
    openedByUserName?: string,
    openedByName?: string,
    openedByRole?: string,
    lastClosedAt?: string
  }>>(() => {
    try {
      const saved = localStorage.getItem('smartcut_work_shifts_state');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const shiftData = useMemo(() => {
    // 1. Direct active branch shift
    const current = branchShifts[activeBranchId];
    if (current && typeof current.isOpen === 'boolean') return current;
    // Fallback only if no activeBranchId is set
    if (!activeBranchId && branchShifts['b-main']) return branchShifts['b-main'];
    return { isOpen: false, date: '', initialCash: 0 };
  }, [branchShifts, activeBranchId]);

  const setShiftData = (updater: any) => {
    setBranchShifts(prev => {
      const branchKey = activeBranchId || 'b-main';
      const current = prev[branchKey] || { isOpen: false, date: '', initialCash: 0 };
      const next = typeof updater === 'function' ? updater(current) : updater;
      const updated = {
        ...prev,
        [branchKey]: next
      };
      if (next?.branchId && next.branchId !== branchKey) {
        updated[next.branchId] = next;
      }
      try { localStorage.setItem('smartcut_work_shifts_state', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const applyActiveWorkShift = useCallback((activeShift: any, branchId: string) => {
    if (!branchId) return;
    // 1. إذا كان الاستدعاء خطأ أو لم يرجع بيانات صالحة، يُحظر تماماً تغيير حالة الوردية
    if (!activeShift || activeShift.error) {
      return;
    }

    // 2. الاعتماد على قاعدة البيانات: إذا كان جدول work_shifts يحتوي على وردية مفتوحة لهذا الفرع تحديداً
    if (activeShift.isOpen === true || activeShift.status === 'open' || (!activeShift.closedAt && !activeShift.isClosed && activeShift.shiftDate)) {
      setBranchShifts(prev => {
        const current = prev[branchId];
        const shiftCode = activeShift.shiftCode || activeShift.shift_code || current?.shiftCode || `SH-${(activeShift.shiftDate || '').replace(/-/g, '')}-01`;
        if (
          current?.isOpen === true &&
          current?.date === activeShift.shiftDate &&
          current?.initialCash === (Number(activeShift.initialCash) || 0) &&
          current?.shiftId === activeShift.id &&
          current?.shiftCode === shiftCode
        ) {
          return prev;
        }
        const shiftObj = {
          isOpen: true,
          date: activeShift.shiftDate,
          initialCash: Number(activeShift.initialCash) || 0,
          shiftId: activeShift.id,
          shiftCode: shiftCode,
          openedAt: activeShift.openedAt || (activeShift as any).opened_at || activeShift.createdAt || (activeShift as any).created_at,
          openedByUserId: activeShift.openedByUserId || (activeShift as any).opened_by_user_id,
          openedByUserName: activeShift.openedByUserName || (activeShift as any).opened_by_user_name || activeShift.openedByName,
          openedByName: activeShift.openedByName || (activeShift as any).opened_by_name || activeShift.openedByUserName,
          openedByRole: activeShift.openedByRole || (activeShift as any).opened_by_role || 'cashier',
          branchId
        };
        const updated = {
          ...prev,
          [branchId]: shiftObj
        };
        try { localStorage.setItem('smartcut_work_shifts_state', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
      return;
    }

    // 3. التحقق القاطع من إغلاق الوردية لهذا الفرع
    if (activeShift.hasDefinitiveProof && (activeShift.isClosed || activeShift.status === 'closed')) {
      setBranchShifts(prev => {
        const current = prev[branchId];
        if (!current?.isOpen) return prev;
        if (current.shiftId && activeShift.id && current.shiftId !== activeShift.id) {
          return prev;
        }
        const updated = {
          ...prev,
          [branchId]: {
            isOpen: false,
            date: '',
            initialCash: 0,
            shiftId: undefined,
            shiftCode: undefined,
            lastClosedAt: activeShift.closedAt || new Date().toISOString()
          }
        };
        try { localStorage.setItem('smartcut_work_shifts_state', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }
  }, []);

  // المزامنة التلقائية لوردية الفرع النشط فور التبديل بين الفروع
  useEffect(() => {
    if (settings.salonId && activeBranchId) {
      DB.getActiveWorkShift(settings.salonId, activeBranchId).then(activeShift => {
        applyActiveWorkShift(activeShift, activeBranchId);
      }).catch(() => {});
    }
  }, [activeBranchId, settings.salonId, applyActiveWorkShift]);

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState<boolean>(false);
  const [isProgrammerPortalActive, setIsProgrammerPortalActive] = useState<boolean>(() => {
    try {
      const u = AuthService.getCurrentUser();
      return u?.role === 'programmer';
    } catch {
      return false;
    }
  });
  const [showInitialSalonModal, setShowInitialSalonModal] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smartcut_app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.salonName && parsed.salonName.trim()) return false;
      }
      const reg = SubscriptionService.getSalons();
      if (reg.length > 0 && reg[0].name && reg[0].name.trim()) return false;
    } catch (e) {}
    return true;
  });

  const getLocalTodayDateString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const [openShiftForm, setOpenShiftForm] = useState({ date: getLocalTodayDateString(), initialCash: 0 });

  useEffect(() => {
    if (showOpenModal) {
      setOpenShiftForm(prev => ({ ...prev, date: getLocalTodayDateString() }));
    }
  }, [showOpenModal]);

  // Global In-Memory Stores
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const cached = localStorage.getItem('smartcut_invoices_cache');
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed.map(dbInvoiceToApp) : [];
    } catch {
      return [];
    }
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([{ id: 'all', name: 'الكل' }]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeBookingForPOS, setActiveBookingForPOS] = useState<Booking | null>(null);
  const [activeHeldInvoiceForPOS, setActiveHeldInvoiceForPOS] = useState<HeldInvoice | null>(null);
  const [activeEditingInvoiceForPOS, setActiveEditingInvoiceForPOS] = useState<Invoice | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<any[]>([]);
  const [itemMovements, setItemMovements] = useState<any[]>([]);
  
  // Extended Features Stores
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerTransactions, setPartnerTransactions] = useState<PartnerTransaction[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoCodeUsages, setPromoCodeUsages] = useState<PromoCodeUsage[]>([]);
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [custodies, setCustodies] = useState<EmployeeCustody[]>([]);
  const [fingerprintLogs, setFingerprintLogs] = useState<FingerprintLog[]>([]);
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);

  // Refs to prevent duplicate initialization and redundant fetches
  const hasInitializedRef = useRef<boolean>(false);
  const loadedSectionsRef = useRef<Set<string>>(new Set());

  // Function to apply tab section data into state
  const applySectionData = useCallback((section: string, data: any) => {
    if (!data) return;
    if (data.invoices) {
      setInvoices(data.invoices.map(dbInvoiceToApp));
    }
    if (data.transactions) {
      setTransactions(data.transactions.map((t: any) => ({
        ...t,
        date: t.date || t.created_at || t.createdAt || t.shift_date || t.shiftDate || new Date().toISOString(),
        expenseCategory: t.expenseCategory || '', createdBy: t.createdBy || '',
        userId: t.userId || '', userName: t.userName || '', shiftDate: t.shiftDate || ''
      })));
    }
    if (data.bookings) {
      setBookings(data.bookings.map(dbBookingToApp));
    }
    if (data.clients) {
      setClients(data.clients.map(dbClientToApp));
    }
    if (data.products && Array.isArray(data.products)) {
      setProducts(data.products.map(dbProductToApp));
    }
    if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
      setCategories(data.categories);
    }
    if (data.suppliers) setSuppliers(data.suppliers);
    if (data.purchaseInvoices) setPurchaseInvoices(data.purchaseInvoices);
    if (data.supplierPayments) setSupplierPayments(data.supplierPayments);
    if (data.inventoryCounts) setInventoryCounts(data.inventoryCounts);
    if (data.itemMovements) setItemMovements(data.itemMovements);
    if (data.partners) setPartners(data.partners);
    if (data.partnerTransactions) setPartnerTransactions(data.partnerTransactions);
    if (data.promoCodes) setPromoCodes(data.promoCodes);
    if (data.promoCodeUsages) setPromoCodeUsages(data.promoCodeUsages);
    if (data.tips) setTips(data.tips);
    if (data.custodies) setCustodies(data.custodies);
    if (data.fingerprintLogs) setFingerprintLogs(data.fingerprintLogs);
    if (data.employees && Array.isArray(data.employees)) {
      setEmployees(data.employees.map(dbEmployeeToApp));
    }
    if (data.settings) {
      setSettings(prev => {
        let treas = (Array.isArray(data.settings.treasuries) && data.settings.treasuries.length > 0) 
          ? data.settings.treasuries 
          : (prev.treasuries || DEFAULT_INITIAL_TREASURIES);
        if (!treas.some((t: any) => t.isMain || t.id === 'main' || (t.name && t.name.includes('الرئيسية')))) {
          treas = [{ id: 'main', name: 'الخزينة الرئيسية', isMain: true }, ...treas];
        }
        return {
          ...prev,
          ...data.settings,
          treasuries: treas
        };
      });
    }
  }, []);

  // ── 1. Single Mount Startup Lifecycle (Strictly Once) ──────────────────────────
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // تنظيف شامل وغير مشروط لأي بيانات تجريبية أو كاش محلي زائد لحماية localStorage من تجاوز الحصة (Quota)
    evictExcessLocalStorage();
    try {
      const entityKeys = [
        'smartcut_client_complaints', 'smartcut_clients', 'smartcut_invoices',
        'smartcut_transactions', 'smartcut_bookings', 'smartcut_employees',
        'smartcut_services', 'smartcut_products', 'smartcut_suppliers',
        'smartcut_purchase_invoices', 'smartcut_supplier_payments', 'smartcut_partners',
        'smartcut_partner_transactions', 'smartcut_promo_codes', 'smartcut_promo_code_usages',
        'smartcut_tips', 'smartcut_custodies', 'smartcut_inventory_counts', 'smartcut_item_movements',
        'smartcut_fingerprint_logs', 'smartcut_held_invoices', 'smartcut_queue_tickets'
      ];
      entityKeys.forEach(key => localStorage.removeItem(key));
      // حذف أي حقول مؤقتة أو تجريبية تم حفظها بالمتصفح سابقاً
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('smartcut_extra_') || key.startsWith('smartcut_demo_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    const initializeApp = async () => {
      try {
        const user = AuthService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          if (user.role === 'programmer') {
            setIsProgrammerPortalActive(true);
            setActiveTab('saas_subscriptions');
          } else if (user.role === 'owner') {
            setActiveTab('owner_portal');
          } else if (user.role === 'barber') {
            setActiveTab('barber_portal');
          } else if (user.role === 'kiosk' || (user.screens?.includes('kiosk') && !user.screens?.includes('*') && user.screens?.length === 1)) {
            setActiveTab('kiosk');
          } else if (!AuthService.canAccess('pos', user)) {
            const firstAllowed = menuItems.find(item => AuthService.canAccess(item.id, user))?.id || user.screens?.[0] || 'dashboard';
            setActiveTab(firstAllowed);
          }
        }

        // Fetch Salons list once
        const cloudSalons = await DB.fetchSalons();
        if (cloudSalons && cloudSalons.length > 0) {
          setAllSalons(cloudSalons);
          SubscriptionService.saveSalons(cloudSalons);
        }

        const salons = (cloudSalons && cloudSalons.length > 0) ? cloudSalons : SubscriptionService.getSalons();
        const userSalonId = user?.salonId || (user as any)?.salon_id;
        const savedActiveId = localStorage.getItem('smartcut_active_salon_id');

        let activeSalon: any = null;
        if (userSalonId) {
          activeSalon = salons.find(s => s.id === userSalonId || s.code === (user as any)?.salonCode) || null;
          if (!activeSalon) {
            try {
              const single = await DB.fetchSalonById(userSalonId);
              if (single) {
                activeSalon = single;
                setAllSalons(prev => [...prev.filter(s => s.id !== single.id), single]);
              }
            } catch {}
          }
          if (!activeSalon) {
            activeSalon = { id: userSalonId, name: (user as any)?.salonName || 'الصالون', code: (user as any)?.salonCode || 'SC-01' };
          }
        } else if (savedActiveId) {
          activeSalon = salons.find(s => s.id === savedActiveId) || null;
        }

        // Strictly fall back to first salon ONLY if there is no authenticated user
        if (!activeSalon && !user && salons.length > 0) {
          activeSalon = salons[0];
        }

        if (activeSalon) {
          const sId = activeSalon.id;
          try { localStorage.setItem('smartcut_active_salon_id', sId); } catch (e) {}

          // Load settings, branches, and essential POS data in parallel
          const [dbSettings, dbBranches, essentialData] = await Promise.all([
            DB.fetchSettings(sId),
            DB.fetchBranches(sId),
            DB.loadEssentialData(sId)
          ]);

          if (dbSettings) {
            setSettings(prev => {
              const isDifferentSalon = prev.salonId && prev.salonId !== sId;
              const base = isDifferentSalon ? {} : prev;
              const updatedSettings: AppSettings = {
                ...base,
                ...dbSettings,
                salonId: sId,
                salonCode: activeSalon.code || dbSettings.salonCode || '',
                salonName: (dbSettings.salonName && dbSettings.salonName !== 'صالون سمارت كت') ? dbSettings.salonName : (activeSalon.name || dbSettings.salonName || ''),
                salonType: dbSettings.salonType || (dbSettings as any)?.salon_type || activeSalon.salonType || (activeSalon as any)?.salon_type || 'men',
                logoUrl: (dbSettings.logoUrl !== undefined && dbSettings.logoUrl !== null) ? dbSettings.logoUrl : (activeSalon.logoUrl || ''),
                phone: activeSalon.phone || dbSettings.phone || '',
                country: activeSalon.country || dbSettings.country || 'جمهورية مصر العربية',
                currency: activeSalon.currency || dbSettings.currency || 'EGP',
                treasuries: (() => {
                  let tList = (Array.isArray(dbSettings.treasuries) && dbSettings.treasuries.length > 0) ? dbSettings.treasuries : (prev.treasuries || DEFAULT_INITIAL_TREASURIES);
                  if (!tList.some((t: any) => t.isMain || t.id === 'main' || (t.name && t.name.includes('الرئيسية')))) {
                    tList = [{ id: 'main', name: 'الخزينة الرئيسية', isMain: true }, ...tList];
                  }
                  return tList;
                })(),
                expenseCategories: (Array.isArray(dbSettings.expenseCategories) && dbSettings.expenseCategories.length > 0) ? dbSettings.expenseCategories : (prev.expenseCategories || []),
              };
              try {
                localStorage.setItem('smartcut_app_settings', JSON.stringify(updatedSettings));
                localStorage.setItem('smartcut_active_salon_id', sId);
              } catch (e) {}
              return updatedSettings;
            });
            if (activeSalon.name || dbSettings.salonName) {
              setShowInitialSalonModal(false);
            }
          }

          setSubscription({
            id: sId,
            salonId: sId,
            salonCode: activeSalon.code,
            organizationName: activeSalon.name,
            ownerEmail: activeSalon.email,
            phone: activeSalon.phone,
            country: activeSalon.country,
            plan: activeSalon.subscriptionPlan || 'growth',
            status: activeSalon.subscriptionStatus || 'trial',
            isActive: activeSalon.isActive !== false,
            startDate: activeSalon.subscriptionStartDate,
            endDate: activeSalon.subscriptionEndDate,
            maxBranches: activeSalon.maxBranches || 3,
            maxUsers: activeSalon.maxUsers || 10,
            trialDays: activeSalon.trialDays || 7
          });

          if (dbBranches && dbBranches.length > 0) {
            SubscriptionService.saveBranches(dbBranches);
          }
          const salonBranches = (dbBranches && dbBranches.length > 0) ? dbBranches : SubscriptionService.getBranches(sId);
          const finalBranches = salonBranches.length > 0 ? salonBranches : [
            { id: 'b-main', salonId: sId, name: `الفرع الرئيسي (${activeSalon.name})`, code: 'B01', isMain: true, phone: activeSalon.phone, address: activeSalon.country, isActive: true, status: 'active' }
          ];
          setBranches(finalBranches);

          const branchIdToUse = user?.branchId || finalBranches[0].id;
          setActiveBranchId(branchIdToUse);

          if (essentialData) {
            const validCats = essentialData.categories || [];
            setCategories(validCats.length ? validCats : [{ id: 'all', name: 'الكل' }]);
            setServices(essentialData.services ? essentialData.services.map(dbServiceToApp) : []);
            setEmployees(essentialData.employees ? essentialData.employees.map(dbEmployeeToApp) : []);
            setClients(essentialData.clients ? essentialData.clients.map(dbClientToApp) : []);
            setProducts(essentialData.products ? essentialData.products.map(dbProductToApp) : []);
            if (essentialData.suppliers) setSuppliers(essentialData.suppliers);
            if (essentialData.purchaseInvoices) setPurchaseInvoices(essentialData.purchaseInvoices);
            if (essentialData.supplierPayments) setSupplierPayments(essentialData.supplierPayments);
          }

          // Mark essential sections as loaded
          loadedSectionsRef.current.add('pos');
          loadedSectionsRef.current.add('services');
          loadedSectionsRef.current.add('products');

          // Pre-load transactions and invoices to guarantee accurate treasuries and shift closing
          DB.fetchTransactions(sId).then(dbTrxs => {
            if (dbTrxs && dbTrxs.length > 0) {
              setTransactions(dbTrxs.map((t: any) => ({
                ...t,
                date: t.date || t.created_at || t.createdAt || t.shift_date || t.shiftDate || new Date().toISOString(),
                expenseCategory: t.expenseCategory || '', createdBy: t.createdBy || '',
                userId: t.userId || '', userName: t.userName || '', shiftDate: t.shiftDate || '',
                invoiceId: t.invoiceId || t.invoice_id || (typeof t.description === 'string' ? t.description.match(/INV-[A-Z0-9]+/)?.[0] : undefined),
                invoice_id: t.invoice_id || t.invoiceId || (typeof t.description === 'string' ? t.description.match(/INV-[A-Z0-9]+/)?.[0] : undefined)
              })));
            } else {
              setTransactions([]);
            }
          }).catch(() => { setTransactions([]); });

          DB.fetchInvoices(sId).then(dbInvs => {
            if (dbInvs && dbInvs.length > 0) {
              setInvoices(dbInvs.map(dbInvoiceToApp));
            }
          }).catch(() => {});

          DB.fetchSalesReturns(sId).then(returns => {
            if (returns && returns.length > 0) {
              setSalesReturns(returns);
            } else {
              setSalesReturns([]);
            }
          }).catch(() => { setSalesReturns([]); });

          DB.fetchPromoCodes(sId).then(pcs => {
            if (pcs && pcs.length > 0) {
              setPromoCodes(pcs);
            }
          }).catch(() => {});

          DB.fetchPromoCodeUsages(sId).then(usages => {
            if (usages && usages.length > 0) {
              setPromoCodeUsages(usages);
            }
          }).catch(() => {});

          if (user?.role === 'owner') {
            loadedSectionsRef.current.add('owner_portal');
            DB.loadSectionData('owner_portal', sId).then(data => {
              applySectionData('owner_portal', data);
            }).catch(() => {});
          }

          if (user?.role === 'barber' || isBarberRoute || user?.screens?.includes('barber_portal')) {
            loadedSectionsRef.current.add('barber_portal');
            loadedSectionsRef.current.add('bookings');
            DB.loadSectionData('barber_portal', sId).then(data => {
              applySectionData('barber_portal', data);
            }).catch(() => {});
          }

          // Check active shift
          DB.getActiveWorkShift(sId, branchIdToUse).then(activeShift => {
            applyActiveWorkShift(activeShift, branchIdToUse);
          }).catch(() => {});
        }

        // Test Cloud Connection
        SupabaseService.testConnection().then(res => setIsCloudConnected(res.success));
      } catch (err) {
        console.error('Error during initial startup:', err);
      }
    };

    initializeApp();
  }, []);

  // ── Hardware License & Anti-Tamper System Initial Check & Real-time Stream (Offline mode only) ────
  useEffect(() => {
    const isOnlineSaaS = Boolean(settings.salonId || isCloudConnected);
    const isLocalHost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || Boolean(localStorage.getItem('smartcut_api_url')));

    // In online SaaS mode or on public cloud domains (smartcut.besmartapps.com),
    // subscriptions are managed strictly via Supabase / subscriptionService.
    if (isOnlineSaaS || !isLocalHost) {
      return;
    }

    const fetchLicenseInfo = async () => {
      try {
        const res = await fetch('/api/server-info');
        const cType = res.headers.get('content-type') || '';
        if (res.ok && cType.includes('application/json')) {
          const data = await res.json();
          if (data && data.license) {
            setLicenseInfo(data.license);
            if (!data.license.isLicensed) {
              localStorage.setItem('smartcut_license_readonly', 'true');
              setShowLicenseModal(true);
            } else if (data.license.isLicensed && data.license.status === 'active') {
              localStorage.setItem('smartcut_license_readonly', 'false');
              setShowLicenseModal(false);
            }
          }
        }
      } catch (err) {
        // Silently ignore if offline server info is unavailable
      }
    };

    fetchLicenseInfo();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/license/stream');
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'license_updated' && payload.license) {
            setLicenseInfo(payload.license);
            if (!payload.license.isLicensed) {
              localStorage.setItem('smartcut_license_readonly', 'true');
              setShowLicenseModal(true);
            } else if (payload.license.isLicensed && payload.license.status === 'active') {
              localStorage.setItem('smartcut_license_readonly', 'false');
              setShowLicenseModal(false);
            }
          }
        } catch {}
      };
      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [settings.salonId, isCloudConnected]);

  // ── Real-Time Sync Subscriptions across LAN (Sub-50ms Instant Sync) ──────────
  useEffect(() => {
    const sId = settings.salonId;
    const bId = activeBranchId;
    if (!sId) return;

    // 1. Sync Services immediately
    const unsubServices = RealtimeSync.subscribe(['services'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) setServices(prev => prev.filter(s => s.id !== delId));
      }
      try {
        const updated = await DB.fetchServices(sId);
        if (updated && Array.isArray(updated)) {
          setServices(updated.map(dbServiceToApp));
        }
      } catch (err) {
        console.warn('[Realtime] Services sync error:', err);
      }
    });

    // 2. Sync Categories immediately
    const unsubCategories = RealtimeSync.subscribe(['categories'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) setCategories(prev => prev.filter(c => c.id !== delId));
      }
      try {
        const updated = await DB.fetchCategories(sId);
        if (updated && Array.isArray(updated) && updated.length > 0) {
          setCategories(updated);
        }
      } catch (err) {
        console.warn('[Realtime] Categories sync error:', err);
      }
    });

    // 3. Sync Invoices & Transactions & Treasuries immediately
    const unsubInvoices = RealtimeSync.subscribe(['invoices', 'transactions'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) {
          if (event.table === 'invoices') setInvoices(prev => prev.filter(i => i.id !== delId));
          if (event.table === 'transactions') setTransactions(prev => prev.filter(t => t.id !== delId));
        }
      }
      try {
        const [dbInvs, dbTrxs] = await Promise.all([
          DB.fetchAll<any>('invoices', undefined, sId),
          DB.fetchAll<any>('transactions', undefined, sId)
        ]);

        if (dbInvs && Array.isArray(dbInvs)) {
          setInvoices(dbInvs.map(dbInvoiceToApp));
        }

        if (dbTrxs && Array.isArray(dbTrxs)) {
          setTransactions(dbTrxs.map((t: any) => ({
            ...t,
            expenseCategory: t.expenseCategory || '',
            createdBy: t.createdBy || '',
            userId: t.userId || '',
            userName: t.userName || '',
            shiftDate: t.shiftDate || ''
          })));
        }
      } catch (err) {
        console.warn('[Realtime] Accounting sync error:', err);
      }
    });

    // 4. Sync Shifts immediately
    const unsubShifts = RealtimeSync.subscribe(['work_shifts'], async () => {
      if (!bId) return;
      try {
        const activeShift = await DB.getActiveWorkShift(sId, bId);
        applyActiveWorkShift(activeShift, bId);
      } catch (err) {
        console.warn('[Realtime] Shifts sync error:', err);
      }
    });

    // 5. Sync Bookings immediately
    const unsubBookings = RealtimeSync.subscribe(['bookings'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) setBookings(prev => prev.filter(b => b.id !== delId));
      }
      try {
        const dbBookings = await DB.fetchAll<any>('bookings', undefined, sId);
        if (dbBookings && Array.isArray(dbBookings)) {
          setBookings(dbBookings.map(dbBookingToApp));
        }
      } catch (err) {
        console.warn('[Realtime] Bookings sync error:', err);
      }
    });

    // 6. Sync Products immediately
    const unsubProducts = RealtimeSync.subscribe(['products'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) setProducts(prev => prev.filter(p => p.id !== delId));
      }
      try {
        const dbProds = await DB.fetchProducts(sId);
        if (dbProds && Array.isArray(dbProds)) {
          setProducts(dbProds.map(dbProductToApp));
        }
      } catch (err) {
        console.warn('[Realtime] Products sync error:', err);
      }
    });

    // 7. Sync Employees immediately
    const unsubEmployees = RealtimeSync.subscribe(['employees'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) setEmployees(prev => prev.filter(e => e.id !== delId));
      }
      try {
        const dbEmps = await DB.fetchEmployees(sId);
        if (dbEmps && Array.isArray(dbEmps)) {
          setEmployees(dbEmps.map(dbEmployeeToApp));
        }
      } catch (err) {
        console.warn('[Realtime] Employees sync error:', err);
      }
    });

    // 8. Sync Clients immediately
    const unsubClients = RealtimeSync.subscribe(['clients'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) setClients(prev => prev.filter(c => c.id !== delId));
      }
      try {
        const dbClients = await DB.fetchAll<any>('clients', undefined, sId);
        if (dbClients && Array.isArray(dbClients)) {
          setClients(dbClients.map(dbClientToApp));
        }
      } catch (err) {
        console.warn('[Realtime] Clients sync error:', err);
      }
    });

    // 9. Sync Promo Codes and Usages immediately across LAN / devices
    const unsubPromoCodes = RealtimeSync.subscribe(['promo_codes', 'promo_code_usages'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) {
          if (event.table === 'promo_codes') setPromoCodes(prev => prev.filter(p => p.id !== delId));
          if (event.table === 'promo_code_usages') setPromoCodeUsages(prev => prev.filter(u => u.id !== delId));
        }
      }
      try {
        const [pcs, usages] = await Promise.all([
          DB.fetchPromoCodes(sId),
          DB.fetchPromoCodeUsages(sId)
        ]);
        if (pcs && Array.isArray(pcs)) setPromoCodes(pcs);
        if (usages && Array.isArray(usages)) setPromoCodeUsages(usages);
      } catch (err) {
        console.warn('[Realtime] Promo codes sync error:', err);
      }
    });

    // 10. Sync Partners & Partner Transactions immediately
    const unsubPartners = RealtimeSync.subscribe(['partners', 'partner_transactions', 'partner_drawings'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) {
          if (event.table === 'partners') setPartners(prev => prev.filter(p => p.id !== delId));
          if (event.table === 'partner_transactions') setPartnerTransactions(prev => prev.filter(pt => pt.id !== delId));
        }
      }
      try {
        const [dbParts, dbTrxs] = await Promise.all([
          DB.fetchAll<any>('partners', undefined, sId),
          DB.fetchAll<any>('partner_transactions', undefined, sId)
        ]);
        if (dbParts && Array.isArray(dbParts)) setPartners(dbParts);
        if (dbTrxs && Array.isArray(dbTrxs)) setPartnerTransactions(dbTrxs);
      } catch (err) {
        console.warn('[Realtime] Partners sync error:', err);
      }
    });

    // 11. Sync Suppliers, Purchase Invoices, and Supplier Payments immediately
    const unsubPurchases = RealtimeSync.subscribe(['suppliers', 'purchase_invoices', 'supplier_payments'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) {
          if (event.table === 'suppliers') setSuppliers(prev => prev.filter(s => s.id !== delId));
          if (event.table === 'purchase_invoices') setPurchaseInvoices(prev => prev.filter(p => p.id !== delId));
          if (event.table === 'supplier_payments') setSupplierPayments(prev => prev.filter(sp => sp.id !== delId));
        }
      }
      try {
        const [dbSups, dbPurchases, dbPayments] = await Promise.all([
          DB.fetchAll<any>('suppliers', undefined, sId),
          DB.fetchAll<any>('purchase_invoices', undefined, sId),
          DB.fetchAll<any>('supplier_payments', undefined, sId)
        ]);
        if (dbSups && Array.isArray(dbSups)) setSuppliers(dbSups);
        if (dbPurchases && Array.isArray(dbPurchases)) setPurchaseInvoices(dbPurchases);
        if (dbPayments && Array.isArray(dbPayments)) setSupplierPayments(dbPayments);
      } catch (err) {
        console.warn('[Realtime] Purchases sync error:', err);
      }
    });

    // 12. Sync Inventory Counts & Item Movements immediately
    const unsubInventory = RealtimeSync.subscribe(['inventory_counts', 'item_movements'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) {
          if (event.table === 'inventory_counts') setInventoryCounts(prev => prev.filter(c => c.id !== delId));
          if (event.table === 'item_movements') setItemMovements(prev => prev.filter(m => m.id !== delId));
        }
      }
      try {
        const [dbCounts, dbMoves] = await Promise.all([
          DB.fetchAll<any>('inventory_counts', undefined, sId),
          DB.fetchAll<any>('item_movements', undefined, sId)
        ]);
        if (dbCounts && Array.isArray(dbCounts)) setInventoryCounts(dbCounts);
        if (dbMoves && Array.isArray(dbMoves)) setItemMovements(dbMoves);
      } catch (err) {
        console.warn('[Realtime] Inventory sync error:', err);
      }
    });

    // 13. Sync Tips, Custodies, and Fingerprint Logs immediately
    const unsubTipsAndCustodies = RealtimeSync.subscribe(['tips', 'employee_custodies', 'fingerprint_logs'], async (event) => {
      if (event?.action === 'delete') {
        const delId = event.id || event.filters?.id || event.data?.id;
        if (delId) {
          if (event.table === 'tips') setTips(prev => prev.filter(t => t.id !== delId));
          if (event.table === 'employee_custodies') setCustodies(prev => prev.filter(c => c.id !== delId));
          if (event.table === 'fingerprint_logs') setFingerprintLogs(prev => prev.filter(f => f.id !== delId));
        }
      }
      try {
        const [dbTips, dbCustodies, dbLogs] = await Promise.all([
          DB.fetchAll<any>('tips', undefined, sId),
          DB.fetchAll<any>('employee_custodies', undefined, sId),
          DB.fetchAll<any>('fingerprint_logs', undefined, sId)
        ]);
        if (dbTips && Array.isArray(dbTips)) setTips(dbTips);
        if (dbCustodies && Array.isArray(dbCustodies)) setCustodies(dbCustodies);
        if (dbLogs && Array.isArray(dbLogs)) setFingerprintLogs(dbLogs);
      } catch (err) {
        console.warn('[Realtime] Tips & Custodies sync error:', err);
      }
    });

    // 15. Reactive Turso Cloud Sync Complete Listener (Phase 4.4 Distributed UX)
    // When cloud sync finishes, automatically refetch online bookings, clients, invoices & all active entities
    const unsubCloudSync = RealtimeSync.onCloudSyncComplete(async (payload) => {
      console.log('[Cloud-Sync-Complete] Auto-refreshing bookings and distributed state:', payload);
      setIsTursoConnected(true);
      setIsCloudConnected(true);
      try {
        const [updatedBookings, updatedClients, updatedInvoices, updatedTrxs] = await Promise.all([
          DB.fetchBookings(sId, bId),
          DB.fetchClients(sId),
          DB.fetchInvoices(sId, bId),
          DB.fetchTransactions(sId, bId)
        ]);

        if (updatedBookings && Array.isArray(updatedBookings)) {
          setBookings(updatedBookings.map(dbBookingToApp));
        }
        if (updatedClients && Array.isArray(updatedClients)) {
          setClients(updatedClients.map(dbClientToApp));
        }
        if (updatedInvoices && Array.isArray(updatedInvoices)) {
          setInvoices(updatedInvoices.map(dbInvoiceToApp));
        }
        if (updatedTrxs && Array.isArray(updatedTrxs)) {
          setTransactions(updatedTrxs.map((t: any) => ({
            ...t,
            date: t.date || t.created_at || t.createdAt || t.shift_date || t.shiftDate || new Date().toISOString(),
            expenseCategory: t.expenseCategory || '', createdBy: t.createdBy || '',
            userId: t.userId || '', userName: t.userName || '', shiftDate: t.shiftDate || '',
            invoiceId: t.invoiceId || t.invoice_id || (typeof t.description === 'string' ? t.description.match(/INV-[A-Z0-9]+/)?.[0] : undefined),
            invoice_id: t.invoice_id || t.invoiceId || (typeof t.description === 'string' ? t.description.match(/INV-[A-Z0-9]+/)?.[0] : undefined)
          })));
        }
      } catch (cloudErr) {
        console.warn('[Cloud-Sync] Refetch notice:', cloudErr);
      }
    });

    // BroadcastChannel for instant local cross-tab / cross-window promo updates
    let promoBc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        promoBc = new BroadcastChannel(`smartcut_promos_${sId}`);
        promoBc.onmessage = async (ev) => {
          if (ev.data && (ev.data.type === 'PROMO_UPDATED' || ev.data.type === 'PROMO_USAGE_UPDATED')) {
            const [pcs, usages] = await Promise.all([
              DB.fetchPromoCodes(sId),
              DB.fetchPromoCodeUsages(sId)
            ]);
            if (pcs && Array.isArray(pcs)) setPromoCodes(pcs);
            if (usages && Array.isArray(usages)) setPromoCodeUsages(usages);
          }
        };
      }
    } catch (e) {}

    return () => {
      unsubServices();
      unsubCategories();
      unsubInvoices();
      unsubShifts();
      unsubBookings();
      unsubProducts();
      unsubEmployees();
      unsubClients();
      unsubPromoCodes();
      unsubPartners();
      unsubPurchases();
      unsubInventory();
      unsubTipsAndCustodies();
      unsubCloudSync();
      if (promoBc) {
        promoBc.close();
      }
    };
  }, [settings.salonId, activeBranchId]);

  // ── Smart HTTP Polling (Fallback sync, Visibility API aware, REST queries) ────
  useEffect(() => {
    const sId = settings.salonId;
    const bId = activeBranchId;
    if (!sId) return;

    let isSubscribed = true;
    let isFetching = false;

    const executePoll = async () => {
      // 5. Visibility API: Pause polling when the browser tab is hidden or inactive
      if (document.hidden || isFetching || !isSubscribed) return;

      try {
        isFetching = true;

        // Poll active shift & operational collections concurrently via REST
        const [
          activeShift,
          polledInvoices,
          polledTransactions,
          polledBookings,
          polledFingerprints,
          polledEmployees,
          polledProducts,
          polledCategories,
          polledServices,
          polledPurchases,
          polledSupplierPayments,
          polledSuppliers
        ] = await Promise.all([
          bId ? DB.getActiveWorkShift(sId, bId) : null,
          DB.fetchAll<any>('invoices', undefined, sId),
          DB.fetchAll<any>('transactions', undefined, sId),
          DB.fetchAll<any>('bookings', undefined, sId),
          DB.fetchAll<any>('fingerprint_logs', undefined, sId),
          DB.fetchEmployees(sId),
          DB.fetchProducts(sId),
          DB.fetchCategories(sId),
          DB.fetchServices(sId),
          DB.fetchPurchaseInvoices(sId),
          DB.fetchSupplierPayments(sId),
          DB.fetchSuppliers(sId)
        ]);

        if (!isSubscribed) return;

        // Sync Services
        if (polledServices && Array.isArray(polledServices)) {
          setServices(polledServices.map(dbServiceToApp));
        }

        // Sync Employees
        if (polledEmployees && Array.isArray(polledEmployees) && polledEmployees.length > 0) {
          setEmployees(polledEmployees.map(dbEmployeeToApp));
        }

        // Sync Products
        if (polledProducts && Array.isArray(polledProducts)) {
          setProducts(polledProducts.map(dbProductToApp));
        }

        // Sync Categories
        if (polledCategories && Array.isArray(polledCategories) && polledCategories.length > 0) {
          setCategories(polledCategories);
        }

        // Sync Purchase Invoices
        if (polledPurchases && Array.isArray(polledPurchases)) {
          setPurchaseInvoices(polledPurchases);
        }

        // Sync Supplier Payments
        if (polledSupplierPayments && Array.isArray(polledSupplierPayments)) {
          setSupplierPayments(polledSupplierPayments);
        }

        // Sync Suppliers
        if (polledSuppliers && Array.isArray(polledSuppliers) && polledSuppliers.length > 0) {
          setSuppliers(polledSuppliers);
        }

        // Sync Fingerprint Logs
        if (polledFingerprints && Array.isArray(polledFingerprints)) {
          setFingerprintLogs(polledFingerprints);
        }

        // Sync Shift State
        if (sId) {
          applyActiveWorkShift(activeShift, bId);
        }

        // Sync Invoices
        if (polledInvoices && Array.isArray(polledInvoices)) {
          setInvoices(polledInvoices.map(dbInvoiceToApp));
        }

        // Sync Transactions
        if (polledTransactions && Array.isArray(polledTransactions)) {
          setTransactions(polledTransactions.map((t: any) => ({
            ...t,
            expenseCategory: t.expenseCategory || '',
            createdBy: t.createdBy || '',
            userId: t.userId || '',
            userName: t.userName || '',
            shiftDate: t.shiftDate || ''
          })));
        }

        // Sync Bookings
        if (polledBookings && Array.isArray(polledBookings)) {
          setBookings(polledBookings.map(dbBookingToApp));
        }
      } catch (err) {
        console.warn('[Smart Polling] Background poll error:', err);
      } finally {
        isFetching = false;
      }
    };

    // Immediate poll execution on mount & branch/salon change
    executePoll();

    // 3. Interval Configuration: Fallback polling interval set to 20s (Instant sync handled via SSE)
    const intervalId = setInterval(executePoll, 20000);

    // 5. Visibility API: Pause polling when hidden, immediately poll when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        executePoll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Safe Cleanup: Strictly clear interval & event listener on unmount
    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.salonId, activeBranchId]);

  // ── Reception Auto-Print Station Listener for Tablet Kiosk Slips ──────────────
  useEffect(() => {
    const isStation = settings.isReceptionPrinterStation || (typeof window !== 'undefined' && localStorage.getItem('smartcut_is_printer_station') === 'true');
    if (!isStation) return;

    // 1. BroadcastChannel listener (بدون WebSockets)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('smartcut_kiosk_print_jobs');
      bc.onmessage = (e) => {
        const ticketData = e.data?.payload?.data;
        if (ticketData) {
          console.log('[Reception Printer Station] Auto-printing kiosk ticket #', ticketData.queueNumber);
          printQueueSlipDirect(ticketData);
        }
      };
    }

    // 2. Storage event listener (للنوافذ المشتركة)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'smartcut_last_print_job' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const ticketData = parsed?.data;
          if (ticketData) {
            console.log('[Reception Printer Station] Auto-printing kiosk ticket from storage #', ticketData.queueNumber);
            printQueueSlipDirect(ticketData);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) {
        try { bc.close(); } catch {}
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [settings.isReceptionPrinterStation]);

  // ── 2. Lazy Loading Tab Data on Demand ──────────────────────────────────────────
  useEffect(() => {
    const sId = settings.salonId;
    if (!sId) return;

    // Determine what tab section is needed
    let sectionToLoad = '';
    if (activeTab === 'invoices') sectionToLoad = 'invoices';
    else if (activeTab === 'bookings' || activeTab === 'barber_portal' || activeTab === 'barber') sectionToLoad = 'barber_portal';
    else if (activeTab === 'clients' || activeTab === 'complaints') sectionToLoad = 'clients';
    else if (activeTab === 'treasury' || activeTab === 'expenses') sectionToLoad = 'transactions';
    else if (activeTab === 'dashboard' || activeTab === 'reports' || activeTab === 'closing-receipt') sectionToLoad = 'reports';
    else if (activeTab === 'employees' || activeTab === 'hr' || activeTab === 'permissions' || activeTab === 'employee-analytics') sectionToLoad = 'hr';
    else if (activeTab === 'warehouse' || activeTab === 'suppliers' || activeTab === 'purchases' || activeTab === 'inventory') sectionToLoad = 'warehouse';
    else if (activeTab === 'partners') sectionToLoad = 'partners';
    else if (activeTab === 'promotions' || activeTab === 'promo-codes' || activeTab === 'promo_codes') sectionToLoad = 'promotions';
    else if (activeTab === 'tips') sectionToLoad = 'tips';
    else if (activeTab === 'fingerprint-logs' || activeTab === 'fingerprint_logs') sectionToLoad = 'fingerprint';
    else if (activeTab === 'owner_portal' || activeTab === 'owner') sectionToLoad = 'owner_portal';

    if (sectionToLoad && !loadedSectionsRef.current.has(sectionToLoad)) {
      loadedSectionsRef.current.add(sectionToLoad);
      DB.loadSectionData(sectionToLoad, sId).then(data => {
        applySectionData(sectionToLoad, data);
      }).catch(err => console.warn(`Error lazy-loading section [${sectionToLoad}]:`, err));
    }
  }, [activeTab, settings.salonId, applySectionData]);

  // ── 3. Switch Salon Handler ───────────────────────────────────────────────────
  const handleSwitchSalon = async (targetSalonId: string) => {
    // CRITICAL MULTI-TENANCY SECURITY: Only platform programmer can switch salons
    if (currentUser?.role !== 'programmer') {
      console.error('[Security Violation] Unauthorized attempt to switch salon blocked.');
      return;
    }
    const s = allSalons.find(item => item.id === targetSalonId) || SubscriptionService.getSalons().find(item => item.id === targetSalonId);
    if (!s) return;
    
    setIsDbLoading(true);
    loadedSectionsRef.current.clear();
    try {
      localStorage.setItem('smartcut_active_salon_id', s.id);
      
      const [dbSettings, dbBranches, essentialData] = await Promise.all([
        DB.fetchSettings(s.id),
        DB.fetchBranches(s.id),
        DB.loadEssentialData(s.id)
      ]);
      
      const sBranches = (dbBranches && dbBranches.length > 0) ? dbBranches : SubscriptionService.getBranches(s.id);
      const finalBranches = sBranches.length > 0 ? sBranches : [
        { id: 'b-main', salonId: s.id, name: `الفرع الرئيسي (${s.name})`, code: 'B01', isMain: true, phone: s.phone, address: s.country, isActive: true, status: 'active' }
      ];
      setBranches(finalBranches);
      setActiveBranchId(finalBranches[0].id);

      DB.getActiveWorkShift(s.id, finalBranches[0].id).then(activeShift => {
        applyActiveWorkShift(activeShift, finalBranches[0].id);
      }).catch(() => {});

      const updatedSettings: AppSettings = {
        ...settings,
        ...(dbSettings || {}),
        salonId: s.id,
        salonCode: s.code,
        salonName: dbSettings?.salonName || s.name,
        country: s.country,
        currency: s.currency,
        phone: s.phone,
        evolutionInstanceName: s.evolutionInstanceName
      };
      setSettings(updatedSettings);
      try { localStorage.setItem('smartcut_app_settings', JSON.stringify(updatedSettings)); } catch (e) {}

      setSubscription({
        id: s.id,
        salonId: s.id,
        salonCode: s.code,
        organizationName: s.name,
        ownerEmail: s.email,
        phone: s.phone,
        country: s.country,
        plan: s.subscriptionPlan || 'pro',
        status: s.subscriptionStatus || 'trial',
        isActive: s.isActive !== false,
        startDate: s.subscriptionStartDate,
        endDate: s.subscriptionEndDate,
        maxBranches: s.maxBranches || 3,
        maxUsers: s.maxUsers || 10,
        trialDays: s.trialDays || 7
      });

      if (currentUser) {
        const updatedUser = { ...currentUser, salonId: s.id, salonCode: s.code };
        setCurrentUser(updatedUser);
        try { localStorage.setItem('smartcut_current_user', JSON.stringify(updatedUser)); } catch (e) {}
      }

      if (essentialData) {
        const validCats = essentialData.categories || [];
        setCategories(validCats.length ? validCats : [{ id: 'all', name: 'الكل' }]);
        setServices(essentialData.services ? essentialData.services.map(dbServiceToApp) : []);
        setEmployees(essentialData.employees ? essentialData.employees.map(dbEmployeeToApp) : []);
        setClients(essentialData.clients ? essentialData.clients.map(dbClientToApp) : []);
        setProducts(essentialData.products ? essentialData.products.map(dbProductToApp) : []);
        if (essentialData.suppliers) setSuppliers(essentialData.suppliers);
        if (essentialData.purchaseInvoices) setPurchaseInvoices(essentialData.purchaseInvoices);
        if (essentialData.supplierPayments) setSupplierPayments(essentialData.supplierPayments);
      }

      loadedSectionsRef.current.add('pos');
      loadedSectionsRef.current.add('services');
      loadedSectionsRef.current.add('products');

      setIsCloudConnected(true);
    } catch (err) {
      console.error('Error switching salon:', err);
    } finally {
      setIsDbLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    if (confirm('هل ترغب في تسجيل الخروج من النظام؟')) {
      AuthService.logout();
      setCurrentUser(null);
    }
  };

  const currentSalonId = settings.salonId || (branches[0]?.salonId) || currentUser?.salonId || '11111111-1111-4111-8111-111111111111';


  // 3. Autonomous Branch Isolation Filter & Helpers
  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === activeBranchId) || branches.find(b => b.isMain) || branches[0] || null;
  }, [branches, activeBranchId]);

  const isItemInBranch = (itemBranchId?: string, itemBranchCode?: string) => {
    if (branches.length <= 1) return true;
    const curBranch = activeBranch || branches.find(b => b.id === activeBranchId) || branches[0];
    const isCurMain = Boolean(curBranch?.isMain || curBranch?.id === branches[0]?.id);

    const bId = (itemBranchId || '').trim();
    const bCode = (itemBranchCode || '').trim();

    if (bId) {
      if (curBranch?.id && bId === curBranch.id) return true;
      if (curBranch?.code && bId.toLowerCase() === curBranch.code.toLowerCase()) return true;
      if (curBranch?.name && bId.toLowerCase() === curBranch.name.toLowerCase()) return true;
      return false;
    }
    if (bCode && curBranch?.code) {
      if (bCode.toLowerCase() === curBranch.code.toLowerCase()) return true;
      if (curBranch?.name && bCode.toLowerCase() === curBranch.name.toLowerCase()) return true;
      return false;
    }

    return isCurMain;
  };

  // Salon-Scoped Entities (Direct from MSSQL / Supabase — Guaranteed 100% visible across all screens)
  const salonClients = useMemo(() => {
    return clients.filter(c => !c.salonId || !currentSalonId || c.salonId === currentSalonId || (c as any).salon_id === currentSalonId);
  }, [clients, currentSalonId]);

  const salonCategories = useMemo(() => {
    return categories.filter(c => !c.salonId || !currentSalonId || c.salonId === currentSalonId || (c as any).salon_id === currentSalonId || c.id === 'all');
  }, [categories, currentSalonId]);

  const salonServices = useMemo(() => {
    return services.filter(s => !s.salonId || !currentSalonId || s.salonId === currentSalonId || (s as any).salon_id === currentSalonId);
  }, [services, currentSalonId]);

  const salonEmployees = useMemo(() => {
    return employees.filter(e => !e.salonId || !currentSalonId || e.salonId === currentSalonId || (e as any).salon_id === currentSalonId);
  }, [employees, currentSalonId]);

  const salonProducts = useMemo(() => {
    return products.filter(p => !p.salonId || !currentSalonId || p.salonId === currentSalonId || (p as any).salon_id === currentSalonId);
  }, [products, currentSalonId]);

  const salonInvoices = useMemo(() => {
    return invoices.filter(i => !i.salonId || !currentSalonId || i.salonId === currentSalonId || (i as any).salon_id === currentSalonId);
  }, [invoices, currentSalonId]);

  const salonTransactions = useMemo(() => {
    return transactions.filter(t => !(t as any).salonId || !currentSalonId || (t as any).salonId === currentSalonId || (t as any).salon_id === currentSalonId);
  }, [transactions, currentSalonId]);

  const salonBookings = useMemo(() => {
    return bookings.filter(b => !(b as any).salonId || !currentSalonId || (b as any).salonId === currentSalonId || (b as any).salon_id === currentSalonId);
  }, [bookings, currentSalonId]);

  const salonSuppliers = useMemo(() => {
    return suppliers.filter(s => !(s as any).salonId || !currentSalonId || (s as any).salonId === currentSalonId || (s as any).salon_id === currentSalonId);
  }, [suppliers, currentSalonId]);

  const salonPurchaseInvoices = useMemo(() => {
    return purchaseInvoices.filter(p => !(p as any).salonId || !currentSalonId || (p as any).salonId === currentSalonId || (p as any).salon_id === currentSalonId);
  }, [purchaseInvoices, currentSalonId]);

  const salonSupplierPayments = useMemo(() => {
    return supplierPayments.filter(sp => !(sp as any).salonId || !currentSalonId || (sp as any).salonId === currentSalonId || (sp as any).salon_id === currentSalonId);
  }, [supplierPayments, currentSalonId]);

  const salonInventoryCounts = useMemo(() => {
    return inventoryCounts.filter(ic => !(ic as any).salonId || !currentSalonId || (ic as any).salonId === currentSalonId || (ic as any).salon_id === currentSalonId);
  }, [inventoryCounts, currentSalonId]);

  const salonItemMovements = useMemo(() => {
    return itemMovements.filter(im => !(im as any).salonId || !currentSalonId || (im as any).salonId === currentSalonId || (im as any).salon_id === currentSalonId);
  }, [itemMovements, currentSalonId]);

  const salonSalesReturns = useMemo(() => {
    return salesReturns.filter(r => !(r as any).salonId || !currentSalonId || (r as any).salonId === currentSalonId || (r as any).salon_id === currentSalonId);
  }, [salesReturns, currentSalonId]);

  // كيانات الفرع المعزولة قطيعاً (Branch-Scoped Entities) - تمنع تسرب الحسابات والورديات والفواتير بين الفروع
  const branchCategories = salonCategories;
  const branchServices = useMemo(() => {
    if (branches.length <= 1) return salonServices;
    return salonServices.filter(s => !s.branchId || isItemInBranch(s.branchId, (s as any).branchCode));
  }, [salonServices, branches.length, activeBranchId, activeBranch]);
  const branchEmployees = useMemo(() => {
    if (branches.length <= 1) return salonEmployees;
    return salonEmployees.filter(e => isItemInBranch(e.branchId, (e as any).branchCode));
  }, [salonEmployees, branches.length, activeBranchId, activeBranch]);

  const branchProducts = useMemo(() => {
    if (branches.length <= 1) return salonProducts;
    return salonProducts.filter(p => isItemInBranch(p.branchId, p.branchCode));
  }, [salonProducts, branches.length, activeBranchId, activeBranch]);

  const branchInvoices = useMemo(() => {
    if (branches.length <= 1) return salonInvoices;
    return salonInvoices.filter(i => isItemInBranch(i.branchId, i.branchCode));
  }, [salonInvoices, branches.length, activeBranchId, activeBranch]);

  const branchTransactions = useMemo(() => {
    if (branches.length <= 1) return salonTransactions;
    return salonTransactions.filter(t => isItemInBranch((t as any).branchId || (t as any).branch_id, (t as any).branchCode || (t as any).branch_code));
  }, [salonTransactions, branches.length, activeBranchId, activeBranch]);

  const branchBookings = useMemo(() => {
    if (branches.length <= 1) return salonBookings;
    return salonBookings.filter(b => isItemInBranch((b as any).branchId || (b as any).branch_id, (b as any).branchCode || (b as any).branch_code));
  }, [salonBookings, branches.length, activeBranchId, activeBranch]);

  const branchClients = useMemo(() => {
    if (branches.length <= 1) return salonClients;
    return salonClients.filter(c => isClientInBranch(c, activeBranchId, branches));
  }, [salonClients, branches, activeBranchId]);

  const branchFingerprintLogs = useMemo(() => {
    if (branches.length <= 1) return fingerprintLogs;
    const branchEmpIds = new Set(branchEmployees.map(e => e.id));
    return fingerprintLogs.filter(log => {
      if (log.employeeId && branchEmpIds.has(log.employeeId)) return true;
      return isItemInBranch(log.branchId, (log as any).branchCode);
    });
  }, [fingerprintLogs, branchEmployees, branches, activeBranchId, activeBranch]);
  const branchSuppliers = salonSuppliers;
  const branchPurchaseInvoices = useMemo(() => {
    if (branches.length <= 1) return salonPurchaseInvoices;
    return salonPurchaseInvoices.filter(p => isItemInBranch((p as any).branchId || (p as any).branch_id, (p as any).branchCode || (p as any).branch_code));
  }, [salonPurchaseInvoices, branches.length, activeBranchId, activeBranch]);

  const branchSupplierPayments = useMemo(() => {
    if (branches.length <= 1) return salonSupplierPayments;
    return salonSupplierPayments.filter(sp => isItemInBranch((sp as any).branchId || (sp as any).branch_id, (sp as any).branchCode || (sp as any).branch_code));
  }, [salonSupplierPayments, branches.length, activeBranchId, activeBranch]);

  const branchInventoryCounts = useMemo(() => {
    if (branches.length <= 1) return salonInventoryCounts;
    return salonInventoryCounts.filter(ic => isItemInBranch((ic as any).branchId || (ic as any).branch_id, (ic as any).branchCode || (ic as any).branch_code));
  }, [salonInventoryCounts, branches.length, activeBranchId, activeBranch]);

  const branchItemMovements = useMemo(() => {
    if (branches.length <= 1) return salonItemMovements;
    return salonItemMovements.filter(im => isItemInBranch((im as any).branchId || (im as any).branch_id, (im as any).branchCode || (im as any).branch_code));
  }, [salonItemMovements, branches.length, activeBranchId, activeBranch]);

  const branchSalesReturns = useMemo(() => {
    if (branches.length <= 1) return salonSalesReturns;
    return salonSalesReturns.filter(r => isItemInBranch((r as any).branchId || (r as any).branch_id, (r as any).branchCode || (r as any).branch_code));
  }, [salonSalesReturns, branches.length, activeBranchId, activeBranch]);

  const handleSetSalesReturns = (newReturns: SalesReturn[] | ((prev: SalesReturn[]) => SalesReturn[])) => {
    setSalesReturns(newReturns);
  };

  // Shift status and opener details helper
  const shiftDisplayInfo = useMemo(() => {
    if (!shiftData?.isOpen) return null;
    const date = shiftData.date || (shiftData as any)?.shiftDate || (shiftData as any)?.shift_date || getLocalTodayDateString();
    const code = (shiftData as any)?.shiftCode || (shiftData as any)?.shift_code || (`SH-${(date || '').replace(/-/g, '')}-01`);
    
    const userId = (shiftData as any)?.openedByUserId || (shiftData as any)?.opened_by_user_id;
    let userName = (shiftData as any)?.openedByName || (shiftData as any)?.openedByUserName || (shiftData as any)?.opened_by_name || (shiftData as any)?.opened_by_user_name;
    
    if (!userName && userId) {
      const fromAuth = AuthService.getUsers().find(u => u.id === userId);
      if (fromAuth?.name) {
        userName = fromAuth.name;
      } else {
        const fromEmp = employees.find(e => e.id === userId || (e as any).userId === userId);
        if (fromEmp?.name) userName = fromEmp.name;
      }
    }
    
    if (!userName) {
      userName = currentUser?.name || 'الكاشير';
    }

    return {
      date,
      code,
      userName
    };
  }, [shiftData, currentUser, employees]);

  // ============================================================
  // Subscription & Read-Only Protection Rules
  // ============================================================
  const nowMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const endDateTime = useMemo(() => {
    return subscription.endDate ? new Date(subscription.endDate) : new Date(Date.now() + 7 * 86400000);
  }, [subscription.endDate]);

  const isBranchPending = false;
  const isSalonSuspended = false;

  // ── Online Subscription vs Offline Hardware License Rules ────────────────
  const isOnlineSaaSMode = Boolean(settings.salonId || subscription.salonId || isCloudConnected);

  const onlineSubscriptionDaysLeft = useMemo(() => {
    const endStr = subscription.endDate || settings.subscriptionEndDate;
    if (!endStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endStr);
    end.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 3600 * 24));
  }, [subscription.endDate, settings.subscriptionEndDate]);

  const isOnlineSubscriptionExpired = useMemo(() => {
    if (!isOnlineSaaSMode) return false;
    const endStr = subscription.endDate || settings.subscriptionEndDate;
    if (!endStr) return false;
    const subStatus = subscription.status || settings.subscriptionStatus;
    if (subscription.isActive === false || settings.isSalonActive === false) return true;
    if (subStatus === 'expired' || subStatus === 'suspended') return true;
    if (onlineSubscriptionDaysLeft !== null && onlineSubscriptionDaysLeft <= 0) return true;
    return false;
  }, [isOnlineSaaSMode, subscription, settings, onlineSubscriptionDaysLeft]);

  const isOnlineExpiringSoon = useMemo(() => {
    if (!isOnlineSaaSMode || isOnlineSubscriptionExpired) return false;
    const subStatus = subscription.status || settings.subscriptionStatus;
    if (subscription.isActive === false || settings.isSalonActive === false) return false;
    if (subStatus === 'expired' || subStatus === 'suspended') return false;
    // Exactly 4 days before expiration as requested by the user
    return Boolean(onlineSubscriptionDaysLeft !== null && onlineSubscriptionDaysLeft <= 4 && onlineSubscriptionDaysLeft > 0);
  }, [isOnlineSaaSMode, isOnlineSubscriptionExpired, subscription, settings, onlineSubscriptionDaysLeft]);

  // ── Software License & Strict Read-Only Rules ───────────────────────────
  const isSubscriptionBlocked = useMemo(() => {
    if (isOnlineSaaSMode) {
      return isOnlineSubscriptionExpired;
    }
    if (!licenseInfo) return false;
    return Boolean(
      !licenseInfo.isLicensed ||
      licenseInfo.status === 'expired' ||
      licenseInfo.status === 'tampered' ||
      (licenseInfo.daysLeft !== null && licenseInfo.daysLeft !== undefined && licenseInfo.daysLeft <= 0) ||
      (licenseInfo.runsLeft !== null && licenseInfo.runsLeft !== undefined && licenseInfo.runsLeft <= 0)
    );
  }, [isOnlineSaaSMode, isOnlineSubscriptionExpired, licenseInfo]);

  const isExpiringSoon = useMemo(() => {
    if (isSubscriptionBlocked) return false;
    if (isOnlineSaaSMode) {
      return isOnlineExpiringSoon;
    }
    return Boolean(
      licenseInfo &&
      licenseInfo.isLicensed &&
      licenseInfo.status === 'active' &&
      licenseInfo.daysLeft !== null &&
      licenseInfo.daysLeft !== undefined &&
      licenseInfo.daysLeft <= 4 &&
      licenseInfo.daysLeft > 0
    );
  }, [isSubscriptionBlocked, isOnlineSaaSMode, isOnlineExpiringSoon, licenseInfo]);

  // Sync with localStorage for OfflineQueryBuilder and global guards
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartcut_license_readonly', isSubscriptionBlocked ? 'true' : 'false');
    }
  }, [isSubscriptionBlocked]);

  // Listen to background mutation blocked events
  useEffect(() => {
    const handleBlocked = (e: any) => {
      if (!isOnlineSaaSMode) {
        setShowLicenseModal(true);
      }
      alert(e.detail?.message || 'تم تحويل البرنامج إلى وضع القراءة فقط لانتهاء الترخيص / اشتراك الصالون. يُمنع تسجيل أو تعديل أي بيانات.');
    };
    window.addEventListener('smartcut_license_blocked', handleBlocked);
    return () => window.removeEventListener('smartcut_license_blocked', handleBlocked);
  }, [isOnlineSaaSMode]);

  const checkReadOnlyAndWarn = () => {
    if (isSubscriptionBlocked) {
      const salonName = subscription.organizationName || settings.salonName || 'الصالون';
      const endDate = subscription.endDate || settings.subscriptionEndDate || '';
      alert(`تم تحويل البرنامج إلى وضع القراءة فقط: انتهت صلاحية اشتراك صالون (${salonName}) بتاريخ ${endDate}.\nيُمنع نهائياً أي إضافة أو تعديل أو حفظ بيانات جديدة لحين تجديد الاشتراك والتفعيل.`);
      if (!isOnlineSaaSMode) {
        setShowLicenseModal(true);
      }
      return true;
    }
    return false;
  };

  // Salon-Scoped State Setters with Real-time Supabase Persistence
  const handleSetEmployees = (updater: Employee[] | ((prev: Employee[]) => Employee[])) => {
    if (checkReadOnlyAndWarn()) return;
    setEmployees(prev => {
      const currentSalonEmps = prev.filter(e => !e.salonId || e.salonId === currentSalonId || (e as any).salon_id === currentSalonId);
      let nextSalonEmps: Employee[];
      if (typeof updater === 'function') {
        nextSalonEmps = updater(currentSalonEmps);
      } else {
        const updaterMap = new Map((updater || []).map(e => [e.id, e]));
        nextSalonEmps = currentSalonEmps.map(e => updaterMap.has(e.id) ? updaterMap.get(e.id)! : e);
        (updater || []).forEach(e => {
          if (!currentSalonEmps.some(existing => existing.id === e.id)) {
            nextSalonEmps.push(e);
          }
        });
      }

      const tagged = nextSalonEmps.map(e => {
        // تصحيح أي مسير رواتب تم حفظه كسلفة بالخطأ
        const cleanedRecords = (e.financialRecords || []).map((r: any) => {
          if (r.type === 'advance' && (r.id?.startsWith('FIN-SAL-') || r.note?.includes('مسير رواتب') || r.note?.includes('تم استلام صافي الراتب'))) {
            return { ...r, type: 'salary' };
          }
          return r;
        });
        return { 
          ...e, 
          financialRecords: cleanedRecords,
          salonId: e.salonId || currentSalonId, 
          branchId: e.branchId || activeBranch?.id || activeBranchId,
          branchCode: (e as any).branchCode || activeBranch?.code || 'BR-01'
        };
      });
      const otherEmps = prev.filter(e => e.salonId && e.salonId !== currentSalonId && (e as any).salon_id !== currentSalonId);
      const res = [...otherEmps, ...tagged];
      try { localStorage.setItem('smartcut_employees', JSON.stringify(res)); } catch (err) {}
      DB.saveEmployees(tagged, currentSalonId);
      return res;
    });
  };

  const handleSetServices = (updater: ServiceItem[] | ((prev: ServiceItem[]) => ServiceItem[])) => {
    if (checkReadOnlyAndWarn()) return;
    setServices(prev => {
      const currentSalonServices = prev.filter(s => !s.salonId || s.salonId === currentSalonId || (s as any).salon_id === currentSalonId);
      const nextSalonServices = typeof updater === 'function' ? updater(currentSalonServices) : updater;
      const tagged = nextSalonServices.map(s => ({ 
        ...s, 
        salonId: s.salonId || currentSalonId, 
        branchId: s.branchId || activeBranch?.id || activeBranchId,
        branchCode: (s as any).branchCode || activeBranch?.code || 'BR-01'
      }));
      const other = prev.filter(s => s.salonId && s.salonId !== currentSalonId && (s as any).salon_id !== currentSalonId);
      const res = [...other, ...tagged];
      DB.saveServices(tagged);
      return res;
    });
  };

  const handleSetCategories = (updater: Category[] | ((prev: Category[]) => Category[])) => {
    if (checkReadOnlyAndWarn()) return;
    setCategories(prev => {
      const currentSalonCats = prev.filter(c => !c.salonId || c.salonId === currentSalonId || (c as any).salon_id === currentSalonId);
      const nextSalonCats = typeof updater === 'function' ? updater(currentSalonCats) : updater;
      const tagged = nextSalonCats.map(c => ({ 
        ...c, 
        salonId: c.salonId || currentSalonId, 
        branchId: c.branchId || activeBranch?.id || activeBranchId,
        branchCode: (c as any).branchCode || activeBranch?.code || 'BR-01'
      }));
      const other = prev.filter(c => c.salonId && c.salonId !== currentSalonId && (c as any).salon_id !== currentSalonId);
      const res = [...other, ...tagged];
      DB.saveCategories(tagged);
      return res;
    });
  };

  const handleSetProducts = (updater: Product[] | ((prev: Product[]) => Product[])) => {
    if (checkReadOnlyAndWarn()) return;
    setProducts(prev => {
      const currentSalonProds = prev.filter(p => !p.salonId || p.salonId === currentSalonId || (p as any).salon_id === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonProds) : updater;
      const tagged = next.map(p => ({ ...p, salonId: p.salonId || currentSalonId, branchId: p.branchId || activeBranchId }));
      const other = prev.filter(p => p.salonId && p.salonId !== currentSalonId && (p as any).salon_id !== currentSalonId);
      const res = [...other, ...tagged];
      DB.saveProducts(tagged);
      return res;
    });
  };

  const handleSetInvoices = (updater: Invoice[] | ((prev: Invoice[]) => Invoice[])) => {
    if (checkReadOnlyAndWarn()) return;
    setInvoices(prev => {
      const currentSalonInvs = prev.filter(i => !i.salonId || i.salonId === currentSalonId || (i as any).salon_id === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonInvs) : updater;
      const tagged = next.map(i => ({ ...i, salonId: i.salonId || currentSalonId, branchId: i.branchId || activeBranchId }));
      const other = prev.filter(i => i.salonId && i.salonId !== currentSalonId && (i as any).salon_id !== currentSalonId);
      
      // Save only new or modified invoices instead of re-saving the entire database
      const prevMap = new Map(currentSalonInvs.map(i => [i.id, i]));
      const changed = tagged.filter(i => {
        const old = prevMap.get(i.id);
        if (!old) return true;
        return i.status !== old.status || i.paid !== old.paid || i.remaining !== old.remaining || i.total !== old.total || i.updatedAt !== old.updatedAt || i.settledAt !== old.settledAt;
      });
      changed.forEach(inv => DB.saveInvoice(inv, currentSalonId));

      return [...other, ...tagged];
    });
  };

  const handleSetTransactions = (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
    if (checkReadOnlyAndWarn()) return;
    setTransactions(prev => {
      const currentSalonTrxs = prev.filter(t => !(t as any).salonId || (t as any).salonId === currentSalonId || (t as any).salon_id === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonTrxs) : updater;
      const tagged = next.map(t => ({ ...t, salonId: (t as any).salonId || currentSalonId, branchId: (t as any).branchId || activeBranchId } as any));
      const other = prev.filter(t => (t as any).salonId && (t as any).salonId !== currentSalonId && (t as any).salon_id !== currentSalonId);
      const res = [...other, ...tagged];

      // Save only new or modified transactions instead of re-saving the entire database
      const prevMap = new Map(currentSalonTrxs.map(t => [t.id, t]));
      const changed = tagged.filter(t => {
        const old = prevMap.get(t.id);
        if (!old) return true;
        return t.amount !== old.amount || t.treasury !== old.treasury || t.type !== old.type || t.category !== old.category;
      });

      if (changed.length > 0) {
        DB.saveTransactions(changed, currentSalonId);
      }

      // Delete from DB any transactions removed by updater
      const nextIds = new Set(tagged.map(t => t.id));
      const removedIds = currentSalonTrxs.filter(t => !nextIds.has(t.id)).map(t => t.id);
      if (removedIds.length > 0) {
        DB.deleteTransactionsByIds(removedIds);
      }

      return res;
    });
  };

  const handleSetBookings = (updater: Booking[] | ((prev: Booking[]) => Booking[])) => {
    if (checkReadOnlyAndWarn()) return;
    setBookings(prev => {
      const currentSalonBookings = prev.filter(b => !(b as any).salonId || (b as any).salonId === currentSalonId || (b as any).salon_id === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonBookings) : updater;
      const tagged = next.map(b => ({ ...b, salonId: (b as any).salonId || currentSalonId, branchId: (b as any).branchId || activeBranchId }));
      const other = prev.filter(b => (b as any).salonId && (b as any).salonId !== currentSalonId && (b as any).salon_id !== currentSalonId);
      const res = [...other, ...tagged];
      
      // Save only new or modified bookings to avoid SQLite locking storms & race conditions
      const prevMap = new Map(prev.map(p => [p.id, p]));
      const changedOrNew = tagged.filter(b => {
        const old = prevMap.get(b.id);
        if (!old) return true;
        return old.updatedAt !== b.updatedAt || 
               old.status !== b.status || 
               old.totalAmount !== b.totalAmount || 
               old.time !== b.time || 
               old.date !== b.date || 
               old.clientName !== b.clientName || 
               old.phone !== b.phone ||
               (old.advancePayments?.length !== b.advancePayments?.length) ||
               (old.services?.length !== b.services?.length);
      });
      changedOrNew.forEach(b => DB.saveBooking(b));
      return res;
    });
  };

  const handleSetClients = (updater: Client[] | ((prev: Client[]) => Client[])) => {
    if (checkReadOnlyAndWarn()) return;
    setClients(prev => {
      const currentSalonClients = prev.filter(c => !c.salonId || c.salonId === currentSalonId || (c as any).salon_id === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonClients) : updater;
      const tagged = next.map(c => ({ ...c, salonId: c.salonId || currentSalonId }));
      const otherSalonClients = prev.filter(c => c.salonId && c.salonId !== currentSalonId && (c as any).salon_id !== currentSalonId);
      const res = [...otherSalonClients, ...tagged];
      tagged.forEach(c => DB.saveClient(c));
      return res;
    });
  };

  const handleSetSuppliers = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setSuppliers(prev => {
      const currentSalonSuppliers = prev.filter((s: any) => !(s as any).salonId || (s as any).salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonSuppliers) : updater;
      const tagged = next.map((s: any) => ({ ...s, salonId: s.salonId || currentSalonId, branchId: s.branchId || activeBranchId }));
      const other = prev.filter((s: any) => (s as any).salonId && (s as any).salonId !== currentSalonId);
      const res = [...other, ...tagged];
      tagged.forEach((s: any) => DB.saveSupplier(s));
      return res;
    });
  };

  const handleSetPurchaseInvoices = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setPurchaseInvoices(prev => {
      const currentSalonPurchases = prev.filter((p: any) => !(p as any).salonId || (p as any).salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonPurchases) : updater;
      const tagged = next.map((p: any) => ({ ...p, salonId: p.salonId || currentSalonId, branchId: p.branchId || activeBranchId }));
      const other = prev.filter((p: any) => (p as any).salonId && (p as any).salonId !== currentSalonId);
      const res = [...other, ...tagged];
      tagged.forEach((p: any) => DB.savePurchaseInvoice(p));
      return res;
    });
  };

  const handleSetSupplierPayments = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setSupplierPayments(prev => {
      const currentSalonPayments = prev.filter((sp: any) => !(sp as any).salonId || (sp as any).salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonPayments) : updater;
      const tagged = next.map((sp: any) => ({ ...sp, salonId: sp.salonId || currentSalonId, branchId: sp.branchId || activeBranchId }));
      const other = prev.filter((sp: any) => (sp as any).salonId && (sp as any).salonId !== currentSalonId);
      const res = [...other, ...tagged];
      tagged.forEach((sp: any) => DB.saveSupplierPayment(sp));
      return res;
    });
  };

  const handleSetInventoryCounts = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setInventoryCounts(prev => {
      const currentSalonCounts = prev.filter((ic: any) => !(ic as any).salonId || (ic as any).salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonCounts) : updater;
      const tagged = next.map((ic: any) => ({ ...ic, salonId: ic.salonId || currentSalonId, branchId: ic.branchId || activeBranchId }));
      const other = prev.filter((ic: any) => (ic as any).salonId && (ic as any).salonId !== currentSalonId);
      const res = [...other, ...tagged];
      tagged.forEach((ic: any) => DB.saveInventoryCount(ic));
      return res;
    });
  };

  const handleSetItemMovements = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setItemMovements(prev => {
      const currentSalonMovements = prev.filter((im: any) => !(im as any).salonId || (im as any).salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonMovements) : updater;
      const tagged = next.map((im: any) => ({ ...im, salonId: im.salonId || currentSalonId, branchId: im.branchId || activeBranchId }));
      const other = prev.filter((im: any) => (im as any).salonId && (im as any).salonId !== currentSalonId);
      const res = [...other, ...tagged];
      tagged.forEach((im: any) => DB.saveItemMovement(im));
      return res;
    });
  };

  const handleRefreshWarehouse = useCallback(async () => {
    const sId = currentSalonId || settings.salonId;
    if (!sId) return;
    try {
      const [polledProducts, polledCategories, polledPurchases, polledSupplierPayments, polledSuppliers, sectionData] = await Promise.all([
        DB.fetchProducts(sId),
        DB.fetchCategories(sId),
        DB.fetchPurchaseInvoices(sId),
        DB.fetchSupplierPayments(sId),
        DB.fetchSuppliers(sId),
        DB.loadSectionData('warehouse', sId)
      ]);
      if (polledProducts && Array.isArray(polledProducts)) {
        setProducts(polledProducts.map(dbProductToApp));
      }
      if (polledCategories && Array.isArray(polledCategories) && polledCategories.length > 0) {
        setCategories(polledCategories);
      }
      if (polledPurchases && Array.isArray(polledPurchases)) {
        setPurchaseInvoices(polledPurchases);
      }
      if (polledSupplierPayments && Array.isArray(polledSupplierPayments)) {
        setSupplierPayments(polledSupplierPayments);
      }
      if (polledSuppliers && Array.isArray(polledSuppliers)) {
        setSuppliers(polledSuppliers);
      }
      if (sectionData) {
        applySectionData('warehouse', sectionData);
      }
    } catch (e) {
      console.warn('Error refreshing warehouse data:', e);
    }
  }, [currentSalonId, settings.salonId, applySectionData]);

  const handleRefreshOwnerPortal = useCallback(async () => {
    const sId = currentSalonId || settings.salonId;
    if (!sId) return;
    setIsDbLoading(true);
    try {
      const sectionData = await DB.loadSectionData('owner_portal', sId);
      if (sectionData) {
        applySectionData('owner_portal', sectionData);
      }
    } catch (e) {
      console.warn('Error refreshing owner portal data:', e);
    } finally {
      setIsDbLoading(false);
    }
  }, [currentSalonId, settings.salonId, applySectionData]);


  const handleSetPartners = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setPartners(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      next.forEach((p: any) => DB.savePartner(p));
      return next;
    });
  };

  const handleSetPartnerTransactions = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setPartnerTransactions(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      next.forEach((pt: any) => DB.savePartnerTransaction(pt));
      return next;
    });
  };

  const handleSetPromoCodes = (updater: any) => {
    setPromoCodes(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (Array.isArray(next)) {
        if (Array.isArray(prev)) {
          const nextIds = new Set(next.map((n: any) => n.id));
          prev.filter((p: any) => !nextIds.has(p.id)).forEach((p: any) => {
            DB.deletePromoCode(p.id).catch(e => console.warn('Error deleting promo code:', e));
          });
        }
        next.forEach((pc: any) => {
          DB.savePromoCode(pc).catch(e => console.warn('Error saving promo code:', e));
        });
      }
      return next;
    });
  };

  const handleSetPromoCodeUsages = (updater: any) => {
    setPromoCodeUsages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (Array.isArray(next)) {
        next.forEach((pu: any) => {
          DB.savePromoCodeUsage(pu).catch(e => console.warn('Error saving promo code usage:', e));
        });
      }
      return next;
    });
  };

  const handleSetTips = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setTips(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      next.forEach((t: any) => DB.saveTip(t));
      return next;
    });
  };

  const handleSetCustodies = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setCustodies(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      next.forEach((c: any) => DB.saveCustody(c));
      return next;
    });
  };

  const handleSetFingerprintLogs = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setFingerprintLogs(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      next.forEach((fl: any) => DB.saveFingerprintLog(fl));
      return next;
    });
  };


  // Always keep subscription organizationName and localStorage in sync with settings.salonName
  useEffect(() => {
    if (settings.salonName && subscription.organizationName !== settings.salonName) {
      setSubscription(prev => ({ ...prev, organizationName: settings.salonName }));
    }
  }, [settings.salonName]);

  // Always keep branches in sync with current salonId
  useEffect(() => {
    const sId = settings.salonId || 'salon-1001';
    const list = SubscriptionService.getBranches(sId);
    if (list && list.length > 0) {
      setBranches(list);
    }
  }, [settings.salonId]);

  // Load dedicated independent settings whenever active branch changes
  useEffect(() => {
    if (!activeBranchId) return;
    const branchSettings = SubscriptionService.getBranchSettings(activeBranchId, settings);
    setSettings(branchSettings);
  }, [activeBranchId]);

  // Save settings into active branch storage
  const handleSetSettings = (updater: AppSettings | ((prev: AppSettings) => AppSettings)) => {
    if (checkReadOnlyAndWarn()) return;
    setSettings(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (activeBranchId) {
        SubscriptionService.saveBranchSettings(activeBranchId, next);
      } else {
        localStorage.setItem('smartcut_app_settings', JSON.stringify(next));
      }
      const salonId = next.salonId || settings.salonId || (SubscriptionService.getSalons()[0]?.id || '');
      if (salonId) {
        DB.saveSettings(salonId, next);
      }
      return next;
    });
  };

  const handleOpenShift = async () => {
    if (checkReadOnlyAndWarn()) return;
    if (shiftData.isOpen || branchShifts[activeBranchId]?.isOpen) {
      alert('لا يمكن فتح وردية جديدة: توجد وردية مفتوحة بالفعل لهذا الفرع! يرجى إغلاق وردية هذا الفرع أولاً.');
      return;
    }

    // التحقق الصارم من قاعدة البيانات لمنع فتح أكثر من وردية لنفس الفرع عبر الأجهزة
    try {
      const activeDbShift = await DB.getActiveWorkShift(settings.salonId, activeBranchId);
      if (activeDbShift && (activeDbShift.status === 'open' || !activeDbShift.closedAt)) {
        applyActiveWorkShift(activeDbShift, activeBranchId);
        alert(`تم رصد وردية مفتوحة للفرع: توجد وردية عمل مفتوحة بالفعل لهذا الفرع في قاعدة البيانات (كود الوردية: ${activeDbShift.shiftCode || activeDbShift.id}). جرى استعادتها.`);
        setShowOpenModal(false);
        return;
      }
    } catch (e) {
      console.warn('Error checking active shift in DB:', e);
    }

    const shiftDateVal = openShiftForm.date?.trim() || getLocalTodayDateString();
    const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];
    const shiftId = 'SHIFT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const nowIso = new Date().toISOString();

    const cleanDate = shiftDateVal.replace(/-/g, '');
    let nextSeq = 1;
    try {
      const existingShifts = await DB.fetchWorkShifts(settings.salonId, activeBranchId);
      const sameDayShifts = existingShifts.filter((s: any) => (s.shiftDate === shiftDateVal) || (s.shift_date === shiftDateVal));
      if (sameDayShifts.length > 0) {
        let maxNum = 0;
        sameDayShifts.forEach((s: any) => {
          const code = s.shiftCode || s.shift_code || '';
          const match = code.match(/SH-\d+-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        });
        nextSeq = Math.max(maxNum + 1, sameDayShifts.length + 1);
      }
    } catch (e) {
      console.warn('Could not fetch existing shifts for sequence:', e);
    }
    const shiftCode = `SH-${cleanDate}-${String(nextSeq).padStart(2, '0')}`;

    if (openShiftForm.initialCash > 0) {
      const cashTreasury = settings.treasuries.find(t => t.id === 'cash') || settings.treasuries[0];
      const newTrx: Transaction = {
        id: 'TRX-CUSTODY-' + Math.random().toString(36).substr(2,9),
        date: shiftDateVal + 'T' + new Date().toTimeString().split(' ')[0],
        type: 'in',
        amount: openShiftForm.initialCash,
        category: 'عهدة افتتاحية',
        description: `عهدة افتتاحية للوردية (${shiftCode} - ${currentUser?.name || 'الكاشير'}) - فرع ${activeBranch?.name || ''}`,
        treasury: cashTreasury.id,
        createdBy: currentUser?.name || 'الكاشير',
        userId: currentUser?.id,
        userName: currentUser?.name || 'الكاشير',
        shiftDate: shiftDateVal,
        shiftCode: shiftCode,
        branchId: activeBranchId,
        branchCode: activeBranch?.code
      };
      handleSetTransactions(prev => [...prev, newTrx]);
    }

    const newWorkShift: WorkShift = {
      id: shiftId,
      shiftCode,
      salonId: settings.salonId,
      branchId: activeBranchId,
      shiftDate: shiftDateVal,
      openedAt: nowIso,
      openedByUserId: currentUser?.id,
      openedByUserName: currentUser?.name || 'الكاشير',
      openedByName: currentUser?.name || 'الكاشير',
      openedByRole: currentUser?.role || 'cashier',
      initialCash: Number(openShiftForm.initialCash) || 0,
      status: 'open',
      createdAt: nowIso
    };

    setShiftData({ 
      isOpen: true, 
      date: shiftDateVal, 
      initialCash: Number(openShiftForm.initialCash) || 0, 
      shiftId, 
      shiftCode,
      branchId: activeBranchId,
      openedAt: nowIso,
      openedByUserId: currentUser?.id,
      openedByUserName: currentUser?.name || 'الكاشير',
      openedByName: currentUser?.name || 'الكاشير',
      openedByRole: currentUser?.role || 'cashier'
    });
    setShowOpenModal(false);
    await DB.saveWorkShift(newWorkShift);
  };

  const handleConfirmCloseShift = async () => {
    if (isClosingShift) return;
    setIsClosingShift(true);
    try {
      if (checkReadOnlyAndWarn()) return;
      const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];
      const currentShiftCode = (shiftData as any)?.shiftCode;
      const definedTreasuries = (settings.treasuries && settings.treasuries.length > 0)
        ? settings.treasuries
        : [
            { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
            { id: 'cash', name: 'كاش (الدرج)', isMain: false },
            { id: 'card', name: 'شبكة / فيزا', isMain: false }
          ];
      const mainTreasury = definedTreasuries.find(t => t.isMain) || definedTreasuries.find(t => t.id === 'main') || definedTreasuries[0];
      const newTransactions: Transaction[] = [];
      const now = (shiftData?.isOpen && shiftData?.date) 
        ? (shiftData.date + 'T' + new Date().toTimeString().split(' ')[0]) 
        : new Date().toISOString();

      definedTreasuries.forEach(t => {
        if (t.id === mainTreasury.id) return;

        // الحماية من التكرار: إذا كانت هناك حركة تصفير مسجلة بالفعل لهذه الوردية وهذه الخزينة، لا تقم بإنشاء حركة مكررة
        if (currentShiftCode && transactions.some(trx => 
          ((trx as any).shiftCode === currentShiftCode || (trx as any).shift_code === currentShiftCode) &&
          trx.category === 'transfer' &&
          (trx.treasury === t.id || (trx as any).treasuryId === t.id)
        )) {
          return;
        }

        // 1. Transactions directly in this treasury
        const tTrx = transactions.filter(trx => 
          (trx.treasury === t.id || (trx as any).treasuryId === t.id) &&
          (!trx.salonId || !settings.salonId || trx.salonId === settings.salonId)
        );

        const invoiceIdsInTrx = new Set(
          tTrx.filter(trx => trx.type === 'in' && ((trx as any).invoiceId || (trx as any).invoice_id))
            .map(trx => (trx as any).invoiceId || (trx as any).invoice_id)
        );

        // 2. Add sales from invoices that don't have separate transaction rows
        const unrecordedInvoiceSales = branchInvoices.reduce((sum, inv) => {
          if (inv.status === 'cancelled') return sum;
          if (invoiceIdsInTrx.has(inv.id)) return sum;
          const methods = inv.paymentMethods && inv.paymentMethods.length > 0
            ? inv.paymentMethods
            : [{ amount: Number(inv.total) || 0, treasuryId: inv.paymentMethod || 'cash' }];
          const matched = methods.filter((m: any) => m.treasuryId === t.id);
          return sum + matched.reduce((s: number, m: any) => s + (Number(m.amount) || 0), 0);
        }, 0);

        const totalIn = tTrx.filter(trx => trx.type === 'in').reduce((s, x) => s + (Number(x.amount) || 0), 0) + unrecordedInvoiceSales;
        const totalOut = tTrx.filter(trx => trx.type === 'out').reduce((s, x) => s + (Number(x.amount) || 0), 0);
        const net = Math.round((totalIn - totalOut) * 100) / 100;

        if (net > 0) {
          newTransactions.push({
            id: 'TRX-OUT-' + Math.random().toString(36).substr(2,9),
            salonId: settings.salonId,
            date: now,
            type: 'out',
            amount: net,
            category: 'transfer',
            description: `تصفير خزينة (${t.name}) ونقل الرصيد بالكامل (${net} ر.س) إلى (${mainTreasury.name}) - وردية ${currentShiftCode || ''} - فرع ${activeBranch?.name || ''}`,
            treasury: t.id,
            branchId: activeBranchId,
            branchCode: activeBranch?.code,
            createdBy: currentUser?.name || 'الكاشير',
            userId: currentUser?.id,
            userName: currentUser?.name || 'الكاشير',
            shiftDate: shiftData.date,
            shiftCode: currentShiftCode
          });
          newTransactions.push({
            id: 'TRX-IN-' + Math.random().toString(36).substr(2,9),
            salonId: settings.salonId,
            date: now,
            type: 'in',
            amount: net,
            category: 'transfer',
            description: `تحويل تصفير وردية من (${t.name}) بمبلغ (${net} ر.س) إلى (${mainTreasury.name}) - وردية ${currentShiftCode || ''} - فرع ${activeBranch?.name || ''}`,
            treasury: mainTreasury.id,
            branchId: activeBranchId,
            branchCode: activeBranch?.code,
            createdBy: currentUser?.name || 'الكاشير',
            userId: currentUser?.id,
            userName: currentUser?.name || 'الكاشير',
            shiftDate: shiftData.date,
            shiftCode: currentShiftCode
          });
        }
      });

      if (newTransactions.length > 0) {
        setTransactions(prev => [...prev, ...newTransactions]);
        await DB.saveTransactions(newTransactions, settings.salonId);
      }

      // Persist shift closure in DB
      const shiftInvoices = branchInvoices.filter(i => 
        i.status !== 'cancelled' && 
        (i.date.startsWith(shiftData.date) || (shiftData.date && (i as any).created_at?.startsWith(shiftData.date)))
      );
      const totalSales = shiftInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
      const totalCashSales = shiftInvoices.reduce((s, i) => {
        const splits = i.paymentMethods && i.paymentMethods.length > 0
          ? i.paymentMethods
          : [{ amount: Number(i.total) || 0, treasuryId: i.paymentMethod || 'cash' }];
        const cashSplit = splits.find((pm: any) => pm.treasuryId === 'cash' || pm.treasuryId?.includes('cash'))?.amount;
        return s + (Number(cashSplit) || 0);
      }, 0);
      const totalCardSales = Math.max(0, totalSales - totalCashSales);

      // Operational shift expenses (exclude internal transfers and zeroing)
      const shiftExpenses = branchTransactions.filter(t => 
        t.date.startsWith(shiftData.date) && 
        (t.type === 'out' || t.category === 'expense') &&
        t.category !== 'transfer' &&
        !t.description?.includes('تصفير') &&
        !t.description?.includes('تحويل')
      ).reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const initialCashNum = Number(shiftData.initialCash) || 0;
      const cashInTrx = branchTransactions.filter(t => 
        t.date.startsWith(shiftData.date) && 
        (t.treasury === 'cash' || (t as any).treasuryId === 'cash') &&
        t.type === 'in' &&
        t.category !== 'initial_cash' &&
        t.category !== 'عهدة افتتاحية' &&
        !t.description?.includes('تصفير')
      ).reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const cashOutTrx = branchTransactions.filter(t => 
        t.date.startsWith(shiftData.date) && 
        (t.treasury === 'cash' || (t as any).treasuryId === 'cash') &&
        t.type === 'out' &&
        t.category !== 'transfer' &&
        !t.description?.includes('تصفير')
      ).reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const expectedCash = Math.max(0, initialCashNum + totalCashSales + cashInTrx - cashOutTrx);

      const nowIso = new Date().toISOString();
      const effectiveShiftCode = currentShiftCode || (shiftData as any)?.shiftCode || (`SH-${(shiftData.date || '').replace(/-/g, '')}-01`);

      const closedShift: Partial<WorkShift> = {
        id: (shiftData as any).shiftId || ('SHIFT-' + Math.random().toString(36).substr(2, 9).toUpperCase()),
        shiftCode: effectiveShiftCode,
        salonId: settings.salonId,
        branchId: activeBranchId,
        shiftDate: shiftData.date,
        openedAt: (shiftData as any).openedAt || undefined,
        openedByUserId: (shiftData as any).openedByUserId || undefined,
        openedByUserName: (shiftData as any).openedByUserName || undefined,
        openedByName: (shiftData as any).openedByName || (shiftData as any).openedByUserName || undefined,
        openedByRole: (shiftData as any).openedByRole || undefined,
        closedAt: nowIso,
        closedByUserId: currentUser?.id,
        closedByUserName: currentUser?.name || 'الكاشير',
        closedByName: currentUser?.name || 'الكاشير',
        closedByRole: currentUser?.role || 'cashier',
        initialCash: initialCashNum,
        expectedCash,
        totalSales,
        totalCashSales,
        totalCardSales,
        totalExpenses: shiftExpenses,
        status: 'closed'
      };
      await DB.saveWorkShift(closedShift);
      
      // تصفير عداد الأدوار للوردية القادمة ليبدأ من 1
      QueueService.resetShiftQueue(settings.salonId, activeBranchId, shiftData.date);

      // فتح نافذة طباعة تقرير الإغلاق فوراً ومع الإغلاق تلقائياً
      try {
        handlePrintClosingShiftReport(settings.paperSize || '80mm');
      } catch (printErr) {
        console.warn('Could not auto-print shift report on close:', printErr);
      }

      setShiftData({ 
        isOpen: false, 
        date: '', 
        initialCash: 0, 
        lastClosedAt: nowIso,
        shiftId: undefined,
        shiftCode: undefined 
      });
      setShowCloseModal(false);
    } catch (err: any) {
      console.error('Error closing shift:', err);
      alert('حدث خطأ أثناء إغلاق الوردية: ' + (err?.message || err));
    } finally {
      setIsClosingShift(false);
    }
  };

  // طباعة تقرير إغلاق الوردية (حراري أو A4)
  const handlePrintClosingShiftReport = (paper: '80mm' | '58mm' | 'a4' = (settings.paperSize || '80mm')) => {
    try {
      const el = document.getElementById('print-receipt') || document.querySelector('[id="print-receipt"]') || document.getElementById('shift-closing-report-receipt-container');
      if (el) {
        handlePrintReceipt(el.id || 'print-receipt', paper === 'a4', paper);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Error printing closing shift report:', err);
      window.print();
    }
  };


  const handleCheckoutComplete = (invoice: Invoice, paymentSplits: { amount: number, treasuryId: string }[], bookingId?: string) => {
    if (checkReadOnlyAndWarn()) return;

    // 1. Add invoice tagged with active branch and salon
    const invoiceWithBranch: Invoice = {
      ...invoice,
      salonId: settings.salonId,
      branchId: invoice.branchId || activeBranchId,
      branchCode: invoice.branchCode || activeBranch?.code,
      cashierId: invoice.cashierId || currentUser?.id || currentUser?.username || undefined,
      cashierName: invoice.cashierName || currentUser?.name || currentUser?.username || undefined,
      createdBy: invoice.createdBy || currentUser?.username || currentUser?.name || undefined,
      createdById: invoice.createdById || currentUser?.id || undefined,
      shiftId: invoice.shiftId || (shiftData?.isOpen ? (shiftData as any).shiftId : undefined),
      shiftCode: invoice.shiftCode || (shiftData?.isOpen ? (shiftData as any).shiftCode : undefined),
      shiftDate: invoice.shiftDate || (shiftData?.isOpen ? shiftData.date : undefined),
      paymentMethods: invoice.paymentMethods && invoice.paymentMethods.length > 0 ? invoice.paymentMethods : paymentSplits
    };

    const existingOldInvoice = invoices.find(i => i.id === invoiceWithBranch.id);
    const isEditing = Boolean((invoice as any).isEditedInvoice || existingOldInvoice);

    // 1. إعادة تسوية الآثار السابقة إذا كنا في وضع تعديل فاتورة قائمة
    const updatedProducts = [...products];
    if (existingOldInvoice) {
      // أ. استعادة كميات المنتجات المباعة سابقاً في الفاتورة قبل تعديلها
      if (existingOldInvoice.items) {
        existingOldInvoice.items.forEach(oldItem => {
          if (oldItem.type === 'product' && oldItem.itemId) {
            const pIdx = updatedProducts.findIndex(p => p.id === oldItem.itemId);
            if (pIdx !== -1) {
              const qty = oldItem.quantity || 1;
              const currentProd = updatedProducts[pIdx];
              const curBranchStocks = { ...(currentProd.branchStocks || {}) };
              const branchCurStock = (activeBranchId && curBranchStocks[activeBranchId] !== undefined)
                ? curBranchStocks[activeBranchId]
                : currentProd.currentStock;
              const newBranchStock = branchCurStock + qty;
              if (activeBranchId) {
                curBranchStocks[activeBranchId] = newBranchStock;
              }
              updatedProducts[pIdx] = { 
                ...currentProd, 
                currentStock: currentProd.currentStock + qty,
                branchStocks: curBranchStocks
              };
            }
          }
        });
      }
      // ب. استبعاد حركات المخزون السابقة الخاصة بهذه الفاتورة
      setItemMovements(prev => prev.filter(m => m.referenceId !== invoiceWithBranch.id));

      // ج. استبعاد السجلات المالية وعمولات الموظفين المسجلة سابقاً للفاتورة
      setEmployees(prev => prev.map(emp => {
        if (!emp.financialRecords || emp.financialRecords.length === 0) return emp;
        const filtered = emp.financialRecords.filter(r => !r.note?.includes(invoiceWithBranch.id));
        if (filtered.length !== emp.financialRecords.length) {
          const updatedEmp = { ...emp, financialRecords: filtered };
          DB.saveEmployee(updatedEmp).catch(() => {});
          return updatedEmp;
        }
        return emp;
      }));

      // د. استرجاع نقاط الكاش باك إذا تم استخدامها سابقاً
      if (existingOldInvoice.cashbackUsed && existingOldInvoice.clientId) {
        setClients(prev => prev.map(cl => {
          if (cl.id === existingOldInvoice.clientId) {
            const restoredPts = (cl.loyaltyPoints || 0) + existingOldInvoice.cashbackUsed!;
            const updatedCl = { ...cl, loyaltyPoints: restoredPts, cashback: restoredPts };
            DB.saveClient(updatedCl).catch(() => {});
            return updatedCl;
          }
          return cl;
        }));
      }
    }

    setInvoices(prev => {
      const exists = prev.some(i => i.id === invoiceWithBranch.id);
      if (exists) {
        return prev.map(i => i.id === invoiceWithBranch.id ? invoiceWithBranch : i);
      }
      return [invoiceWithBranch, ...prev];
    });
    
    // Deduct stock & Add Commission
    const newMovements: any[] = [];
    const newFinancialRecords: any[] = [];
    const instantCommissionPayouts: Array<{
      employeeId: string;
      employeeName: string;
      serviceName: string;
      amount: number;
    }> = [];
    
    invoice.items.forEach(item => {
      if (item.type === 'product' && item.itemId) {
        // Deduct stock per active branch
        const pIdx = updatedProducts.findIndex(p => p.id === item.itemId);
        if (pIdx !== -1) {
          const qty = item.quantity || 1;
          const currentProd = updatedProducts[pIdx];
          const curBranchStocks = { ...(currentProd.branchStocks || {}) };
          const branchCurStock = (activeBranchId && curBranchStocks[activeBranchId] !== undefined)
            ? curBranchStocks[activeBranchId]
            : currentProd.currentStock;
          const newBranchStock = branchCurStock - qty;
          if (activeBranchId) {
            curBranchStocks[activeBranchId] = newBranchStock;
          }

          updatedProducts[pIdx] = { 
            ...currentProd, 
            currentStock: currentProd.currentStock - qty,
            branchStocks: curBranchStocks
          };
          newMovements.push({
            id: 'MOV-' + Math.random().toString(36).substr(2, 9),
            productId: item.itemId,
            date: invoice.date,
            type: 'sale',
            referenceId: invoice.id,
            quantityIn: 0,
            quantityOut: qty,
            branchId: activeBranchId,
            balanceAfter: newBranchStock
          });
          
          // Commission
          const prod = updatedProducts[pIdx];
          if (prod.commission > 0 && item.employeeId) {
            newFinancialRecords.push({
              employeeId: item.employeeId,
              record: {
                id: 'FIN-' + Math.random().toString(36).substr(2, 9),
                date: invoice.date,
                type: 'commission',
                amount: prod.commission * (item.quantity || 1),
                note: `عمولة بيع منتج: ${prod.name}`
              }
            });
          }
        }
      } else if (item.type !== 'product') {
         // Service execution commission (عمولة التنفيذ)
         const srv = services.find(s => s.id === item.itemId || s.id === item.id || s.name === item.serviceName);
         const performerEmp = employees.find(e => (item.employeeId && e.id === item.employeeId) || (item.technicianName && e.name === item.technicianName));
         const targetEmpId = item.employeeId || performerEmp?.id;
         const isExempt = Boolean(item.isTargetExempt ?? srv?.isTargetExempt);
         
         let commAmount = Number(item.employeeCommission ?? item.commissionAmount ?? (item as any).commission ?? 0);
         if (commAmount <= 0 && srv) {
           const srvAmount = Number(srv.employeeCommissionAmount ?? srv.commissionAmount ?? 0);
           const srvPct = Number(srv.employeeCommissionPercentage ?? srv.commissionRate ?? 0);
           if (srvAmount > 0) {
             commAmount = srvAmount * (item.quantity || 1);
           } else if (srvPct > 0) {
             const basePrice = Number(item.price || item.originalPrice || srv.price || 0);
             commAmount = (srvPct / 100) * basePrice * (item.quantity || 1);
           }
         }

         if (commAmount > 0 && targetEmpId) {
           const hasFixedComm = performerEmp && hasEmployeeFixedCommission(performerEmp);
           // إذا كان للموظف عمولة ثابتة، فلا تحسب عمولة تنفيذ الخدمات إلا في حال تحديد خيار احتساب العمولتين معاً أو إذا كانت الخدمة مستثناة من التارجت وصرفها فوري
           const shouldAwardServiceCommission = isExempt || !hasFixedComm || performerEmp?.allowDualCommission;

           if (shouldAwardServiceCommission) {
             newFinancialRecords.push({
               employeeId: targetEmpId,
               record: {
                 id: 'FIN-' + Math.random().toString(36).substr(2, 9),
                 date: invoice.date,
                 type: 'commission',
                 amount: commAmount,
                 note: `عمولة تنفيذ خدمة: ${item.serviceName || srv?.name || 'خدمة'}${isExempt ? ' (مستثناة من التارجت - صرف فوري)' : ''}`
               }
             });

             // إذا كان خيار صرف العمولة الفورية من الدرج مفعلاً في الإعدادات وكانت الخدمة مستثناة من التارجت:
             if (settings.instantCommissionFromDrawer && isExempt) {
               const cashTreasuryId = settings.treasuries.find(t => t.id === 'cash' || t.name.includes('كاش') || t.name.includes('نقد') || t.name.includes('درج'))?.id || 'cash';
               
               // تسجيل سند صرف عمولة للموظف ليظهر كمسدد في التايم شيت وتقارير العمولات
               newFinancialRecords.push({
                 employeeId: targetEmpId,
                 record: {
                   id: 'FIN-COMM-PAY-' + Math.random().toString(36).substr(2, 9),
                   date: invoice.date,
                   type: 'commission_payout',
                   amount: commAmount,
                   treasuryId: cashTreasuryId,
                   note: `صرف عمولة فورية من الدرج: ${item.serviceName || srv?.name || 'خدمة'} (فاتورة #${invoice.id})`
                 }
               });

               instantCommissionPayouts.push({
                 employeeId: targetEmpId,
                 employeeName: performerEmp?.name || item.technicianName || 'الموظف',
                 serviceName: item.serviceName || srv?.name || 'خدمة',
                 amount: commAmount
               });
             }
           }
         }

         // Service referral commission (عمولة فتح شغل / إحالة الخدمة)
         let refCommAmount = Number(item.referralCommissionAmount || 0);
         if (refCommAmount <= 0 && srv && srv.referralCommissionAmount) {
           if (srv.referralCommissionType === 'fixed') {
             refCommAmount = srv.referralCommissionAmount * (item.quantity || 1);
           } else {
             refCommAmount = (srv.referralCommissionAmount / 100) * (item.price || 0) * (item.quantity || 1);
           }
         }

         const refEmpId = item.referralEmployeeId;
         if (refCommAmount > 0 && refEmpId) {
           const isSelfReferral = refEmpId === targetEmpId;
           newFinancialRecords.push({
             employeeId: refEmpId,
             record: {
               id: 'FIN-' + Math.random().toString(36).substr(2, 9),
               date: invoice.date,
               type: 'referral_commission',
               amount: refCommAmount,
               note: `عمولة فتح شغل (إحالة): ${item.serviceName || srv?.name || 'خدمة'}${isSelfReferral ? ' (إحالة وتنفيذ ذاتي)' : ''}`
             }
           });
         }
      }
    });

    if (updatedProducts.length > 0) {
      setProducts(updatedProducts);
      if (newMovements.length > 0) setItemMovements([...itemMovements, ...newMovements]);
    }
    
    if (newFinancialRecords.length > 0) {
      setEmployees(prev => {
        const updated = prev.map(emp => {
          const myRecords = newFinancialRecords.filter(r => r.employeeId === emp.id).map(r => r.record);
          if (myRecords.length > 0) {
            const updatedEmp = { ...emp, financialRecords: [...(emp.financialRecords || []), ...myRecords] };
            DB.saveEmployee(updatedEmp);
            return updatedEmp;
          }
          return emp;
        });
        return updated;
      });
    }

    // 2. Add transactions for the payments (يدعم السداد الكاش والفيزا والمقسم بالتساوي والآجل)
    const isDeferred = invoice.status === 'deferred' || (invoice.paid !== undefined && Number(invoice.paid) === 0);
    const paidAmount = Number(invoice.paid ?? invoice.total ?? 0);
    const effectiveSplits = isDeferred
      ? []
      : (paymentSplits && paymentSplits.length > 0)
        ? paymentSplits
        : (invoice.paymentMethods && invoice.paymentMethods.length > 0
            ? invoice.paymentMethods
            : (paidAmount > 0 ? [{ amount: paidAmount, treasuryId: invoice.treasuryId || invoice.paymentMethod || 'cash' }] : []));

    const effectiveShiftId = invoice.shiftId || (shiftData?.isOpen ? (shiftData as any).shiftId : undefined);
    const effectiveShiftCode = invoice.shiftCode || (shiftData?.isOpen ? (shiftData as any).shiftCode : undefined);
    const effectiveShiftDate = invoice.shiftDate || (shiftData?.isOpen ? shiftData.date : undefined);

    const isOldInvoiceTransaction = (t: any) => {
      const invId = invoiceWithBranch.id;
      if (!invId) return false;
      return (
        t.invoiceId === invId ||
        t.invoice_id === invId ||
        (typeof t.id === 'string' && (t.id.includes(invId) || t.id.startsWith(`TRX-${invId}`))) ||
        (typeof t.description === 'string' && t.description.includes(invId))
      );
    };

    const oldMatchingTrxs = transactions.filter(isOldInvoiceTransaction);
    const oldTrxIds = oldMatchingTrxs.map(t => t.id).filter(Boolean);

    const newTrxs: Transaction[] = effectiveSplits
      .filter(split => split.treasuryId !== 'cashback' && split.treasuryId !== 'remedy_free' && Number(split.amount) > 0)
      .map((split, idx) => ({
        id: `TRX-${invoiceWithBranch.id}-${idx}`,
        salonId: settings.salonId,
        date: invoiceWithBranch.date,
        type: 'in',
        amount: Number(split.amount),
        category: 'sales',
        description: `مبيعات - فاتورة ${invoiceWithBranch.id}${invoiceWithBranch.clientName ? ` (${invoiceWithBranch.clientName})` : ''}`,
        treasury: split.treasuryId || invoiceWithBranch.treasuryId || invoiceWithBranch.paymentMethod || 'cash',
        treasuryId: split.treasuryId || invoiceWithBranch.treasuryId || invoiceWithBranch.paymentMethod || 'cash',
        branchId: activeBranchId,
        branchCode: activeBranch?.code,
        shiftId: effectiveShiftId,
        shiftCode: effectiveShiftCode,
        shiftDate: effectiveShiftDate,
        invoiceId: invoiceWithBranch.id,
        invoice_id: invoiceWithBranch.id
      } as any));

    // 2.b. If tip was paid via non-cash method and branch mode is 'instant_cash', deduct tip immediately from Cash Drawer
    const tipMode = settings.tipPayoutMethod || 'instant_cash';
    const isUnspecifiedTip = !invoice.tipEmployeeId || invoice.tipEmployeeId === 'unspecified' || invoice.tipEmployeeName?.includes('غير محدد');
    if (invoice.tipAmount && invoice.tipAmount > 0 && tipMode === 'instant_cash' && !isUnspecifiedTip) {
      const hasNonCashPayment = effectiveSplits.some(s => s.treasuryId !== 'cash' && !s.treasuryId.includes('cash') && s.treasuryId !== 'cashback');
      if (hasNonCashPayment) {
        const cashTreasuryId = settings.treasuries.find(t => t.id === 'cash' || t.name.includes('كاش') || t.name.includes('نقد'))?.id || 'cash';
        newTrxs.push({
          id: `TRX-TIP-${invoiceWithBranch.id}`,
          salonId: settings.salonId,
          date: invoiceWithBranch.date,
          type: 'out',
          amount: invoice.tipAmount,
          category: 'صرف بقشيش فوري',
          description: `صرف بقشيش فوري كاش - فاتورة ${invoiceWithBranch.id} للموظف ${invoice.tipEmployeeName || 'الموظف'}`,
          treasury: cashTreasuryId,
          treasuryId: cashTreasuryId,
          branchId: activeBranchId,
          branchCode: activeBranch?.code,
          shiftId: effectiveShiftId,
          shiftCode: effectiveShiftCode,
          shiftDate: effectiveShiftDate,
          invoiceId: invoiceWithBranch.id,
          invoice_id: invoiceWithBranch.id
        } as any);
      }
    }

    // 2.c. If instant commission from drawer is enabled and invoice has target-exempt services, deduct directly from Cash Drawer
    if (settings.instantCommissionFromDrawer && instantCommissionPayouts.length > 0) {
      const cashTreasuryId = settings.treasuries.find(t => t.id === 'cash' || t.name.includes('كاش') || t.name.includes('نقد') || t.name.includes('درج'))?.id || 'cash';
      instantCommissionPayouts.forEach((payout, pIdx) => {
        newTrxs.push({
          id: `TRX-COMM-${invoiceWithBranch.id}-${pIdx}`,
          salonId: settings.salonId,
          date: invoiceWithBranch.date,
          type: 'out',
          amount: payout.amount,
          category: 'commission_payout',
          description: `صرف عمولة فورية من الدرج - ${payout.serviceName} للموظف ${payout.employeeName} (فاتورة #${invoiceWithBranch.id})`,
          treasury: cashTreasuryId,
          treasuryId: cashTreasuryId,
          branchId: activeBranchId,
          branchCode: activeBranch?.code,
          shiftId: effectiveShiftId,
          shiftCode: effectiveShiftCode,
          shiftDate: effectiveShiftDate,
          invoiceId: invoiceWithBranch.id,
          invoice_id: invoiceWithBranch.id
        } as any);
      });
    }

    if (isEditing) {
      // 1. حذف حركات الخزينة السابقة بالكامل من قاعدة البيانات فوراً لمنع أي تكرار
      if (oldTrxIds.length > 0) {
        DB.deleteTransactionsByIds(oldTrxIds);
      }
      DB.deleteTransactionsByInvoiceId(invoiceWithBranch.id);

      // 2. استبدال حركات الخزينة في الـ state المحلي دون أي تكرار
      setTransactions(prev => [
        ...prev.filter(t => !isOldInvoiceTransaction(t)),
        ...newTrxs
      ]);
    } else if (newTrxs.length > 0) {
      handleSetTransactions(prev => [...prev, ...newTrxs]);
    }

    // 3. Complete and mark booking as paid if came from booking
    if (bookingId) {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'completed', isPaid: true, invoiceId: invoice.id } : b));
      DB.patch('bookings', bookingId, { status: 'completed', is_paid: true, invoice_id: invoice.id });
    }

    // 4. حفظ فوري في Supabase لضمان بقاء وتوثيق البيانات
    (async () => {
      try {
        if (isEditing) {
          if (oldTrxIds.length > 0) {
            await DB.deleteTransactionsByIds(oldTrxIds);
          }
          await DB.deleteTransactionsByInvoiceId(invoiceWithBranch.id);
        }
        const saved = await DB.saveInvoice(invoiceWithBranch, settings.salonId);
        if (saved && newTrxs.length > 0) {
          await DB.saveTransactions(newTrxs, settings.salonId);
        }
      } catch (err) {
        console.error('DB checkout persistence error:', err);
      }
    })();

    // 5. إرسال الفاتورة للعميل عبر الواتساب تلقائياً إذا كان الخيار مفعلاً
    if (settings.whatsappEnabled !== false && settings.whatsappSettings?.sendInvoiceToClient) {
      EvolutionApiService.sendInvoiceWhatsApp(settings, invoiceWithBranch, invoiceWithBranch.branchId || activeBranchId)
        .catch(err => console.error('Auto invoice WhatsApp send error:', err));
    }

    setActiveBookingForPOS(null);
    setActiveEditingInvoiceForPOS(null);
  };


  const renderScreen = () => {
    if (currentUser && !AuthService.canAccess(activeTab, currentUser)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm m-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">عذراً، ليس لديك صلاحية للوصول</h2>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-md mb-6">
            حسابك الحالي ({currentUser.name || currentUser.username}) لا يملك الصلاحيات الكافية لفتح هذه الشاشة. يرجى مراجعة إدارة النظام.
          </p>
          <button
            onClick={() => {
              const firstAllowed = menuItems.find(item => AuthService.canAccess(item.id, currentUser))?.id || 
                (currentUser.role === 'barber' ? 'barber_portal' : (currentUser.role === 'kiosk' ? 'kiosk' : 'pos'));
              setActiveTab(firstAllowed);
            }}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl transition-all shadow-md cursor-pointer"
          >
            الرجوع إلى الشاشة المتاحة
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'pos': return (
        <POSScreen 
          settings={settings} 
          branches={branches}
          activeBranchId={activeBranchId}
          isShiftOpen={shiftData.isOpen} 
          shiftDate={shiftData.date} 
          initialBooking={activeBookingForPOS} 
          initialHeldInvoice={activeHeldInvoiceForPOS}
          initialEditingInvoice={activeEditingInvoiceForPOS}
          onClearInitial={() => {
            setActiveBookingForPOS(null);
            setActiveHeldInvoiceForPOS(null);
            setActiveEditingInvoiceForPOS(null);
          }} 
          onCheckoutComplete={handleCheckoutComplete} 
          clients={branchClients} 
          allSalonClients={salonClients}
          setClients={handleSetClients} 
          services={branchServices} 
          categories={branchCategories} 
          employees={branchEmployees} 
          setEmployees={handleSetEmployees} 
          products={branchProducts}
          invoices={branchInvoices}
          isSubscriptionBlocked={isSubscriptionBlocked}
          promoCodes={promoCodes}
          setPromoCodes={handleSetPromoCodes}
          promoCodeUsages={promoCodeUsages}
          setPromoCodeUsages={handleSetPromoCodeUsages}
          tips={tips}
          setTips={handleSetTips}
          currentUser={currentUser}
          transactions={branchTransactions}
          shiftData={shiftData}
          fingerprintLogs={branchFingerprintLogs}
          setFingerprintLogs={setFingerprintLogs}
        />
      );
      case 'services': return (
        <ServicesScreen 
          settings={settings} 
          activeBranchId={activeBranchId}
          branches={branches}
          services={branchServices} 
          setServices={handleSetServices} 
          categories={branchCategories} 
          setCategories={handleSetCategories} 
        />
      );
      case 'settings': return (
        <SettingsScreen 
          settings={settings} 
          setSettings={handleSetSettings} 
          categories={categories} 
          setCategories={setCategories}
          services={services} 
          setServices={setServices}
          products={products}
          setProducts={setProducts}
          clients={salonClients}
          setClients={handleSetClients}
          employees={employees}
          setEmployees={setEmployees}
          invoices={invoices}
          setInvoices={setInvoices}
          transactions={transactions}
          setTransactions={setTransactions}
          bookings={bookings}
          setBookings={setBookings}
          suppliers={suppliers}
          setSuppliers={setSuppliers}
          purchaseInvoices={purchaseInvoices}
          setPurchaseInvoices={setPurchaseInvoices}
          supplierPayments={supplierPayments}
          setSupplierPayments={setSupplierPayments}
          inventoryCounts={inventoryCounts}
          setInventoryCounts={setInventoryCounts}
          itemMovements={itemMovements}
          setItemMovements={setItemMovements}
          branches={branches}
          setBranches={setBranches}
          activeBranchId={activeBranchId}
          currentUser={currentUser}
          onNavigateScreen={(screenName) => setActiveTab(screenName)}
        />
      );
      case 'employees': return (
        <EmployeesScreen 
          settings={settings} 
          setSettings={handleSetSettings} 
          activeBranchId={activeBranchId}
          employees={branchEmployees} 
          setEmployees={handleSetEmployees} 
          services={services}
          products={branchProducts}
          transactions={branchTransactions} 
          setTransactions={handleSetTransactions} 
          shiftData={shiftData}
          invoices={branchInvoices}
          bookings={branchBookings}
          currentUser={currentUser}
          tips={tips}
          setTips={setTips}
          fingerprintLogs={branchFingerprintLogs}
          setFingerprintLogs={setFingerprintLogs}
          custodies={custodies}
          setCustodies={setCustodies}
          licenseInfo={licenseInfo}
          onOpenLicenseModal={() => setShowLicenseModal(true)}
        />
      );

      case 'partners': return (
        <PartnersScreen 
          settings={settings}
          partners={partners}
          setPartners={setPartners}
          partnerTransactions={partnerTransactions}
          setPartnerTransactions={setPartnerTransactions}
          transactions={branchTransactions}
          setTransactions={handleSetTransactions}
          invoices={branchInvoices}
          employees={branchEmployees}
          products={products}
          purchases={branchPurchaseInvoices}
          supplierPayments={branchSupplierPayments}
          salesReturns={branchSalesReturns}
          branches={branches}
          activeBranchId={activeBranchId}
          currentUser={currentUser}
          shiftData={shiftData}
        />
      );
      case 'promo_codes': return (
        <PromoCodesScreen 
          settings={settings}
          promoCodes={promoCodes}
          setPromoCodes={handleSetPromoCodes}
          promoCodeUsages={promoCodeUsages}
          invoices={invoices}
          currentUser={currentUser}
        />
      );
      case 'tips': return (
        <TipsScreen 
          settings={settings}
          tips={tips}
          setTips={setTips}
          employees={branchEmployees}
          transactions={branchTransactions}
          setTransactions={handleSetTransactions}
          currentUser={currentUser}
        />
      );
      case 'fingerprint_logs': return (
        <FingerprintLogsScreen 
          settings={settings}
          fingerprintLogs={branchFingerprintLogs}
          setFingerprintLogs={setFingerprintLogs}
          logs={branchFingerprintLogs}
          setLogs={setFingerprintLogs}
          employees={branchEmployees}
        />
      );
      case 'hr': return (
        <HRScreen 
          settings={settings} 
          employees={branchEmployees} 
          setEmployees={handleSetEmployees} 
          services={services}
          products={branchProducts}
          invoices={branchInvoices}
          transactions={branchTransactions}
          bookings={branchBookings}
          currentUser={currentUser}
          fingerprintLogs={branchFingerprintLogs}
          setFingerprintLogs={setFingerprintLogs}
          shiftData={shiftData}
          activeBranchId={activeBranchId}
        />
      );

      case 'dashboard': return (
        <DashboardScreen 
          settings={settings} 
          isShiftOpen={shiftData.isOpen} 
          shiftDate={shiftData.date} 
          shiftData={shiftData}
          bookings={branchBookings} 
          setBookings={handleSetBookings} 
          transactions={branchTransactions} 
          setTransactions={handleSetTransactions} 
          onToPOS={(booking) => { 
            setActiveHeldInvoiceForPOS(null);
            setActiveBookingForPOS(booking); 
            setActiveTab('pos'); 
          }} 
          invoices={branchInvoices} 
          products={branchProducts} 
          purchaseInvoices={branchPurchaseInvoices} 
          itemMovements={branchItemMovements} 
          activeBranchId={activeBranchId}
          branches={branches}
          employees={branchEmployees}
          currentUser={currentUser}
          onNavigateScreen={(screen) => setActiveTab(screen)}
        />
      );
      case 'queue_calling': return (
        <QueueCallingScreen
          settings={settings}
          branches={branches}
          activeBranchId={activeBranchId}
          employees={branchEmployees}
          clients={branchClients}
          onNavigateScreen={(screenName) => setActiveTab(screenName)}
          onCompleteAndOpenPOS={(heldInvoice) => {
            setActiveHeldInvoiceForPOS(heldInvoice);
            setActiveTab('pos');
          }}
        />
      );
      case 'bookings': {
        if (!shiftData?.isOpen) {
          return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-[75vh]">
              <div className="bg-white border border-amber-200/80 rounded-3xl p-8 max-w-md w-full text-center shadow-lg animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200/50">
                  <Lock size={32} />
                </div>
                <h2 className="text-lg font-black text-slate-800 mb-2">شاشة الحجوزات مقفلة</h2>
                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full border border-amber-300/60 mb-3">
                  <Lock size={12} />
                  <span>الوردية مغلقة حالياً</span>
                </span>
                <p className="text-xs text-slate-600 leading-relaxed font-medium mb-4">
                  لا يُسمح بفتح شاشة الحجوزات أو إجراء وحفظ أي حجوزات جديدة أثناء إغلاق الوردية.
                </p>
                <p className="text-[11px] text-slate-400 font-bold mb-6">
                  يرجى فتح وردية عمل جديدة لتفعيل استقبال وجدولة المواعيد.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setShowOpenModal(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <span>فتح وردية جديدة الآن</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    العودة للوحة التحكم
                  </button>
                </div>
              </div>
            </div>
          );
        }
        return (
          <BookingsScreen 
            settings={settings} 
            setSettings={setSettings}
          bookings={branchBookings} 
          setBookings={handleSetBookings} 
          onToPOS={(booking) => { 
            setActiveHeldInvoiceForPOS(null);
            setActiveBookingForPOS(booking); 
            setActiveTab('pos'); 
          }} 
          onOpenHeldInvoice={(held) => { 
            setActiveBookingForPOS(null);
            setActiveHeldInvoiceForPOS(held); 
            setActiveTab('pos'); 
          }}
          invoices={branchInvoices}
          setInvoices={handleSetInvoices}
          salesReturns={branchSalesReturns}
          setSalesReturns={handleSetSalesReturns}
          services={branchServices} 
          products={branchProducts}
          setProducts={handleSetProducts}
          setItemMovements={handleSetItemMovements}
          employees={branchEmployees}
          clients={branchClients}
          allSalonClients={salonClients}
          setClients={handleSetClients}
          activeBranchId={activeBranchId}
          branches={branches}
          currentUser={currentUser}
          transactions={branchTransactions}
          setTransactions={handleSetTransactions}
          shiftData={shiftData}
        />
        );
      }
      case 'invoices': return (
        <InvoicesScreen 
          settings={settings} 
          invoices={branchInvoices} 
          setInvoices={handleSetInvoices} 
          transactions={branchTransactions} 
          setTransactions={handleSetTransactions} 
          clients={branchClients} 
          allSalonClients={salonClients}
          setClients={handleSetClients}
          activeBranchId={activeBranchId}
          branches={branches}
          currentUser={currentUser}
          products={branchProducts}
          setProducts={handleSetProducts}
          setItemMovements={handleSetItemMovements}
          salesReturns={branchSalesReturns}
          setSalesReturns={handleSetSalesReturns}
          onNavigateToDeferred={() => setActiveTab('deferred_invoices')}
          onEditInvoiceInPOS={(invoice) => {
            setActiveBookingForPOS(null);
            setActiveHeldInvoiceForPOS(null);
            setActiveEditingInvoiceForPOS(invoice);
            setActiveTab('pos');
          }}
        />
      );

      case 'deferred_invoices': return (
        <DeferredInvoicesScreen 
          settings={settings}
          invoices={salonInvoices}
          setInvoices={handleSetInvoices}
          transactions={salonTransactions}
          setTransactions={handleSetTransactions}
          clients={salonClients}
          setClients={handleSetClients}
          activeBranchId={activeBranchId}
          branches={branches}
          currentUser={currentUser}
          onNavigate={setActiveTab}
        />
      );

      case 'clients': return (
        <ClientsScreen 
          settings={settings} 
          clients={branchClients} 
          setClients={handleSetClients} 
          invoices={branchInvoices} 
          currentUser={currentUser}
          activeBranchId={activeBranchId}
          branches={branches}
          allSalonClients={salonClients}
        />
      );
      case 'complaints': return (
        <ComplaintsScreen 
          settings={settings}
          activeBranchId={activeBranchId}
          invoices={branchInvoices}
          employees={branchEmployees}
          clients={branchClients}
          currentUser={currentUser}
          onNavigateToPOSWithRemedy={(clientPhone, clientName, complaintId, originalInvoiceId) => {
            const matchedClient = branchClients.find(c => c.phone.replace(/\D/g, '') === clientPhone.replace(/\D/g, ''));
            if (matchedClient) {
              // Set client for POS and switch
            }
            setActiveTab('pos');
          }}
        />
      );
      case 'expenses': return (
        <ExpensesScreen 
          settings={settings} 
          setSettings={handleSetSettings} 
          transactions={branchTransactions} 
          setTransactions={handleSetTransactions} 
          shiftData={shiftData} 
          activeBranchId={activeBranchId}
          currentUser={currentUser}
        />
      );
      case 'treasury': return (
        <TreasuryScreen 
          settings={settings} 
          shiftData={shiftData} 
          transactions={branchTransactions} 
          setTransactions={handleSetTransactions} 
          activeBranchId={activeBranchId}
          branches={branches}
          currentUser={currentUser}
          invoices={branchInvoices}
        />
      );
      
      case 'warehouse':
      case 'inventory':
      case 'products':
      case 'purchases':
      case 'suppliers':
        return (
          <WarehouseScreen
            settings={settings}
            activeBranchId={activeBranchId}
            branches={branches}
            products={branchProducts}
            setProducts={handleSetProducts}
            categories={branchCategories}
            setCategories={handleSetCategories}
            employees={branchEmployees}
            suppliers={branchSuppliers}
            setSuppliers={handleSetSuppliers}
            supplierPayments={branchSupplierPayments}
            setSupplierPayments={handleSetSupplierPayments}
            purchaseInvoices={branchPurchaseInvoices}
            setPurchaseInvoices={handleSetPurchaseInvoices}
            inventoryCounts={branchInventoryCounts}
            setInventoryCounts={handleSetInventoryCounts}
            itemMovements={branchItemMovements}
            setItemMovements={handleSetItemMovements}
            transactions={branchTransactions}
            setTransactions={handleSetTransactions}
            shiftData={shiftData}
            initialSubTab={
              activeTab === 'suppliers' ? 'suppliers' :
              activeTab === 'purchases' ? 'purchases' :
              activeTab === 'inventory' ? 'inventory' :
              activeTab === 'products' ? 'products' : 'products'
            }
            currentUser={currentUser}
            onRefresh={handleRefreshWarehouse}
          />
        );
      case 'reports': return (
        <ReportsScreen 
          settings={settings} 
          transactions={branchTransactions} 
          invoices={branchInvoices} 
          bookings={branchBookings}
          employees={branchEmployees} 
          services={branchServices} 
          products={branchProducts} 
          activeBranchId={activeBranchId}
          branches={branches}
          tips={tips}
          fingerprintLogs={branchFingerprintLogs}
          expenses={branchTransactions.filter(t => t.category === 'expense' || t.type === 'expense')}
          purchases={branchPurchaseInvoices}
          supplierPayments={branchSupplierPayments}
          suppliers={branchSuppliers}
          currentUser={currentUser}
          setEmployees={handleSetEmployees}
          setTransactions={handleSetTransactions}
          salesReturns={branchSalesReturns}
          clients={branchClients}
          setClients={handleSetClients}
        />
      );
      case 'daily_sheet': return (
        <DailySheetScreen
          settings={settings}
          invoices={branchInvoices}
          transactions={branchTransactions}
          expenses={branchTransactions.filter(t => t.category === 'expense' || t.type === 'expense')}
          employees={branchEmployees}
          services={branchServices}
          branches={branches}
          activeBranchId={activeBranchId}
          currentUser={currentUser}
        />
      );
      case 'permissions': return (
        <PermissionsScreen 
          settings={settings} 
          activeBranchId={activeBranchId} 
          branches={branches} 
          currentUser={currentUser} 
        />
      );
      case 'owner_portal': return (
        <OwnerExecutivePortal
          settings={settings}
          invoices={invoices}
          transactions={transactions}
          bookings={bookings}
          employees={employees}
          clients={clients}
          branches={branches}
          activeBranchId={activeBranchId}
          onSelectBranch={setActiveBranchId}
          currentUser={currentUser}
          onNavigateScreen={(screenName) => setActiveTab(screenName)}
          expenses={transactions.filter(t => t.category === 'expense' || t.type === 'expense' || t.type === 'out')}
          purchases={purchaseInvoices}
          supplierPayments={supplierPayments}
          partners={partners}
          setPartners={handleSetPartners}
          partnerTransactions={partnerTransactions}
          setPartnerTransactions={setPartnerTransactions}
          setTransactions={handleSetTransactions}
          onRefresh={handleRefreshOwnerPortal}
          isRefreshing={isDbLoading}
          shiftData={shiftData}
          fingerprintLogs={fingerprintLogs}
        />
      );
      case 'ai_assistant':
      case 'manager_ai_chat': return (
        <ManagerAIChatScreen
          settings={settings}
          setSettings={setSettings}
          currentUser={currentUser}
          onNavigateScreen={(screenName) => setActiveTab(screenName)}
        />
      );
      default: return <div className="p-6">قريباً...</div>;
    }
  };

  const menuItems = [
    ...(currentUser?.role === 'programmer' ? [
      { id: 'saas_subscriptions', icon: Sliders, label: 'لوحة تحكم المطور' }
    ] : []),
    ...(currentUser?.role === 'owner' ? [
      { id: 'owner_portal', icon: Smartphone, label: 'نبض المالك' }
    ] : []),
    { id: 'pos', icon: Scissors, label: 'نقطة البيع (POS)' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
    { id: 'queue_calling', icon: Radio, label: 'المناداة وطابور الانتظار' },
    { id: 'bookings', icon: Calendar, label: 'الحجوزات' },
    { id: 'expenses', icon: Banknote, label: 'المصروفات' },
    { id: 'treasury', icon: Wallet, label: 'الخزائن والماليات' },
    { id: 'invoices', icon: Receipt, label: 'الفواتير' },
    { id: 'deferred_invoices', icon: Hourglass, label: 'الفواتير الآجلة والذمم' },
    { id: 'clients', icon: Users, label: 'العملاء' },
    { id: 'complaints', icon: AlertCircle, label: 'شكاوى العملاء' },
    { id: 'services', icon: List, label: 'الخدمات' },
    { id: 'warehouse', icon: Boxes, label: 'المخزن والاصناف' },
    { id: 'employees', icon: UsersRound, label: 'إدارة الموظفين' },
    { id: 'hr', icon: Clock, label: 'شؤون العاملين وسجل الدوام' },
    { id: 'partners', icon: Briefcase, label: 'الشركاء والأرباح والخسائر' },
    { id: 'reports', icon: FileText, label: 'التقارير الشاملة' },
    { id: 'daily_sheet', icon: TableProperties, label: 'الكشف اليومي' },
    { id: 'tips', icon: HeartHandshake, label: 'البقشيش والإكراميات' },
    { id: 'promo_codes', icon: Tag, label: 'البرومو كود والكوبونات' },
    { id: 'manager_ai_chat', icon: Bot, label: 'المساعد الذكي' },
    { id: 'permissions', icon: Shield, label: 'الصلاحيات والمستخدمين' },
    { id: 'settings', icon: Settings, label: 'اعدادات النظام' },
  ];


  // Helper login state handler
  const handleApplyLoginSuccess = async (u: AppUser, customSettings?: AppSettings, selectedBranch?: Branch) => {
    setCurrentUser(u);
    const dbSalons = await DB.fetchSalons();
    const salons = (dbSalons && dbSalons.length > 0) ? dbSalons : SubscriptionService.getSalons();
    const salon = u.salonId 
      ? (salons.find(s => s.id === u.salonId || s.code === (u as any).salonCode) || (u.salonId ? { id: u.salonId, name: (u as any).salonName || 'صالون', code: (u as any).salonCode || 'SC-01', phone: u.phone || '', country: 'المملكة العربية السعودية', currency: 'SAR', isActive: true } as any : null))
      : (salons.find(s => (u.email && s.email === u.email)) || null);

    if (salon) {
      setSubscription({
        id: salon.id,
        salonId: salon.id,
        salonCode: salon.code,
        organizationName: salon.name,
        ownerEmail: salon.email,
        phone: salon.phone,
        country: salon.country,
        plan: salon.subscriptionPlan || 'pro',
        status: salon.subscriptionStatus || 'trial',
        isActive: salon.isActive !== false,
        startDate: salon.subscriptionStartDate,
        endDate: salon.subscriptionEndDate,
        maxBranches: salon.maxBranches || 3,
        maxUsers: salon.maxUsers || 10,
        trialDays: salon.trialDays || 7
      });
      const dbBranches = await DB.fetchBranches(salon.id);
      const salonBranches = (dbBranches && dbBranches.length > 0) ? dbBranches : (salon.id ? SubscriptionService.getBranches(salon.id) : []);
      setBranches(salonBranches.length > 0 ? salonBranches : [
        { id: 'b-main', salonId: salon.id, name: `الفرع الرئيسي (${salon.name})`, code: 'B01', isMain: true, phone: salon.phone, address: salon.country, isActive: true, status: 'active' }
      ]);
      let branchIdToUse = 'b-main';
      if (u.branchId) {
        branchIdToUse = u.branchId;
        setActiveBranchId(u.branchId);
      } else if (selectedBranch) {
        branchIdToUse = selectedBranch.id;
        setActiveBranchId(selectedBranch.id);
      } else if (salonBranches.length > 0) {
        branchIdToUse = salonBranches[0].id;
        setActiveBranchId(salonBranches[0].id);
      }
      DB.getActiveWorkShift(salon.id, branchIdToUse).then(activeShift => {
        applyActiveWorkShift(activeShift, branchIdToUse);
      }).catch(() => {});
    } else if (u.branchId) {
      setActiveBranchId(u.branchId);
    }
    // تنظيف أي بيانات مؤقتة أو أكواد كيوسك لصالونات أخرى من التخزين المحلي
    try {
      localStorage.removeItem('smartcut_registered_salon_code');
      localStorage.removeItem('smartcut_kiosk_branch_id');
      localStorage.removeItem('smartcut_kiosk_is_locked');
      if (salon?.id) {
        localStorage.setItem('smartcut_active_salon_id', salon.id);
      }
    } catch (e) {}

    if (customSettings) {
      setSettings(customSettings);
      try {
        localStorage.setItem('smartcut_app_settings', JSON.stringify(customSettings));
      } catch (e) {}
    } else if (salon) {
      const dbSettings = await DB.fetchSettings(salon.id);
      setSettings(prev => {
        const isDifferentSalon = prev.salonId && prev.salonId !== salon.id;
        const base = isDifferentSalon ? {} : prev;
        const updated: AppSettings = {
          ...base,
          ...(dbSettings || {}),
          salonId: salon.id,
          salonCode: salon.code,
          salonName: (dbSettings?.salonName && dbSettings.salonName !== 'صالون سمارت كت') ? dbSettings.salonName : salon.name,
          logoUrl: (dbSettings?.logoUrl !== undefined && dbSettings.logoUrl !== null) ? dbSettings.logoUrl : (salon.logoUrl || ''),
          phone: salon.phone || dbSettings?.phone || '',
          country: salon.country || dbSettings?.country || 'المملكة العربية السعودية',
          currency: salon.currency || dbSettings?.currency || 'SAR',
          ownerEmail: salon.email || dbSettings?.ownerEmail || '',
          evolutionInstanceName: salon.evolutionInstanceName || dbSettings?.evolutionInstanceName || ''
        };
        try {
          localStorage.setItem('smartcut_app_settings', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }

    // Load essential data (products, categories, services, employees, clients) for the logged-in salon
    if (salon?.id) {
      try {
        localStorage.setItem('smartcut_active_salon_id', salon.id);
        const essentialData = await DB.loadEssentialData(salon.id);
        if (essentialData) {
          const validCats = essentialData.categories || [];
          setCategories(validCats.length ? validCats : [{ id: 'all', name: 'الكل' }]);
          setServices(essentialData.services ? essentialData.services.map(dbServiceToApp) : []);
          setEmployees(essentialData.employees ? essentialData.employees.map(dbEmployeeToApp) : []);
          setClients(essentialData.clients ? essentialData.clients.map(dbClientToApp) : []);
          setProducts(essentialData.products ? essentialData.products.map(dbProductToApp) : []);
          if (essentialData.suppliers) setSuppliers(essentialData.suppliers);
          if (essentialData.purchaseInvoices) setPurchaseInvoices(essentialData.purchaseInvoices);
          if (essentialData.supplierPayments) setSupplierPayments(essentialData.supplierPayments);
        }
        loadedSectionsRef.current.clear();
        loadedSectionsRef.current.add('pos');
        loadedSectionsRef.current.add('services');
        loadedSectionsRef.current.add('products');
        if (u.role === 'barber' || isBarberRoute || u.screens?.includes('barber_portal')) {
          DB.fetchBookings(salon.id).then(bList => {
            if (bList && bList.length > 0) {
              setBookings(bList.map(dbBookingToApp));
            }
          }).catch(() => {});
          DB.fetchInvoices(salon.id).then(dbInvs => {
            if (dbInvs && dbInvs.length > 0) {
              setInvoices(dbInvs.map(dbInvoiceToApp));
            }
          }).catch(() => {});
          DB.fetchSalesReturns(salon.id).then(returns => {
            if (returns && returns.length > 0) {
              setSalesReturns(returns);
            }
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Error loading essential data after login:', e);
      }
    }

    if (u.role === 'programmer') {
      setIsProgrammerPortalActive(true);
      setActiveTab('saas_subscriptions');
    } else if (u.role === 'owner') {
      setActiveTab('owner_portal');
    } else if (u.role === 'barber' || (u.screens?.includes('barber_portal') && !u.screens?.includes('*') && u.screens?.length === 1)) {
      setActiveTab('barber_portal');
    } else if (u.role === 'kiosk' || (u.screens?.includes('kiosk') && !u.screens?.includes('*') && u.screens?.length === 1)) {
      setActiveTab('kiosk');
    } else {
      const defaultAllowed = AuthService.canAccess('pos', u) ? 'pos' : (menuItems.find(item => AuthService.canAccess(item.id, u))?.id || 'dashboard');
      setActiveTab(defaultAllowed);
    }
  };

  // 2. STANDALONE BARBER & TECHNICIAN PORTAL ROUTE (/barber, /staff or barber role)
  if (isBarberRoute || currentUser?.role === 'barber' || (currentUser?.screens?.includes('barber_portal') && !currentUser?.screens?.includes('*') && currentUser?.screens?.length === 1)) {
    if (!currentUser || (currentUser.role !== 'barber' && currentUser.role !== 'admin' && currentUser.role !== 'programmer')) {
      return (
        <BarberLoginScreen
          onLoginSuccess={handleApplyLoginSuccess}
          salonName={settings.salonName}
          onSwitchToMainApp={() => {
            window.location.href = '/';
          }}
          onSwitchToOwnerPortal={() => {
            window.location.href = '/owner';
          }}
        />
      );
    }

    return (
      <BarberPortalScreen
        settings={settings}
        currentUser={currentUser}
        employees={employees}
        bookings={bookings}
        invoices={invoices}
        branches={branches}
        activeBranchId={activeBranchId}
        onCompleteBooking={async (bId) => {
          handleSetBookings((prev: Booking[]) => prev.map(b => b.id === bId ? { ...b, status: 'completed' } : b));
          const targetB = bookings.find(b => b.id === bId);
          if (targetB) {
            try {
              await completeBookingAndCreateHeldInvoice(targetB, settings.salonId, activeBranchId, clients);
            } catch (err) {
              console.warn('Error completing booking from App:', err);
            }
          }
        }}
        onLogout={() => {
          AuthService.logout();
          setCurrentUser(null);
        }}
      />
    );
  }

  // 3. STANDALONE ONLINE CLIENT RESERVATION PORTAL (/reservation or /booking)
  if (isReservationRoute) {
    return (
      <ClientReservationPortal
        settings={settings}
        branches={branches}
        services={services}
        employees={employees}
        categories={categories}
        bookings={bookings}
        clients={clients}
        onSaveClient={(newClient) => {
          handleSetClients((prev: Client[]) => [newClient, ...prev.filter(c => c.id !== newClient.id && c.phone !== newClient.phone)]);
        }}
        onSaveBooking={(newB) => {
          handleSetBookings((prev: Booking[]) => [newB, ...prev]);
          if (settings.whatsappEnabled !== false && settings.whatsappSettings?.sendBookingToClient) {
            EvolutionApiService.sendBookingConfirmationWhatsApp(settings, newB, newB.branchId || activeBranchId)
              .catch(err => console.error('Portal booking WhatsApp error:', err));
          }
        }}
        onCancelBooking={(bId) => {
          handleSetBookings((prev: Booking[]) => prev.map(b => b.id === bId ? { ...b, status: 'cancelled' } : b));
        }}
        onSwitchToMainApp={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // 3B. STANDALONE TABLET KIOSK CHECK-IN ROUTE (/kiosk or ?kiosk=true or dedicated kiosk user)
  const isDedicatedKioskUser = currentUser?.role === 'kiosk' || 
    (currentUser && currentUser.screens?.includes('kiosk') && !currentUser.screens?.includes('*') && currentUser.screens?.length === 1) || 
    activeTab === 'kiosk';

  if (isKioskRoute || (currentUser && isDedicatedKioskUser)) {
    return (
      <KioskTabletScreen
        currentUser={currentUser}
        settings={settings}
        branches={branches}
        clients={clients}
        onSaveClient={(newClient) => {
          handleSetClients((prev: Client[]) => [newClient, ...prev.filter(c => c.id !== newClient.id && c.phone !== newClient.phone)]);
        }}
        onSwitchToMainApp={() => {
          if (currentUser?.screens && currentUser.screens.length > 1 && !currentUser.screens.includes('*')) {
            const otherScreen = currentUser.screens.find(s => s !== 'kiosk');
            if (otherScreen) {
              setActiveTab(otherScreen);
              setIsKioskRoute(false);
              return;
            }
          }
          AuthService.logout();
          setCurrentUser(null);
          setIsKioskRoute(false);
          try {
            localStorage.removeItem('smartcut_registered_salon_code');
            localStorage.removeItem('smartcut_kiosk_branch_id');
            localStorage.removeItem('smartcut_kiosk_is_locked');
            window.history.replaceState({}, '', '/');
          } catch {}
        }}
      />
    );
  }

  // 4. STANDARD APP LOGIN SCREEN
  if (!currentUser) {
    return (
      <LoginScreen 
        onLoginSuccess={handleApplyLoginSuccess} 
        settings={settings}
        onOpenSaaSAdmin={() => {
          const adminUser = AuthService.quickLogin('admin');
          if (adminUser) {
            setCurrentUser(adminUser);
            setActiveTab('dashboard');
          }
        }}
      />
    );
  }


  // 3C. STANDALONE SAAS PROGRAMMER PORTAL (لوحة تحكم المطور)
  if (currentUser?.role === 'programmer' && (isProgrammerPortalActive || activeTab === 'saas_subscriptions')) {
    return (
      <SaaSProgrammerPortal
        onSwitchSalon={async (salon) => {
          await handleSwitchSalon(salon.id);
          setIsProgrammerPortalActive(false);
          setActiveTab('dashboard');
        }}
        onExitPortal={() => {
          setIsProgrammerPortalActive(false);
          setActiveTab('dashboard');
        }}
        onLogout={() => {
          AuthService.logout();
          setCurrentUser(null);
          setIsProgrammerPortalActive(false);
          setActiveTab('pos');
        }}
      />
    );
  }

  const handleTabNavigation = (tabId: string) => {
    if (tabId === 'saas_subscriptions') {
      setIsProgrammerPortalActive(true);
      setActiveTab('saas_subscriptions');
      return;
    }
    if (tabId === 'bookings' && !shiftData?.isOpen) {
      alert('الوردية مغلقة حالياً!\nلا يُسمح بفتح شاشة الحجوزات أو إجراء أي حجز إلا بعد فتح وردية عمل جديدة.');
      return;
    }
    setActiveTab(tabId);
  };

  const allowedMenuItems = menuItems.filter(item => AuthService.canAccess(item.id, currentUser));

  return (

    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden text-[13px] select-none">
      {/* 1. TOP SAAS SUBSCRIPTION & BRANCH BANNER */}
      <SubscriptionBanner
        subscription={subscription}
        branches={branches}
        activeBranchId={activeBranchId}
        onSelectBranch={setActiveBranchId}
        isCloudConnected={isCloudConnected}
        salonName={settings.salonName}
        currentUser={currentUser}
        allSalons={currentUser?.role === 'programmer' ? allSalons : []}
        onSelectSalon={currentUser?.role === 'programmer' ? handleSwitchSalon : undefined}
        onOpenPricingModal={() => setShowSubscriptionModal(true)}
        licenseInfo={licenseInfo}
        onOpenLicenseModal={() => setShowLicenseModal(true)}
        isTursoConnected={isTursoConnected}
        onOpenTursoModal={() => setShowTursoModal(true)}
        onOpenProgrammerPortal={() => {
          setIsProgrammerPortalActive(true);
          setActiveTab('saas_subscriptions');
        }}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* 2. DESKTOP SIDEBAR (Hidden by default, toggled via button) */}
        {showSidebar && (
          <aside className="hidden lg:flex w-64 bg-white border-l border-slate-200 shadow-sm flex-col z-20 animate-in slide-in-from-right duration-200">
            <div className="p-4 flex items-center gap-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Scissors size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-extrabold text-sm tracking-tight text-slate-900 leading-none truncate">
                  {settings.salonName || 'SMART CUT'}
                </h1>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={10} />
                    <span>v2.0 PRO SaaS</span>
                  </p>
                  {licenseInfo && (
                    <button
                      onClick={() => setShowLicenseModal(true)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black border transition-all cursor-pointer ${
                        !licenseInfo.isLicensed || licenseInfo.status === 'expired'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : licenseInfo.status === 'tampered'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : licenseInfo.mode === 'lifetime'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : (licenseInfo.daysLeft !== null && licenseInfo.daysLeft <= 5)
                          ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                      title="حالة ترخيص البرنامج"
                    >
                      <span>
                        {!licenseInfo.isLicensed || licenseInfo.status === 'expired'
                          ? 'الترخيص منتهي'
                          : licenseInfo.mode === 'lifetime'
                          ? 'مرخص دائم'
                          : licenseInfo.daysLeft !== null
                          ? `متبقي ${licenseInfo.daysLeft} يوم للتفعيل`
                          : licenseInfo.runsLeft !== null
                          ? `متبقي ${licenseInfo.runsLeft} تشغيل`
                          : 'مرخص'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
              {allowedMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabNavigation(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-right ${
                      isActive 
                        ? 'bg-emerald-600 text-white font-extrabold shadow-md shadow-emerald-600/20 translate-x-1' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-xs">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* User profile & Logout */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/50">
              <div className="relative">
                <div 
                  onClick={() => setShowUserSidebarMenu(!showUserSidebarMenu)}
                  className="flex items-center justify-between mb-2 p-2 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group select-none"
                  title="خيارات الحساب"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-800 border border-sky-200/80 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                      {getUserInitials(currentUser.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 leading-tight truncate group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                        <span>{currentUser.name}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">{ROLE_LABELS[currentUser.role] || currentUser.role}</p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition-colors shrink-0">
                    <ChevronUp size={12} className={`transition-transform duration-200 ${showUserSidebarMenu ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                <UserAccountMenu
                  isOpen={showUserSidebarMenu}
                  onClose={() => setShowUserSidebarMenu(false)}
                  currentUser={currentUser}
                  onProfileClick={() => {
                    setShowUserSidebarMenu(false);
                    setShowUserProfileModal(true);
                  }}
                  onChangePasswordClick={() => {
                    setShowUserSidebarMenu(false);
                    setShowChangePasswordModal(true);
                  }}
                  onSettingsClick={handleOpenSettingsFromUserMenu}
                  onLogoutClick={handleLogout}
                  onProgrammerPortalClick={() => {
                    setShowUserSidebarMenu(false);
                    setIsProgrammerPortalActive(true);
                    setActiveTab('saas_subscriptions');
                  }}
                  align="top-start"
                />
              </div>

              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                <span>تسجيل الخروج</span>
              </button>

              <div className="mt-2 pt-2 border-t border-slate-100 text-center text-[10px] text-slate-400 font-mono tracking-tight" dir="ltr">
                <span>By Eng. Tamer Mostafa | </span>
                <a
                  href={`https://wa.me/201014889704?text=${encodeURIComponent('ارغب في الاستفسار عن برنامج Smart Cut V2')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors hover:underline inline-flex items-center gap-1"
                  title="تواصل عبر واتساب"
                >
                  +201014889704
                </a>
              </div>
            </div>
          </aside>
        )}

        {/* 3. MOBILE SIDEBAR DRAWER OVERLAY */}
        {showSidebar && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowSidebar(false)}
            />
            <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
              <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Scissors size={18} />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-xs text-slate-900">{settings.salonName}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <p className="text-[10px] text-emerald-600 font-bold">SMART CUT PRO</p>
                      {licenseInfo && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {licenseInfo.daysLeft !== null
                            ? `متبقي ${licenseInfo.daysLeft} يوم للتفعيل`
                            : licenseInfo.mode === 'lifetime'
                            ? 'مرخص دائم'
                            : 'مرخص'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowSidebar(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {allowedMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleTabNavigation(item.id);
                        if (item.id !== 'bookings' || shiftData?.isOpen) {
                          setShowSidebar(false);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right text-xs font-bold transition-all ${
                        isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-slate-100 bg-slate-50">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>تسجيل الخروج</span>
                </button>

                <div className="mt-2 text-center text-[10px] text-slate-400 font-mono tracking-tight" dir="ltr">
                  <span>By Eng. Tamer Mostafa | </span>
                  <a
                    href={`https://wa.me/201014889704?text=${encodeURIComponent('ارغب في الاستفسار عن برنامج Smart Cut V2')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors hover:underline inline-flex items-center gap-1"
                    title="تواصل عبر واتساب"
                  >
                    +201014889704
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col h-full overflow-hidden pb-14 lg:pb-0">
          {/* Header Topbar */}
          <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 shadow-xs z-10 shrink-0">
            <div className="flex items-center gap-3">
              {/* Sidebar Toggle Button (Desktop & Mobile) */}
              <button
                onClick={() => setShowSidebar(prev => !prev)}
                className="p-2 rounded-xl text-slate-700 bg-slate-50 hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs"
                title={showSidebar ? "إخفاء القائمة الجانبية" : "إظهار القائمة الجانبية"}
              >
                {showSidebar ? <X size={18} className="text-red-500" /> : <Menu size={18} />}
                <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                  {showSidebar ? 'إخفاء القائمة' : 'القائمة'}
                </span>
              </button>

              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>{menuItems.find(m => m.id === activeTab)?.label}</span>
              </h2>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* License Status Pill Button */}
              {isOnlineSaaSMode ? (
                <a
                  href={`https://wa.me/201014889704?text=${encodeURIComponent(`السلام عليكم، استفسار بخصوص اشتراك صالون (${subscription.organizationName || settings.salonName}) كود: ${subscription.salonCode || settings.salonCode || ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-xs active:scale-95 ${
                    isSubscriptionBlocked
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200 animate-pulse'
                      : isExpiringSoon
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 animate-pulse'
                      : subscription.status === 'trial'
                      ? 'bg-sky-100 text-sky-900 border border-sky-300 hover:bg-sky-200'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 shadow-sm'
                  }`}
                  title="حالة اشتراك الصالون السحابي - انقر للتواصل وتجديد الاشتراك"
                >
                  <ShieldCheck size={14} className={isSubscriptionBlocked ? 'text-rose-600' : isExpiringSoon ? 'text-amber-700' : 'text-emerald-700'} />
                  <span>
                    {isSubscriptionBlocked
                      ? 'الاشتراك منتهي (قراءة فقط)'
                      : isExpiringSoon
                      ? `متبقي ${onlineSubscriptionDaysLeft} ${onlineSubscriptionDaysLeft === 1 ? 'يوم' : 'أيام'} للتجديد`
                      : subscription.status === 'trial'
                      ? `تجريبي (${onlineSubscriptionDaysLeft !== null ? `${onlineSubscriptionDaysLeft} يوم` : 'نشط'})`
                      : `اشتراك نشط (${onlineSubscriptionDaysLeft !== null ? `${onlineSubscriptionDaysLeft} يوم` : 'مفعل'})`}
                  </span>
                </a>
              ) : (
                <button
                  onClick={() => setShowLicenseModal(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-xs active:scale-95 ${
                    !licenseInfo || !licenseInfo.isLicensed || licenseInfo.status === 'expired'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200 animate-pulse'
                      : licenseInfo.status === 'tampered'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                      : (licenseInfo.daysLeft !== null && licenseInfo.daysLeft <= 4)
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 animate-pulse'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 shadow-sm'
                  }`}
                  title="حالة ترخيص وتفعيل البرنامج - انقر للتجديد أو إدخال كود التفعيل"
                >
                  <ShieldCheck size={14} className={!licenseInfo || !licenseInfo.isLicensed || licenseInfo.status === 'expired' ? 'text-rose-600' : 'text-emerald-700'} />
                  <span>
                    {!licenseInfo
                      ? 'فحص الترخيص...'
                      : licenseInfo.status === 'tampered'
                      ? 'مراجعة الترخيص'
                      : !licenseInfo.isLicensed || licenseInfo.status === 'expired'
                      ? 'مطلوب التفعيل'
                      : licenseInfo.mode === 'lifetime'
                      ? 'مفعل مدى الحياة'
                      : licenseInfo.mode === 'days'
                      ? `مفعل لمدة ${licenseInfo.daysLeft} يوم`
                      : licenseInfo.mode === 'runs'
                      ? `مفعل لـ ${licenseInfo.runsLeft} تشغيلة`
                      : licenseInfo.mode === 'trial_auto'
                      ? `مفعل تجريبياً (${licenseInfo.daysLeft} يوم)`
                      : `مفعل (${licenseInfo.daysLeft || 0} يوم)`}
                  </span>
                </button>
              )}

              {/* Shift Status Pill */}
              <div 
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all shadow-2xs select-none ${
                  shiftData.isOpen 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100/70' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
                title={shiftDisplayInfo ? `تاريخ الوردية: ${shiftDisplayInfo.date}\nكود الوردية: ${shiftDisplayInfo.code}\nالمستخدم: ${shiftDisplayInfo.userName}` : 'الوردية مغلقة'}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${shiftData.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {shiftData.isOpen && shiftDisplayInfo ? (
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="font-extrabold text-emerald-700">تاريخ الوردية:</span>
                    <span className="font-mono font-black text-emerald-950 bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-xs shadow-2xs">
                      {shiftDisplayInfo.date}
                    </span>
                    <span className="font-mono font-black text-emerald-900 bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px] tracking-wide" dir="ltr">
                      ({shiftDisplayInfo.code})
                    </span>
                    <span className="text-emerald-300 font-normal">|</span>
                    <span className="text-emerald-700 font-bold text-[11px]">المستخدم:</span>
                    <span className="font-extrabold text-emerald-950 text-xs">{shiftDisplayInfo.userName}</span>
                  </div>
                ) : (
                  <span className="font-extrabold text-[11px]">الوردية مغلقة</span>
                )}
              </div>

              {AuthService.canDo('manage_shifts', currentUser) && (
                <button 
                  onClick={async () => {
                    if (shiftData.isOpen || branchShifts[activeBranchId]?.isOpen) {
                      setShowCloseModal(true);
                      return;
                    }
                    try {
                      const activeDbShift = await DB.getActiveWorkShift(settings.salonId, activeBranchId);
                      if (activeDbShift && (activeDbShift.status === 'open' || !activeDbShift.closedAt)) {
                        applyActiveWorkShift(activeDbShift, activeBranchId);
                        alert(`توجد وردية مفتوحة بالفعل لهذا الفرع (كود الوردية: ${activeDbShift.shiftCode || activeDbShift.id}). يرجى إغلاقها أولاً قبل فتح وردية جديدة.`);
                        setShowCloseModal(true);
                        return;
                      }
                    } catch (e) {}
                    setShowOpenModal(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs shadow-xs transition-all active:scale-95 cursor-pointer ${
                    shiftData.isOpen ? 'bg-slate-800 hover:bg-slate-900 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {shiftData.isOpen ? 'إغلاق الوردية' : 'فتح الوردية'}
                </button>
              )}

              <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1"></div>

              {/* User Avatar & Name */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserHeaderMenu(!showUserHeaderMenu)}
                  className="flex items-center gap-2 p-1.5 -mr-1.5 rounded-xl hover:bg-slate-100/90 active:bg-slate-200/80 transition-all cursor-pointer group border border-transparent hover:border-slate-200 text-right select-none"
                  title="خيارات الحساب"
                >
                  <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-800 border border-sky-200/80 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                    {getUserInitials(currentUser.name)}
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-xs font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                      <span>{currentUser.name}</span>
                      <ChevronDown size={11} className={`text-slate-400 group-hover:text-indigo-500 transition-transform duration-200 ${showUserHeaderMenu ? 'rotate-180' : ''}`} />
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold">{ROLE_LABELS[currentUser.role] || currentUser.role}</p>
                  </div>
                </button>

                <UserAccountMenu
                  isOpen={showUserHeaderMenu}
                  onClose={() => setShowUserHeaderMenu(false)}
                  currentUser={currentUser}
                  onProfileClick={() => {
                    setShowUserHeaderMenu(false);
                    setShowUserProfileModal(true);
                  }}
                  onChangePasswordClick={() => {
                    setShowUserHeaderMenu(false);
                    setShowChangePasswordModal(true);
                  }}
                  onSettingsClick={handleOpenSettingsFromUserMenu}
                  onLogoutClick={handleLogout}
                  onProgrammerPortalClick={() => {
                    setShowUserHeaderMenu(false);
                    setIsProgrammerPortalActive(true);
                    setActiveTab('saas_subscriptions');
                  }}
                  align="bottom-start"
                />
              </div>
            </div>
          </header>

          {/* Main Body */}
          <div className={`flex-1 flex flex-col bg-slate-100 relative ${activeTab === 'owner_portal' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}>
            {/* Top License Warning & Read-Only Banners */}
            {isSubscriptionBlocked ? (
              /* Red Banner: Read-Only Mode & Expired Subscription */
              <div className="bg-gradient-to-r from-red-700 via-rose-800 to-red-700 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-bold border-b-2 border-red-950 z-30 shrink-0 shadow-lg animate-in fade-in" dir="rtl">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0"></span>
                  <span className="leading-relaxed">
                    <strong>تم تحويل البرنامج إلى وضع القراءة فقط:</strong> انتهت صلاحية اشتراك الصالون ({subscription.organizationName || settings.salonName}) بتاريخ {subscription.endDate || settings.subscriptionEndDate}. يُمنع نهائياً تسجيل أي فواتير جديدة أو إجراء أي إضافة أو تعديل في كافة بيانات النظام لحين تجديد الاشتراك.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOnlineSaaSMode ? (
                    <a
                      href={`https://wa.me/201014889704?text=${encodeURIComponent(`السلام عليكم، ارغب في تجديد اشتراك صالون (${subscription.organizationName || settings.salonName}) كود: ${subscription.salonCode || settings.salonCode || ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-1.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 animate-pulse"
                    >
                      <MessageSquare size={14} className="text-slate-900" />
                      <span>تجديد الاشتراك الآن عبر واتساب</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => setShowLicenseModal(true)}
                      className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-1.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 animate-pulse"
                    >
                      <Key size={14} className="text-slate-900" />
                      <span>تجديد / تفعيل الترخيص الآن</span>
                    </button>
                  )}
                  <span className="bg-black/30 border border-white/20 text-white px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0">
                    وضع القراءة فقط
                  </span>
                </div>
              </div>
            ) : isExpiringSoon ? (
              /* Yellow Banner: Warning 4 days before expiration */
              <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-amber-950 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-bold border-b border-amber-500 z-30 shrink-0 shadow-sm animate-in fade-in" dir="rtl">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-700 animate-pulse shrink-0"></span>
                  <span>
                    <strong>تنبيه بقرب انتهاء الاشتراك:</strong> متبقي <strong>{isOnlineSaaSMode ? onlineSubscriptionDaysLeft : licenseInfo?.daysLeft}</strong> {(isOnlineSaaSMode ? onlineSubscriptionDaysLeft : licenseInfo?.daysLeft) === 1 ? 'يوم واحد' : (isOnlineSaaSMode ? onlineSubscriptionDaysLeft : licenseInfo?.daysLeft) === 2 ? 'يومان' : 'أيام'} على انتهاء صلاحية اشتراك الصالون (تاريخ الانتهاء: {subscription.endDate || settings.subscriptionEndDate}). يرجى سداد رسوم التجديد لضمان استمرار عمل النظام دون انقطاع وتجنب تحوله إلى وضع القراءة فقط.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOnlineSaaSMode ? (
                    <a
                      href={`https://wa.me/201014889704?text=${encodeURIComponent(`السلام عليكم، ارغب في تجديد اشتراك صالون (${subscription.organizationName || settings.salonName}) كود: ${subscription.salonCode || settings.salonCode || ''} قبل الانتهاء`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-900 hover:bg-slate-800 text-amber-300 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Zap size={13} className="text-amber-400" />
                      <span>تجديد الاشتراك الآن</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => setShowLicenseModal(true)}
                      className="bg-slate-900 hover:bg-slate-800 text-amber-300 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Key size={13} className="text-amber-400" />
                      <span>تجديد الاشتراك / إدخال كود التفعيل</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {renderScreen()}
          </div>

          {/* Application Global Footer */}
          {activeTab !== 'manager_ai_chat' && activeTab !== 'ai_assistant' && (
            <footer className="h-7 bg-white/95 border-t border-slate-200 px-4 flex items-center justify-between text-[11px] text-slate-500 shrink-0 select-none z-10 print:hidden font-sans" dir="ltr">
              <div className="flex items-center gap-1.5 font-mono text-slate-700">
                <span className="font-bold text-slate-900">By Eng. Tamer Mostafa</span>
                <span className="text-slate-400">|</span>
                <a 
                  href={`https://wa.me/201014889704?text=${encodeURIComponent('ارغب في الاستفسار عن برنامج Smart Cut V2')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors hover:underline inline-flex items-center gap-1"
                  dir="ltr"
                  title="تواصل عبر واتساب"
                >
                  +201014889704
                </a>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400" dir="rtl">
                <span>{settings.salonName || 'Smart Cut'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>الإصدار V2.0</span>
              </div>
            </footer>
          )}
        </main>
      </div>

      {/* 5. MOBILE BOTTOM NAVIGATION */}
      {activeTab !== 'manager_ai_chat' && activeTab !== 'ai_assistant' && (
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMobileMenu={() => setShowMobileSidebar(true)}
          canAccess={screen => AuthService.canAccess(screen, currentUser)}
        />
      )}

      {/* 6. CLOSE SHIFT MODAL & Z-REPORT */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-8 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-base text-slate-800">إغلاق الوردية الحالية (Z-Report)</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">مراجعة أرقام الوردية ومطابقة النقدية بالدرج قبل الإغلاق</p>
              </div>
            </div>
            <div className="p-4 overflow-hidden flex justify-center bg-slate-100 max-h-[60vh] overflow-y-auto">
              <div id="shift-closing-report-receipt-container" className="bg-white shadow-sm p-4 w-full rounded-2xl">
                <ClosingReportReceipt 
                  settings={settings}
                  shiftCode={(shiftData as any)?.shiftCode}
                  transactions={transactions.filter(t => (t.shiftDate && shiftData.date && t.shiftDate === shiftData.date) || t.date.startsWith(shiftData.date))}
                  invoices={invoices.filter(i => (i.shiftDate && shiftData.date && i.shiftDate === shiftData.date) || i.date.startsWith(shiftData.date))}
                  dateLabel={shiftData.date}
                  initialCash={shiftData.initialCash}
                  userName={currentUser?.name || settings.ownerName || 'المسؤول'}
                  employees={employees}
                  fingerprintLogs={fingerprintLogs}
                />
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => handlePrintClosingShiftReport(settings.paperSize || '80mm')}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow active:scale-[0.99] cursor-pointer"
                  title="طباعة إيصال التقرير لطابعة الإيصالات الحرارية (80mm / 58mm)"
                >
                  <Printer size={15} className="text-emerald-400" />
                  <span>معاينة / طباعة تقرير حراري</span>
                </button>
                <button 
                  type="button"
                  onClick={() => handlePrintClosingShiftReport('a4')}
                  className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-extrabold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1 text-xs shadow-xs active:scale-[0.99] cursor-pointer whitespace-nowrap"
                  title="طباعة التقرير على ورق A4 عادي"
                >
                  <FileText size={14} className="text-slate-500" />
                  <span>A4</span>
                </button>
              </div>

              {/* أزرار الإجراءات: زر تراجع وزر إغلاق فقط كما طلب المستخدم */}
              <div className="flex items-center gap-3 pt-1">
                <button 
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-extrabold py-3 rounded-xl transition-all text-xs border border-slate-300 shadow-xs cursor-pointer active:scale-[0.99] text-center"
                >
                  تراجع
                </button>
                <button 
                  type="button"
                  disabled={isClosingShift}
                  onClick={handleConfirmCloseShift}
                  className={`flex-1 bg-red-600 hover:bg-red-700 text-white font-extrabold py-3 rounded-xl transition-all text-xs shadow-md cursor-pointer active:scale-[0.99] text-center flex items-center justify-center gap-1.5 ${isClosingShift ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isClosingShift ? 'جارٍ إغلاق الوردية...' : 'إغلاق الوردية'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. OPEN SHIFT MODAL */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-800">فتح وردية جديدة</h3>
              <p className="text-xs text-slate-400 mt-0.5">تسجيل تاريخ الوردية والعهدة النقدية الأولية</p>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">تاريخ الوردية</label>
                <input 
                  type="date" 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-semibold text-slate-800 outline-none focus:border-emerald-500 bg-slate-50"
                  value={openShiftForm.date}
                  onChange={e => setOpenShiftForm({...openShiftForm, date: e.target.value})}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">العهدة الافتتاحية (كاش الدرج)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className="w-full border border-slate-200 rounded-xl pr-3 pl-12 py-2.5 font-bold text-slate-800 outline-none focus:border-emerald-500 bg-slate-50"
                    value={openShiftForm.initialCash || ''}
                    onChange={e => setOpenShiftForm({...openShiftForm, initialCash: Number(e.target.value)})}
                    placeholder="0.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{settings.currency}</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button 
                onClick={() => setShowOpenModal(false)} 
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={handleOpenShift} 
                className="flex-1 py-2.5 text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-md transition-all"
              >
                تأكيد وفتح الوردية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. SOFTWARE LICENSE MODAL */}
      <LicenseModal
        isOpen={showLicenseModal}
        licenseInfo={licenseInfo}
        onClose={() => setShowLicenseModal(false)}
        onActivated={(updated) => {
          setLicenseInfo(updated);
          localStorage.setItem('smartcut_license_readonly', 'false');
          setShowLicenseModal(false);
        }}
      />

      {/* 8. TURSO DISTRIBUTED CLOUD SYNC MODAL */}
      <TursoCloudSyncModal
        isOpen={showTursoModal}
        onClose={() => setShowTursoModal(false)}
        onSyncTriggered={() => {
          setIsTursoConnected(true);
          setIsCloudConnected(true);
        }}
      />

      {/* 9. INITIAL SALON SETUP MODAL */}
      <InitialSalonSetupModal
        isOpen={showInitialSalonModal && !showLicenseModal}
        onComplete={(newSettings, mainBranch) => {
          setSettings(newSettings);
          setBranches([mainBranch]);
          setActiveBranchId(mainBranch.id);
          setSubscription(prev => ({
            ...prev,
            id: newSettings.salonId,
            salonId: newSettings.salonId,
            salonCode: newSettings.salonCode || '',
            organizationName: newSettings.salonName,
            country: newSettings.country,
            currency: newSettings.currency,
            plan: 'trial',
            status: 'trial',
            isActive: true,
            maxBranches: 1,
            maxUsers: 5,
            trialDays: 7
          }));

          if (!currentUser) {
            const adminUser = AuthService.getUsers().find(u => u.username === 'admin') || {
              id: 'admin_user',
              name: 'مدير النظام',
              username: 'admin',
              role: 'owner',
              active: true,
              screens: ['*'],
              actions: ['*'],
              salonId: newSettings.salonId,
              branchId: mainBranch.id
            };
            const updatedAdmin = { ...adminUser, salonId: newSettings.salonId, branchId: mainBranch.id };
            AuthService.setSession(updatedAdmin);
            setCurrentUser(updatedAdmin);
          } else {
            setCurrentUser(prev => prev ? ({ ...prev, salonId: newSettings.salonId, branchId: mainBranch.id }) : null);
          }
          setShowInitialSalonModal(false);
        }}
      />

      {/* Change Password Modal */}
      {currentUser && (
        <ChangePasswordModal
          isOpen={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
          currentUser={currentUser}
          onSuccess={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
        />
      )}

      {/* User Profile Modal */}
      {currentUser && (
        <UserProfileModal
          isOpen={showUserProfileModal}
          onClose={() => setShowUserProfileModal(false)}
          currentUser={currentUser}
          activeBranch={branches.find(b => b.id === (currentUser.branchId || activeBranchId)) || branches[0]}
          onChangePasswordClick={() => {
            setShowUserProfileModal(false);
            setShowChangePasswordModal(true);
          }}
        />
      )}

    </div>
  );
}
