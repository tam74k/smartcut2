import { useState } from 'react';
import { AppSettings, Supplier, SupplierPayment, PurchaseInvoice, Transaction } from '../types';
import { Plus, Edit2, Trash2, Search, ArrowDownRight, ArrowUpRight, Printer, X, FileText } from 'lucide-react';

export function SuppliersScreen({
  settings,
  suppliers,
  setSuppliers,
  supplierPayments,
  setSupplierPayments,
  purchaseInvoices,
  transactions,
  setTransactions,
  shiftData
}: {
  settings: AppSettings;
  suppliers: Supplier[];
  setSuppliers: (s: Supplier[]) => void;
  supplierPayments: SupplierPayment[];
  setSupplierPayments: (sp: SupplierPayment[]) => void;
  purchaseInvoices: PurchaseInvoice[];
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  shiftData: { isOpen: boolean; date: string };
}) {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'payments'>('suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '', initialBalance: '' });
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ supplierId: '', amount: '', treasuryId: settings.treasuries[0]?.id || '', date: shiftData.date, notes: '' });
  
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');

  const handleSaveSupplier = () => {
    if (!supplierForm.name || !supplierForm.phone) return;
    
    if (editingSupplierId) {
      setSuppliers(suppliers.map(s => s.id === editingSupplierId ? { ...s, name: supplierForm.name, phone: supplierForm.phone, email: supplierForm.email, address: supplierForm.address } : s));
    } else {
      const newSupplier: Supplier = {
        id: 'SUP-' + Math.random().toString(36).substr(2, 9),
        name: supplierForm.name,
        phone: supplierForm.phone,
        email: supplierForm.email,
        address: supplierForm.address,
        currentBalance: Number(supplierForm.initialBalance) || 0
      };
      setSuppliers([...suppliers, newSupplier]);
    }
    setShowAddSupplierModal(false);
    setEditingSupplierId(null);
  };

  const deleteSupplier = (id: string) => {
    if (true) {
      setSuppliers(suppliers.filter(s => s.id !== id));
    }
  };

  const handleSavePayment = () => {
    if (!paymentForm.supplierId || !paymentForm.amount || !paymentForm.treasuryId) return;
    if (!shiftData.isOpen) {
      alert('الرجاء فتح وردية أولاً لتسجيل المدفوعات');
      return;
    }

    const amountNum = Number(paymentForm.amount);
    
    const newPayment: SupplierPayment = {
      id: 'SPAY-' + Math.random().toString(36).substr(2, 9),
      supplierId: paymentForm.supplierId,
      amount: amountNum,
      date: paymentForm.date,
      treasuryId: paymentForm.treasuryId,
      notes: paymentForm.notes
    };
    
    setSupplierPayments([...supplierPayments, newPayment]);
    
    // Update supplier balance
    setSuppliers(suppliers.map(s => s.id === paymentForm.supplierId ? { ...s, currentBalance: s.currentBalance - amountNum } : s));
    
    // Add transaction
    setTransactions([...transactions, {
      id: 'TRX-' + Math.random().toString(36).substring(2,9),
      date: new Date().toISOString(),
      type: 'out',
      amount: amountNum,
      category: 'supplier_payment',
      treasury: paymentForm.treasuryId || settings.treasuries[0]?.id,
      description: `سداد للمورد: ${suppliers.find(s => s.id === paymentForm.supplierId)?.name} ${paymentForm.notes ? '- ' + paymentForm.notes : ''}`
    }]);

    setShowPaymentModal(false);
  };

  const filteredSuppliers = suppliers.filter(s => s.name.includes(searchQuery) || s.phone.includes(searchQuery));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">إدارة الموردين</h1>
        <div className="flex gap-2">
          <button onClick={() => { setSupplierForm({ name: '', phone: '', email: '', address: '', initialBalance: '' }); setEditingSupplierId(null); setShowAddSupplierModal(true); }} className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
            <Plus size={18} /> إضافة مورد
          </button>
          <button onClick={() => { setPaymentForm({ supplierId: '', amount: '', treasuryId: settings.treasuries[0]?.id || '', date: shiftData.date, notes: '' }); setShowPaymentModal(true); }} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
            <ArrowUpRight size={18} /> سداد مورد
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
        <button onClick={() => setActiveTab('suppliers')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'suppliers' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>الموردين</button>
        <button onClick={() => setActiveTab('payments')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'payments' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>المدفوعات السابقة</button>
      </div>

      {activeTab === 'suppliers' && (
        <>
          <div className="relative mb-4">
            <input type="text" placeholder="بحث عن مورد..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary" />
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold text-slate-700">الاسم</th>
                  <th className="p-4 font-bold text-slate-700">الجوال</th>
                  <th className="p-4 font-bold text-slate-700 text-center">الرصيد (المديونية)</th>
                  <th className="p-4 font-bold text-slate-700 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-800">{s.name}</td>
                    <td className="p-4 text-slate-600">{s.phone}</td>
                    <td className="p-4 text-center font-bold text-red-600">{s.currentBalance.toFixed(2)}</td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => { setStatementSupplier(s); setStatementFrom(''); setStatementTo(''); }} className="bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-sm font-bold flex items-center gap-1">
                          <FileText size={14} /> كشف حساب
                        </button>
                        <button onClick={() => { setSupplierForm({ name: s.name, phone: s.phone, email: s.email || '', address: s.address || '', initialBalance: '' }); setEditingSupplierId(s.id); setShowAddSupplierModal(true); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16} /></button>
                        <button onClick={() => deleteSupplier(s.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold text-slate-700">التاريخ</th>
                <th className="p-4 font-bold text-slate-700">المورد</th>
                <th className="p-4 font-bold text-slate-700">المبلغ</th>
                <th className="p-4 font-bold text-slate-700">الخزينة</th>
                <th className="p-4 font-bold text-slate-700">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {supplierPayments.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-slate-600">{p.date}</td>
                  <td className="p-4 font-bold text-slate-800">{suppliers.find(s => s.id === p.supplierId)?.name}</td>
                  <td className="p-4 font-bold text-emerald-600">{p.amount.toFixed(2)}</td>
                  <td className="p-4 text-slate-600">{settings.treasuries.find(t => t.id === p.treasuryId)?.name}</td>
                  <td className="p-4 text-slate-500">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingSupplierId ? 'تعديل مورد' : 'إضافة مورد جديد'}</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم المورد</label>
                <input type="text" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">رقم الجوال</label>
                <input type="text" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>
              {!editingSupplierId && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الرصيد الافتتاحي (مديونية لنا)</label>
                  <input type="number" value={supplierForm.initialBalance} onChange={e => setSupplierForm({...supplierForm, initialBalance: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
                </div>
              )}
              <button onClick={handleSaveSupplier} className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary-dark transition-colors">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">سداد مورد</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">المورد</label>
                <select value={paymentForm.supplierId} onChange={e => setPaymentForm({...paymentForm, supplierId: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary">
                  <option value="">اختر المورد...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} (الرصيد: {s.currentBalance})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ</label>
                <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">الخزينة</label>
                <select value={paymentForm.treasuryId} onChange={e => setPaymentForm({...paymentForm, treasuryId: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary">
                  {settings.treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ملاحظات</label>
                <input type="text" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary" />
              </div>
              <button onClick={handleSavePayment} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-900 transition-colors">تأكيد السداد</button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Statement Modal */}
      {statementSupplier && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">كشف حساب: {statementSupplier.name}</h3>
              <button onClick={() => setStatementSupplier(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
              <input type="date" value={statementFrom} onChange={e => setStatementFrom(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={statementTo} onChange={e => setStatementTo(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">البيان</th>
                    <th className="p-2 text-emerald-600">مدين (سداد)</th>
                    <th className="p-2 text-red-600">دائن (مشتريات)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Will calculate movements */}
                  {(() => {
                    const movements = [];
                    purchaseInvoices.filter(i => i.supplierId === statementSupplier.id && (!statementFrom || i.date >= statementFrom) && (!statementTo || i.date <= statementTo)).forEach(inv => {
                      movements.push({ date: inv.date, type: 'purchase', desc: 'فاتورة مشتريات رقم ' + inv.id, in: 0, out: inv.total });
                      if (inv.paid > 0) {
                        movements.push({ date: inv.date, type: 'payment', desc: 'سداد جزئي للفاتورة رقم ' + inv.id, in: inv.paid, out: 0 });
                      }
                    });
                    supplierPayments.filter(p => p.supplierId === statementSupplier.id && (!statementFrom || p.date >= statementFrom) && (!statementTo || p.date <= statementTo)).forEach(pay => {
                      movements.push({ date: pay.date, type: 'payment', desc: 'سداد ' + pay.notes, in: pay.amount, out: 0 });
                    });
                    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    return movements.map((m, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="p-2">{new Date(m.date).toLocaleDateString('ar-EG')}</td>
                        <td className="p-2">{m.desc}</td>
                        <td className="p-2 text-emerald-600 font-bold">{m.in > 0 ? m.in.toFixed(2) : ''}</td>
                        <td className="p-2 text-red-600 font-bold">{m.out > 0 ? m.out.toFixed(2) : ''}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
              <div className="mt-6 text-xl font-bold p-4 bg-red-50 text-red-700 rounded-lg flex justify-between">
                <span>الرصيد المتبقي للمورد:</span>
                <span>{statementSupplier.currentBalance.toFixed(2)} {settings.currency}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
