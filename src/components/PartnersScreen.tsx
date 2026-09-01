import React, { useState, useMemo } from 'react';
import { AppSettings, Partner, PartnerTransaction, Transaction } from '../types';
import { 
  Users, Plus, Wallet, ArrowDownRight, ArrowUpRight, DollarSign, 
  PieChart as PieIcon, Trash2, Edit2, CheckCircle2, AlertTriangle, Calendar, Phone, FileText, Printer
} from 'lucide-react';

interface PartnersScreenProps {
  settings: AppSettings;
  partners: Partner[];
  setPartners: (updater: Partner[] | ((prev: Partner[]) => Partner[])) => void;
  partnerTransactions: PartnerTransaction[];
  setPartnerTransactions: (updater: PartnerTransaction[] | ((prev: PartnerTransaction[]) => PartnerTransaction[])) => void;
  setTransactions: (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  activeBranchId?: string;
  currentUser?: any;
}

export function PartnersScreen({
  settings,
  partners = [],
  setPartners,
  partnerTransactions = [],
  setPartnerTransactions,
  setTransactions,
  activeBranchId,
  currentUser
}: PartnersScreenProps) {
  const [activeTab, setActiveTab] = useState<'partners' | 'transactions'>('partners');
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  
  // Transaction Modal (Deposit / Withdrawal / Profit Share)
  const [showTxModal, setShowTxModal] = useState(false);
  const [txPartner, setTxPartner] = useState<Partner | null>(null);
  const [txType, setTxType] = useState<'deposit' | 'withdrawal' | 'profit_share'>('withdrawal');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txTreasury, setTxTreasury] = useState<string>(settings.treasuries[0]?.id || 'main');
  const [txDescription, setTxDescription] = useState('');

  // Partner Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIdNumber, setFormIdNumber] = useState('');
  const [formCapital, setFormCapital] = useState<number | ''>('');
  const [formNotes, setFormNotes] = useState('');

  // Calculations
  const totalCapital = useMemo(() => {
    return partners.reduce((sum, p) => sum + (Number(p.capitalShare) || 0), 0);
  }, [partners]);

  const totalWithdrawals = useMemo(() => {
    return partnerTransactions
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [partnerTransactions]);

  const totalDeposits = useMemo(() => {
    return partnerTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [partnerTransactions]);

  // Open add partner modal
  const handleOpenAddPartner = () => {
    setEditingPartner(null);
    setFormName('');
    setFormPhone('');
    setFormIdNumber('');
    setFormCapital('');
    setFormNotes('');
    setShowAddPartnerModal(true);
  };

  // Open edit partner modal
  const handleOpenEditPartner = (p: Partner) => {
    setEditingPartner(p);
    setFormName(p.name);
    setFormPhone(p.phone);
    setFormIdNumber(p.idNumber || '');
    setFormCapital(p.capitalShare);
    setFormNotes(p.notes || '');
    setShowAddPartnerModal(true);
  };

  // Save partner
  const handleSavePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('يرجى كتابة اسم الشريك ورقم الهاتف');
      return;
    }

    const capital = Number(formCapital) || 0;
    const currentTotalExcluding = editingPartner 
      ? totalCapital - (editingPartner.capitalShare || 0)
      : totalCapital;
    const newTotal = currentTotalExcluding + capital;

    if (editingPartner) {
      const updatedList = partners.map(p => {
        if (p.id === editingPartner.id) {
          return {
            ...p,
            name: formName.trim(),
            phone: formPhone.trim(),
            idNumber: formIdNumber.trim() || undefined,
            capitalShare: capital,
            sharePercentage: newTotal > 0 ? Number(((capital / newTotal) * 100).toFixed(2)) : 0,
            notes: formNotes.trim() || undefined
          };
        }
        // Recalculate other percentages
        return {
          ...p,
          sharePercentage: newTotal > 0 ? Number(((p.capitalShare / newTotal) * 100).toFixed(2)) : 0
        };
      });
      setPartners(updatedList);
    } else {
      const newPartner: Partner = {
        id: 'PRT-' + Math.random().toString(36).substring(2, 9),
        salonId: settings.salonId,
        name: formName.trim(),
        phone: formPhone.trim(),
        idNumber: formIdNumber.trim() || undefined,
        capitalShare: capital,
        sharePercentage: newTotal > 0 ? Number(((capital / newTotal) * 100).toFixed(2)) : 100,
        joinDate: new Date().toISOString().split('T')[0],
        notes: formNotes.trim() || undefined,
        isActive: true
      };

      const updatedList = [...partners, newPartner].map(p => ({
        ...p,
        sharePercentage: newTotal > 0 ? Number(((p.capitalShare / newTotal) * 100).toFixed(2)) : 0
      }));
      setPartners(updatedList);
    }

    setShowAddPartnerModal(false);
  };

