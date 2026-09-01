import React, { useState } from 'react';
import { AppSettings, Transaction } from '../types';
import { Plus, Trash2, Edit2, Receipt, Save, X } from 'lucide-react';

export function ExpensesScreen({
  settings,
  setSettings,
  transactions,
  setTransactions,
  shiftData
}: {
  settings: AppSettings,
  setSettings: (s: AppSettings) => void,
  transactions: Transaction[],
  setTransactions: (t: Transaction[]) => void,
  shiftData: { isOpen: boolean; date: string; initialCash: number }
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // New Expense State
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(settings.expenseCategories?.[0] || '');
  const [treasuryId, setTreasuryId] = useState(settings.treasuries[0]?.id || '');
  const [transactionDate, setTransactionDate] = useState(shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0]);

  // Categories management state
  const [newCategoryName, setNewCategoryName] = useState('');

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

    const tDate = transactionDate + 'T' + new Date().toTimeString().split(' ')[0];

    if (editingExpenseId) {
      setTransactions(transactions.map(t => {
        if (t.id === editingExpenseId) {
          return {
            ...t,
            date: tDate,
            amount: Number(amount),
            expenseCategory: expenseCategory,
            description: description,
            treasury: treasuryId
          };
        }
        return t;
      }));
    } else {
      const newTrx: Transaction = {
        id: 'EXP-' + Math.random().toString(36).substr(2, 9),
        date: tDate,
        type: 'out',
        amount: Number(amount),
        category: 'expense',
        expenseCategory: expenseCategory,
        description: description,
        treasury: treasuryId
      };
      setTransactions([newTrx, ...transactions]);
    }
    setShowAddModal(false);
    setEditingExpenseId(null);
    setAmount('');
    setDescription('');
  };

  const handleAddCategory = () => {
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
    setCategoryToDelete(cat);
  };

  const confirmDeleteCategory = () => {
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

  const expensesList = transactions.filter(t => t.category === 'expense');

  return (
    <div className="p-8 w-full h-full overflow-y-auto bg-slate-50">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">المصروفات اليومية</h2>
          <p className="text-slate-500 text-sm mt-1">إدارة وتسجيل المصروفات وبنود الصرف الأساسية</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCategoriesModal(true)} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors">
            <Edit2 size={18} /> إدارة بنود الصرف
          </button>
          <button onClick={() => {
            setTransactionDate(shiftData.isOpen ? shiftData.date : new Date().toISOString().split('T')[0]);
            setShowAddModal(true);
          }} className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={18} /> تسجيل مصروف جديد
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <th className="p-4 font-bold">التاريخ</th>
              <th className="p-4 font-bold">بند الصرف</th>
              <th className="p-4 font-bold">الوصف</th>
              <th className="p-4 font-bold">الخزينة</th>
              <th className="p-4 font-bold">المبلغ</th>
              <th className="p-4 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {expensesList.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">لا توجد مصروفات مسجلة</td>
              </tr>
            ) : (
              expensesList.map(exp => (
                <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-slate-700 font-semibold">{new Date(exp.date).toLocaleDateString('ar-SA')}</td>
                  <td className="p-4 text-slate-800">
                    <span className="bg-slate-100 px-3 py-1 rounded-full text-sm font-bold border border-slate-200">
                      {exp.expenseCategory || 'عام'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">{exp.description}</td>
                  <td className="p-4 text-slate-600">{settings.treasuries.find(t => t.id === exp.treasury)?.name || exp.treasury}</td>
                  <td className="p-4 font-bold text-red-600">{exp.amount.toFixed(2)} {settings.currency}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditClick(exp)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-md transition-colors" title="تعديل"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors" title="حذف"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
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
    </div>
  );
}
