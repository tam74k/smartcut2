import React, { useState, useMemo } from 'react';
import { AppSettings, Transaction } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Receipt, 
  Save, 
  X, 
  FileSpreadsheet, 
  Filter, 
  Calendar, 
  Search, 
  RotateCcw, 
  TrendingDown, 
  DollarSign, 
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { DB } from '../services/db';
import { ExpensesImportModal } from './ExpensesImportModal';
import { AuthService } from '../services/auth';

export function ExpensesScreen({
  settings,
  setSettings,
  transactions,
  setTransactions,
  shiftData,
  activeBranchId,
  currentUser
}: {
  settings: AppSettings,
  setSettings: (s: AppSettings) => void,
  transactions: Transaction[],
  setTransactions: (t: Transaction[]) => void,
  shiftData: { isOpen: boolean; date: string; initialCash: number },
  activeBranchId?: string;
  currentUser?: any;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTreasury, setSelectedTreasury] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Expense State
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(settings.expenseCategories?.[0] || '');
  const [treasuryId, setTreasuryId] = useState(settings.treasuries[0]?.id || '');
  const [transactionDate, setTransactionDate] = useState(shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0]);

  // Categories management state
  const [newCategoryName, setNewCategoryName] = useState('');

  // Extract all unique expense categories including custom ones in transactions
  const allCategories = useMemo(() => {
    const set = new Set<string>(settings.expenseCategories || []);
    transactions.forEach(t => {
      if (t.category === 'expense' && t.expenseCategory) {
        set.add(t.expenseCategory);
      }
    });
    return Array.from(set);
  }, [settings.expenseCategories, transactions]);

  // All base expenses
  const baseExpenses = useMemo(() => {
    return transactions.filter(t => t.category === 'expense');
  }, [transactions]);

  // Filtered expenses based on category, date range, treasury, and search
  const filteredExpenses = useMemo(() => {
    return baseExpenses.filter(exp => {
      // 1. Category Filter
      if (selectedCategory !== 'all') {
        const cat = exp.expenseCategory || 'عام';
        if (cat !== selectedCategory) return false;
      }

      // 2. Date Range Filter (from - to)
      const expDate = (exp.date || '').split('T')[0] || (exp.shiftDate || '');
      if (startDate && expDate < startDate) {
        return false;
      }
      if (endDate && expDate > endDate) {
        return false;
      }

      // 3. Treasury Filter
      if (selectedTreasury !== 'all') {
        if (exp.treasury !== selectedTreasury) return false;
      }

      // 4. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const desc = (exp.description || '').toLowerCase();
        const cat = (exp.expenseCategory || '').toLowerCase();
        const trName = (settings.treasuries.find(t => t.id === exp.treasury)?.name || exp.treasury || '').toLowerCase();
        if (!desc.includes(q) && !cat.includes(q) && !trName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [baseExpenses, selectedCategory, startDate, endDate, selectedTreasury, searchQuery, settings.treasuries]);

  // Dynamic Calculated Totals
  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [filteredExpenses]);

  const filteredCount = filteredExpenses.length;

  const averageExpenseAmount = useMemo(() => {
    return filteredCount > 0 ? (totalFilteredAmount / filteredCount) : 0;
  }, [totalFilteredAmount, filteredCount]);

  const topCategoryStats = useMemo(() => {
    if (filteredExpenses.length === 0) return { name: '-', amount: 0 };
    const counts: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      const c = exp.expenseCategory || 'عام';
      counts[c] = (counts[c] || 0) + (Number(exp.amount) || 0);
    });
    let topName = '-';
    let topAmount = 0;
    Object.entries(counts).forEach(([name, amt]) => {
      if (amt > topAmount) {
        topAmount = amt;
        topName = name;
      }
    });
    return { name: topName, amount: topAmount };
  }, [filteredExpenses]);

  // Quick Date Range Presets
  const handleSetQuickDate = (preset: 'today' | 'week' | 'month' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - ((day + 1) % 7); // Start of week (Saturday)
      const startOfWeek = new Date(d.setDate(diff));
      setStartDate(startOfWeek.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(startOfMonth.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setStartDate('');
    setEndDate('');
    setSelectedTreasury('all');
    setSearchQuery('');
  };

  const isFiltersActive = selectedCategory !== 'all' || startDate !== '' || endDate !== '' || selectedTreasury !== 'all' || searchQuery.trim() !== '';

  const handleEditClick = (exp: Transaction) => {
    setEditingExpenseId(exp.id);
    setAmount(exp.amount);
    setDescription(exp.description);
    setExpenseCategory(exp.expenseCategory || settings.expenseCategories?.[0] || '');
    setTreasuryId(exp.treasury);
    setTransactionDate(exp.date.split('T')[0]);
    setErrorMsg(''); setShowAddModal(true);
  };

  const handleDeleteExpense = (id: string) => {
    setExpenseToDelete(id);
  };

  const confirmDeleteExpense = () => {
    if (expenseToDelete) {
      setTransactions(transactions.filter(t => t.id !== expenseToDelete));
      setExpenseToDelete(null);
    }
  };

  const handleSaveExpense = () => {
    if (!amount || amount <= 0) {
      setErrorMsg('الرجاء إدخال مبلغ صحيح');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('الرجاء إدخال وصف المصروف');
      return;
    }
    if (!expenseCategory) {
      setErrorMsg('الرجاء اختيار بند الصرف');
      return;
    }

    const effectiveDay = (shiftData && shiftData.isOpen && shiftData.date) 
      ? shiftData.date 
      : (transactionDate || new Date().toISOString().split('T')[0]);
    const nowIso = new Date().toISOString();
    const tTime = nowIso.split('T')[1] || '12:00:00.000Z';
    const tDate = effectiveDay + 'T' + tTime;
    const currentShiftId = (shiftData && shiftData.isOpen) ? ((shiftData as any).shiftId || (shiftData as any).id) : undefined;

    if (editingExpenseId) {
      setTransactions(transactions.map(t => {
        if (t.id === editingExpenseId) {
          const updated = {
            ...t,
            date: tDate,
            amount: Number(amount),
            type: 'out',
            category: 'expense',
            expenseCategory: expenseCategory,
            description: description,
            treasury: treasuryId,
            shiftDate: shiftData.isOpen ? shiftData.date : (t as any).shiftDate,
            shiftId: shiftData.isOpen ? (currentShiftId || (t as any).shiftId) : (t as any).shiftId,
            updatedAt: nowIso
          };
          DB.saveTransaction(updated, settings.salonId);
          return updated;
        }
        return t;
      }));
    } else {
      const newTrx: Transaction = {
        id: 'EXP-' + Math.random().toString(36).substr(2, 9),
        date: tDate,
        createdAt: nowIso,
        type: 'out',
        amount: Number(amount),
        category: 'expense',
        expenseCategory: expenseCategory,
        description: description,
        treasury: treasuryId,
        salonId: settings.salonId,
        branchId: activeBranchId,
        shiftDate: shiftData.isOpen ? shiftData.date : undefined,
        shiftId: currentShiftId
      } as any;
      setTransactions([newTrx, ...transactions]);
      DB.saveTransaction(newTrx, settings.salonId);
    }
    setShowAddModal(false);
    setEditingExpenseId(null);
    setAmount('');
    setDescription('');
  };

  const canManageCategories = AuthService.canDo('manage_expense_categories', currentUser);

  const handleOpenCategoriesModal = () => {
    if (!canManageCategories) {
      alert('⛔ عذراً، لا تملك صلاحية إدارة وتعديل بنود وتصنيفات الصرف. يرجى مراجعة إدارة النظام.');
      return;
    }
    setShowCategoriesModal(true);
  };

  const handleAddCategory = () => {
    if (!canManageCategories) {
      setErrorMsg('⛔ عذراً، لا تملك صلاحية إضافة بنود صرف جديدة.');
      return;
    }
    if (!newCategoryName.trim()) return;
    const cats = settings.expenseCategories || [];
    if (cats.includes(newCategoryName.trim())) {
      setErrorMsg('هذا البند موجود مسبقاً');
      return;
    }
    setSettings({
      ...settings,
      expenseCategories: [...cats, newCategoryName.trim()]
    });
    setNewCategoryName('');
  };

  const handleDeleteCategory = (cat: string) => {
    if (!canManageCategories) {
      alert('⛔ عذراً، لا تملك صلاحية حذف بنود الصرف.');
      return;
    }
    setCategoryToDelete(cat);
  };

  const confirmDeleteCategory = () => {
    if (!canManageCategories) {
      alert('⛔ عذراً، لا تملك صلاحية حذف بنود الصرف.');
      return;
    }
    if (categoryToDelete) {
      setSettings({
        ...settings,
        expenseCategories: (settings.expenseCategories || []).filter(c => c !== categoryToDelete)
      });
      if (expenseCategory === categoryToDelete) {
        setExpenseCategory('');
      }
      setCategoryToDelete(null);
    }
  };

  return (
    <div className="p-6 md:p-8 w-full h-full overflow-y-auto bg-slate-50" dir="rtl">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Receipt className="text-primary" size={26} />
            <span>المصروفات اليومية</span>
          </h2>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-semibold">إدارة ومتابعة وتسجيل المصروفات مع فلاتر تصفية تحليلية متقدمة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button 
            onClick={() => setIsImportModalOpen(true)} 
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-xs md:text-sm shadow-xs transition-all cursor-pointer active:scale-95"
            title="سحب قيود المصروفات من ملف إكسل"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>سحب من إكسل</span>
          </button>
          <button 
            onClick={handleOpenCategoriesModal} 
            className={`border px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-xs md:text-sm shadow-xs transition-all cursor-pointer active:scale-95 ${
              canManageCategories 
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' 
                : 'bg-slate-100 border-slate-200 text-slate-400 opacity-80 cursor-not-allowed'
            }`}
            title={canManageCategories ? 'إدارة بنود وتصنيفات الصرف' : 'لا تملك صلاحية إدارة بنود الصرف'}
          >
            <Edit2 size={16} className={canManageCategories ? 'text-slate-500' : 'text-slate-400'} />
            <span>إدارة بنود الصرف</span>
            {!canManageCategories && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-black">🔒 مقفل</span>}
          </button>
          <button 
            onClick={() => {
              setTransactionDate(shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0]);
              setShowAddModal(true);
            }} 
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl font-black flex items-center gap-2 text-xs md:text-sm shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus size={18} />
            <span>تسجيل مصروف جديد</span>
          </button>
        </div>
      </div>

      {/* 2. Dynamic Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Expenses Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">إجمالي المصروفات (المصفاة)</p>
            <p className="text-2xl font-black text-rose-600 font-mono tracking-tight">
              {totalFilteredAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-slate-500 mr-1.5">{settings.currency}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              {isFiltersActive ? 'وفقاً لشروط التصفية الحالية' : 'إجمالي كافة المصروفات'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Expenses Count Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">عدد عمليات الصرف</p>
            <p className="text-2xl font-black text-slate-800 font-mono tracking-tight">
              {filteredCount}
              <span className="text-xs font-bold text-slate-500 mr-1.5">عملية</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              من إجمالي {baseExpenses.length} عملية مسجلة
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Receipt size={24} />
          </div>
        </div>

        {/* Top Category Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">أعلى بند صرف</p>
            <p className="text-base font-black text-purple-700 truncate max-w-[140px]" title={topCategoryStats.name}>
              {topCategoryStats.name}
            </p>
            <p className="text-xs font-mono font-bold text-purple-600 mt-1">
              {topCategoryStats.amount > 0 ? `${topCategoryStats.amount.toFixed(2)} ${settings.currency}` : '-'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <Layers size={22} />
          </div>
        </div>

        {/* Average Expense Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">متوسط قيمة المصروف</p>
            <p className="text-2xl font-black text-amber-600 font-mono tracking-tight">
              {averageExpenseAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-bold text-slate-500 mr-1.5">{settings.currency}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">لكل سند صرف في النطاق</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <TrendingDown size={22} />
          </div>
        </div>
      </div>

      {/* 3. Advanced Filters Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary" />
            <h3 className="font-black text-sm text-slate-800">تصفية وبحث متقدم في المصروفات</h3>
            {isFiltersActive && (
              <span className="bg-primary/10 text-primary text-[11px] font-black px-2 py-0.5 rounded-full border border-primary/20">
                الفلاتر مفعلة
              </span>
            )}
          </div>

          {/* Quick Date Range Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 ml-1">فترات سريعة:</span>
            <button
              onClick={() => handleSetQuickDate('today')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => handleSetQuickDate('week')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
            >
              هذا الأسبوع
            </button>
            <button
              onClick={() => handleSetQuickDate('month')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
            >
              هذا الشهر
            </button>
            <button
              onClick={() => handleSetQuickDate('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !startDate && !endDate
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل
            </button>
            {isFiltersActive && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg font-bold transition-all mr-1 cursor-pointer"
                title="إعادة تعيين كافة الفلاتر"
              >
                <RotateCcw size={12} />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3">
          {/* 1. Category Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Layers size={13} className="text-slate-400" />
              <span>تصنيف المصروف (البند)</span>
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all cursor-pointer"
            >
              <option value="all">جميع بنود الصرف ({baseExpenses.length})</option>
              {allCategories.map(cat => {
                const count = baseExpenses.filter(e => (e.expenseCategory || 'عام') === cat).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Start Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              <span>من تاريخ</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all cursor-pointer"
            />
          </div>

          {/* 3. End Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              <span>إلى تاريخ</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all cursor-pointer"
            />
          </div>

          {/* 4. Treasury Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <DollarSign size={13} className="text-slate-400" />
              <span>الخزينة المسحوب منها</span>
            </label>
            <select
              value={selectedTreasury}
              onChange={e => setSelectedTreasury(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all cursor-pointer"
            >
              <option value="all">كافة الخزائن</option>
              {settings.treasuries.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* 5. Search in Description */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Search size={13} className="text-slate-400" />
              <span>بحث في الوصف / البيان</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="اكتب للبحث في البيان..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all"
              />
              <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Summary Footer Bar */}
        <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 font-semibold gap-2">
          <div className="flex items-center gap-2">
            <span>النتائج المعروضة:</span>
            <strong className="text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded-md font-mono">{filteredCount}</strong>
            <span>من أصل {baseExpenses.length} مصروف مسجل</span>
          </div>
          {isFiltersActive && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 flex-wrap">
              <span>الفلاتر النشطة:</span>
              {selectedCategory !== 'all' && (
                <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold">
                  بند: {selectedCategory}
                </span>
              )}
              {startDate && (
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-bold">
                  من: {startDate}
                </span>
              )}
              {endDate && (
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-bold">
                  إلى: {endDate}
                </span>
              )}
              {selectedTreasury !== 'all' && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                  خزينة: {settings.treasuries.find(t => t.id === selectedTreasury)?.name || selectedTreasury}
                </span>
              )}
              {searchQuery && (
                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                  بحث: "{searchQuery}"
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Expenses Table with Totals */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-xs font-bold">
              <th className="p-4 font-black">#</th>
              <th className="p-4 font-black">التاريخ</th>
              <th className="p-4 font-black">بند الصرف</th>
              <th className="p-4 font-black">الوصف والبيان</th>
              <th className="p-4 font-black">الخزينة</th>
              <th className="p-4 font-black text-left">المبلغ</th>
              <th className="p-4 font-black text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Receipt size={36} className="text-slate-300" />
                    <p className="font-bold text-slate-600 text-sm">
                      {isFiltersActive ? 'لا توجد مصروفات تطابق شروط التصفية المحددة' : 'لا توجد مصروفات مسجلة حتى الآن'}
                    </p>
                    {isFiltersActive && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
                      >
                        إلغاء الفلاتر وعرض الكل
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp, idx) => (
                <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                  <td className="p-4 text-slate-700 font-semibold whitespace-nowrap">
                    <span className="font-mono">{new Date(exp.date).toLocaleDateString('ar-SA')}</span>
                    {exp.date.includes('T') && (
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {exp.date.split('T')[1]?.substring(0, 5)}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-800 whitespace-nowrap">
                    <span className="bg-purple-50 text-purple-800 px-3 py-1 rounded-full text-xs font-black border border-purple-200">
                      {exp.expenseCategory || 'عام'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-700 font-medium">
                    <p className="line-clamp-2">{exp.description}</p>
                    {exp.shiftDate && (
                      <span className="text-[10px] text-slate-400">وردية: {exp.shiftDate}</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-600 whitespace-nowrap">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold">
                      {settings.treasuries.find(t => t.id === exp.treasury)?.name || exp.treasury}
                    </span>
                  </td>
                  <td className="p-4 font-black text-rose-600 text-sm font-mono text-left whitespace-nowrap">
                    {exp.amount.toFixed(2)} <span className="text-xs text-slate-500 font-sans font-bold">{settings.currency}</span>
                  </td>
                  <td className="p-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button 
                        onClick={() => handleEditClick(exp)} 
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors cursor-pointer" 
                        title="تعديل المصروف"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        onClick={() => handleDeleteExpense(exp.id)} 
                        className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer" 
                        title="حذف المصروف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filteredExpenses.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs">
              <tr>
                <td colSpan={3} className="p-4 text-slate-700 font-black">
                  المجموع الكلي ({filteredCount} عملية مصفاة):
                </td>
                <td colSpan={2} className="p-4 text-slate-500 text-left">
                  إجمالي المبالغ المعروضة:
                </td>
                <td className="p-4 font-mono font-black text-rose-700 text-base text-left whitespace-nowrap">
                  {totalFilteredAmount.toFixed(2)} <span className="text-xs text-slate-600 font-sans">{settings.currency}</span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Receipt className="text-primary" size={20} /> {editingExpenseId ? 'تعديل مصروف' : 'تسجيل مصروف جديد'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingExpenseId(null); setErrorMsg(''); }} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 font-bold mb-4">
                  {errorMsg}
                </div>
              )}
              {!shiftData.isOpen && (
                <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-200 font-bold mb-4">
                  تنبيه: لا توجد وردية مفتوحة حالياً. سيتم تسجيل الحركة بتاريخ اليوم الافتراضي.
                </div>
              )}
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">التاريخ</label>
                <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ</label>
                <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">البند الأساسي</label>
                <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary bg-white">
                  <option value="">-- اختر بند الصرف --</option>
                  {(settings.expenseCategories || []).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الوصف</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" placeholder="تفاصيل المصروف..." />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الخزينة (طريقة الدفع)</label>
                <select value={treasuryId} onChange={e => setTreasuryId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary bg-white">
                  {settings.treasuries.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button onClick={handleSaveExpense} className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors">
                {editingExpenseId ? 'تحديث المصروف' : 'حفظ المصروف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Management Modal */}
      {showCategoriesModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">إدارة بنود الصرف</h3>
              <button onClick={() => { setShowCategoriesModal(false); setErrorMsg(''); }} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
            </div>
            <div className="p-6">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 font-bold mb-4">
                  {errorMsg}
                </div>
              )}
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary"
                  placeholder="اسم البند الجديد..."
                />
                <button onClick={handleAddCategory} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold">
                  إضافة
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {(settings.expenseCategories || []).length === 0 ? (
                  <p className="text-center text-slate-400 text-sm">لا توجد بنود مضافة</p>
                ) : (
                  (settings.expenseCategories || []).map(cat => (
                    <div key={cat} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="font-bold text-slate-700">{cat}</span>
                      <button onClick={() => handleDeleteCategory(cat)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Expense Confirmation */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <h3 className="font-bold text-lg text-slate-800 mb-4">تأكيد الحذف</h3>
            <p className="text-slate-600 mb-6">هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button onClick={() => setExpenseToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl transition-colors">إلغاء</button>
              <button onClick={confirmDeleteExpense} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors">نعم، احذف</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <h3 className="font-bold text-lg text-slate-800 mb-4">تأكيد الحذف</h3>
            <p className="text-slate-600 mb-6">هل أنت متأكد من حذف بند الصرف '{categoryToDelete}'؟</p>
            <div className="flex gap-3">
              <button onClick={() => setCategoryToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl transition-colors">إلغاء</button>
              <button onClick={confirmDeleteCategory} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors">نعم، احذف</button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Excel Import Modal */}
      <ExpensesImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        settings={settings}
        setSettings={setSettings}
        activeBranchId={activeBranchId}
        shiftData={shiftData}
        onImportComplete={(newT, newCats) => {
          if (newT.length > 0) {
            setTransactions([...newT, ...transactions]);
          }
        }}
      />
    </div>
  );
}
