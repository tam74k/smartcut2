import { useState, useMemo } from 'react';
import { AppSettings, Transaction, Treasury, Branch, AppUser } from '../types';
import { Wallet, ArrowDownRight, ArrowUpRight, ArrowRightLeft, XCircle, Download, Building2 } from 'lucide-react';
import { exportToExcel } from '../utils/exportExcel';
import { AuthService } from '../services/auth';

export function TreasuryScreen({ 
  settings, 
  shiftData, 
  transactions, 
  setTransactions,
  activeBranchId,
  branches = [],
  currentUser
}: { 
  settings: AppSettings, 
  shiftData: { isOpen: boolean, date: string, initialCash: number },
  transactions: Transaction[],
  setTransactions: (t: Transaction[]) => void,
  activeBranchId?: string,
  branches?: Branch[],
  currentUser?: AppUser | null
}) {
  const [modalType, setModalType] = useState<'deposit' | 'withdraw' | 'transfer' | null>(null);
  
  const [amount, setAmount] = useState<number>(0);
  const [treasuryId, setTreasuryId] = useState<string>(settings.treasuries[0]?.id || '');
  const [toTreasuryId, setToTreasuryId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [category, setCategory] = useState<string>('deposit');
  const [transactionDate, setTransactionDate] = useState<string>('');
  
  // Date filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const activeBranch = branches.find(b => b.id === activeBranchId);

  const handleOpenModal = (type: 'deposit' | 'withdraw' | 'transfer') => {
    setModalType(type);
    setAmount(0);
    setTreasuryId(settings.treasuries[0]?.id || '');
    if (type === 'transfer') {
      setToTreasuryId(settings.treasuries[1]?.id || settings.treasuries[0]?.id || '');
    }
    setNote('');
    setCategory(type === 'deposit' ? 'deposit' : type === 'withdraw' ? 'expense' : 'transfer');
    setTransactionDate(shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = () => {
    if (amount <= 0) {
      alert('المبلغ غير صحيح');
      return;
    }
    if (!treasuryId) {
      alert('الرجاء تحديد الخزينة');
      return;
    }
    if (!transactionDate) {
      alert('الرجاء إدخال التاريخ');
      return;
    }

    const date = transactionDate + 'T' + new Date().toTimeString().split(' ')[0];
    
    if (modalType === 'transfer') {
      if (treasuryId === toTreasuryId) {
        alert('لا يمكن التحويل لنفس الخزينة');
        return;
      }
      
      const trxOut: Transaction = {
        id: 'TRX-TRF-OUT-' + Math.random().toString(36).substring(2,9),
        date,
        type: 'out',
        amount,
        category: 'transfer',
        description: note || `تحويل إلى ${settings.treasuries.find(t => t.id === toTreasuryId)?.name}`,
        treasury: treasuryId,
        branchId: activeBranchId,
        branchCode: activeBranch?.code,
        createdBy: currentUser?.name || 'الكاشير',
        userId: currentUser?.id,
        userName: currentUser?.name || 'الكاشير'
      };
      const trxIn: Transaction = {
        id: 'TRX-TRF-IN-' + Math.random().toString(36).substring(2,9),
        date,
        type: 'in',
        amount,
        category: 'transfer',
        description: note || `تحويل من ${settings.treasuries.find(t => t.id === treasuryId)?.name}`,
        treasury: toTreasuryId,
        branchId: activeBranchId,
        branchCode: activeBranch?.code,
        createdBy: currentUser?.name || 'الكاشير',
        userId: currentUser?.id,
        userName: currentUser?.name || 'الكاشير'
      };
      
      setTransactions([...transactions, trxOut, trxIn]);
    } else {
      const trx: Transaction = {
        id: `TRX-${modalType.toUpperCase()}-` + Math.random().toString(36).substring(2,9),
        date,
        type: modalType === 'deposit' ? 'in' : 'out',
        amount,
        category,
        description: note,
        treasury: treasuryId,
        branchId: activeBranchId,
        branchCode: activeBranch?.code,
        createdBy: currentUser?.name || 'الكاشير',
        userId: currentUser?.id,
        userName: currentUser?.name || 'الكاشير'
      };
      setTransactions([...transactions, trx]);
    }
    
    setModalType(null);
  };

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'custody' | 'sales' | 'expense'>('all');

  const getTreasuryTotals = (tId: string) => {
    const trxs = transactions.filter(t => t.treasury === tId);
    const totalCustody = trxs
      .filter(t => t.type === 'in' && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash'))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSales = trxs
      .filter(t => t.type === 'in' && (t.category === 'sales' || t.category === 'مبيعات'))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalIn = trxs.filter(t => t.type === 'in').reduce((sum, t) => sum + t.amount, 0);
    const totalOut = trxs.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0);
    return { totalIn, totalOut, totalCustody, totalSales, balance: totalIn - totalOut };
  };

  const translateCategory = (cat: string) => {
    const dict: Record<string, string> = {
      sales: 'مبيعات',
      'عهدة افتتاحية': 'عهدة افتتاحية',
      initial_cash: 'عهدة افتتاحية',
      advance: 'مقدم حجز',
      hr_advance: 'سلفة موظف',
      expense: 'مصروفات',
      transfer: 'تحويل',
      deposit: 'إيداع',
      withdrawal: 'سحب'
    };
    return dict[cat] || cat;
  };

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    if (fromDate) {
      filtered = filtered.filter(t => new Date(t.date) >= new Date(fromDate));
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.date) <= to);
    }
    if (categoryFilter === 'custody') {
      filtered = filtered.filter(t => t.category === 'عهدة افتتاحية' || t.category === 'initial_cash');
    } else if (categoryFilter === 'sales') {
      filtered = filtered.filter(t => t.category === 'sales' || t.category === 'مبيعات');
    } else if (categoryFilter === 'expense') {
      filtered = filtered.filter(t => t.type === 'out');
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, fromDate, toDate, categoryFilter]);

  const totalBranchBalance = useMemo(() => {
    return settings.treasuries.reduce((sum, t) => sum + getTreasuryTotals(t.id).balance, 0);
  }, [settings.treasuries, transactions]);

  return (
    <div className="p-4 sm:p-8 w-full h-full overflow-y-auto bg-slate-100/60 font-sans relative">
      {/* Active Branch Notice Banner */}
      {activeBranchId && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
              🏢
            </div>
            <div>
              <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                <span>الخزائن والمعاملات المالية لفرع:</span>
                <span className="text-indigo-600 font-extrabold">{settings.salonName || activeBranch?.name || 'الفرع النشط'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                🌍 {settings.country} • العملة: <strong className="text-slate-700">{settings.currency}</strong> • حالة الوردية: {shiftData.isOpen ? <span className="text-emerald-700 font-bold">مفتوحة ({shiftData.date}) 🟢</span> : <span className="text-slate-500 font-bold">مغلقة ⚪</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 bg-white border border-indigo-100 px-3.5 py-1.5 rounded-xl shadow-2xs">
              إجمالي رصيد الفرع: <strong className="text-emerald-600 font-mono font-black">{totalBranchBalance.toFixed(2)} {settings.currency}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">الخزائن والمعاملات والعهد</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">مراقبة الأرصدة الإجمالية، تتبع العهد الافتتاحية للكاشير، وتسجيل المصروفات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {AuthService.canDo('treasury_transfer') && (
            <button 
              onClick={() => handleOpenModal('transfer')}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
              <ArrowRightLeft size={16} />
              <span>تحويل أرصدة</span>
            </button>
          )}
          {AuthService.canDo('treasury_withdraw') && (
            <button 
              onClick={() => handleOpenModal('withdraw')}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
              <ArrowUpRight size={16} />
              <span>صرف نقدية</span>
            </button>
          )}
          {AuthService.canDo('treasury_deposit') && (
            <button 
              onClick={() => handleOpenModal('deposit')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
              <ArrowDownRight size={16} />
              <span>إيداع نقدية</span>
            </button>
          )}
        </div>
      </div>

      {/* Treasury Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {settings.treasuries.map((treasury, idx) => {
          const { totalIn, totalOut, totalCustody, totalSales, balance } = getTreasuryTotals(treasury.id);
          const isPrimary = idx === 0;
          const isCashDrawer = treasury.id === 'cash' || treasury.name.includes('كاش') || treasury.name.includes('الدرج');

          return (
            <div 
              key={treasury.id} 
              className={`rounded-3xl p-6 shadow-md relative overflow-hidden transition-all hover:shadow-lg ${
                isPrimary 
                  ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 text-white' 
                  : isCashDrawer
                  ? 'bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white border border-indigo-500/30'
                  : 'bg-slate-900 text-white border border-slate-800'
              }`}
            >
              <Wallet className="absolute -left-6 -bottom-6 opacity-10 text-white w-36 h-36 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isPrimary ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/30' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {treasury.name} {treasury.isMain && '• الرئيسية'}
                  </span>
                  <Wallet size={18} className={isPrimary ? 'text-emerald-200' : 'text-slate-400'} />
                </div>
                
                <h3 className="text-3xl sm:text-4xl font-black tracking-tight my-2">
                  {balance.toFixed(2)} <span className="text-base sm:text-lg font-bold opacity-80">{settings.currency}</span>
                </h3>

                {/* Custody Breakdown Tag */}
                {totalCustody > 0 && (
                  <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400/20 text-amber-200 border border-amber-300/30 text-xs font-black">
                    <span>💰 العهدة الافتتاحية:</span>
                    <span className="text-amber-100 font-mono">+{totalCustody.toFixed(2)} {settings.currency}</span>
                    <span className="text-[10px] text-amber-300/80 font-normal">(مضمنة بالرصيد)</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs font-bold">
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <ArrowDownRight size={15} />
                    <span>مقبوضات: {totalIn.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-300 justify-end">
                    <ArrowUpRight size={15} />
                    <span>مصروفات: {totalOut.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Operations Section with Page Scrolling */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
        {/* Filter Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
              سجل العمليات والعهد والحركات المالية ({filteredTransactions.length} حركة)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Quick Filter Pills */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  categoryFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setCategoryFilter('custody')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  categoryFilter === 'custody' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <span>💰 العهد فقط</span>
              </button>
              <button
                onClick={() => setCategoryFilter('sales')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  categoryFilter === 'sales' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                المبيعات
              </button>
              <button
                onClick={() => setCategoryFilter('expense')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  categoryFilter === 'expense' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                المصروفات
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">من:</label>
              <input 
                type="date" 
                value={fromDate} 
                onChange={e => setFromDate(e.target.value)} 
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 shadow-2xs" 
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">إلى:</label>
              <input 
                type="date" 
                value={toDate} 
                onChange={e => setToDate(e.target.value)} 
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 shadow-2xs" 
              />
            </div>
            {(fromDate || toDate || categoryFilter !== 'all') && (
              <button 
                onClick={() => { setFromDate(''); setToDate(''); setCategoryFilter('all'); }} 
                className="text-xs text-rose-600 hover:text-rose-700 font-bold bg-rose-50 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء الفلتر
              </button>
            )}

            {AuthService.canDo('export_excel') && (
              <button
                onClick={() => {
                  const headers = ['رقم الحركة', 'التاريخ', 'الخزينة', 'المستخدم', 'النوع', 'المبلغ', 'التصنيف', 'البيان'];
                  const rows = filteredTransactions.map(t => [
                    t.id,
                    t.date,
                    settings.treasuries.find(tr => tr.id === t.treasury)?.name || t.treasury,
                    t.userName || t.createdBy || '-',
                    t.type === 'in' ? 'إيداع / وارد' : 'صرف / منصرف',
                    t.amount,
                    translateCategory(t.category),
                    t.description || ''
                  ]);
                  exportToExcel(`سجل_حركات_الخزائن_${new Date().toISOString().split('T')[0]}`, 'حركات الخزينة والعهد', headers, rows);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Download size={14} />
                <span>تصدير Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* Full Operations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 font-extrabold border-b border-slate-200">
                <th className="py-3 px-4">رقم الحركة</th>
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">الخزينة</th>
                <th className="py-3 px-4">المستخدم / الكاشير</th>
                <th className="py-3 px-4">نوع الحركة</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">التصنيف</th>
                <th className="py-3 px-4">البيان / ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((trx) => {
                const isCustody = trx.category === 'عهدة افتتاحية' || trx.category === 'initial_cash';

                return (
                  <tr key={trx.id} className={`hover:bg-slate-50/80 transition-colors ${isCustody ? 'bg-amber-50/30' : ''}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{trx.id}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-semibold">{new Date(trx.date).toLocaleString('ar-SA')}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                        {settings.treasuries.find(t => t.id === trx.treasury)?.name || trx.treasury}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {trx.userName || trx.createdBy ? (
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-bold text-[11px]">
                          👤 {trx.userName || trx.createdBy}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {isCustody ? (
                        <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-full font-black border border-amber-300">
                          💰 عهدة افتتاحية
                        </span>
                      ) : trx.type === 'in' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                          <ArrowDownRight size={13} /> إيداع / وارد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full font-bold border border-rose-200">
                          <ArrowUpRight size={13} /> صرف / منصرف
                        </span>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 font-black text-sm ${isCustody ? 'text-amber-700' : trx.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {trx.type === 'in' ? '+' : '-'}{trx.amount.toFixed(2)} <span className="text-[10px] font-bold text-slate-500">{settings.currency}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`font-bold px-2 py-0.5 rounded border ${
                        isCustody ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {translateCategory(trx.category)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium max-w-xs truncate">{trx.description || '-'}</td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                    لا توجد حركات مطابقة للبحث أو التصفية الحالية
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                {modalType === 'deposit' ? 'إيداع نقدية' : modalType === 'withdraw' ? 'صرف نقدية' : 'تحويل أرصدة'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-red-500"><XCircle size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              {!shiftData.isOpen && (
                <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-200 font-bold mb-4">
                  تنبيه: لا توجد وردية مفتوحة حالياً. سيتم تسجيل الحركة بتاريخ اليوم الافتراضي.
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">التاريخ (الوردية المفتوحة)</label>
                <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ</label>
                <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>

              {modalType === 'transfer' ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">من خزينة</label>
                    <select value={treasuryId} onChange={e => setTreasuryId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary bg-white">
                      {settings.treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">إلى خزينة</label>
                    <select value={toTreasuryId} onChange={e => setToTreasuryId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary bg-white">
                      {settings.treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الخزينة</label>
                  <select value={treasuryId} onChange={e => setTreasuryId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary bg-white">
                    {settings.treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {modalType !== 'transfer' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">التصنيف</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary bg-white">
                    {modalType === 'deposit' ? (
                      <>
                        <option value="deposit">إيداع عام</option>
                        <option value="sales">مبيعات</option>
                      </>
                    ) : (
                      <>
                        <option value="expense">مصروفات</option>
                        <option value="withdrawal">سحب عام</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">البيان / ملاحظات</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={handleSubmit}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors"
              >
                تأكيد وتسجيل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
