import { useState, useMemo } from 'react';
import { AppSettings, Transaction, Treasury, Branch, AppUser } from '../types';
import { Wallet, ArrowDownRight, ArrowUpRight, ArrowRightLeft, XCircle, Download, Building2, Trash2, Loader2 } from 'lucide-react';
import { exportToExcel } from '../utils/exportExcel';
import { AuthService } from '../services/auth';
import { DB } from '../services/db';

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

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteTransaction = async (trx: Transaction) => {
    // 1. فحص الصلاحيات
    const isAuthorized = !currentUser || 
      currentUser.role === 'admin' || 
      currentUser.role === 'owner' || 
      currentUser.role === 'programmer' || 
      currentUser.actions?.includes('manage_treasury_delete') || 
      currentUser.actions?.includes('delete_transactions') ||
      currentUser.actions?.includes('*') ||
      AuthService.canDo('pos_void', currentUser);

    if (!isAuthorized) {
      alert('⛔ عذراً، حذف الحركات المالية يتطلب صلاحية الإدارة (الأدمن أو المالك).');
      return;
    }

    // 2. فحص نوع الحركة وتقديم إيضاح للمستخدم
    const isSales = trx.category === 'sales' || trx.category === 'مبيعات' || (trx as any).invoiceId;
    const isCustody = trx.category === 'عهدة افتتاحية' || trx.category === 'initial_cash';
    const isTransfer = trx.category === 'transfer' || trx.id.includes('TRF');

    let warningMsg = '';
    if (isSales) {
      warningMsg = '\n\n⚠️ ملاحظة: هذه الحركة ناتجة عن فاتورة مبيعات. لحذف الفاتورة بالكامل وإلغاء خدماتها وتعديل المخزون وعمولات الموظفين، يرجى حذفها من شاشة الفواتير.';
    } else if (isCustody) {
      warningMsg = '\n\n⚠️ تحذير: هذه الحركة تمثل عهدة افتتاحية للوردية، وحذفها سيؤثر على مطابقة رصيد الوردية والخزينة.';
    }

    // فحص ما إذا كان هناك طرف مقابل لعملية التحويل بين الخزائن
    let pairedTrx: Transaction | undefined;
    if (isTransfer) {
      pairedTrx = transactions.find(t => 
        t.id !== trx.id && 
        (t.category === 'transfer' || t.id.includes('TRF')) && 
        t.amount === trx.amount && 
        t.date === trx.date &&
        t.type !== trx.type
      );
    }

    let confirmText = `هل أنت متأكد من حذف هذه الحركة المالية نهائياً؟\n` +
      `----------------------------------------\n` +
      `• رقم الحركة: ${trx.id}\n` +
      `• التاريخ: ${new Date(trx.date).toLocaleString('ar-SA')}\n` +
      `• الخزينة: ${settings.treasuries.find(t => t.id === trx.treasury)?.name || trx.treasury}\n` +
      `• المبلغ: ${trx.type === 'in' ? '+' : '-'}${trx.amount.toFixed(2)} ${settings.currency}\n` +
      `• البيان: ${trx.description || '-'}` +
      warningMsg;

    let deletePairToo = false;
    if (pairedTrx) {
      confirmText += `\n\n🔄 تم العثور على الطرف المقابل لعملية التحويل (الخزينة الأخرى: ${settings.treasuries.find(t => t.id === pairedTrx?.treasury)?.name || pairedTrx.treasury}).\nهل تريد حذف طرفي التحويل معاً لإبقاء الخزينتين متوازنتين؟`;
    }

    if (!window.confirm(confirmText)) return;

    if (pairedTrx) {
      deletePairToo = window.confirm(`هل نؤكد حذف طرفي التحويل معاً (${trx.id} و ${pairedTrx.id})؟\n• انقر "موافق" لحذف الطرفين معاً.\n• انقر "إلغاء" لحذف هذا الطرف فقط.`);
    }

    try {
      setDeletingId(trx.id);

      // 1. حذف من قاعدة البيانات Supabase
      await DB.deleteTransaction(trx.id);
      await DB.remove('transactions', trx.id);

      if (deletePairToo && pairedTrx) {
        await DB.deleteTransaction(pairedTrx.id);
        await DB.remove('transactions', pairedTrx.id);
      }

      // 2. تحديث الحالة في الواجهة المحلية
      const idsToDelete = new Set([trx.id, ...(deletePairToo && pairedTrx ? [pairedTrx.id] : [])]);
      setTransactions(transactions.filter(t => !idsToDelete.has(t.id)));

      alert(deletePairToo ? '✅ تم حذف طرفي عملية التحويل بنجاح.' : '✅ تم حذف الحركة المالية بنجاح.');
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      alert('❌ حدث خطأ أثناء الحذف: ' + (err?.message || 'يرجى المحاولة مجدداً'));
    } finally {
      setDeletingId(null);
    }
  };

  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'sales' | 'expense' | 'purchases' | 'payroll' | 'transfer' | 'custody' | 'deposit_withdraw'
  >('all');

  const getTreasuryTotals = (tId: string) => {
    const trxs = transactions.filter(t => t.treasury === tId || (t as any).treasuryId === tId);

    // Inflows (المقبوضات)
    const totalCustody = trxs
      .filter(t => t.type === 'in' && (t.category === 'عهدة افتتاحية' || t.category === 'initial_cash'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSales = trxs
      .filter(t => t.type === 'in' && (t.category === 'sales' || t.category === 'مبيعات' || t.category === 'booking_advance' || t.category === 'advance'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDeposits = trxs
      .filter(t => t.type === 'in' && (t.category === 'deposit' || t.category === 'partner_deposit'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalTransfersIn = trxs
      .filter(t => t.type === 'in' && t.category === 'transfer')
      .reduce((sum, t) => sum + t.amount, 0);

    // Outflows (المدفوعات والمصروفات)
    const totalExpenses = trxs
      .filter(t => t.type === 'out' && (t.category === 'expense' || t.category === 'مصروفات'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalPurchases = trxs
      .filter(t => t.type === 'out' && (t.category === 'purchase' || t.category === 'مشتريات'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSupplierPayments = trxs
      .filter(t => t.type === 'out' && (t.category === 'supplier_payment' || t.category === 'supplier' || t.category === 'سداد مورد'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSalaries = trxs
      .filter(t => t.type === 'out' && (t.category === 'salary' || t.category === 'رواتب' || t.category === 'راتب'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalAdvances = trxs
      .filter(t => t.type === 'out' && (t.category === 'hr_advance' || t.category === 'staff_advance' || t.category === 'advance' || t.category === 'سلف'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCommissions = trxs
      .filter(t => t.type === 'out' && (t.category === 'commission' || t.category === 'commission_payout' || t.category === 'عمولة'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalTransfersOut = trxs
      .filter(t => t.type === 'out' && t.category === 'transfer')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = trxs
      .filter(t => t.type === 'out' && (t.category === 'withdrawal' || t.category === 'partner_withdrawal'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalIn = trxs.filter(t => t.type === 'in').reduce((sum, t) => sum + t.amount, 0);
    const totalOut = trxs.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0);

    return { 
      totalIn, 
      totalOut, 
      totalCustody, 
      totalSales, 
      totalDeposits,
      totalTransfersIn,
      totalExpenses,
      totalPurchases,
      totalSupplierPayments,
      totalSalaries,
      totalAdvances,
      totalCommissions,
      totalTransfersOut,
      totalWithdrawals,
      balance: totalIn - totalOut 
    };
  };

  const translateCategory = (cat: string) => {
    const dict: Record<string, string> = {
      sales: 'مبيعات',
      مبيعات: 'مبيعات',
      'عهدة افتتاحية': 'عهدة افتتاحية',
      initial_cash: 'عهدة افتتاحية',
      advance: 'سلفة / عربون',
      booking_advance: 'عربون حجز',
      hr_advance: 'سلفة موظف',
      staff_advance: 'سلفة موظف',
      expense: 'مصروفات',
      مصروفات: 'مصروفات',
      purchase: 'مشتريات',
      مشتريات: 'مشتريات',
      supplier_payment: 'سداد مورد',
      supplier: 'سداد مورد',
      salary: 'صرف راتب',
      رواتب: 'صرف راتب',
      commission: 'عمولة موظف',
      commission_payout: 'صرف عمولة',
      transfer: 'تحويل بين الخزن',
      deposit: 'إيداع نقدي',
      withdrawal: 'سحب نقدي',
      partner_deposit: 'إيداع شريك',
      partner_withdrawal: 'مسحوبات شريك',
      partner_profit: 'أرباح شريك'
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
      filtered = filtered.filter(t => t.category === 'sales' || t.category === 'مبيعات' || t.category === 'booking_advance');
    } else if (categoryFilter === 'expense') {
      filtered = filtered.filter(t => t.category === 'expense' || t.category === 'مصروفات');
    } else if (categoryFilter === 'purchases') {
      filtered = filtered.filter(t => t.category === 'purchase' || t.category === 'مشتريات' || t.category === 'supplier_payment' || t.category === 'supplier');
    } else if (categoryFilter === 'payroll') {
      filtered = filtered.filter(t => t.category === 'salary' || t.category === 'رواتب' || t.category === 'hr_advance' || t.category === 'staff_advance' || t.category === 'advance' || t.category === 'commission_payout');
    } else if (categoryFilter === 'transfer') {
      filtered = filtered.filter(t => t.category === 'transfer' || t.id.includes('TRF'));
    } else if (categoryFilter === 'deposit_withdraw') {
      filtered = filtered.filter(t => t.category === 'deposit' || t.category === 'withdrawal' || t.category === 'partner_deposit' || t.category === 'partner_withdrawal');
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, fromDate, toDate, categoryFilter]);

  const totalBranchBalance = useMemo(() => {
    return settings.treasuries.reduce((sum, t) => sum + getTreasuryTotals(t.id).balance, 0);
  }, [settings.treasuries, transactions]);

  const handleExportExcel = () => {
    const headers = ['رقم الحركة', 'التاريخ والوقت', 'الخزينة', 'المستخدم / الكاشير', 'نوع الحركة', 'التصنيف', 'البيان والتفاصيل', 'المبلغ (SAR)'];
    const rows = filteredTransactions.map(t => [
      t.id,
      t.date ? new Date(t.date).toLocaleString('ar-SA') : '-',
      settings.treasuries.find(tr => tr.id === t.treasury)?.name || t.treasury,
      (t as any).userName || (t as any).createdBy || '-',
      t.type === 'in' ? 'إيداع / وارد' : 'صرف / صادر',
      translateCategory(t.category),
      t.description || '-',
      t.amount
    ]);
    exportToExcel(`سجل_حركات_الخزائن_${new Date().toISOString().split('T')[0]}`, 'حركات الخزائن', headers, rows);
  };

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
          const { 
            totalIn, totalOut, totalCustody, totalSales, 
            totalExpenses, totalPurchases, totalSupplierPayments, 
            totalSalaries, totalAdvances, balance 
          } = getTreasuryTotals(treasury.id);
          const isPrimary = idx === 0;
          const isCashDrawer = treasury.id === 'cash' || treasury.name.includes('كاش') || treasury.name.includes('الدرج');
          const totalPurchasesAndSuppliers = totalPurchases + totalSupplierPayments;
          const totalSalariesAndAdvances = totalSalaries + totalAdvances;

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
                  <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400/20 text-amber-200 border border-amber-300/30 text-xs font-black">
                    <span>💰 العهدة الافتتاحية:</span>
                    <span className="text-amber-100 font-mono">+{totalCustody.toFixed(2)} {settings.currency}</span>
                    <span className="text-[10px] text-amber-300/80 font-normal">(مضمنة بالرصيد)</span>
                  </div>
                )}

                {/* Linked Accounts Quick Summary */}
                <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-bold">
                  {totalSales > 0 && (
                    <span className="bg-emerald-500/25 text-emerald-100 px-2 py-0.5 rounded-md border border-emerald-400/30">
                      مبيعات: {totalSales.toFixed(0)}
                    </span>
                  )}
                  {totalExpenses > 0 && (
                    <span className="bg-rose-500/25 text-rose-200 px-2 py-0.5 rounded-md border border-rose-400/30">
                      مصروفات: {totalExpenses.toFixed(0)}
                    </span>
                  )}
                  {totalPurchasesAndSuppliers > 0 && (
                    <span className="bg-purple-500/25 text-purple-200 px-2 py-0.5 rounded-md border border-purple-400/30">
                      مشتريات/موردين: {totalPurchasesAndSuppliers.toFixed(0)}
                    </span>
                  )}
                  {totalSalariesAndAdvances > 0 && (
                    <span className="bg-blue-500/25 text-blue-200 px-2 py-0.5 rounded-md border border-blue-400/30">
                      رواتب/سلف: {totalSalariesAndAdvances.toFixed(0)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs font-bold">
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <ArrowDownRight size={15} />
                    <span>مقبوضات: {totalIn.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-300">
                    <ArrowUpRight size={15} />
                    <span>مدفوعات: {totalOut.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={() => handleOpenModal('deposit')}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowDownRight size={14} />
                  <span>إيداع</span>
                </button>
                <button
                  onClick={() => handleOpenModal('withdraw')}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowUpRight size={14} />
                  <span>صرف</span>
                </button>
                <button
                  onClick={() => handleOpenModal('transfer')}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowRightLeft size={14} />
                  <span>تحويل</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transactions History */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Header & Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
          <div>
            <h3 className="font-black text-slate-800 text-base">سجل العمليات والخزينة الموحد</h3>
            <p className="text-xs text-slate-400 mt-0.5">سجل كامل بجميع الحركات النقدية، المبيعات، المشتريات، سداد الموردين، الرواتب، السلف، والمصروفات</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Category Filter */}
            <div className="flex flex-wrap bg-slate-200/60 p-1 rounded-xl text-xs font-bold gap-1">
              <button 
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${categoryFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                الكل
              </button>
              <button 
                onClick={() => setCategoryFilter('sales')}
                className={`px-2.5 py-1 rounded-lg transition-all ${categoryFilter === 'sales' ? 'bg-emerald-600 text-white shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                مبيعات وعربونات
              </button>
              <button 
                onClick={() => setCategoryFilter('expense')}
                className={`px-2.5 py-1 rounded-lg transition-all ${categoryFilter === 'expense' ? 'bg-rose-600 text-white shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                مصروفات
              </button>
              <button 
                onClick={() => setCategoryFilter('purchases')}
                className={`px-2.5 py-1 rounded-lg transition-all ${categoryFilter === 'purchases' ? 'bg-purple-600 text-white shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                مشتريات وسداد موردين
              </button>
              <button 
                onClick={() => setCategoryFilter('payroll')}
                className={`px-2.5 py-1 rounded-lg transition-all ${categoryFilter === 'payroll' ? 'bg-blue-600 text-white shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                رواتب وسلف
              </button>
              <button 
                onClick={() => setCategoryFilter('transfer')}
                className={`px-2.5 py-1 rounded-lg transition-all ${categoryFilter === 'transfer' ? 'bg-indigo-600 text-white shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                تحويلات
              </button>
              <button 
                onClick={() => setCategoryFilter('custody')}
                className={`px-2.5 py-1 rounded-lg transition-all ${categoryFilter === 'custody' ? 'bg-amber-500 text-white shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                💰 عهدة
              </button>
              <button 
                onClick={() => setCategoryFilter('deposit_withdraw')}
                className={`px-2.5 py-1 rounded-lg transition-all ${categoryFilter === 'deposit_withdraw' ? 'bg-teal-600 text-white shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                سحب وإيداع
              </button>
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
              <span className="text-slate-400 text-[11px] font-bold">من:</span>
              <input 
                type="date" 
                value={fromDate} 
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent border-none outline-none font-sans font-bold text-slate-700 text-xs"
              />
              <span className="text-slate-400 text-[11px] font-bold mr-1">إلى:</span>
              <input 
                type="date" 
                value={toDate} 
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent border-none outline-none font-sans font-bold text-slate-700 text-xs"
              />
              {(fromDate || toDate) && (
                <button 
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  className="text-slate-400 hover:text-red-500 text-[10px] font-bold px-1"
                  title="مسح التاريخ"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Excel Export */}
            {filteredTransactions.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer mr-auto md:mr-0"
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
                <th className="py-3 px-4 text-center">إجراءات</th>
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
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleDeleteTransaction(trx)}
                        disabled={deletingId === trx.id}
                        className={`text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer ${
                          deletingId === trx.id ? 'opacity-50 pointer-events-none' : ''
                        }`}
                        title="حذف الحركة المالية"
                      >
                        {deletingId === trx.id ? (
                          <Loader2 size={15} className="animate-spin text-red-600" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400 font-bold">
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
