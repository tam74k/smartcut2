import React, { useState, useMemo } from 'react';
import { AppSettings, FingerprintLog, Employee } from '../types';
import { 
  X, UploadCloud, Download, CheckCircle2, AlertTriangle, 
  FileSpreadsheet, Loader2, Fingerprint, Clock, UserCheck, UserX, ArrowUpDown 
} from 'lucide-react';
import { DB, calculateFingerprintProcessedDate } from '../services/db';
import { 
  cleanHeaderKey, parseExcelDate, 
  readSingleSheetExcel, downloadExcelTemplate, getRowValueByKeywords 
} from '../utils/excelImportHelpers';

interface BiometricImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  fingerprintLogs?: FingerprintLog[];
  setFingerprintLogs?: (logs: FingerprintLog[] | ((prev: FingerprintLog[]) => FingerprintLog[])) => void;
  employees?: Employee[];
  activeBranchId?: string;
  currentUser?: any;
}

export function BiometricImportModal({
  isOpen,
  onClose,
  settings,
  fingerprintLogs = [],
  setFingerprintLogs,
  employees = [],
  activeBranchId,
  currentUser
}: BiometricImportModalProps) {
  // 1. Hooks - أعلى المكون دائماً
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedLogs, setParsedLogs] = useState<FingerprintLog[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const resetState = () => {
    setFile(null);
    setIsProcessing(false);
    setIsSaving(false);
    setParsedLogs([]);
    setParseError(null);
    setSaveSuccessMsg(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // 2. تنزيل نموذج التايم شيت والبصمة المعتمد
  const handleDownloadSample = () => {
    const sampleLogs = [
      ['101', '2026-05-15 09:05:22', 'دخول', 'بصمة الصباح'],
      ['101', '2026-05-15 21:10:45', 'خروج', 'انصراف نهاية الوردية'],
      ['102', '2026-05-15 10:00:15', 'دخول', 'حضور في الموعد'],
      ['102', '2026-05-15 22:30:00', 'خروج', 'انصراف'],
      ['103', '2026-05-15 11:30:10', 'Check-In', 'وردية مسائية'],
      ['103', '2026-05-15 23:45:00', 'Check-Out', 'انصراف']
    ];

    downloadExcelTemplate('نموذج_استيراد_البصمة_والتايم_شيت_SmartCut', [
      {
        name: 'BiometricLogs',
        headers: [
          'كود البصمة أو كود الموظف', 
          'التاريخ والوقت', 
          'نوع الحركة / الاتجاه (دخول/خروج)', 
          'ملاحظات'
        ],
        sampleRows: sampleLogs
      }
    ]);
  };

  // 3. قراءة ومعالجة ملف الإكسل
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setIsProcessing(true);
    setParseError(null);
    setSaveSuccessMsg(null);

    try {
      const { rows } = await readSingleSheetExcel(selected);

      if (!rows || rows.length === 0) {
        throw new Error('الملف فارغ ولا يحتوي على أي سجلات بصمة.');
      }

      // خريطة مطابقة الموظفين
      const resolveEmployee = (rawCode: string, rawName?: string) => {
        const cClean = String(rawCode || '').trim();
        const nClean = cleanHeaderKey(rawName || '');

        return employees.find(emp => {
          if (cClean && (
            String(emp.fingerprintCode || '').trim() === cClean ||
            String((emp as any).code || '').trim() === cClean ||
            String(emp.id).trim() === cClean
          )) return true;

          if (nClean) {
            const empNameClean = cleanHeaderKey(emp.name);
            if (empNameClean === nClean || empNameClean.includes(nClean) || nClean.includes(empNameClean)) {
              return true;
            }
          }
          return false;
        });
      };

      // تحليل أولي للصفوف
      interface RawEntry {
        code: string;
        timestamp: string;
        direction?: 'check_in' | 'check_out';
        notes?: string;
        employee?: Employee;
      }

      const rawEntries: RawEntry[] = [];

      rows.forEach(row => {
        const code = String(getRowValueByKeywords(row, [
          'كود البصمة أو كود الموظف', 'كود البصمة', 'كود الموظف', 
          'رقم البصمة', 'بصمة', 'enroll', 'biometric', 'user_id', 'pin', 'id'
        ])).trim();

        if (!code) return; // تخطي الصفوف الخالية من الأكواد

        const nameHint = String(getRowValueByKeywords(row, ['اسم الموظف', 'الموظف', 'الاسم', 'name'])).trim();
        const matchedEmp = resolveEmployee(code, nameHint);

        const dateTimeRaw = getRowValueByKeywords(row, ['التاريخ والوقت', 'التاريخ', 'الوقت', 'datetime', 'timestamp', 'time']);
        const validTimestamp = parseExcelDate(dateTimeRaw, '09:00');

        const dirRaw = cleanHeaderKey(String(getRowValueByKeywords(row, [
          'نوع الحركة / الاتجاه', 'نوع الحركة', 'الاتجاه', 'الحالة', 'direction', 'status', 'type'
        ])));

        let dir: 'check_in' | 'check_out' | undefined = undefined;
        if (dirRaw.includes('دخول') || dirRaw.includes('in') || dirRaw === '0') {
          dir = 'check_in';
        } else if (dirRaw.includes('خروج') || dirRaw.includes('انصراف') || dirRaw.includes('out') || dirRaw === '1') {
          dir = 'check_out';
        }

        const notes = String(getRowValueByKeywords(row, ['ملاحظات', 'بيان', 'notes', 'remark'])).trim();

        rawEntries.push({
          code,
          timestamp: validTimestamp,
          direction: dir,
          notes: notes || undefined,
          employee: matchedEmp
        });
      });

      // إذا كانت بعض الحركات بدون اتجاه محدد (دخول/خروج):
      // تجميع حسب الموظف واليوم، وتحديد الأولى كـ check_in والأخيرة كـ check_out
      const groupedByEmpAndDay = new Map<string, RawEntry[]>();
      rawEntries.forEach(entry => {
        const dayStr = entry.timestamp.split('T')[0];
        const key = `${entry.code}_${dayStr}`;
        const list = groupedByEmpAndDay.get(key) || [];
        list.push(entry);
        groupedByEmpAndDay.set(key, list);
      });

      const finalLogs: FingerprintLog[] = [];

      groupedByEmpAndDay.forEach(entries => {
        // ترتيب تصاعدي حسب الوقت
        entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        entries.forEach((e, idx) => {
          let resolvedDir = e.direction;
          if (!resolvedDir) {
            // إذا كان هناك بصمة واحدة فقط في اليوم نعتبرها دخول
            if (entries.length === 1) {
              resolvedDir = 'check_in';
            } else if (idx === 0) {
              resolvedDir = 'check_in';
            } else if (idx === entries.length - 1) {
              resolvedDir = 'check_out';
            } else {
              resolvedDir = 'check_in';
            }
          }

          const processedDate = calculateFingerprintProcessedDate(e.timestamp, resolvedDir);

          finalLogs.push({
            id: 'FP-IMP-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
            salonId: settings.salonId,
            branchId: activeBranchId,
            fingerprintCode: e.code,
            employeeId: e.employee ? e.employee.id : undefined,
            employeeName: e.employee ? e.employee.name : undefined,
            timestamp: e.timestamp,
            type: resolvedDir,
            status: 'synced',
            notes: e.notes || 'مستورد من ملف إكسل',
            processedDate: processedDate,
            processed_date: processedDate
          });
        });
      });

      // فرز نهائي تنازلي
      finalLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setParsedLogs(finalLogs);
    } catch (err: any) {
      console.error('Error parsing biometric logs:', err);
      setParseError(err.message || 'حدث خطأ أثناء قراءة سجلات البصمة.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. الإحصاءات
  const recognizedCount = useMemo(() => {
    return parsedLogs.filter(l => Boolean(l.employeeId)).length;
  }, [parsedLogs]);

  const checkInsCount = useMemo(() => {
    return parsedLogs.filter(l => l.type === 'check_in').length;
  }, [parsedLogs]);

  const checkOutsCount = useMemo(() => {
    return parsedLogs.filter(l => l.type === 'check_out').length;
  }, [parsedLogs]);

  // 5. حفظ السجلات
  const handleSaveImport = async () => {
    if (parsedLogs.length === 0) {
      alert('لا توجد سجلات بصمة جاهزة للاستيراد.');
      return;
    }

    setIsSaving(true);
    setParseError(null);

    try {
      for (const log of parsedLogs) {
        await DB.saveFingerprintLog(log);
      }

      if (setFingerprintLogs) {
        setFingerprintLogs(prev => {
          const prevArr = Array.isArray(prev) ? prev : [];
          return [...parsedLogs, ...prevArr];
        });
      }

      setSaveSuccessMsg(`تم بنجاح استيراد ${parsedLogs.length} حركة بصمة وتحديث سجلات التايم شيت وساعات العمل فوراً.`);
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err: any) {
      console.error('Error saving biometric logs:', err);
      setParseError('فشل حفظ سجلات البصمة: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* شريط العنوان */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-emerald-50/60 via-white to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 font-black">
              <Fingerprint size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-800">
                  استيراد سجلات البصمة والتايم شيت من إكسل (.xlsx)
                </h3>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  شيت الحضور والإنصراف
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                سحب حركات أجهزة البصمة ومطابقة أكواد الموظفين مع تمييز حركات الدخول والخروج والورديات الليلية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSample}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download size={14} className="text-emerald-600" />
              <span>تحميل ملف العينة</span>
            </button>

            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* محتوى المودال */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {saveSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 font-bold text-xs">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {parseError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3 font-bold text-xs">
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {!file && (
            <div className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 rounded-3xl p-8 bg-emerald-50/20 text-center transition-all">
              <input
                type="file"
                id="biometricExcelFile"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="biometricExcelFile"
                className="cursor-pointer flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/10">
                  <UploadCloud size={30} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">
                    اضغط هنا لاختيار ملف إكسل سحوبات البصمة أو اسحبه إلى هنا
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم أعمدة كود البصمة / كود الموظف، تاريخ ووقت الحركة، والاتجاه (دخول/خروج)
                  </p>
                </div>
                <span className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all">
                  تحديد ملف البصمات
                </span>
              </label>
            </div>
          )}

          {isProcessing && (
            <div className="p-8 text-center space-y-3">
              <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto" />
              <p className="text-sm font-black text-slate-700">جارٍ قراءة الحركات ومطابقة الموظفين وحساب الورديات...</p>
            </div>
          )}

          {file && !isProcessing && parsedLogs.length > 0 && (
            <div className="space-y-5">
              
              {/* شريط الإحصائيات */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600">إجمالي الحركات</span>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{parsedLogs.length}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-100">
                  <span className="text-[11px] font-bold text-blue-600">حركات دخول (Check-In)</span>
                  <p className="text-xl font-black text-blue-950 mt-0.5">{checkInsCount}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-100">
                  <span className="text-[11px] font-bold text-purple-600">حركات خروج (Check-Out)</span>
                  <p className="text-xl font-black text-purple-950 mt-0.5">{checkOutsCount}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100">
                  <span className="text-[11px] font-bold text-emerald-600">موظفون مطابقون</span>
                  <p className="text-xl font-black text-emerald-950 mt-0.5">
                    {recognizedCount} من {parsedLogs.length}
                  </p>
                </div>
              </div>

              {/* جدول المعاينة */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3">كود البصمة</th>
                        <th className="p-3">الموظف المطابق</th>
                        <th className="p-3">التاريخ والوقت</th>
                        <th className="p-3">نوع الحركة</th>
                        <th className="p-3">تاريخ الوردية المحسوب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedLogs.slice(0, 50).map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-emerald-700">{log.fingerprintCode}</td>
                          <td className="p-3">
                            {log.employeeName ? (
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <UserCheck size={14} className="text-emerald-600" />
                                {log.employeeName}
                              </span>
                            ) : (
                              <span className="text-amber-600 font-bold flex items-center gap-1.5">
                                <UserX size={14} />
                                كود غير مسجل
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {log.timestamp.replace('T', ' ')}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              log.type === 'check_in' 
                                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                : 'bg-purple-100 text-purple-700 border border-purple-200'
                            }`}>
                              {log.type === 'check_in' ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                  <span>دخول (Check-In)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                                  <span>خروج (Check-Out)</span>
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-500">
                            {log.processedDate || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* الشريط السفلي */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-black transition-colors cursor-pointer disabled:opacity-50"
          >
            إلغاء
          </button>

          {parsedLogs.length > 0 && (
            <button
              onClick={handleSaveImport}
              disabled={isSaving || parsedLogs.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>جارٍ حفظ حركات البصمة...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>حفظ واستيراد {parsedLogs.length} حركة بصمة</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
