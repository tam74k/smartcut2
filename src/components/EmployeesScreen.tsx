import { useState, useMemo } from 'react';
import { 
  AppSettings, Employee, EmployeeFinancialRecord, EmployeeLeaveRecord, 
  Transaction, Invoice, Booking, SalaryHistoryEntry, EmployeePermissionRecord, 
  EndOfServiceRecord, HRSettings, CommissionTier, TipRecord, FingerprintLog, EmployeeCustody 
} from '../types';
import { 
  Plus, Edit2, Trash2, Save, UserCog, Search, Banknote, CalendarMinus, 
  Gift, DollarSign, XCircle, CheckCircle, Clock, ShieldAlert, TrendingUp, 
  BarChart3, Settings, ShieldCheck, History, Award, Calendar, FileText, 
  AlertTriangle, Check, X, Printer, UserX, UserCheck, Sparkles, Sliders, Layers,
  Camera, Image as ImageIcon, HeartHandshake, Fingerprint, Package 
} from 'lucide-react';
import { processImageFile, MAX_IMAGE_SIZE_KB } from '../utils/imageUpload';
import { HRScreen } from './HRScreen';
import { EmployeeAnalyticsScreen } from './EmployeeAnalyticsScreen';
import { TipsScreen } from './TipsScreen';
import { FingerprintLogsScreen } from './FingerprintLogsScreen';
import { EmployeeCustodyModal } from './EmployeeCustodyModal';
import { printThermalFinancialVoucher, FinancialVoucherData } from './ThermalFinancialVoucher';
import { getCommissionModelLabel, calculateEmployeeCommission } from '../utils/commissionHelper';

