import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  DollarSign, 
  Building2, 
  User, 
  Printer, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  RefreshCw, 
  Filter, 
  Wallet, 
  ArrowUpDown, 
  Clock, 
  FileText,
  RotateCcw
} from 'lucide-react';
import { AppSettings, Employee, Transaction, EmployeeFinancialRecord } from '../types';
import { DB } from '../services/db';
import { printThermalFinancialVoucher } from './ThermalFinancialVoucher';
import { parseDbDateTime, getTodayLocalDateStr } from '../utils/timezone';

export interface SalaryDisbursementsLogProps {
  settings: AppSettings;
  employees: Employee[];
  setEmployees: (updater: Employee[] | ((prev: Employee[]) => Employee[])) => void;
  transactions?: Transaction[];
  setTransactions?: (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  currentUser?: any;
  activeBranchId?: string;
  onClose?: () => void;
}

interface DisbursedSalaryRow {
  uniqueKey: string;
  financialRecordId?: string;
  transactionId?: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeCode: string;
  branchId?: string;
  amount: number;
  treasuryId: string;
  treasuryName: string;
  disbursementDate: string; // YYYY-MM-DD
  disbursementTime: string; // HH:mm
  disbursedBy: string;
  payrollPeriodStr: string;
  payrollMonth?: string;
  note: string;
  rawFinRecord?: EmployeeFinancialRecord;
  rawTransaction?: Transaction;
}

export function SalaryDisbursementsLog({
  settings,
  employees,
  setEmployees,
  transactions = [],
  setTransactions,
  currentUser,
  activeBranchId,
  onClose
}: SalaryDisbursementsLogProps) {
  // Filters State
  const today = getTodayLocalDateStr();
  const currentMonthPrefix = today.substring(0, 7); // YYYY-MM

  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [filterTreasuryId, setFilterTreasuryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Date Range Defaults: Current Month by default
  const defaultStartDate = `${currentMonthPrefix}-01`;
  const defaultEndDate = today;
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);

  // Modals State
  const [editingItem, setEditingItem] = useState<DisbursedSalaryRow | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editTreasuryId, setEditTreasuryId] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [voidingItem, setVoidingItem] = useState<DisbursedSalaryRow | null>(null);
  const [isVoiding, setIsVoiding] = useState<boolean>(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper to extract treasury name
  const getTreasuryName = (tId?: string) => {
    if (!tId) return 'الخزينة الرئيسية';
    const found = (settings.treasuries || []).find(t => t.id === tId);
    return found ? found.name : 'الخزينة الرئيسية';
  };

  // Build Unified Salary Disbursement Rows
  const allDisbursementRows = useMemo(() => {
    const rows: DisbursedSalaryRow[] = [];
    const usedTransactionIds = new Set<string>();

    // 1. Process Employee Financial Records
    employees.forEach(emp => {
      // If branch filter is active and employee belongs to another branch, skip
      if (activeBranchId && emp.branchId && emp.branchId !== activeBranchId) {
        return;
      }

      const finRecords = emp.financialRecords || [];
      finRecords.forEach(rec => {
        const isSalary = rec.type === 'salary' || 
          (rec.type === 'advance' && (rec.id?.startsWith('FIN-SAL-') || rec.note?.includes('مسير رواتب') || rec.note?.includes('تم استلام صافي الراتب')));
        
        if (!isSalary) return;

        // Extract Date and Time
        const parsed = parseDbDateTime(rec.date);
        const dateStr = parsed.date || (rec.date ? rec.date.split('T')[0] : '');
        const timeStr = parsed.time || '12:00';

        // Find linked transaction
        let matchingTrx: Transaction | undefined;
        if (rec.transactionId) {
          matchingTrx = transactions.find(t => t.id === rec.transactionId);
        }
        if (!matchingTrx) {
          // Fallback matching by category, description or amount + date
          matchingTrx = transactions.find(t => {
            if (usedTransactionIds.has(t.id)) return false;
            const isSalTrx = t.category === 'salaries' || t.id.startsWith('TRX-SAL-');
            if (!isSalTrx) return false;
            const tDate = (t.date || '').split('T')[0];
            const nameMatch = t.description?.includes(emp.name);
            const amtMatch = Math.abs(Number(t.amount || 0) - Number(rec.amount || 0)) < 0.05;
            return (nameMatch && amtMatch) || (nameMatch && tDate === dateStr);
          });
        }

        if (matchingTrx) {
          usedTransactionIds.add(matchingTrx.id);
        }

        const tId = rec.treasuryId || matchingTrx?.treasury || 'cash';
        const treasuryName = getTreasuryName(tId);
        const disbursedBy = matchingTrx?.createdBy || matchingTrx?.userName || rec.createdByName || 'مدير النظام';

        let periodStr = '-';
        if (rec.payrollPeriod) {
          periodStr = `${rec.payrollPeriod.startDate} إلى ${rec.payrollPeriod.endDate}`;
        } else if (rec.periodKey) {
          periodStr = rec.periodKey.split('_')[0] || '-';
        } else if (matchingTrx && matchingTrx.description) {
          const matchMonth = matchingTrx.description.match(/شهر\s*\(([^)]+)\)/);
          if (matchMonth) periodStr = matchMonth[1];
        }

        rows.push({
          uniqueKey: `FIN_${rec.id}_${emp.id}`,
          financialRecordId: rec.id,
          transactionId: matchingTrx?.id || rec.transactionId,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeRole: emp.role || 'موظف',
          employeeCode: emp.fingerprintCode || emp.id,
          branchId: emp.branchId || activeBranchId,
          amount: Number(rec.amount || 0),
          treasuryId: tId,
          treasuryName: treasuryName,
          disbursementDate: dateStr,
          disbursementTime: timeStr,
          disbursedBy: disbursedBy,
          payrollPeriodStr: periodStr,
          payrollMonth: rec.payrollPeriod?.month || (rec.periodKey ? rec.periodKey.split('_')[0] : undefined),
          note: rec.note || matchingTrx?.description || '',
          rawFinRecord: rec,
          rawTransaction: matchingTrx
        });
      });
    });

    // 2. Process any orphaned salary transactions (e.g. entered via treasury screen)
    transactions.forEach(trx => {
      if (usedTransactionIds.has(trx.id)) return;
      const isSalTrx = trx.category === 'salaries' || trx.id.startsWith('TRX-SAL-');
      if (!isSalTrx) return;

      if (activeBranchId && trx.branchId && trx.branchId !== activeBranchId) {
        return;
      }

      // Try finding the employee from description
      const matchedEmp = employees.find(e => trx.description && trx.description.includes(e.name));
      const parsed = parseDbDateTime(trx.date);
      const dateStr = parsed.date || (trx.date ? trx.date.split('T')[0] : '');
      const timeStr = parsed.time || '12:00';

      const matchMonth = trx.description ? trx.description.match(/شهر\s*\(([^)]+)\)/) : null;
      const periodStr = matchMonth ? matchMonth[1] : '-';

      rows.push({
        uniqueKey: `TRX_${trx.id}`,
        financialRecordId: (trx as any).salaryRecordId,
        transactionId: trx.id,
        employeeId: matchedEmp?.id || 'unknown',
        employeeName: matchedEmp?.name || (trx.description ? trx.description.slice(0, 30) : 'موظف غير محدد'),
        employeeRole: matchedEmp?.role || 'موظف',
        employeeCode: matchedEmp?.fingerprintCode || '-',
        branchId: trx.branchId || activeBranchId,
        amount: Number(trx.amount || 0),
        treasuryId: trx.treasury || 'cash',
        treasuryName: getTreasuryName(trx.treasury),
        disbursementDate: dateStr,
        disbursementTime: timeStr,
        disbursedBy: trx.createdBy || trx.userName || 'مدير النظام',
        payrollPeriodStr: periodStr,
        note: trx.description || '',
        rawTransaction: trx
      });
    });

    // Sort descending by date and time
    rows.sort((a, b) => {
      const cmpDate = b.disbursementDate.localeCompare(a.disbursementDate);
      if (cmpDate !== 0) return cmpDate;
      return b.disbursementTime.localeCompare(a.disbursementTime);
    });

    return rows;
  }, [employees, transactions, activeBranchId, settings.treasuries]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return allDisbursementRows.filter(row => {
      // Filter by Employee
      if (filterEmployeeId !== 'all' && row.employeeId !== filterEmployeeId) {
        return false;
      }

      // Filter by Treasury
      if (filterTreasuryId !== 'all' && row.treasuryId !== filterTreasuryId) {
        return false;
      }

      // Filter by Date Range
      if (startDate && row.disbursementDate < startDate) {
        return false;
      }
      if (endDate && row.disbursementDate > endDate) {
        return false;
      }

      // Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = row.employeeName.toLowerCase().includes(q);
        const matchesCode = row.employeeCode.toLowerCase().includes(q);
        const matchesNote = row.note.toLowerCase().includes(q);
        const matchesUser = row.disbursedBy.toLowerCase().includes(q);
        const matchesId = (row.transactionId || '').toLowerCase().includes(q) || (row.financialRecordId || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesNote && !matchesUser && !matchesId) {
          return false;
        }
      }

      return true;
    });
  }, [allDisbursementRows, filterEmployeeId, filterTreasuryId, startDate, endDate, searchQuery]);

  // Quick Stats
  const totalAmount = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + r.amount, 0);
  }, [filteredRows]);

  const uniqueEmployeesCount = useMemo(() => {
    const set = new Set(filteredRows.map(r => r.employeeId).filter(id => id !== 'unknown'));
    return set.size;
  }, [filteredRows]);

  const averageDisbursement = useMemo(() => {
    if (filteredRows.length === 0) return 0;
    return totalAmount / filteredRows.length;
  }, [totalAmount, filteredRows.length]);

  // Quick Date Helpers
  const handleSetQuickDate = (preset: 'this_month' | 'last_month' | 'last_30_days' | 'all') => {
    if (preset === 'this_month') {
      setStartDate(`${currentMonthPrefix}-01`);
      setEndDate(today);
    } else if (preset === 'last_month') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${lastDay}`);
    } else if (preset === 'last_30_days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Reprint Thermal Voucher
  const handleReprintVoucher = (row: DisbursedSalaryRow) => {
    printThermalFinancialVoucher(settings, {
      voucherType: 'salary',
      voucherNumber: row.transactionId || `SAL-${row.uniqueKey.substring(0, 8)}`,
      date: `${row.disbursementDate} ${row.disbursementTime}`,
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
      employeeRole: row.employeeRole,
      amount: row.amount,
      treasuryName: row.treasuryName,
      note: row.note || `سند صرف راتب للموظف (${row.employeeName}) عن فترة (${row.payrollPeriodStr})`,
      issuedBy: row.disbursedBy,
      payrollPeriod: row.payrollPeriodStr !== '-' ? row.payrollPeriodStr : undefined
    });
    showNotification('success', `تم إرسال سند صرف راتب (${row.employeeName}) للطباعة الحرارية بنجاح.`);
  };

  // Open Edit Modal
  const handleOpenEditModal = (row: DisbursedSalaryRow) => {
    setEditingItem(row);
    setEditAmount(String(row.amount));
    setEditTreasuryId(row.treasuryId || (settings.treasuries?.[0]?.id || 'cash'));
    setEditDate(row.disbursementDate || today);
    setEditNote(row.note || '');
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const newAmt = parseFloat(editAmount);
    if (isNaN(newAmt) || newAmt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    setIsSavingEdit(true);
    try {
      // 1. Update Employee Financial Record
      let targetEmployee = employees.find(e => e.id === editingItem.employeeId);
      if (targetEmployee && editingItem.financialRecordId) {
        const updatedRecords = (targetEmployee.financialRecords || []).map(r => {
          if (r.id === editingItem.financialRecordId) {
            return {
              ...r,
              amount: newAmt,
              treasuryId: editTreasuryId,
              date: editDate,
              note: editNote
            };
          }
          return r;
        });

        const updatedEmp: Employee = {
          ...targetEmployee,
          financialRecords: updatedRecords
        };

        await DB.saveEmployee(updatedEmp);
        setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
      }

      // 2. Update Linked Transaction (Financial Impact)
      if (editingItem.transactionId) {
        const trx = transactions.find(t => t.id === editingItem.transactionId);
        if (trx) {
          const updatedTrx: Transaction = {
            ...trx,
            amount: newAmt,
            treasury: editTreasuryId,
            date: `${editDate}T${editingItem.disbursementTime || '12:00'}:00`,
            description: editNote || trx.description
          };

          await DB.saveTransaction(updatedTrx);
          if (setTransactions) {
            setTransactions(prev => prev.map(t => t.id === updatedTrx.id ? updatedTrx : t));
          }
        }
      }

      showNotification('success', `تم تعديل سند صرف الراتب للموظف (${editingItem.employeeName}) وتحديث الأثر المالي في الخزينة بنجاح.`);
      setEditingItem(null);
    } catch (err: any) {
      console.error('Error saving salary disbursement edit:', err);
      showNotification('error', 'حدث خطأ أثناء حفظ التعديل: ' + (err.message || err));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Void / Cancellation Modal
  const handleOpenVoidModal = (row: DisbursedSalaryRow) => {
    setVoidingItem(row);
  };

  // Confirm Void with Full Financial Reversal
  const handleConfirmVoid = async () => {
    if (!voidingItem) return;

    setIsVoiding(true);
    try {
      // 1. Revert & Delete Financial Transaction from Treasury
      if (voidingItem.transactionId) {
        await DB.deleteTransaction(voidingItem.transactionId);
        if (setTransactions) {
          setTransactions(prev => prev.filter(t => t.id !== voidingItem.transactionId));
        }
      }

      // 2. Remove Financial Record from Employee
      const targetEmp = employees.find(e => e.id === voidingItem.employeeId);
      if (targetEmp && voidingItem.financialRecordId) {
        const filteredRecords = (targetEmp.financialRecords || []).filter(
          r => r.id !== voidingItem.financialRecordId
        );

        const updatedEmp: Employee = {
          ...targetEmp,
          financialRecords: filteredRecords
        };

        await DB.saveEmployee(updatedEmp);
        setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
      }

      showNotification(
        'success', 
        `تم إلغاء صرف الراتب بنجاح، واستعادة الأثر المالي (${Number(voidingItem.amount).toFixed(2)} ${settings.currency}) إلى ${voidingItem.treasuryName} بالكامل، وإعادة تعيين حالة راتب الموظف (${voidingItem.employeeName}) كـ "غير مصروف".`
      );
      setVoidingItem(null);
    } catch (err: any) {
      console.error('Error voiding salary disbursement:', err);
      showNotification('error', 'حدث خطأ أثناء إلغاء الصرف: ' + (err.message || err));
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6" dir="rtl">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-lg border transition-all animate-in fade-in slide-in-from-top-3 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={20} className="text-rose-600 shrink-0" />}
            <span className="text-xs sm:text-sm font-bold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded-lg">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <History size={20} />
            </div>
            <span>سجل صرف الرواتب للموظفين (Salary Disbursements Log)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            متابعة وتدقيق حركات وسندات صرف الرواتب المعتمدة من الخزائن مع إمكانية التعديل، الطباعة الحرارية، والإلغاء مع استعادة الأثر المالي الكامل.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition-all cursor-pointer"
            title="إغلاق"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Amount */}
        <div className="bg-gradient-to-br from-indigo-50/70 to-indigo-100/30 p-4 rounded-2xl border border-indigo-100 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-xs font-bold">إجمالي الرواتب المصروفة</span>
            <DollarSign size={18} />
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-950 font-mono">
            {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-indigo-700">{settings.currency}</span>
          </div>
          <div className="text-[10px] text-indigo-600 mt-1 font-bold">
            حسب الفلاتر المحددة حالياً
          </div>
        </div>

        {/* Total Operations */}
        <div className="bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 p-4 rounded-2xl border border-emerald-100 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-bold">عدد عمليات الصرف</span>
            <FileText size={18} />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-950 font-mono">
            {filteredRows.length}{' '}
            <span className="text-xs font-normal text-emerald-700">عملية</span>
          </div>
          <div className="text-[10px] text-emerald-600 mt-1 font-bold">
            سندات صرف موثقة
          </div>
        </div>

        {/* Unique Employees */}
        <div className="bg-gradient-to-br from-sky-50/70 to-sky-100/30 p-4 rounded-2xl border border-sky-100 shadow-2xs">
          <div className="flex items-center justify-between text-sky-700 mb-1">
            <span className="text-xs font-bold">الموظفون المستلمون</span>
            <User size={18} />
          </div>
          <div className="text-lg sm:text-xl font-black text-sky-950 font-mono">
            {uniqueEmployeesCount}{' '}
            <span className="text-xs font-normal text-sky-700">موظف</span>
          </div>
          <div className="text-[10px] text-sky-600 mt-1 font-bold">
            استلموا رواتبهم في الفترة
          </div>
        </div>

        {/* Average Salary */}
        <div className="bg-gradient-to-br from-purple-50/70 to-purple-100/30 p-4 rounded-2xl border border-purple-100 shadow-2xs">
          <div className="flex items-center justify-between text-purple-700 mb-1">
            <span className="text-xs font-bold">متوسط الراتب المصروف</span>
            <Wallet size={18} />
          </div>
          <div className="text-lg sm:text-xl font-black text-purple-950 font-mono">
            {averageDisbursement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-purple-700">{settings.currency}</span>
          </div>
          <div className="text-[10px] text-purple-600 mt-1 font-bold">
            متوسط قيمة السند
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-700">
          <Filter size={15} className="text-indigo-600" />
          <span>عوامل التصفية والفرز:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Employee Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">الموظف:</label>
            <div className="relative">
              <select
                value={filterEmployeeId}
                onChange={e => setFilterEmployeeId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-indigo-500"
              >
                <option value="all">كافة الموظفين ({employees.length})</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.role ? `(${emp.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Treasury Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">خزينة الصرف:</label>
            <select
              value={filterTreasuryId}
              onChange={e => setFilterTreasuryId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-indigo-500"
            >
              <option value="all">كافة الخزائن</option>
              {(settings.treasuries || []).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">من تاريخ:</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">إلى تاريخ:</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-indigo-500"
            />
          </div>
        </div>

        {/* Quick Date Shortcuts and Search */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-1 border-t border-slate-200/60">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 ml-1">فترات جاهزة:</span>
            <button
              type="button"
              onClick={() => handleSetQuickDate('this_month')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              الشهر الحالي
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickDate('last_month')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              الشهر السابق
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickDate('last_30_days')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              آخر 30 يوم
            </button>
            <button
              type="button"
              onClick={() => handleSetQuickDate('all')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              عرض الكل
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[240px]">
            <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالموظف، الكود، البيان..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Disbursements Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3 whitespace-nowrap">كود السند</th>
              <th className="p-3 whitespace-nowrap">الموظف</th>
              <th className="p-3 whitespace-nowrap">تاريخ ووقت الصرف</th>
              <th className="p-3 whitespace-nowrap">شهر / فترة المسير</th>
              <th className="p-3 whitespace-nowrap">خزينة الصرف</th>
              <th className="p-3 whitespace-nowrap">منفذ الصرف</th>
              <th className="p-3 whitespace-nowrap">المبلغ الصافي</th>
              <th className="p-3 whitespace-nowrap">البيان والملاحظات</th>
              <th className="p-3 whitespace-nowrap text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <History size={32} className="text-slate-300" />
                    <span className="font-bold text-sm">لا توجد سجلات صرف رواتب مطابقة لشروط البحث والفلترة المحددة</span>
                    <span className="text-xs text-slate-400">تأكد من اختيار الفترة المناسبة أو قم بإلغاء الفلاتر</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.uniqueKey} className="hover:bg-indigo-50/30 transition-colors">
                  {/* Voucher ID */}
                  <td className="p-3 whitespace-nowrap">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {row.transactionId ? row.transactionId.replace('TRX-SAL-', 'SAL-') : (row.financialRecordId?.substring(0, 12) || 'SAL')}
                    </span>
                  </td>

                  {/* Employee Info */}
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900">{row.employeeName}</span>
                      <span className="text-[10px] text-slate-500">{row.employeeRole} {row.employeeCode !== '-' ? `• #${row.employeeCode}` : ''}</span>
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-slate-800">{row.disbursementDate}</span>
                      <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {row.disbursementTime}
                      </span>
                    </div>
                  </td>

                  {/* Payroll Period */}
                  <td className="p-3 whitespace-nowrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {row.payrollPeriodStr}
                    </span>
                  </td>

                  {/* Treasury */}
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Building2 size={13} className="text-slate-400" />
                      <span>{row.treasuryName}</span>
                    </div>
                  </td>

                  {/* Disbursed By User */}
                  <td className="p-3 whitespace-nowrap">
                    <span className="font-bold text-slate-700">{row.disbursedBy}</span>
                  </td>

                  {/* Net Amount */}
                  <td className="p-3 whitespace-nowrap font-mono font-black text-emerald-700 text-sm">
                    {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    <span className="text-[10px] font-normal text-emerald-600">{settings.currency}</span>
                  </td>

                  {/* Note */}
                  <td className="p-3 max-w-[250px]">
                    <p className="text-[11px] text-slate-600 truncate" title={row.note}>
                      {row.note || '-'}
                    </p>
                  </td>

                  {/* Actions */}
                  <td className="p-3 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Reprint Thermal Voucher */}
                      <button
                        onClick={() => handleReprintVoucher(row)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="إعادة طباعة إيصال صرف الراتب (80mm)"
                      >
                        <Printer size={15} />
                      </button>

                      {/* Edit Disbursement */}
                      <button
                        onClick={() => handleOpenEditModal(row)}
                        className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="تعديل تفاصيل الصرف"
                      >
                        <Edit3 size={15} />
                      </button>

                      {/* Void / Cancel with Financial Reversal */}
                      <button
                        onClick={() => handleOpenVoidModal(row)}
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="إلغاء الصرف واستعادة الأثر المالي"
                      >
                        <RotateCcw size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* EDIT DISBURSEMENT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Edit3 size={18} />
                </div>
                <h3 className="text-base font-black text-slate-900">تعديل سند صرف راتب</h3>
              </div>
              <button 
                onClick={() => setEditingItem(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-bold">الموظف:</span>
                <span className="text-sm font-black text-slate-800">{editingItem.employeeName}</span>
              </div>
              <div className="text-left">
                <span className="text-[11px] text-slate-400 block font-bold">الفترة:</span>
                <span className="text-xs font-mono font-bold text-indigo-700">{editingItem.payrollPeriodStr}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المصروف ({settings.currency}):</label>
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-black text-slate-800 focus:outline-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">خزينة الصرف:</label>
                <select
                  value={editTreasuryId}
                  onChange={e => setEditTreasuryId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-indigo-500"
                >
                  {(settings.treasuries || []).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الصرف:</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان والملاحظات:</label>
                <textarea
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-indigo-500"
                  placeholder="ملاحظات حول سبب التعديل أو تفاصيل المسير..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={isSavingEdit}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>حفظ التعديلات والأثر المالي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID / CANCEL DISBURSEMENT CONFIRMATION MODAL */}
      {voidingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-rose-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">إلغاء صرف الراتب واستعادة الأثر المالي</h3>
                <p className="text-xs text-slate-500">سيتم التراجع عن حركة الصرف وعكس المعاملة</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100 space-y-2 text-xs text-rose-950">
              <div className="flex justify-between font-bold">
                <span>الموظف:</span>
                <span className="text-slate-900">{voidingItem.employeeName}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>المبلغ المسترد للخزينة:</span>
                <span className="font-mono text-emerald-700 text-sm">{voidingItem.amount.toFixed(2)} {settings.currency}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>الخزينة المستفيدة:</span>
                <span>{voidingItem.treasuryName}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>فترة المسير:</span>
                <span className="text-indigo-700">{voidingItem.payrollPeriodStr}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ⚠️ <strong>تحذير مالي:</strong> عند تأكيد هذا الإجراء، سيتم حذف سند الصرف رقم ({voidingItem.transactionId || 'SAL'}) من الخزينة بالكامل، واستعادة الرصيد المالي بقيمة ({voidingItem.amount.toFixed(2)} {settings.currency}) فوراً، وإلغاء تسجيل استلام الراتب في ملف الموظف ليتسنى إعادة احتسابه أو صرفه مجدداً.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVoidingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={isVoiding}
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                {isVoiding ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>جاري الإلغاء والاستعادة...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    <span>تأكيد الإلغاء واستعادة الأثر المالي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