  // Delete partner
  const handleDeletePartner = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الشريك؟')) {
      const remaining = partners.filter(p => p.id !== id);
      const newTotal = remaining.reduce((sum, p) => sum + (p.capitalShare || 0), 0);
      const updated = remaining.map(p => ({
        ...p,
        sharePercentage: newTotal > 0 ? Number(((p.capitalShare / newTotal) * 100).toFixed(2)) : 0
      }));
      setPartners(updated);
    }
  };

  // Open transaction modal
  const handleOpenTxModal = (partner: Partner, type: 'deposit' | 'withdrawal' | 'profit_share') => {
    setTxPartner(partner);
    setTxType(type);
    setTxAmount('');
    setTxDescription('');
    setShowTxModal(true);
  };

  // Submit Partner Transaction
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txPartner || !txAmount || Number(txAmount) <= 0) {
      alert('يرجى تحديد المبلغ بشكل صحيح');
      return;
    }

    const amount = Number(txAmount);
    const now = new Date().toISOString();
    const treasuryObj = settings.treasuries.find(t => t.id === txTreasury) || settings.treasuries[0];

    const newPTx: PartnerTransaction = {
      id: 'PTX-' + Math.random().toString(36).substring(2, 9),
      salonId: settings.salonId,
      partnerId: txPartner.id,
      partnerName: txPartner.name,
      type: txType,
      amount: amount,
      date: now,
      treasuryId: txTreasury,
      treasuryName: treasuryObj?.name || 'الخزينة الرئيسية',
      description: txDescription.trim() || (
        txType === 'withdrawal' ? `مسحوبات الشريك ${txPartner.name}` :
        txType === 'deposit' ? `إيداع رأس مال من الشريك ${txPartner.name}` :
        `توزيع أرباح للشريك ${txPartner.name}`
      ),
      createdBy: currentUser?.name || 'المالك'
    };

    setPartnerTransactions(prev => [newPTx, ...prev]);

    // Also update partner capital if deposit
    if (txType === 'deposit') {
      const updatedList = partners.map(p => {
        if (p.id === txPartner.id) {
          const newCap = (p.capitalShare || 0) + amount;
          return { ...p, capitalShare: newCap };
        }
        return p;
      });
      const newTotal = updatedList.reduce((s, p) => s + p.capitalShare, 0);
      setPartners(updatedList.map(p => ({
        ...p,
        sharePercentage: newTotal > 0 ? Number(((p.capitalShare / newTotal) * 100).toFixed(2)) : 0
      })));
    }

    // Reflect into general salon financial treasury transactions
    const salonTx: Transaction = {
      id: 'TRX-PTX-' + Math.random().toString(36).substring(2, 9),
      date: now,
      type: txType === 'deposit' ? 'in' : 'out',
      amount: amount,
      category: txType === 'deposit' ? 'إيداع رأس مال' : 'مسحوبات شركاء',
      description: newPTx.description,
      treasury: txTreasury,
      branchId: activeBranchId,
      createdBy: currentUser?.name || 'المالك',
      userId: currentUser?.id,
      userName: currentUser?.name || 'المالك'
    };
    setTransactions(prev => [...prev, salonTx]);

    setShowTxModal(false);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <Users className="text-amber-500" size={26} />
            <span>نظام إدارة الشركاء وحصص رأس المال</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">خاص بمالك الصالون 👑</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">متابعة حصص الشركاء في رأس المال، المسحوبات الدورية، وإيداعات رأس المال وتوزيع الأرباح</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddPartner}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95"
          >
            <Plus size={16} />
            <span>إضافة شريك جديد</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي رأس المال المسجل</div>
            <div className="text-xl font-black text-slate-800 mt-0.5">
              {totalCapital.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-blue-600 font-semibold mt-0.5">{partners.length} شركاء مسجلين</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي إيداعات رأس المال</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5">
              {totalDeposits.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-semibold mt-0.5">إضافات رأس مال جديدة</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <ArrowDownRight size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي مسحوبات الشركاء</div>
            <div className="text-xl font-black text-red-600 mt-0.5">
              {totalWithdrawals.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-semibold mt-0.5">مسحوبات دورية موثقة</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('partners')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'partners' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          سجل الشركاء وحصص الملكية ({partners.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'transactions' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          سجل المسحوبات والإيداعات ({partnerTransactions.length})
        </button>
      </div>

      {/* Tab 1: Partners List */}
      {activeTab === 'partners' && (
        <div className="flex flex-col gap-4">
          {/* Equity Breakdown Progress Bar */}
          {partners.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-2">
                <PieIcon size={16} className="text-amber-500" />
                <span>توزيع نسب الملكية في رأس المال</span>
              </h3>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                {partners.map((p, idx) => {
                  const colors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
                  const color = colors[idx % colors.length];
                  return (
                    <div 
                      key={p.id} 
                      style={{ width: `${p.sharePercentage}%` }} 
                      className={`${color} h-full transition-all`}
                      title={`${p.name}: ${p.sharePercentage}%`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100">
                {partners.map((p, idx) => {
                  const colors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <span className={`w-3 h-3 rounded-full ${color}`}></span>
                      <span>{p.name}: <strong>{p.sharePercentage}%</strong> ({p.capitalShare.toLocaleString()} {settings.currency})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {partners.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <Users size={48} className="text-slate-200 stroke-1" />
                <p className="text-sm font-semibold">لم يتم تسجيل أي شركاء بعد</p>
                <button
                  onClick={handleOpenAddPartner}
                  className="mt-1 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold rounded-xl transition-all"
                >
                  + إضافة الشريك الأول
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                    <tr>
                      <th className="p-3.5">اسم الشريك</th>
                      <th className="p-3.5">رقم الهاتف</th>
                      <th className="p-3.5">حصة رأس المال</th>
                      <th className="p-3.5">نسبة الملكية</th>
                      <th className="p-3.5">تاريخ الانضمام</th>
                      <th className="p-3.5 text-center">العمليات السريعة</th>
                      <th className="p-3.5 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {partners.map(p => {
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-bold text-slate-800">
                            <div>{p.name}</div>
                            {p.idNumber && <div className="text-[10px] text-slate-400 font-normal">هوية: {p.idNumber}</div>}
                          </td>
                          <td className="p-3.5 text-slate-600 font-mono" dir="ltr">{p.phone}</td>
                          <td className="p-3.5 font-extrabold text-slate-800">
                            {p.capitalShare.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-black border border-amber-100">
                              {p.sharePercentage}%
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-500">{p.joinDate}</td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenTxModal(p, 'withdrawal')}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                                title="تسجيل مسحوب للشريك"
                              >
                                <ArrowDownRight size={13} />
                                <span>سحب</span>
                              </button>
                              <button
                                onClick={() => handleOpenTxModal(p, 'deposit')}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                                title="إيداع رأس مال إضافي"
                              >
                                <ArrowUpRight size={13} />
                                <span>إيداع رأس مال</span>
                              </button>
                            </div>
                          </td>
                          <td className="p-3.5 text-left">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditPartner(p)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                                title="تعديل بيانات الشريك"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeletePartner(p.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                                title="حذف الشريك"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Transactions Log */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {partnerTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <FileText size={48} className="text-slate-200 stroke-1" />
              <p className="text-sm font-semibold">لا توجد حركات مسحوبات أو إيداعات مسجلة للشركاء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="p-3.5">التاريخ والوقت</th>
                    <th className="p-3.5">اسم الشريك</th>
                    <th className="p-3.5">نوع العملية</th>
                    <th className="p-3.5">المبلغ</th>
                    <th className="p-3.5">الخزينة المتأثرة</th>
                    <th className="p-3.5">البيان / الملاحظات</th>
                    <th className="p-3.5">المسجل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">{new Date(tx.date).toLocaleString('ar-EG')}</td>
                      <td className="p-3.5 font-bold text-slate-800">{tx.partnerName}</td>
                      <td className="p-3.5">
                        {tx.type === 'withdrawal' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold border border-red-100 flex items-center gap-1 w-max">
                            <ArrowDownRight size={13} />
                            <span>مسحوب شريك</span>
                          </span>
                        ) : tx.type === 'deposit' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 flex items-center gap-1 w-max">
                            <ArrowUpRight size={13} />
                            <span>إيداع رأس مال</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-100 flex items-center gap-1 w-max">
                            <DollarSign size={13} />
                            <span>توزيع أرباح</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-black text-slate-800">
                        {tx.amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                      </td>
                      <td className="p-3.5 text-slate-600">{tx.treasuryName || 'الخزينة الرئيسية'}</td>
                      <td className="p-3.5 text-slate-600">{tx.description}</td>
                      <td className="p-3.5 text-slate-400 text-[11px]">{tx.createdBy || 'المالك'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add/Edit Partner */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-amber-600" />
                <span>{editingPartner ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد'}</span>
              </h3>
              <button 
                onClick={() => setShowAddPartnerModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الشريك الكامل *</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="مثال: عبدالله المنصور"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف *</label>
                  <input 
                    type="tel" 
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-left font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهوية / الإقامة</label>
                  <input 
                    type="text" 
                    value={formIdNumber}
                    onChange={e => setFormIdNumber(e.target.value)}
                    placeholder="اختياري"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حصة رأس المال ({settings.currency}) *</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  value={formCapital}
                  onChange={e => setFormCapital(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">يتم احتساب النسبة المئوية تلقائياً بناءً على إجمالي رأس مال كل الشركاء</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea 
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="شروط خاصة، تفاصيل الاتفاق..."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition-colors shadow-xs"
                >
                  {editingPartner ? 'حفظ التعديلات' : 'تأكيد إضافة الشريك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Partner Transaction (Withdrawal / Deposit) */}
      {showTxModal && txPartner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                {txType === 'withdrawal' ? (
                  <>
                    <ArrowDownRight size={20} className="text-red-600" />
                    <span>تسجيل مسحوبات للشريك: {txPartner.name}</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={20} className="text-emerald-600" />
                    <span>إيداع رأس مال إضافي: {txPartner.name}</span>
                  </>
                )}
              </h3>
              <button 
                onClick={() => setShowTxModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الحركة</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTxType('withdrawal')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      txType === 'withdrawal' 
                        ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-500/20' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    مسحوب شريك
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('deposit')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      txType === 'deposit' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    إيداع رأس مال
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('profit_share')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      txType === 'profit_share' 
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-500/20' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    توزيع أرباح
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ ({settings.currency}) *</label>
                <input 
                  type="number" 
                  min="0.01"
                  step="any"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الخزينة المتأثرة بالسحب/الإيداع *</label>
                <select
                  value={txTreasury}
                  onChange={e => setTxTreasury(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  {settings.treasuries.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.isMain ? '(الرئيسية)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان / ملاحظات العملية</label>
                <input 
                  type="text"
                  value={txDescription}
                  onChange={e => setTxDescription(e.target.value)}
                  placeholder="مثال: مسحوبات أرباح شهر أغسطس 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 text-white font-black rounded-xl text-xs transition-colors shadow-xs ${
                    txType === 'withdrawal' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  تأكيد وقيد العملية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
