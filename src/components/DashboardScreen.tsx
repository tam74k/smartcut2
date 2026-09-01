import { useState } from 'react';
import { AppSettings, Booking, Invoice, Transaction, PurchaseInvoice, ItemMovement, Branch } from '../types';
import { 
  TrendingUp, Receipt, CalendarClock, ArrowUpRight, ArrowDownRight, 
  Edit2, FileText, Banknote, Eye, X, Trash2, AlertTriangle, Package,
  Bell, CheckCircle2, Check, Scissors, Calendar, Clock, User, Building2
} from 'lucide-react';
import { DashboardChartsSection } from './DashboardChartsSection';
import { AuthService } from '../services/auth';

export function DashboardScreen({ 
  settings, 
  isShiftOpen, 
  shiftDate, 
  bookings, 
  setBookings, 
  transactions, 
  setTransactions, 
  onToPOS, 
  invoices, 
  products,
  purchaseInvoices = [],
  itemMovements = [],
  activeBranchId,
  branches = []
}: { 
  settings: AppSettings, 
  isShiftOpen: boolean, 
  shiftDate: string,
  bookings: Booking[],
  setBookings: (b: Booking[]) => void,
  transactions: Transaction[],
  setTransactions: (t: Transaction[]) => void,
  onToPOS: (b: Booking) => void,
  invoices: Invoice[],
  products: any[],
  purchaseInvoices?: PurchaseInvoice[],
  itemMovements?: ItemMovement[],
  activeBranchId?: string,
  branches?: Branch[]
}) {
  const [advPaymentModal, setAdvPaymentModal] = useState<string | null>(null);
  const [advAmount, setAdvAmount] = useState('');
  const [advTreasury, setAdvTreasury] = useState(settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || '');
  
  const [showRevenueDetails, setShowRevenueDetails] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const mainBranch = (branches && branches[0]) || { id: 'b-main', name: 'الفرع الرئيسي' };
  const mainBranchId = mainBranch.id;
  const isMainBranch = !activeBranchId || activeBranchId === mainBranchId || activeBranchId === 'b-main';

  const matchesActiveBranch = (itemBranchId?: string) => {
    if (itemBranchId) {
      return itemBranchId === activeBranchId;
    }
    // Items without explicit branchId belong to the primary/main branch
    return isMainBranch;
  };

  // Branch-specific filtering
  const branchInvoices = invoices.filter(inv => matchesActiveBranch(inv.branchId));
  const branchTransactions = transactions.filter(t => matchesActiveBranch((t as any).branchId));
  const branchBookings = bookings.filter(b => matchesActiveBranch((b as any).branchId));

  const shiftBookings = branchBookings.filter(b => isShiftOpen && b.date === shiftDate && b.status !== 'completed' && b.status !== 'cancelled');
  const pendingBookings = branchBookings.filter(b => b.status === 'pending');

  const handleConfirmBooking = (bookingId: string) => {
    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: 'confirmed' } : b));
  };

  const handleCancelBooking = (bookingId: string) => {
    if (confirm('هل أنت متأكد من إلغاء هذا الحجز؟')) {
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
    }
  };

  // Compute stats for today based on transactions & invoices
  const todayTrx = branchTransactions.filter(t => t.date.startsWith(shiftDate));
  
  // Pure Today's Sales Revenue (Starts at 0.00, strictly from completed sales invoices without counting opening float)
  const todayInvoices = branchInvoices.filter(inv => inv.date.startsWith(shiftDate) && inv.status === 'completed');
  const todaySalesRevenue = isShiftOpen ? todayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0) : 0;
  
  // Total Income (excluding opening float)
  const totalIncome = isShiftOpen ? todayTrx.filter(t => t.type === 'in' && t.category !== 'عهدة افتتاحية' && t.category !== 'initial_cash' && !t.description?.includes('عهدة بداية') && !t.description?.includes('رصيد افتتاحي')).reduce((sum, t) => sum + t.amount, 0) : 0;
  
  // Total Expenses (purchases, expenses, salaries)
  const totalExpense = isShiftOpen ? todayTrx.filter(t => t.type === 'out' && (t.category === 'expense' || t.category === 'purchase' || t.category === 'salary' || t.category === 'supplier_payment')).reduce((sum, t) => sum + t.amount, 0) : 0;
  
  // Total Advances (سلف)
  const totalAdvancesGiven = isShiftOpen ? todayTrx.filter(t => t.type === 'out' && (t.category === 'staff_advance' || t.category === 'hr_advance')).reduce((sum, t) => sum + t.amount, 0) : 0;

  const todayInvoicesCount = isShiftOpen ? todayInvoices.length : 0;

  const handlePayAdvance = (booking: Booking) => {
    if (!advAmount || isNaN(Number(advAmount))) return;
    const treasury = settings.treasuries.find(t=>t.id===advTreasury);
    if(!treasury) return;

    const amount = Number(advAmount);
    
    // Add to booking advances
    const newAdvance = {
      id: Math.random().toString(36).substr(2,9),
      amount,
      treasuryId: treasury.id,
      treasuryName: treasury.name,
      date: new Date().toISOString()
    };
    
    setBookings(bookings.map(b => 
      b.id === booking.id ? { ...b, advancePayments: [...b.advancePayments, newAdvance] } : b
    ));

    // Add transaction
    const newTrx: Transaction = {
      id: 'TRX-' + Math.random().toString(36).substr(2,9),
      date: new Date().toISOString(),
      type: 'in',
      amount,
      category: 'مقدم حجز',
      description: `مقدم حجز للعميل ${booking.clientName}`,
      treasury: treasury.id
    };
    setTransactions([...transactions, newTrx]);

    setAdvPaymentModal(null);
    setAdvAmount('');
    alert(`تمت إضافة ${amount} إلى ${treasury.name}`);
  };

  const handleToInvoice = (booking: Booking) => {
    onToPOS(booking);
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking({...booking}); // Clone for editing
  };

  const saveEditBooking = () => {
    if(editingBooking) {
      setBookings(bookings.map(b => b.id === editingBooking.id ? editingBooking : b));
    }
    setEditingBooking(null);
  };

  const removeServiceFromEdit = (serviceId: string) => {
    if(editingBooking) {
      setEditingBooking({
        ...editingBooking,
        services: editingBooking.services.filter(s => s.id !== serviceId)
      });
    }
  };

  return (
    <div className="p-6 w-full h-full overflow-y-auto relative">
      <h2 className="text-xl font-bold text-slate-800 mb-5">نظرة عامة (لوحة التحكم)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setShowRevenueDetails(!showRevenueDetails)}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
        >
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">مبيعات اليوم (اضغط للتفاصيل)</p>
            <h3 className="text-lg font-extrabold text-emerald-600 font-mono">{todaySalesRevenue.toFixed(2)} <span className="text-sm font-normal text-slate-500">{settings.currency}</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">فواتير اليوم</p>
            <h3 className="text-lg font-extrabold text-slate-800">{todayInvoicesCount} <span className="text-sm font-normal text-slate-400">فاتورة</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
            <Receipt size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">مصروفات اليوم</p>
            <h3 className="text-lg font-extrabold text-slate-800">{totalExpense} <span className="text-sm font-normal">{settings.currency}</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <ArrowUpRight size={20} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-[12px] font-bold mb-1">سلف اليوم</p>
            <h3 className="text-lg font-extrabold text-slate-800">{totalAdvancesGiven} <span className="text-sm font-normal">{settings.currency}</span></h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
            <ArrowDownRight size={20} />
          </div>
        </div>
      </div>

      {showRevenueDetails && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 mb-6 shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-slate-700/80 pb-3">
            <div>
              <h3 className="font-black text-base flex items-center gap-2 text-white">
                <span>تفاصيل الخزائن والإيرادات لوردية اليوم ({shiftDate})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">تفصيل دقيق يوضح العهدة الافتتاحية، المبيعات النقدية والشبكة، والمصروفات</p>
            </div>
            <button 
              onClick={() => setShowRevenueDetails(false)} 
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer self-end sm:self-auto"
            >
              <X size={18}/>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {settings.treasuries.map(t => {
              const tTrx = todayTrx.filter(trx => trx.treasury === t.id);
              const custody = tTrx.filter(trx => trx.type === 'in' && (trx.category === 'عهدة افتتاحية' || trx.category === 'initial_cash')).reduce((sum, trx) => sum + trx.amount, 0);
              const sales = tTrx.filter(trx => trx.type === 'in' && (trx.category === 'sales' || trx.category === 'مبيعات' || trx.category === 'مقدم حجز')).reduce((sum, trx) => sum + trx.amount, 0);
              const otherIn = tTrx.filter(trx => trx.type === 'in' && trx.category !== 'عهدة افتتاحية' && trx.category !== 'initial_cash' && trx.category !== 'sales' && trx.category !== 'مبيعات' && trx.category !== 'مقدم حجز').reduce((sum, trx) => sum + trx.amount, 0);
              const income = tTrx.filter(trx => trx.type === 'in').reduce((sum, trx) => sum + trx.amount, 0);
              const outcome = tTrx.filter(trx => trx.type === 'out').reduce((sum, trx) => sum + trx.amount, 0);
              const net = income - outcome;
              const isCash = t.id === 'cash' || t.name.includes('كاش') || t.name.includes('الدرج');

              return (
                <div 
                  key={t.id} 
                  className={`p-4 rounded-2xl border transition-all ${
                    isCash 
                      ? 'bg-gradient-to-b from-indigo-950/80 to-slate-800/90 border-indigo-500/50 shadow-inner' 
                      : 'bg-slate-800/80 border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      {isCash && <span>💵</span>}
                      {t.name}
                    </span>
                    {isCash && (
                      <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300/30">
                        كاش الدرج
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Highlighted Custody Row for Cash */}
                    {custody > 0 && (
                      <div className="flex justify-between items-center bg-amber-500/15 border border-amber-400/30 px-2.5 py-1.5 rounded-xl text-amber-200 font-extrabold">
                        <span className="flex items-center gap-1">
                          <span>💰</span>
                          <span>العهدة الافتتاحية:</span>
                        </span>
                        <span className="font-mono text-amber-100 font-black">+{custody.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}

                    {/* Sales Row */}
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="flex items-center gap-1">
                        <span>🛍️</span>
                        <span>مبيعات وإيرادات اليوم:</span>
                      </span>
                      <span className="text-emerald-400 font-bold font-mono">+{sales.toFixed(2)} {settings.currency}</span>
                    </div>

                    {/* Other Inflows */}
                    {otherIn > 0 && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span>إيداعات أخرى:</span>
                        <span className="text-teal-400 font-bold font-mono">+{otherIn.toFixed(2)} {settings.currency}</span>
                      </div>
                    )}

                    {/* Outflows */}
                    <div className="flex justify-between items-center text-slate-300 border-b border-slate-700/80 pb-2">
                      <span className="flex items-center gap-1">
                        <span>💸</span>
                        <span>مسحوبات ومصروفات:</span>
                      </span>
                      <span className="text-rose-400 font-bold font-mono">-{outcome.toFixed(2)} {settings.currency}</span>
                    </div>

                    {/* Total Net Balance in Drawer */}
                    <div className="flex justify-between items-center pt-1 font-black text-sm text-white">
                      <span>الرصيد الفعلي بالخزينة:</span>
                      <span className={`font-mono ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {net.toFixed(2)} {settings.currency}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unconfirmed Bookings Alert & Action Section */}
      <div className="bg-white rounded-3xl border border-amber-200/80 shadow-sm p-5 mb-6 overflow-hidden relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold relative">
              <Bell size={20} className="animate-bounce" />
              {pendingBookings.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white"></span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-slate-900">الحجوزات الجديدة بانتظار التأكيد</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  pendingBookings.length > 0 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {pendingBookings.length > 0 ? `${pendingBookings.length} حجز معلق` : 'لا توجد حجوزات معلقة ✓'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">الحجوزات الواردة عبر التطبيق أو الموقع والتي لم يتم تأكيدها وقبولها من قبل الصالون بعد</p>
            </div>
          </div>
        </div>

        {pendingBookings.length === 0 ? (
          <div className="py-6 text-center text-slate-400 font-semibold text-xs flex flex-col items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-400 mb-1.5 opacity-80" />
            <p>جميع الحجوزات مؤكدة ومحدثة! لا توجد حجوزات جديدة بانتظار الاعتماد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingBookings.map((booking) => {
              const totalAdvance = booking.advancePayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

              return (
                <div 
                  key={booking.id}
                  className="bg-gradient-to-br from-amber-50/60 via-white to-orange-50/30 rounded-2xl p-4 border border-amber-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          {booking.time || '12:00'}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">{booking.clientName}</h4>
                          <p className="text-[11px] text-slate-500 font-mono font-bold" dir="ltr">{booking.phone}</p>
                        </div>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                        قيد الانتظار ⏳
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100/80 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                        <Calendar size={13} className="text-amber-600" />
                        <span>التاريخ: {booking.date}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        <span className="font-bold text-slate-700">الخدمات: </span>
                        {booking.services.map(s => s.serviceName).join(' + ') || 'خدمة عامة'}
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-xs font-bold">
                        <span className="text-slate-500">القيمة الإجمالية:</span>
                        <span className="text-slate-900 font-black font-mono">
                          {booking.totalAmount || 0} {settings.currency}
                        </span>
                      </div>
                      {totalAdvance > 0 && (
                        <div className="flex justify-between items-center text-[11px] text-emerald-600 font-bold">
                          <span>المقدم المدفوع:</span>
                          <span>{totalAdvance} {settings.currency}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-amber-100">
                    <button
                      onClick={() => handleConfirmBooking(booking.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Check size={14} />
                      <span>تأكيد الحجز</span>
                    </button>
                    <button
                      onClick={() => onToPOS(booking)}
                      className="bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Scissors size={14} />
                      <span>تحويل للـ POS</span>
                    </button>
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="col-span-2 text-rose-600 hover:bg-rose-50 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <X size={13} />
                      <span>إلغاء ورفض الحجز</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-1">
          <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            تنبيهات نواقص المخزون
          </h3>
          <div className="space-y-3">
            {products && products.filter(p => p.currentStock <= p.reorderLimit).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">لا يوجد نواقص في المخزون</p>
            ) : (
              products && products.filter(p => p.currentStock <= p.reorderLimit).slice(0, 5).map(p => (
                <div key={p.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-orange-50 text-orange-500">
                      <Package size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-[13px]">{p.name}</p>
                      <p className="text-[11px] text-slate-500">حد الطلب: {p.reorderLimit}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-red-600 text-[13px]">{p.currentStock}</p>
                    <p className="text-[10px] text-slate-500">متبقي</p>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <CalendarClock className="text-primary" size={18} />
              حجوزات الوردية الحالية
            </h3>
            {!isShiftOpen ? (
              <span className="text-[11px] bg-red-50 text-red-600 px-2 py-1 rounded-md font-bold">الوردية مغلقة</span>
            ) : (
              <span className="text-[11px] bg-emerald-50 text-primary px-2 py-1 rounded-md font-bold">تاريخ الوردية: {shiftDate}</span>
            )}
          </div>
          
          <div className="flex-1 space-y-3">
            {(!isShiftOpen || shiftBookings.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                <CalendarClock size={40} className="mb-2 opacity-50 text-slate-300" />
                <p className="text-[13px]">{!isShiftOpen ? 'يرجى فتح الوردية لعرض وإدارة الحجوزات' : 'لا توجد حجوزات في هذا التاريخ'}</p>
              </div>
            ) : (
              shiftBookings.map(booking => {
                const totalAdvance = booking.advancePayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                return (
                <div key={booking.id} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-primary/30 shadow-sm transition-all flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-secondary flex items-center justify-center font-bold text-[13px]">
                        {booking.time}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-[14px]">{booking.clientName}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span dir="ltr" className="font-semibold">{booking.phone}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="font-bold text-emerald-600">
                            مقدم: {totalAdvance} {settings.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {advPaymentModal === booking.id ? (
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-md border border-slate-200 w-full md:w-auto">
                          <input 
                            type="number" 
                            placeholder="المبلغ" 
                            className="w-20 px-2 py-1 text-[12px] rounded border border-slate-200 outline-none focus:border-primary"
                            value={advAmount}
                            onChange={(e) => setAdvAmount(e.target.value)}
                          />
                          <select 
                            className="w-24 px-1 py-1 text-[12px] rounded border border-slate-200 outline-none focus:border-primary bg-white"
                            value={advTreasury}
                            onChange={e => setAdvTreasury(e.target.value)}
                          >
                            {settings.treasuries.filter(t => !t.isMain).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                          <button onClick={() => handlePayAdvance(booking)} className="bg-emerald-500 text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-emerald-600">سداد</button>
                          <button onClick={() => {setAdvPaymentModal(null); setAdvAmount('')}} className="text-slate-500 hover:bg-slate-200 px-2 py-1 rounded text-[11px] font-bold">إلغاء</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                          <button 
                            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors"
                            onClick={() => setAdvPaymentModal(booking.id)}
                          >
                            <Banknote size={14} /> سداد مقدم
                          </button>
                          <button onClick={() => handleEditBooking(booking)} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors">
                            <Edit2 size={14} /> تعديل
                          </button>
                          <button onClick={() => handleToInvoice(booking)} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm">
                            <FileText size={14} /> لفاتورة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Detailed Booking Info */}
                  <div className="flex gap-4 border-t border-slate-100 pt-3 text-[12px]">
                    <div className="flex-1">
                      <p className="font-bold text-slate-700 mb-1">الخدمات:</p>
                      {booking.services?.length > 0 ? (
                        <div className="space-y-1">
                          {booking.services.map(s => (
                            <div key={s.id} className="flex justify-between text-slate-600 bg-slate-50 px-2 py-1 rounded">
                              <span>{s.serviceName} <span className="text-[10px] text-slate-400">({s.technicianName})</span></span>
                              <span className="font-bold">{s.price} {settings.currency}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400">لا توجد خدمات مسجلة</p>
                      )}
                    </div>
                    {booking.advancePayments?.length > 0 && (
                      <div className="w-1/3">
                        <p className="font-bold text-slate-700 mb-1">المقدمات المسددة:</p>
                        <div className="space-y-1">
                          {booking.advancePayments.map(p => (
                            <div key={p.id} className="flex justify-between text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                              <span>{p.treasuryName}</span>
                              <span className="font-bold">{p.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>
        </div>
      </div>

      {/* Analytics & Charts Section (Positioned Below Stock Shortages & Shift Bookings) */}
      {settings.showDashboardAnalytics !== false && (
        <DashboardChartsSection
          settings={settings}
          transactions={branchTransactions}
          invoices={branchInvoices}
          bookings={branchBookings}
          products={products}
          purchaseInvoices={purchaseInvoices}
          itemMovements={itemMovements}
        />
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">تعديل الحجز</h3>
              <button onClick={()=>setEditingBooking(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">العميل</label>
                  <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary" value={editingBooking.clientName} onChange={e=>setEditingBooking({...editingBooking, clientName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">رقم الجوال</label>
                  <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary" value={editingBooking.phone} onChange={e=>setEditingBooking({...editingBooking, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">تاريخ الحجز</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary" value={editingBooking.date} onChange={e=>setEditingBooking({...editingBooking, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">الوقت</label>
                  <input type="time" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary" value={editingBooking.time} onChange={e=>setEditingBooking({...editingBooking, time: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-2 border-t border-slate-100 pt-3">الخدمات المحجوزة</label>
                {editingBooking.services?.length > 0 ? (
                  <div className="space-y-2">
                    {editingBooking.services.map(s => (
                      <div key={s.id} className="flex justify-between items-center text-[12px] text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-bold">{s.serviceName}</span>
                          <span className="text-slate-500 text-[11px]">{s.technicianName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-primary">{s.price} {settings.currency}</span>
                          <button onClick={() => removeServiceFromEdit(s.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-[12px] text-center bg-slate-50 py-3 rounded-lg border border-dashed border-slate-200">لا توجد خدمات. الحجز فارغ.</p>
                )}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button onClick={()=>setEditingBooking(null)} className="px-4 py-2 text-[13px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors">إلغاء</button>
              <button onClick={saveEditBooking} className="px-4 py-2 text-[13px] font-bold bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors">حفظ التعديلات</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice View Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[450px] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2"><Receipt size={18}/> تفاصيل الفاتورة {viewInvoice.id}</h3>
              <button onClick={()=>setViewInvoice(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4 text-[13px]">
                <span className="font-bold text-slate-700">العميل: {viewInvoice.clientName}</span>
                <span className="text-slate-500">{new Date(viewInvoice.date).toLocaleDateString('ar-EG')}</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-right text-[12px]">
                  <thead className="bg-slate-50 border-b">
                    <tr><th className="p-2">الخدمة</th><th className="p-2">الفني</th><th className="p-2">السعر</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewInvoice.items?.map(it => (
                      <tr key={it.id}>
                        <td className="p-2 font-bold text-slate-700">{it.serviceName}</td>
                        <td className="p-2 text-slate-500">{it.technicianName}</td>
                        <td className="p-2 font-bold">{it.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1 text-[13px] text-slate-600">
                <div className="flex justify-between"><span>الإجمالي الفرعي:</span> <span>{viewInvoice.total + viewInvoice.discount}</span></div>
                <div className="flex justify-between text-red-500"><span>الخصم:</span> <span>{viewInvoice.discount}</span></div>
                <div className="flex justify-between font-bold text-base text-slate-800 pt-2 border-t mt-2"><span>الصافي:</span> <span>{viewInvoice.total} {settings.currency}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
