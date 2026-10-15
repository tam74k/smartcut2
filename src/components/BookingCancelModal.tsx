import React, { useState } from 'react';
import { Booking, AppSettings, AppUser } from '../types';
import { AlertTriangle, CheckCircle, Clock, DollarSign, X, RotateCcw, AlertCircle, Building2, User } from 'lucide-react';

interface BookingCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  settings: AppSettings;
  shiftData?: { isOpen: boolean; date: string; initialCash?: number; shiftId?: string; id?: string };
  currentUser?: AppUser | null;
  onConfirmCancel: (booking: Booking, refundDeposit: boolean, treasuryId?: string) => Promise<void>;
}

export const BookingCancelModal: React.FC<BookingCancelModalProps> = ({
  isOpen,
  onClose,
  booking,
  settings,
  shiftData,
  currentUser,
  onConfirmCancel
}) => {
  const [refundDeposit, setRefundDeposit] = useState(false);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>(() => {
    return settings.treasuries?.find(t => t.isMain)?.id || settings.treasuries?.[0]?.id || 'main';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !booking) return null;

  // 1. حساب العربون المسدد
  const paidDeposit = booking.paidDeposit !== undefined && booking.paidDeposit > 0
    ? booking.paidDeposit
    : (booking.advancePayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const hasDeposit = paidDeposit > 0;
  const isAlreadyRefunded = Boolean(booking.isDepositRefunded);

  // 2. حساب المهلة والأهلية
  const allowedDays = Number(settings.depositRefundAllowedDays ?? settings.deposit_refund_allowed_days ?? 0);
  const createdDate = booking.createdAt ? new Date(booking.createdAt) : new Date(booking.date);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - createdDate.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const allowedUntilMs = createdDate.getTime() + (allowedDays * 24 * 60 * 60 * 1000);
  const allowedUntil = new Date(allowedUntilMs);

  // الحالات
  const isEligible = hasDeposit && !isAlreadyRefunded && allowedDays > 0 && diffMs <= (allowedDays * 24 * 60 * 60 * 1000);
  const isExpired = hasDeposit && !isAlreadyRefunded && (allowedDays === 0 || diffMs > (allowedDays * 24 * 60 * 60 * 1000));

  const formattedCreated = booking.createdAt
    ? new Date(booking.createdAt).toLocaleString('ar-SA')
    : (booking.date || 'غير محدد');

  const formattedAllowedUntil = allowedUntil.toLocaleString('ar-SA');
  const bookingCodeOrId = booking.bookingCode || booking.id;
  const scheduledDate = `${booking.date}${booking.time ? ' ' + booking.time : ''}`;
  const creatorName = booking.createdBy || 'غير محدد';
  const cancellerName = currentUser?.name || 'مستخدم النظام';

  // صياغة وصف المصروف الدقيق المعتمد
  const expenseDescription = `إلغاء الحجز رقم [${bookingCodeOrId}] للعميلة / [${booking.clientName}] - تاريخ الحجز: [${scheduledDate}] - تاريخ الإنشاء: [${formattedCreated}] - منشئ الحجز: [${creatorName}] - منفذ الإلغاء: [${cancellerName}]`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (refundDeposit && !shiftData?.isOpen) {
      alert('تنبيه: الوردية مغلقة حالياً!\nلا يمكن استرجاع العربون وقيده ضمن مصروفات الوردية الحالية قبل فتح الوردية.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmCancel(booking, isEligible && refundDeposit, selectedTreasuryId);
      onClose();
    } catch (err) {
      console.error('Error during cancellation:', err);
      alert('حدث خطأ أثناء معالجة إلغاء الحجز.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-y-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shadow-xs ${
              isEligible ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'
            }`}>
              <RotateCcw size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>إلغاء الحجز</span>
                <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-lg font-bold">
                  #{bookingCodeOrId}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                فحص سياسة الاسترجاع وتحديد الأثر المالي قبل إلغاء الحجز
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Booking Snapshot */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">العميل:</span>
            <span className="font-bold text-slate-800">{booking.clientName} ({booking.phone})</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">موعد الحجز:</span>
            <span className="font-bold text-slate-800">{scheduledDate}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">تاريخ إنشاء الحجز:</span>
            <span className="font-bold text-slate-800 font-mono">{formattedCreated}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">منشئ الحجز:</span>
            <span className="font-bold text-slate-800">{creatorName}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
            <span className="text-slate-700 font-bold">العربون المسدد (Deposit):</span>
            <span className={`text-sm font-black font-mono ${hasDeposit ? 'text-primary' : 'text-slate-500'}`}>
              {paidDeposit.toLocaleString()} {settings.currency}
            </span>
          </div>
        </div>

        {/* Policy Analysis & Scenarios */}
        {/* Scenario 0: No Deposit */}
        {!hasDeposit && (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-start gap-3 mb-4">
            <AlertCircle size={20} className="text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">لا يوجد عربون مسدد لهذا الحجز</p>
              <p className="text-slate-500 text-[11px] mt-1">
                سيتم إلغاء الحجز كإجراء إداري بتغيير حالته إلى "ملغي" دون أي أثر مالي أو حركات في الصندوق.
              </p>
            </div>
          </div>
        )}

        {/* Scenario 1: Already Refunded */}
        {isAlreadyRefunded && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 mb-4">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">تم استرجاع العربون مسبقاً (حماية منع التكرار)</p>
              <p className="text-amber-700 text-[11px] mt-1">
                تم استرجاع عربون هذا الحجز بقيمة {booking.depositRefundAmount || paidDeposit} {settings.currency} بتاريخ {booking.depositRefundedAt ? new Date(booking.depositRefundedAt).toLocaleString('ar-SA') : 'سابق'} بواسطة ({booking.depositRefundedBy || 'النظام'}).
              </p>
              <p className="text-amber-700 text-[11px] mt-0.5 font-bold">
                لا يمكن إعادة استرجاع المبلغ مرة أخرى لتفادي التكرار المالي.
              </p>
            </div>
          </div>
        )}

        {/* Scenario 2: Case A - Expired or Policy 0 */}
        {isExpired && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2 mb-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-rose-800 text-sm">
                  مهلة استرجاع العربون المحددة بالنظام قد انتهت
                </p>
                <p className="text-rose-700 text-[11px] mt-1">
                  {allowedDays === 0
                    ? 'سياسة النظام الحالية محددة بـ (0 أيام): لا يُسمح نهائياً باسترجاع العربون من اللحظة الأولى لإنشاء الحجز (No Refund Policy).'
                    : `المهلة المحددة في إعدادات النظام هي (${allowedDays} يوم/أيام) من تاريخ إنشاء الحجز. وقد انتهت المهلة المسموحة في: ${formattedAllowedUntil}.`}
                </p>
              </div>
            </div>

            <div className="bg-rose-100/60 rounded-xl p-3 text-[11px] text-rose-800 border border-rose-200/60">
              <div className="font-bold mb-1">الأثر المحاسبي والإداري:</div>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                <li>سيتم تأكيد الإلغاء كإجراء إداري فقط: تغيير حالة الحجز إلى "ملغي" (cancelled).</li>
                <li><strong>لا ينشأ أي أثر مالي:</strong> لا يتم استرجاع أي مبالغ، ولا يُنشأ أي سجل في جدول المصروفات.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Scenario 3: Case B - Eligible within policy */}
        {isEligible && (
          <div className="space-y-4 mb-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
              <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-emerald-800 text-sm">
                  الحجز مؤهل لاسترجاع العربون (ضمن المهلة النظامية)
                </p>
                <p className="text-emerald-700 text-[11px] mt-1">
                  المهلة المسموحة بالصالون: ({allowedDays} يوم/أيام) من تاريخ الإنشاء. تنتهي الصلاحية في: <span className="font-bold font-mono">{formattedAllowedUntil}</span>.
                </p>
              </div>
            </div>

            {/* Checkbox option for Refund */}
            <div className="bg-white rounded-2xl border-2 border-primary/20 hover:border-primary/50 transition-all p-4 shadow-xs">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={refundDeposit}
                  onChange={(e) => setRefundDeposit(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded-md text-primary focus:ring-primary border-slate-300 accent-primary cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 text-sm">
                      استرجاع مبلغ العربون وإدراجه ضمن المصروفات
                    </span>
                    <span className="font-black font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-xs">
                      {paidDeposit.toLocaleString()} {settings.currency}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    عند التفعيل، سيتم تلقائياً إصدار سند مصروفات ببند <strong>"مسترجع حجوزات"</strong> وربطه بالوردية الحالية والخصم من رصيد الخزينة المحددة.
                  </p>
                </div>
              </label>

              {/* Conditional Treasury Selection & Details */}
              {refundDeposit && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      الخزينة المنصرف منها مبلغ الاسترجاع:
                    </label>
                    <select
                      value={selectedTreasuryId}
                      onChange={(e) => setSelectedTreasuryId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-primary outline-none"
                    >
                      {settings.treasuries?.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.name} {tr.isMain ? '(الرئيسية)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-[11px] space-y-1">
                    <div className="text-slate-500 font-bold">معاينة تفاصيل سند المصروفات الآلي:</div>
                    <div className="text-slate-700">
                      <strong>البند:</strong> مسترجع حجوزات
                    </div>
                    <div className="text-slate-700">
                      <strong>الوردية:</strong> {shiftData?.isOpen ? `الوردية المفتوحة (${shiftData.date})` : 'الوردية مغلقة'}
                    </div>
                    <div className="text-slate-700 text-[10px] bg-white p-2 rounded-lg border border-slate-200 leading-relaxed font-mono">
                      {expenseDescription}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            تراجع
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md flex items-center gap-2 transition-all cursor-pointer ${
              refundDeposit && isEligible
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
            }`}
          >
            {isSubmitting ? (
              <span>جاري التنفيذ...</span>
            ) : refundDeposit && isEligible ? (
              <>
                <RotateCcw size={15} />
                <span>تأكيد الإلغاء مع استرجاع العربون</span>
              </>
            ) : (
              <>
                <X size={15} />
                <span>تأكيد الإلغاء الإداري</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
