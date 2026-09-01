import React, { useState } from 'react';
import { AppSettings, FingerprintLog, Employee } from '../types';
import { Fingerprint, Clock, RefreshCw, CheckCircle2, User, Search, Filter } from 'lucide-react';

interface FingerprintLogsScreenProps {
  settings: AppSettings;
  fingerprintLogs: FingerprintLog[];
  setFingerprintLogs: (updater: FingerprintLog[] | ((prev: FingerprintLog[]) => FingerprintLog[])) => void;
  employees: Employee[];
}

export function FingerprintLogsScreen({
  settings,
  fingerprintLogs = [],
  setFingerprintLogs,
  employees = []
}: FingerprintLogsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'check_in' | 'check_out'>('all');

  const filteredLogs = fingerprintLogs.filter(log => {
    if (selectedType !== 'all' && log.type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const empMatch = log.employeeName?.toLowerCase().includes(q);
      const codeMatch = log.fingerprintCode?.toLowerCase().includes(q);
      if (!empMatch && !codeMatch) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <Fingerprint className="text-blue-600" size={26} />
            <span>سجل حركات وسحوبات جهاز البصمة (Fingerprint Logs)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">عرض السجلات الخام الملتقطة من أجهزة البصمة البيومترية وحركات الحضور والانصراف</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالموظف أو كود البصمة..."
              className="pr-9 pl-3 py-2 border border-slate-200 rounded-xl text-xs w-60 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">كافة الحركات (حضور وانصراف)</option>
            <option value="check_in">حضور (Check-In)</option>
            <option value="check_out">انصراف (Check-Out)</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-bold">
          إجمالي السجلات: {filteredLogs.length}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <Fingerprint size={48} className="text-slate-200 stroke-1" />
            <p className="text-sm font-semibold">لا توجد حركات بصمة مسجلة حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                <tr>
                  <th className="p-3.5">وقت وتاريخ البصمة</th>
                  <th className="p-3.5">اسم الموظف</th>
                  <th className="p-3.5">كود البصمة</th>
                  <th className="p-3.5">نوع الحركة</th>
                  <th className="p-3.5">عنوان الجهاز (IP)</th>
                  <th className="p-3.5 text-center">حالة المزامنة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {log.employeeName?.charAt(0) || 'م'}
                      </div>
                      <span>{log.employeeName || 'غير معرف'}</span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-600">{log.fingerprintCode}</td>
                    <td className="p-3.5">
                      {log.type === 'check_in' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-100">
                          حضور (Check-In)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-100">
                          انصراف (Check-Out)
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500 text-[11px]">{log.deviceIp || '192.168.1.200'}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        <span>متزامن</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
