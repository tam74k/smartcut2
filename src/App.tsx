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
  AlertCircle, Smartphone, ShieldAlert, Tag, HeartHandshake, Briefcase, Fingerprint, Radio
} from 'lucide-react';
import { POSScreen } from './components/POSScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { HRScreen } from './components/HRScreen';
import { EmployeesScreen } from './components/EmployeesScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { OwnerExecutivePortal } from './components/OwnerExecutivePortal';
import { BookingsScreen } from './components/BookingsScreen';
import { InvoicesScreen } from './components/InvoicesScreen';
import { ClientsScreen } from './components/ClientsScreen';
import { ComplaintsScreen } from './components/ComplaintsScreen';
import { TreasuryScreen } from './components/TreasuryScreen';
import { ExpensesScreen } from './components/ExpensesScreen';
import { ClosingReportReceipt } from './components/ClosingReportReceipt';
import { ReportsScreen } from './components/ReportsScreen';
import { SuppliersScreen } from './components/SuppliersScreen';
import { PurchasesScreen } from './components/PurchasesScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { ServicesScreen } from './components/ServicesScreen';
import { ProductsScreen } from './components/ProductsScreen';
import { PermissionsScreen } from './components/PermissionsScreen';
import { EmployeeAnalyticsScreen } from './components/EmployeeAnalyticsScreen';
import { WarehouseScreen } from './components/WarehouseScreen';
import { SaaSSubscriptionsScreen } from './components/SaaSSubscriptionsScreen';
import { SaaSProgrammerPortal } from './components/SaaSProgrammerPortal';
import { PartnersScreen } from './components/PartnersScreen';
import { PromoCodesScreen } from './components/PromoCodesScreen';
import { TipsScreen } from './components/TipsScreen';
import { FingerprintLogsScreen } from './components/FingerprintLogsScreen';
import { LoginScreen } from './components/LoginScreen';
import { BarberLoginScreen } from './components/BarberLoginScreen';
import { BarberPortalScreen } from './components/BarberPortalScreen';
import { ClientReservationPortal } from './components/ClientReservationPortal';
import { KioskTabletScreen } from './components/KioskTabletScreen';
import { QueueCallingScreen } from './components/QueueCallingScreen';
import { SubscriptionPlansModal } from './components/SubscriptionPlansModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { printQueueSlipDirect } from './utils/printQueueSlip';
import { AuthService, ROLE_LABELS } from './services/auth';
import { SupabaseService } from './services/supabase';
import { DB, dbClientToApp, dbEmployeeToApp, dbServiceToApp, toCamel } from './services/db';
import { SubscriptionService } from './services/subscriptionService';
import { QueueService } from './services/queueService';
import { 
  AppSettings, Transaction, Booking, Invoice, ServiceItem, Category, Employee, Product, AppUser, 
  SaaSSubscription, Branch, Partner, PartnerTransaction, PromoCode, PromoCodeUsage, TipRecord, 
  EmployeeCustody, FingerprintLog, WorkShift, Client, HeldInvoice 
} from './types';


