import { useState, useMemo } from 'react';
import { AppSettings, Transaction, Invoice, Booking, Product, ItemMovement, PurchaseInvoice } from '../types';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, PieChart, 
  Layers, Package, Scissors, ShoppingCart, ArrowUpRight, ArrowDownRight, 
  Award, Sparkles, Filter, ChevronDown, RefreshCw, Flame, Snowflake, Activity, Zap
} from 'lucide-react';

export type TimeRangePreset = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export function DashboardChartsSection({
  settings,
  transactions,
  invoices,
  bookings,
  products = [],
  purchaseInvoices = [],
  itemMovements = []
}: {
  settings: AppSettings;
  transactions: Transaction[];
  invoices: Invoice[];
  bookings: Booking[];
  products?: Product[];
  purchaseInvoices?: PurchaseInvoice[];
  itemMovements?: ItemMovement[];
}) {
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('week');
  const [salesInterval, setSalesInterval] = useState<'day' | 'month'>('day');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Compute active date range based on preset
  const { startDate, endDate, dateLabel } = useMemo(() => {
    const now = new Date();
    const endStr = now.toISOString().split('T')[0];
    let start = new Date();

    if (timePreset === 'today') {
      const s = endStr;
      return { startDate: s, endDate: s, dateLabel: 'اليوم' };
    } else if (timePreset === 'week') {
      start.setDate(now.getDate() - 6);
      const s = start.toISOString().split('T')[0];
      return { startDate: s, endDate: endStr, dateLabel: 'آخر 7 أيام' };
    } else if (timePreset === 'month') {
      start.setDate(now.getDate() - 29);
      const s = start.toISOString().split('T')[0];
      return { startDate: s, endDate: endStr, dateLabel: 'آخر 30 يوماً' };
    } else if (timePreset === 'year') {
      start.setFullYear(now.getFullYear(), 0, 1);
      const s = start.toISOString().split('T')[0];
      return { startDate: s, endDate: endStr, dateLabel: 'هذا العام' };
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = t.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [transactions, startDate, endDate]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const d = b.date.split('T')[0];
      return d >= startDate && d <= endDate && b.status !== 'cancelled';
    });
  }, [bookings, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    return purchaseInvoices.filter(p => {
      const d = p.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [purchaseInvoices, startDate, endDate]);

  const filteredMovements = useMemo(() => {
    return itemMovements.filter(m => {
      const d = m.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [itemMovements, startDate, endDate]);

  // --- 1. SALES TIMELINE DATA ---
  const salesTimelineData = useMemo(() => {
    const map = new Map<string, number>();

    if (salesInterval === 'day') {
      // Build date list
      const start = new Date(startDate);
      const end = new Date(endDate);
      const curr = new Date(start);
      // Limit to 60 days max to prevent crowded charts
      let count = 0;
      while (curr <= end && count < 60) {
        const dStr = curr.toISOString().split('T')[0];
        map.set(dStr, 0);
        curr.setDate(curr.getDate() + 1);
        count++;
      }
      filteredInvoices.forEach(inv => {
        const dStr = inv.date.split('T')[0];
        if (map.has(dStr)) {
          map.set(dStr, (map.get(dStr) || 0) + inv.total);
        }
      });
    } else {
      // Monthly aggregation
      filteredInvoices.forEach(inv => {
        const mStr = inv.date.substring(0, 7); // YYYY-MM
        map.set(mStr, (map.get(mStr) || 0) + inv.total);
      });
    }

    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const maxVal = Math.max(...entries.map(e => e[1]), 1);
    const totalSales = entries.reduce((s, e) => s + e[1], 0);

    return { entries, maxVal, totalSales };
  }, [filteredInvoices, startDate, endDate, salesInterval]);

  // --- 2. EXPENSES TIMELINE DATA ---
  const expensesTimelineData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions
      .filter(t => t.type === 'out')
      .forEach(t => {
        const key = salesInterval === 'day' ? t.date.split('T')[0] : t.date.substring(0, 7);
        map.set(key, (map.get(key) || 0) + t.amount);
      });

    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const maxVal = Math.max(...entries.map(e => e[1]), 1);
    const totalExpenses = entries.reduce((s, e) => s + e[1], 0);

    return { entries, maxVal, totalExpenses };
  }, [filteredTransactions, salesInterval]);

  // --- 3. PAYMENT METHODS BREAKDOWN ---
  const paymentMethodsData = useMemo(() => {
    const map = new Map<string, number>();
    settings.treasuries.forEach(t => map.set(t.name, 0));

    filteredInvoices.forEach(inv => {
      if (inv.paymentMethods && inv.paymentMethods.length > 0) {
        inv.paymentMethods.forEach(pm => {
          const tName = settings.treasuries.find(t => t.id === pm.treasuryId)?.name || 'طرق دفع أخرى';
          map.set(tName, (map.get(tName) || 0) + pm.amount);
        });
      } else {
        const tName = settings.treasuries[0]?.name || 'كاش';
        map.set(tName, (map.get(tName) || 0) + inv.total);
      }
    });

    const entries = Array.from(map.entries()).filter(e => e[1] > 0);
    const total = entries.reduce((s, e) => s + e[1], 0) || 1;
    return { entries, total };
  }, [filteredInvoices, settings.treasuries]);

  // --- 4. TOP 10 EXPENSE CATEGORIES / ITEMS ---
  const top10Expenses = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions
      .filter(t => t.type === 'out')
      .forEach(t => {
        const cat = t.expenseCategory || t.category || 'مصروف عام';
        map.set(cat, (map.get(cat) || 0) + t.amount);
      });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [filteredTransactions]);

  // --- 5. PURCHASES & MOST PURCHASED PRODUCTS ---
  const topPurchasedItems = useMemo(() => {
    const map = new Map<string, { qty: number; cost: number }>();
    filteredPurchases.forEach(inv => {
      inv.items?.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const name = prod?.name || 'صنف مشتريات';
        const current = map.get(name) || { qty: 0, cost: 0 };
        map.set(name, {
          qty: current.qty + (item.quantity || 0),
          cost: current.cost + (item.total || 0)
        });
      });
    });

    const list = Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const totalPurchasesCost = filteredPurchases.reduce((s, p) => s + p.total, 0);
    return { list, totalPurchasesCost };
  }, [filteredPurchases, products]);

  // --- 6. TOP 10 & BOTTOM 10 SERVICES SOLD ---
  const { topServices, bottomServices } = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filteredInvoices.forEach(inv => {
      inv.items?.forEach(item => {
        const name = item.serviceName || 'خدمة';
        const current = map.get(name) || { count: 0, revenue: 0 };
        map.set(name, {
          count: current.count + (item.quantity || 1),
          revenue: current.revenue + ((item.price || 0) * (item.quantity || 1))
        });
      });
    });

    const all = Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
    const top = [...all].sort((a, b) => b.count - a.count).slice(0, 10);
    const bottom = [...all].sort((a, b) => a.count - b.count).slice(0, 10);

    return { topServices: top, bottomServices: bottom };
  }, [filteredInvoices]);

  // --- 7. MOST REQUESTED SERVICES IN BOOKINGS ---
  const topBookedServices = useMemo(() => {
    const map = new Map<string, number>();
    filteredBookings.forEach(b => {
      b.services?.forEach(s => {
        const name = s.serviceName || 'خدمة محجوزة';
        map.set(name, (map.get(name) || 0) + 1);
      });
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredBookings]);

  // --- 8. TOP 10 STAFF CONSUMED PRODUCTS ---
  const topStaffConsumedProducts = useMemo(() => {
    const map = new Map<string, number>();
    filteredMovements
      .filter(m => m.type === 'internal_use')
      .forEach(m => {
        const prod = products.find(p => p.id === m.productId);
        const name = prod?.name || 'مستحضر مستهلك';
        map.set(name, (map.get(name) || 0) + (m.quantityOut || 0));
      });

    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [filteredMovements, products]);

  // --- 9. WEEKLY DAYS ACTIVITY & PERFORMANCE (السبت، الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة) ---
  const weeklyActivityData = useMemo(() => {
    // Weekdays ordered Saturday (6) to Friday (5)
    const daysConfig = [
      { dayIndex: 6, name: 'السبت', shortName: 'سبت' },
      { dayIndex: 0, name: 'الأحد', shortName: 'أحد' },
      { dayIndex: 1, name: 'الاثنين', shortName: 'اثنين' },
      { dayIndex: 2, name: 'الثلاثاء', shortName: 'ثلاثاء' },
      { dayIndex: 3, name: 'الأربعاء', shortName: 'أربعاء' },
      { dayIndex: 4, name: 'الخميس', shortName: 'خميس' },
      { dayIndex: 5, name: 'الجمعة', shortName: 'جمعة' },
    ];

    // Count occurrences of each day in the date range
    const occurrencesMap = new Map<number, number>();
    daysConfig.forEach(d => occurrencesMap.set(d.dayIndex, 0));

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    const curr = new Date(sDate);
    let limit = 0;
    while (curr <= eDate && limit < 1000) {
      const dow = curr.getDay();
      occurrencesMap.set(dow, (occurrencesMap.get(dow) || 0) + 1);
      curr.setDate(curr.getDate() + 1);
      limit++;
    }

    const daysStats = daysConfig.map(day => {
      let revenue = 0;
      let invoicesCount = 0;
      let bookingsCount = 0;

      // Invoices matching this day of the week
      filteredInvoices.forEach(inv => {
        const invDay = new Date(inv.date).getDay();
        if (invDay === day.dayIndex) {
          revenue += inv.total;
          invoicesCount++;
        }
      });

      // Bookings matching this day of the week
      filteredBookings.forEach(b => {
        const bDay = new Date(b.date).getDay();
        if (bDay === day.dayIndex) {
          bookingsCount++;
        }
      });

      const occurrences = Math.max(occurrencesMap.get(day.dayIndex) || 1, 1);
      const avgRevenuePerDay = revenue / occurrences;
      const activityScore = (revenue * 0.7) + (invoicesCount * 50) + (bookingsCount * 30);

      return {
        ...day,
        revenue,
        invoicesCount,
        bookingsCount,
        occurrences,
        avgRevenuePerDay,
        activityScore
      };
    });

    const totalWeeklyRevenue = daysStats.reduce((s, d) => s + d.revenue, 0) || 1;
    const totalWeeklyInvoices = daysStats.reduce((s, d) => s + d.invoicesCount, 0) || 1;
    const maxActivity = Math.max(...daysStats.map(d => d.activityScore), 1);
    const maxDayRevenue = Math.max(...daysStats.map(d => d.revenue), 1);

    // Identify Peak & Slowest day
    const sortedByActivity = [...daysStats].sort((a, b) => b.activityScore - a.activityScore);
    const peakDay = sortedByActivity[0];
    const slowestDay = sortedByActivity[sortedByActivity.length - 1];

    return {
      daysStats,
      totalWeeklyRevenue,
      totalWeeklyInvoices,
      maxActivity,
      maxDayRevenue,
      peakDay,
      slowestDay
    };
  }, [filteredInvoices, filteredBookings, startDate, endDate]);

  return (
    <div className="space-y-6 my-6 font-sans">
      {/* Analytics Filter Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <BarChart3 size={18} />
            </div>
            <h3 className="text-lg font-black text-slate-900">لوحة التحليلات والرسوم البيانية التفاعلية</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            مقارنات دقيقة للمبيعات والمصروفات وطرق الدفع والخدمات الأكثر طلباً ({dateLabel})
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            {(['today', 'week', 'month', 'year', 'all', 'custom'] as TimeRangePreset[]).map(preset => {
              const labels: Record<TimeRangePreset, string> = {
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

          {timePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold outline-none"
              />
              <span className="text-xs text-slate-400 font-bold">إلى</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* FEATURED: WEEKLY DAYS ACTIVITY & PERFORMANCE (السبت - الأحد - الاثنين - الثلاثاء - الأربعاء - الخميس - الجمعة) */}
      <div className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Activity size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-slate-900">
                  تحليل ومعدل النشاط حسب أيام الأسبوع (السبت — الجمعة)
                </h4>
                <span className="bg-indigo-50 text-indigo-700 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  كافة بيانات النظام
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                مقارنة حجم المبيعات وعدد الفواتير والحجوزات لمعرفة أوقات الذروة وأكثر الأيام نشاطاً وأهدأها خلال الفترة ({dateLabel})
              </p>
            </div>
          </div>

          {/* Highlights */}
          <div className="flex flex-wrap items-center gap-2">
            {weeklyActivityData.peakDay && (
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-2xl text-xs font-black shadow-xs">
                <Flame size={15} className="animate-bounce" />
                <span>الذروة: {weeklyActivityData.peakDay.name} ({weeklyActivityData.peakDay.revenue.toFixed(0)} {settings.currency})</span>
              </div>
            )}
            {weeklyActivityData.slowestDay && (
              <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-2xl text-xs font-bold border border-slate-200">
                <Snowflake size={14} className="text-blue-500" />
                <span>الأهدأ: {weeklyActivityData.slowestDay.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Weekday Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {weeklyActivityData.daysStats.map((day) => {
            const isPeak = day.dayIndex === weeklyActivityData.peakDay?.dayIndex;
            const isSlowest = day.dayIndex === weeklyActivityData.slowestDay?.dayIndex;
            const activityPercent = Math.round((day.activityScore / weeklyActivityData.maxActivity) * 100) || 0;
            const revenuePercent = Math.round((day.revenue / weeklyActivityData.totalWeeklyRevenue) * 100) || 0;

            return (
              <div
                key={day.name}
                className={`rounded-2xl p-3.5 border transition-all flex flex-col justify-between space-y-3 ${
                  isPeak
                    ? 'bg-gradient-to-b from-amber-500/10 via-amber-50/50 to-white border-amber-300 shadow-sm ring-2 ring-amber-400/20'
                    : isSlowest
                    ? 'bg-slate-50/60 border-slate-200'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-2xs'
                }`}
              >
                {/* Day Header */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-black text-sm text-slate-900 flex items-center gap-1">
                      {day.name}
                      {isPeak && <span title="اليوم الأكثر نشاطاً">🔥</span>}
                      {isSlowest && <span title="اليوم الأقل نشاطاً">❄️</span>}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isPeak 
                        ? 'bg-amber-500 text-white font-extrabold shadow-2xs' 
                        : isSlowest
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {activityPercent}% نشاط
                    </span>
                  </div>

                  {/* Visual Activity Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      style={{ width: `${Math.max(activityPercent, 4)}%` }}
                      className={`h-full rounded-full transition-all ${
                        isPeak
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                          : isSlowest
                          ? 'bg-slate-400'
                          : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                      }`}
                    />
                  </div>

                  {/* Revenue */}
                  <div className="space-y-0.5 pt-1">
                    <p className="text-[10px] text-slate-400 font-bold">إجمالي المبيعات:</p>
                    <p className={`font-mono font-black text-sm ${isPeak ? 'text-amber-700' : 'text-slate-900'}`}>
                      {day.revenue.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">{settings.currency}</span>
                    </p>
                    <p className="text-[9px] text-slate-400 font-semibold">
                      حصة المبيعات: <span className="font-bold text-slate-700">{revenuePercent}%</span>
                    </p>
                  </div>
                </div>

                {/* Operations & Daily Average */}
                <div className="pt-2.5 border-t border-slate-100/80 space-y-1 text-[11px] font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span>الفواتير:</span>
                    <span className="font-mono font-bold text-slate-900">{day.invoicesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الحجوزات:</span>
                    <span className="font-mono font-bold text-slate-900">{day.bookingsCount}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-dashed border-slate-200 text-[10px] text-slate-500">
                    <span>متوسط اليوم:</span>
                    <span className="font-mono font-bold text-emerald-600">{day.avgRevenuePerDay.toFixed(0)} {settings.currency}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid of Main Comparative Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: SALES COMPARISON */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                📈 حركة المبيعات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">
                مقارنة المبيعات ({salesTimelineData.totalSales.toFixed(2)} {settings.currency})
              </h4>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setSalesInterval('day')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  salesInterval === 'day' ? 'bg-white text-indigo-600 shadow-2xs font-extrabold' : 'text-slate-500'
                }`}
              >
                يومي
              </button>
              <button
                onClick={() => setSalesInterval('month')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  salesInterval === 'month' ? 'bg-white text-indigo-600 shadow-2xs font-extrabold' : 'text-slate-500'
                }`}
              >
                شهري
              </button>
            </div>
          </div>

          {/* Bar Visualizer */}
          <div className="pt-4">
            {salesTimelineData.entries.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-xs">لا توجد بيانات مبيعات في هذه الفترة</p>
            ) : (
              <div className="h-44 flex items-end gap-1.5 sm:gap-2 pb-2 border-b border-slate-100 overflow-x-auto">
                {salesTimelineData.entries.map(([dateKey, val]) => {
                  const heightPercent = Math.max(Math.round((val / salesTimelineData.maxVal) * 100), 4);
                  return (
                    <div key={dateKey} className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-md">
                        {dateKey}: {val.toFixed(2)} {settings.currency}
                      </div>
                      <div className="w-full bg-indigo-50 rounded-t-lg relative flex items-end justify-center overflow-hidden h-36">
                        <div 
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all group-hover:from-indigo-700 group-hover:to-indigo-500"
                        />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center">
                        {salesInterval === 'day' ? dateKey.substring(5) : dateKey}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: EXPENSES COMPARISON */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                📉 حركة المصروفات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">
                مقارنة المصروفات ({expensesTimelineData.totalExpenses.toFixed(2)} {settings.currency})
              </h4>
            </div>
          </div>

          <div className="pt-4">
            {expensesTimelineData.entries.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-xs">لا توجد بيانات مصروفات في هذه الفترة</p>
            ) : (
              <div className="h-44 flex items-end gap-1.5 sm:gap-2 pb-2 border-b border-slate-100 overflow-x-auto">
                {expensesTimelineData.entries.map(([dateKey, val]) => {
                  const heightPercent = Math.max(Math.round((val / expensesTimelineData.maxVal) * 100), 4);
                  return (
                    <div key={dateKey} className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-md">
                        {dateKey}: {val.toFixed(2)} {settings.currency}
                      </div>
                      <div className="w-full bg-rose-50 rounded-t-lg relative flex items-end justify-center overflow-hidden h-36">
                        <div 
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md transition-all group-hover:from-rose-700 group-hover:to-rose-500"
                        />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center">
                        {salesInterval === 'day' ? dateKey.substring(5) : dateKey}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* CHART 3: PAYMENT METHODS BREAKDOWN */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                💳 طرق الدفع والتحصيل
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">مقارنة طرق الدفع خلال الفترة</h4>
            </div>
            <span className="text-xs font-mono font-black text-slate-700">
              {paymentMethodsData.total.toFixed(2)} {settings.currency}
            </span>
          </div>

          <div className="space-y-3.5 pt-2">
            {paymentMethodsData.entries.map(([name, amount], idx) => {
              const pct = Math.round((amount / paymentMethodsData.total) * 100) || 0;
              const colors = ['bg-indigo-600', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-600', 'bg-blue-500'];
              const color = colors[idx % colors.length];

              return (
                <div key={name} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{name}</span>
                    <span className="font-mono text-slate-900">
                      {amount.toFixed(2)} {settings.currency} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      style={{ width: `${pct}%` }} 
                      className={`h-full ${color} rounded-full transition-all duration-500`}
                    />
                  </div>
                </div>
              );
            })}
            {paymentMethodsData.entries.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-xs">لا توجد عمليات تحصيل مسجلة</p>
            )}
          </div>
        </div>

        {/* CHART 4: TOP 10 EXPENSE CATEGORIES */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                💸 بنود الصرف
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أعلى 10 بنود صرف خلال المدة</h4>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {top10Expenses.map(([cat, amount], idx) => {
              const maxExpense = top10Expenses[0]?.[1] || 1;
              const pct = Math.round((amount / maxExpense) * 100);

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-mono text-[10px]">
                        {idx + 1}
                      </span>
                      <span>{cat}</span>
                    </span>
                    <span className="font-mono text-rose-600 font-extrabold">
                      -{amount.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full bg-rose-500 rounded-full" />
                  </div>
                </div>
              );
            })}
            {top10Expenses.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-xs">لا توجد مصروفات مسجلة</p>
            )}
          </div>
        </div>

        {/* CHART 5: PURCHASES & MOST PURCHASED ITEMS */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                🛒 المشتريات والتوريدات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">
                أكثر الأصناف شراءً (الإجمالي: {topPurchasedItems.totalPurchasesCost.toFixed(2)} {settings.currency})
              </h4>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {topPurchasedItems.list.map((item, idx) => (
              <div key={item.name + idx} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="text-slate-800">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                    {item.qty} قطعة
                  </span>
                  <span className="font-mono text-slate-900 font-extrabold">
                    {item.cost.toFixed(2)} {settings.currency}
                  </span>
                </div>
              </div>
            ))}
            {topPurchasedItems.list.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-xs">لا توجد فواتير مشتريات مسجلة</p>
            )}
          </div>
        </div>

        {/* CHART 6: TOP 10 & BOTTOM 10 SERVICES */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
                ✂️ مبيعات الخدمات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أفضل وأقل 10 خدمات طلباً</h4>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            {/* Top 10 */}
            <div className="space-y-2">
              <p className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-center">
                ⭐ الأعلى طلباً
              </p>
              {topServices.slice(0, 5).map((srv, idx) => (
                <div key={srv.name} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold">
                  <span className="text-slate-800 truncate max-w-[120px]">{idx + 1}. {srv.name}</span>
                  <span className="font-mono text-emerald-600">{srv.count} طلب</span>
                </div>
              ))}
            </div>

            {/* Bottom 10 */}
            <div className="space-y-2">
              <p className="font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg text-center">
                الأقل طلباً
              </p>
              {bottomServices.slice(0, 5).map((srv, idx) => (
                <div key={srv.name} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold">
                  <span className="text-slate-600 truncate max-w-[120px]">{idx + 1}. {srv.name}</span>
                  <span className="font-mono text-slate-500">{srv.count} طلب</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CHART 7: MOST BOOKED SERVICES */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                📅 الحجوزات والمواعيد
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أكثر الخدمات طلباً في الحجوزات</h4>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {topBookedServices.map((srv, idx) => {
              const maxBook = topBookedServices[0]?.count || 1;
              const pct = Math.round((srv.count / maxBook) * 100);

              return (
                <div key={srv.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span>{srv.name}</span>
                    </span>
                    <span className="font-mono text-amber-700 font-extrabold">{srv.count} حجز</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full bg-amber-500 rounded-full" />
                  </div>
                </div>
              );
            })}
            {topBookedServices.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-xs">لا توجد بيانات حجوزات مسجلة</p>
            )}
          </div>
        </div>

        {/* CHART 8: TOP 10 STAFF CONSUMED PRODUCTS */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-black text-teal-600 bg-teal-50 px-2.5 py-1 rounded-lg">
                🧴 استهلاك المستلزمات
              </span>
              <h4 className="text-base font-black text-slate-900 mt-2">أكثر 10 منتجات استهلاكاً وصرفاً للموظفين</h4>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {topStaffConsumedProducts.map((prod, idx) => (
              <div key={prod.name + idx} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="text-slate-800">{prod.name}</span>
                </div>
                <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded font-mono font-black">
                  {prod.qty} مستهلك
                </span>
              </div>
            ))}
            {topStaffConsumedProducts.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-xs">لا توجد حركات استهلاك داخلي مسجلة</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
