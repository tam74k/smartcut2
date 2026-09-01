import React, { useState, useEffect } from 'react';
import { AppSettings, Treasury, Category, AppUser, UserRole, ActionPermission, ZatcaSettings, EtaEgyptSettings, Branch } from '../types';
import { 
  Save, Globe, Receipt, MessageSquare, Wallet, Plus, Trash2, CheckCircle, 
  Edit2, Shield, Cloud, Sparkles, RefreshCw, X, Check, Database, Download, 
  Upload, HardDrive, AlertTriangle, FileCheck, RefreshCcw, Landmark, FileSpreadsheet,
  QrCode, Key, Send, CheckCircle2, ShieldCheck, HelpCircle, Building2, Layers, Clock, DollarSign
} from 'lucide-react';

import { AuthService, ROLE_LABELS } from '../services/auth';
import { SupabaseService } from '../services/supabase';
import { ZatcaService } from '../services/zatcaService';
import { EtaEgyptService } from '../services/etaEgyptService';
import { SubscriptionService, COUNTRY_CURRENCY_MAP, getCountryMeta } from '../services/subscriptionService';
import { DB } from '../services/db';

export function SettingsScreen({ 
  settings, 
  setSettings, 
  categories, 
  setCategories,
  services = [],
  setServices,
  products = [],
  setProducts,
  clients = [],
  setClients,
  employees = [],
  setEmployees,
  invoices = [],
  setInvoices,
  transactions = [],
  setTransactions,
  bookings = [],
  setBookings,
  suppliers = [],
  setSuppliers,
  purchaseInvoices = [],
  setPurchaseInvoices,
  supplierPayments = [],
  setSupplierPayments,
  inventoryCounts = [],
  setInventoryCounts,
  itemMovements = [],
  setItemMovements,
  branches = [],
  setBranches,
  activeBranchId,
  currentUser
}: { 
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  categories: Category[];
  setCategories: (c: Category[]) => void;
  services?: any[];
  setServices?: (s: any[]) => void;
  products?: any[];
  setProducts?: (p: any[]) => void;
  clients?: any[];
  setClients?: (c: any[]) => void;
  employees?: any[];
  setEmployees?: (e: any[]) => void;
  invoices?: any[];
  setInvoices?: (i: any[]) => void;
  transactions?: any[];
  setTransactions?: (t: any[]) => void;
  bookings?: any[];
  setBookings?: (b: any[]) => void;
  suppliers?: any[];
  setSuppliers?: (s: any[]) => void;
  purchaseInvoices?: any[];
  setPurchaseInvoices?: (p: any[]) => void;
  supplierPayments?: any[];
  setSupplierPayments?: (s: any[]) => void;
  inventoryCounts?: any[];
  setInventoryCounts?: (i: any[]) => void;
  itemMovements?: any[];
  setItemMovements?: (m: any[]) => void;
  branches?: Branch[];
  setBranches?: (branches: Branch[]) => void;
  activeBranchId?: string;
  currentUser?: AppUser | null;
}) {
  const activeBranch = branches.find(b => b.id === activeBranchId) || branches.find(b => b.isMain) || branches[0];
  const isMainBranch = !activeBranch || activeBranch.isMain !== false;
  const isOwnerOrProgrammer = currentUser?.role === 'programmer' || ((currentUser?.role === 'admin' || currentUser?.role === 'owner' || !currentUser?.role) && isMainBranch);
  const [activeTab, setActiveTab] = useState<'general' | 'printing' | 'users' | 'supabase' | 'treasuries' | 'categories' | 'whatsapp'>('general');


  const [newTreasuryName, setNewTreasuryName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'service' | 'product'>('service');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('تم حفظ الإعدادات بنجاح');

  // SaaS Online Booking Link & QR Code State
  const [copiedBookingLink, setCopiedBookingLink] = useState(false);
  const salonCode = settings.salonCode || settings.salonId || '10a5n';

  const generateNewSalonCode = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    handleChange('salonCode', code);
  };

  const bookingBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.smartcut.com';
  const salonBookingUrl = `${bookingBaseUrl}/?code=${salonCode}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(salonBookingUrl)}`;

  const handlePrintSalonQr = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>ملصق الحجز الأونلاين - ${settings.salonName || 'Smart Cut'}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 30px; background: #f8fafc; }
          .card { max-width: 400px; margin: 0 auto; background: white; border: 2px solid #0f172a; border-radius: 24px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
          .logo { max-height: 60px; margin-bottom: 12px; }
          h1 { margin: 8px 0; font-size: 22px; color: #0f172a; }
          p { margin: 4px 0 16px 0; font-size: 13px; color: #64748b; font-weight: bold; }
          .qr-box { background: #f1f5f9; padding: 16px; border-radius: 20px; display: inline-block; margin: 10px 0; }
          .qr-img { width: 220px; height: 220px; }
          .code-badge { background: #0f172a; color: white; padding: 8px 16px; border-radius: 12px; font-family: monospace; font-size: 16px; font-weight: bold; margin-top: 12px; display: inline-block; }
          .footer-note { font-size: 11px; color: #94a3b8; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          ${settings.logoUrl ? `<img src="${settings.logoUrl}" class="logo" alt="Logo" />` : ''}
          <h1>${settings.salonName || 'صالون العناية'}</h1>
          <p>احجز موعدك فوراً وامسح الرمز بكاميرا الجوال 📱</p>
          <div class="qr-box">
            <img src="${qrImageUrl}" class="qr-img" alt="Booking QR Code" />
          </div>
          <div>
            <span class="code-badge">كود الصالون: ${salonCode}</span>
          </div>
          <div class="footer-note">نظام الحجوزات الذكي • Smart Cut SaaS</div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Backup & Restore State
  const [restoreDataPreview, setRestoreDataPreview] = useState<any | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoreError, setRestoreError] = useState('');

  // Users state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState<{
    username: string;
    password: string;
    name: string;
    role: UserRole;
    phone: string;
    screens: string[];
    actions: ActionPermission[];
  }>({
    username: '',
    password: '',
    name: '',
    role: 'cashier',
    phone: '',
    screens: ['pos', 'bookings', 'invoices', 'clients'],
    actions: ['pos_discount', 'manage_shifts']
  });

  // ZATCA Saudi Arabia State
  const defaultZatca: ZatcaSettings = {
    enabled: settings.zatcaSettings?.enabled ?? settings.zatcaEnabled ?? true,
    environment: settings.zatcaSettings?.environment || 'sandbox',
    vatNumber: settings.zatcaSettings?.vatNumber || settings.taxNumber || '300000000000003',
    commercialReg: settings.zatcaSettings?.commercialReg || settings.commercialReg || '1010000000',
    egsSerialNumber: settings.zatcaSettings?.egsSerialNumber || 'EGS-POS-MAIN-01',
    organizationName: settings.zatcaSettings?.organizationName || settings.salonName || 'صالون العناية بالرجل',
    organizationUnitName: settings.zatcaSettings?.organizationUnitName || 'الفرع الرئيسي',
    countryName: 'SA',
    cityName: settings.zatcaSettings?.cityName || 'الرياض',
    streetName: settings.zatcaSettings?.streetName || 'طريق الملك فهد',
    buildingNumber: settings.zatcaSettings?.buildingNumber || '1234',
    postalCode: settings.zatcaSettings?.postalCode || '12345',
    otp: settings.zatcaSettings?.otp || '',
    complianceCsid: settings.zatcaSettings?.complianceCsid || '',
    productionCsid: settings.zatcaSettings?.productionCsid || '',
    autoReportB2C: settings.zatcaSettings?.autoReportB2C ?? true,
    isOnboarded: settings.zatcaSettings?.isOnboarded ?? false
  };
  const [zatcaConfig, setZatcaConfig] = useState<ZatcaSettings>(defaultZatca);
  const [zatcaTesting, setZatcaTesting] = useState(false);
  const [zatcaTestResult, setZatcaTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [zatcaOtpInput, setZatcaOtpInput] = useState('');
  const [zatcaOnboardingBusy, setZatcaOnboardingBusy] = useState(false);

  // Country integration detection (Saudi Arabia vs Egypt)
  const isSaudi = (settings.country || '').includes('السعودية') || (settings.country || '').includes('Saudi') || settings.currency === 'SAR';
  const isEgypt = (settings.country || '').includes('مصر') || (settings.country || '').includes('Egypt') || settings.currency === 'EGP';

  // ETA Egypt State
  const defaultEta: EtaEgyptSettings = {
    enabled: settings.etaEgyptSettings?.enabled ?? (settings.country === 'مصر' || settings.currency === 'EGP'),
    environment: settings.etaEgyptSettings?.environment || 'preproduction',
    taxRegistrationNumber: settings.etaEgyptSettings?.taxRegistrationNumber || '100000000',
    taxpayerActivityCode: settings.etaEgyptSettings?.taxpayerActivityCode || '9602',
    branchCode: settings.etaEgyptSettings?.branchCode || '0',
    clientId: settings.etaEgyptSettings?.clientId || '',
    clientSecret: settings.etaEgyptSettings?.clientSecret || '',
    posSerialNumber: settings.etaEgyptSettings?.posSerialNumber || 'POS-EGY-001',
    posModel: settings.etaEgyptSettings?.posModel || 'SmartPOS-v1',
    posOsVersion: settings.etaEgyptSettings?.posOsVersion || 'Android 12',
    autoSubmitReceipts: settings.etaEgyptSettings?.autoSubmitReceipts ?? true
  };
  const [etaConfig, setEtaConfig] = useState<EtaEgyptSettings>(defaultEta);
  const [etaTesting, setEtaTesting] = useState(false);
  const [etaTestResult, setEtaTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const updateZatca = (key: keyof ZatcaSettings, value: any) => {
    const updated = { ...zatcaConfig, [key]: value };
    setZatcaConfig(updated);
    handleChange('zatcaSettings', updated);
    if (key === 'enabled') {
      handleChange('zatcaEnabled', value);
    }
  };

  const updateEta = (key: keyof EtaEgyptSettings, value: any) => {
    const updated = { ...etaConfig, [key]: value };
    setEtaConfig(updated);
    handleChange('etaEgyptSettings', updated);
  };

  // Salon Branches Management
  const [salonBranches, setSalonBranches] = useState<Branch[]>([]);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  
  const initialBranchCountry = settings.country || 'المملكة العربية السعودية';
  const initialBranchMeta = getCountryMeta(initialBranchCountry);

  const [newBranchData, setNewBranchData] = useState({
    name: '',
    country: initialBranchCountry,
    currency: initialBranchMeta.currency,
    vatRate: initialBranchMeta.tax,
    vatEnabled: initialBranchMeta.tax > 0,
    taxNumber: settings.taxNumber || '',
    city: '',
    phone: settings.phone || '',
    address: ''
  });

  const handleCountryChangeForNewBranch = (countryName: string) => {
    const meta = getCountryMeta(countryName);
    setNewBranchData(prev => ({
      ...prev,
      country: countryName,
      currency: meta.currency,
      vatRate: meta.tax,
      vatEnabled: meta.tax > 0,
      phone: prev.phone || (meta.phoneCode + ' ')
    }));
  };

  useEffect(() => {
    loadSalonBranches();
  }, [settings.salonId]);

  const loadSalonBranches = () => {
    const list = settings.salonId 
      ? SubscriptionService.getBranches(settings.salonId) 
      : SubscriptionService.getBranches();
    setSalonBranches(list);
    if (setBranches && list && list.length > 0) {
      setBranches(list);
    }
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchData.name.trim()) return;
    const res = SubscriptionService.addBranch(settings.salonId || '00000000-0000-0000-0000-000000000001', newBranchData);
    if (res.success) {
      loadSalonBranches();
      setShowAddBranchModal(false);
      const meta = getCountryMeta(settings.country || 'المملكة العربية السعودية');
      setNewBranchData({ 
        name: '', 
        country: settings.country || 'المملكة العربية السعودية',
        currency: meta.currency,
        vatRate: meta.tax,
        vatEnabled: meta.tax > 0,
        taxNumber: settings.taxNumber || '',
        city: '', 
        phone: settings.phone || '', 
        address: '' 
      });
      setSuccessMsg(res.message);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } else {
      alert(res.message);
    }
  };

  const handleTestZatca = async () => {
    setZatcaTesting(true);
    const res = await ZatcaService.testZatcaConnection(zatcaConfig);
    setZatcaTesting(false);
    setZatcaTestResult(res);
  };

  const handleRequestComplianceCsid = async () => {
    if (!zatcaOtpInput.trim()) {
      alert('الرجاء إدخال رمز التحقق (OTP) المولد من بوابة فاتورة ZATCA');
      return;
    }
    setZatcaOnboardingBusy(true);
    const res = await ZatcaService.requestComplianceCsid(zatcaConfig, zatcaOtpInput.trim());
    setZatcaOnboardingBusy(false);
    if (res.success && res.csid) {
      updateZatca('complianceCsid', res.csid);
      updateZatca('complianceSecret', res.secret);
      updateZatca('compliancePassed', true);
      alert('✅ تم الحصول على شهادة الامتثال (Compliance CSID) بنجاح واجتياز الفحص التجريبي!');
    } else {
      alert('❌ خطأ في طلب الشهادة: ' + (res.errors?.join(' - ') || 'فشل التحقق من رمز OTP'));
    }
  };

  const handleRequestProductionCsid = async () => {
    setZatcaOnboardingBusy(true);
    const res = await ZatcaService.requestProductionCsid(zatcaConfig);
    setZatcaOnboardingBusy(false);
    if (res.success && res.csid) {
      updateZatca('productionCsid', res.csid);
      updateZatca('productionSecret', res.secret);
      updateZatca('isOnboarded', true);
      alert('🎉 مبارك! تم إصدار شهادة الإنتاج الحقيقية (Production CSID) بنجاح وتفعيل الربط الحي مع منظومة الفوترة الإلكترونية ZATCA!');
    } else {
      alert('❌ خطأ في إصدار شهادة الإنتاج: ' + (res.errors?.join(' - ') || 'تأكد من اجتياز شهادة الامتثال أولاً'));
    }
  };

  const handleTestEta = async () => {
    setEtaTesting(true);
    const res = await EtaEgyptService.testEtaConnection(etaConfig);
    setEtaTesting(false);
    setEtaTestResult(res);
  };

  useEffect(() => {
    setUsers(AuthService.getUsers());
  }, []);

  const handleUpdateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem('smartcut_app_settings', JSON.stringify(updated));
        if (updated.salonId) {
          SubscriptionService.updateSalon(updated.salonId, {
            name: updated.salonName,
            phone: updated.phone,
            country: updated.country,
            currency: updated.currency
          });
        }
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const handleChange = (key: keyof AppSettings, value: any) => {
    handleUpdateSettings({ [key]: value });
  };

  const handleExportFullBackup = (mode: 'branch' | 'full' = 'branch') => {
    try {
      const isBranchOnly = mode === 'branch' && activeBranchId;
      const activeBranch = branches.find(b => b.id === activeBranchId);
      const branchNameSanitized = (activeBranch?.name || settings.salonName || 'Branch').replace(/[\s/\\:*?"<>|]+/g, '_');
      
      const allUsers = AuthService.getUsers();
      const allRoles = AuthService.getCustomRoles();

      const targetUsers = isBranchOnly
        ? allUsers.filter(u => u.branchId === activeBranchId || (!u.branchId && activeBranch?.isMain))
        : allUsers;

      const backupPackage = {
        appName: 'Smart Cut Salon & Spa Management System',
        backupVersion: '2.0',
        backupScope: isBranchOnly ? 'branch_isolated' : 'full_organization',
        branchId: isBranchOnly ? activeBranchId : 'all',
        branchName: isBranchOnly ? (activeBranch?.name || settings.salonName) : 'جميع الفروع',
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser?.name || AuthService.getCurrentUser()?.name || 'مدير النظام',
        data: {
          settings,
          categories,
          services,
          products,
          clients,
          employees,
          invoices,
          transactions,
          bookings,
          suppliers,
          purchaseInvoices,
          supplierPayments,
          inventoryCounts,
          itemMovements,
          users: targetUsers,
          customRoles: allRoles
        }
      };

      const jsonStr = JSON.stringify(backupPackage, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = isBranchOnly
        ? `SmartCut_Branch_${branchNameSanitized}_${dateStr}_${timeStr}.json`
        : `SmartCut_Full_Organization_${dateStr}_${timeStr}.json`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      setSuccessMsg(isBranchOnly
        ? `تم سحب النسخة الاحتياطية الخاصة بفرع (${activeBranch?.name || settings.salonName}) بنجاح!`
        : 'تم سحب وتحميل النسخة الاحتياطية الشاملة لكافة فروع الصالون بنجاح!'
      );
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      alert('حدث خطأ أثناء إنشاء ملف النسخة الاحتياطية: ' + err.message);
    }
  };

  const handleSelectBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError('');
    setRestoreFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || (!parsed.data && !parsed.settings)) {
          setRestoreError('ملف النسخة الاحتياطية غير صالح أو تالف.');
          return;
        }

        const data = parsed.data || parsed;
        setRestoreDataPreview({
          exportedAt: parsed.exportedAt || 'غير محدد',
          exportedBy: parsed.exportedBy || 'غير محدد',
          servicesCount: data.services?.length || 0,
          productsCount: data.products?.length || 0,
          clientsCount: data.clients?.length || 0,
          invoicesCount: data.invoices?.length || 0,
          employeesCount: data.employees?.length || 0,
          transactionsCount: data.transactions?.length || 0,
          categoriesCount: data.categories?.length || 0,
          raw: data
        });
      } catch (err: any) {
        setRestoreError('فشل في قراءة ملف النسخة الاحتياطية: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!restoreDataPreview || !restoreDataPreview.raw) return;

    try {
      const data = restoreDataPreview.raw;

      if (data.settings) setSettings(data.settings);
      if (data.categories && setCategories) setCategories(data.categories);
      if (data.services && setServices) setServices(data.services);
      if (data.products && setProducts) setProducts(data.products);
      if (data.clients && setClients) setClients(data.clients);
      if (data.employees && setEmployees) setEmployees(data.employees);
      if (data.invoices && setInvoices) setInvoices(data.invoices);
      if (data.transactions && setTransactions) setTransactions(data.transactions);
      if (data.bookings && setBookings) setBookings(data.bookings);
      if (data.suppliers && setSuppliers) setSuppliers(data.suppliers);
      if (data.purchaseInvoices && setPurchaseInvoices) setPurchaseInvoices(data.purchaseInvoices);
      if (data.supplierPayments && setSupplierPayments) setSupplierPayments(data.supplierPayments);
      if (data.inventoryCounts && setInventoryCounts) setInventoryCounts(data.inventoryCounts);
      if (data.itemMovements && setItemMovements) setItemMovements(data.itemMovements);

      // Restore Users & RBAC if present
      if (data.users && Array.isArray(data.users)) {
        localStorage.setItem('smartcut_users', JSON.stringify(data.users));
        setUsers(data.users);
      }
      if (data.customRoles && Array.isArray(data.customRoles)) {
        AuthService.saveCustomRoles(data.customRoles);
        for (const r of data.customRoles) {
          DB.saveCustomRole(r);
        }
      }

      setRestoreDataPreview(null);
      setRestoreFileName('');
      setSuccessMsg('تمت استعادة كافة البيانات والإعدادات بنجاح تام!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err: any) {
      alert('حدث خطأ أثناء استعادة البيانات: ' + err.message);
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem('smartcut_app_settings', JSON.stringify(settings));
      if (settings.salonId) {
        SubscriptionService.updateSalon(settings.salonId, {
          name: settings.salonName,
          phone: settings.phone,
          country: settings.country,
          currency: settings.currency
        });
      }
    } catch (e) {
      console.error(e);
    }
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  
  
  const addCategory = () => {
    if(!newCategoryName) return;
    if (editingCategoryId) {
      setCategories(categories.map(c => c.id === editingCategoryId ? { ...c, name: newCategoryName, type: newCategoryType } : c));
      setEditingCategoryId(null);
    } else {
      const newC: Category = { id: 'CAT-' + Math.random().toString(36).substring(2,9), name: newCategoryName, type: newCategoryType };
      setCategories([...categories, newC]);
    }
    setNewCategoryName('');
  };

  const handleEditCategory = (c: Category) => {
    setEditingCategoryId(c.id);
    setNewCategoryName(c.name);
    setNewCategoryType(c.type || 'service');
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter(c => c.id !== id));
  };

  const addTreasury = () => {
    if(!newTreasuryName) return;
    const newT: Treasury = { id: Math.random().toString(36).substring(2,9), name: newTreasuryName, isMain: false };
    handleChange('treasuries', [...settings.treasuries, newT]);
    setNewTreasuryName('');
  };

  const deleteTreasury = (id: string) => {
    handleChange('treasuries', settings.treasuries.filter(t => t.id !== id));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        handleChange('logoUrl', event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto w-full h-full overflow-y-auto relative">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 font-bold z-50 animate-bounce">
          <CheckCircle size={20} />
          تم حفظ الإعدادات بنجاح
        </div>
      )}

      {/* Active Branch Notice Banner */}
      {activeBranchId && (
        <div className="mb-5 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              🏢
            </div>
            <div>
              <p className="text-xs font-black text-indigo-950">
                أنت تقوم بتعديل إعدادات: <span className="text-indigo-600 font-extrabold">{settings.salonName || branches.find(b => b.id === activeBranchId)?.name || 'الفرع النشط'}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                🌍 {settings.country} • العملة: <strong className="text-slate-700">{settings.currency}</strong> • نسبة الضريبة: <strong className="text-slate-700">{settings.vatRate}%</strong> • (إعدادات معزولة تماماً لكل فرع)
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black bg-indigo-600/10 text-indigo-700 border border-indigo-300 px-2.5 py-1 rounded-lg">
            🔒 عزل كامل للفرع
          </span>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">إعدادات النظام والفرع</h2>
        <button onClick={handleSave} className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg text-[13px] font-bold flex items-center gap-2 shadow-sm transition-colors">
          <Save size={16} />
          حفظ التغييرات
        </button>
      </div>

      <div className="grid gap-5">
        {/* Basic Salon Info */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <Globe size={16} />
            </div>
            <h3 className="text-base font-bold text-slate-800">بيانات الصالون الأساسية</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">اسم الصالون (يظهر في الفاتورة)</label>
              <input 
                type="text"
                value={settings.salonName || ''}
                onChange={(e) => handleChange('salonName', e.target.value)}
                placeholder="مثال: صالون نيو لوك للعناية بالرجل"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">نوع الصالون / النشاط</label>
              <select
                value={settings.salonType || 'men'}
                onChange={(e) => handleChange('salonType', e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-800 focus:border-primary outline-none transition-colors"
              >
                <option value="men">💈 صالون رجالي (Men's Salon)</option>
                <option value="women">💇‍♀️ صالون / مشغل نسائي (Women's Salon & Spa)</option>
                <option value="mixed">✂️ صالون مختلط / أطفال ومناسبات (Unisex / Kids)</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">الرقم الضريبي (ZATCA VAT No.)</label>
              <input 
                type="text"
                value={settings.taxNumber || ''}
                onChange={(e) => handleChange('taxNumber', e.target.value)}
                placeholder="300000000000003"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none transition-colors"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">رقم السجل التجاري</label>
              <input 
                type="text"
                value={settings.commercialReg || ''}
                onChange={(e) => handleChange('commercialReg', e.target.value)}
                placeholder="1010000000"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none transition-colors"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">شعار الصالون</label>
              <input 
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] focus:border-primary outline-none transition-colors"
              />
              {settings.logoUrl && (
                <div className="mt-2">
                  <img src={settings.logoUrl} alt="Preview" className="h-12 object-contain rounded bg-slate-100 border p-1" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">رقم التواصل</label>
              <input 
                type="text"
                value={settings.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="رقم الهاتف..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">العنوان</label>
              <input 
                type="text"
                value={settings.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="العنوان..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Tips & Gratuities Settings Card */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">نظام البقشيش والإكراميات (Tips & Gratuities)</h3>
              <p className="text-xs text-slate-500">التحكم في طريقة توزيع وصرف البقشيش المحصل عبر الفيزا والبطاقات وطرق الدفع غير النقدية</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-[12px] font-bold text-slate-700">
                طريقة صرف وسداد الإكراميات للفرع والصالون *
              </label>

              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  (settings.tipPayoutMethod || 'instant_cash') === 'instant_cash'
                    ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                }`}>
                  <input
                    type="radio"
                    name="tipPayoutMethod"
                    value="instant_cash"
                    checked={(settings.tipPayoutMethod || 'instant_cash') === 'instant_cash'}
                    onChange={() => handleChange('tipPayoutMethod', 'instant_cash')}
                    className="mt-1 accent-emerald-600"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>🟢 صرف فوري من الكاش (خصم مباشر من الدرج)</span>
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      عند دفع العميل مبلغ زيادة بالفيزا/البطاقة، يُسجل المبلغ الإجمالي في خانة الفيزا (لمطابقة كشف حساب ماكينة الشبكة)، ويتم خصم مبلغ البقشيش فورياً نقداً من درج الكاش لتسليمه للموظف لحظياً.
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  settings.tipPayoutMethod === 'pooled_deferred'
                    ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                }`}>
                  <input
                    type="radio"
                    name="tipPayoutMethod"
                    value="pooled_deferred"
                    checked={settings.tipPayoutMethod === 'pooled_deferred'}
                    onChange={() => handleChange('tipPayoutMethod', 'pooled_deferred')}
                    className="mt-1 accent-indigo-600"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>🟡 مجمع ومؤجل (صرف لاحق من الخزينة المحددة)</span>
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      تتجمع مبالغ البقشيش في حساب ومستحقات الموظف في النظام، ويتم صرفها وسدادها لاحقاً (مع الرواتب أو عند الطلب) من خلال شاشة الإكراميات مع تحديد خزينة الصرف.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">تفعيل قبول البقشيش غير النقدي</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">السماح بإدخال مبلغ أكبر من الفاتورة عند الدفع بالفيزا أو الشبكة أو التحويل</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowNonCashTips !== false}
                  onChange={e => handleChange('allowNonCashTips', e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-700">💡 آلية عمل البقشيش الكاش:</p>
                <p>البقشيش المدفوع نقداً (كاش) يُسلّم ويوزع لحظياً للموظف دون تأثير على حسابات الشبكة الإلكترونية.</p>
              </div>
            </div>
          </div>
        </div>

        {/* SaaS Online Booking Link & Direct QR Code Card */}

        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black shadow-lg shadow-emerald-600/30">
                <QrCode size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">رابط ورمز QR بوابة حجز الصالون الأونلاين (SaaS)</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                    مخصص ومحمي 🔒
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  رابط مخصص يحتوي على كود الصالون الرئيسي لتسجيل وتوجيه العملاء مباشرة دون خلط مع صالونات أخرى
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrintSalonQr}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all active:scale-95"
            >
              <QrCode size={15} />
              <span>طباعة ملصق الباركود للمحل 🖨️</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Left/Center Details */}
            <div className="md:col-span-2 space-y-4">
              {/* Salon Code Config */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Key size={14} className="text-amber-400" />
                    <span>كود الصالون المميز (Salon Code / Token):</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateNewSalonCode}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>توليد كود عشوائي جديد</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={salonCode}
                    onChange={(e) => handleChange('salonCode', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    placeholder="10a5n"
                    className="bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-black text-base rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 tracking-wider flex-1"
                    dir="ltr"
                  />
                  <span className="text-xs text-slate-400 font-medium">كود فريد للـ SaaS</span>
                </div>
              </div>

              {/* Direct Link Box */}
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Globe size={14} className="text-emerald-400" />
                  <span>الرابط المباشر للعميل للحجز والتسجيل التلقائي:</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={salonBookingUrl}
                    className="bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs rounded-xl px-3.5 py-2.5 outline-none w-full select-all"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(salonBookingUrl);
                      setCopiedBookingLink(true);
                      setTimeout(() => setCopiedBookingLink(false), 3000);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                      copiedBookingLink 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    {copiedBookingLink ? (
                      <>
                        <Check size={14} />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <span>نسخ الرابط 📋</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`✨ رابط حجز المواعيد الأونلاين في ${settings.salonName || 'صالون العناية'}:\n${salonBookingUrl}\nكود الصالون: ${salonCode}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Send size={13} className="rotate-180" />
                    <span>مشاركة عبر الواتساب للعملاء</span>
                  </a>
                  <span className="text-slate-600">•</span>
                  <a
                    href={salonBookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <span>فتح ومعاينة صفحة الحجز ↗</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right QR Code Box */}
            <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 text-center flex flex-col items-center justify-center space-y-3">
              <div className="bg-white p-3 rounded-2xl shadow-lg ring-4 ring-emerald-500/20 inline-block">
                <img
                  src={qrImageUrl}
                  alt="Booking QR Code"
                  className="w-36 h-36 object-contain"
                />
              </div>

              <div>
                <p className="text-xs font-black text-white">{settings.salonName || 'صالونك'}</p>
                <p className="text-[10px] text-emerald-400 font-mono font-bold mt-0.5">كود: {salonCode}</p>
              </div>

              <div className="flex gap-2 w-full">
                <a
                  href={qrImageUrl}
                  download={`SmartCut_QR_${salonCode}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold py-2 rounded-xl text-center"
                >
                  تحميل PNG 💾
                </a>
                <button
                  type="button"
                  onClick={handlePrintSalonQr}
                  className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold py-2 rounded-xl cursor-pointer"
                >
                  طباعة 🖨️
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Salon Branches & Locations - Shown ONLY for Salon Owner and Master Programmer */}
        {isOwnerOrProgrammer && (
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">فروع الصالون والمواقع</h3>
                  <p className="text-xs text-slate-500">إدارة الفروع، تسجيل طلبات الفروع الجديدة، ومتابعة حالة التفعيل (صلاحية المالك)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddBranchModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>➕ طلب إضافة فرع جديد</span>
              </button>
            </div>

            {/* Branches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {salonBranches.map(branch => {
                const isPending = branch.status === 'pending_activation';
                const isActive = branch.status === 'active' || (branch.isActive && !branch.status);
                const branchCountry = branch.country || settings.country || 'المملكة العربية السعودية';
                const branchCurrency = branch.currency || settings.currency || 'SAR';
                const branchVat = branch.vatRate !== undefined ? branch.vatRate : settings.vatRate;
                const isVatOn = branch.vatEnabled !== undefined ? branch.vatEnabled : settings.vatEnabled;

                return (
                  <div 
                    key={branch.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      isPending ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className={isPending ? 'text-amber-600' : 'text-indigo-600'} />
                      <span className="font-bold text-slate-800 text-sm">{branch.name}</span>
                    </div>
                    {branch.isMain && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        الفرع الرئيسي
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5 mb-3">
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">الدولة والعملة:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <span>{branchCountry}</span>
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">{branchCurrency}</span>
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">إعدادات الضريبة:</span>
                      <span className="font-semibold text-slate-700">
                        {isVatOn ? `مفعلة (${branchVat}%)` : 'غير مفعلة (0%)'}
                      </span>
                    </p>
                    {branch.taxNumber && (
                      <p className="flex items-center justify-between">
                        <span className="text-slate-400">الرقم الضريبي:</span>
                        <span className="font-mono text-slate-700 text-[11px]" dir="ltr">{branch.taxNumber}</span>
                      </p>
                    )}
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">كود الفرع:</span>
                      <span className="font-mono font-bold text-indigo-600">{branch.code}</span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-slate-400">الهاتف:</span>
                      <span className="font-mono" dir="ltr">{branch.phone || '-'}</span>
                    </p>
                  </div>

                  <div className="border-t border-slate-200/60 pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">حالة الفرع:</span>
                    {isPending ? (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                        <Clock size={10} />
                        <span>بانتظار التفعيل ⏳</span>
                      </span>
                    ) : isActive ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        <span>مفعل ونشط 🟢</span>
                      </span>
                    ) : (
                      <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                        موقوف 🔴
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Modal: Add New Branch */}
        {isOwnerOrProgrammer && showAddBranchModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in max-h-[92vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600" />
                  <span>طلب تسجيل فرع جديد للصالون</span>
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddBranchModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateBranch} className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 font-bold">
                  <p>⏳ ملاحظة: بعد إضافة الفرع، سيكون بحالة <strong>بانتظار التفعيل</strong> لحين اعتماده من إدارة المنظومة (المبرمج الرئيسي).</p>
                </div>

                {/* Country Selection (Auto configures currency & VAT) */}
                <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-xl space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-indigo-950 mb-1 flex items-center gap-1.5">
                      <Globe size={14} className="text-indigo-600" />
                      <span>دولة الفرع (تحدد العملة ونسبة الضريبة تلقائياً) *</span>
                    </label>
                    <select
                      value={newBranchData.country}
                      onChange={e => handleCountryChangeForNewBranch(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-600 outline-none shadow-2xs"
                    >
                      {Object.keys(COUNTRY_CURRENCY_MAP).map(cName => (
                        <option key={cName} value={cName}>{cName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-900 mb-1">رمز العملة المحدد</label>
                      <input
                        type="text"
                        value={newBranchData.currency}
                        onChange={e => setNewBranchData({ ...newBranchData, currency: e.target.value })}
                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-indigo-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-900 mb-1">نسبة الضريبة القياسية %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={newBranchData.vatRate}
                        onChange={e => setNewBranchData({ ...newBranchData, vatRate: Number(e.target.value) })}
                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-indigo-700 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-950">
                      <input
                        type="checkbox"
                        checked={newBranchData.vatEnabled}
                        onChange={e => setNewBranchData({ ...newBranchData, vatEnabled: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                      />
                      <span>تطبيق واحتساب الضريبة على فواتير هذا الفرع</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الفرع *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: فرع التحلية، فرع الشيخ زايد، فرع السالمية"
                    value={newBranchData.name}
                    onChange={e => setNewBranchData({ ...newBranchData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المدينة</label>
                    <input
                      type="text"
                      placeholder="مثال: جدة، القاهرة، دبي..."
                      value={newBranchData.city}
                      onChange={e => setNewBranchData({ ...newBranchData, city: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الرقم الضريبي المستقل (إن وجد)</label>
                    <input
                      type="text"
                      placeholder="الرقم الضريبي للفرع..."
                      value={newBranchData.taxNumber}
                      onChange={e => setNewBranchData({ ...newBranchData, taxNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف والتواصل</label>
                  <input
                    type="tel"
                    placeholder="0500000000"
                    value={newBranchData.phone}
                    onChange={e => setNewBranchData({ ...newBranchData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">العنوان التفصيلي</label>
                  <input
                    type="text"
                    placeholder="الشارع، الحي، المعلم القريب..."
                    value={newBranchData.address}
                    onChange={e => setNewBranchData({ ...newBranchData, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddBranchModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/30"
                  >
                    إرسال طلب إضافة الفرع
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* General Settings */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-secondary flex items-center justify-center">
              <Globe size={16} />
            </div>
            <h3 className="text-base font-bold text-slate-800">المنطقة والعملة</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">الدولة (22 دولة عربية)</label>
              <select 
                value={settings.country}
                onChange={(e) => {
                  const selectedCountry = e.target.value;
                  const meta = getCountryMeta(selectedCountry);
                  setSettings({
                    ...settings,
                    country: selectedCountry,
                    currency: meta.currency,
                    vatRate: meta.tax,
                    vatEnabled: meta.tax > 0
                  });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-800 focus:border-primary outline-none transition-colors"
              >
                {Object.keys(COUNTRY_CURRENCY_MAP).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">العملة الافتراضية</label>
              <select 
                value={settings.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-800 focus:border-primary outline-none transition-colors"
              >
                {Array.from(new Set(Object.values(COUNTRY_CURRENCY_MAP).map(v => v.currency))).map(curr => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dashboard & Analytics Display Settings */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <h3 className="text-base font-bold text-slate-800">إعدادات لوحة التحكم والرسوم البيانية</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div>
                <p className="text-sm font-extrabold text-slate-800">إظهار الرسوم البيانية والإحصائيات في لوحة التحكم</p>
                <p className="text-xs text-slate-500 mt-0.5">عرض مقارنات المبيعات، المصروفات، المشتريات، وأفضل الخدمات في الشاشة الرئيسية</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.showDashboardAnalytics !== false}
                  onChange={(e) => handleChange('showDashboardAnalytics', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div>
                <p className="text-sm font-extrabold text-slate-800">تفعيل شاشة تحليلات ورسومات الموظفين</p>
                <p className="text-xs text-slate-500 mt-0.5">إتاحة شاشة رسومات تفصيلية لإنتاجية ورواتب وغيابات وتأخيرات وسلف الكادر الفني</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.showEmployeeAnalytics !== false}
                  onChange={(e) => handleChange('showEmployeeAnalytics', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* AI Assistant Toggle Switch */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div>
                <p className="text-sm font-extrabold text-slate-800">تفعيل المساعد الذكي ✦ (AI Assistant)</p>
                <p className="text-xs text-slate-500 mt-0.5">إظهار شاشة ومحادثة المساعد الذكي في القائمة الجانبية والشاشات لمساعدة الكادر الإداري</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.aiAssistantEnabled !== false}
                  onChange={(e) => handleChange('aiAssistantEnabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>


        {/* 👑💎 Comprehensive Client Loyalty Tiers & VIP Management Settings */}
        {(() => {
          const defaultTiers = [
            { id: 'standard', name: 'قياسي', icon: '⭐', spendingThreshold: 0, discountPercentage: 0, color: 'slate', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700', badgeBorder: 'border-slate-300', description: 'المستوى الأساسي الافتراضي لجميع العملاء الجدد' },
            { id: 'distinguished', name: 'متميز', icon: '🔷', spendingThreshold: 300, discountPercentage: 5, color: 'blue', badgeBg: 'bg-blue-50', badgeText: 'text-blue-700', badgeBorder: 'border-blue-300', description: 'عميل منتظم بإنفاق يتجاوز الحد الأدنى' },
            { id: 'vip', name: 'VIP', icon: '👑', spendingThreshold: 800, discountPercentage: 10, color: 'amber', badgeBg: 'bg-amber-50', badgeText: 'text-amber-800', badgeBorder: 'border-amber-400', description: 'عضوية كبار الشخصيات مع أولوية وخصم مميز' },
            { id: 'royal', name: 'ملكي', icon: '💎', spendingThreshold: 1500, discountPercentage: 15, color: 'purple', badgeBg: 'bg-purple-50', badgeText: 'text-purple-800', badgeBorder: 'border-purple-400', description: 'العضوية الملكية البلاتينية لأعلى العملاء إنفاقاً' }
          ];

          const currentTierSettings = settings.tierSettings || {
            enabled: true,
            periodMonths: 0,
            allowTierDiscountWithCashback: false,
            tiers: defaultTiers as any
          };

          const tiersList = (currentTierSettings.tiers && currentTierSettings.tiers.length > 0)
            ? currentTierSettings.tiers
            : defaultTiers as any;

          const updateSingleTier = (tierId: string, field: 'name' | 'spendingThreshold' | 'discountPercentage', val: any) => {
            const updatedList = tiersList.map((t: any) => t.id === tierId ? { ...t, [field]: val } : t);
            handleChange('tierSettings', {
              ...currentTierSettings,
              tiers: updatedList
            });
          };

          return (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-purple-600 text-white flex items-center justify-center font-black shadow-md">
                    👑
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span>نظام تصنيف ومستويات العملاء الموحد بالفروع (Loyalty Tiers Engine)</span>
                      <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                        4 مستويات قابلة لتعديل الاسم والمزايا
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تحديد مسميات وشروط ونسب الخصم لكل مستوى (مثل: قياسي - متميز - VIP - ملكي) عبر كافة فروع الصالون
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${currentTierSettings.enabled ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {currentTierSettings.enabled ? 'نظام المستويات مفعل 🟢' : 'معطل ⚪'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={currentTierSettings.enabled}
                      onChange={(e) => {
                        handleChange('tierSettings', {
                          ...currentTierSettings,
                          enabled: e.target.checked
                        });
                      }}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>

              {currentTierSettings.enabled && (
                <div className="space-y-5 animate-in fade-in">
                  
                  {/* General Engine Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        فترة احتساب إنفاق العميل بالفروع:
                      </label>
                      <select
                        value={currentTierSettings.periodMonths || 0}
                        onChange={(e) => {
                          handleChange('tierSettings', {
                            ...currentTierSettings,
                            periodMonths: Number(e.target.value)
                          });
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-amber-500"
                      >
                        <option value={0}>مدى الحياة (مجموع كافة الزيارات بجميع الفروع)</option>
                        <option value={3}>آخر 3 أشهر</option>
                        <option value={6}>آخر 6 أشهر</option>
                        <option value={12}>آخر 12 شهراً (سنة كاملة)</option>
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">يتم جمع فواتير العميل في هذه المدة لتحديد ترقيته تلقائياً</p>
                    </div>

                    <div className="flex flex-col justify-between">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        سياسة الجمع بين خصم الترقية والكاش باك:
                      </label>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-slate-800">السماح بخصم الترقية عند سداد كامل الفاتورة بالكاش باك</p>
                          <p className="text-[10px] text-slate-400">إذا تم الإلغاء، تخصم الفاتورة بسعرها الكامل دون جمع الخصمين</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mr-2">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={currentTierSettings.allowTierDiscountWithCashback === true}
                            onChange={(e) => {
                              handleChange('tierSettings', {
                                ...currentTierSettings,
                                allowTierDiscountWithCashback: e.target.checked
                              });
                            }}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 4 Tiers Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {tiersList.map((tier: any) => {
                      const isStandard = tier.id === 'standard';
                      return (
                        <div 
                          key={tier.id}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3 ${
                            tier.id === 'royal' ? 'bg-purple-50/40 border-purple-300 shadow-sm' :
                            tier.id === 'vip' ? 'bg-amber-50/40 border-amber-300 shadow-sm' :
                            tier.id === 'distinguished' ? 'bg-blue-50/40 border-blue-300' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xl">{tier.icon}</span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${tier.badgeBg} ${tier.badgeText} ${tier.badgeBorder}`}>
                                {tier.name}
                              </span>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-0.5">اسم المستوى:</label>
                              <input
                                type="text"
                                value={tier.name}
                                onChange={(e) => updateSingleTier(tier.id, 'name', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-black outline-none focus:border-indigo-600"
                                placeholder="اسم المستوى..."
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">{tier.description}</p>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                الحد الأدنى للإنفاق ({settings.currency}):
                              </label>
                              <input
                                type="number"
                                min="0"
                                disabled={isStandard}
                                value={tier.spendingThreshold}
                                onChange={(e) => updateSingleTier(tier.id, 'spendingThreshold', Number(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-black outline-none focus:border-indigo-600 disabled:bg-slate-100"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                نسبة الخصم المخصصة %:
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={isStandard}
                                value={tier.discountPercentage}
                                onChange={(e) => updateSingleTier(tier.id, 'discountPercentage', Number(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-black outline-none focus:border-indigo-600 disabled:bg-slate-100 text-indigo-700"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-xs text-indigo-950 font-bold flex items-center gap-2">
                    <span>💡</span>
                    <span>
                      بمجرد إدخال رقم العميل في شاشة الكاشير (POS) أو شاشة الحجز، يفحص النظام مستوى العميل عبر كافة فروع الصالون ويظهر شارة المستوى ويطبق نسبة الخصم تلقائياً.
                    </span>
                  </div>

                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* HR, Attendance, Overtime, Delays & Permissions Settings */}
        {/* ============================================================ */}
        {(() => {
          const hr = settings.hrSettings || {
            overtimeRateType: '1.5x',
            customOvertimeHourlyRate: 25,
            overtimeGraceMinutes: 30,
            delayGraceMinutes: 15,
            delayDeductionType: 'percentage_of_daily',
            delayTier1StartMin: 15,
            delayTier1EndMin: 30,
            delayTier1Deduction: 5,
            delayTier2StartMin: 31,
            delayTier2EndMin: 45,
            delayTier2Deduction: 15,
            delayTier3StartMin: 46,
            delayTier3EndMin: 60,
            delayTier3Deduction: 25,
            delayTier4StartMin: 61,
            delayTier4Deduction: 50,
            delayAbsenceThresholdHours: 2,
            maxMonthlyPermissions: 2,
            maxMonthlyPermissionHours: 2,
            weeklyOffPaid: true
          };

          const updateHr = (key: string, value: any) => {
            handleChange('hrSettings', {
              ...hr,
              [key]: value
            });
          };

          return (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      قواعد الحضور والدوام، العمل الإضافي (الأوفر تايم)، التأخير، والاستئذان
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تخصيص كامل لطرق حساب الإضافي، فترات وشرائح خصومات التأخير، ورصيد الاستئذان الشهري بدون خصم
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 1: OVERTIME (العمل الإضافي) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5">
                  <span className="text-sm font-black text-slate-800">⏱️ قواعد احتساب الأوفر تايم (Overtime Calculation)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      طريقة احتساب أجر ساعة الإضافي:
                    </label>
                    <select
                      value={hr.overtimeRateType || '1.5x'}
                      onChange={(e) => updateHr('overtimeRateType', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                    >
                      <option value="1x">سعر الساعة العادية للموظف (1.0x)</option>
                      <option value="1.5x">ساعة ونصف من أجر الساعة (1.5x - نظام العمل)</option>
                      <option value="2x">ساعتان من أجر الساعة (2.0x)</option>
                      <option value="custom_fixed_amount">مبلغ محدد وثابت لكل ساعة إضافية (Fixed Hourly Rate)</option>
                    </select>
                  </div>

                  {hr.overtimeRateType === 'custom_fixed_amount' && (
                    <div className="animate-in fade-in zoom-in duration-150">
                      <label className="block text-xs font-bold text-indigo-900 mb-1 flex items-center gap-1">
                        <span>مبلغ الساعة الإضافية المحدد ({settings.currency}/ساعة) *:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={hr.customOvertimeHourlyRate ?? 25}
                          onChange={(e) => updateHr('customOvertimeHourlyRate', Number(e.target.value))}
                          className="w-full bg-white border-2 border-indigo-400 rounded-xl px-3 py-2 text-xs font-mono font-black text-indigo-950 outline-none focus:border-indigo-600"
                        />
                        <span className="absolute left-3 top-2 text-xs font-bold text-indigo-500">{settings.currency}</span>
                      </div>
                      <p className="text-[10px] text-indigo-600 mt-1">يتم احتساب كل ساعة إضافية بهذا المبلغ مباشرة في التايم شيت والتقارير.</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      فترة السماح قبل احتساب الإضافي (بالدقائق):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={hr.overtimeGraceMinutes ?? 30}
                        onChange={(e) => updateHr('overtimeGraceMinutes', Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-800 outline-none focus:border-indigo-600"
                      />
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">دقيقة</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">لا يحتسب الإضافي إلا إذا تجاوز وقت العمل فترة السماح هذه.</p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: DELAYS & LATENESS (قواعد وخصومات التأخير) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                  <span className="text-sm font-black text-slate-800">⏳ قواعد وشرائح احتساب التأخير (Lateness Tiers & Deductions)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">نوع الخصم:</span>
                    <select
                      value={hr.delayDeductionType || 'percentage_of_daily'}
                      onChange={(e) => updateHr('delayDeductionType', e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                    >
                      <option value="percentage_of_daily">نسبة مئوية من أجر اليوم (%)</option>
                      <option value="fixed_amount">مبالغ مالية ثابتة ({settings.currency})</option>
                    </select>
                  </div>
                </div>

                {/* Grace period & absence threshold */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      فترة السماح بالتأخير عند الحضور (بدون خصم):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={hr.delayGraceMinutes ?? 15}
                        onChange={(e) => updateHr('delayGraceMinutes', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 outline-none focus:border-indigo-600"
                      />
                      <span className="absolute left-3 top-1.5 text-xs font-bold text-slate-400">دقيقة</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">إذا حضر الموظف خلال هذه الدقائق لا يطبق أي خصم تأخير.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      حد اعتبار التأخير غياب كامل لليوم:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={hr.delayAbsenceThresholdHours ?? 2}
                        onChange={(e) => updateHr('delayAbsenceThresholdHours', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 outline-none focus:border-indigo-600"
                      />
                      <span className="absolute left-3 top-1.5 text-xs font-bold text-slate-400">ساعة</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">تأخير أكثر من هذه الساعات يُسجل كيوم غياب كامل ويخصم أجر اليوم.</p>
                  </div>
                </div>

                {/* Delay Tiers Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Tier 1 */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <div className="text-xs font-black text-amber-800 bg-amber-50 px-2 py-1 rounded-lg inline-block">
                      الشريحة الأولى (تأخير بسيط)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold text-slate-600">
                      <div>
                        <span>من دقيقة:</span>
                        <input
                          type="number"
                          value={hr.delayTier1StartMin ?? 15}
                          onChange={(e) => updateHr('delayTier1StartMin', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 font-mono text-center"
                        />
                      </div>
                      <div>
                        <span>إلى دقيقة:</span>
                        <input
                          type="number"
                          value={hr.delayTier1EndMin ?? 30}
                          onChange={(e) => updateHr('delayTier1EndMin', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 font-mono text-center"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">
                        الخصم ({hr.delayDeductionType === 'fixed_amount' ? settings.currency : '%'}):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={hr.delayTier1Deduction ?? 5}
                        onChange={(e) => updateHr('delayTier1Deduction', Number(e.target.value))}
                        className="w-full bg-amber-50/50 border border-amber-300 rounded-xl px-2.5 py-1 text-xs font-mono font-black text-amber-900"
                      />
                    </div>
                  </div>

                  {/* Tier 2 */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <div className="text-xs font-black text-orange-800 bg-orange-50 px-2 py-1 rounded-lg inline-block">
                      الشريحة الثانية (تأخير متوسط)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold text-slate-600">
                      <div>
                        <span>من دقيقة:</span>
                        <input
                          type="number"
                          value={hr.delayTier2StartMin ?? 31}
                          onChange={(e) => updateHr('delayTier2StartMin', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 font-mono text-center"
                        />
                      </div>
                      <div>
                        <span>إلى دقيقة:</span>
                        <input
                          type="number"
                          value={hr.delayTier2EndMin ?? 45}
                          onChange={(e) => updateHr('delayTier2EndMin', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 font-mono text-center"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">
                        الخصم ({hr.delayDeductionType === 'fixed_amount' ? settings.currency : '%'}):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={hr.delayTier2Deduction ?? 15}
                        onChange={(e) => updateHr('delayTier2Deduction', Number(e.target.value))}
                        className="w-full bg-orange-50/50 border border-orange-300 rounded-xl px-2.5 py-1 text-xs font-mono font-black text-orange-900"
                      />
                    </div>
                  </div>

                  {/* Tier 3 */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <div className="text-xs font-black text-rose-800 bg-rose-50 px-2 py-1 rounded-lg inline-block">
                      الشريحة الثالثة (تأخير كبير)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold text-slate-600">
                      <div>
                        <span>من دقيقة:</span>
                        <input
                          type="number"
                          value={hr.delayTier3StartMin ?? 46}
                          onChange={(e) => updateHr('delayTier3StartMin', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 font-mono text-center"
                        />
                      </div>
                      <div>
                        <span>إلى دقيقة:</span>
                        <input
                          type="number"
                          value={hr.delayTier3EndMin ?? 60}
                          onChange={(e) => updateHr('delayTier3EndMin', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 font-mono text-center"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">
                        الخصم ({hr.delayDeductionType === 'fixed_amount' ? settings.currency : '%'}):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={hr.delayTier3Deduction ?? 25}
                        onChange={(e) => updateHr('delayTier3Deduction', Number(e.target.value))}
                        className="w-full bg-rose-50/50 border border-rose-300 rounded-xl px-2.5 py-1 text-xs font-mono font-black text-rose-900"
                      />
                    </div>
                  </div>

                  {/* Tier 4 */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <div className="text-xs font-black text-red-900 bg-red-100 px-2 py-1 rounded-lg inline-block">
                      الشريحة الرابعة (تأخير جسيم)
                    </div>
                    <div className="text-[11px] font-bold text-slate-600">
                      <span>أكثر من (دقيقة):</span>
                      <input
                        type="number"
                        value={hr.delayTier4StartMin ?? 61}
                        onChange={(e) => updateHr('delayTier4StartMin', Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">
                        الخصم ({hr.delayDeductionType === 'fixed_amount' ? settings.currency : '%'}):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={hr.delayTier4Deduction ?? 50}
                        onChange={(e) => updateHr('delayTier4Deduction', Number(e.target.value))}
                        className="w-full bg-red-50/50 border border-red-300 rounded-xl px-2.5 py-1 text-xs font-mono font-black text-red-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: MONTHLY PERMISSIONS & ALLOWANCE (قواعد الاستئذان الشهري) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5">
                  <span className="text-sm font-black text-slate-800">🚪 قواعد رصيد الاستئذان الشهري (Monthly Permissions & Deduction)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الحد الأقصى لساعات الاستئذان شهرياً بدون خصم:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={hr.maxMonthlyPermissionHours ?? 2}
                        onChange={(e) => updateHr('maxMonthlyPermissionHours', Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-800 outline-none focus:border-indigo-600"
                      />
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">ساعة / شهر</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">مثال: ساعتان = 120 دقيقة مسموحة بدون خصم شهرياً.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الحد الأقصى لعدد الأذونات شهرياً:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={hr.maxMonthlyPermissions ?? 2}
                        onChange={(e) => updateHr('maxMonthlyPermissions', Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-800 outline-none focus:border-indigo-600"
                      />
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">إذن / شهر</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">عدد مرات الاستئذان المسموح بها في الشهر الواحد.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      احتساب أجر العطلة الأسبوعية:
                    </label>
                    <label className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3.5 py-2 cursor-pointer mt-0.5">
                      <input
                        type="checkbox"
                        checked={hr.weeklyOffPaid !== false}
                        onChange={(e) => updateHr('weeklyOffPaid', e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800">يوم العطلة الأسبوعية مدفوع الأجر</span>
                    </label>
                    <p className="text-[10px] text-slate-500 mt-1">إذا تم إلغاء التحديد، يخصم أجر أيام العطلة من الراتب الأساسي.</p>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 font-bold flex items-center gap-2">
                  <span>💡</span>
                  <span>
                    <strong>آلية الخصم عند تجاوز الحد الشهري:</strong> يتم احتساب الدقائق الزائدة عن رصيد الساعتين المسموح به شهرياً، وتخصم كل دقيقة إضافية بسعر الدقيقة الفعلي للموظف في ذلك اليوم (بناءً على راتبه الأساسي المعتمد في ذلك التاريخ مقسوماً على 8 ساعات و60 دقيقة).
                  </span>
                </div>
              </div>

            </div>
          );
        })()}

        {/* Treasuries Settings */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
              <Wallet size={16} />
            </div>
            <h3 className="text-base font-bold text-slate-800">إدارة الخزائن (طرق الدفع)</h3>
          </div>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="اسم الخزينة الجديدة..." 
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-primary"
                value={newTreasuryName}
                onChange={e => setNewTreasuryName(e.target.value)}
              />
              <button onClick={addTreasury} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-900 flex items-center gap-1">
                {editingCategoryId ? <Save size={14} /> : <Plus size={14} />} {editingCategoryId ? 'حفظ' : 'إضافة'}
              </button>
              {editingCategoryId && (
                <button onClick={() => { setEditingCategoryId(null); setNewCategoryName(''); }} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-300">إلغاء</button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {settings.treasuries.map(t => (
                <div key={t.id} className="border border-slate-200 rounded-lg p-3 flex justify-between items-center bg-slate-50">
                  <span className="font-bold text-[13px] text-slate-700">{t.name} {t.isMain && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">أساسية</span>}</span>
                  {!t.isMain && (
                    <button onClick={() => deleteTreasury(t.id)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        
        {/* Categories Settings */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
              <Plus size={16} />
            </div>
            <h3 className="text-base font-bold text-slate-800">إدارة التصنيفات</h3>
          </div>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="اسم التصنيف الجديد..." 
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-primary"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
              />
              <select 
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-primary"
                value={newCategoryType}
                onChange={e => setNewCategoryType(e.target.value as 'service' | 'product')}
              >
                <option value="service">خدمات</option>
                <option value="product">منتجات</option>
              </select>
              <button onClick={addCategory} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-900 flex items-center gap-1">
                <Plus size={14} /> إضافة
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories && categories.filter(c => c.id !== 'all').map(c => (
                <div key={c.id} className="border border-slate-200 rounded-lg p-3 flex justify-between items-center bg-slate-50">
                  <div className="flex flex-col"><span className="font-bold text-[13px] text-slate-700">{c.name}</span><span className="text-[10px] text-slate-500">{c.type === 'product' ? 'منتجات' : 'خدمات'}</span></div>
                  
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEditCategory(c)} className="text-blue-400 hover:text-blue-600 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => deleteCategory(c.id)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                  </div>

                </div>
              ))}
            </div>
          </div>
        </div>

        {/* VAT Settings */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-primary flex items-center justify-center">
              <Receipt size={16} />
            </div>
            <h3 className="text-base font-bold text-slate-800">ضريبة القيمة المضافة (VAT)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <p className="font-bold text-[13px] text-slate-800">تفعيل الضريبة</p>
                <p className="text-[11px] text-slate-500 mt-0.5">تطبيق الضريبة على جميع الفواتير</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.vatEnabled}
                  onChange={(e) => handleChange('vatEnabled', e.target.checked)}
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
            {settings.vatEnabled && (
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">نسبة الضريبة (%)</label>
                <input 
                  type="number"
                  value={settings.vatRate}
                  onChange={(e) => handleChange('vatRate', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none transition-colors"
                />
              </div>
            )}
          </div>
        </div>

        {/* ZATCA SAUDI ARABIA PHASE 2 INTEGRATION - SHOWN ONLY FOR SAUDI ARABIA */}
        {isSaudi && (
          <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>🇸🇦 الربط مع هيئة الزكاة والضريبة والجمارك ZATCA (السعودية)</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">المرحلة الثانية (فاتورة)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إصدار الفواتير الضريبية وتوليد رمز الاستجابة السريع (Phase 2 TLV QR) والتوقيع الرقمي (ECDSA) والربط مع البيئة التجريبية والإنتاجية
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${zatcaConfig.isOnboarded ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                  {zatcaConfig.isOnboarded ? 'جاهز للربط الحي 🟢' : 'بانتظار التهيئة (Onboarding) 🟡'}
                </span>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={zatcaConfig.enabled}
                    onChange={(e) => updateZatca('enabled', e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {zatcaConfig.enabled && (
              <div className="space-y-4">
                {/* Environment & Basic Tax IDs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">بيئة العمل (Environment)</label>
                    <select
                      value={zatcaConfig.environment}
                      onChange={e => updateZatca('environment', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-emerald-600 outline-none"
                    >
                      <option value="sandbox">🛠️ بيئة المطورين التجريبية (Sandbox)</option>
                      <option value="simulation">🧪 بيئة المحاكاة والاختبار (Simulation)</option>
                      <option value="production">🚀 البيئة الحقيقية المباشرة (Production)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الرقم الضريبي للمنشأة (15 رقماً)</label>
                    <input
                      type="text"
                      value={zatcaConfig.vatNumber}
                      onChange={e => updateZatca('vatNumber', e.target.value)}
                      placeholder="300000000000003"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-emerald-600 outline-none"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">كود وحدة الحل الإلكتروني (EGS Serial)</label>
                    <input
                      type="text"
                      value={zatcaConfig.egsSerialNumber}
                      onChange={e => updateZatca('egsSerialNumber', e.target.value)}
                      placeholder="EGS-POS-MAIN-01"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-emerald-600 outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* National Address for Tax Invoice */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">المدينة</label>
                    <input
                      type="text"
                      value={zatcaConfig.cityName}
                      onChange={e => updateZatca('cityName', e.target.value)}
                      placeholder="الرياض"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم الشارع</label>
                    <input
                      type="text"
                      value={zatcaConfig.streetName}
                      onChange={e => updateZatca('streetName', e.target.value)}
                      placeholder="طريق الملك فهد"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">رقم المبنى</label>
                    <input
                      type="text"
                      value={zatcaConfig.buildingNumber}
                      onChange={e => updateZatca('buildingNumber', e.target.value)}
                      placeholder="1234"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">الرمز البريدي</label>
                    <input
                      type="text"
                      value={zatcaConfig.postalCode}
                      onChange={e => updateZatca('postalCode', e.target.value)}
                      placeholder="12345"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Onboarding Wizard (CSR & CSID) */}
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <Key size={16} className="text-emerald-700" />
                      <span>خطوات التهيئة والربط (ZATCA Onboarding Wizard):</span>
                    </span>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      Fatoora Portal
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        رمز التحقق لمرة واحدة (OTP من بوابة فاتورة - 6 أرقام):
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={zatcaOtpInput}
                        onChange={e => setZatcaOtpInput(e.target.value)}
                        placeholder="123456"
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold tracking-widest outline-none text-center"
                        dir="ltr"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleRequestComplianceCsid}
                        disabled={zatcaOnboardingBusy}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1"
                      >
                        <span>1. طلب شهادة الامتثال</span>
                      </button>
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleRequestProductionCsid}
                        disabled={zatcaOnboardingBusy || !zatcaConfig.complianceCsid}
                        className="w-full bg-emerald-900 hover:bg-black text-white py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1 disabled:bg-slate-300"
                      >
                        <span>2. تفعيل الإنتاج (PCSID)</span>
                      </button>
                    </div>
                  </div>

                  {zatcaConfig.complianceCsid && (
                    <div className="text-[11px] font-mono text-emerald-900 bg-emerald-100/70 p-2 rounded-lg truncate">
                      ✓ Compliance CSID: {zatcaConfig.complianceCsid}
                    </div>
                  )}
                </div>

                {/* Actions & Connection Test */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleTestZatca}
                      disabled={zatcaTesting}
                      className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      {zatcaTesting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>فحص الاتصال بمنظومة الزكاة</span>
                    </button>

                    {zatcaTestResult && (
                      <span className={`text-xs font-bold ${zatcaTestResult.success ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {zatcaTestResult.message}
                      </span>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={zatcaConfig.autoReportB2C}
                      onChange={e => updateZatca('autoReportB2C', e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>إبلاغ تلقائي عن فواتير الأفراد (B2C) خلال 24 ساعة</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ETA EGYPT E-INVOICE & E-RECEIPT INTEGRATION - SHOWN ONLY FOR EGYPT */}
        {isEgypt && (
          <div className="bg-white rounded-2xl p-5 border border-sky-200 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black shadow-md shadow-sky-600/20">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>🇪🇬 منظومة الفاتورة والإيصال الإلكتروني - مصلحة الضرائب المصرية (ETA)</span>
                    <span className="bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-full font-bold">POS e-Receipt v1.2</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إرسال الإيصالات الإلكترونية لنقاط البيع (B2C) والربط مع منظومة مصلحة الضرائب عبر OAuth2 Client Credentials
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${etaConfig.enabled ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {etaConfig.enabled ? 'مفعل 🟢' : 'معطل ⚪'}
                </span>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={etaConfig.enabled}
                    onChange={(e) => updateEta('enabled', e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>
            </div>

            {etaConfig.enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">البيئة (Environment)</label>
                    <select
                      value={etaConfig.environment}
                      onChange={e => updateEta('environment', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-sky-600 outline-none"
                    >
                      <option value="preproduction">🧪 البيئة التجريبية (Pre-production)</option>
                      <option value="production">🚀 البيئة الفعلية الحية (Production)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم التسجيل الضريبي (9 أرقام)</label>
                    <input
                      type="text"
                      value={etaConfig.taxRegistrationNumber}
                      onChange={e => updateEta('taxRegistrationNumber', e.target.value)}
                      placeholder="123456789"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-sky-600 outline-none"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">كود النشاط الضريبي (Activity)</label>
                    <input
                      type="text"
                      value={etaConfig.taxpayerActivityCode}
                      onChange={e => updateEta('taxpayerActivityCode', e.target.value)}
                      placeholder="9602 (صالونات وتجميل)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-sky-600 outline-none"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الرقم التسلسلي لنقطة البيع (POS)</label>
                    <input
                      type="text"
                      value={etaConfig.posSerialNumber}
                      onChange={e => updateEta('posSerialNumber', e.target.value)}
                      placeholder="POS-EGY-001"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-sky-600 outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* OAuth2 Client Credentials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-sky-50/50 p-3.5 rounded-2xl border border-sky-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Client ID (معرف المنظومة)</label>
                    <input
                      type="text"
                      value={etaConfig.clientId}
                      onChange={e => updateEta('clientId', e.target.value)}
                      placeholder="e.g. 5f8d9b1c-..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Client Secret (المفتاح السري)</label>
                    <input
                      type="password"
                      value={etaConfig.clientSecret}
                      onChange={e => updateEta('clientSecret', e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* ETA Test Connection */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleTestEta}
                      disabled={etaTesting}
                      className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      {etaTesting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>فحص وتوليد رمز المصادقة (ETA Token)</span>
                    </button>

                    {etaTestResult && (
                      <span className={`text-xs font-bold ${etaTestResult.success ? 'text-sky-700' : 'text-rose-600'}`}>
                        {etaTestResult.message}
                      </span>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={etaConfig.autoSubmitReceipts}
                      onChange={e => updateEta('autoSubmitReceipts', e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded"
                    />
                    <span>إرسال الإيصالات تلقائياً لمصلحة الضرائب عند الدفع</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Printer Setup */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <Receipt size={16} />
            </div>
            <h3 className="text-base font-bold text-slate-800">إعدادات طباعة الفواتير والإيصالات</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">مقاس ورق الفاتورة</label>
              <select
                value={settings.paperSize || '80mm'}
                onChange={(e) => handleChange('paperSize', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none transition-colors font-semibold"
              >
                <option value="80mm">إيصال حراري 80 مم (Thermal 80mm - القياسي)</option>
                <option value="58mm">إيصال حراري 58 مم (Thermal 58mm)</option>
                <option value="a4">صفحة قياسية A4</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">اسم الطابعة المعرفة</label>
              <input 
                type="text" 
                value={settings.printerName}
                onChange={(e) => handleChange('printerName', e.target.value)}
                placeholder="مثال: Xprinter-80C"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none transition-colors"
                dir="ltr"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
              <div>
                <p className="text-[13px] font-bold text-slate-800">طباعة تلقائية</p>
                <p className="text-[11px] text-slate-500">طباعة الفاتورة فوراً بعد الدفع</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.printAutomatically}
                  onChange={(e) => handleChange('printAutomatically', e.target.checked)}
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">الترويسة العلوية للفاتورة</label>
              <input
                type="text"
                value={settings.receiptHeaderNote || ''}
                onChange={(e) => handleChange('receiptHeaderNote', e.target.value)}
                placeholder="أهلاً بكم في صالونكم المميز"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">التذييل السفلي للفاتورة</label>
              <input
                type="text"
                value={settings.receiptFooterNote || ''}
                onChange={(e) => handleChange('receiptFooterNote', e.target.value)}
                placeholder="شكراً لزيارتكم ونسعد بخدمتكم دائماً"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Evolution API & WhatsApp Integration */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">بوابة وإعدادات رسائل الواتساب التلقائية (WhatsApp Gateway)</h3>
                <p className="text-xs text-slate-500">إرسال الفواتير وتأكيدات الحجوزات ورموز التحقق OTP للعملاء والموظفين عبر الواتساب</p>
              </div>
            </div>
            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full">
              واتساب آلي 💬
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم الجلسة (Instance Name) *</label>
              <input 
                type="text" 
                value={settings.evolutionInstanceName ?? settings.waInstantName ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleUpdateSettings({
                    evolutionInstanceName: val,
                    waInstantName: val
                  });
                }}
                placeholder="مثال: salon_newlook_main"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-emerald-600 outline-none"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">مفتاح API السري (API Key) *</label>
              <input 
                type="password" 
                value={settings.evolutionApiKey ?? settings.waApiKey ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleUpdateSettings({
                    evolutionApiKey: val,
                    waApiKey: val
                  });
                }}
                placeholder="••••••••••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-600 outline-none"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رابط سيرفر Evolution API (اختياري)</label>
              <input 
                type="text" 
                value={settings.evolutionApiUrl || ''}
                onChange={(e) => handleChange('evolutionApiUrl', e.target.value)}
                placeholder="http://localhost:8080 أو الرابط السحابي"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-600 outline-none"
                dir="ltr"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="text-xs text-slate-600">
              💡 <strong>تنبيه:</strong> تأكد من تسجيل اسم الجلسة ومفتاح API بالشكل الصحيح لإرسال إشعارات الفواتير ورموز OTP وتذكيرات المواعيد.
            </div>
            <button
              type="button"
              onClick={async () => {
                const res = await import('../services/evolutionApiService').then(m => m.EvolutionApiService.checkConnection(settings));
                if (res.connected) {
                  alert(`✅ جلسة الواتساب متصلة بنجاح! رقم الواتساب: ${res.phone || 'متصل'}`);
                } else {
                  alert(`❌ حالة الاتصال: غير متصل (${res.error || 'يرجى مراجعة اسم الجلسة ومفتاح API'})`);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Sparkles size={14} />
              <span>فحص حالة الاتصال</span>
            </button>
          </div>
        </div>
        {/* SYSTEM BACKUP & RESTORE SECTION */}
        <div className="bg-white rounded-3xl p-6 border-2 border-indigo-200/80 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  النسخ الاحتياطي واستعادة كافة البيانات والإعدادات
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  حفظ وتنزيل جميع بيانات النظام في ملف واحد بسيط (.json) واستعادتها في أي وقت بنقرة زر واحدة
                </p>
              </div>
            </div>
            <span className="text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full">
              ملف شامل واحد 📦
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. EXPORT / BACKUP CARD */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Download size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">سحب نسخة احتياطية للبيانات</h4>
                    <p className="text-[11px] text-emerald-700 font-bold">
                      🏢 الفرع النشط: {branches.find(b => b.id === activeBranchId)?.name || settings.salonName}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  تنزيل ملف نسخة احتياطية معزول يحتوي على إعدادات وبيانات هذا الفرع فقط (الفواتير، المعاملات، الخدمات، المنتجات، الموظفين، الحجوزات، الخزائن).
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleExportFullBackup('branch')}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Download size={15} />
                  <span>سحب نسخة احتياطية لفرع ({branches.find(b => b.id === activeBranchId)?.name || settings.salonName}) فقط (.json)</span>
                </button>

                {isOwnerOrProgrammer && (
                  <button
                    type="button"
                    onClick={() => handleExportFullBackup('full')}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer border border-slate-700"
                  >
                    <Download size={14} />
                    <span>🌐 سحب نسخة احتياطية شاملة لكافة الفروع (المالك)</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. IMPORT / RESTORE CARD */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Upload size={16} />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900">استعادة البيانات من ملف</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  استرجاع كافة البيانات والإعدادات المحفوظة مسبقاً في حال حدوث أي مشكلة أو للانتقال إلى جهاز آخر.
                </p>
              </div>

              {/* Upload Input */}
              <div className="relative">
                <input
                  type="file"
                  accept=".json, application/json"
                  onChange={handleSelectBackupFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border border-dashed border-slate-300 hover:border-indigo-500 bg-white rounded-xl p-3 text-center transition-colors">
                  <p className="text-xs font-bold text-slate-700 truncate">
                    {restoreFileName ? `الملف: ${restoreFileName}` : 'اضغط لاختيار ملف النسخة الاحتياطية (.json)'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Restore Error Notice */}
          {restoreError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{restoreError}</span>
            </div>
          )}

          {/* Restore Confirmation Box (When File is selected) */}
          {restoreDataPreview && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                  <FileCheck size={18} />
                  <span>معاينة محتويات ملف النسخة الاحتياطية</span>
                </div>
                <span className="text-[11px] text-amber-700 font-mono">
                  تاريخ النسخة: {new Date(restoreDataPreview.exportedAt).toLocaleString('ar-SA')}
                </span>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
                <div className="bg-white p-2 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px]">الخدمات</span>
                  <span className="font-mono font-black text-slate-900">{restoreDataPreview.servicesCount}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px]">المنتجات</span>
                  <span className="font-mono font-black text-slate-900">{restoreDataPreview.productsCount}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px]">العملاء</span>
                  <span className="font-mono font-black text-slate-900">{restoreDataPreview.clientsCount}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px]">الفواتير</span>
                  <span className="font-mono font-black text-slate-900">{restoreDataPreview.invoicesCount}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px]">الموظفين</span>
                  <span className="font-mono font-black text-slate-900">{restoreDataPreview.employeesCount}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-amber-200">
                  <span className="text-slate-400 block text-[10px]">العمليات</span>
                  <span className="font-mono font-black text-slate-900">{restoreDataPreview.transactionsCount}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                  تحذير: استعادة النسخة الاحتياطية ستستبدل البيانات الحالية بكامل محتويات الملف.
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreDataPreview(null);
                      setRestoreFileName('');
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRestore}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCcw size={14} />
                    <span>تأكيد استعادة البيانات</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
