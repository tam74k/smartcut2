import React from 'react';
import { AppSettings, Employee } from '../types';

export interface SalarySlipSummary {
  employee: Employee;
  periodLabel: string;
  monthlySalary: number;
  dailyRate: number;
  earnedBaseSalary?: number;
  presentDays: number;
  absenceDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  totalWorkRevenue: number;
  commissionsEarned: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  delayMinutes: number;
  delayDeduction: number;
  absenceDeduction: number;
  permissionDeduction: number;
  advancesDeduction: number;
  bonusesAdded: number;
  specialPenalties: number;
  netPayable: number;
}

export function ThermalSalarySlip({
  settings,
  summary
}: {
  settings: AppSettings;
  summary: SalarySlipSummary;
}) {
  const { employee } = summary;

  return (
    <div id="print-salary-slip" className="w-[80mm] max-w-[80mm] bg-white p-3 text-slate-900 text-xs font-sans">
      {/* Header */}
      <div className="text-center pb-2 border-b border-dashed border-slate-300">
        <h2 className="text-sm font-black tracking-tight">{settings.salonName || 'SMART CUT'}</h2>
        <p className="text-[10px] text-slate-600 font-bold mt-0.5">قسيمة تفصيل الراتب والاستحقاقات</p>
        <p className="text-[9px] text-slate-400 font-mono mt-0.5">الفترة: {summary.periodLabel}</p>
      </div>

      {/* Employee Info */}
      <div className="my-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] space-y-1">
        <div className="flex justify-between font-bold">
          <span className="text-slate-600">الموظف:</span>
          <span className="text-slate-900 font-black">{employee.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">كود البصمة:</span>
          <span className="font-mono font-bold text-indigo-700">#{employee.fingerprintCode || employee.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">المسمى الوظيفي:</span>
          <span>{employee.role}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">نوع الراتب:</span>
          <span className="font-bold">
            {employee.salaryType === 'commission_only' 
              ? 'بالعمولة فقط' 
              : employee.salaryType === 'salary_plus_commission' 
              ? 'راتب + عمولة' 
              : 'راتب ثابت'}
          </span>
        </div>
      </div>

      {/* Attendance & Days Summary */}
      <div className="space-y-1 text-[10px] border-b border-dashed border-slate-200 pb-2 mb-2">
        <div className="flex justify-between text-slate-600">
          <span>الراتب الأساسي:</span>
          <span className="font-mono font-bold">{summary.monthlySalary.toFixed(2)} {settings.currency}</span>
        </div>
        {summary.dailyRate > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>معدل اليومية:</span>
            <span className="font-mono">{summary.dailyRate.toFixed(2)} {settings.currency}</span>
          </div>
        )}
        <div className="flex justify-between text-slate-600">
          <span>أيام الحضور الفعلي:</span>
          <span className="font-bold text-emerald-700">{summary.presentDays} يوم</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>أيام الإجازات / العطلات:</span>
          <span>{summary.paidLeaveDays + summary.weeklyOffDays} يوم</span>
        </div>
        {summary.absenceDays > 0 && (
          <div className="flex justify-between text-rose-600 font-bold">
            <span>أيام الغياب:</span>
            <span>{summary.absenceDays} يوم</span>
          </div>
        )}
      </div>

      {/* Earnings (الإضافات والمستحقات) */}
      <div className="space-y-1 text-[10px] border-b border-dashed border-slate-200 pb-2 mb-2">
        <p className="font-black text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
          ➕ الاستحقاقات والإضافات:
        </p>
        
        {summary.monthlySalary > 0 && (
          <div className="flex justify-between">
            <span>الراتب المكتسب للفترة:</span>
            <span className="font-mono font-bold">
              {(summary.earnedBaseSalary !== undefined ? summary.earnedBaseSalary : ((summary.presentDays + summary.paidLeaveDays + summary.weeklyOffDays) * summary.dailyRate)).toFixed(2)} {settings.currency}
            </span>
          </div>
        )}

        {summary.totalWorkRevenue > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>إجمالي شغل الموظف (المبيعات):</span>
            <span className="font-mono">{summary.totalWorkRevenue.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {summary.commissionsEarned > 0 && (
          <div className="flex justify-between text-emerald-700 font-bold">
            <span>العمولات المستحقة ({employee.commissionRate}%):</span>
            <span className="font-mono">+{summary.commissionsEarned.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {summary.overtimeAmount > 0 && (
          <div className="flex justify-between text-blue-700 font-bold">
            <span>أوفرتايم ({summary.overtimeMinutes} دقيقة):</span>
            <span className="font-mono">+{summary.overtimeAmount.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {summary.bonusesAdded > 0 && (
          <div className="flex justify-between text-emerald-700 font-bold">
            <span>المكافآت والحوافز:</span>
            <span className="font-mono">+{summary.bonusesAdded.toFixed(2)} {settings.currency}</span>
          </div>
        )}
      </div>

      {/* Deductions (الخصومات والاستقطاعات) */}
      <div className="space-y-1 text-[10px] border-b border-dashed border-slate-200 pb-2 mb-2">
        <p className="font-black text-[10px] text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded">
          ➖ الاستقطاعات والخصومات:
        </p>

        {summary.absenceDeduction > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>خصم الغياب ({summary.absenceDays} يوم):</span>
            <span className="font-mono font-bold">-{summary.absenceDeduction.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {summary.delayDeduction > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>خصم التأخيرات ({summary.delayMinutes} دقيقة):</span>
            <span className="font-mono font-bold">-{summary.delayDeduction.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {summary.permissionDeduction > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>خصم تجاوز الاستئذان:</span>
            <span className="font-mono font-bold">-{summary.permissionDeduction.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {summary.advancesDeduction > 0 && (
          <div className="flex justify-between text-amber-700 font-bold">
            <span>السلف المسحوبة:</span>
            <span className="font-mono">-{summary.advancesDeduction.toFixed(2)} {settings.currency}</span>
          </div>
        )}

        {summary.specialPenalties > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>جزاءات وخصومات أخرى:</span>
            <span className="font-mono font-bold">-{summary.specialPenalties.toFixed(2)} {settings.currency}</span>
          </div>
        )}
      </div>

      {/* Final Net Payable */}
      <div className="p-2.5 bg-slate-900 text-white rounded-xl text-center space-y-0.5 my-3 shadow-sm">
        <p className="text-[10px] font-bold text-slate-300">صافي المستحق النهائي للصرف</p>
        <h3 className="text-base font-black tracking-tight font-mono text-emerald-400">
          {summary.netPayable.toFixed(2)} {settings.currency}
        </h3>
      </div>

      {/* Signatures */}
      <div className="pt-3 border-t border-dashed border-slate-300 grid grid-cols-2 gap-2 text-[9px] text-center text-slate-500">
        <div className="space-y-4">
          <p className="font-bold text-slate-700">توقيع المستلم (الموظف)</p>
          <div className="border-b border-slate-300 w-20 mx-auto"></div>
        </div>
        <div className="space-y-4">
          <p className="font-bold text-slate-700">اعتماد الإدارة / المحاسب</p>
          <div className="border-b border-slate-300 w-20 mx-auto"></div>
        </div>
      </div>

      <div className="mt-3 text-center text-[8px] text-slate-400">
        <p>تم الإصدار: {new Date().toLocaleString('ar-SA')}</p>
      </div>
    </div>
  );
}