export function EmployeesScreen({ 
  settings, 
  setSettings,
  employees, 
  setEmployees, 
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
  setCustodies
}: { 
  settings: AppSettings;
  setSettings?: (s: AppSettings) => void;
  employees: Employee[]; 
  setEmployees: (e: Employee[]) => void;
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
}) {
  // Main Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<
    'list' | 'timesheet' | 'tips' | 'fingerprint_logs' | 'salary_history' | 'shift_schedule_history' | 'end_of_service' | 'permissions' | 'hr_settings' | 'analytics'
  >('list');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Default Employee Form Data
  const defaultFormData: Partial<Employee> = {
    name: '',
    role: 'حلاق محترف',
    baseSalary: 3000,
    fingerprintCode: '',
    commissionRate: 10,
    commissionModel: 'fixed_rate',
    commissionTiers: [
      { id: 't1', fromAmount: 0, toAmount: 5000, percentage: 5 },
      { id: 't2', fromAmount: 5000, toAmount: 10000, percentage: 10 },
      { id: 't3', fromAmount: 10000, toAmount: 0, percentage: 15 }
    ],
    target: 5000,
    targetType: 'monthly',
    availableVacations: 21,
    salaryType: 'salary',
    allowDualCommission: false,
    checkInTime: '09:00',
    checkOutTime: '18:00',
    weeklyDaysOff: ['Friday'],
    email: '',
    avatarUrl: '',
    hasOnlineAccount: false,
    isActive: true,
    isBlacklisted: false
  };
  const [formData, setFormData] = useState<Partial<Employee>>(defaultFormData);
  const [onlineUserPassword, setOnlineUserPassword] = useState('123456');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const res = await processImageFile(file);
    if (res.error) {
      alert(res.error);
      return;
    }

    setFormData(prev => ({ ...prev, avatarUrl: res.dataUrl }));
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
    checkOutTime: '18:00',
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

      if (setTransactions && transactions) {
        const trx: Transaction = {
          id: 'TRX-ADV-' + Math.random().toString(36).substring(2, 9),
          date: quickActionForm.date + 'T' + new Date().toTimeString().split(' ')[0],
          type: 'out',
          amount: quickActionForm.amount,
          category: 'hr_advance',
          description: `سلفة نقدية للموظف (${emp.name}) - ${quickActionForm.note}`,
          treasury: quickActionForm.treasuryId
        };
        setTransactions([...transactions, trx]);
      }

      const record: EmployeeFinancialRecord = {
        id: 'FIN-' + Math.random().toString(36).substring(2, 9),
        date: quickActionForm.date,
        type: 'advance',
        amount: quickActionForm.amount,
        treasuryId: quickActionForm.treasuryId,
        note: quickActionForm.note || 'سلفة نقدية سريعة'
      };

      setEmployees(employees.map(e => e.id === emp.id ? {
        ...e,
        financialRecords: [...(e.financialRecords || []), record]
      } : e));

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
      weeklyOffPaid: true
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
    setEditingId(emp.id);
    setFormData({
      ...emp,
      email: emp.email || '',
      avatarUrl: emp.avatarUrl || '',
      hasOnlineAccount: emp.hasOnlineAccount || false,
      salaryType: emp.salaryType || 'salary',
      allowDualCommission: emp.allowDualCommission || false,
      checkInTime: emp.checkInTime || '09:00',
      checkOutTime: emp.checkOutTime || '18:00',
      weeklyDaysOff: emp.weeklyDaysOff || ['Friday'],
      isActive: emp.isActive !== false,
      isBlacklisted: emp.isBlacklisted || false
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
      setEmployees(employees.filter(e => e.id !== id));
    }
  };

  const handleSaveEmployee = () => {
    if (!formData.name || !formData.role) {
      alert('الرجاء إدخال اسم الموظف والمسمى الوظيفي');
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
        alert('❌ تنبيه: هذا الموظف مدرج في القائمة السوداء (Blacklist) ومحظور تسجيله إلا بعد فك الحظر من قبل الإدارة.');
        return;
      }
    }

    const employeeId = editingId || ('EMP-' + Math.random().toString(36).substring(2, 9));

    // Handle online user account creation/linking
    if (formData.hasOnlineAccount && formData.email) {
      try {
        const storedUsers = localStorage.getItem('smartcut_users');
        const usersList: AppUser[] = storedUsers ? JSON.parse(storedUsers) : [];
        const existingIdx = usersList.findIndex(u => u.employeeId === employeeId || u.email === formData.email);
        
        const onlineUser: AppUser = {
          id: existingIdx >= 0 ? usersList[existingIdx].id : ('usr-' + Math.random().toString(36).substring(2, 9)),
          username: formData.email.split('@')[0],
          email: formData.email,
          password: onlineUserPassword || '123456',
          name: formData.name,
          role: 'barber',
          employeeId: employeeId,
          phone: '',
          active: true,
          screens: ['bookings', 'employees'],
          actions: []
        };

        if (existingIdx >= 0) {
          usersList[existingIdx] = { ...usersList[existingIdx], ...onlineUser };
        } else {
          usersList.push(onlineUser);
        }
        localStorage.setItem('smartcut_users', JSON.stringify(usersList));
      } catch (err) {
        console.error('Failed to link online user:', err);
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

      setEmployees(employees.map(e => e.id === editingId ? { 
        ...e, 
        ...formData,
        shiftScheduleHistory: updatedHistory
      } as Employee : e));
    } else {
      const newEmp: Employee = {
        ...formData,
        id: employeeId,
        fingerprintCode: formData.fingerprintCode || String(employees.length + 1),
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
      setEmployees([...employees, newEmp]);
    }
    setEditingId(null);
    setFormData(defaultFormData);
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

        if (setTransactions && transactions) {
          const trx: Transaction = {
            id: 'TRX-ADV-' + Math.random().toString(36).substring(2, 9),
            date: advanceForm.date + 'T' + new Date().toTimeString().split(' ')[0],
            type: 'out',
            amount: advanceForm.amount,
            category: 'hr_advance',
            description: `سلفة للموظف ${emp.name} - ${advanceForm.note}`,
            treasury: advanceForm.treasuryId
          };
          setTransactions([...transactions, trx]);
        }

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
        const record: EmployeeLeaveRecord = {
          id: 'LEV-' + Math.random().toString(36).substring(2, 9),
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          type: leaveForm.type,
          note: leaveForm.note
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

  const handleUnbanBlacklist = (empId: string) => {
    if (confirm('هل أنت متأكد من فك الحظر وإلغاء إدراج هذا الموظف في القائمة السوداء؟')) {
      setEmployees(employees.map(e => e.id === empId ? { ...e, isBlacklisted: false, blacklistReason: undefined } : e));
    }
  };

  const handleCancelTermination = (empId: string) => {
    if (confirm('هل أنت متأكد من إلغاء إنهاء الخدمة وإعادة الموظف للعمل؟')) {
      setEmployees(employees.map(e => e.id === empId ? { ...e, endOfService: undefined, isActive: true } : e));
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto bg-slate-50 font-sans" dir="rtl">
      
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
              onClick={() => handleOpenQuickAction('advance')}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Banknote size={15} />
              <span>+ سلفة سريعة</span>
            </button>
            <button
              onClick={() => handleOpenQuickAction('bonus')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Gift size={15} />
              <span>+ مكافأة سريعة</span>
            </button>
            <button
              onClick={() => handleOpenQuickAction('penalty')}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
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

          <button
            onClick={() => setActiveSubTab('timesheet')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'timesheet' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={15} />
            <span>التايم شيت وسجل الدوام</span>
          </button>

          <button
            onClick={() => setActiveSubTab('salary_history')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'salary_history' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={15} />
            <span>سجل الرواتب</span>
          </button>

          <button
            onClick={() => setActiveSubTab('shift_schedule_history')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'shift_schedule_history' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar size={15} />
            <span>سجل مواعيد الدوام</span>
          </button>

          <button
            onClick={() => setActiveSubTab('end_of_service')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'end_of_service' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert size={15} />
            <span>إنهاء الخدمة والبلاك ليست</span>
          </button>

          <button
            onClick={() => setActiveSubTab('permissions')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'permissions' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarMinus size={15} />
            <span>أذونات الاستئذان</span>
          </button>

          <button
            onClick={() => setActiveSubTab('hr_settings')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'hr_settings' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders size={15} />
            <span>إعدادات الدوام والأوفرتايم</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tips')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'tips' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HeartHandshake size={15} />
            <span>البقشيش والإكراميات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('fingerprint_logs')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'fingerprint_logs' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Fingerprint size={15} />
            <span>سجلات البصمة وأجهزة الدوام</span>
          </button>

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
        <div className="space-y-6">
          {/* Add / Edit Form Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h3 className="text-base font-black text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-600" />
              <span>{editingId ? 'تعديل بيانات موظف' : 'إضافة موظف جديد إلى الكادر'}</span>
            </h3>

            <div className="flex flex-col md:flex-row gap-6 items-start mb-6 pb-6 border-b border-slate-100">
              {/* Employee Avatar Upload Box */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="relative w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-indigo-200 overflow-hidden flex items-center justify-center group shadow-inner">
                  {formData.avatarUrl ? (
                    <>
                      <img src={formData.avatarUrl} alt="Employee" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, avatarUrl: '' })}
                        className="absolute top-1 left-1 bg-rose-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="حذف الصورة"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Camera size={24} className="mb-1" />
                      <span className="text-[10px] font-bold">صورة الموظف</span>
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-black">
                    <Camera size={18} className="mb-0.5" />
                    <span>{formData.avatarUrl ? 'تغيير الصورة' : 'رفع صورة'}</span>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  حد أقصى {MAX_IMAGE_SIZE_KB} KB
                </span>
              </div>

              {/* Basic Fields */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف</label>
                  <input 
                    type="text" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="محمد فتحي"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي</label>
                  <input 
                    type="text" 
                    value={formData.role || ''} 
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    placeholder="مصفف شعر / حلاق"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كود البصمة (Fingerprint)</label>
                  <input 
                    type="text" 
                    value={formData.fingerprintCode || ''} 
                    onChange={e => setFormData({ ...formData, fingerprintCode: e.target.value })}
                    placeholder="13"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-indigo-700">
                      <span>🌟 نبذة وملاحظات الموظف (تظهر للعملاء في الحجز الأونلاين):</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">مثال: خبير صبغات وحاصل على جائزة أفضل حلاق</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.publicBio || ''} 
                    onChange={e => setFormData({ ...formData, publicBio: e.target.value })}
                    placeholder="خبير صبغات وتصفيف عالمي، حاصل على جائزة أفضل حلاق 🏆"
                    className="w-full bg-slate-50 border border-indigo-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:border-indigo-600 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الراتب والاستحقاق</label>
                <select
                  value={formData.salaryType || 'salary'}
                  onChange={e => setFormData({ ...formData, salaryType: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                >
                  <option value="salary">راتب ثابت شهري</option>
                  <option value="commission_only">بالعمولة فقط (بدون راتب ثابت)</option>
                  <option value="salary_plus_commission">راتب أساسي + عمولة مبيعات</option>
                </select>
              </div>

              {formData.salaryType !== 'commission_only' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الراتب الأساسي الشهري ({settings.currency})</label>
                  <input 
                    type="number" 
                    value={formData.baseSalary || 0} 
                    onChange={e => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نظام ونموذج احتساب العمولة</label>
                <select
                  value={formData.commissionModel || 'fixed_rate'}
                  onChange={e => setFormData({ ...formData, commissionModel: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-600 outline-none"
                >
                  <option value="fixed_rate">نسبة مئوية ثابتة (%)</option>
                  <option value="target_based">تارجت مبيعات محدد + نسبة عمولة</option>
                  <option value="tiered_brackets">شرائح مبيعات متدرجة تصاعدية (Tiered Brackets) 📈</option>
                </select>
              </div>

              {formData.commissionModel === 'fixed_rate' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نسبة العمولة الثابتة (%)</label>
                  <input 
                    type="number" 
                    value={formData.commissionRate || 0} 
                    onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                  />
                </div>
              )}

              {formData.commissionModel === 'target_based' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">قيمة التارجت ({settings.currency})</label>
                    <input 
                      type="number" 
                      value={formData.target || 0} 
                      onChange={e => setFormData({ ...formData, target: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">النسبة عند التحقيق (%)</label>
                    <input 
                      type="number" 
                      value={formData.commissionRate || 0} 
                      onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              )}

              {formData.commissionModel === 'tiered_brackets' && (
                <div className="col-span-1 sm:col-span-2 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                        <Layers size={15} className="text-indigo-600" />
                        <span>شرائح العمولات المتدرجة (Tiered Commission Brackets)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        يتم احتساب العمولة تلقائياً تصاعدياً لكل شريحة مبيعات يحققها الموظف
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const tiers = formData.commissionTiers || [];
                        const lastTier = tiers[tiers.length - 1];
                        const newFrom = lastTier ? (lastTier.toAmount || lastTier.fromAmount + 5000) : 0;
                        const newTier: CommissionTier = {
                          id: 'tier-' + Math.random().toString(36).substring(2, 7),
                          fromAmount: newFrom,
                          toAmount: newFrom + 5000,
                          percentage: (lastTier ? lastTier.percentage + 5 : 5)
                        };
                        setFormData({ ...formData, commissionTiers: [...tiers, newTier] });
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>+ إضافة شريحة</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(formData.commissionTiers || []).map((tier, idx) => (
                      <div key={tier.id || idx} className="grid grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-indigo-200/60 items-center text-xs">
                        <div className="col-span-1 font-bold text-slate-500 font-mono text-center">
                          #{idx + 1}
                        </div>
                        <div className="col-span-4">
                          <label className="block text-[10px] text-slate-500 mb-0.5">من مبيعات ({settings.currency}):</label>
                          <input
                            type="number"
                            value={tier.fromAmount}
                            onChange={e => {
                              const updated = [...(formData.commissionTiers || [])];
                              updated[idx] = { ...tier, fromAmount: Number(e.target.value) };
                              setFormData({ ...formData, commissionTiers: updated });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="block text-[10px] text-slate-500 mb-0.5">إلى مبيعات (0 = مفتوح):</label>
                          <input
                            type="number"
                            value={tier.toAmount || ''}
                            placeholder="بدون حد أقصى"
                            onChange={e => {
                              const updated = [...(formData.commissionTiers || [])];
                              updated[idx] = { ...tier, toAmount: Number(e.target.value) || 0 };
                              setFormData({ ...formData, commissionTiers: updated });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-500 mb-0.5">النسبة (%):</label>
                          <input
                            type="number"
                            value={tier.percentage}
                            onChange={e => {
                              const updated = [...(formData.commissionTiers || [])];
                              updated[idx] = { ...tier, percentage: Number(e.target.value) };
                              setFormData({ ...formData, commissionTiers: updated });
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-700"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (formData.commissionTiers || []).filter((_, i) => i !== idx);
                              setFormData({ ...formData, commissionTiers: updated });
                            }}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            title="حذف الشريحة"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني (للربط السحابي ومستخدمي Supabase)</label>
                <input 
                  type="email" 
                  value={formData.email || ''} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="emp@salon.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">موعد الحضور اليومي</label>
                <input 
                  type="time" 
                  value={formData.checkInTime || '09:00'} 
                  onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">موعد الانصراف اليومي</label>
                <input 
                  type="time" 
                  value={formData.checkOutTime || '18:00'} 
                  onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:border-indigo-600 outline-none"
                />
              </div>
            </div>

            {/* Online User Account Section for Employee */}
            <div className="mt-4 p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.hasOnlineAccount || false}
                    onChange={e => setFormData({ ...formData, hasOnlineAccount: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
                    <span>🌐 إنشاء حساب مستخدم أونلاين للموظف للدخول على النظام</span>
                    <span className="text-[10px] bg-indigo-200/70 text-indigo-800 px-2 py-0.5 rounded-full font-bold">بوابة الموظف</span>
                  </span>
                </label>
              </div>

              {formData.hasOnlineAccount && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-100/80 animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">البريد الإلكتروني لتسجيل الدخول (مطلوب)</label>
                    <input 
                      type="email"
                      required={formData.hasOnlineAccount}
                      value={formData.email || ''}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="employee@salon.com"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة مرور حساب الموظف</label>
                    <input 
                      type="text"
                      value={onlineUserPassword}
                      onChange={e => setOnlineUserPassword(e.target.value)}
                      placeholder="123456"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Admin Dual Commission Option */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.allowDualCommission || false}
                  onChange={e => setFormData({ ...formData, allowDualCommission: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-xs font-bold text-slate-700">
                  احتساب العمولتين معاً (عمولة الخدمات + عمولة المنتجات) لهذا الموظف (خاص بالإدارة 🛡️)
                </span>
              </label>

              <div className="flex gap-2 w-full sm:w-auto">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setFormData(defaultFormData); }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    إلغاء
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveEmployee}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                >
                  <Save size={15} />
                  <span>{editingId ? 'حفظ التعديلات' : 'إضافة الموظف'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Employees Directory Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-800 text-sm">قائمة موظفي الصالون ({filteredEmployees.length})</h3>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="بحث عن موظف..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pr-9 pl-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-600 w-56"
                />
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">كود البصمة</th>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">المسمى الوظيفي</th>
                    <th className="p-3">نوع الراتب</th>
                    <th className="p-3">الراتب الأساسي</th>
                    <th className="p-3">نسبة العمولة</th>
                    <th className="p-3">مواعيد الدوام</th>
                    <th className="p-3">حساب الدخول أونلاين</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراءات سريعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-indigo-700">#{emp.fingerprintCode || '13'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-indigo-700">
                            {emp.avatarUrl ? (
                              <img src={emp.avatarUrl} alt={emp.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{emp.name.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{emp.name}</div>
                            {emp.email && <div className="text-[10px] text-slate-400 font-mono">{emp.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 font-semibold">{emp.role}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          {emp.salaryType === 'commission_only' ? 'بالعمولة فقط' : emp.salaryType === 'salary_plus_commission' ? 'راتب + عمولة' : 'راتب ثابت'}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold">
                        {emp.salaryType === 'commission_only' ? '0.00' : `${emp.baseSalary?.toFixed(2)} ${settings.currency}`}
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                          {getCommissionModelLabel(emp)}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{emp.checkInTime || '09:00'} - {emp.checkOutTime || '18:00'}</td>
                      <td className="p-3">
                        {emp.hasOnlineAccount ? (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1 w-fit">
                            <span>🌐 مفعل</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">غير مرتبط</span>
                        )}
                      </td>
                      <td className="p-3">
                        {emp.isBlacklisted ? (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-black">محظور (Blacklist)</span>
                        ) : emp.endOfService ? (
                          <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-black">منتهي الخدمة</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black">نشط 🟢</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenActionModal(emp.id, 'advance')}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg"
                            title="تسجيل سلفة"
                          >
                            <Banknote size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(emp.id, 'penalty')}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg"
                            title="تسجيل خصم/جزاء"
                          >
                            <DollarSign size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(emp.id, 'bonus')}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg"
                            title="تسجيل مكافأة"
                          >
                            <Gift size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(emp.id, 'salary_increase')}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg"
                            title="تسجيل زيادة راتب"
                          >
                            <TrendingUp size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(emp.id, 'shift_schedule')}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg"
                            title="تعديل مواعيد العمل وتاريخ السريان"
                          >
                            <Clock size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(emp.id, 'end_of_service')}
                            className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 rounded-lg"
                            title="إنهاء خدمة / بلاك ليست"
                          >
                            <UserX size={14} />
                          </button>
                          <button
                            onClick={() => handleEdit(emp)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                            title="تعديل الموظف"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TIMESHEET & PAYROLL (Full 22 Columns layout) */}
      {activeSubTab === 'timesheet' && (
        <HRScreen
          settings={settings}
          employees={employees}
          setEmployees={setEmployees}
          invoices={invoices}
          transactions={transactions}
          setTransactions={setTransactions}
          bookings={bookings}
          currentUser={currentUser}
        />
      )}

      {/* SUB-TAB: TIPS & GRATUITIES (البقشيش والإكراميات) */}
      {activeSubTab === 'tips' && (
        <TipsScreen
          settings={settings}
          tips={tips}
          setTips={setTips}
          employees={employees}
          transactions={transactions}
          setTransactions={setTransactions}
          currentUser={currentUser}
        />
      )}

      {/* SUB-TAB: FINGERPRINT LOGS & BIOMETRICS (سجلات البصمة وأجهزة الدوام) */}
      {activeSubTab === 'fingerprint_logs' && (
        <FingerprintLogsScreen
          settings={settings}
          logs={fingerprintLogs}
          setLogs={setFingerprintLogs}
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
                      <td className="p-3 font-mono text-slate-500">{sh.previousSalary?.toFixed(2)} {settings.currency}</td>
                      <td className="p-3 font-mono font-bold text-emerald-700">{sh.newSalary?.toFixed(2)} {settings.currency}</td>
                      <td className="p-3 font-mono font-bold text-indigo-600">
                        +{(sh.newSalary - sh.previousSalary).toFixed(2)} {settings.currency}
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
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-black">
                            مدرج في البلاك ليست ⛔
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

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={hrSettingsForm.weeklyOffPaid}
                    onChange={e => setHrSettingsForm({ ...hrSettingsForm, weeklyOffPaid: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    احتساب العطلات الأسبوعية مدفوعة الراتب (افتراضي)
                  </span>
                </label>
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
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">✕</button>
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

            {/* Leave Form (Multi-Day Support) */}
            {modalType === 'leave' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">من تاريخ (بداية الإجازة)</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">إلى تاريخ (نهاية الإجازة)</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                  <span className="text-xs font-bold text-indigo-900">
                    عدد أيام الإجازة: {
                      Math.max(1, Math.round((new Date(leaveForm.endDate).getTime() - new Date(leaveForm.startDate).getTime()) / (1000 * 3600 * 24)) + 1)
                    } يوم
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع الإجازة</label>
                  <select
                    value={leaveForm.type}
                    onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="paid">إجازة مدفوعة الأجر (براتب)</option>
                    <option value="unpaid">إجازة بدون راتب (خصم اليومية)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السبب / الملاحظات</label>
                  <input
                    type="text"
                    value={leaveForm.note}
                    onChange={e => setLeaveForm({ ...leaveForm, note: e.target.value })}
                    placeholder="إجازة سنوية / إجازة مرضية / ظرف خاص..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

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
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 font-medium leading-relaxed">
                  💡 <strong>قاعدة سريان التعديل:</strong> يسري تعديل مواعيد الحضور والانصراف ابتداءً من تاريخ السريان المحدد فقط وما يليه، وتظل الأيام السابقة على مواعيدها القديمة في التايم شيت دون تغيير.
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
                    <span>إدراج الموظف في القائمة السوداء (Blacklist ⛔)</span>
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
              <button onClick={() => setShowQuickActionModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
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
