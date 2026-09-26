import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  X, AlertCircle, RefreshCw, DollarSign, Tag, Landmark, Calendar, FileText
} from 'lucide-react';
import { AppSettings, Transaction } from '../types';
import { readExcelFile, downloadExpensesTemplate, parseExcelDate } from '../utils/excelHelper';
import { DB } from '../services/db';

interface ExpensesImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  setSettings?: (s: AppSettings) => void;
  onImportComplete: (newTransactions: Transaction[], newCategories: string[]) => void;
  activeBranchId?: string;
  currentUser?: any;
  shiftData?: { isOpen: boolean; date: string; initialCash?: number };
}

interface ParsedExpenseCandidate {
  date: string;
  amount: number;
  category: string;
  description: string;
  treasury: string;
  treasuryId: string;
  referenceNo: string;
  notes: string;
  isNewCategory: boolean;
  validationErrors: string[];
}

export function ExpensesImportModal({
  isOpen,
  onClose,
  settings,
  setSettings,
  onImportComplete,
  activeBranchId,
  currentUser,
  shiftData
}: ExpensesImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [readError, setReadError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<ParsedExpenseCandidate[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

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

      const existingCategories = (settings.expenseCategories || []).map(c => c.trim().toLowerCase());
      const parsed: ParsedExpenseCandidate[] = [];

      rows.forEach((row: any, idx: number) => {
        // التاريخ
        const rawDate = row['تاريخ المصروف (YYYY-MM-DD)'] || row['تاريخ المصروف'] || row['التاريخ'] || row['Date'];
        let dateStr = '';
        try {
          const iso = parseExcelDate(rawDate);
          dateStr = iso.split('T')[0];
        } catch {
          dateStr = shiftData?.isOpen ? shiftData.date : new Date().toISOString().split('T')[0];
        }

        // المبلغ
        const amountRaw = Math.max(0, Number(
          row['المبلغ (ر.س)'] || 
          row['المبلغ'] || 
          row['Amount'] || 0
        ) || 0);

        // بند الصرف
        const categoryRaw = String(
          row['بند الصرف / التصنيف'] || 
          row['بند الصرف'] || 
          row['التصنيف'] || 
          row['Category'] || 
          'مصروفات عامة'
        ).trim();

        // البيان والوصف
        const descRaw = String(
          row['البيان / الوصف'] || 
          row['البيان'] || 
          row['الوصف'] || 
          row['Description'] || ''
        ).trim();

        // الخزينة
        const treasuryNameRaw = String(
          row['الخزينة المنصرف منها'] || 
          row['الخزينة'] || 
          row['Treasury'] || ''
        ).trim();

        // مطابقة الخزينة
        let matchedTreasuryId = settings.treasuries?.[0]?.id || 'cash';
        if (treasuryNameRaw) {
          const matched = settings.treasuries?.find(t => 
            t.name.trim().toLowerCase() === treasuryNameRaw.toLowerCase() || t.id === treasuryNameRaw
          );
          if (matched) matchedTreasuryId = matched.id;
        }

        const refNo = String(row['رقم الفاتورة أو المرجع'] || row['رقم المرجع'] || row['المرجع'] || row['Reference'] || '').trim();
        const notes = String(row['ملاحظات إضافية'] || row['ملاحظات'] || row['Notes'] || '').trim();

        const validationErrors: string[] = [];
        if (amountRaw <= 0) validationErrors.push('المبلغ غير صالح أو يساوي صفراً');
        if (!descRaw) validationErrors.push('البيان / الوصف مطلوب');

        const isNewCat = !existingCategories.includes(categoryRaw.toLowerCase());

        parsed.push({
          date: dateStr,
          amount: amountRaw,
          category: categoryRaw,
          description: descRaw || `مصروف #${idx + 1}`,
          treasury: treasuryNameRaw || (settings.treasuries?.[0]?.name || 'الخزينة الرئيسية'),
          treasuryId: matchedTreasuryId,
          referenceNo: refNo,
          notes,
          isNewCategory: isNewCat,
          validationErrors
        });
      });

      setCandidates(parsed);
    } catch (err: any) {
      console.error('Error reading expenses excel:', err);
      setReadError(err?.message || 'حدث خطأ أثناء قراءة ملف إكسل. تأكد من صحة الأعمدة.');
    } finally {
      setIsReading(false);
    }
  };

  const stats = useMemo(() => {
    const total = candidates.length;
    const withErrors = candidates.filter(c => c.validationErrors.length > 0).length;
    const valid = total - withErrors;
    const totalAmount = candidates.reduce((sum, c) => sum + (c.validationErrors.length === 0 ? c.amount : 0), 0);
    const newCategories = Array.from(new Set(candidates.filter(c => c.isNewCategory).map(c => c.category)));

    return { total, valid, withErrors, totalAmount, newCategories };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (!searchFilter.trim()) return candidates;
    const q = searchFilter.toLowerCase().trim();
    return candidates.filter(c => 
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.treasury.toLowerCase().includes(q) ||
      c.referenceNo.toLowerCase().includes(q)
    );
  }, [candidates, searchFilter]);

  const handleExecuteImport = async () => {
    const toImport = candidates.filter(c => c.validationErrors.length === 0);

    if (toImport.length === 0) {
      alert('لا توجد قيود مصروفات صالحة للاستيراد.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: toImport.length });

    const newTransactions: Transaction[] = [];
    const newCatsToRegister = stats.newCategories;
    const effectiveBranchId = activeBranchId || (settings.branches && settings.branches[0]?.id) || 'main';

    for (let i = 0; i < toImport.length; i++) {
      const c = toImport[i];
      setImportProgress({ current: i + 1, total: toImport.length });

      const fullDateTime = `${c.date}T${new Date().toTimeString().split(' ')[0]}`;
      const effectiveShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : c.date;

      const fullDesc = [c.description, c.referenceNo ? `(مرجع: ${c.referenceNo})` : '', c.notes ? `- ${c.notes}` : '']
        .filter(Boolean).join(' ');

      const trx: Transaction = {
        id: 'EXP-IMP-' + Math.random().toString(36).substr(2, 9),
        date: fullDateTime,
        shiftDate: effectiveShiftDate,
        type: 'out',
        amount: c.amount,
        category: 'expense',
        expenseCategory: c.category,
        description: fullDesc,
        treasury: c.treasuryId,
        createdBy: currentUser?.name || 'استيراد إكسل',
        userId: currentUser?.id,
        userName: currentUser?.name || 'استيراد إكسل',
        branchId: effectiveBranchId,
        salonId: settings.salonId
      };

      newTransactions.push(trx);
      try {
        await DB.saveTransaction(trx, settings.salonId);
      } catch (e) {
        console.warn('Error saving imported expense transaction:', e);
      }
    }

    // إضافة بنود الصرف الجديدة للإعدادات إذا وجدت
    if (newCatsToRegister.length > 0 && setSettings) {
      const currentCats = settings.expenseCategories || [];
      const updatedCats = Array.from(new Set([...currentCats, ...newCatsToRegister]));
      const updatedSettings = {
        ...settings,
        expenseCategories: updatedCats
      };
      setSettings(updatedSettings);
      try {
        await DB.saveSettings(updatedSettings);
      } catch (e) {
        console.warn('Error saving updated categories to settings:', e);
      }
    }

    setIsImporting(false);
    onImportComplete(newTransactions, newCatsToRegister);
    onClose();
    alert(`🎉 تم استيراد ${newTransactions.length} قيد مصروف بنجاح وتحديث الحسابات والخزائن في قاعدة البيانات!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs font-sans overflow-hidden" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">سحب المصروفات من ملف إكسل</h3>
              <p className="text-rose-100 text-xs mt-0.5">
                استيراد قيود المصروفات، مطابقة بنود الصرف والخزائن، وتحديث السحابة تلقائياً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadExpensesTemplate(settings.currency || 'ر.س')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/25 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download size={14} />
              <span>تحميل نموذج المصروفات المعتمد</span>
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
          <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-rose-400 transition-all text-center">
            <input
              type="file"
              id="expenses-excel-upload"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isReading || isImporting}
              className="hidden"
            />
            <label 
              htmlFor="expenses-excel-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2 py-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
                {isReading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">
                  {fileName ? `الملف المحدد: ${fileName}` : 'اضغط لاختيار ملف إكسل المصروفات أو اسحبه هنا'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم الملفات بصيغة .xlsx مع قراءة المبالغ والتواريخ والخزائن وبنود الصرف
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-bold block">إجمالي القيود</span>
                <span className="text-lg font-black text-slate-900">{stats.total}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[11px] text-emerald-700 font-bold block">قيود صالحة</span>
                <span className="text-lg font-black text-emerald-800">{stats.valid}</span>
              </div>
              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100 shadow-2xs">
                <span className="text-[11px] text-rose-700 font-bold block">إجمالي المصروفات</span>
                <span className="text-base font-black text-rose-800">{stats.totalAmount.toLocaleString()} {settings.currency}</span>
              </div>
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 shadow-2xs">
                <span className="text-[11px] text-purple-700 font-bold block">بنود صرف جديدة ستضاف</span>
                <span className="text-lg font-black text-purple-800">{stats.newCategories.length}</span>
              </div>
            </div>
          )}

          {/* New categories notice */}
          {stats.newCategories.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs text-purple-900">
              <Tag size={16} className="text-purple-600 shrink-0" />
              <span>
                سيتم إضافة البنود التالية تلقائياً إلى قائمة بنود الصرف: <strong>{stats.newCategories.join('، ')}</strong>
              </span>
            </div>
          )}

          {/* Search Toolbar */}
          {candidates.length > 0 && (
            <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-700">
                معاينة قيود المصروفات قبل الحفظ:
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="بحث بالوصف، بند الصرف، الخزينة..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-rose-600"
                />
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isImporting && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-rose-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                  <span>جارٍ ترحيل قيود المصروفات وحفظها في قاعدة البيانات...</span>
                </span>
                <span>{importProgress.current} من {importProgress.total}</span>
              </div>
              <div className="w-full bg-rose-200/60 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-rose-600 h-full rounded-full transition-all duration-300"
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
                      <th className="py-2.5 px-3">التاريخ</th>
                      <th className="py-2.5 px-3">المبلغ</th>
                      <th className="py-2.5 px-3">بند الصرف</th>
                      <th className="py-2.5 px-3">البيان / الوصف</th>
                      <th className="py-2.5 px-3">الخزينة</th>
                      <th className="py-2.5 px-3">رقم المرجع / ملاحظات</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCandidates.map((c, idx) => {
                      const hasErr = c.validationErrors.length > 0;
                      return (
                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${hasErr ? 'bg-rose-50/30' : ''}`}>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {c.date}
                          </td>
                          <td className="py-2.5 px-3 font-black text-rose-600">
                            {c.amount} {settings.currency}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.isNewCategory ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {c.category}
                              {c.isNewCategory && ' (جديد)'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-xs truncate">
                            {c.description}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {c.treasury}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                            {c.referenceNo || c.notes || '--'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {hasErr ? (
                              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block" title={c.validationErrors.join(', ')}>
                                خطأ
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                                جاهز
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
                سيتم استيراد <strong className="text-rose-700">{stats.valid}</strong> قيد مصروف بإجمالي <strong className="text-rose-700">{stats.totalAmount.toLocaleString()} {settings.currency}</strong>
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
              disabled={isImporting || stats.valid === 0}
              className="w-full sm:w-auto bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={16} />}
              <span>تأكيد استيراد المصروفات وحفظها في قاعدة البيانات</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
