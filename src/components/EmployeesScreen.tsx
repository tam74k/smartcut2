import React, { useState, useMemo, useRef } from 'react';
import { 
  AppSettings, Employee, EmployeeFinancialRecord, EmployeeLeaveRecord, 
  Transaction, Invoice, Booking, SalaryHistoryEntry, EmployeePermissionRecord, 
  EndOfServiceRecord, HRSettings, CommissionTier, TipRecord, FingerprintLog, EmployeeCustody,
  AppUser, ShiftScheduleEntry, EMPLOYEE_ROLES, ServiceItem, Product
} from '../types';
import { 
  Plus, Edit2, Trash2, Save, UserCog, Search, Banknote, CalendarMinus, 
  Gift, DollarSign, XCircle, CheckCircle, Clock, ShieldAlert, TrendingUp, 
  BarChart3, Settings, ShieldCheck, History, Award, Calendar, FileText, 
  AlertTriangle, Check, X, Printer, UserX, UserCheck, Sparkles, Sliders, Layers,
  Camera, Image as ImageIcon, HeartHandshake, Fingerprint, Package, CheckCircle2, Eye,
  Target, Users, Zap, Globe, Unlock, Info, Ban, Lightbulb
} from 'lucide-react';
import { processImageFile, MAX_IMAGE_SIZE_KB, compressEmployeeAvatar } from '../utils/imageUpload';
import { HRScreen } from './HRScreen';
import { EmployeeAnalyticsScreen } from './EmployeeAnalyticsScreen';
import { TipsScreen } from './TipsScreen';
import { FingerprintLogsScreen } from './FingerprintLogsScreen';
import { EmployeeCustodyModal } from './EmployeeCustodyModal';
import { EmployeeFullProfileView } from './EmployeeFullProfileView';
import { printThermalFinancialVoucher, FinancialVoucherData } from './ThermalFinancialVoucher';
import { getCommissionModelLabel, calculateEmployeeCommission } from '../utils/commissionHelper';
import { DB } from '../services/db';
import { AuthService } from '../services/auth';

