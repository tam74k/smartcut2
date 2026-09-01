import { useState, useMemo } from 'react';
import { AppSettings, Employee, Invoice, Booking, Transaction } from '../types';
import { 
  UsersRound, Award, TrendingUp, Clock, Calendar, AlertTriangle, 
  DollarSign, BarChart3, Download, Sparkles, UserCheck, Zap, ArrowUpRight, Layers
} from 'lucide-react';
import { exportToExcel } from '../utils/exportExcel';
import { calculateEmployeeCommission, getCommissionModelLabel } from '../utils/commissionHelper';

export function EmployeeAnalyticsScreen({
  settings,
  employees,
  invoices,
  bookings,
  transactions
}: {
  settings: AppSettings;
  employees: Employee[];
  invoices: Invoice[];
  bookings: Booking[];
  transactions: Transaction[];
}) {
  const [timePreset, setTimePreset] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('month');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Compute active date range based on preset
  const { startDate, endDate, dateLabel } = useMemo(() => {
    const now = new Date();
    const endStr = now.toISOString().split('T')[0];
    let start = new Date();

    if (timePreset === 'today') {
      return { startDate: endStr, endDate: endStr, dateLabel: 'اليوم' };
    } else if (timePreset === 'week') {
      start.setDate(now.getDate() - 6);
      return { startDate: start.toISOString().split('T')[0], endDate: endStr, dateLabel: 'آخر 7 أيام' };
    } else if (timePreset === 'month') {
      start.setDate(now.getDate() - 29);
      return { startDate: start.toISOString().split('T')[0], endDate: endStr, dateLabel: 'آخر 30 يوماً' };
    } else if (timePreset === 'year') {
      start.setFullYear(now.getFullYear(), 0, 1);
      return { startDate: start.toISOString().split('T')[0], endDate: endStr, dateLabel: 'هذا العام' };
    } else if (timePreset === 'custom') {
      return { startDate: customFrom, endDate: customTo, dateLabel: `${customFrom} إلى ${customTo}` };
    } else {
      return { startDate: '2000-01-01', endDate: '2099-12-31', dateLabel: 'جميع الفترات' };
    }
  }, [timePreset, customFrom, customTo]);

  // Filtered dataset for the selected period
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const d = inv.date.split('T')[0];
      return d >= startDate && d <= endDate && inv.status !== 'cancelled';
    });
  }, [invoices, startDate, endDate]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const d = b.date.split('T')[0];
      return d >= startDate && d <= endDate && b.status !== 'cancelled';
    });
  }, [bookings, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = t.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [transactions, startDate, endDate]);

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.isActive !== false);
  }, [employees]);

  // 1. Staff Performance (Revenue, Services Count, Commissions)
  const staffPerformance = useMemo(() => {
    return activeEmployees.map(emp => {
      let revenue = 0;
      let serviceCount = 0;

      filteredInvoices.forEach(inv => {
        inv.items?.forEach(item => {
          if (item.employeeId === emp.id || item.technicianName === emp.name) {
            const qty = item.quantity || 1;
            revenue += (item.price || 0) * qty;
            serviceCount += qty;
          }
        });
      });

      const commissions = calculateEmployeeCommission(emp, revenue);

      // Advances (سلف)
      const advances = filteredTransactions
        .filter(t => (t.category === 'staff_advance' || t.category === 'hr_advance') && (t.description?.includes(emp.name) || t.userName === emp.name))
        .reduce((sum, t) => sum + t.amount, 0);

      // Financial records advances if recorded
      const finAdvances = emp.financialRecords
        ?.filter(r => r.type === 'advance' && r.date >= startDate && r.date <= endDate)
        .reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

      const totalAdvances = advances > 0 ? advances : finAdvances;

      // Bookings count
      let bookingsCount = 0;
      filteredBookings.forEach(b => {
        b.services?.forEach(s => {
          if (s.technicianId === emp.id || s.technicianName === emp.name) {
            bookingsCount++;
          }
        });
      });

      // Delays & Absences (mock or real records)
      const penalties = emp.financialRecords?.filter(r => r.date >= startDate && r.date <= endDate) || [];
      const delayMinutes = penalties.filter(p => p.type === 'penalty_cash').reduce((sum, p) => sum + (p.amount || 15), 0);
      const leaveDays = emp.leaveRecords?.filter(l => l.startDate >= startDate && l.startDate <= endDate).length || 0;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        baseSalary: emp.baseSalary || 0,
        revenue,
        serviceCount,
        commissionRate,
        commissions,
        totalAdvances,
        bookingsCount,
        delayMinutes,
        leaveDays
      };
    });
  }, [activeEmployees, filteredInvoices, filteredBookings, filteredTransactions, startDate, endDate]);

  // Max values for visual progress bars
  const maxRevenue = Math.max(...staffPerformance.map(s => s.revenue), 1);
  const maxBookings = Math.max(...staffPerformance.map(s => s.bookingsCount), 1);
  const maxSalary = Math.max(...staffPerformance.map(s => s.baseSalary), 1);

  // Sorted views
  const topByRevenue = [...staffPerformance].sort((a, b) => b.revenue - a.revenue);
  const topByBookings = [...staffPerformance].sort((a, b) => b.bookingsCount - a.bookingsCount);
  const sortedByDelays = [...staffPerformance].sort((a, b) => b.delayMinutes - a.delayMinutes);
  const sortedByAbsences = [...staffPerformance].sort((a, b) => b.leaveDays - a.leaveDays);
  const topByAdvances = [...staffPerformance].sort((a, b) => b.totalAdvances - a.totalAdvances);

  return (
    <div className="p-4 sm:p-8 w-full h-full overflow-y-auto bg-slate-100/60 font-sans space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <UsersRound size={18} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">رسومات وتحليلات أداء الموظفين</h2>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">
            لوحة إحصائية تفاعلية لمراقبة إيرادات الفنيين، الحجوزات، الرواتب، العمولات، التأخيرات، والسلف ({dateLabel})
          </p>
        </div>

        {/* Filters & Export */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            {(['today', 'week', 'month', 'year', 'all', 'custom'] as const).map(preset => {
              const labels: Record<typeof preset, string> = {
                today: 'اليوم',
                week: 'أسبوع',
                month: 'شهر',
                year: 'سنة',
                all: 'الكل',
                custom: 'مخصص'
              };
              return (
                <button
                  key={preset}
                  onClick={() => setTimePreset(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    timePreset === preset
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              const headers = ['الموظف', 'المسمى الوظيفي', 'الراتب الأساسي', 'إجمالي الإيرادات', 'العمولات', 'السلف', 'الحجوزات'];
              const rows = staffPerformance.map(s => [
                s.name,
                s.role,
                s.baseSalary,
                s.revenue,
                s.commissions,
                s.totalAdvances,
                s.bookingsCount
              ]);
              exportToExcel(`تحليلات_أداء_الموظفين_${new Date().toISOString().split('T')[0]}`, 'أداء الموظفين', headers, rows);
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download size={14} />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Grid of Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. TOP PERFORMING STAFF BY REVENUE */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                🏆 الإنتاجية والمبيعات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أكثر الموظفين أعمالاً وإيراداً</h4>
            </div>
            <span className="text-xs font-bold text-slate-400">الترتيب حسب الإيراد</span>
          </div>

          <div className="space-y-3.5 pt-2">
            {topByRevenue.map((emp, idx) => {
              const pct = Math.round((emp.revenue / maxRevenue) * 100) || 0;
              return (
                <div key={emp.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="flex items-center gap-2 text-slate-800">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                        idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{emp.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({emp.serviceCount} خدمة)</span>
                    </span>
                    <span className="font-mono text-emerald-600 font-black text-sm">
                      {emp.revenue.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. MOST REQUESTED IN BOOKINGS */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                📅 الحجوزات والمواعيد
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أكثر الموظفين طلباً في الحجوزات</h4>
            </div>
            <span className="text-xs font-bold text-slate-400">عدد الحجوزات</span>
          </div>

          <div className="space-y-3.5 pt-2">
            {topByBookings.map((emp, idx) => {
              const pct = Math.round((emp.bookingsCount / maxBookings) * 100) || 0;
              return (
                <div key={emp.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="flex items-center gap-2 text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-black">
                        {idx + 1}
                      </span>
                      <span>{emp.name}</span>
                    </span>
                    <span className="font-mono text-indigo-600 font-black">
                      {emp.bookingsCount} حجز
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full bg-indigo-600 rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. MULTI-METRIC COMPARISON (SALARY vs REVENUE vs COMMISSIONS) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                ⚖️ المقارنة الشاملة
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">
                مقارنة راتب كل موظف مع مجموع أعماله خلال المدة مع عمولاته
              </h4>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span> الراتب الأساسي
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span> مجموع الأعمال
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span> العمولات
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffPerformance.map(emp => {
              const maxMetric = Math.max(emp.baseSalary, emp.revenue, emp.commissions, 1);

              return (
                <div key={emp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="font-extrabold text-sm text-slate-900">{emp.name}</h5>
                    <span className="text-[11px] font-bold text-slate-500">{emp.role}</span>
                  </div>

                  <div className="space-y-2 text-xs font-bold">
                    {/* Salary */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>الراتب الأساسي:</span>
                        <span className="font-mono text-blue-600">{emp.baseSalary} {settings.currency}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div style={{ width: `${(emp.baseSalary / maxMetric) * 100}%` }} className="h-full bg-blue-500 rounded-full" />
                      </div>
                    </div>

                    {/* Revenue */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>مجموع الأعمال (الإيراد):</span>
                        <span className="font-mono text-emerald-600">{emp.revenue.toFixed(2)} {settings.currency}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div style={{ width: `${(emp.revenue / maxMetric) * 100}%` }} className="h-full bg-emerald-500 rounded-full" />
                      </div>
                    </div>

                    {/* Commission */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>العمولات المستحقة:</span>
                        <span className="font-mono text-amber-600">{emp.commissions.toFixed(2)} {settings.currency}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div style={{ width: `${(emp.commissions / maxMetric) * 100}%` }} className="h-full bg-amber-500 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. ATTENDANCE & DELAYS (أكثر وأقل الموظفين تأخيرات) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
                ⏱️ سجل التأخيرات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أكثر / أقل الموظفين تأخيرات</h4>
            </div>
            <span className="text-xs font-bold text-slate-400">بالدقائق</span>
          </div>

          <div className="space-y-2.5 pt-2">
            {sortedByDelays.map((emp, idx) => (
              <div key={emp.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold">
                <span className="text-slate-800">{idx + 1}. {emp.name}</span>
                <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black ${
                  emp.delayMinutes > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {emp.delayMinutes} دقيقة تأخير
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. ATTENDANCE & ABSENCES (أكثر وأقل الموظفين غياباً) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg">
                🏖️ سجل الغياب والإجازات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أكثر / أقل الموظفين غياباً</h4>
            </div>
            <span className="text-xs font-bold text-slate-400">بالأيام</span>
          </div>

          <div className="space-y-2.5 pt-2">
            {sortedByAbsences.map((emp, idx) => (
              <div key={emp.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold">
                <span className="text-slate-800">{idx + 1}. {emp.name}</span>
                <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black ${
                  emp.leaveDays > 0 ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {emp.leaveDays} يوم غياب
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. ACTIVE EMPLOYEES SALARIES COMPARISON */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                💵 الرواتب الأساسية
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">مقارنة الرواتب للموظفين النشطين</h4>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {activeEmployees.map(emp => {
              const pct = Math.round(((emp.baseSalary || 0) / maxSalary) * 100);
              return (
                <div key={emp.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{emp.name} ({emp.role})</span>
                    <span className="font-mono text-slate-900">{emp.baseSalary} {settings.currency}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full bg-blue-600 rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. ADVANCES REQUESTED (أكثر الموظفين طلباً للسلفة) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                💸 السلف والمسحوبات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أكثر الموظفين طلباً للسلفة</h4>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {topByAdvances.map((emp, idx) => (
              <div key={emp.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold">
                <span className="text-slate-800">{idx + 1}. {emp.name}</span>
                <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black ${
                  emp.totalAdvances > 0 ? 'bg-amber-50 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-500'
                }`}>
                  {emp.totalAdvances.toFixed(2)} {settings.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
