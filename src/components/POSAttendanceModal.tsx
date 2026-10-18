import React, { useState, useMemo } from 'react';
import { 
  X, Check, Clock, UserCheck, UserX, Calendar, AlertCircle, 
  Search, Palmtree, FileClock, Trash2, CheckCircle2, 
  Loader2, Sparkles, ChevronRight, Filter, Info
} from 'lucide-react';
import { Employee, FingerprintLog, AppSettings, EmployeeLeaveRecord, EmployeePermissionRecord } from '../types';
import { DB, getFingerprintProcessedDate } from '../services/db';

interface POSAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  setEmployees?: (updater: Employee[] | ((prev: Employee[]) => Employee[])) => void;
  fingerprintLogs: FingerprintLog[];
  setFingerprintLogs?: (updater: FingerprintLog[] | ((prev: FingerprintLog[]) => FingerprintLog[])) => void;
  shiftDate: string;
  settings: AppSettings;
  currentUser?: any;
}

const getDayNameArabic = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(d);
  } catch {
    return '';
  }
};

const formatTime12h = (timeStr?: string | null): string => {
  if (!timeStr) return '--:--';
  const clean = timeStr.trim();
  const timeOnly = clean.includes('T') ? clean.split('T')[1].substring(0, 5) : (clean.includes(' ') ? clean.split(' ')[1].substring(0, 5) : clean.substring(0, 5));
  if (!timeOnly || !timeOnly.includes(':')) return timeOnly || '--:--';
  const [hStr, mStr] = timeOnly.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) return timeOnly;
  const p = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
};

