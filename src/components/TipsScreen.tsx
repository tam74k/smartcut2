import React, { useState, useMemo } from 'react';
import { AppSettings, TipRecord, Employee, Transaction } from '../types';
import { 
  DollarSign, CheckCircle2, Clock, Wallet, User, Calendar, 
  ArrowDownRight, Check, FileText, Filter, Search, UserCheck
} from 'lucide-react';
import { DB } from '../services/db';

interface TipsScreenProps {
  settings: AppSettings;
  tips: TipRecord[];
  setTips: (updater: TipRecord[] | ((prev: TipRecord[]) => TipRecord[])) => void;
  employees: Employee[];
  setTransactions: (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  activeBranchId?: string;
  currentUser?: any;
}

export function TipsScreen({
  settings,
  tips = [],
  setTips,
  employees = [],
  setTransactions,
  activeBranchId,
  currentUser
}: TipsScreenProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending_payout' | 'paid_out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Payout Modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutTargetTip, setPayoutTargetTip] = useState<TipRecord | null>(null);
  const [payoutTreasury, setPayoutTreasury] = useState<string>(settings.treasuries[0]?.id || 'cash');
  const [payoutNotes, setPayoutNotes] = useState('');

  // Stats
  const totalTips = useMemo(() => {
    return tips.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [tips]);

  const pendingTips = useMemo(() => {
    return tips
      .filter(t => t.status === 'pending_payout')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [tips]);

  const paidOutTips = useMemo(() => {
    return tips
      .filter(t => t.status === 'paid_out')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [tips]);

  // Filtered tips
  const filteredTips = useMemo(() => {
    return tips.filter(t => {
      if (selectedEmployee !== 'all' && t.employeeId !== selectedEmployee) return false;
      if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const empMatch = t.employeeName?.toLowerCase().includes(q);
        const invMatch = t.invoiceId?.toLowerCase().includes(q);
        const clientMatch = t.clientName?.toLowerCase().includes(q);
        if (!empMatch && !invMatch && !clientMatch) return false;
      }
      return true;
    });
  }, [tips, selectedEmployee, selectedStatus, searchQuery]);

  // Handle single tip payout
  const handleOpenPayout = (tip: TipRecord) => {
    setPayoutTargetTip(tip);
    setPayoutTreasury(settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || 'cash');
    setPayoutNotes(`صرف إكرامية / بقشيش للموظف ${tip.employeeName}`);
    setShowPayoutModal(true);
  };

  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTargetTip) return;

    const now = new Date().toISOString();
    let updatedTipRecord: TipRecord | null = null;
    const updated = tips.map(t => {
      if (t.id === payoutTargetTip.id) {
        updatedTipRecord = {
          ...t,
          status: 'paid_out' as const,
          paidOutAt: now,
          paidOutTreasuryId: payoutTreasury,
          paidOutBy: currentUser?.name || 'المحاسب',
          notes: payoutNotes.trim() || undefined
        };
        return updatedTipRecord;
      }
      return t;
    });
    setTips(updated);

    if (updatedTipRecord) {
      await DB.saveTip(updatedTipRecord);
    }

    // Create transaction
    const newTrx: Transaction = {
      id: 'TRX-TIP-' + Math.random().toString(36).substring(2, 9),
      date: now,
      type: 'out',
      amount: payoutTargetTip.amount,
      category: 'صرف بقشيش موظفين',
      description: `صرف بقشيش فاتورة (${payoutTargetTip.invoiceId}) للموظف ${payoutTargetTip.employeeName}`,
      treasury: payoutTreasury,
      branchId: activeBranchId,
      createdBy: currentUser?.name || 'الكاشير',
      userId: currentUser?.id,
      userName: currentUser?.name || 'الكاشير'
    };
    setTransactions(prev => [...prev, newTrx]);
    await DB.saveTransactions([newTrx]);

    setShowPayoutModal(false);
  };


  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <DollarSign className="text-emerald-600" size={26} />
            <span>نظام وسجل البقشيش والإكراميات (Tips Management)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">متابعة مبالغ البقشيش المحصلة إلكترونياً وتوزيعها وصرفها للموظفين مع تقارير مالية دقيقة</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي البقشيش المحصل</div>
            <div className="text-xl font-black text-slate-800 mt-0.5">
              {totalTips.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-semibold mt-0.5">{tips.length} عمليات بقشيش</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">بقشيش معلق (بانتظار الصرف)</div>
            <div className="text-xl font-black text-amber-600 mt-0.5">
              {pendingTips.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-0.5">مستحق الصرف للموظفين</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي البقشيش المصروف</div>
            <div className="text-xl font-black text-emerald-600 mt-0.5">
              {paidOutTips.toLocaleString()} <span className="text-xs font-normal text-slate-500">{settings.currency}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-semibold mt-0.5">تم تسليمه للموظفين نقدياً</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالموظف أو رقم الفاتورة..."
              className="pr-9 pl-3 py-2 border border-slate-200 rounded-xl text-xs w-56 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="all">جميع الموظفين ({employees.length})</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="all">كافة الحالات</option>
            <option value="pending_payout">معلق (بانتظار الصرف)</option>
            <option value="paid_out">تم الصرف</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-bold">
          عدد السجلات المعروضة: {filteredTips.length}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredTips.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <DollarSign size={48} className="text-slate-200 stroke-1" />
            <p className="text-sm font-semibold">لا توجد سجلات بقشيش مطابقة لمعايير البحث</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                <tr>
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5">الموظف المستحق</th>
                  <th className="p-3.5">العميل</th>
                  <th className="p-3.5">رقم الفاتورة</th>
                  <th className="p-3.5">طريقة دفع الفاتورة</th>
                  <th className="p-3.5">مبلغ البقشيش</th>
                  <th className="p-3.5 text-center">حالة الصرف</th>
                  <th className="p-3.5 text-left">إجراء الصرف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTips.map(tip => (
                  <tr key={tip.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">{new Date(tip.date).toLocaleString('ar-EG')}</td>
                    <td className="p-3.5 font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        {tip.employeeName?.charAt(0) || 'م'}
                      </div>
                      <span>{tip.employeeName}</span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700">{tip.clientName || 'عميل نقدي'}</td>
                    <td className="p-3.5 font-mono text-slate-600">{tip.invoiceId}</td>
                    <td className="p-3.5 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {tip.paymentMethod === 'card' ? 'شبكة / بطاقة' : tip.paymentMethod === 'transfer' ? 'تحويل بنكي' : tip.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-emerald-600 text-sm">
                      {tip.amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                    </td>

                    <td className="p-3.5 text-center">
                      {tip.status === 'paid_out' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-100 inline-flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>تم الصرف</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-100 inline-flex items-center gap-1">
                          <Clock size={12} />
                          <span>معلق بالخزينة</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-left">
                      {tip.status === 'pending_payout' ? (
                        <button
                          onClick={() => handleOpenPayout(tip)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95"
                        >
                          <Wallet size={13} />
                          <span>صرف نقدي للموظف</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">
                          صُرف في {tip.paidOutAt ? new Date(tip.paidOutAt).toLocaleDateString('ar-EG') : '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Modal */}
      {showPayoutModal && payoutTargetTip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                <Wallet size={20} className="text-emerald-600" />
                <span>سند صرف بقشيش نقدي</span>
              </h3>
              <button 
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-red-500 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayout} className="p-5 flex flex-col gap-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-800 font-bold">الموظف المستحق:</div>
                  <div className="text-base font-black text-emerald-950 mt-0.5">{payoutTargetTip.employeeName}</div>
                  <div className="text-[11px] text-emerald-700 mt-1 font-mono">فاتورة رقم: {payoutTargetTip.invoiceId}</div>
                </div>
                <div className="text-left">
                  <div className="text-xs text-emerald-800 font-bold">مبلغ الإكرامية:</div>
                  <div className="text-2xl font-black text-emerald-700 mt-0.5">
                    {payoutTargetTip.amount} <span className="text-xs font-normal text-emerald-800">{settings.currency}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الخزينة المخصوم منها المبلغ نقداً *</label>
                <select
                  value={payoutTreasury}
                  onChange={e => setPayoutTreasury(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {settings.treasuries.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.isMain ? '(الرئيسية)' : ''}</option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">يتم قيد حركة صرف نقدية تلقائياً على الخزينة المختارة.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات السند</label>
                <input 
                  type="text"
                  value={payoutNotes}
                  onChange={e => setPayoutNotes(e.target.value)}
                  placeholder="ملاحظات..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-colors shadow-xs"
                >
                  تأكيد صرف البقشيش
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
