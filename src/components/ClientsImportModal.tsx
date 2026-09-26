import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  X, AlertCircle, RefreshCw, Users, Crown, Phone, Mail, Calendar, Sparkles
} from 'lucide-react';
import { AppSettings, Client } from '../types';
import { readExcelFile, downloadClientsTemplate, parseExcelDate } from '../utils/excelHelper';
import { DB } from '../services/db';

interface ClientsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  existingClients: Client[];
  onImportComplete: (addedClients: Client[], updatedClients: Client[]) => void;
  activeBranchId?: string;
}

interface ParsedClientCandidate {
  name: string;
  phone: string;
  email: string;
  dob: string;
  isVip: boolean;
  loyaltyPoints: number;
  cashback: number;
  notes: string;
  isExisting: boolean;
  existingId?: string;
  validationErrors: string[];
}

function safeParseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '').trim();
  const match = str.match(/-?\d+(\.\d+)?/);
  if (match) {
    const parsed = parseFloat(match[0]);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function ClientsImportModal({
  isOpen,
  onClose,
  settings,
  existingClients = [],
  onImportComplete,
  activeBranchId
}: ClientsImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [readError, setReadError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<ParsedClientCandidate[]>([]);
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
        throw new Error('الملف فارغ أو لا يحتوي على صفوف صالحة.');
      }

      const parsed: ParsedClientCandidate[] = [];

      rows.forEach((row: any, idx: number) => {
        const nameRaw = String(
          row['اسم العميل'] || 
          row['الاسم'] || 
          row['Client Name'] || 
          row['Name'] || ''
        ).trim();

        const phoneRaw = String(
          row['رقم الجوال'] || 
          row['الجوال'] || 
          row['رقم الهاتف'] || 
          row['الهاتف'] || 
          row['Phone'] || 
          row['Mobile'] || ''
        ).trim().replace(/\D/g, '');

        const emailRaw = String(
          row['البريد الإلكتروني'] || 
          row['البريد'] || 
          row['Email'] || ''
        ).trim();

        // تاريخ الميلاد
        const rawDob = row['تاريخ الميلاد (YYYY-MM-DD)'] || row['تاريخ الميلاد'] || row['الميلاد'] || row['DOB'] || row['Date of Birth'];
        let dobStr = '';
        if (rawDob) {
          try {
            const iso = parseExcelDate(rawDob);
            dobStr = iso.split('T')[0];
          } catch {
            dobStr = '';
          }
        }

        // VIP
        const vipRaw = String(
          row['عميل مميز VIP؟ (نعم/لا)'] || 
          row['VIP'] || 
          row['عميل مميز'] || 
          row['isVip'] || ''
        ).trim().toLowerCase();
        const isVip = vipRaw === 'نعم' || vipRaw === 'yes' || vipRaw === 'true' || vipRaw === '1';

        // نقاط الولاء
        const loyaltyPoints = Math.max(0, safeParseNumber(
          row['رصيد نقاط الولاء'] || 
          row['نقاط الولاء'] || 
          row['النقاط'] || 
          row['Points'] || 0
        ));

        // كاش باك
        const cashback = Math.max(0, safeParseNumber(
          row['رصيد كاش باك (ر.س)'] || 
          row['رصيد كاش باك'] || 
          row['كاش باك'] || 
          row['Cashback'] || 0
        ));

        // ملاحظات وتفضيلات
        const notes = String(
          row['ملاحظات وتفضيلات الحلاقة'] || 
          row['الملاحظات'] || 
          row['ملاحظات'] || 
          row['Notes'] || ''
        ).trim();

        const validationErrors: string[] = [];
        if (!nameRaw) validationErrors.push('اسم العميل مفقود');
        if (!phoneRaw || phoneRaw.length < 5) validationErrors.push('رقم الجوال غير صالح أو مفقود');

        // كشف المكرر برقم الجوال
        const matchedExisting = existingClients.find(c => {
          const p = (c.phone || '').replace(/\D/g, '');
          return p && p === phoneRaw;
        });

        parsed.push({
          name: nameRaw || `عميل #${idx + 1}`,
          phone: phoneRaw,
          email: emailRaw,
          dob: dobStr,
          isVip,
          loyaltyPoints,
          cashback,
          notes,
          isExisting: !!matchedExisting,
          existingId: matchedExisting?.id,
          validationErrors
        });
      });

      setCandidates(parsed);
    } catch (err: any) {
      console.error('Error reading clients excel:', err);
      setReadError(err?.message || 'حدث خطأ أثناء قراءة ملف إكسل. تأكد من صحة الأعمدة.');
    } finally {
      setIsReading(false);
    }
  };

  const stats = useMemo(() => {
    const total = candidates.length;
    const existing = candidates.filter(c => c.isExisting).length;
    const newClients = total - existing;
    const withErrors = candidates.filter(c => c.validationErrors.length > 0).length;
    const vipCount = candidates.filter(c => c.isVip).length;

    return { total, existing, newClients, withErrors, vipCount };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (!searchFilter.trim()) return candidates;
    const q = searchFilter.toLowerCase().trim();
    return candidates.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q) || 
      c.email.toLowerCase().includes(q) ||
      c.notes.toLowerCase().includes(q)
    );
  }, [candidates, searchFilter]);

  const handleExecuteImport = async () => {
    const toImport = candidates.filter(c => {
      if (c.validationErrors.length > 0) return false;
      if (skipDuplicates && c.isExisting) return false;
      return true;
    });

    if (toImport.length === 0) {
      alert('لا توجد بيانات عملاء صالحة للاستيراد وفق الخيارات المحددة.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: toImport.length });

    const addedList: Client[] = [];
    const updatedList: Client[] = [];
    const effectiveBranchId = activeBranchId || (settings.branches && settings.branches[0]?.id) || 'main';

    for (let i = 0; i < toImport.length; i++) {
      const c = toImport[i];
      setImportProgress({ current: i + 1, total: toImport.length });

      if (c.isExisting && c.existingId) {
        // تحديث عميل قائم
        const existing = existingClients.find(ec => ec.id === c.existingId);
        const updated: Client = {
          ...existing!,
          name: c.name || existing!.name,
          email: c.email || existing!.email,
          dob: c.dob || existing!.dob,
          isVip: c.isVip || existing!.isVip,
          loyaltyPoints: c.loyaltyPoints > 0 ? c.loyaltyPoints : existing!.loyaltyPoints,
          cashback: c.cashback > 0 ? c.cashback : existing!.cashback,
          notes: c.notes ? (existing!.notes ? `${existing!.notes} | ${c.notes}` : c.notes) : existing!.notes
        };
        updatedList.push(updated);
        try {
          await DB.saveClient(updated, settings.salonId);
        } catch (e) {
          console.warn('Error updating existing client:', e);
        }
      } else {
        // إضافة عميل جديد
        const newClient: Client = {
          id: 'cli-' + Math.random().toString(36).substr(2, 9),
          name: c.name,
          phone: c.phone,
          email: c.email || undefined,
          dob: c.dob || undefined,
          isVip: c.isVip,
          vipSince: c.isVip ? new Date().toISOString().split('T')[0] : undefined,
          loyaltyPoints: c.loyaltyPoints,
          cashback: c.cashback,
          notes: c.notes || undefined,
          lastVisit: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          branchId: effectiveBranchId
        };
        addedList.push(newClient);
        try {
          await DB.saveClient(newClient, settings.salonId);
        } catch (e) {
          console.warn('Error saving new client:', e);
        }
      }
    }

    setIsImporting(false);
    onImportComplete(addedList, updatedList);
    onClose();
    alert(`🎉 تم استيراد وحفظ ${addedList.length} عميل جديد وتحديث ${updatedList.length} عميل في قاعدة البيانات بنجاح!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs font-sans overflow-hidden" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">سحب قاعدة العملاء من ملف إكسل</h3>
              <p className="text-blue-100 text-xs mt-0.5">
                استيراد أرقام الجوال، الأسماء، رتب VIP، رصيد نقاط الولاء، والكاش باك مع كشف التكرار
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadClientsTemplate()}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/25 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download size={14} />
              <span>تحميل نموذج العملاء المعتمد</span>
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
          
          {/* File Upload Zone */}
          <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-all text-center">
            <input
              type="file"
              id="clients-excel-upload"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isReading || isImporting}
              className="hidden"
            />
            <label 
              htmlFor="clients-excel-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2 py-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                {isReading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">
                  {fileName ? `الملف المحدد: ${fileName}` : 'اضغط لاختيار ملف إكسل العملاء أو اسحبه هنا'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم الملفات بصيغة .xlsx مع التعرف الذكي على الأعمدة
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-bold block">إجمالي السجلات</span>
                <span className="text-lg font-black text-slate-900">{stats.total}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[11px] text-emerald-700 font-bold block">عملاء جدد</span>
                <span className="text-lg font-black text-emerald-800">{stats.newClients}</span>
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 shadow-2xs">
                <span className="text-[11px] text-amber-700 font-bold block">مسجلون مسبقاً</span>
                <span className="text-lg font-black text-amber-800">{stats.existing}</span>
              </div>
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 shadow-2xs">
                <span className="text-[11px] text-purple-700 font-bold block">عملاء VIP</span>
                <span className="text-lg font-black text-purple-800">{stats.vipCount}</span>
              </div>
              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100 shadow-2xs">
                <span className="text-[11px] text-rose-700 font-bold block">بيانات غير مكتملة</span>
                <span className="text-lg font-black text-rose-800">{stats.withErrors}</span>
              </div>
            </div>
          )}

          {/* Options & Toolbar */}
          {candidates.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>تخطي العملاء المسجلين مسبقاً ({stats.existing}) وعدم استبدالهم</span>
                </label>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="بحث باسم العميل، الجوال، الملاحظات..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isImporting && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-indigo-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>جارٍ استيراد بيانات العملاء وتحديث السحابة...</span>
                </span>
                <span>{importProgress.current} من {importProgress.total}</span>
              </div>
              <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
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
                      <th className="py-2.5 px-3">اسم العميل</th>
                      <th className="py-2.5 px-3">رقم الجوال</th>
                      <th className="py-2.5 px-3">البريد والميلاد</th>
                      <th className="py-2.5 px-3 text-center">VIP؟</th>
                      <th className="py-2.5 px-3 text-center">نقاط الولاء</th>
                      <th className="py-2.5 px-3 text-center">كاش باك</th>
                      <th className="py-2.5 px-3">ملاحظات وتفضيلات</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCandidates.map((c, idx) => {
                      const hasErr = c.validationErrors.length > 0;
                      return (
                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${c.isExisting ? 'bg-amber-50/20' : ''} ${hasErr ? 'bg-rose-50/30' : ''}`}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {c.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700" dir="ltr">
                            {c.phone}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-slate-600">{c.email || '--'}</div>
                            {c.dob && <div className="text-[10px] text-slate-400 font-mono">{c.dob}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {c.isVip ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-black text-[10px] px-2 py-0.5 rounded-full">
                                <Crown size={11} className="text-amber-600" /> VIP
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">عادي</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                            {c.loyaltyPoints}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                            {c.cashback > 0 ? `${c.cashback} ${settings.currency}` : '0'}
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate text-slate-600" title={c.notes}>
                            {c.notes || '--'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {hasErr ? (
                              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block" title={c.validationErrors.join(', ')}>
                                خطأ بالبيانات
                              </span>
                            ) : c.isExisting ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                                مسجل مسبقاً
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                                جاهز للاستيراد
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
                سيتم استيراد <strong className="text-indigo-700">{candidates.filter(c => !c.validationErrors.length && (!skipDuplicates || !c.isExisting)).length}</strong> عميل
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
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={16} />}
              <span>تأكيد استيراد العملاء وحفظهم</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