export function EmployeesScreen({ 
  settings, 
  setSettings,
  employees, 
  setEmployees, 
  services = [],
  products = [],
  transactions = [], 
  setTransactions,
  shiftData,
  invoices = [],
  bookings = [],
  currentUser,
  tips = [],
  setTips,
  fingerprintLogs = [],
  setFingerprintLogs,
  custodies = [],
  setCustodies,
  activeBranchId,
  licenseInfo,
  onOpenLicenseModal
}: { 
  settings: AppSettings;
  setSettings?: (s: AppSettings) => void;
  activeBranchId?: string;
  employees: Employee[]; 
  setEmployees: (e: Employee[] | ((prev: Employee[]) => Employee[])) => void;
  services?: ServiceItem[];
  products?: Product[];
  transactions?: Transaction[];
  setTransactions?: (t: Transaction[]) => void;
  shiftData?: { isOpen: boolean; date: string; initialCash: number };
  invoices?: Invoice[];
  bookings?: Booking[];
  currentUser?: any;
  tips?: TipRecord[];
  setTips?: (updater: TipRecord[] | ((prev: TipRecord[]) => TipRecord[])) => void;
  fingerprintLogs?: FingerprintLog[];
  setFingerprintLogs?: (updater: FingerprintLog[] | ((prev: FingerprintLog[]) => FingerprintLog[])) => void;
  custodies?: EmployeeCustody[];
  setCustodies?: (updater: EmployeeCustody[] | ((prev: EmployeeCustody[]) => EmployeeCustody[])) => void;
  licenseInfo?: any;
  onOpenLicenseModal?: () => void;
}) {
  // Main Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<
    'list' | 'timesheet' | 'tips' | 'fingerprint_logs' | 'salary_history' | 'shift_schedule_history' | 'end_of_service' | 'permissions' | 'hr_settings' | 'analytics'
  >('list');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // RBAC Granular Permissions
  const canAddEmployee = AuthService.canDo('manage_employees_add', currentUser);
  const canEditEmployee = AuthService.canDo('manage_employees_edit', currentUser);
  const canDeleteEmployee = AuthService.canDo('manage_employees_delete', currentUser);
  const canManageAdvances = AuthService.canDo('hr_manage_advances', currentUser);
  const canManageBonuses = AuthService.canDo('hr_manage_bonuses', currentUser);
  const canManagePenalties = AuthService.canDo('hr_manage_penalties', currentUser);
  const canManageLeaves = AuthService.canDo('hr_manage_leaves', currentUser);
  const canManagePermissions = AuthService.canDo('hr_manage_permissions', currentUser);
  const canSalaryIncrements = AuthService.canDo('hr_salary_increments', currentUser);
  const canManageEndOfService = AuthService.canDo('manage_end_of_service', currentUser);
  const canManageCustodies = AuthService.canDo('manage_custodies', currentUser);
  const canAccessHR = AuthService.canAccess('hr', currentUser) || AuthService.canDo('hr_view_timesheet', currentUser);

  // سقف وترخيص باقة الموظفين (Employee License Tier Quota)
  const maxAllowedEmployees = (typeof licenseInfo?.maxEmployees === 'number' && licenseInfo.maxEmployees > 0)
    ? licenseInfo.maxEmployees
    : null;
  const currentActiveEmployeesCount = useMemo(() => {
    return employees.filter(e => e.isActive !== false && !e.isBlacklisted).length;
  }, [employees]);
  const isEmployeeQuotaReached = maxAllowedEmployees !== null && currentActiveEmployeesCount >= maxAllowedEmployees;
  
  // Default Employee Form Data
  const defaultFormData: Partial<Employee> = {
    name: '',
    role: 'حلاق / كوافير',
    baseSalary: '' as any,
    fingerprintCode: '',
    commissionRate: 0,
    commissionModel: 'none',
    commissionTiers: [
      { id: 't1', fromAmount: 0, toAmount: 5000, percentage: 5 },
      { id: 't2', fromAmount: 5000, toAmount: 10000, percentage: 10 },
      { id: 't3', fromAmount: 10000, toAmount: 0, percentage: 15 }
    ],
    target: 0,
    dailyTargetAmount: 0,
    dailyTargetMethod: 'excess_only',
    dailyTargetMultiplier: 1,
    monthlyTargetAmount: 0,
    monthlyTargetMethod: 'deduct_salary',
    monthlyTargetMultiplier: 1,
    targetSalaryMultiplier: 1,
    targetCommissionRate: 0,
    targetType: 'none',
    availableVacations: 21,
    salaryType: 'salary',
    allowDualCommission: false,
    checkInTime: '09:00',
    checkOutTime: '23:00',
    weeklyDaysOff: ['Friday'],
    email: '',
    avatarUrl: '',
    hasOnlineAccount: false,
    isActive: true,
    isBlacklisted: false
  };
  const [formData, setFormData] = useState<Partial<Employee>>(defaultFormData);
  const [onlineUsername, setOnlineUsername] = useState('');
  const [onlineUserPassword, setOnlineUserPassword] = useState('123456');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const checkUsernameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modal state for Add/Edit Employee (بطاقة مستقلة عريضة على عمودين)
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);

  const handleOpenAddModal = () => {
    if (!canAddEmployee) {
      alert('عذراً، ليس لديك صلاحية إضافة موظف جديد.');
      return;
    }
    if (isEmployeeQuotaReached) {
      if (onOpenLicenseModal) {
        onOpenLicenseModal();
      } else {
        alert('تم استنفاد سعة الموظفين في باقتك الحالية، يرجى الترقية لإضافة موظف جديد.');
      }
      return;
    }
    setEditingId(null);
    setFormData(defaultFormData);
    setOnlineUsername('');
    setOnlineUserPassword('123456');
    setUsernameStatus('idle');
    setIsAddEditModalOpen(true);
  };

  const handleCloseAddEditModal = () => {
    setIsAddEditModalOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
    setOnlineUsername('');
    setOnlineUserPassword('123456');
    setUsernameStatus('idle');
  };

  const handleUsernameChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    setOnlineUsername(cleaned);
    
    if (!cleaned || cleaned.length < 2) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    if (checkUsernameTimerRef.current) clearTimeout(checkUsernameTimerRef.current);
    checkUsernameTimerRef.current = setTimeout(async () => {
      try {
        const isTaken = await AuthService.isUsernameTakenAsync(cleaned, undefined, editingId || undefined);
        setUsernameStatus(isTaken ? 'taken' : 'available');
      } catch {
        setUsernameStatus('idle');
      }
    }, 400);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ضغط صورة الموظف بجودة فائقة وحجم بالغ الصغر (15-35 KB)
    const compressed = await compressEmployeeAvatar(file);
    if (compressed.error) {
      alert(compressed.error);
      return;
    }

    const branchIdToUse = formData.branchId || activeBranchId || settings.branchId;
    const empId = formData.id || ('emp_' + Math.random().toString(36).substr(2, 7));

    const uploadRes = await DB.uploadEmployeeImage(
      compressed.blob,
      empId,
      formData.avatarUrl,
      settings.salonId,
      branchIdToUse
    );

    if (uploadRes.error) {
      alert(uploadRes.error);
      return;
    }

    if (uploadRes.url) {
      setFormData(prev => ({ ...prev, avatarUrl: uploadRes.url }));
    }
  };

  // Modals state
  const [activeEmpId, setActiveEmpId] = useState<string | null>(null);
  const [modalType, setModalType] = useState<
    'advance' | 'penalty' | 'bonus' | 'leave' | 'salary_increase' | 'shift_schedule' | 'permission' | 'end_of_service' | null
  >(null);

  // Modals form states
  const defaultDate = shiftData?.isOpen ? shiftData.date : new Date().toISOString().split('T')[0];
  const [advanceForm, setAdvanceForm] = useState({ amount: 0, treasuryId: settings.treasuries[0]?.id || '', note: '', date: defaultDate });
  const [penaltyForm, setPenaltyForm] = useState({ type: 'penalty_cash' as 'penalty_cash'|'penalty_days', amount: 0, days: 0, note: '', date: defaultDate });
  const [bonusForm, setBonusForm] = useState({ amount: 0, note: '', date: defaultDate });
  const [leaveForm, setLeaveForm] = useState({ startDate: defaultDate, endDate: defaultDate, type: 'paid' as 'paid'|'unpaid'|'termination', note: '' });
  
  // Salary Increment Form
  const [salaryIncreaseForm, setSalaryIncreaseForm] = useState({ newSalary: 0, date: defaultDate, reason: 'زيادة دورية' });

  // Shift Schedule Modification Form
  const [shiftScheduleForm, setShiftScheduleForm] = useState({
    date: defaultDate,
    checkInTime: '09:00',
    checkOutTime: '23:00',
    weeklyDaysOff: ['Friday'],
    reason: 'تعديل مواعيد العمل والورديات'
  });

  // Permission Form
  const [permissionForm, setPermissionForm] = useState({
    date: defaultDate,
    startTime: '14:00',
    endTime: '16:00',
    durationMinutes: 120,
    isExcused: true,
    reason: 'ظرف عائلي خاص'
  });

  // End of Service Form
  const [endOfServiceForm, setEndOfServiceForm] = useState({
    terminationDate: defaultDate,
    reason: 'استقالة',
    notes: '',
    isBlacklisted: false,
    blacklistReason: '',
    settledAmount: 0
  });

  // Fast Quick Action Modal State (سلفة / مكافأة / خصم سريع)
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);
  const [quickActionForm, setQuickActionForm] = useState<{
    type: 'advance' | 'bonus' | 'penalty';
    empId: string;
    amount: number;
    penaltyType: 'penalty_cash' | 'penalty_days';
    days: number;
    treasuryId: string;
    date: string;
    note: string;
  }>({
    type: 'advance',
    empId: employees[0]?.id || '',
    amount: 0,
    penaltyType: 'penalty_cash',
    days: 1,
    treasuryId: settings.treasuries[0]?.id || '',
    date: defaultDate,
    note: ''
  });

  const handleOpenQuickAction = (type: 'advance' | 'bonus' | 'penalty', defaultEmpId?: string) => {
    if (type === 'advance' && !canManageAdvances) {
      alert('عفواً، ليس لديك صلاحية تسجيل السلف.');
      return;
    }
    if (type === 'bonus' && !canManageBonuses) {
      alert('عفواً، ليس لديك صلاحية تسجيل المكافآت.');
      return;
    }
    if (type === 'penalty' && !canManagePenalties) {
      alert('عفواً، ليس لديك صلاحية تسجيل الخصومات والجزاءات.');
      return;
    }
    setQuickActionForm({
      type,
      empId: defaultEmpId || employees[0]?.id || '',
      amount: 0,
      penaltyType: 'penalty_cash',
      days: 1,
      treasuryId: settings.treasuries[0]?.id || '',
      date: defaultDate,
      note: type === 'advance' ? 'سلفة سريعة' : type === 'bonus' ? 'مكافأة أداء' : 'خصم أو جزاء'
    });
    setShowQuickActionModal(true);
  };

  const handleExecuteQuickAction = () => {
    if (!quickActionForm.empId) {
      alert('الرجاء اختيار الموظف أولاً');
      return;
    }

    const emp = employees.find(e => e.id === quickActionForm.empId);
    if (!emp) return;

    const formattedTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const fullDateTime = `${quickActionForm.date} ${formattedTime}`;

    if (quickActionForm.type === 'advance') {
      if (quickActionForm.amount <= 0) {
        alert('الرجاء إدخال مبلغ صحيح للسلفة');
        return;
      }
      if (!quickActionForm.treasuryId) {
        alert('الرجاء اختيار الخزينة المنصرف منها المبلغ');
        return;
      }

      const treasuryName = settings.treasuries.find(t => t.id === quickActionForm.treasuryId)?.name || 'الخزنة الرئيسية';

      const branchCodeToUse = settings.branches?.find(b => b.id === activeBranchId)?.code || (emp as any).branchCode || 'BR-01';
      const trx: Transaction = {
        id: 'TRX-ADV-' + Math.random().toString(36).substring(2, 9),
        date: quickActionForm.date + 'T' + new Date().toTimeString().split(' ')[0],
        shiftDate: shiftData?.isOpen ? shiftData.date : undefined,
        type: 'out',
        amount: quickActionForm.amount,
        category: 'hr_advance',
        description: `سلفة نقدية للموظف (${emp.name}) - ${quickActionForm.note}`,
        treasury: quickActionForm.treasuryId,
        salonId: (emp as any).salonId || settings.salonId,
        branchId: emp.branchId || activeBranchId,
        branchCode: branchCodeToUse
      } as any;
      if (setTransactions) {
        setTransactions(prev => [...(prev || []), trx]);
      }
      DB.saveTransaction(trx, settings.salonId);

      const record: EmployeeFinancialRecord = {
        id: 'FIN-' + Math.random().toString(36).substring(2, 9),
        date: quickActionForm.date,
        type: 'advance',
        amount: quickActionForm.amount,
        treasuryId: quickActionForm.treasuryId,
        note: quickActionForm.note || 'سلفة نقدية سريعة'
      };

      const updatedEmp = {
        ...emp,
        financialRecords: [...(emp.financialRecords || []), record]
      };
      setEmployees(employees.map(e => e.id === emp.id ? updatedEmp : e));
      DB.saveEmployee(updatedEmp, settings.salonId);

      // Print 80mm thermal voucher
      const voucherData: FinancialVoucherData = {
        voucherType: 'advance',
        voucherNumber: `ADV-${Math.floor(100000 + Math.random() * 900000)}`,
        date: fullDateTime,
        employeeName: emp.name,
        employeeCode: emp.fingerprintCode || emp.id,
        employeeRole: emp.role,
        amount: quickActionForm.amount,
        treasuryName,
        note: quickActionForm.note || 'سلفة نقدية على حساب الراتب',
        issuedBy: currentUser?.name || 'مدير النظام'
      };
      printThermalFinancialVoucher(settings, voucherData);
    }

    else if (quickActionForm.type === 'bonus') {
      if (quickActionForm.amount <= 0) {
        alert('الرجاء إدخال مبلغ صحيح للمكافأة');
        return;
      }

      const record: EmployeeFinancialRecord = {
        id: 'FIN-' + Math.random().toString(36).substring(2, 9),
        date: quickActionForm.date,
        type: 'bonus',
        amount: quickActionForm.amount,
        note: quickActionForm.note || 'مكافأة أداء سريعة'
      };

      setEmployees(employees.map(e => e.id === emp.id ? {
        ...e,
        financialRecords: [...(e.financialRecords || []), record]
      } : e));

      // Print 80mm thermal voucher
      const voucherData: FinancialVoucherData = {
        voucherType: 'bonus',
        voucherNumber: `BON-${Math.floor(100000 + Math.random() * 900000)}`,
        date: fullDateTime,
        employeeName: emp.name,
        employeeCode: emp.fingerprintCode || emp.id,
        employeeRole: emp.role,
        amount: quickActionForm.amount,
        note: quickActionForm.note || 'مكافأة أداء وحافز تميز',
        issuedBy: currentUser?.name || 'مدير النظام'
      };
      printThermalFinancialVoucher(settings, voucherData);
    }

    else if (quickActionForm.type === 'penalty') {
      if (quickActionForm.penaltyType === 'penalty_cash' && quickActionForm.amount <= 0) {
        alert('الرجاء إدخال مبلغ الخصم');
        return;
      }
      if (quickActionForm.penaltyType === 'penalty_days' && quickActionForm.days <= 0) {
        alert('الرجاء إدخال عدد أيام الخصم');
        return;
      }

      const record: EmployeeFinancialRecord = {
        id: 'FIN-' + Math.random().toString(36).substring(2, 9),
        date: quickActionForm.date,
        type: quickActionForm.penaltyType,
        amount: quickActionForm.penaltyType === 'penalty_cash' ? quickActionForm.amount : undefined,
        days: quickActionForm.penaltyType === 'penalty_days' ? quickActionForm.days : undefined,
        note: quickActionForm.note || 'خصم أو جزاء إداري'
      };

      setEmployees(employees.map(e => e.id === emp.id ? {
        ...e,
        financialRecords: [...(e.financialRecords || []), record]
      } : e));

      // Print 80mm thermal voucher
      const voucherData: FinancialVoucherData = {
        voucherType: 'penalty',
        voucherNumber: `PEN-${Math.floor(100000 + Math.random() * 900000)}`,
        date: fullDateTime,
        employeeName: emp.name,
        employeeCode: emp.fingerprintCode || emp.id,
        employeeRole: emp.role,
        amount: quickActionForm.penaltyType === 'penalty_cash' ? quickActionForm.amount : undefined,
        days: quickActionForm.penaltyType === 'penalty_days' ? quickActionForm.days : undefined,
        note: quickActionForm.note || 'خصم وجزاء إداري مسجل على الموظف',
        issuedBy: currentUser?.name || 'مدير النظام'
      };
      printThermalFinancialVoucher(settings, voucherData);
    }

    setShowQuickActionModal(false);
  };

  // HR Settings Form State
  const [hrSettingsForm, setHrSettingsForm] = useState<HRSettings>(
    settings.hrSettings || {
      overtimeRateType: '1.5x',
      overtimeGraceMinutes: 30,
      delayTier1Deduction: 5,
      delayTier2Deduction: 15,
      delayTier3Deduction: 25,
      delayTier4Deduction: 50,
      delayAbsenceThresholdHours: 2,
      maxMonthlyPermissions: 2,
      maxPermissionHours: 2,
      weeklyOffPaid: true,
      weeklyOffPaidType: 'paid',
      absenceDeductionDays: 1
    }
  );

  const weekDays = [
    { id: 'Saturday', label: 'السبت' },
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الإثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
  ];

  const handleEdit = (emp: Employee) => {
    if (!canEditEmployee) {
      alert('عفواً، ليس لديك صلاحية تعديل بيانات الموظفين.');
      return;
    }
    setEditingId(emp.id);
    const usersList = AuthService.getUsers();
    const linkedUser = usersList.find(u => u.employeeId === emp.id || (emp.userId && u.id === emp.userId));
    const uName = linkedUser?.username || (emp as any).username || '';
    setOnlineUsername(uName);
    setOnlineUserPassword(linkedUser?.password || '123456');
    setUsernameStatus(uName ? 'available' : 'idle');

    setFormData({
      ...emp,
      commissionRate: emp.commissionRate ?? 0,
      commissionModel: emp.commissionModel || (emp.commissionRate === 0 ? 'none' : 'fixed_rate'),
      dailyTargetAmount: emp.dailyTargetAmount ?? 0,
      dailyTargetMethod: emp.dailyTargetMethod || 'excess_only',
      dailyTargetMultiplier: emp.dailyTargetMultiplier ?? emp.targetSalaryMultiplier ?? 1,
      monthlyTargetAmount: emp.monthlyTargetAmount ?? (emp.target ?? 0),
      monthlyTargetMethod: emp.monthlyTargetMethod || 'deduct_salary',
      monthlyTargetMultiplier: emp.monthlyTargetMultiplier ?? emp.targetSalaryMultiplier ?? 1,
      targetSalaryMultiplier: emp.targetSalaryMultiplier ?? 1,
      targetCommissionRate: emp.targetCommissionRate ?? 0,
      targetType: emp.targetType || ((Number(emp.dailyTargetAmount) > 0) ? 'daily' : ((Number(emp.monthlyTargetAmount || emp.target) > 0) ? 'monthly' : 'none')),
      email: emp.email || '',
      avatarUrl: emp.avatarUrl || '',
      hasOnlineAccount: emp.hasOnlineAccount || Boolean(linkedUser),
      salaryType: emp.salaryType || 'salary',
      allowDualCommission: emp.allowDualCommission || false,
      checkInTime: emp.checkInTime || '09:00',
      checkOutTime: emp.checkOutTime || '18:00',
      weeklyDaysOff: emp.weeklyDaysOff || ['Friday'],
      isActive: emp.isActive !== false,
      isBlacklisted: emp.isBlacklisted || false
    });
    setIsAddEditModalOpen(true);
  };

  const handlePermanentDelete = async (id: string, name?: string) => {
    if (!canDeleteEmployee) {
      alert('عفواً، ليس لديك صلاحية حذف الموظفين نهائياً.');
      return;
    }
    const empName = name || employees.find(e => e.id === id)?.name || 'الموظف';
    if (window.confirm(`تأكيد الحذف النهائي:\nهل أنت متأكد تماماً من حذف الموظف "${empName}" نهائياً من النظام وقاعدة البيانات؟\nلن يمكن التراجع عن هذه الخطوة وسيتم حذف ملف الموظف بالكامل.`)) {
      try {
        await DB.deleteEmployee(id);
        setEmployees(employees.filter(e => e.id !== id));
        if (selectedEmployeeId === id) {
          setSelectedEmployeeId(null);
        }
      } catch (err) {
        console.error('Error deleting employee:', err);
        alert('حدث خطأ أثناء حذف الموظف من قاعدة البيانات');
      }
    }
  };
  const handleDelete = handlePermanentDelete;

  const handleSaveEmployee = async () => {
    if (editingId && !canEditEmployee) {
      alert('عفواً، ليس لديك صلاحية تعديل بيانات الموظفين.');
      return;
    }
    if (!editingId && !canAddEmployee) {
      alert('عفواً، ليس لديك صلاحية إضافة موظف جديد.');
      return;
    }

    if (!formData.name || !formData.role) {
      alert('الرجاء إدخال اسم الموظف والمسمى الوظيفي');
      return;
    }

    // فحص سقف الموظفين المسموح به في خطة الترخيص
    if (!editingId && maxAllowedEmployees !== null && currentActiveEmployeesCount >= maxAllowedEmployees) {
      alert(`لقد وصلت للحد الأقصى لعدد الموظفين المسموح به في خطة ترخيصك الحالية (${maxAllowedEmployees} موظفين).\n\nلإضافة موظفين جدد يرجى ترقية باقة الترخيص والتواصل مع إدارة النظام.`);
      if (onOpenLicenseModal) onOpenLicenseModal();
      return;
    }

    // Check if new employee is in blacklist
    if (!editingId) {
      const isBlocked = employees.some(
        e => e.isBlacklisted && (
          e.name.toLowerCase() === formData.name?.toLowerCase() ||
          (formData.fingerprintCode && e.fingerprintCode === formData.fingerprintCode)
        )
      );

      if (isBlocked) {
        alert('تنبيه: هذا الموظف مدرج في القائمة السوداء (Blacklist) ومحظور تسجيله إلا بعد فك الحظر من قبل الإدارة.');
        return;
      }
    }

    const employeeId = editingId || ('EMP-' + Math.random().toString(36).substring(2, 9));
    const cleanUsername = (onlineUsername || '').trim().toLowerCase();

    // Handle online user account validation
    if (formData.hasOnlineAccount) {
      if (!cleanUsername || cleanUsername.length < 2) {
        alert('الرجاء إدخال اسم مستخدم صحيح لحساب الموظف الأونلاين (حرفين على الأقل باللغة الإنجليزية وبدون مسافات).');
        return;
      }
      if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
        alert('اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام وبدون مسافات (يمكن استخدام _ أو - فقط).');
        return;
      }

      const isTaken = await AuthService.isUsernameTakenAsync(cleanUsername, undefined, editingId || undefined);
      if (isTaken) {
        alert('اسم المستخدم هذا مستخدم بالفعل في قاعدة البيانات! يرجى اختيار اسم مستخدم آخر فريد.');
        return;
      }
    }

    let userUuid = '';
    // Handle online user account creation / linking in System and Database
    if (formData.hasOnlineAccount && cleanUsername) {
      try {
        const storedUsers = localStorage.getItem('smartcut_users');
        const usersList: AppUser[] = storedUsers ? JSON.parse(storedUsers) : [];
        const existingIdx = usersList.findIndex(u => u.employeeId === employeeId || (editingId && u.employeeId === editingId) || u.username.toLowerCase() === cleanUsername);
        
        userUuid = existingIdx >= 0 ? usersList[existingIdx].id : DB.generateUUID();
        const onlineUser: AppUser = {
          id: userUuid,
          salonId: (formData as any).salonId || settings?.salonId,
          salonCode: settings?.salonCode || 'SC-01',
          branchId: formData.branchId || activeBranchId || settings?.branchId,
          branchCode: settings?.branchCode || 'BR-01',
          username: cleanUsername,
          email: formData.email || `${cleanUsername}@smartcut.app`,
          password: onlineUserPassword || '123456',
          name: formData.name,
          role: 'barber',
          employeeId: employeeId,
          phone: '',
          active: formData.isActive !== false,
          screens: ['barber_portal'],
          actions: []
        };

        if (existingIdx >= 0) {
          usersList[existingIdx] = { ...usersList[existingIdx], ...onlineUser };
        } else {
          usersList.push(onlineUser);
        }
        localStorage.setItem('smartcut_users', JSON.stringify(usersList));
        AuthService.saveUser(onlineUser);
        await DB.saveUser(onlineUser);
      } catch (err) {
        console.error('Failed to link online user:', err);
      }
    } else if (!formData.hasOnlineAccount && editingId) {
      // If user unchecks online account, deactivate linked user in System & DB
      try {
        const storedUsers = localStorage.getItem('smartcut_users');
        const usersList: AppUser[] = storedUsers ? JSON.parse(storedUsers) : [];
        const existingUser = usersList.find(u => u.employeeId === editingId);
        if (existingUser) {
          const deactivated = { ...existingUser, active: false };
          AuthService.saveUser(deactivated);
          await DB.saveUser(deactivated);
        }
      } catch (err) {
        console.error('Failed to deactivate online user:', err);
      }
    }

    if (editingId) {
      const existingEmp = employees.find(e => e.id === editingId);
      const isShiftChanged = existingEmp && (
        formData.checkInTime !== existingEmp.checkInTime || 
        formData.checkOutTime !== existingEmp.checkOutTime ||
        JSON.stringify(formData.weeklyDaysOff) !== JSON.stringify(existingEmp.weeklyDaysOff)
      );

      let updatedHistory = existingEmp?.shiftScheduleHistory || [];
      if (isShiftChanged && existingEmp) {
        const shiftEntry: ShiftScheduleEntry = {
          id: 'SCH-' + Math.random().toString(36).substring(2, 9),
          date: defaultDate,
          previousCheckInTime: existingEmp.checkInTime || '09:00',
          previousCheckOutTime: existingEmp.checkOutTime || '18:00',
          checkInTime: formData.checkInTime || '09:00',
          checkOutTime: formData.checkOutTime || '18:00',
          weeklyDaysOff: formData.weeklyDaysOff || existingEmp.weeklyDaysOff || ['Friday'],
          reason: 'تعديل من شاشة بيانات الموظف',
          updatedBy: currentUser?.name || 'مدير النظام'
        };
        updatedHistory = [...updatedHistory, shiftEntry];
      }

      const updatedEmp = { 
        ...existingEmp, 
        ...formData,
        salonId: (formData as any).salonId || existingEmp?.salonId || settings?.salonId,
        branchId: formData.branchId || existingEmp?.branchId || activeBranchId,
        username: formData.hasOnlineAccount ? cleanUsername : (existingEmp?.username || ''),
        userId: formData.hasOnlineAccount ? (userUuid || existingEmp?.userId) : undefined,
        shiftScheduleHistory: updatedHistory
      } as Employee;

      setEmployees((prev: Employee[]) => prev.map(e => e.id === editingId ? updatedEmp : e));

      try {
        const stored = localStorage.getItem('smartcut_employees');
        if (stored) {
          const list = JSON.parse(stored);
          const updatedList = list.map((e: any) => e.id === editingId ? updatedEmp : e);
          localStorage.setItem('smartcut_employees', JSON.stringify(updatedList));
        }
      } catch (err) {}

      const saveRes = await DB.saveEmployee(updatedEmp, settings?.salonId || updatedEmp.salonId);
      if (saveRes) {
        alert(`تم حفظ وتحديث بيانات الموظف "${updatedEmp.name}" بنجاح ✅`);
      } else {
        alert(`تم حفظ التعديلات محلياً بنجاح وجارٍ المزامنة.`);
      }
    } else {
      const newEmp: Employee = {
        ...formData,
        id: employeeId,
        salonId: (formData as any).salonId || settings?.salonId || '11111111-1111-4111-8111-111111111111',
        branchId: formData.branchId || activeBranchId || settings?.branchId,
        username: formData.hasOnlineAccount ? cleanUsername : undefined,
        userId: formData.hasOnlineAccount ? userUuid : undefined,
        fingerprintCode: formData.fingerprintCode || String(employees.length + 1),
        isActive: true,
        isBlacklisted: false,
        blacklistReason: undefined,
        financialRecords: [],
        leaveRecords: [],
        salaryHistory: [{
          id: 'SH-1',
          date: defaultDate,
          previousSalary: 0,
          newSalary: formData.baseSalary || 0,
          reason: 'تعيين أولي',
          approvedBy: currentUser?.name || 'مدير النظام'
        }],
        shiftScheduleHistory: [{
          id: 'SCH-1',
          date: defaultDate,
          previousCheckInTime: formData.checkInTime || '09:00',
          previousCheckOutTime: formData.checkOutTime || '18:00',
          checkInTime: formData.checkInTime || '09:00',
          checkOutTime: formData.checkOutTime || '18:00',
          weeklyDaysOff: formData.weeklyDaysOff || ['Friday'],
          reason: 'مواعيد الدوام عند التعيين الأولي',
          updatedBy: currentUser?.name || 'مدير النظام'
        }],
        permissionRecords: []
      } as Employee;
      setEmployees((prev: Employee[]) => [...prev, newEmp]);

      try {
        const stored = localStorage.getItem('smartcut_employees');
        const list = stored ? JSON.parse(stored) : [];
        list.push(newEmp);
        localStorage.setItem('smartcut_employees', JSON.stringify(list));
      } catch (err) {}

      const saveRes = await DB.saveEmployee(newEmp, settings?.salonId || newEmp.salonId);
      if (saveRes) {
        alert(`تم إضافة الموظف الجديد "${newEmp.name}" وحفظه بنجاح ✅`);
      } else {
        alert(`تم حفظ الموظف محلياً بنجاح وجارٍ المزامنة.`);
      }
    }
    setIsAddEditModalOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
    setOnlineUsername('');
    setOnlineUserPassword('123456');
    setUsernameStatus('idle');
  };

  const toggleDayOff = (day: string) => {
    const current = formData.weeklyDaysOff || [];
    if (current.includes(day)) {
      setFormData({ ...formData, weeklyDaysOff: current.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, weeklyDaysOff: [...current, day] });
    }
  };

  const handleOpenActionModal = (
    empId: string, 
    type: 'advance' | 'penalty' | 'bonus' | 'leave' | 'salary_increase' | 'shift_schedule' | 'permission' | 'end_of_service'
  ) => {
    if (type === 'advance' && !canManageAdvances) {
      alert('عفواً، ليس لديك صلاحية تسجيل السلف.');
      return;
    }
    if (type === 'penalty' && !canManagePenalties) {
      alert('عفواً، ليس لديك صلاحية تسجيل الخصومات والجزاءات.');
      return;
    }
    if (type === 'bonus' && !canManageBonuses) {
      alert('عفواً، ليس لديك صلاحية تسجيل المكافآت.');
      return;
    }
    if (type === 'leave' && !canManageLeaves) {
      alert('عفواً، ليس لديك صلاحية تسجيل الإجازات.');
      return;
    }
    if (type === 'permission' && !canManagePermissions) {
      alert('عفواً، ليس لديك صلاحية تسجيل الاستئذانات.');
      return;
    }
    if (type === 'salary_increase' && !canSalaryIncrements) {
      alert('عفواً، ليس لديك صلاحية تسجيل زيادات الرواتب.');
      return;
    }
    if (type === 'end_of_service' && !canManageEndOfService) {
      alert('عفواً، ليس لديك صلاحية إجراءات إنهاء الخدمة والبلاك ليست.');
      return;
    }

    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    setActiveEmpId(empId);
    setModalType(type);

    if (type === 'advance') {
      setAdvanceForm({ amount: 0, treasuryId: settings.treasuries[0]?.id || '', note: '', date: defaultDate });
    } else if (type === 'penalty') {
      setPenaltyForm({ type: 'penalty_cash', amount: 0, days: 0, note: '', date: defaultDate });
    } else if (type === 'bonus') {
      setBonusForm({ amount: 0, note: '', date: defaultDate });
    } else if (type === 'leave') {
      setLeaveForm({ startDate: defaultDate, endDate: defaultDate, type: 'paid', note: '' });
    } else if (type === 'salary_increase') {
      setSalaryIncreaseForm({ newSalary: (emp.baseSalary || 0) + 500, date: defaultDate, reason: 'زيادة راتب سنوية' });
    } else if (type === 'shift_schedule') {
      setShiftScheduleForm({
        date: defaultDate,
        checkInTime: emp.checkInTime || '09:00',
        checkOutTime: emp.checkOutTime || '18:00',
        weeklyDaysOff: emp.weeklyDaysOff || ['Friday'],
        reason: 'تعديل مواعيد العمل والورديات'
      });
    } else if (type === 'permission') {
      setPermissionForm({ date: defaultDate, startTime: '13:00', endTime: '15:00', durationMinutes: 120, isExcused: true, reason: 'إذن خروج مؤقت' });
    } else if (type === 'end_of_service') {
      setEndOfServiceForm({ terminationDate: defaultDate, reason: 'استقالة', notes: '', isBlacklisted: false, blacklistReason: '', settledAmount: 0 });
    }
  };

  const handleSaveModalAction = () => {
    if (!activeEmpId || !modalType) return;

    setEmployees(employees.map(emp => {
      if (emp.id !== activeEmpId) return emp;
      const updatedEmp = { ...emp };

      if (modalType === 'advance') {
        if (!advanceForm.treasuryId) { alert('اختر الخزينة'); return emp; }
        if (advanceForm.amount <= 0) { alert('المبلغ غير صحيح'); return emp; }
        
        const treasuryName = settings.treasuries.find(t => t.id === advanceForm.treasuryId)?.name || 'الخزنة الرئيسية';

        const branchCodeToUse = settings.branches?.find(b => b.id === activeBranchId)?.code || (emp as any).branchCode || 'BR-01';
        const trx: Transaction = {
          id: 'TRX-ADV-' + Math.random().toString(36).substring(2, 9),
          date: advanceForm.date + 'T' + new Date().toTimeString().split(' ')[0],
          shiftDate: shiftData?.isOpen ? shiftData.date : undefined,
          type: 'out',
          amount: advanceForm.amount,
          category: 'hr_advance',
          description: `سلفة للموظف ${emp.name} - ${advanceForm.note}`,
          treasury: advanceForm.treasuryId,
          salonId: (emp as any).salonId || settings.salonId,
          branchId: emp.branchId || activeBranchId,
          branchCode: branchCodeToUse
        } as any;
        if (setTransactions) {
          setTransactions(prev => [...(prev || []), trx]);
        }
        DB.saveTransaction(trx, settings.salonId);

        const record: EmployeeFinancialRecord = {
          id: 'FIN-' + Math.random().toString(36).substring(2, 9),
          date: advanceForm.date,
          type: 'advance',
          amount: advanceForm.amount,
          treasuryId: advanceForm.treasuryId,
          note: advanceForm.note
        };
        updatedEmp.financialRecords = [...(updatedEmp.financialRecords || []), record];

        // Print 80mm voucher
        printThermalFinancialVoucher(settings, {
          voucherType: 'advance',
          voucherNumber: `ADV-${Math.floor(100000 + Math.random() * 900000)}`,
          date: `${advanceForm.date} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
          employeeName: emp.name,
          employeeCode: emp.fingerprintCode || emp.id,
          employeeRole: emp.role,
          amount: advanceForm.amount,
          treasuryName,
          note: advanceForm.note || 'سلفة نقدية على حساب الراتب',
          issuedBy: currentUser?.name || 'مدير النظام'
        });
      }

      else if (modalType === 'penalty') {
        const record: EmployeeFinancialRecord = {
          id: 'FIN-' + Math.random().toString(36).substring(2, 9),
          date: penaltyForm.date,
          type: penaltyForm.type,
          amount: penaltyForm.type === 'penalty_cash' ? penaltyForm.amount : undefined,
          days: penaltyForm.type === 'penalty_days' ? penaltyForm.days : undefined,
          note: penaltyForm.note
        };
        updatedEmp.financialRecords = [...(updatedEmp.financialRecords || []), record];

        // Print 80mm voucher
        printThermalFinancialVoucher(settings, {
          voucherType: 'penalty',
          voucherNumber: `PEN-${Math.floor(100000 + Math.random() * 900000)}`,
          date: `${penaltyForm.date} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
          employeeName: emp.name,
          employeeCode: emp.fingerprintCode || emp.id,
          employeeRole: emp.role,
          amount: penaltyForm.type === 'penalty_cash' ? penaltyForm.amount : undefined,
          days: penaltyForm.type === 'penalty_days' ? penaltyForm.days : undefined,
          note: penaltyForm.note || 'خصم وجزاء إداري مسجل على الموظف',
          issuedBy: currentUser?.name || 'مدير النظام'
        });
      }

      else if (modalType === 'bonus') {
        const record: EmployeeFinancialRecord = {
          id: 'FIN-' + Math.random().toString(36).substring(2, 9),
          date: bonusForm.date,
          type: 'bonus',
          amount: bonusForm.amount,
          note: bonusForm.note
        };
        updatedEmp.financialRecords = [...(updatedEmp.financialRecords || []), record];

        // Print 80mm voucher
        printThermalFinancialVoucher(settings, {
          voucherType: 'bonus',
          voucherNumber: `BON-${Math.floor(100000 + Math.random() * 900000)}`,
          date: `${bonusForm.date} ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
          employeeName: emp.name,
          employeeCode: emp.fingerprintCode || emp.id,
          employeeRole: emp.role,
          amount: bonusForm.amount,
          note: bonusForm.note || 'مكافأة أداء وحافز تميز',
          issuedBy: currentUser?.name || 'مدير النظام'
        });
      }

      else if (modalType === 'leave') {
        const s = new Date(leaveForm.startDate);
        const e = new Date(leaveForm.endDate);
        const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
        const record: EmployeeLeaveRecord = {
          id: 'LEV-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          type: leaveForm.type,
          daysCount: days,
          reason: leaveForm.note || (leaveForm.type === 'paid' ? 'إجازة مدفوعة الأجر' : 'إجازة بدون أجر'),
          note: leaveForm.note || (leaveForm.type === 'paid' ? 'إجازة مدفوعة الأجر' : 'إجازة بدون أجر'),
          createdAt: new Date().toISOString(),
          approvedBy: currentUser?.name || 'مدير النظام'
        };
        updatedEmp.leaveRecords = [...(updatedEmp.leaveRecords || []), record];
      }

      else if (modalType === 'salary_increase') {
        const entry: SalaryHistoryEntry = {
          id: 'SH-' + Math.random().toString(36).substr(2, 9),
          date: salaryIncreaseForm.date,
          previousSalary: emp.baseSalary || 0,
          newSalary: salaryIncreaseForm.newSalary,
          reason: salaryIncreaseForm.reason,
          approvedBy: currentUser?.name || 'مدير النظام'
        };
        updatedEmp.baseSalary = salaryIncreaseForm.newSalary;
        updatedEmp.salaryHistory = [...(updatedEmp.salaryHistory || []), entry];
      }

      else if (modalType === 'shift_schedule') {
        const entry: ShiftScheduleEntry = {
          id: 'SCH-' + Math.random().toString(36).substr(2, 9),
          date: shiftScheduleForm.date,
          previousCheckInTime: emp.checkInTime || '09:00',
          previousCheckOutTime: emp.checkOutTime || '18:00',
          checkInTime: shiftScheduleForm.checkInTime,
          checkOutTime: shiftScheduleForm.checkOutTime,
          weeklyDaysOff: shiftScheduleForm.weeklyDaysOff,
          reason: shiftScheduleForm.reason,
          updatedBy: currentUser?.name || 'مدير النظام'
        };
        updatedEmp.checkInTime = shiftScheduleForm.checkInTime;
        updatedEmp.checkOutTime = shiftScheduleForm.checkOutTime;
        updatedEmp.weeklyDaysOff = shiftScheduleForm.weeklyDaysOff;
        updatedEmp.shiftScheduleHistory = [...(updatedEmp.shiftScheduleHistory || []), entry];
      }

      else if (modalType === 'permission') {
        const rec: EmployeePermissionRecord = {
          id: 'PRM-' + Math.random().toString(36).substr(2, 9),
          date: permissionForm.date,
          startTime: permissionForm.startTime,
          endTime: permissionForm.endTime,
          durationMinutes: permissionForm.durationMinutes,
          isExcused: permissionForm.isExcused,
          reason: permissionForm.reason
        };
        updatedEmp.permissionRecords = [...(updatedEmp.permissionRecords || []), rec];
      }

      else if (modalType === 'end_of_service') {
        const endRec: EndOfServiceRecord = {
          terminationDate: endOfServiceForm.terminationDate,
          reason: endOfServiceForm.reason,
          notes: endOfServiceForm.notes,
          isBlacklisted: endOfServiceForm.isBlacklisted,
          blacklistReason: endOfServiceForm.blacklistReason,
          settledAmount: endOfServiceForm.settledAmount,
          recordedBy: currentUser?.name || 'مدير النظام'
        };
        updatedEmp.endOfService = endRec;
        updatedEmp.isActive = false;
        updatedEmp.isBlacklisted = endOfServiceForm.isBlacklisted;
        updatedEmp.blacklistReason = endOfServiceForm.blacklistReason;
      }

      // Persist to Supabase DB if available
      if (DB.saveEmployee) {
        DB.saveEmployee(updatedEmp).catch(err => console.error('Error saving updated employee:', err));
      }

      return updatedEmp;
    }));

    setModalType(null);
    setActiveEmpId(null);
  };

  const handleSaveHRSettings = () => {
    if (setSettings) {
      setSettings({
        ...settings,
        hrSettings: hrSettingsForm
      });
      alert('تم حفظ إعدادات الموارد البشرية والدوام بنجاح!');
    }
  };

  const handleUnbanBlacklist = async (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    const empName = emp?.name || 'الموظف';
    if (confirm(`هل أنت متأكد من فك الحظر وإلغاء إدراج الموظف "${empName}" من القائمة السوداء؟`)) {
      const updated = employees.map(e => e.id === empId ? { ...e, isBlacklisted: false, blacklistReason: undefined } : e);
      setEmployees(updated);
      try { localStorage.setItem('smartcut_employees', JSON.stringify(updated)); } catch (e) {}
      const target = updated.find(e => e.id === empId);
      if (target) await DB.saveEmployee(target);
      alert(`تم فك الحظر وإلغاء إدراج "${empName}" من القائمة السوداء بنجاح!`);
    }
  };

  const handleCancelTermination = async (empId: string) => {
    if (confirm('هل أنت متأكد من إلغاء إنهاء الخدمة وإعادة الموظف للعمل؟')) {
      const updated = employees.map(e => e.id === empId ? { ...e, endOfService: undefined, isActive: true } : e);
      setEmployees(updated);
      try { localStorage.setItem('smartcut_employees', JSON.stringify(updated)); } catch (e) {}
      const target = updated.find(e => e.id === empId);
      if (target) await DB.saveEmployee(target);
      alert('تم إلغاء إنهاء الخدمة وإعادة الموظف للعمل بنجاح!');
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`p-4 sm:p-6 mx-auto w-full h-full min-h-0 overflow-y-auto custom-scrollbar bg-slate-50 font-sans ${activeSubTab === 'timesheet' || activeSubTab === 'analytics' ? 'max-w-[99%]' : 'max-w-7xl'}`} dir="rtl">
      
      {/* Top Main Navigation Hub Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
              <UserCog size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">شؤون وإدارة الموظفين الشاملة</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                الكادر الوظيفي، التايم شيت بالبصمة، العمولات، سجل الرواتب، إنهاء الخدمة، وإعدادات الدوام
              </p>
            </div>
          </div>
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
            <button
              disabled={!canManageAdvances}
              onClick={() => {
                if (!canManageAdvances) {
                  alert('عذراً، لا تملك صلاحية صرف وإدارة السلف النقدية (hr_manage_advances)');
                  return;
                }
                handleOpenQuickAction('advance');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all ${
                canManageAdvances
                  ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
              }`}
              title={canManageAdvances ? 'صرف سلفة سريعة' : 'ليس لديك صلاحية صرف السلف (hr_manage_advances)'}
            >
              <Banknote size={15} />
              <span>+ سلفة سريعة</span>
            </button>
            <button
              disabled={!canManageBonuses}
              onClick={() => {
                if (!canManageBonuses) {
                  alert('عذراً، لا تملك صلاحية تسجيل وصرف المكافآت والحوافز (hr_manage_bonuses)');
                  return;
                }
                handleOpenQuickAction('bonus');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all ${
                canManageBonuses
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
              }`}
              title={canManageBonuses ? 'تسجيل مكافأة سريعة' : 'ليس لديك صلاحية المكافآت (hr_manage_bonuses)'}
            >
              <Gift size={15} />
              <span>+ مكافأة سريعة</span>
            </button>
            <button
              disabled={!canManagePenalties}
              onClick={() => {
                if (!canManagePenalties) {
                  alert('عذراً، لا تملك صلاحية تسجيل وتطبيق الخصومات والجزاءات (hr_manage_penalties)');
                  return;
                }
                handleOpenQuickAction('penalty');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all ${
                canManagePenalties
                  ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
              }`}
              title={canManagePenalties ? 'تسجيل خصم سريع' : 'ليس لديك صلاحية الجزاءات (hr_manage_penalties)'}
            >
              <DollarSign size={15} />
              <span>+ خصم سريع</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Nav Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('list')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'list' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCog size={15} />
            <span>بيانات الموظفين</span>
          </button>

          {canAccessHR && (
            <button
              onClick={() => setActiveSubTab('timesheet')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'timesheet' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={15} />
              <span>التايم شيت وسجل الدوام</span>
            </button>
          )}

          {(canAccessHR || canSalaryIncrements) && (
            <button
              onClick={() => setActiveSubTab('salary_history')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'salary_history' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History size={15} />
              <span>سجل الرواتب</span>
            </button>
          )}

          {(canAccessHR || canEditEmployee) && (
            <button
              onClick={() => setActiveSubTab('shift_schedule_history')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'shift_schedule_history' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar size={15} />
              <span>سجل مواعيد الدوام</span>
            </button>
          )}

          {canManageEndOfService && (
            <button
              onClick={() => setActiveSubTab('end_of_service')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'end_of_service' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert size={15} />
              <span>إنهاء الخدمة والبلاك ليست</span>
            </button>
          )}

          {(canAccessHR || canManagePermissions) && (
            <button
              onClick={() => setActiveSubTab('permissions')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'permissions' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarMinus size={15} />
              <span>أذونات الاستئذان</span>
            </button>
          )}

          {(AuthService.canAccess('settings', currentUser) || AuthService.canDo('manage_settings', currentUser)) && (
            <button
              onClick={() => setActiveSubTab('hr_settings')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'hr_settings' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders size={15} />
              <span>إعدادات الدوام والأوفرتايم</span>
            </button>
          )}

          {(AuthService.canAccess('tips', currentUser) || AuthService.canDo('manage_tips', currentUser)) && (
            <button
              onClick={() => setActiveSubTab('tips')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'tips' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HeartHandshake size={15} />
              <span>البقشيش والإكراميات</span>
            </button>
          )}

          {(AuthService.canAccess('fingerprint_logs', currentUser) || AuthService.canDo('hr_fingerprint_sync', currentUser)) && (
            <button
              onClick={() => setActiveSubTab('fingerprint_logs')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'fingerprint_logs' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Fingerprint size={15} />
              <span>سجلات البصمة وأجهزة الدوام</span>
            </button>
          )}

          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'analytics' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 size={15} />
            <span>إحصائيات الأداء</span>
          </button>
        </div>
      </div>


      {/* SUB-TAB 1: STAFF DIRECTORY & CRUD */}
      {activeSubTab === 'list' && (
        selectedEmployee ? (
          <EmployeeFullProfileView
            employee={selectedEmployee}
            settings={settings}
            invoices={invoices}
            transactions={transactions}
            fingerprintLogs={fingerprintLogs}
            onBack={() => setSelectedEmployeeId(null)}
            onOpenActionModal={(empId, action) => handleOpenActionModal(empId, action)}
            onEditEmployee={(emp) => {
              setSelectedEmployeeId(null);
              handleEdit(emp);
            }}
            onUnbanBlacklist={handleUnbanBlacklist}
          />
        ) : (
          <div className="space-y-6">
          {/* Employees Directory Header & Controls */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 mb-5 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-slate-800 text-sm">قائمة موظفي الصالون ({filteredEmployees.length})</h3>
                {maxAllowedEmployees !== null ? (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                    isEmployeeQuotaReached
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    باقة {maxAllowedEmployees} موظفين ({currentActiveEmployeesCount}/{maxAllowedEmployees})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    باقة موظفين غير محدودة ∞
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <input 
                    type="text"
                    placeholder="بحث عن موظف..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold"
                  />
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                {canAddEmployee && (
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className={`px-4 py-2 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap text-white ${
                      isEmployeeQuotaReached
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                    }`}
                  >
                    <Plus size={16} />
                    <span>إضافة موظف جديد</span>
                  </button>
                )}
              </div>
            </div>

            {/* Table View */}
            {filteredEmployees.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <UserX size={40} className="mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-xs">لا يوجد موظفون مطابقون لبحثك</p>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                  >
                    مسح البحث
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50/90 text-slate-600 font-black border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-3 whitespace-nowrap">الكود / الموظف</th>
                      <th className="py-3.5 px-3 whitespace-nowrap">المسمى الوظيفي</th>
                      <th className="py-3.5 px-3 whitespace-nowrap">نظام الراتب</th>
                      <th className="py-3.5 px-3 whitespace-nowrap">العمولة والتارجت</th>
                      <th className="py-3.5 px-3 whitespace-nowrap">الدوام والعطلة</th>
                      <th className="py-3.5 px-3 whitespace-nowrap">حساب الدخول</th>
                      <th className="py-3.5 px-3 whitespace-nowrap text-center">الحالة</th>
                      <th className="py-3.5 px-3 whitespace-nowrap text-center">الإجراءات والعمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map(emp => (
                      <tr 
                        key={emp.id} 
                        className="hover:bg-indigo-50/30 transition-colors group"
                      >
                        {/* 1. Code / Employee info */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div 
                              onClick={() => setSelectedEmployeeId(emp.id)}
                              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 group-hover:border-indigo-400 overflow-hidden shrink-0 flex items-center justify-center font-black text-indigo-700 text-sm shadow-inner cursor-pointer"
                              title="عرض ملف الموظف"
                            >
                              {emp.avatarUrl ? (
                                <img src={emp.avatarUrl} alt={emp.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{emp.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span 
                                  onClick={() => setSelectedEmployeeId(emp.id)}
                                  className="font-black text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors truncate text-xs"
                                  title={emp.name}
                                >
                                  {emp.name}
                                </span>
                                {emp.fingerprintCode && (
                                  <span className="font-mono text-[10px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                                    #{emp.fingerprintCode}
                                  </span>
                                )}
                              </div>
                              {emp.email && (
                                <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]" title={emp.email}>
                                  {emp.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Role */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] inline-block">
                            {emp.role}
                          </span>
                        </td>

                        {/* 3. Salary System */}
                        <td className="py-3 px-3">
                          {emp.salaryType === 'commission_only' ? (
                            <span className="text-amber-700 text-[11px] font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                              بالعمولة فقط
                            </span>
                          ) : (
                            <div className="font-mono font-black text-slate-800 text-[11px]">
                              {(emp.baseSalary || 0).toLocaleString()} {settings.currency}
                              <span className="text-[10px] font-normal text-slate-400 mr-1">
                                {emp.salaryType === 'daily' ? '/يومي' : emp.salaryType === 'weekly' ? '/أسبوعي' : emp.salaryType === 'hourly' ? '/ساعة' : '/شهري'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 4. Commission & Target */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-emerald-700 text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block max-w-[150px] truncate" title={getCommissionModelLabel(emp)}>
                              {getCommissionModelLabel(emp)}
                            </span>
                            {emp.allowDualCommission && (
                              <div className="text-[9px] font-bold text-indigo-600">عمولتان معاً (إداري)</div>
                            )}
                          </div>
                        </td>

                        {/* 5. Schedule & Off Days */}
                        <td className="py-3 px-3">
                          <div className="text-[11px] text-slate-600 font-mono">
                            {emp.checkInTime || '09:00'} - {emp.checkOutTime || '18:00'}
                          </div>
                          {emp.weeklyDaysOff && emp.weeklyDaysOff.length > 0 && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={emp.weeklyDaysOff.map(d => weekDays.find(w => w.id === d)?.label || d).join(', ')}>
                              عطلة: {emp.weeklyDaysOff.map(d => weekDays.find(w => w.id === d)?.label || d).join(', ')}
                            </div>
                          )}
                        </td>

                        {/* 6. Online Account */}
                        <td className="py-3 px-3">
                          {emp.hasOnlineAccount ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full font-mono" dir="ltr">
                              <Globe size={10} className="text-indigo-600" />
                              <span>@{emp.username || (emp as any).username || 'مفعل'}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">—</span>
                          )}
                        </td>

                        {/* 7. Status */}
                        <td className="py-3 px-3 text-center">
                          {emp.isBlacklisted ? (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                              محظور
                            </span>
                          ) : emp.endOfService ? (
                            <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                              منتهي الخدمة
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>نشط</span>
                            </span>
                          )}
                        </td>

                        {/* 8. Actions */}
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            {/* Profile View */}
                            <button
                              type="button"
                              onClick={() => setSelectedEmployeeId(emp.id)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="عرض السجل والملف الشامل"
                            >
                              <Eye size={13} />
                            </button>

                            {/* Advance */}
                            <button
                              type="button"
                              disabled={!canManageAdvances}
                              onClick={() => {
                                if (!canManageAdvances) {
                                  alert('عذراً، لا تملك صلاحية صرف وإدارة السلف النقدية (hr_manage_advances)');
                                  return;
                                }
                                handleOpenActionModal(emp.id, 'advance');
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                canManageAdvances
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 cursor-pointer'
                                  : 'bg-slate-100 text-slate-300 opacity-50 cursor-not-allowed'
                              }`}
                              title={canManageAdvances ? 'تسجيل سلفة' : 'لا تملك صلاحية السلف'}
                            >
                              <Banknote size={13} />
                            </button>

                            {/* Penalty */}
                            <button
                              type="button"
                              disabled={!canManagePenalties}
                              onClick={() => {
                                if (!canManagePenalties) {
                                  alert('عذراً، لا تملك صلاحية تسجيل الجزاءات والخصومات (hr_manage_penalties)');
                                  return;
                                }
                                handleOpenActionModal(emp.id, 'penalty');
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                canManagePenalties
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer'
                                  : 'bg-slate-100 text-slate-300 opacity-50 cursor-not-allowed'
                              }`}
                              title={canManagePenalties ? 'تسجيل خصم/جزاء' : 'لا تملك صلاحية الجزاءات'}
                            >
                              <DollarSign size={13} />
                            </button>

                            {/* Bonus */}
                            <button
                              type="button"
                              disabled={!canManageBonuses}
                              onClick={() => {
                                if (!canManageBonuses) {
                                  alert('عذراً، لا تملك صلاحية تسجيل المكافآت والحوافز (hr_manage_bonuses)');
                                  return;
                                }
                                handleOpenActionModal(emp.id, 'bonus');
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                canManageBonuses
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer'
                                  : 'bg-slate-100 text-slate-300 opacity-50 cursor-not-allowed'
                              }`}
                              title={canManageBonuses ? 'تسجيل مكافأة' : 'لا تملك صلاحية المكافآت'}
                            >
                              <Gift size={13} />
                            </button>

                            {/* Salary Increase */}
                            {canSalaryIncrements && (
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(emp.id, 'salary_increase')}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer"
                                title="تسجيل زيادة راتب"
                              >
                                <TrendingUp size={13} />
                              </button>
                            )}

                            {/* Shift Schedule */}
                            {(canAccessHR || canEditEmployee) && (
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(emp.id, 'shift_schedule')}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                                title="تعديل مواعيد العمل"
                              >
                                <Clock size={13} />
                              </button>
                            )}

                            {/* Blacklist / End of Service */}
                            {emp.isBlacklisted ? (
                              canManageEndOfService && (
                                <button
                                  type="button"
                                  onClick={() => handleUnbanBlacklist(emp.id)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="إلغاء الحظر وفك البلاك ليست"
                                >
                                  <ShieldCheck size={13} />
                                </button>
                              )
                            ) : (
                              canManageEndOfService && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(emp.id, 'end_of_service')}
                                  className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                                  title="إنهاء خدمة / بلاك ليست"
                                >
                                  <UserX size={13} />
                                </button>
                              )
                            )}

                            {/* Edit */}
                            {canEditEmployee && (
                              <button
                                type="button"
                                onClick={() => handleEdit(emp)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="تعديل الموظف"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}

                            {/* Delete */}
                            {canDeleteEmployee && (
                              <button
                                type="button"
                                onClick={() => handlePermanentDelete(emp.id, emp.name)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="حذف نهائي للموظف من النظام"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2-Column Wide Add / Edit Employee Modal */}
          {isAddEditModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800">
                        {editingId ? 'تعديل بيانات موظف' : 'إضافة موظف جديد إلى الكادر'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-bold">
                        {editingId ? `تعديل السجل المهني والمالي لـ ${formData.name || 'الموظف'}` : 'أدخل البيانات الشخصية ونظام الرواتب والعمولات'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAddEditModal}
                    className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Modal Body: 2 Columns */}
                <div className="p-6 max-h-[75vh] overflow-y-auto">
                  {/* Employee Tier Status Banner if adding */}
                  {!editingId && maxAllowedEmployees !== null && (
                    <div className={`mb-5 p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                      isEmployeeQuotaReached
                        ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                        : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isEmployeeQuotaReached ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'
                        }`}>
                          <Users size={18} />
                        </div>
                        <div>
                          <div className="font-black text-[13px] flex items-center gap-2">
                            <span>باقة الموظفين الحالية: {maxAllowedEmployees} موظفين حد أقصى</span>
                            {isEmployeeQuotaReached ? (
                              <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                تم استنفاد السعة المتاحة بالكامل
                              </span>
                            ) : (
                              <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                متبقي {maxAllowedEmployees - currentActiveEmployeesCount} مقاعد
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            الموظفون النشطون حالياً: {currentActiveEmployeesCount} من أصل {maxAllowedEmployees}
                          </p>
                        </div>
                      </div>
                      {isEmployeeQuotaReached && onOpenLicenseModal && (
                        <button
                          type="button"
                          onClick={onOpenLicenseModal}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          ترقية الباقة الآن
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* COLUMN 1: البيانات الشخصية والدوام وحساب النظام */}
                    <div className="space-y-4">
                      <div className="text-xs font-black text-indigo-700 flex items-center gap-2 pb-2 border-b border-indigo-100">
                        <UserCog size={15} />
                        <span>البيانات الشخصية والدوام وحساب النظام</span>
                      </div>

                      {/* Avatar Upload */}
                      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-indigo-300 flex items-center justify-center overflow-hidden shrink-0 relative group">
                          {formData.avatarUrl ? (
                            <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={24} className="text-slate-300" />
                          )}
                          <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Camera size={14} />
                            <span className="text-[8px] font-bold mt-0.5">تغيير</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={handleAvatarUpload}
                            />
                          </label>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-800">صورة الموظف الشخصية</div>
                          <p className="text-[10px] text-slate-500 mt-0.5">تظهر الصورة في الفواتير والتقارير وشاشات الحجز</p>
                          {formData.avatarUrl && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, avatarUrl: '' })}
                              className="text-[10px] text-rose-600 font-bold hover:underline mt-1"
                            >
                              إزالة الصورة
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Name & Role */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            اسم الموظف <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="text"
                            required
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="مثال: أحمد محمد"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            المسمى الوظيفي <span className="text-rose-500">*</span>
                          </label>
                          <select 
                            value={formData.role || EMPLOYEE_ROLES[0]}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none cursor-pointer"
                          >
                            {EMPLOYEE_ROLES.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Fingerprint Code & Email */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            كود جهاز البصمة (ID)
                          </label>
                          <input 
                            type="text"
                            value={formData.fingerprintCode || ''}
                            onChange={e => setFormData({ ...formData, fingerprintCode: e.target.value })}
                            placeholder="مثال: 101"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 focus:bg-white outline-none"
                            dir="ltr"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            البريد الإلكتروني
                          </label>
                          <input 
                            type="email"
                            value={formData.email || ''}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="emp@example.com"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 focus:bg-white outline-none"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      {/* Work Times */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            وقت بدء الدوام
                          </label>
                          <input 
                            type="time"
                            value={formData.checkInTime || '09:00'}
                            onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:border-indigo-600 focus:bg-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            وقت انتهاء الدوام
                          </label>
                          <input 
                            type="time"
                            value={formData.checkOutTime || '18:00'}
                            onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:border-indigo-600 focus:bg-white outline-none"
                          />
                        </div>
                      </div>

                      {/* Weekly Days Off */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                          أيام العطلة الأسبوعية
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {weekDays.map(day => {
                            const isSelected = (formData.weeklyDaysOff || []).includes(day.id);
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => toggleDayOff(day.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'bg-indigo-600 text-white shadow-xs' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bio */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          نبذة تعريفية وتخصصات الموظف
                        </label>
                        <textarea 
                          rows={2}
                          value={formData.bio || ''}
                          onChange={e => setFormData({ ...formData, bio: e.target.value })}
                          placeholder="مهارات الموظف، تخصصات الحلاقة أو التجميل..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none resize-none"
                        />
                      </div>

                      {/* Online Account Section */}
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={formData.hasOnlineAccount || false}
                            onChange={e => setFormData({ ...formData, hasOnlineAccount: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Globe size={14} className="text-indigo-600" />
                            <span>إنشاء / تفعيل حساب دخول للنظام لهذا الموظف</span>
                          </span>
                        </label>

                        {formData.hasOnlineAccount && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[11px] font-bold text-slate-700">
                                  اسم المستخدم (Username) <span className="text-rose-500">*</span>
                                </label>
                                {usernameStatus === 'checking' && (
                                  <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                                    فحص...
                                  </span>
                                )}
                                {usernameStatus === 'available' && (
                                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                    <CheckCircle2 size={12} />
                                    متاح
                                  </span>
                                )}
                                {usernameStatus === 'taken' && (
                                  <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                    <XCircle size={12} />
                                    محجوز!
                                  </span>
                                )}
                              </div>
                              <input 
                                type="text"
                                required={formData.hasOnlineAccount}
                                value={onlineUsername}
                                onChange={e => handleUsernameChange(e.target.value)}
                                placeholder="barber_ahmed"
                                className={`w-full bg-white border rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none ${
                                  usernameStatus === 'taken' ? 'border-rose-400 text-rose-700 bg-rose-50/20' : usernameStatus === 'available' ? 'border-emerald-400 text-slate-800' : 'border-slate-200'
                                }`}
                                dir="ltr"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                كلمة مرور حساب الموظف <span className="text-rose-500">*</span>
                              </label>
                              <input 
                                type="text"
                                required={formData.hasOnlineAccount}
                                value={onlineUserPassword}
                                onChange={e => setOnlineUserPassword(e.target.value)}
                                placeholder="123456"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                                dir="ltr"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* COLUMN 2: الراتب ونظام العمولات والتارجت */}
                    <div className="space-y-4">
                      <div className="text-xs font-black text-indigo-700 flex items-center gap-2 pb-2 border-b border-indigo-100">
                        <Banknote size={15} />
                        <span>الراتب، نظام العمولات، والتارجت</span>
                      </div>

                      {/* Salary Type & Base Salary */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            نوع نظام الراتب <span className="text-rose-500">*</span>
                          </label>
                          <select 
                            value={formData.salaryType || 'salary'}
                            onChange={e => setFormData({ ...formData, salaryType: e.target.value as any })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none cursor-pointer"
                          >
                            <option value="salary">راتب شهري ثابت</option>
                            <option value="weekly">راتب أسبوعي</option>
                            <option value="daily">يوميّة / راتب يومي</option>
                            <option value="hourly">بالساعة</option>
                            <option value="commission_only">بالعمولة فقط (بدون راتب)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {formData.salaryType === 'commission_only' ? 'الراتب الأساسي (غير مطلوب)' : `مبلغ الراتب الأساسي (${settings.currency})`}
                          </label>
                          <input 
                            type="number"
                            disabled={formData.salaryType === 'commission_only'}
                            value={formData.salaryType === 'commission_only' ? '' : (formData.baseSalary ?? '')}
                            onChange={e => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })}
                            placeholder={formData.salaryType === 'commission_only' ? 'بدون راتب' : '0.00'}
                            className="w-full bg-slate-50 disabled:bg-slate-100 disabled:opacity-60 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 focus:bg-white outline-none"
                          />
                        </div>
                      </div>

                      {/* Commission Model Selection */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          نظام احتساب العمولة
                        </label>
                        <select
                          value={formData.commissionModel || 'none'}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData({ 
                              ...formData, 
                              commissionModel: val,
                              targetType: val === 'target' ? (formData.targetType === 'none' ? 'monthly' : (formData.targetType || 'monthly')) : 'none'
                            });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 focus:bg-white outline-none cursor-pointer"
                        >
                          <option value="none">بدون عمولة (راتب فقط)</option>
                          <option value="fixed_rate">عمولة بنسبة ثابتة مباشرة (%)</option>
                          <option value="tiered_brackets">عمولة بشرائح تدرجية حسب الدخل الإجمالي</option>
                          <option value="target">عمولة مرتبطة بتحقيق التارجت المستهدف (Target)</option>
                        </select>
                      </div>

                      {/* Sub-form: Fixed Rate */}
                      {formData.commissionModel === 'fixed_rate' && (
                        <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-200">
                          <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                            نسبة العمولة المباشرة (%)
                          </label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              step="0.5"
                              min="0"
                              max="100"
                              value={formData.commissionRate ?? ''}
                              onChange={e => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
                              placeholder="مثال: 10"
                              className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-emerald-600 outline-none"
                            />
                            <span className="text-emerald-800 font-bold text-xs">%</span>
                          </div>
                          <p className="text-[10px] text-emerald-700 mt-1">يتم احتساب هذه النسبة مباشرة من إجمالي مبيعات وخدمات الموظف</p>
                        </div>
                      )}

                      {/* Sub-form: Tiered Brackets */}
                      {formData.commissionModel === 'tiered_brackets' && (
                        <div className="bg-indigo-50/40 rounded-2xl p-3 border border-indigo-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-indigo-900">جدول الشرائح التدرجية</span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = formData.commissionTiers || [];
                                const lastTo = current.length > 0 ? current[current.length - 1].toAmount : 0;
                                const newTier: CommissionTier = {
                                  id: `t_${Date.now()}`,
                                  fromAmount: lastTo,
                                  toAmount: lastTo + 5000,
                                  percentage: 10
                                };
                                setFormData({ ...formData, commissionTiers: [...current, newTier] });
                              }}
                              className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black cursor-pointer"
                            >
                              + إضافة شريحة
                            </button>
                          </div>

                          <div className="space-y-1.5 max-h-44 overflow-y-auto">
                            {(formData.commissionTiers || []).map((tier, idx) => (
                              <div key={tier.id || idx} className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-indigo-100 text-xs">
                                <span className="text-[10px] font-bold text-slate-500 w-12">من {tier.fromAmount}</span>
                                <span className="text-[10px] font-bold text-slate-500">إلى:</span>
                                <input
                                  type="number"
                                  value={tier.toAmount === 0 ? '' : tier.toAmount}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const updated = [...(formData.commissionTiers || [])];
                                    updated[idx] = { ...updated[idx], toAmount: val };
                                    setFormData({ ...formData, commissionTiers: updated });
                                  }}
                                  placeholder="∞ (ما فوق)"
                                  className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                                />
                                <span className="text-[10px] font-bold text-slate-500">النسبة:</span>
                                <input
                                  type="number"
                                  value={tier.percentage}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const updated = [...(formData.commissionTiers || [])];
                                    updated[idx] = { ...updated[idx], percentage: val };
                                    setFormData({ ...formData, commissionTiers: updated });
                                  }}
                                  className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                                />
                                <span className="text-[10px] font-bold text-slate-500">%</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (formData.commissionTiers || []).filter((_, i) => i !== idx);
                                    setFormData({ ...formData, commissionTiers: updated });
                                  }}
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="حذف الشريحة"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sub-form: Target Model */}
                      {formData.commissionModel === 'target' && (
                        <div className="bg-amber-50/50 rounded-2xl p-3 border border-amber-200 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-amber-900 mb-1">
                                دورة التارجت
                              </label>
                              <select
                                value={formData.targetType || 'monthly'}
                                onChange={e => setFormData({ ...formData, targetType: e.target.value as any })}
                                className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:border-amber-600 outline-none cursor-pointer"
                              >
                                <option value="daily">تارجت يومي</option>
                                <option value="monthly">تارجت شهري</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-amber-900 mb-1">
                                مبلغ التارجت ({settings.currency})
                              </label>
                              <input 
                                type="number"
                                value={formData.targetType === 'daily' ? (formData.dailyTargetAmount ?? '') : (formData.monthlyTargetAmount ?? '')}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (formData.targetType === 'daily') {
                                    setFormData({ ...formData, dailyTargetAmount: val });
                                  } else {
                                    setFormData({ ...formData, monthlyTargetAmount: val, target: val });
                                  }
                                }}
                                placeholder="0.00"
                                className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:border-amber-600 outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-amber-900 mb-1">
                                نسبة عمولة التارجت (%)
                              </label>
                              <input 
                                type="number"
                                step="0.5"
                                value={formData.targetCommissionRate ?? ''}
                                onChange={e => setFormData({ ...formData, targetCommissionRate: parseFloat(e.target.value) || 0, commissionRate: parseFloat(e.target.value) || 0 })}
                                placeholder="مثال: 15"
                                className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:border-amber-600 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-amber-900 mb-1">
                                طريقة الاحتساب
                              </label>
                              <select
                                value={formData.targetType === 'daily' ? (formData.dailyTargetMethod || 'excess_only') : (formData.monthlyTargetMethod || 'deduct_salary')}
                                onChange={e => {
                                  const val = e.target.value as any;
                                  if (formData.targetType === 'daily') {
                                    setFormData({ ...formData, dailyTargetMethod: val });
                                  } else {
                                    setFormData({ ...formData, monthlyTargetMethod: val });
                                  }
                                }}
                                className="w-full bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:border-amber-600 outline-none cursor-pointer"
                              >
                                <option value="excess_only">على ما فوق التارجت فقط (الفائض)</option>
                                <option value="full_amount">على كامل الدخل بعد تحقيق التارجت</option>
                                <option value="deduct_salary">خصم الراتب من الإجمالي</option>
                                <option value="salary_multiplier">مضاعف الراتب</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Dual Commission Checkbox */}
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={formData.allowDualCommission || false}
                            onChange={e => setFormData({ ...formData, allowDualCommission: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="text-xs font-bold text-slate-700">
                            احتساب العمولتين معاً (العمولة الثابتة + عمولة الخدمات المخصصة) لهذا الموظف
                          </span>
                        </label>
                        <p className="text-[10px] text-slate-500 mt-1 pr-6">
                          خاص بالموظفين الإداريين أو الشركاء الذين يتقاضون نسبة عامة بالإضافة لخدماتهم المباشرة
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseAddEditModal}
                    className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEmployee}
                    className={`px-7 py-2.5 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !editingId && isEmployeeQuotaReached
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                    }`}
                  >
                    <Save size={16} />
                    <span>
                      {editingId
                        ? 'حفظ التعديلات'
                        : isEmployeeQuotaReached
                        ? 'ترقية الباقة لإضافة موظف'
                        : 'إضافة الموظف الآن'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )
      )}

      {/* SUB-TAB 2: TIMESHEET & PAYROLL (Full 22 Columns layout) */}
      {activeSubTab === 'timesheet' && (
        <HRScreen
          settings={settings}
          employees={employees}
          setEmployees={setEmployees}
          services={services}
          products={products}
          invoices={invoices}
          transactions={transactions}
          setTransactions={setTransactions}
          bookings={bookings}
          currentUser={currentUser}
          fingerprintLogs={fingerprintLogs}
          setFingerprintLogs={setFingerprintLogs}
          isEmbedded={true}
        />
      )}

      {/* SUB-TAB: TIPS & GRATUITIES (البقشيش والإكراميات) */}
      {activeSubTab === 'tips' && (
        <TipsScreen
          settings={settings}
          tips={tips}
          setTips={setTips}
          employees={employees}
          setTransactions={setTransactions!}
          currentUser={currentUser}
        />
      )}

      {/* SUB-TAB: FINGERPRINT LOGS & BIOMETRICS (سجلات البصمة وأجهزة الدوام) */}
      {activeSubTab === 'fingerprint_logs' && (
        <FingerprintLogsScreen
          settings={settings}
          fingerprintLogs={fingerprintLogs}
          setFingerprintLogs={setFingerprintLogs!}
          employees={employees}
        />
      )}


      {/* SUB-TAB 3: SALARY INCREMENTS HISTORY */}
      {activeSubTab === 'salary_history' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <History size={18} className="text-indigo-600" />
                سجل تطور وزيادات الرواتب (Salary Progression History)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                حفظ تسلسل زيادات الرواتب مع حماية العمليات والرواتب القديمة من التعديل بأثر رجعي
              </p>
            </div>

            <button
              onClick={() => handleOpenActionModal(employees[0]?.id || '', 'salary_increase')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <TrendingUp size={15} />
              <span>+ تسجيل زيادة راتب لموظف</span>
            </button>
          </div>


          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">الموظف</th>
                  <th className="p-3">تاريخ الزيادة</th>
                  <th className="p-3">الراتب السابق</th>
                  <th className="p-3">الراتب الجديد</th>
                  <th className="p-3">مقدار الزيادة</th>
                  <th className="p-3">السبب / الملاحظات</th>
                  <th className="p-3">المعتمد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.flatMap(emp => 
                  (emp.salaryHistory || []).map((sh, idx) => (
                    <tr key={`${emp.id}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{emp.name}</td>
                      <td className="p-3 font-mono text-slate-600">{sh.date}</td>
                      <td className="p-3 font-mono text-slate-500">{Number(sh.previousSalary || 0).toFixed(2)} {settings.currency}</td>
                      <td className="p-3 font-mono font-bold text-emerald-700">{Number(sh.newSalary || 0).toFixed(2)} {settings.currency}</td>
                      <td className="p-3 font-mono font-bold text-indigo-600">
                        +{(Number(sh.newSalary || 0) - Number(sh.previousSalary || 0)).toFixed(2)} {settings.currency}
                      </td>
                      <td className="p-3 text-slate-600">{sh.reason || '-'}</td>
                      <td className="p-3 font-bold text-slate-700">{sh.approvedBy || 'مدير النظام'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: SHIFT SCHEDULE MODIFICATION HISTORY */}
      {activeSubTab === 'shift_schedule_history' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                <span>سجل وتاريخ تعديلات مواعيد الدوام (Shift Schedule Progression History)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تأثير تعديل مواعيد الحضور والانصراف يسري فقط من تاريخ التعديل وما يليه، مع بقاء الأيام السابقة على مواعيدها القديمة في التايم شيت دون تغيير
              </p>
            </div>

            <button
              onClick={() => handleOpenActionModal(employees[0]?.id || '', 'shift_schedule')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Clock size={15} />
              <span>+ تعديل مواعيد دوام موظف</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">الموظف</th>
                  <th className="p-3">تاريخ سريان المواعيد</th>
                  <th className="p-3">المواعيد السابقة</th>
                  <th className="p-3">المواعيد الجديدة (حضور - انصراف)</th>
                  <th className="p-3">العطلة الأسبوعية</th>
                  <th className="p-3">سبب التعديل / البيان</th>
                  <th className="p-3">المعتمد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.flatMap(emp => 
                  (emp.shiftScheduleHistory || []).map((sch, idx) => (
                    <tr key={`${emp.id}-${sch.id || idx}`} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{emp.name}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{sch.date}</td>
                      <td className="p-3 font-mono text-slate-500">
                        {sch.previousCheckInTime && sch.previousCheckOutTime 
                          ? `${sch.previousCheckInTime} - ${sch.previousCheckOutTime}` 
                          : `${emp.checkInTime || '09:00'} - ${emp.checkOutTime || '18:00'}`}
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        {sch.checkInTime} - {sch.checkOutTime}
                      </td>
                      <td className="p-3 text-slate-600">
                        {(sch.weeklyDaysOff || emp.weeklyDaysOff || ['Friday']).map(d => 
                          d === 'Friday' ? 'الجمعة' : d === 'Saturday' ? 'السبت' : d === 'Sunday' ? 'الأحد' : d === 'Monday' ? 'الإثنين' : d === 'Tuesday' ? 'الثلاثاء' : d === 'Wednesday' ? 'الأربعاء' : 'الخميس'
                        ).join(', ')}
                      </td>
                      <td className="p-3 text-slate-600">{sch.reason || 'تعديل وردية العمل'}</td>
                      <td className="p-3 font-bold text-slate-700">{sch.updatedBy || 'مدير النظام'}</td>
                    </tr>
                  ))
                )}
                {employees.every(e => !e.shiftScheduleHistory || e.shiftScheduleHistory.length === 0) && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                      لا توجد أي تعديلات مسجلة على مواعيد الدوام حتى الآن (الموظفون يعملون بالمواعيد الافتراضية).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: END OF SERVICE & BLACKLIST */}
      {activeSubTab === 'end_of_service' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-rose-900 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-rose-600" />
                  إدارة إنهاء الخدمة والقائمة السوداء (Blacklist)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  توثيق خروج الموظفين، أسباب ترك العمل، وحظر إعادة التسجيل للأشخاص الممنوعين
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">تاريخ ترك العمل</th>
                    <th className="p-3">السبب</th>
                    <th className="p-3">مبلغ التسوية</th>
                    <th className="p-3">القائمة السوداء</th>
                    <th className="p-3">سبب الحظر</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.filter(e => e.endOfService || e.isBlacklisted).map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{emp.name}</td>
                      <td className="p-3 font-mono text-slate-600">{emp.endOfService?.terminationDate || '-'}</td>
                      <td className="p-3 text-slate-700">{emp.endOfService?.reason || '-'}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {emp.endOfService?.settledAmount ? `${emp.endOfService.settledAmount} ${settings.currency}` : '-'}
                      </td>
                      <td className="p-3">
                        {emp.isBlacklisted ? (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-black inline-flex items-center gap-1">
                            <Ban size={11} className="text-rose-600" />
                            <span>مدرج في البلاك ليست</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">غير محظور</span>
                        )}
                      </td>
                      <td className="p-3 text-rose-600 text-xs">{emp.blacklistReason || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {emp.isBlacklisted && (
                            <button
                              onClick={() => handleUnbanBlacklist(emp.id)}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold"
                            >
                              فك الحظر
                            </button>
                          )}
                          {emp.endOfService && (
                            <button
                              onClick={() => handleCancelTermination(emp.id)}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold"
                            >
                              إعادة للعمل
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.filter(e => e.endOfService || e.isBlacklisted).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                        لا يوجد موظفين منتهية خدماتهم أو مدرجين في القائمة السوداء حالياً.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: PERMISSIONS (إدارة الاستئذان) */}
      {activeSubTab === 'permissions' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CalendarMinus size={18} className="text-indigo-600" />
                سجل أذونات الاستئذان والخروج
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة الخروج المؤقت أثناء ساعات الدوام وتطبيق خصم الساعات الزائدة تلقائياً
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">الموظف</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">وقت الخروج</th>
                  <th className="p-3">وقت العودة</th>
                  <th className="p-3">المدة (دقائق)</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">السبب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.flatMap(emp => 
                  (emp.permissionRecords || []).map((pr, idx) => (
                    <tr key={`${emp.id}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{emp.name}</td>
                      <td className="p-3 font-mono text-slate-600">{pr.date}</td>
                      <td className="p-3 font-mono text-slate-700">{pr.startTime}</td>
                      <td className="p-3 font-mono text-slate-700">{pr.endTime}</td>
                      <td className="p-3 font-mono font-bold text-indigo-600">{pr.durationMinutes} دقيقة</td>
                      <td className="p-3">
                        {pr.isExcused ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">مأذون (معتمد)</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold">غير مأذون (يخصم)</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{pr.reason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: HR & TIMESHEET SETTINGS */}
      {activeSubTab === 'hr_settings' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Sliders size={18} className="text-indigo-600" />
                إعدادات الحضور، الأوفرتايم، والتأخيرات
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تخصيص قواعد احتساب الساعات الإضافية، مستويات خصم التأخيرات، ونظام الاستئذان
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveHRSettings}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-black shadow-sm"
            >
              حفظ الإعدادات
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overtime Rules */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <Clock size={16} className="text-blue-600" />
                قواعد احتساب الوقت الإضافي (Overtime)
              </h4>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة حساب الساعة الإضافية</label>
                <select
                  value={hrSettingsForm.overtimeRateType}
                  onChange={e => setHrSettingsForm({ ...hrSettingsForm, overtimeRateType: e.target.value as any })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                >
                  <option value="1x">الساعة بساعة (100%)</option>
                  <option value="1.5x">الساعة بساعة ونصف (150%) - افتراضي</option>
                  <option value="2x">الساعة بساعتين (200%)</option>
                  <option value="custom_rate">مبلغ ثابت مخصص لكل ساعة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  فترة السماح قبل بدء احتساب الأوفرتايم (بالدقائق)
                </label>
                <input 
                  type="number"
                  value={hrSettingsForm.overtimeGraceMinutes || 30}
                  onChange={e => setHrSettingsForm({ ...hrSettingsForm, overtimeGraceMinutes: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  لا يبدأ حساب الأوفرتايم إلا بعد تجاوز 30 دقيقة من نهاية الدوام لضمان عدم احتساب الدقائق غير المنتجة.
                </p>
              </div>
            </div>

            {/* Delay Deduction Rules */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-rose-600" />
                مستويات وقواعد خصم التأخيرات
              </h4>

              <div className="text-xs text-slate-700 space-y-2">
                <p className="font-bold">مستويات الخصم التلقائي المعتمدة:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                  <li>من 15 إلى 30 دقيقة: خصم ربع ساعة عمل.</li>
                  <li>من 30 إلى 45 دقيقة: خصم نصف ساعة عمل.</li>
                  <li>من 45 إلى 60 دقيقة: خصم ساعة كاملة.</li>
                  <li>من ساعة إلى ساعتين: خصم ساعة ونصف.</li>
                  <li>أكثر من ساعتين: يعتبر اليوم غياب كامل (ما لم تسامح الإدارة).</li>
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    خصم غياب اليوم (عدد أيام الخصم):
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="0.5"
                    value={hrSettingsForm.absenceDeductionDays ?? 1}
                    onChange={e => setHrSettingsForm({ ...hrSettingsForm, absenceDeductionDays: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">الافتراضي 1 (يخصم اليومية فقط). عند تحديد 2 يخصم اليوم ومعه يوم جزاء إضافي.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نوع الإجازة الأسبوعية:
                  </label>
                  <select
                    value={hrSettingsForm.weeklyOffPaidType || (hrSettingsForm.weeklyOffPaid !== false ? 'paid' : 'unpaid')}
                    onChange={e => {
                      const val = e.target.value as 'paid' | 'unpaid';
                      setHrSettingsForm({
                        ...hrSettingsForm,
                        weeklyOffPaidType: val,
                        weeklyOffPaid: val === 'paid'
                      });
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="paid">مدفوعة الأجر (على حساب الصالون)</option>
                    <option value="unpaid">غير مدفوعة (تخصم من الراتب)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 7: EMPLOYEE ANALYTICS & CHARTS */}
      {activeSubTab === 'analytics' && (
        <EmployeeAnalyticsScreen
          settings={settings}
          employees={employees}
          invoices={invoices}
          bookings={bookings}
          transactions={transactions}
          services={services}
        />
      )}

      {/* QUICK ACTION MODALS (Advance, Penalty, Bonus, Leave, Salary Increase, Permission, End of Service) */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                {modalType === 'advance' && 'تسجيل سلفة مالية'}
                {modalType === 'penalty' && 'تسجيل خصم أو جزاء'}
                {modalType === 'bonus' && 'تسجيل مكافأة مالية'}
                {modalType === 'leave' && 'تسجيل إجازة'}
                {modalType === 'salary_increase' && 'تسجيل زيادة راتب'}
                {modalType === 'permission' && 'تسجيل إذن خروج مؤقت'}
                {modalType === 'end_of_service' && 'تسجيل إنهاء خدمة وبلاك ليست'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Advance Form */}
            {modalType === 'advance' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ ({settings.currency})</label>
                  <input
                    type="number"
                    value={advanceForm.amount}
                    onChange={e => setAdvanceForm({ ...advanceForm, amount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الخزنة المنصرف منها</label>
                  <select
                    value={advanceForm.treasuryId}
                    onChange={e => setAdvanceForm({ ...advanceForm, treasuryId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    {settings.treasuries.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السبب / البيان</label>
                  <input
                    type="text"
                    value={advanceForm.note}
                    onChange={e => setAdvanceForm({ ...advanceForm, note: e.target.value })}
                    placeholder="سلفة شخصية على حساب الراتب"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Penalty Form */}
            {modalType === 'penalty' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع الخصم</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPenaltyForm({ ...penaltyForm, type: 'penalty_cash' })}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        penaltyForm.type === 'penalty_cash' ? 'bg-rose-50 border-rose-400 text-rose-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      مبلغ نقدي ({settings.currency})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPenaltyForm({ ...penaltyForm, type: 'penalty_days' })}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        penaltyForm.type === 'penalty_days' ? 'bg-rose-50 border-rose-400 text-rose-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      خصم أيام عمل
                    </button>
                  </div>
                </div>

                {penaltyForm.type === 'penalty_cash' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ الخصم ({settings.currency})</label>
                    <input
                      type="number"
                      value={penaltyForm.amount || ''}
                      onChange={e => setPenaltyForm({ ...penaltyForm, amount: Number(e.target.value) })}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عدد الأيام المخصومة</label>
                    <input
                      type="number"
                      step="0.5"
                      value={penaltyForm.days || ''}
                      onChange={e => setPenaltyForm({ ...penaltyForm, days: Number(e.target.value) })}
                      placeholder="1"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={penaltyForm.date}
                    onChange={e => setPenaltyForm({ ...penaltyForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السبب / البيان</label>
                  <input
                    type="text"
                    value={penaltyForm.note}
                    onChange={e => setPenaltyForm({ ...penaltyForm, note: e.target.value })}
                    placeholder="سبب الخصم أو الجزاء الإداري..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Bonus Form */}
            {modalType === 'bonus' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ المكافأة ({settings.currency})</label>
                  <input
                    type="number"
                    value={bonusForm.amount || ''}
                    onChange={e => setBonusForm({ ...bonusForm, amount: Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={bonusForm.date}
                    onChange={e => setBonusForm({ ...bonusForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السبب / البيان</label>
                  <input
                    type="text"
                    value={bonusForm.note}
                    onChange={e => setBonusForm({ ...bonusForm, note: e.target.value })}
                    placeholder="مكافأة أداء / حافز تميز..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Leave Form (Multi-Day Support with Financial Impact Breakdown) */}
            {modalType === 'leave' && (() => {
              const s = new Date(leaveForm.startDate);
              const e = new Date(leaveForm.endDate);
              const daysCount = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
              const targetEmp = employees.find(emp => emp.id === activeEmpId);
              const dailyRate = (Number(targetEmp?.baseSalary || 0)) / 30;
              const paidTotalValue = (Number(dailyRate || 0) * daysCount).toFixed(2);

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">من تاريخ (بداية الإجازة)</label>
                      <input
                        type="date"
                        value={leaveForm.startDate}
                        onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-sky-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">إلى تاريخ (نهاية الإجازة)</label>
                      <input
                        type="date"
                        value={leaveForm.endDate}
                        onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-900">إجمالي مدة الإجازة:</span>
                    <span className="text-sm font-black font-mono text-sky-700 bg-white px-3 py-0.5 rounded-lg border border-sky-100 shadow-2xs">
                      {daysCount} {daysCount === 1 ? 'يوم واحد' : daysCount === 2 ? 'يومان' : `${daysCount} أيام`}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">طريقة احتساب الإجازة (الأثر المالي)</label>
                    <select
                      value={leaveForm.type}
                      onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-sky-600"
                    >
                      <option value="paid">إجازة مدفوعة الأجر (يستحق راتب الأيام بالكامل)</option>
                      <option value="unpaid">إجازة بدون راتب (خصم اليومية مع إعفاء من جزاء الغياب)</option>
                    </select>
                  </div>

                  {targetEmp && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>أجر اليوم للموظف:</span>
                        <span className="font-mono font-bold text-slate-800">{Number(dailyRate || 0).toFixed(2)} {settings.currency}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>الأثر المالي في التايم شيت:</span>
                        <span className={`font-mono font-bold ${leaveForm.type === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {leaveForm.type === 'paid' ? `+${paidTotalValue} ${settings.currency} (مدفوع بالكامل)` : `0.00 ${settings.currency} (غير مدفوع وبدون جزاء)`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">السبب / الملاحظات</label>
                    <input
                      type="text"
                      value={leaveForm.note}
                      onChange={e => setLeaveForm({ ...leaveForm, note: e.target.value })}
                      placeholder="إجازة سنوية / إجازة مرضية / ظرف خاص..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-sky-600"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Permission Form */}
            {modalType === 'permission' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الإذن</label>
                  <input
                    type="date"
                    value={permissionForm.date}
                    onChange={e => setPermissionForm({ ...permissionForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">وقت البدء</label>
                    <input
                      type="time"
                      value={permissionForm.startTime}
                      onChange={e => setPermissionForm({ ...permissionForm, startTime: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">وقت العودة</label>
                    <input
                      type="time"
                      value={permissionForm.endTime}
                      onChange={e => setPermissionForm({ ...permissionForm, endTime: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سبب الاستئذان</label>
                  <input
                    type="text"
                    value={permissionForm.reason}
                    onChange={e => setPermissionForm({ ...permissionForm, reason: e.target.value })}
                    placeholder="ظرف طارئ / مراجعة..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Salary Increase Form */}
            {modalType === 'salary_increase' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الراتب الجديد ({settings.currency})</label>
                  <input
                    type="number"
                    value={salaryIncreaseForm.newSalary}
                    onChange={e => setSalaryIncreaseForm({ ...salaryIncreaseForm, newSalary: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ سريان الزيادة</label>
                  <input
                    type="date"
                    value={salaryIncreaseForm.date}
                    onChange={e => setSalaryIncreaseForm({ ...salaryIncreaseForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سبب الزيادة</label>
                  <input
                    type="text"
                    value={salaryIncreaseForm.reason}
                    onChange={e => setSalaryIncreaseForm({ ...salaryIncreaseForm, reason: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>
            )}

            {/* Shift Schedule Modification Form */}
            {modalType === 'shift_schedule' && (
              <div className="space-y-3">
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 font-medium leading-relaxed flex items-start gap-2">
                  <Lightbulb size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div><strong>قاعدة سريان التعديل:</strong> يسري تعديل مواعيد الحضور والانصراف ابتداءً من تاريخ السريان المحدد فقط وما يليه، وتظل الأيام السابقة على مواعيدها القديمة في التايم شيت دون تغيير.</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">موعد الحضور الجديد</label>
                    <input
                      type="time"
                      value={shiftScheduleForm.checkInTime}
                      onChange={e => setShiftScheduleForm({ ...shiftScheduleForm, checkInTime: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">موعد الانصراف الجديد</label>
                    <input
                      type="time"
                      value={shiftScheduleForm.checkOutTime}
                      onChange={e => setShiftScheduleForm({ ...shiftScheduleForm, checkOutTime: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ سريان المواعيد الجديدة</label>
                  <input
                    type="date"
                    value={shiftScheduleForm.date}
                    onChange={e => setShiftScheduleForm({ ...shiftScheduleForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">أيام العطلة الأسبوعية المعتمدة</label>
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {weekDays.map(day => {
                      const isSelected = (shiftScheduleForm.weeklyDaysOff || []).includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            const cur = shiftScheduleForm.weeklyDaysOff || [];
                            const updated = isSelected ? cur.filter(d => d !== day.id) : [...cur, day.id];
                            setShiftScheduleForm({ ...shiftScheduleForm, weeklyDaysOff: updated });
                          }}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سبب تعديل المواعيد / البيان</label>
                  <input
                    type="text"
                    value={shiftScheduleForm.reason}
                    onChange={e => setShiftScheduleForm({ ...shiftScheduleForm, reason: e.target.value })}
                    placeholder="تغيير فترة الدوام / مواعيد الصيف / طلب الموظف..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>
            )}

            {/* End of Service Form */}
            {modalType === 'end_of_service' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ ترك العمل الفعلي</label>
                  <input
                    type="date"
                    value={endOfServiceForm.terminationDate}
                    onChange={e => setEndOfServiceForm({ ...endOfServiceForm, terminationDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سبب ترك العمل</label>
                  <input
                    type="text"
                    value={endOfServiceForm.reason}
                    onChange={e => setEndOfServiceForm({ ...endOfServiceForm, reason: e.target.value })}
                    placeholder="استقالة / انتهاء العقد / فصل"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ مستحقات نهاية الخدمة ({settings.currency})</label>
                  <input
                    type="number"
                    value={endOfServiceForm.settledAmount}
                    onChange={e => setEndOfServiceForm({ ...endOfServiceForm, settledAmount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-rose-900">
                    <input
                      type="checkbox"
                      checked={endOfServiceForm.isBlacklisted}
                      onChange={e => setEndOfServiceForm({ ...endOfServiceForm, isBlacklisted: e.target.checked })}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <span>إدراج الموظف في القائمة السوداء (Blacklist)</span>
                  </label>
                  {endOfServiceForm.isBlacklisted && (
                    <input
                      type="text"
                      placeholder="سبب الإدراج في القائمة السوداء..."
                      value={endOfServiceForm.blacklistReason}
                      onChange={e => setEndOfServiceForm({ ...endOfServiceForm, blacklistReason: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs font-bold text-rose-900"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveModalAction}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700"
              >
                حفظ العملية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAST QUICK ACTION MODAL (سلفة / مكافأة / خصم سريع) */}
      {showQuickActionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                  quickActionForm.type === 'advance' ? 'bg-amber-100 text-amber-800' :
                  quickActionForm.type === 'bonus' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-rose-100 text-rose-800'
                }`}>
                  {quickActionForm.type === 'advance' && <Banknote size={20} />}
                  {quickActionForm.type === 'bonus' && <Gift size={20} />}
                  {quickActionForm.type === 'penalty' && <DollarSign size={20} />}
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    {quickActionForm.type === 'advance' && 'إجراء سلفة مالية سريعة'}
                    {quickActionForm.type === 'bonus' && 'إجراء مكافأة وحافز سريع'}
                    {quickActionForm.type === 'penalty' && 'إجراء خصم أو جزاء سريع'}
                  </h3>
                  <p className="text-xs text-slate-500">تسجيل وتأثير مباشر على الراتب والخزائن</p>
                </div>
              </div>
              <button onClick={() => setShowQuickActionModal(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setQuickActionForm({ ...quickActionForm, type: 'advance' })}
                  className={`py-2 text-xs font-black rounded-lg transition-all ${
                    quickActionForm.type === 'advance' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  سلفة
                </button>
                <button
                  type="button"
                  onClick={() => setQuickActionForm({ ...quickActionForm, type: 'bonus' })}
                  className={`py-2 text-xs font-black rounded-lg transition-all ${
                    quickActionForm.type === 'bonus' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  مكافأة
                </button>
                <button
                  type="button"
                  onClick={() => setQuickActionForm({ ...quickActionForm, type: 'penalty' })}
                  className={`py-2 text-xs font-black rounded-lg transition-all ${
                    quickActionForm.type === 'penalty' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  خصم / جزاء
                </button>
              </div>

              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اختر الموظف:</label>
                <select
                  value={quickActionForm.empId}
                  onChange={e => setQuickActionForm({ ...quickActionForm, empId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-indigo-600 outline-none"
                >
                  {employees.filter(e => !e.isBlacklisted).map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role}) - كود: {emp.fingerprintCode || emp.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount / Days Input */}
              {quickActionForm.type === 'penalty' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع الخصم:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickActionForm({ ...quickActionForm, penaltyType: 'penalty_cash' })}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        quickActionForm.penaltyType === 'penalty_cash' ? 'bg-rose-50 border-rose-400 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      مبلغ نقدي محدد ({settings.currency})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickActionForm({ ...quickActionForm, penaltyType: 'penalty_days' })}
                      className={`py-2 rounded-xl text-xs font-bold border ${
                        quickActionForm.penaltyType === 'penalty_days' ? 'bg-rose-50 border-rose-400 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      خصم أيام من الراتب
                    </button>
                  </div>
                </div>
              )}

              {quickActionForm.type === 'penalty' && quickActionForm.penaltyType === 'penalty_days' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عدد الأيام المخصومة:</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={quickActionForm.days}
                    onChange={e => setQuickActionForm({ ...quickActionForm, days: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none focus:border-rose-600"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {quickActionForm.type === 'advance' ? 'مبلغ السلفة' : quickActionForm.type === 'bonus' ? 'مبلغ المكافأة' : 'مبلغ الخصم'} ({settings.currency}):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quickActionForm.amount || ''}
                    onChange={e => setQuickActionForm({ ...quickActionForm, amount: Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none focus:border-indigo-600"
                  />
                </div>
              )}

              {/* Treasury Selection (For Advance only) */}
              {quickActionForm.type === 'advance' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الخزنة المنصرف منها المبلغ كاش:</label>
                  <select
                    value={quickActionForm.treasuryId}
                    onChange={e => setQuickActionForm({ ...quickActionForm, treasuryId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-amber-600 outline-none"
                  >
                    {settings.treasuries.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ:</label>
                  <input
                    type="date"
                    value={quickActionForm.date}
                    onChange={e => setQuickActionForm({ ...quickActionForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">البيان / السبب:</label>
                  <input
                    type="text"
                    value={quickActionForm.note}
                    onChange={e => setQuickActionForm({ ...quickActionForm, note: e.target.value })}
                    placeholder="ملاحظات..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowQuickActionModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteQuickAction}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                  quickActionForm.type === 'advance' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' :
                  quickActionForm.type === 'bonus' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' :
                  'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                <Check size={15} />
                <span>تنفيذ وحفظ فوراً</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
