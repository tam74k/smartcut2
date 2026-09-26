import React, { useState, useMemo } from 'react';
import { 
  Fingerprint, Upload, Download, CheckCircle2, AlertTriangle, 
  X, AlertCircle, RefreshCw, Clock, ArrowRight, UserCheck, UserX,
  FileSpreadsheet, ShieldCheck, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import { AppSettings, FingerprintLog, Employee } from '../types';
import { readExcelFile, downloadFingerprintLogsTemplate, parseExcelDate } from '../utils/excelHelper';
import { DB } from '../services/db';

interface FingerprintImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  employees: Employee[];
  existingLogs?: FingerprintLog[];
  onImportComplete: (newLogs: FingerprintLog[]) => void;
  activeBranchId?: string;
}

interface ParsedFingerprintCandidate {
  fingerprintCode: string;
  timestamp: string;
  dateStr: string;
  timeStr: string;
  type: 'check_in' | 'check_out';
  deviceName: string;
  notes: string;
  matchedEmployee?: Employee;
  isExisting: boolean;
  validationErrors: string[];
}

export function FingerprintImportModal({
  isOpen,
  onClose,
  settings,
  employees = [],
  existingLogs = [],
  onImportComplete,
  activeBranchId
}: FingerprintImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [readError, setReadError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<ParsedFingerprintCandidate[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setReadError('يرجى اختيار ملف إكسل بصيغة .xlsx أو .xls حصراً.');
      return;
    }

    setIsReading(true);
    setReadError(null);
    setFileName(selectedFile.name);
    setFile(selectedFile);

    try {
      const rows = await readExcelFile(selectedFile);
      if (!rows || rows.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على صفوف حركات بصمة.');
      }

      const parsed: ParsedFingerprintCandidate[] = [];

      rows.forEach((row: any, idx: number) => {
        // 1. كود البصمة
        const fpCodeRaw = String(
          row['كود البصمة'] || 
          row['كود الموظف'] || 
          row['رقم البصمة'] || 
          row['User ID'] || 
          row['UserId'] || 
          row['EnrollNumber'] || 
          row['Fingerprint Code'] || 
          row['FP Code'] || ''
        ).trim();

        // 2. الوقت والتاريخ
        const rawTime = row['الوقت والتاريخ (YYYY-MM-DD HH:mm:ss)'] || 
                        row['الوقت والتاريخ'] || 
                        row['الوقت'] || 
                        row['التاريخ والوقت'] || 
                        row['Timestamp'] || 
                        row['DateTime'] || 
                        row['Time'] || 
                        row['Date'];

        let isoTimestamp = '';
        try {
          isoTimestamp = parseExcelDate(rawTime);
        } catch {
          isoTimestamp = new Date().toISOString();
        }

        const dateObj = new Date(isoTimestamp);
        const dateStr = !isNaN(dateObj.getTime()) ? isoTimestamp.split('T')[0] : new Date().toISOString().split('T')[0];
        const timeStr = !isNaN(dateObj.getTime()) 
          ? isoTimestamp.split('T')[1]?.slice(0, 8) || '00:00:00'
          : '00:00:00';

        // 3. الاتجاه (دخول / خروج)
        const directionRaw = String(
          row['الاتجاه (دخول / خروج)'] || 
          row['الاتجاه'] || 
          row['نوع الحركة'] || 
          row['الحركة'] || 
          row['Direction'] || 
          row['Type'] || 
          row['InOut'] || 
          'دخول'
        ).trim().toLowerCase();

        let type: 'check_in' | 'check_out' = 'check_in';
        if (
          directionRaw.includes('خروج') || 
          directionRaw.includes('انصراف') || 
          directionRaw.includes('out') || 
          directionRaw === '1' || 
          directionRaw === '2' && (directionRaw.includes('خروج'))
        ) {
          type = 'check_out';
        } else if (
          directionRaw.includes('دخول') || 
          directionRaw.includes('حضور') || 
          directionRaw.includes('in') || 
          directionRaw === '0'
        ) {
          type = 'check_in';
        }

        const deviceName = String(
          row['اسم الجهاز أو الموقع'] || 
          row['اسم الجهاز'] || 
          row['الجهاز'] || 
          row['Device'] || 
          'جهاز البصمة'
        ).trim();

        const notes = String(
          row['ملاحظات'] || 
          row['Notes'] || ''
        ).trim();

        // مطابقة كود البصمة مع موظفي الصالون
        const matchedEmp = employees.find(e => {
          if (!fpCodeRaw) return false;
          const eFp = String(e.fingerprintCode || '').trim();
          const eId = String(e.id || '').trim();
          return (eFp && eFp === fpCodeRaw) || eId === fpCodeRaw || (eFp && eFp.replace(/\D/g, '') === fpCodeRaw.replace(/\D/g, ''));
        });

        // التحقق من الأخطاء
        const validationErrors: string[] = [];
        if (!fpCodeRaw) validationErrors.push('كود البصمة مفقود');
        if (!isoTimestamp) validationErrors.push('الوقت والتاريخ غير صالح');

        // كشف ما إذا كانت حركة البصمة مسجلة مسبقاً بنفس الكود والوقت
        const isExisting = existingLogs.some(l => 
          (l.fingerprintCode === fpCodeRaw || l.employeeId === matchedEmp?.id) &&
          l.type === type &&
          Math.abs(new Date(l.timestamp).getTime() - new Date(isoTimestamp).getTime()) < 60000 // فرق أقل من دقيقة
        );

        parsed.push({
          fingerprintCode: fpCodeRaw || `FP-${idx + 1}`,
          timestamp: isoTimestamp,
          dateStr,
          timeStr,
          type,
          deviceName,
          notes,
          matchedEmployee: matchedEmp,
          isExisting,
          validationErrors
        });
      });

      setCandidates(parsed);
    } catch (err: any) {
      console.error('Error reading fingerprint excel:', err);
      setReadError(err?.message || 'حدث خطأ أثناء قراءة ملف إكسل البصمة. تأكد من تطابق الأعمدة.');
    } finally {
      setIsReading(false);
    }
  };

  const stats = useMemo(() => {
    const total = candidates.length;
    const matched = candidates.filter(c => !!c.matchedEmployee).length;
    const unmatched = total - matched;
    const checkIns = candidates.filter(c => c.type === 'check_in').length;
    const checkOuts = candidates.filter(c => c.type === 'check_out').length;
    const existing = candidates.filter(c => c.isExisting).length;
    const withErrors = candidates.filter(c => c.validationErrors.length > 0).length;

    return { total, matched, unmatched, checkIns, checkOuts, existing, withErrors };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (!searchFilter.trim()) return candidates;
    const q = searchFilter.toLowerCase().trim();
    return candidates.filter(c => 
      c.fingerprintCode.toLowerCase().includes(q) ||
      (c.matchedEmployee?.name && c.matchedEmployee.name.toLowerCase().includes(q)) ||
      c.dateStr.includes(q) ||
      c.timeStr.includes(q) ||
      c.deviceName.toLowerCase().includes(q)
    );
  }, [candidates, searchFilter]);

  const handleExecuteImport = async () => {
    const toImport = candidates.filter(c => {
      if (c.validationErrors.length > 0) return false;
      if (skipDuplicates && c.isExisting) return false;
      return true;
    });

    if (toImport.length === 0) {
      alert('لا توجد سجلات بصمة صالحة للاستيراد وفق الخيارات الحالية.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: toImport.length });

    const newLogs: FingerprintLog[] = [];
    const effectiveBranchId = activeBranchId || (settings.branches && settings.branches[0]?.id) || 'main';

    for (let i = 0; i < toImport.length; i++) {
      const c = toImport[i];
      setImportProgress({ current: i + 1, total: toImport.length });

      const log: FingerprintLog = {
        id: 'FP-IMP-' + Math.random().toString(36).substr(2, 9),
        salonId: settings.salonId,
        branchId: effectiveBranchId,
        employeeId: c.matchedEmployee?.id || '',
        employeeName: c.matchedEmployee?.name || `موظف كود #${c.fingerprintCode}`,
        fingerprintCode: c.fingerprintCode,
        timestamp: c.timestamp,
        type: c.type,
        status: 'synced',
        deviceIp: c.deviceName,
        notes: c.notes ? `${c.notes} (مستورد من إكسل)` : 'مستورد من إكسل'
      };

      newLogs.push(log);
      try {
        await DB.saveFingerprintLog(log);
      } catch (e) {
        console.warn('Error saving imported fingerprint log:', e);
      }
    }

    setIsImporting(false);
    onImportComplete(newLogs);
    onClose();
    alert(`🎉 تم استيراد وتحديث ${newLogs.length} حركة بصمة في سجل الدوام والتايم شيت بنجاح!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs font-sans overflow-hidden" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Fingerprint className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">سحب حركات البصمة إلى التايم شيت</h3>
                <span className="bg-cyan-400/20 text-cyan-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-300/30">
                  تحديث فوري لجدول الدوام
                </span>
              </div>
              <p className="text-blue-100 text-xs mt-0.5">
                قراءة كود البصمة، الوقت والتاريخ، والاتجاه (دخول/خروج) ومطابقتها فوراً مع موظفي الصالون
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadFingerprintLogsTemplate()}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/25 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download size={14} />
              <span>تحميل نموذج البصمات المعتمد</span>
            </button>
            <button 
              onClick={onClose}
              disabled={isImporting}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-slate-50/60">
          
          {/* File Picker Zone */}
          <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 transition-all text-center">
            <input
              type="file"
              id="fingerprint-excel-upload"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isReading || isImporting}
              className="hidden"
            />
            <label 
              htmlFor="fingerprint-excel-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2 py-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                {isReading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">
                  {fileName ? `الملف المحدد: ${fileName}` : 'اضغط لاختيار ملف إكسل حركات البصمة أو اسحبه هنا'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم سحوبات أجهزة البصمة البيومترية بصيغة .xlsx المعتمدة على (كود البصمة، الوقت، الاتجاه)
                </p>
              </div>
            </label>
          </div>

          {/* Read Error */}
          {readError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{readError}</span>
            </div>
          )}

          {/* Stats Bar */}
          {candidates.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-bold block">إجمالي السجلات</span>
                <span className="text-lg font-black text-slate-900">{stats.total}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[11px] text-emerald-700 font-bold block">موظفون تمت مطابقتهم</span>
                <span className="text-lg font-black text-emerald-800">{stats.matched}</span>
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 shadow-2xs">
                <span className="text-[11px] text-amber-700 font-bold block">أكواد غير مسجلة</span>
                <span className="text-lg font-black text-amber-800">{stats.unmatched}</span>
              </div>
              <div className="bg-teal-50 p-3 rounded-2xl border border-teal-100 shadow-2xs">
                <span className="text-[11px] text-teal-700 font-bold block">حركات حضور (دخول)</span>
                <span className="text-lg font-black text-teal-800">{stats.checkIns}</span>
              </div>
              <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 shadow-2xs">
                <span className="text-[11px] text-indigo-700 font-bold block">حركات انصراف (خروج)</span>
                <span className="text-lg font-black text-indigo-800">{stats.checkOuts}</span>
              </div>
              <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-700 font-bold block">مكررة مسجلة مسبقاً</span>
                <span className="text-lg font-black text-slate-900">{stats.existing}</span>
              </div>
            </div>
          )}

          {/* Unmatched Notice */}
          {stats.unmatched > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>
                يوجد <strong>{stats.unmatched}</strong> سجل يحمل كود بصمة غير مسجل في بطاقات الموظفين. سيتم استيرادها وحفظها مع تمييزها برقم الكود، ويمكن ربطها لاحقاً بتعيين كود البصمة للموظف في شاشة شؤون الموظفين.
              </span>
            </div>
          )}

          {/* Options & Search */}
          {candidates.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>تخطي الحركات المكررة المسجلة بنفس الدقيقة ({stats.existing})</span>
                </label>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="بحث بكود البصمة، الموظف، التاريخ..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isImporting && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-blue-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>جارٍ ترحيل حركات البصمة وتحديث سجل التايم شيت وساعات العمل...</span>
                </span>
                <span>{importProgress.current} من {importProgress.total}</span>
              </div>
              <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Table Preview */}
          {candidates.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">كود البصمة</th>
                      <th className="py-2.5 px-3">الموظف المطابق</th>
                      <th className="py-2.5 px-3">التاريخ والوقت (timeStamp)</th>
                      <th className="py-2.5 px-3 text-center">الاتجاه</th>
                      <th className="py-2.5 px-3">الجهاز أو الموقع</th>
                      <th className="py-2.5 px-3">ملاحظات</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCandidates.map((c, idx) => {
                      const hasErr = c.validationErrors.length > 0;
                      return (
                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${c.isExisting ? 'bg-amber-50/20' : ''} ${hasErr ? 'bg-rose-50/30' : ''}`}>
                          <td className="py-2.5 px-3 font-mono font-black text-indigo-700">
                            {c.fingerprintCode}
                          </td>
                          <td className="py-2.5 px-3">
                            {c.matchedEmployee ? (
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                                  {c.matchedEmployee.name.slice(0, 1)}
                                </span>
                                <div>
                                  <span className="font-bold text-slate-900 block">{c.matchedEmployee.name}</span>
                                  <span className="text-[10px] text-slate-500">{c.matchedEmployee.role || 'فني'}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                                <UserX size={14} className="text-amber-500" />
                                <span>غير مطابق لموظف</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{c.dateStr}</div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Clock size={10} />
                              <span>{c.timeStr}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {c.type === 'check_in' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-black text-[10px] px-2 py-0.5 rounded-full border border-emerald-200">
                                <ArrowDownLeft size={11} className="text-emerald-600" />
                                <span>دخول / حضور</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-black text-[10px] px-2 py-0.5 rounded-full border border-amber-200">
                                <ArrowUpRight size={11} className="text-amber-600" />
                                <span>خروج / انصراف</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                            {c.deviceName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                            {c.notes || '--'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {hasErr ? (
                              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block" title={c.validationErrors.join(', ')}>
                                خطأ
                              </span>
                            ) : c.isExisting ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                                مسجل مسبقاً
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                                جاهز للتحديث
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="text-xs text-slate-500">
            {candidates.length > 0 && (
              <span>
                سيتم رفع <strong className="text-blue-700">{candidates.filter(c => !c.validationErrors.length && (!skipDuplicates || !c.isExisting)).length}</strong> حركة بصمة إلى التايم شيت وسجلات الدوام
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={isImporting || candidates.length === 0 || candidates.filter(c => !c.validationErrors.length && (!skipDuplicates || !c.isExisting)).length === 0}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={16} />}
              <span>تأكيد رفع البصمات إلى التايم شيت وتحديث السحابة</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