export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Dedicated Route for Standalone Barber & Technician Portal (/barber or /staff)
  const [isBarberRoute, setIsBarberRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return path.endsWith('/barber') || path.includes('/barber/') || path.endsWith('/staff') || path.includes('/staff/') || hash.includes('barber') || search.includes('barber') || search.includes('portal=barber');
  });

  // Dedicated Route for Standalone Online Client Reservation Portal (/reservation, /booking, or ?salonCode)
  const isReservationQuery = () => {
    if (typeof window === 'undefined') return false;
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

  // Dedicated Route for Standalone Tablet Kiosk Check-In (/kiosk, ?kiosk=true, #kiosk)
  const isKioskQuery = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    if (path.endsWith('/kiosk') || path.includes('/kiosk/') || path.endsWith('/queue') || path.includes('/queue/')) return true;
    if (hash.includes('kiosk') || hash.includes('queue') || search.includes('kiosk') || search.includes('portal=kiosk')) return true;
    return false;
  };

  const [isReservationRoute, setIsReservationRoute] = useState<boolean>(isReservationQuery);
  const [isKioskRoute, setIsKioskRoute] = useState<boolean>(isKioskQuery);

  useEffect(() => {
    const checkRoutes = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      setIsBarberRoute(path.endsWith('/barber') || path.includes('/barber/') || path.endsWith('/staff') || path.includes('/staff/') || hash.includes('barber') || search.includes('barber') || search.includes('portal=barber'));
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
      const saved = localStorage.getItem('smartcut_app_settings');
      if (saved) return JSON.parse(saved);
      const regSalons = SubscriptionService.getSalons();
      if (regSalons.length > 0) {
        const s = regSalons[0];
        const sBranches = SubscriptionService.getBranches(s.id);
        const firstBranch = sBranches[0];
        return {
          salonId: s.id,
          salonCode: s.code,
          branchId: firstBranch?.id || '',
          branchCode: firstBranch?.code || 'BR-01',
          salonName: s.name,
          salonType: s.salonType || (s as any).salon_type || 'men',
          taxNumber: '',
          commercialReg: '',
          vatEnabled: true,
          vatRate: 15,
          currency: s.currency || 'SAR',
          country: s.country || 'المملكة العربية السعودية',
          waInstantName: '',
          waApiKey: '',
          printerName: 'طابعة الكاشير',
          paperSize: '80mm',
          printAutomatically: false,
          zatcaEnabled: false,
          receiptHeaderNote: 'أهلاً بكم في صالونكم المميز',
          receiptFooterNote: 'شكراً لزيارتكم ونسعد بخدمتكم دائماً',
          logoUrl: s.logoUrl || '',
          phone: s.phone || '',
          address: s.address || '',
          expenseCategories: ['إيجار', 'كهرباء ومياه', 'صيانة ومطبوعات', 'أدوات ومستهلكات', 'ضيافة ونظافة', 'أخرى'],
          bookingNotes: '',
          showDashboardAnalytics: true,
          showEmployeeAnalytics: true,
          treasuries: [
            { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
            { id: 'cash', name: 'كاش (الدرج)', isMain: false },
            { id: 'card', name: 'شبكة / فيزا', isMain: false },
          ]
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
      vatEnabled: true,
      vatRate: 15,
      currency: 'SAR',
      country: 'المملكة العربية السعودية',
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
      treasuries: [
        { id: 'main', name: 'الخزنة الرئيسية', isMain: true },
        { id: 'cash', name: 'كاش (الدرج)', isMain: false },
        { id: 'card', name: 'شبكة / فيزا', isMain: false },
      ]
    };
  });

  // SaaS Subscription & Branches State
  const [subscription, setSubscription] = useState<SaaSSubscription>(() => {
    try {
      const savedSettings = localStorage.getItem('smartcut_app_settings');
      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        if (s.salonName) {
          const salons = SubscriptionService.getSalons();
          const salon = s.salonId ? salons.find((item: any) => item.id === s.salonId) : salons.find((item: any) => item.name === s.salonName);
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
      const savedSettings = localStorage.getItem('smartcut_app_settings');
      const sId = savedSettings ? JSON.parse(savedSettings).salonId : '';
      if (sId) {
        const list = SubscriptionService.getBranches(sId);
        if (list && list.length > 0) return list;
      }
      const allBranches = SubscriptionService.getBranches();
      if (allBranches && allBranches.length > 0) return allBranches;
    } catch (e) {}
    return [];
  });

  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    try {
      const savedSettings = localStorage.getItem('smartcut_app_settings');
      const sId = savedSettings ? JSON.parse(savedSettings).salonId : '';
      if (sId) {
        const list = SubscriptionService.getBranches(sId);
        if (list && list.length > 0) return list[0].id;
      }
      const allBranches = SubscriptionService.getBranches();
      if (allBranches && allBranches.length > 0) return allBranches[0].id;
    } catch (e) {}
    return 'b-main';
  });

  const [allSalons, setAllSalons] = useState<any[]>(() => SubscriptionService.getSalons());

  // Shift State scoped per active branch & persisted in localStorage + Supabase
  const [branchShifts, setBranchShifts] = useState<Record<string, { isOpen: boolean, date: string, initialCash: number, shiftId?: string }>>(() => {
    try {
      const saved = localStorage.getItem('smartcut_work_shifts_state');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const shiftData = branchShifts[activeBranchId] || { isOpen: false, date: '', initialCash: 0 };
  const setShiftData = (updater: any) => {
    setBranchShifts(prev => {
      const current = prev[activeBranchId] || { isOpen: false, date: '', initialCash: 0 };
      const next = typeof updater === 'function' ? updater(current) : updater;
      const updated = { ...prev, [activeBranchId]: next };
      try { localStorage.setItem('smartcut_work_shifts_state', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [openShiftForm, setOpenShiftForm] = useState({ date: new Date().toISOString().split('T')[0], initialCash: 0 });

  // Global In-Memory Stores
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([{ id: 'all', name: 'الكل' }]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeBookingForPOS, setActiveBookingForPOS] = useState<Booking | null>(null);
  const [activeHeldInvoiceForPOS, setActiveHeldInvoiceForPOS] = useState<HeldInvoice | null>(null);
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

  // Refs to prevent duplicate initialization and redundant fetches
  const hasInitializedRef = useRef<boolean>(false);
  const loadedSectionsRef = useRef<Set<string>>(new Set());

  // Function to apply tab section data into state
  const applySectionData = useCallback((section: string, data: any) => {
    if (!data) return;
    if (data.invoices) {
      setInvoices(data.invoices.map((inv: any) => ({
        ...inv,
        vatAmount: inv.vat,
        cashbackUsed: inv.cashbackUsed ?? 0,
        paymentMethods: inv.paymentMethods || [],
        isRemedyInvoice: inv.isRemedy || false,
        remedyReason: inv.remedyNotes || '',
        relatedComplaintId: inv.relatedComplaintId || '',
        originalInvoiceId: inv.originalInvoiceId || '',
        zatcaQr: inv.zatcaQr || '',
        zatcaHash: inv.zatcaHash || '',
        etaSubmissionUuid: inv.etaSubmissionUuid || '',
      })));
    }
    if (data.transactions) {
      setTransactions(data.transactions.map((t: any) => ({
        ...t, expenseCategory: t.expenseCategory || '', createdBy: t.createdBy || '',
        userId: t.userId || '', userName: t.userName || '', shiftDate: t.shiftDate || ''
      })));
    }
    if (data.bookings) {
      setBookings(data.bookings.map((b: any) => ({
        ...b, phone: b.clientPhone || b.phone || '',
        customerEmail: b.customerEmail || '', advancePayments: b.advancePayments || []
      })));
    }
    if (data.clients) {
      setClients(data.clients.map(dbClientToApp));
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
  }, []);

  // ── 1. Single Mount Startup Lifecycle (Strictly Once) ──────────────────────────
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // تنظيف شامل لأي بيانات تجريبية سابقة من التخزين المحلي لضمان بدء النظام نظيفاً 100%
    try {
      const keysToCheck = [
        'smartcut_client_complaints', 'smartcut_clients', 'smartcut_invoices',
        'smartcut_transactions', 'smartcut_bookings', 'smartcut_employees',
        'smartcut_services', 'smartcut_products', 'smartcut_suppliers',
        'smartcut_purchase_invoices', 'smartcut_partners', 'smartcut_promo_codes',
        'smartcut_tips', 'smartcut_custodies'
      ];
      keysToCheck.forEach(key => {
        const val = localStorage.getItem(key);
        if (val && (
          val.includes('CMP-101') || val.includes('INV-1001') || 
          val.includes('TRX-001') || val.includes('B-101') || 
          val.includes('عمر عبدالله') || val.includes('قص شعر كلاسيك')
        )) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    const initializeApp = async () => {
      try {
        const user = AuthService.getCurrentUser();
        if (user) setCurrentUser(user);

        // Fetch Salons list once
        const cloudSalons = await DB.fetchSalons();
        if (cloudSalons && cloudSalons.length > 0) {
          setAllSalons(cloudSalons);
          SubscriptionService.saveSalons(cloudSalons);
        }

        const salons = (cloudSalons && cloudSalons.length > 0) ? cloudSalons : SubscriptionService.getSalons();
        const savedActiveId = localStorage.getItem('smartcut_active_salon_id');
        let activeSalon = user?.salonId 
          ? (salons.find(s => s.id === user.salonId || s.code === (user as any).salonCode) || null)
          : (savedActiveId ? salons.find(s => s.id === savedActiveId) : null);
        
        if (!activeSalon && salons.length > 0) {
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
            setSettings(prev => ({
              ...prev,
              ...dbSettings,
              salonId: sId,
              salonCode: activeSalon.code || prev.salonCode,
              salonName: dbSettings.salonName || activeSalon.name || prev.salonName,
              salonType: dbSettings.salonType || (dbSettings as any)?.salon_type || activeSalon.salonType || (activeSalon as any)?.salon_type || prev.salonType || 'men',
              phone: activeSalon.phone || prev.phone,
              country: activeSalon.country || prev.country,
              currency: activeSalon.currency || prev.currency,
              treasuries: (Array.isArray(dbSettings.treasuries) && dbSettings.treasuries.length > 0) ? dbSettings.treasuries : prev.treasuries,
              expenseCategories: (Array.isArray(dbSettings.expenseCategories) && dbSettings.expenseCategories.length > 0) ? dbSettings.expenseCategories : prev.expenseCategories,
            }));
          }

          setSubscription({
            id: sId,
            salonId: sId,
            salonCode: activeSalon.code,
            organizationName: activeSalon.name,
            ownerEmail: activeSalon.email,
            phone: activeSalon.phone,
            country: activeSalon.country,
            plan: activeSalon.subscriptionPlan || 'pro',
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
            setProducts(essentialData.products || []);
          }

          // Mark essential sections as loaded
          loadedSectionsRef.current.add('pos');
          loadedSectionsRef.current.add('services');
          loadedSectionsRef.current.add('products');

          // Check active shift
          DB.getActiveWorkShift(sId, branchIdToUse).then(activeShift => {
            if (activeShift && activeShift.status === 'open') {
              setBranchShifts(prev => ({
                ...prev,
                [branchIdToUse]: {
                  isOpen: true,
                  date: activeShift.shiftDate,
                  initialCash: Number(activeShift.initialCash) || 0,
                  shiftId: activeShift.id
                }
              }));
            }
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

  // ── Smart HTTP Polling (15s interval, Visibility API aware, REST queries) ────
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
        const [activeShift, polledInvoices, polledTransactions, polledBookings, polledFingerprints, polledEmployees] = await Promise.all([
          bId ? DB.getActiveWorkShift(sId, bId) : null,
          DB.fetchAll<any>('invoices', undefined, sId),
          DB.fetchAll<any>('transactions', undefined, sId),
          DB.fetchAll<any>('bookings', undefined, sId),
          DB.fetchAll<any>('fingerprint_logs', undefined, sId),
          DB.fetchEmployees(sId)
        ]);

        if (!isSubscribed) return;

        // Sync Employees
        if (polledEmployees && Array.isArray(polledEmployees) && polledEmployees.length > 0) {
          setEmployees(polledEmployees);
        }

        // Sync Fingerprint Logs
        if (polledFingerprints && Array.isArray(polledFingerprints)) {
          setFingerprintLogs(polledFingerprints);
        }

        // Sync Shift State
        if (bId) {
          if (activeShift && activeShift.status === 'open') {
            setBranchShifts(prev => {
              const current = prev[bId];
              if (
                current?.isOpen === true &&
                current?.date === activeShift.shiftDate &&
                current?.initialCash === (Number(activeShift.initialCash) || 0) &&
                current?.shiftId === activeShift.id
              ) {
                return prev;
              }
              const updated = {
                ...prev,
                [bId]: {
                  isOpen: true,
                  date: activeShift.shiftDate,
                  initialCash: Number(activeShift.initialCash) || 0,
                  shiftId: activeShift.id
                }
              };
              try { localStorage.setItem('smartcut_work_shifts_state', JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
          } else {
            setBranchShifts(prev => {
              const current = prev[bId];
              if (!current?.isOpen) return prev;
              const updated = {
                ...prev,
                [bId]: {
                  isOpen: false,
                  date: '',
                  initialCash: 0
                }
              };
              try { localStorage.setItem('smartcut_work_shifts_state', JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
          }
        }

        // Sync Invoices
        if (polledInvoices && Array.isArray(polledInvoices)) {
          setInvoices(polledInvoices.map((inv: any) => ({
            ...inv,
            vatAmount: inv.vat,
            cashbackUsed: inv.cashbackUsed ?? 0,
            paymentMethods: inv.paymentMethods || [],
            isRemedyInvoice: inv.isRemedy || false,
            remedyReason: inv.remedyNotes || '',
            relatedComplaintId: inv.relatedComplaintId || '',
            originalInvoiceId: inv.originalInvoiceId || '',
            zatcaQr: inv.zatcaQr || '',
            zatcaHash: inv.zatcaHash || '',
            etaSubmissionUuid: inv.etaSubmissionUuid || '',
          })));
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
          setBookings(polledBookings.map((b: any) => ({
            ...b,
            phone: b.clientPhone || b.phone || '',
            customerEmail: b.customerEmail || '',
            advancePayments: b.advancePayments || []
          })));
        }
      } catch (err) {
        console.warn('[Smart Polling] Background poll error:', err);
      } finally {
        isFetching = false;
      }
    };

    // Immediate poll execution on mount & branch/salon change
    executePoll();

    // 3. Interval Configuration: Set the polling interval to 8 seconds for fast cross-device sync
    const intervalId = setInterval(executePoll, 8000);

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

    const client = SupabaseService.getClient();
    if (!client) return;

    const channel = client
      .channel('smartcut_kiosk_print_jobs')
      .on('broadcast', { event: 'print_ticket' }, (payload: any) => {
        const ticketData = payload?.payload?.data;
        if (ticketData) {
          console.log('[Reception Printer Station] Auto-printing kiosk ticket #', ticketData.queueNumber);
          printQueueSlipDirect(ticketData);
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [settings.isReceptionPrinterStation]);

  // ── 2. Lazy Loading Tab Data on Demand ──────────────────────────────────────────
  useEffect(() => {
    const sId = settings.salonId;
    if (!sId) return;

    // Determine what tab section is needed
    let sectionToLoad = '';
    if (activeTab === 'invoices') sectionToLoad = 'invoices';
    else if (activeTab === 'bookings') sectionToLoad = 'bookings';
    else if (activeTab === 'clients' || activeTab === 'complaints') sectionToLoad = 'clients';
    else if (activeTab === 'treasury' || activeTab === 'expenses') sectionToLoad = 'transactions';
    else if (activeTab === 'dashboard' || activeTab === 'reports' || activeTab === 'closing-receipt') sectionToLoad = 'reports';
    else if (activeTab === 'employees' || activeTab === 'hr' || activeTab === 'permissions' || activeTab === 'employee-analytics') sectionToLoad = 'hr';
    else if (activeTab === 'warehouse' || activeTab === 'suppliers' || activeTab === 'purchases' || activeTab === 'inventory') sectionToLoad = 'warehouse';
    else if (activeTab === 'partners') sectionToLoad = 'partners';
    else if (activeTab === 'promotions' || activeTab === 'promo-codes') sectionToLoad = 'promotions';
    else if (activeTab === 'tips') sectionToLoad = 'tips';
    else if (activeTab === 'fingerprint-logs' || activeTab === 'fingerprint_logs') sectionToLoad = 'fingerprint';

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
    const s = allSalons.find(item => item.id === targetSalonId);
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
        setProducts(essentialData.products || []);
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

  const currentSalonId = currentUser?.salonId || settings.salonId || '';


  // 3. Autonomous Branch Isolation Filter & Helpers
  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === activeBranchId) || branches.find(b => b.isMain) || branches[0] || null;
  }, [branches, activeBranchId]);

  const isItemInBranch = (itemBranchId?: string, itemBranchCode?: string) => {
    if (!itemBranchId && !itemBranchCode) return true; // Global / salon-wide entity
    if (branches.length <= 1) return true; // If salon has only 1 branch, all entities are visible
    if (itemBranchId && itemBranchId === activeBranchId) return true;
    if (activeBranch && itemBranchCode && itemBranchCode === activeBranch.code) return true;
    const mainBranch = branches.find(b => b.isMain) || branches[0];
    if (activeBranch?.isMain) {
      if (!itemBranchId || itemBranchId === mainBranch?.id || itemBranchId === 'b-main' || itemBranchId === '00000000-0000-0000-0000-000000000002') return true;
      if (itemBranchCode === 'BR-01' || itemBranchCode === 'BR-MAIN' || itemBranchCode === 'B01') return true;
    }
    return false;
  };

  // Salon-Scoped Entities (Direct from Supabase — Guaranteed 100% visible across all screens)
  const salonClients = useMemo(() => {
    return clients.filter(c => !c.salonId || !currentSalonId || c.salonId === currentSalonId);
  }, [clients, currentSalonId]);

  const salonCategories = useMemo(() => {
    return categories.filter(c => !c.salonId || !currentSalonId || c.salonId === currentSalonId);
  }, [categories, currentSalonId]);

  const salonServices = useMemo(() => {
    return services.filter(s => !s.salonId || !currentSalonId || s.salonId === currentSalonId);
  }, [services, currentSalonId]);

  const salonEmployees = useMemo(() => {
    return employees.filter(e => !e.salonId || !currentSalonId || e.salonId === currentSalonId);
  }, [employees, currentSalonId]);

  const salonProducts = useMemo(() => {
    return products.filter(p => !p.salonId || !currentSalonId || p.salonId === currentSalonId);
  }, [products, currentSalonId]);

  const salonInvoices = useMemo(() => {
    return invoices.filter(i => !i.salonId || !currentSalonId || i.salonId === currentSalonId);
  }, [invoices, currentSalonId]);

  const salonTransactions = useMemo(() => {
    return transactions.filter(t => !(t as any).salonId || !currentSalonId || (t as any).salonId === currentSalonId);
  }, [transactions, currentSalonId]);

  const salonBookings = useMemo(() => {
    return bookings.filter(b => !(b as any).salonId || !currentSalonId || (b as any).salonId === currentSalonId);
  }, [bookings, currentSalonId]);

  const salonSuppliers = useMemo(() => {
    return suppliers.filter(s => !(s as any).salonId || !currentSalonId || (s as any).salonId === currentSalonId);
  }, [suppliers, currentSalonId]);

  const salonPurchaseInvoices = useMemo(() => {
    return purchaseInvoices.filter(p => !(p as any).salonId || !currentSalonId || (p as any).salonId === currentSalonId);
  }, [purchaseInvoices, currentSalonId]);

  const salonSupplierPayments = useMemo(() => {
    return supplierPayments.filter(sp => !(sp as any).salonId || !currentSalonId || (sp as any).salonId === currentSalonId);
  }, [supplierPayments, currentSalonId]);

  const salonInventoryCounts = useMemo(() => {
    return inventoryCounts.filter(ic => !(ic as any).salonId || !currentSalonId || (ic as any).salonId === currentSalonId);
  }, [inventoryCounts, currentSalonId]);

  const salonItemMovements = useMemo(() => {
    return itemMovements.filter(im => !(im as any).salonId || !currentSalonId || (im as any).salonId === currentSalonId);
  }, [itemMovements, currentSalonId]);

  // Backward compatible alias
  const branchCategories = salonCategories;
  const branchServices = salonServices;
  const branchEmployees = salonEmployees;
  const branchProducts = salonProducts;
  const branchInvoices = salonInvoices;
  const branchTransactions = salonTransactions;
  const branchBookings = salonBookings;
  const branchClients = salonClients;
  const branchSuppliers = salonSuppliers;
  const branchPurchaseInvoices = salonPurchaseInvoices;
  const branchSupplierPayments = salonSupplierPayments;
  const branchInventoryCounts = salonInventoryCounts;
  const branchItemMovements = salonItemMovements;

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

  const isBranchPending = activeBranch?.status === 'pending_activation' || activeBranch?.isActive === false;
  const isSalonSuspended = subscription.isActive === false || subscription.status === 'suspended' || settings.isSalonActive === false;
  const isSubscriptionBlocked = subscription.status === 'expired' || endDateTime.getTime() < nowMidnight.getTime() || isSalonSuspended || isBranchPending;

  const checkReadOnlyAndWarn = () => {
    if (isSubscriptionBlocked && currentUser?.role !== 'programmer') {
      if (window.confirm('⛔ تم إيقاف تفعيل الصالون (أو الفرع): جميع الجداول والشاشات أصبحت للقراءة فقط (Read-Only) نظراً لانتهاء الاشتراك أو الفترة التجريبية.\n\nهل ترغب في فتح قائمة الباقات للاشتراك وتفعيل الحساب فوراً؟')) {
        setShowSubscriptionModal(true);
      }
      return true;
    }
    return false;
  };

  // Salon-Scoped State Setters with Real-time Supabase Persistence
  const handleSetEmployees = (updater: Employee[] | ((prev: Employee[]) => Employee[])) => {
    if (checkReadOnlyAndWarn()) return;
    setEmployees(prev => {
      const currentSalonEmps = prev.filter(e => !e.salonId || e.salonId === currentSalonId);
      const nextSalonEmps = typeof updater === 'function' ? updater(currentSalonEmps) : updater;
      const tagged = nextSalonEmps.map(e => ({ 
        ...e, 
        salonId: e.salonId || currentSalonId, 
        branchId: e.branchId || activeBranch?.id || activeBranchId,
        branchCode: (e as any).branchCode || activeBranch?.code || 'BR-01'
      }));
      const otherEmps = prev.filter(e => e.salonId && e.salonId !== currentSalonId);
      const res = [...otherEmps, ...tagged];
      DB.saveEmployees(tagged);
      return res;
    });
  };

  const handleSetServices = (updater: ServiceItem[] | ((prev: ServiceItem[]) => ServiceItem[])) => {
    if (checkReadOnlyAndWarn()) return;
    setServices(prev => {
      const currentSalonServices = prev.filter(s => !s.salonId || s.salonId === currentSalonId);
      const nextSalonServices = typeof updater === 'function' ? updater(currentSalonServices) : updater;
      const tagged = nextSalonServices.map(s => ({ 
        ...s, 
        salonId: s.salonId || currentSalonId, 
        branchId: s.branchId || activeBranch?.id || activeBranchId,
        branchCode: (s as any).branchCode || activeBranch?.code || 'BR-01'
      }));
      const other = prev.filter(s => s.salonId && s.salonId !== currentSalonId);
      const res = [...other, ...tagged];
      DB.saveServices(tagged);
      return res;
    });
  };

  const handleSetCategories = (updater: Category[] | ((prev: Category[]) => Category[])) => {
    if (checkReadOnlyAndWarn()) return;
    setCategories(prev => {
      const currentSalonCats = prev.filter(c => !c.salonId || c.salonId === currentSalonId);
      const nextSalonCats = typeof updater === 'function' ? updater(currentSalonCats) : updater;
      const tagged = nextSalonCats.map(c => ({ 
        ...c, 
        salonId: c.salonId || currentSalonId, 
        branchId: c.branchId || activeBranch?.id || activeBranchId,
        branchCode: (c as any).branchCode || activeBranch?.code || 'BR-01'
      }));
      const other = prev.filter(c => c.salonId && c.salonId !== currentSalonId);
      const res = [...other, ...tagged];
      DB.saveCategories(tagged);
      return res;
    });
  };

  const handleSetProducts = (updater: Product[] | ((prev: Product[]) => Product[])) => {
    if (checkReadOnlyAndWarn()) return;
    setProducts(prev => {
      const currentSalonProds = prev.filter(p => !p.salonId || p.salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonProds) : updater;
      const tagged = next.map(p => ({ ...p, salonId: p.salonId || currentSalonId, branchId: p.branchId || activeBranchId }));
      const other = prev.filter(p => p.salonId && p.salonId !== currentSalonId);
      const res = [...other, ...tagged];
      DB.saveProducts(tagged);
      return res;
    });
  };

  const handleSetInvoices = (updater: Invoice[] | ((prev: Invoice[]) => Invoice[])) => {
    if (checkReadOnlyAndWarn()) return;
    setInvoices(prev => {
      const currentSalonInvs = prev.filter(i => !i.salonId || i.salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonInvs) : updater;
      const tagged = next.map(i => ({ ...i, salonId: i.salonId || currentSalonId, branchId: i.branchId || activeBranchId }));
      const other = prev.filter(i => i.salonId && i.salonId !== currentSalonId);
      const res = [...other, ...tagged];
      tagged.forEach(inv => DB.saveInvoice(inv));
      return res;
    });
  };

  const handleSetTransactions = (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
    if (checkReadOnlyAndWarn()) return;
    setTransactions(prev => {
      const currentSalonTrxs = prev.filter(t => !(t as any).salonId || (t as any).salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonTrxs) : updater;
      const tagged = next.map(t => ({ ...t, salonId: (t as any).salonId || currentSalonId, branchId: (t as any).branchId || activeBranchId } as any));
      const other = prev.filter(t => (t as any).salonId && (t as any).salonId !== currentSalonId);
      const res = [...other, ...tagged];
      DB.saveTransactions(tagged);
      return res;
    });
  };

  const handleSetBookings = (updater: Booking[] | ((prev: Booking[]) => Booking[])) => {
    if (checkReadOnlyAndWarn()) return;
    setBookings(prev => {
      const currentSalonBookings = prev.filter(b => !(b as any).salonId || (b as any).salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonBookings) : updater;
      const tagged = next.map(b => ({ ...b, salonId: (b as any).salonId || currentSalonId, branchId: (b as any).branchId || activeBranchId }));
      const other = prev.filter(b => (b as any).salonId && (b as any).salonId !== currentSalonId);
      const res = [...other, ...tagged];
      tagged.forEach(b => DB.saveBooking(b));
      return res;
    });
  };

  const handleSetClients = (updater: Client[] | ((prev: Client[]) => Client[])) => {
    if (checkReadOnlyAndWarn()) return;
    setClients(prev => {
      const currentSalonClients = prev.filter(c => !c.salonId || c.salonId === currentSalonId);
      const next = typeof updater === 'function' ? updater(currentSalonClients) : updater;
      const tagged = next.map(c => ({ ...c, salonId: c.salonId || currentSalonId }));
      const otherSalonClients = prev.filter(c => c.salonId && c.salonId !== currentSalonId);
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
    if (checkReadOnlyAndWarn()) return;
    setPromoCodes(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      next.forEach((pc: any) => DB.savePromoCode(pc));
      return next;
    });
  };

  const handleSetPromoCodeUsages = (updater: any) => {
    if (checkReadOnlyAndWarn()) return;
    setPromoCodeUsages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      next.forEach((pu: any) => DB.savePromoCodeUsage(pu));
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

  const handleOpenShift = () => {
    if (checkReadOnlyAndWarn()) return;
    const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];
    const shiftId = 'SHIFT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const nowIso = new Date().toISOString();

    if (openShiftForm.initialCash > 0) {
      const cashTreasury = settings.treasuries.find(t => t.id === 'cash') || settings.treasuries[0];
      const newTrx: Transaction = {
        id: 'TRX-CUSTODY-' + Math.random().toString(36).substr(2,9),
        date: openShiftForm.date + 'T' + new Date().toTimeString().split(' ')[0],
        type: 'in',
        amount: openShiftForm.initialCash,
        category: 'عهدة افتتاحية',
        description: `عهدة افتتاحية للوردية (${currentUser?.name || 'الكاشير'}) - فرع ${activeBranch?.name || ''}`,
        treasury: cashTreasury.id,
        createdBy: currentUser?.name || 'الكاشير',
        userId: currentUser?.id,
        userName: currentUser?.name || 'الكاشير',
        shiftDate: openShiftForm.date,
        branchId: activeBranchId,
        branchCode: activeBranch?.code
      };
      handleSetTransactions(prev => [...prev, newTrx]);
    }

    const newWorkShift: WorkShift = {
      id: shiftId,
      salonId: settings.salonId,
      branchId: activeBranchId,
      shiftDate: openShiftForm.date,
      openedAt: nowIso,
      openedByUserId: currentUser?.id,
      openedByUserName: currentUser?.name || 'الكاشير',
      openedByRole: currentUser?.role || 'cashier',
      initialCash: Number(openShiftForm.initialCash) || 0,
      status: 'open',
      createdAt: nowIso
    };

    DB.saveWorkShift(newWorkShift);
    setShiftData({ isOpen: true, date: openShiftForm.date, initialCash: openShiftForm.initialCash, shiftId });
    setShowOpenModal(false);
  };

  const handleConfirmCloseShift = () => {
    if (checkReadOnlyAndWarn()) return;
    const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];
    const mainTreasury = settings.treasuries.find(t => t.isMain) || settings.treasuries[0];
    const newTransactions: Transaction[] = [];
    const now = new Date().toISOString();

    settings.treasuries.forEach(t => {
      if (t.isMain) return;
      // Filter transactions of this active branch only
      const tTrx = branchTransactions.filter(trx => trx.treasury === t.id);
      const income = tTrx.filter(trx => trx.type === 'in').reduce((s, x) => s + x.amount, 0);
      const outcome = tTrx.filter(trx => trx.type === 'out').reduce((s, x) => s + x.amount, 0);
      const net = income - outcome;

      if (net > 0) {
        newTransactions.push({
          id: 'TRX-OUT-' + Math.random().toString(36).substr(2,9),
          date: now,
          type: 'out',
          amount: net,
          category: 'transfer',
          description: `تصفير خزينة ${t.name} وتحويل للرئيسية - فرع ${activeBranch?.name || ''}`,
          treasury: t.id,
          branchId: activeBranchId,
          branchCode: activeBranch?.code,
          createdBy: currentUser?.name || 'الكاشير',
          userId: currentUser?.id,
          userName: currentUser?.name || 'الكاشير'
        });
        newTransactions.push({
          id: 'TRX-IN-' + Math.random().toString(36).substr(2,9),
          date: now,
          type: 'in',
          amount: net,
          category: 'transfer',
          description: `تحويل تصفير من ${t.name} - فرع ${activeBranch?.name || ''}`,
          treasury: mainTreasury.id,
          branchId: activeBranchId,
          branchCode: activeBranch?.code,
          createdBy: currentUser?.name || 'الكاشير',
          userId: currentUser?.id,
          userName: currentUser?.name || 'الكاشير'
        });
      }
    });

    if (newTransactions.length > 0) {
      handleSetTransactions(prev => [...prev, ...newTransactions]);
    }

    // Persist shift closure in DB
    const shiftInvoices = branchInvoices.filter(i => i.date.startsWith(shiftData.date));
    const totalSales = shiftInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalCashSales = shiftInvoices.reduce((s, i) => {
      const cashSplit = i.paymentMethods?.find(pm => pm.treasuryId === 'cash' || pm.treasuryId.includes('cash'))?.amount;
      return s + (cashSplit || 0);
    }, 0);
    const totalCardSales = Math.max(0, totalSales - totalCashSales);
    const shiftExpenses = branchTransactions.filter(t => t.date.startsWith(shiftData.date) && (t.type === 'out' || t.category === 'expense')).reduce((s, t) => s + t.amount, 0);
    const expectedCash = shiftData.initialCash + totalCashSales - shiftExpenses;

    const closedShift: Partial<WorkShift> = {
      id: (shiftData as any).shiftId || ('SHIFT-' + Math.random().toString(36).substr(2, 9).toUpperCase()),
      salonId: settings.salonId,
      branchId: activeBranchId,
      shiftDate: shiftData.date,
      closedAt: now,
      closedByUserId: currentUser?.id,
      closedByUserName: currentUser?.name || 'الكاشير',
      initialCash: shiftData.initialCash,
      expectedCash,
      totalSales,
      totalCashSales,
      totalCardSales,
      totalExpenses: shiftExpenses,
      status: 'closed'
    };
    DB.saveWorkShift(closedShift);
    
    // تصفير عداد الأدوار للوردية القادمة ليبدأ من 1
    QueueService.resetShiftQueue(settings.salonId, activeBranchId, shiftData.date);

    setShiftData({ isOpen: false, date: '', initialCash: 0 });
    setShowCloseModal(false);
  };


  const handleCheckoutComplete = (invoice: Invoice, paymentSplits: { amount: number, treasuryId: string }[], bookingId?: string) => {
    if (isSubscriptionBlocked) {
      alert('⚠️ تعذر تنفيذ العملية: هذا الفرع أو حساب الصالون بانتظار التفعيل والاعتماد من قبل إدارة المنظومة (المبرمج). تم تجميد إدخال البيانات لحين التفعيل.');
      return;
    }

    // 1. Add invoice tagged with active branch and salon
    const invoiceWithBranch: Invoice = {
      ...invoice,
      salonId: settings.salonId,
      branchId: activeBranchId,
      branchCode: activeBranch?.code
    };
    setInvoices([...invoices, invoiceWithBranch]);
    
    // Deduct stock & Add Commission
    const updatedProducts = [...products];
    const newMovements: any[] = [];
    const newFinancialRecords: any[] = [];
    
    invoice.items.forEach(item => {
      if (item.type === 'product' && item.itemId) {
        // Deduct stock
        const pIdx = updatedProducts.findIndex(p => p.id === item.itemId);
        if (pIdx !== -1) {
          updatedProducts[pIdx] = { ...updatedProducts[pIdx], currentStock: updatedProducts[pIdx].currentStock - (item.quantity || 1) };
          newMovements.push({
            id: 'MOV-' + Math.random().toString(36).substr(2, 9),
            productId: item.itemId,
            date: new Date().toISOString(),
            type: 'sale',
            referenceId: invoice.id,
            quantityIn: 0,
            quantityOut: item.quantity || 1,
            balanceAfter: updatedProducts[pIdx].currentStock
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
      } else if (item.type === 'service' && item.itemId) {
         // Service execution commission (عمولة التنفيذ)
         const srv = services.find(s => s.id === item.itemId);
         if (srv && (srv.employeeCommissionAmount || srv.employeeCommissionPercentage) && item.employeeId) {
           let commAmount = 0;
           if (srv.employeeCommissionAmount) commAmount = srv.employeeCommissionAmount;
           else if (srv.employeeCommissionPercentage) commAmount = (srv.employeeCommissionPercentage / 100) * item.price;
           
           if (commAmount > 0) {
              newFinancialRecords.push({
                employeeId: item.employeeId,
                record: {
                  id: 'FIN-' + Math.random().toString(36).substr(2, 9),
                  date: invoice.date,
                  type: 'commission',
                  amount: commAmount * (item.quantity || 1),
                  note: `عمولة تنفيذ خدمة: ${srv.name}`
                }
              });
           }
         }

         // Service referral commission (عمولة فتح شغل / إحالة الخدمة)
         if (srv && srv.referralCommissionAmount && item.referralEmployeeId) {
           let refCommAmount = 0;
           if (srv.referralCommissionType === 'fixed') {
             refCommAmount = srv.referralCommissionAmount;
           } else {
             refCommAmount = (srv.referralCommissionAmount / 100) * item.price;
           }

           if (refCommAmount > 0) {
             const isSelfReferral = item.referralEmployeeId === item.employeeId;
             newFinancialRecords.push({
               employeeId: item.referralEmployeeId,
               record: {
                 id: 'FIN-' + Math.random().toString(36).substr(2, 9),
                 date: invoice.date,
                 type: 'referral_commission',
                 amount: refCommAmount * (item.quantity || 1),
                 note: `عمولة فتح شغل (إحالة): ${srv.name}${isSelfReferral ? ' (إحالة وتنفيذ ذاتي)' : ''}`
               }
             });
           }
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

    // 2. Add transactions for the payments
    const newTrxs: Transaction[] = paymentSplits
      .filter(split => split.treasuryId !== 'cashback')
      .map(split => ({
        id: 'TRX-' + Math.random().toString(36).substr(2,9),
        salonId: settings.salonId,
        date: invoice.date,
        type: 'in',
        amount: split.amount,
        category: 'sales',
        description: `مبيعات - فاتورة ${invoice.id}`,
        treasury: split.treasuryId,
        branchId: activeBranchId,
        branchCode: activeBranch?.code
      } as any));

    // 2.b. If tip was paid via non-cash method and branch mode is 'instant_cash', deduct tip immediately from Cash Drawer
    const tipMode = settings.tipPayoutMethod || 'instant_cash';
    if (invoice.tipAmount && invoice.tipAmount > 0 && tipMode === 'instant_cash') {
      const hasNonCashPayment = paymentSplits.some(s => s.treasuryId !== 'cash' && !s.treasuryId.includes('cash') && s.treasuryId !== 'cashback');
      if (hasNonCashPayment) {
        const cashTreasuryId = settings.treasuries.find(t => t.id === 'cash' || t.name.includes('كاش') || t.name.includes('نقد'))?.id || 'cash';
        newTrxs.push({
          id: 'TRX-TIP-CASH-' + Math.random().toString(36).substr(2, 9),
          salonId: settings.salonId,
          date: invoice.date,
          type: 'out',
          amount: invoice.tipAmount,
          category: 'صرف بقشيش فوري',
          description: `صرف بقشيش فوري كاش - فاتورة ${invoice.id} للموظف ${invoice.tipEmployeeName || 'الموظف'}`,
          treasury: cashTreasuryId,
          branchId: activeBranchId,
          branchCode: activeBranch?.code
        } as any);
      }
    }

    if (newTrxs.length > 0) {
      setTransactions(prev => [...prev, ...newTrxs]);
    }


    // 3. Complete booking if came from booking
    if (bookingId) {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'completed' } : b));
      DB.patch('bookings', bookingId, { status: 'completed' });
    }

    // 4. 🔄 حفظ فوري في Supabase لضمان بقاء وتوثيق البيانات
    DB.saveInvoice(invoiceWithBranch, settings.salonId);
    if (newTrxs.length > 0) DB.saveTransactions(newTrxs, settings.salonId);

    setActiveBookingForPOS(null);
  };


  const renderScreen = () => {
    switch (activeTab) {
      case 'pos': return (
        <POSScreen 
          settings={settings} 
          isShiftOpen={shiftData.isOpen} 
          shiftDate={shiftData.date} 
          initialBooking={activeBookingForPOS} 
          initialHeldInvoice={activeHeldInvoiceForPOS}
          onClearInitial={() => {
            setActiveBookingForPOS(null);
            setActiveHeldInvoiceForPOS(null);
          }} 
          onCheckoutComplete={handleCheckoutComplete} 
          clients={salonClients} 
          setClients={handleSetClients} 
          services={branchServices} 
          categories={branchCategories} 
          employees={branchEmployees} 
          setEmployees={handleSetEmployees} 
          products={branchProducts}
          invoices={branchInvoices}
          isSubscriptionBlocked={isSubscriptionBlocked}
          promoCodes={promoCodes}
          promoCodeUsages={promoCodeUsages}
          setPromoCodeUsages={setPromoCodeUsages}
          tips={tips}
          setTips={setTips}
          currentUser={currentUser}
        />
      );
      case 'services': return (
        <ServicesScreen 
          settings={settings} 
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
        />
      );
      case 'employees': return (
        <EmployeesScreen 
          settings={settings} 
          setSettings={handleSetSettings} 
          employees={branchEmployees} 
          setEmployees={handleSetEmployees} 
          transactions={branchTransactions} 
          setTransactions={handleSetTransactions} 
          shiftData={shiftData}
          invoices={branchInvoices}
          bookings={branchBookings}
          currentUser={currentUser}
          tips={tips}
          setTips={setTips}
          fingerprintLogs={fingerprintLogs}
          setFingerprintLogs={setFingerprintLogs}
          custodies={custodies}
          setCustodies={setCustodies}
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
          currentUser={currentUser}
        />
      );
      case 'promo_codes': return (
        <PromoCodesScreen 
          settings={settings}
          promoCodes={promoCodes}
          setPromoCodes={setPromoCodes}
          promoCodeUsages={promoCodeUsages}
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
          fingerprintLogs={fingerprintLogs}
          setFingerprintLogs={setFingerprintLogs}
          logs={fingerprintLogs}
          setLogs={setFingerprintLogs}
          employees={branchEmployees}
        />
      );
      case 'hr': return (
        <HRScreen 
          settings={settings} 
          employees={branchEmployees} 
          setEmployees={handleSetEmployees} 
          invoices={branchInvoices}
          transactions={branchTransactions}
          bookings={branchBookings}
          currentUser={currentUser}
          fingerprintLogs={fingerprintLogs}
          setFingerprintLogs={setFingerprintLogs}
        />
      );

      case 'dashboard': return (
        <DashboardScreen 
          settings={settings} 
          isShiftOpen={shiftData.isOpen} 
          shiftDate={shiftData.date} 
          bookings={branchBookings} 
          setBookings={handleSetBookings} 
          transactions={branchTransactions} 
          setTransactions={handleSetTransactions} 
          onToPOS={(booking) => { setActiveBookingForPOS(booking); setActiveTab('pos'); }} 
          invoices={branchInvoices} 
          products={branchProducts} 
          purchaseInvoices={branchPurchaseInvoices} 
          itemMovements={branchItemMovements} 
          activeBranchId={activeBranchId}
          branches={branches}
        />
      );
      case 'queue_calling': return (
        <QueueCallingScreen
          settings={settings}
          branches={branches}
          activeBranchId={activeBranchId}
          employees={branchEmployees}
          clients={salonClients}
          onNavigateScreen={(screenName) => setActiveTab(screenName)}
          onCompleteAndOpenPOS={(heldInvoice) => {
            setActiveHeldInvoiceForPOS(heldInvoice);
            setActiveTab('pos');
          }}
        />
      );
      case 'bookings': return (
        <BookingsScreen 
          settings={settings} 
          setSettings={setSettings}
          bookings={branchBookings} 
          setBookings={handleSetBookings} 
          onToPOS={(booking) => { setActiveBookingForPOS(booking); setActiveTab('pos'); }} 
          services={branchServices} 
          employees={branchEmployees}
          clients={salonClients}
          setClients={handleSetClients}
          activeBranchId={activeBranchId}
          branches={branches}
          currentUser={currentUser}
        />
      );
      case 'invoices': return (
        <InvoicesScreen 
          settings={settings} 
          invoices={branchInvoices} 
          setInvoices={handleSetInvoices} 
          transactions={branchTransactions} 
          setTransactions={handleSetTransactions} 
          clients={salonClients} 
          setClients={handleSetClients}
          activeBranchId={activeBranchId}
          branches={branches}
          currentUser={currentUser}
          products={branchProducts}
          setProducts={handleSetProducts}
          setItemMovements={handleSetItemMovements}
        />
      );

      case 'clients': return (
        <ClientsScreen 
          settings={settings} 
          clients={salonClients} 
          setClients={handleSetClients} 
          invoices={branchInvoices} 
        />
      );
      case 'complaints': return (
        <ComplaintsScreen 
          settings={settings}
          invoices={branchInvoices}
          employees={branchEmployees}
          clients={salonClients}
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
            products={branchProducts}
            setProducts={handleSetProducts}
            categories={branchCategories}
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
          />
        );
      case 'reports': return (
        <ReportsScreen 
          settings={settings} 
          transactions={branchTransactions} 
          invoices={branchInvoices} 
          employees={branchEmployees} 
          services={branchServices} 
          products={branchProducts} 
          activeBranchId={activeBranchId}
          branches={branches}
          tips={tips}
          fingerprintLogs={fingerprintLogs}
          expenses={branchTransactions.filter(t => t.category === 'expense' || t.type === 'expense')}
          purchases={branchPurchaseInvoices}
          supplierPayments={branchSupplierPayments}
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
      case 'saas_subscriptions': 
        if (currentUser?.role !== 'programmer') {
          return (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 mb-4">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">وصول محظور • لوحة تحكم المطور والمبرمج فقط</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                هذه اللوحة خاصة ومحمية لإدارة منظومة SaaS المركزية للمبرمج فقط ولا يمكن للمستخدمين العاديين أو مدراء الصالونات الوصول إليها.
              </p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-900"
              >
                العودة للوحة التحكم
              </button>
            </div>
          );
        }
        return (
          <SaaSProgrammerPortal 
            onSwitchSalon={(s) => {
              setSettings(prev => ({
                ...prev,
                salonId: s.id,
                salonCode: s.code,
                salonName: s.name,
                country: s.country,
                currency: s.currency,
                phone: s.phone,
                evolutionInstanceName: s.evolutionInstanceName
              }));
              setSubscription(prev => ({
                ...prev,
                salonId: s.id,
                salonCode: s.code,
                organizationName: s.name,
                status: s.subscriptionStatus,
                endDate: s.subscriptionEndDate
              }));
              const sBranches = SubscriptionService.getBranches(s.id);
              setBranches(sBranches.length > 0 ? sBranches : [
                { id: 'b-main', name: `الفرع الرئيسي (${s.name})`, code: 'B01', isMain: true, phone: s.phone, address: s.country, isActive: true, status: 'active' }
              ]);
              setActiveBranchId(sBranches[0]?.id || 'b-main');
              setActiveTab('dashboard');
            }}
            onExitPortal={() => setActiveTab('dashboard')}
            onLogout={handleLogout}
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
          expenses={transactions.filter(t => t.category === 'expense' || t.type === 'expense')}
          purchases={purchaseInvoices}
          supplierPayments={supplierPayments}
          partners={partners}
          setPartners={handleSetPartners}
          partnerTransactions={partnerTransactions}
          setPartnerTransactions={setPartnerTransactions}
          setTransactions={handleSetTransactions}
        />
      );
      default: return <div className="p-6">قريباً...</div>;
    }
  };

  const menuItems = [
    ...(currentUser?.role === 'owner' ? [
      { id: 'owner_portal', icon: Smartphone, label: '📱 نبض المالك' }
    ] : []),
    { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
    { id: 'queue_calling', icon: Radio, label: '📢 المناداة وطابور الانتظار' },
    { id: 'bookings', icon: Calendar, label: 'الحجوزات' },
    { id: 'pos', icon: Scissors, label: 'نقطة البيع (POS)' },
    { id: 'invoices', icon: Receipt, label: 'الفواتير' },
    { id: 'promo_codes', icon: Tag, label: 'البرومو كود والكوبونات' },
    { id: 'services', icon: List, label: 'الخدمات والتصنيفات' },
    { id: 'warehouse', icon: Boxes, label: 'المخزن والمستودع' },

    { id: 'clients', icon: Users, label: 'العملاء' },
    { id: 'complaints', icon: AlertCircle, label: 'شكاوى العملاء' },
    { id: 'employees', icon: UsersRound, label: 'شؤون العاملين' },
    { id: 'treasury', icon: Wallet, label: 'الخزائن' },
    { id: 'expenses', icon: Banknote, label: 'المصروفات' },
    ...(currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'programmer' ? [
      { id: 'partners', icon: Briefcase, label: 'الشركاء والأرباح' }
    ] : []),
    { id: 'reports', icon: FileText, label: 'التقارير الشاملة' },
    { id: 'permissions', icon: Shield, label: 'الصلاحيات والمستخدمين' },
    ...(currentUser?.role === 'programmer' ? [
      { id: 'saas_subscriptions', icon: Sparkles, label: '👑 إدارة اشتراكات SaaS' }
    ] : []),
    { id: 'settings', icon: Settings, label: 'الإعدادات' },
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
      if (u.branchId) {
        setActiveBranchId(u.branchId);
      } else if (selectedBranch) {
        setActiveBranchId(selectedBranch.id);
      } else if (salonBranches.length > 0) {
        setActiveBranchId(salonBranches[0].id);
      }
    } else if (u.branchId) {
      setActiveBranchId(u.branchId);
    }
    if (customSettings) {
      setSettings(customSettings);
      try {
        localStorage.setItem('smartcut_app_settings', JSON.stringify(customSettings));
      } catch (e) {}
    } else if (salon) {
      const dbSettings = await DB.fetchSettings(salon.id);
      setSettings(prev => {
        const updated: AppSettings = {
          ...prev,
          ...(dbSettings || {}),
          salonId: salon.id,
          salonCode: salon.code,
          salonName: dbSettings?.salonName || salon.name,
          phone: salon.phone,
          country: salon.country,
          currency: salon.currency,
          ownerEmail: salon.email,
          evolutionInstanceName: salon.evolutionInstanceName
        };
        try {
          localStorage.setItem('smartcut_app_settings', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }
    if (u.role === 'programmer') {
      setActiveTab('saas_subscriptions');
    } else if (u.role === 'owner') {
      setActiveTab('owner_portal');
    } else if (u.role === 'barber') {
      setActiveTab('barber_portal');
    } else {
      setActiveTab(u.screens?.includes('*') ? 'pos' : (u.screens?.[0] || 'pos'));
    }
  };

  // 2. STANDALONE BARBER & TECHNICIAN PORTAL ROUTE (/barber, /staff or barber role)
  if (isBarberRoute || currentUser?.role === 'barber') {
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
        onCompleteBooking={(bId) => {
          handleSetBookings((prev: Booking[]) => prev.map(b => b.id === bId ? { ...b, status: 'completed' } : b));
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

  // 3B. STANDALONE TABLET KIOSK CHECK-IN ROUTE (/kiosk or ?kiosk=true)
  if (isKioskRoute) {
    return (
      <KioskTabletScreen
        settings={settings}
        branches={branches}
        clients={clients}
        onSaveClient={(newClient) => {
          handleSetClients((prev: Client[]) => [newClient, ...prev.filter(c => c.id !== newClient.id && c.phone !== newClient.phone)]);
        }}
        onSwitchToMainApp={() => {
          window.location.href = '/';
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
            setActiveTab('saas_subscriptions');
          }
        }}
      />
    );
  }

  // 3. MASTER PROGRAMMER SAAS PORTAL
  if (currentUser?.role === 'programmer' && activeTab === 'saas_subscriptions') {
    return (
      <SaaSProgrammerPortal 
        onSwitchSalon={(s) => {
          setSettings(prev => ({
            ...prev,
            salonId: s.id,
            salonCode: s.code,
            salonName: s.name,
            country: s.country,
            currency: s.currency,
            phone: s.phone,
            evolutionInstanceName: s.evolutionInstanceName
          }));
          setSubscription(prev => ({
            ...prev,
            salonId: s.id,
            salonCode: s.code,
            organizationName: s.name,
            status: s.subscriptionStatus,
            endDate: s.subscriptionEndDate
          }));
          setActiveTab('dashboard');
        }}
        onExitPortal={() => {
          setActiveTab('dashboard');
        }}
        onLogout={handleLogout}
      />
    );
  }


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
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* 2. DESKTOP SIDEBAR */}
        <aside className="hidden lg:flex w-64 bg-white border-l border-slate-200 shadow-sm flex-col z-20">
          <div className="p-4 flex items-center gap-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Scissors size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-extrabold text-sm tracking-tight text-slate-900 leading-none truncate">
                {settings.salonName || 'SMART CUT'}
              </h1>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                <Sparkles size={10} />
                <span>v2.0 PRO SaaS</span>
              </p>
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
                  onClick={() => setActiveTab(item.id)}
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
            <div className="flex items-center justify-between mb-2 p-2 bg-white rounded-xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  {currentUser.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-tight truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{ROLE_LABELS[currentUser.role] || currentUser.role}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
            >
              <LogOut size={16} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>

        {/* 3. MOBILE SIDEBAR DRAWER OVERLAY */}
        {showMobileSidebar && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowMobileSidebar(false)}
            />
            <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
              <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <Scissors size={18} />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-xs text-slate-900">{settings.salonName}</h2>
                    <p className="text-[10px] text-emerald-600 font-bold">SMART CUT PRO</p>
                  </div>
                </div>
                <button onClick={() => setShowMobileSidebar(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
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
                        setActiveTab(item.id);
                        setShowMobileSidebar(false);
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  <LogOut size={16} />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col h-full overflow-hidden pb-14 lg:pb-0">
          {/* Header Topbar */}
          <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 shadow-xs z-10 shrink-0">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Menu Toggle */}
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                title="القائمة"
              >
                <Menu size={20} />
              </button>

              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>{menuItems.find(m => m.id === activeTab)?.label}</span>
              </h2>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Subscription / Plan Badge Button */}
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-extrabold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95 ${
                  isSubscriptionBlocked
                    ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                    : subscription.status === 'trial'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
                title="عرض وتجديد باقات الاشتراك"
              >
                <Sparkles size={13} className={isSubscriptionBlocked ? 'text-rose-600' : 'text-amber-600'} />
                <span>
                  {isSubscriptionBlocked
                    ? 'انتهى الاشتراك (تجديد ⚡)'
                    : subscription.status === 'trial'
                    ? 'فترة تجريبية (ترقية الباقة ✨)'
                    : 'باقات الاشتراك 💳'}
                </span>
              </button>

              {/* Shift Status Pill */}
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl font-extrabold text-[11px] ${
                shiftData.isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${shiftData.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span>{shiftData.isOpen ? `الوردية مفتوحة (${shiftData.date})` : 'الوردية مغلقة'}</span>
              </div>

              {AuthService.canDo('manage_shifts', currentUser) && (
                <button 
                  onClick={() => shiftData.isOpen ? setShowCloseModal(true) : setShowOpenModal(true)}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs shadow-xs transition-all active:scale-95 cursor-pointer ${
                    shiftData.isOpen ? 'bg-slate-800 hover:bg-slate-900 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {shiftData.isOpen ? 'إغلاق الوردية' : 'فتح الوردية'}
                </button>
              )}

              <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1"></div>

              {/* User Avatar */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">{ROLE_LABELS[currentUser.role] || currentUser.role}</p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Body */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-100 relative">
            {isSubscriptionBlocked && (
              <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 text-white px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold border-b border-rose-950 z-30 shrink-0 shadow-md animate-in fade-in" dir="rtl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                  <span>
                    🔒 <strong>وضع القراءة فقط (Read-Only Mode):</strong> تم إيقاف تفعيل حساب الصالون (أو الفرع) نظراً لانتهاء الاشتراك. جميع الجداول والشاشات أصبحت للقراءة فقط ولا يُسمح بإجراء أي إضافة أو تعديل أو حفظ.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowSubscriptionModal(true)}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 animate-pulse"
                  >
                    <Sparkles size={14} className="text-slate-900" />
                    <span>تجديد / ترقية الباقة الآن 💳</span>
                  </button>
                  <span className="bg-white/20 text-white px-2.5 py-0.5 rounded-md text-[11px] font-black shrink-0">
                    مغلق للتعديل ⛔
                  </span>
                </div>
              </div>
            )}
            {renderScreen()}
          </div>

        </main>
      </div>

      {/* 5. MOBILE BOTTOM NAVIGATION */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMobileMenu={() => setShowMobileSidebar(true)}
        canAccess={screen => AuthService.canAccess(screen, currentUser)}
      />

      {/* 6. CLOSE SHIFT MODAL & Z-REPORT */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-8 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-base text-slate-800">إغلاق الوردية الحالية (Z-Report)</h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-red-500 font-bold">✕</button>
            </div>
            <div className="p-4 overflow-hidden flex justify-center bg-slate-100 max-h-[60vh] overflow-y-auto">
              <div className="bg-white shadow-sm p-4 w-full rounded-2xl">
                <ClosingReportReceipt 
                  settings={settings}
                  transactions={transactions.filter(t => t.date.startsWith(shiftData.date))}
                  invoices={invoices.filter(i => i.date.startsWith(shiftData.date))}
                  dateLabel={shiftData.date}
                  initialCash={shiftData.initialCash}
                />
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2.5">
              <button 
                onClick={() => handlePrintReceipt('print-receipt', false, settings.paperSize || '80mm')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs shadow"
              >
                <Printer size={16} />
                <span>طباعة تقرير إغلاق الوردية الحراري</span>
              </button>
              <button 
                onClick={handleConfirmCloseShift}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3 rounded-xl transition-colors text-xs shadow"
              >
                تأكيد إغلاق الوردية وتصفير الخزائن
              </button>
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

      {/* 7. SUBSCRIPTION & BILLING PRICING MODAL */}
      <SubscriptionPlansModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        settings={settings}
        currentSalon={allSalons.find((s: any) => s.id === currentSalonId) || { id: currentSalonId, name: settings.salonName }}
        currentUser={currentUser}
        onSubscriptionUpdated={() => {
          setShowSubscriptionModal(false);
          window.location.reload();
        }}
      />

    </div>
  );
}