export const POSAttendanceModal: React.FC<POSAttendanceModalProps> = ({
  isOpen,
  onClose,
  employees,
  setEmployees,
  fingerprintLogs = [],
  setFingerprintLogs,
  shiftDate,
  settings,
}) => {
  const [targetDate, setTargetDate] = useState<string>(() => shiftDate || new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingEmpId, setLoadingEmpId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // State for recording Permission (إذن)
  const [permissionModalEmp, setPermissionModalEmp] = useState<Employee | null>(null);
  const [permStartTime, setPermStartTime] = useState('12:00');
  const [permEndTime, setPermEndTime] = useState('14:00');
  const [permReason, setPermReason] = useState('إذن خروج مؤقت مسجل من نقطة البيع');
  const [isSavingPerm, setIsSavingPerm] = useState(false);

  // Sync targetDate when shiftDate prop changes and modal opens
  React.useEffect(() => {
    if (isOpen && shiftDate) {
      setTargetDate(shiftDate);
    }
  }, [isOpen, shiftDate]);

  // Flash message helper
  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  // Only active, non-blacklisted employees
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.isActive !== false && !e.isBlacklisted);
  }, [employees]);

  // Filtered list by search
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return activeEmployees;
    const q = searchQuery.toLowerCase().trim();
    return activeEmployees.filter(e => 
      e.name.toLowerCase().includes(q) || 
      (e.fingerprintCode && e.fingerprintCode.toLowerCase().includes(q)) ||
      (e.role && e.role.toLowerCase().includes(q))
    );
  }, [activeEmployees, searchQuery]);

  // Map employee ID to today's logs
  const employeeLogsMap = useMemo(() => {
    const map = new Map<string, { checkInLog: FingerprintLog | null; checkOutLog: FingerprintLog | null; allLogs: FingerprintLog[] }>();
    
    activeEmployees.forEach(emp => {
      const empLogs = (fingerprintLogs || []).filter(l => {
        const isMatch = (l.employeeId && l.employeeId === emp.id) ||
          (emp.fingerprintCode && (
            l.fingerprintCode === emp.fingerprintCode ||
            (l as any).fingerprint_code === emp.fingerprintCode
          ));
        if (!isMatch) return false;
        const pDate = getFingerprintProcessedDate(l);
        return pDate === targetDate || (l.timestamp && l.timestamp.startsWith(targetDate));
      }).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

      const checkInLog = empLogs.find(l => l.type === 'check_in') || (empLogs.length > 0 ? empLogs[0] : null);
      const checkOutLogs = empLogs.filter(l => l.type === 'check_out');
      const checkOutLog = checkOutLogs[checkOutLogs.length - 1] || (empLogs.length > 1 && empLogs[empLogs.length - 1] !== checkInLog ? empLogs[empLogs.length - 1] : null);

      map.set(emp.id, { checkInLog, checkOutLog, allLogs: empLogs });
    });

    return map;
  }, [activeEmployees, fingerprintLogs, targetDate]);

  // Overall attendance statistics
  const stats = useMemo(() => {
    let presentCount = 0;
    let leaveCount = 0;
    let absentCount = 0;

    activeEmployees.forEach(emp => {
      const isLeave = (emp.leaveRecords || []).some(l => targetDate >= l.startDate && targetDate <= l.endDate);
      const logs = employeeLogsMap.get(emp.id);
      const hasAttendance = Boolean(logs?.checkInLog || logs?.checkOutLog);

      if (isLeave) {
        leaveCount++;
      } else if (hasAttendance) {
        presentCount++;
      } else {
        absentCount++;
      }
    });

    return {
      total: activeEmployees.length,
      present: presentCount,
      leave: leaveCount,
      absent: absentCount
    };
  }, [activeEmployees, employeeLogsMap, targetDate]);

  // 1. تسجيل حضور (Check-in)
  const handleCheckIn = async (emp: Employee) => {
    try {
      setLoadingEmpId(emp.id);
      const now = new Date();
      const currentH = String(now.getHours()).padStart(2, '0');
      const currentM = String(now.getMinutes()).padStart(2, '0');
      const currentS = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${targetDate}T${currentH}:${currentM}:${currentS}`;

      const logsData = employeeLogsMap.get(emp.id);
      const existingInLog = logsData?.checkInLog;

      const inLog: FingerprintLog = {
        id: existingInLog ? existingInLog.id : ('FP-POS-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)),
        salonId: emp.salonId || settings.salonId,
        branchId: emp.branchId || (settings as any).branchId,
        employeeId: emp.id,
        employeeName: emp.name,
        fingerprintCode: emp.fingerprintCode || ('FP-' + emp.id.slice(0, 4)),
        timestamp,
        type: 'check_in',
        status: 'manual',
        processedDate: targetDate,
        processed_date: targetDate,
        notes: 'تسجيل حضور من نقطة البيع (POS)'
      };

      // Save to Supabase
      await DB.saveFingerprintLog(inLog);

      // Update state
      if (setFingerprintLogs) {
        setFingerprintLogs(prev => {
          const filtered = (prev || []).filter(l => l.id !== inLog.id);
          return [...filtered, inLog];
        });
      }

      showFeedback(`تم تسجيل حضور "${emp.name}" في تمام ${formatTime12h(timestamp)} بنجاح`);
    } catch (err: any) {
      console.error('Error saving check-in:', err);
      showFeedback('تعذر حفظ تسجيل الحضور: ' + (err?.message || 'خطأ غير معروف'), 'error');
    } finally {
      setLoadingEmpId(null);
    }
  };

  // 2. تسجيل انصراف (Check-out)
  const handleCheckOut = async (emp: Employee) => {
    try {
      setLoadingEmpId(emp.id);
      const now = new Date();
      const currentH = String(now.getHours()).padStart(2, '0');
      const currentM = String(now.getMinutes()).padStart(2, '0');
      const currentS = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${targetDate}T${currentH}:${currentM}:${currentS}`;

      const logsData = employeeLogsMap.get(emp.id);
      const existingOutLog = logsData?.checkOutLog;

      const outLog: FingerprintLog = {
        id: existingOutLog ? existingOutLog.id : ('FP-POS-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)),
        salonId: emp.salonId || settings.salonId,
        branchId: emp.branchId || (settings as any).branchId,
        employeeId: emp.id,
        employeeName: emp.name,
        fingerprintCode: emp.fingerprintCode || ('FP-' + emp.id.slice(0, 4)),
        timestamp,
        type: 'check_out',
        status: 'manual',
        processedDate: targetDate,
        processed_date: targetDate,
        notes: 'تسجيل انصراف من نقطة البيع (POS)'
      };

      // Save to Supabase
      await DB.saveFingerprintLog(outLog);

      // Update state
      if (setFingerprintLogs) {
        setFingerprintLogs(prev => {
          const filtered = (prev || []).filter(l => l.id !== outLog.id);
          return [...filtered, outLog];
        });
      }

      showFeedback(`تم تسجيل انصراف "${emp.name}" في تمام ${formatTime12h(timestamp)} بنجاح`);
    } catch (err: any) {
      console.error('Error saving check-out:', err);
      showFeedback('تعذر حفظ تسجيل الانصراف: ' + (err?.message || 'خطأ غير معروف'), 'error');
    } finally {
      setLoadingEmpId(null);
    }
  };

  // 3. زر غياب: يحذف الحضور والانصراف (Clear check-in & check-out)
  const handleAbsence = async (emp: Employee) => {
    const logsData = employeeLogsMap.get(emp.id);
    const logsToDelete = logsData?.allLogs || [];

    if (logsToDelete.length === 0) {
      showFeedback(`الموظف "${emp.name}" مسجل بالفعل كغائب لعدم وجود حركات حضور.`);
      return;
    }

    if (!confirm(`هل أنت متأكد من تسجيل غياب للموظف "${emp.name}"؟\nسيتم حذف تسجيلات الحضور والانصراف لهذا اليوم من التايم شيت وقاعدة البيانات.`)) {
      return;
    }

    try {
      setLoadingEmpId(emp.id);
      for (const log of logsToDelete) {
        await DB.deleteFingerprintLog(log.id);
      }

      if (setFingerprintLogs) {
        setFingerprintLogs(prev => (prev || []).filter(l => !logsToDelete.some(dl => dl.id === l.id)));
      }

      showFeedback(`تم حذف حركات الحضور والانصراف للموظف "${emp.name}" وتعيينه كغائب بنجاح.`);
    } catch (err: any) {
      console.error('Error recording absence:', err);
      showFeedback('تعذر حذف الحضور: ' + (err?.message || 'خطأ غير معروف'), 'error');
    } finally {
      setLoadingEmpId(null);
    }
  };

  // 4. زر إجازة (Toggle Leave)
  const handleToggleLeave = async (emp: Employee) => {
    const isLeave = (emp.leaveRecords || []).some(l => targetDate >= l.startDate && targetDate <= l.endDate);

    try {
      setLoadingEmpId(emp.id);
      let updatedLeaveRecords: EmployeeLeaveRecord[];

      if (isLeave) {
        if (!confirm(`الموظف "${emp.name}" مسجل له إجازة في هذا اليوم.\nهل تريد إلغاء الإجازة؟`)) {
          return;
        }
        updatedLeaveRecords = (emp.leaveRecords || []).filter(l => !(targetDate >= l.startDate && targetDate <= l.endDate));
      } else {
        const newLeave: EmployeeLeaveRecord = {
          id: 'LV-' + Math.random().toString(36).substr(2, 9),
          startDate: targetDate,
          endDate: targetDate,
          type: 'paid',
          note: 'إجازة مسجلة من نقطة البيع (POS)'
        };
        updatedLeaveRecords = [...(emp.leaveRecords || []), newLeave];
      }

      const updatedEmp: Employee = {
        ...emp,
        leaveRecords: updatedLeaveRecords
      };

      await DB.saveEmployee(updatedEmp);

      if (setEmployees) {
        setEmployees(prev => prev.map(e => e.id === emp.id ? updatedEmp : e));
      }

      showFeedback(isLeave ? `تم إلغاء إجازة الموظف "${emp.name}" بنجاح` : `تم تعيين اليوم إجازة للموظف "${emp.name}" بنجاح`);
    } catch (err: any) {
      console.error('Error toggling leave:', err);
      showFeedback('تعذر تحديث الإجازة: ' + (err?.message || 'خطأ غير معروف'), 'error');
    } finally {
      setLoadingEmpId(null);
    }
  };

  // 5. زر إذن (Open permission modal)
  const handleOpenPermissionModal = (emp: Employee) => {
    const existingPerm = (emp.permissionRecords || []).find(p => p.date === targetDate);
    if (existingPerm) {
      setPermStartTime(existingPerm.startTime || '12:00');
      setPermEndTime(existingPerm.endTime || '14:00');
      setPermReason(existingPerm.reason || 'إذن خروج مؤقت مسجل من نقطة البيع');
    } else {
      setPermStartTime('12:00');
      setPermEndTime('14:00');
      setPermReason('إذن خروج مؤقت مسجل من نقطة البيع');
    }
    setPermissionModalEmp(emp);
  };

  // حفظ الإذن
  const handleSavePermission = async () => {
    if (!permissionModalEmp) return;

    try {
      setIsSavingPerm(true);
      const [startH, startM] = permStartTime.split(':').map(Number);
      const [endH, endM] = permEndTime.split(':').map(Number);
      let durationMinutes = (endH * 60 + (endM || 0)) - (startH * 60 + (startM || 0));
      if (durationMinutes <= 0) durationMinutes = 60;

      const otherPerms = (permissionModalEmp.permissionRecords || []).filter(p => p.date !== targetDate);
      const newPerm: EmployeePermissionRecord = {
        id: 'PRM-' + Math.random().toString(36).substr(2, 9),
        date: targetDate,
        startTime: permStartTime,
        endTime: permEndTime,
        durationMinutes,
        type: 'mid_shift',
        status: 'approved',
        reason: permReason.trim() || 'إذن خروج مسجل من نقطة البيع'
      };

      const updatedEmp: Employee = {
        ...permissionModalEmp,
        permissionRecords: [...otherPerms, newPerm]
      };

      await DB.saveEmployee(updatedEmp);

      if (setEmployees) {
        setEmployees(prev => prev.map(e => e.id === permissionModalEmp.id ? updatedEmp : e));
      }

      showFeedback(`تم تسجيل إذن للموظف "${permissionModalEmp.name}" بنجاح (${durationMinutes} دقيقة)`);
      setPermissionModalEmp(null);
    } catch (err: any) {
      console.error('Error saving permission:', err);
      showFeedback('تعذر حفظ الإذن: ' + (err?.message || 'خطأ غير معروف'), 'error');
    } finally {
      setIsSavingPerm(false);
    }
  };

  // حذف الإذن
  const handleDeletePermission = async () => {
    if (!permissionModalEmp) return;
    try {
      setIsSavingPerm(true);
      const updatedEmp: Employee = {
        ...permissionModalEmp,
        permissionRecords: (permissionModalEmp.permissionRecords || []).filter(p => p.date !== targetDate)
      };

      await DB.saveEmployee(updatedEmp);

      if (setEmployees) {
        setEmployees(prev => prev.map(e => e.id === permissionModalEmp.id ? updatedEmp : e));
      }

      showFeedback(`تم حذف إذن الموظف "${permissionModalEmp.name}" بنجاح`);
      setPermissionModalEmp(null);
    } catch (err: any) {
      console.error('Error deleting permission:', err);
      showFeedback('تعذر حذف الإذن: ' + (err?.message || 'خطأ غير معروف'), 'error');
    } finally {
      setIsSavingPerm(false);
    }
  };

  if (!isOpen) return null;

  const dayNameAr = getDayNameArabic(targetDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
              <UserCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800">حضور وانصراف الموظفين (التايم شيت)</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  تزامن فوري
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تسجيل الحضور والانصراف المباشر لوردية اليوم دون الحاجة لفتح التايم شيت
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Shift Date Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <Calendar size={15} className="text-emerald-600 shrink-0" />
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-slate-400">تاريخ الوردية:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-emerald-700">{dayNameAr}</span>
                  <input 
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="text-xs font-black text-slate-800 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0 ${
            feedbackMessage.type === 'success' 
              ? 'bg-emerald-500 text-white' 
              : 'bg-rose-500 text-white'
          }`}>
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Quick Stats Bar & Search */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Quick Metrics */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold shadow-2xs">
              إجمالي النشطين: <span className="font-black text-slate-900">{stats.total}</span>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold shadow-2xs">
              حاضر: <span className="font-black text-emerald-700">{stats.present}</span>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 font-bold shadow-2xs">
              إجازة: <span className="font-black text-blue-700">{stats.leave}</span>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold shadow-2xs">
              غائب: <span className="font-black text-amber-700">{stats.absent}</span>
            </span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو كود البصمة..."
              className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-3 text-center w-24">كود البصمة</th>
                  <th className="py-3 px-4 min-w-[160px]">اسم الموظف</th>
                  <th className="py-3 px-3 text-center min-w-[100px]">تاريخ اليوم</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">تسجيل حضور</th>
                  <th className="py-3 px-3 text-center min-w-[100px]">وقت الحضور</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">تسجيل انصراف</th>
                  <th className="py-3 px-3 text-center min-w-[100px]">وقت الانصراف</th>
                  <th className="py-3 px-3 text-center min-w-[130px]">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      لا يوجد موظفين نشطين مطابقين للبحث
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => {
                    const logsData = employeeLogsMap.get(emp.id);
                    const checkInLog = logsData?.checkInLog;
                    const checkOutLog = logsData?.checkOutLog;

                    const checkInTimeFormatted = formatTime12h(checkInLog?.timestamp);
                    const checkOutTimeFormatted = formatTime12h(checkOutLog?.timestamp);

                    const isLeave = (emp.leaveRecords || []).some(l => targetDate >= l.startDate && targetDate <= l.endDate);
                    const dayPermission = (emp.permissionRecords || []).find(p => p.date === targetDate);
                    const isLoading = loadingEmpId === emp.id;

                    return (
                      <tr 
                        key={emp.id}
                        className={`transition-colors ${
                          isLeave 
                            ? 'bg-emerald-50/80 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500' 
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* 1. كود البصمة */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                          {emp.fingerprintCode ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                              {emp.fingerprintCode}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">---</span>
                          )}
                        </td>

                        {/* 2. اسم الموظف */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800 text-sm">{emp.name}</span>
                            {/* تمييز الموظف المجاز بلون أخضر ويكتب أمامه إجازة */}
                            {isLeave && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                <Palmtree size={12} className="text-emerald-600" />
                                إجازة
                              </span>
                            )}
                            {dayPermission && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <FileClock size={11} className="text-amber-600" />
                                إذن ({dayPermission.startTime} - {dayPermission.endTime})
                              </span>
                            )}
                          </div>
                          {emp.role && (
                            <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">{emp.role}</span>
                          )}
                        </td>

                        {/* 3. تاريخ اليوم */}
                        <td className="py-3 px-3 text-center font-mono text-slate-600 font-medium">
                          {targetDate}
                        </td>

                        {/* 4. زر أخضر مكتوب عليه حضور */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleCheckIn(emp)}
                            disabled={isLoading}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                              checkInLog 
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300' 
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                            }`}
                            title={checkInLog ? 'تحديث وقت الحضور للوقت الحالي' : 'تسجيل حضور الآن'}
                          >
                            {isLoading ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Check size={14} className={checkInLog ? 'text-emerald-700' : 'text-white'} />
                            )}
                            <span>حضور</span>
                          </button>
                        </td>

                        {/* 5. وقت الحضور */}
                        <td className="py-3 px-3 text-center">
                          {checkInLog ? (
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block shadow-2xs">
                              {checkInTimeFormatted}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-300 font-bold">--:--</span>
                          )}
                        </td>

                        {/* 6. زر مكتوب عليه انصراف */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleCheckOut(emp)}
                            disabled={isLoading}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                              checkOutLog 
                                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300' 
                                : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200'
                            }`}
                            title={checkOutLog ? 'تحديث وقت الانصراف للوقت الحالي' : 'تسجيل انصراف الآن'}
                          >
                            {isLoading ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Clock size={14} className={checkOutLog ? 'text-amber-800' : 'text-white'} />
                            )}
                            <span>انصراف</span>
                          </button>
                        </td>

                        {/* 7. وقت الانصراف */}
                        <td className="py-3 px-3 text-center">
                          {checkOutLog ? (
                            <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block shadow-2xs">
                              {checkOutTimeFormatted}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-300 font-bold">--:--</span>
                          )}
                        </td>

                        {/* 8. أزرار صغيرة بأيقونات بسيطة (إجازة - إذن - غياب) */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* زر إجازة */}
                            <button
                              type="button"
                              onClick={() => handleToggleLeave(emp)}
                              disabled={isLoading}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs border ${
                                isLeave
                                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                  : 'bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-200 hover:border-emerald-300'
                              }`}
                              title={isLeave ? 'إلغاء الإجازة' : 'تسجيل إجازة لهذا اليوم'}
                            >
                              <Palmtree size={15} />
                            </button>

                            {/* زر إذن */}
                            <button
                              type="button"
                              onClick={() => handleOpenPermissionModal(emp)}
                              disabled={isLoading}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs border ${
                                dayPermission
                                  ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                                  : 'bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-slate-200 hover:border-amber-300'
                              }`}
                              title="تسجيل أو تعديل إذن خروج"
                            >
                              <FileClock size={15} />
                            </button>

                            {/* زر غياب: يحذف الحضور والانصراف */}
                            <button
                              type="button"
                              onClick={() => handleAbsence(emp)}
                              disabled={isLoading}
                              className="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                              title="تسجيل غياب (حذف الحضور والانصراف لهذا اليوم)"
                            >
                              <UserX size={15} />
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

        {/* Footer Notes */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <Info size={15} className="text-emerald-600 shrink-0" />
            <span>
              جميع التسجيلات تنعكس مباشرة في التايم شيت ومسيرات الرواتب في قاعدة البيانات السحابية.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Mini-Modal: تسجيل إذن للموظف */}
      {permissionModalEmp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl border border-slate-200 text-right" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <FileClock size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-800">تسجيل إذن خروج</h3>
                  <p className="text-[11px] text-slate-400">{permissionModalEmp.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setPermissionModalEmp(null)} 
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">وقت البدء</label>
                  <input 
                    type="time" 
                    value={permStartTime}
                    onChange={e => setPermStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">وقت الانتهاء</label>
                  <input 
                    type="time" 
                    value={permEndTime}
                    onChange={e => setPermEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">سبب الإذن</label>
                <input 
                  type="text" 
                  value={permReason}
                  onChange={e => setPermReason(e.target.value)}
                  placeholder="سبب الإذن..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDeletePermission}
                disabled={isSavingPerm}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                حذف الإذن
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPermissionModalEmp(null)}
                  disabled={isSavingPerm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePermission}
                  disabled={isSavingPerm}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  {isSavingPerm && <Loader2 size={13} className="animate-spin" />}
                  <span>حفظ الإذن</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
