import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  X, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Users, DollarSign,
  Calendar, Scissors, Info, ArrowRight, Eye, Clock, ShieldCheck
} from 'lucide-react';
import { AppSettings, Booking, BookingService, AdvancePayment, Client, Employee, ServiceItem, Transaction, Branch } from '../types';
import { readTwoSheetExcelFile, downloadBookingsTemplate, parseExcelDate } from '../utils/excelHelper';
import { DB } from '../services/db';

interface BookingsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  existingBookings: Booking[];
  onImportComplete: (newBookings: Booking[], newClients: Client[], newTransactions: Transaction[]) => void;
  clients?: Client[];
  employees?: Employee[];
  services?: ServiceItem[];
  activeBranchId?: string;
  currentUser?: any;
  shiftData?: { isOpen: boolean; date: string; initialCash?: number };
}

interface ParsedBookingCandidate {
  id: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  notes: string;
  advanceAmount: number;
  advanceTreasury: string;
  services: BookingService[];
  totalAmount: number;
  isExisting: boolean;
  isNewClient: boolean;
  validationErrors: string[];
}

export function BookingsImportModal({
  isOpen,
  onClose,
  settings,
  existingBookings = [],
  onImportComplete,
  clients = [],
  employees = [],
  services = [],
  activeBranchId,
  currentUser,
  shiftData
}: BookingsImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [readError, setReadError] = useState<string | null>(null);
  
  const [candidates, setCandidates] = useState<ParsedBookingCandidate[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
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
      const { headerRows, detailRows, headerSheetName, detailSheetName } = await readTwoSheetExcelFile(selectedFile);

      if (!headerRows || headerRows.length === 0) {
        throw new Error(`ورقة العمل "${headerSheetName}" فارغة أو لا تحتوي على صفوف رأس الحجز.`);
      }

      // 1. تجميع تفاصيل الخدمات لكل حجز
      const servicesByBookingId = new Map<string, any[]>();
      detailRows.forEach((row: any) => {
        const bIdRaw = String(
          row['رقم الحجز'] || 
          row['رقم الحجز '] || 
          row['Booking ID'] || 
          row['Booking Code'] || 
          row['BookingNo'] || 
          row['Booking Number'] || 
          row['كود الحجز'] || ''
        ).trim();

        if (bIdRaw) {
          const list = servicesByBookingId.get(bIdRaw) || [];
          list.push(row);
          servicesByBookingId.set(bIdRaw, list);
        }
      });

      // 2. تحليل صفوف رأس الحجز
      const parsedList: ParsedBookingCandidate[] = [];

      headerRows.forEach((row: any, idx: number) => {
        const rowIdRaw = String(
          row['رقم الحجز'] || 
          row['رقم الحجز '] || 
          row['Booking ID'] || 
          row['Booking Code'] || 
          row['Booking Number'] || 
          row['كود الحجز'] || 
          `B-IMP-${idx + 1}`
        ).trim();

        const clientNameRaw = String(
          row['اسم العميل'] || 
          row['العميل'] || 
          row['Client Name'] || 
          row['Customer'] || 
          'عميل غير محدد'
        ).trim();

        const clientPhoneRaw = String(
          row['رقم هاتف العميل'] || 
          row['رقم الهاتف'] || 
          row['الهاتف'] || 
          row['الجوال'] || 
          row['Phone'] || 
          row['Mobile'] || ''
        ).trim().replace(/\D/g, '');

        // معالجة التاريخ والوقت
        const rawDate = row['تاريخ الحجز (YYYY-MM-DD)'] || row['تاريخ الحجز'] || row['التاريخ'] || row['Date'] || row['Booking Date'];
        let dateParsed = '';
        try {
          const iso = parseExcelDate(rawDate);
          dateParsed = iso.split('T')[0];
        } catch {
          dateParsed = new Date().toISOString().split('T')[0];
        }

        let timeParsed = String(
          row['وقت الحجز (HH:mm)'] || 
          row['وقت الحجز'] || 
          row['الوقت'] || 
          row['Time'] || 
          '10:00'
        ).trim();
        // تنسيق الوقت
        if (!/^\d{1,2}:\d{2}$/.test(timeParsed)) {
          timeParsed = '10:00';
        } else {
          const [h, m] = timeParsed.split(':');
          timeParsed = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        }

        // الحالة
        const statusRaw = String(
          row['حالة الحجز (مؤكد/مكتمل/ملغي)'] || 
          row['حالة الحجز'] || 
          row['الحالة'] || 
          row['Status'] || 
          'مؤكد'
        ).trim().toLowerCase();

        let status: 'confirmed' | 'pending' | 'completed' | 'cancelled' = 'confirmed';
        if (statusRaw.includes('مكتمل') || statusRaw.includes('منتهي') || statusRaw.includes('completed')) {
          status = 'completed';
        } else if (statusRaw.includes('ملغ') || statusRaw.includes('cancel')) {
          status = 'cancelled';
        } else if (statusRaw.includes('انتظار') || statusRaw.includes('pending')) {
          status = 'pending';
        }

        // العربون والخزينة
        const advAmt = Math.max(0, Number(
          row['قيمة العربون'] || 
          row['العربون'] || 
          row['الدفعة المقدمة'] || 
          row['Advance'] || 
          row['Deposit'] || 0
        ) || 0);

        const advTreasury = String(
          row['الخزينة المستلمة للعربون'] || 
          row['الخزينة'] || 
          row['Treasury'] || 
          settings.treasuries[0]?.id || 'الخزينة الرئيسية'
        ).trim();

        const notes = String(row['ملاحظات'] || row['Notes'] || '').trim();

        // 3. تحليل خدمات الحجز التابعة
        const detailItemsRaw = servicesByBookingId.get(rowIdRaw) || [];
        const bookingServices: BookingService[] = [];
        let totalAmt = 0;

        detailItemsRaw.forEach((dRow: any, dIdx: number) => {
          const sName = String(
            dRow['اسم الخدمة'] || 
            dRow['الخدمة'] || 
            dRow['Service Name'] || 
            dRow['Service'] || 
            `خدمة ${dIdx + 1}`
          ).trim();

          const price = Math.max(0, Number(
            dRow['سعر الخدمة'] || 
            dRow['السعر'] || 
            dRow['Price'] || 0
          ) || 0);

          const techName = String(
            dRow['اسم الفني / الموظف'] || 
            dRow['اسم الموظف'] || 
            dRow['الفني'] || 
            dRow['الموظف'] || 
            dRow['Staff'] || 
            dRow['Technician'] || ''
          ).trim();

          // مطابقة الخدمة مع الخدمات المسجلة
          const matchedService = services.find(s => 
            s.name.trim().toLowerCase() === sName.toLowerCase()
          );

          // مطابقة الفني مع موظفي الصالون
          const matchedEmp = employees.find(e => 
            e.name.trim().toLowerCase() === techName.toLowerCase()
          );

          bookingServices.push({
            id: 'BS-' + Math.random().toString(36).substr(2, 9),
            serviceId: matchedService ? matchedService.id : ('SRV-' + Math.random().toString(36).substr(2, 7)),
            serviceName: matchedService ? matchedService.name : sName,
            price: price,
            technicianId: matchedEmp ? matchedEmp.id : (techName ? 'EMP-EXT' : ''),
            technicianName: matchedEmp ? matchedEmp.name : (techName || 'غير محدد')
          });

          totalAmt += price;
        });

        // قراءة إجمالي الحجز من ورقة رأس الحجز إن وجد
        const rawHeaderTotal = Math.max(0, Number(
          row['إجمالي مبلغ الحجز'] || 
          row['إجمالي مبلغ الحجز (ر.س)'] || 
          row['إجمالي الحجز'] || 
          row['المبلغ الإجمالي'] || 
          row['المجموع'] || 
          row['Total'] || 
          row['Total Amount'] || 0
        ) || 0);

        if (bookingServices.length === 0 && rawHeaderTotal > 0) {
          bookingServices.push({
            id: 'BS-' + Math.random().toString(36).substr(2, 9),
            serviceId: 'SRV-GEN',
            serviceName: 'خدمات حجز سابقة',
            price: rawHeaderTotal,
            technicianId: '',
            technicianName: 'غير محدد'
          });
          totalAmt = rawHeaderTotal;
        } else if (rawHeaderTotal > 0 && totalAmt === 0) {
          totalAmt = rawHeaderTotal;
        }

        // التحقق من الأخطاء
        const validationErrors: string[] = [];
        if (!clientNameRaw) validationErrors.push('اسم العميل مفقود');
        if (!clientPhoneRaw) validationErrors.push('رقم هاتف العميل مفقود أو غير صالح');
        if (!dateParsed) validationErrors.push('تاريخ الحجز غير صحيح');

        // هل الحجز مكرر؟
        const isExisting = existingBookings.some(b => 
          b.id === rowIdRaw || 
          b.bookingCode === rowIdRaw ||
          (b.clientName === clientNameRaw && b.date === dateParsed && b.time === timeParsed)
        );

        // هل العميل جديد؟
        const isNewClient = !clients.some(c => c.phone && c.phone.replace(/\D/g, '') === clientPhoneRaw);

        parsedList.push({
          id: rowIdRaw,
          date: dateParsed,
          time: timeParsed,
          clientName: clientNameRaw,
          clientPhone: clientPhoneRaw,
          status,
          notes,
          advanceAmount: advAmt,
          advanceTreasury: advTreasury,
          services: bookingServices,
          totalAmount: totalAmt,
          isExisting,
          isNewClient,
          validationErrors
        });
      });

      setCandidates(parsedList);
    } catch (err: any) {
      console.error('Error reading bookings excel:', err);
      setReadError(err?.message || 'حدث خطأ أثناء قراءة ملف إكسل. تأكد من مطابقة أسماء الأعمدة.');
    } finally {
      setIsReading(false);
    }
  };

  // الإحصائيات
  const stats = useMemo(() => {
    const total = candidates.length;
    const existing = candidates.filter(c => c.isExisting).length;
    const newBookings = total - existing;
    const withErrors = candidates.filter(c => c.validationErrors.length > 0).length;
    const newClientsCount = candidates.filter(c => c.isNewClient).length;
    const totalAmount = candidates.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalAdvances = candidates.reduce((sum, c) => sum + c.advanceAmount, 0);
    const totalServices = candidates.reduce((sum, c) => sum + c.services.length, 0);

    return { total, existing, newBookings, withErrors, newClientsCount, totalAmount, totalAdvances, totalServices };
  }, [candidates]);

  // الترشيح والبحث
  const filteredCandidates = useMemo(() => {
    if (!searchFilter.trim()) return candidates;
    const q = searchFilter.toLowerCase().trim();
    return candidates.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q) ||
      c.clientPhone.includes(q) ||
      c.services.some(s => s.serviceName.toLowerCase().includes(q) || s.technicianName.toLowerCase().includes(q))
    );
  }, [candidates, searchFilter]);

  // تنفيذ الاستيراد الفعلي
  const handleExecuteImport = async () => {
    const toImport = candidates.filter(c => {
      if (c.validationErrors.length > 0) return false;
      if (skipDuplicates && c.isExisting) return false;
      return true;
    });

    if (toImport.length === 0) {
      alert('لا توجد حجوزات صالحة للاستيراد وفق الخيارات الحالية.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: toImport.length });

    const newBookingsList: Booking[] = [];
    const newClientsList: Client[] = [];
    const newTransactionsList: Transaction[] = [];

    const effectiveBranchId = activeBranchId || (settings.branches && settings.branches[0]?.id) || 'main';

    for (let i = 0; i < toImport.length; i++) {
      const candidate = toImport[i];
      setImportProgress({ current: i + 1, total: toImport.length });

      // معالجة العربون
      const advances: AdvancePayment[] = [];
      if (candidate.advanceAmount > 0) {
        const advId = 'ADV-' + Math.random().toString(36).substr(2, 9);
        const treasuryObj = settings.treasuries?.find(t => 
          t.name.trim().toLowerCase() === candidate.advanceTreasury.toLowerCase() || t.id === candidate.advanceTreasury
        ) || settings.treasuries?.[0];

        advances.push({
          id: advId,
          amount: candidate.advanceAmount,
          date: candidate.date,
          method: 'cash',
          treasuryId: treasuryObj?.id || candidate.advanceTreasury,
          notes: `عربون مستورد لحجز #${candidate.id}`
        });

        // إنشاء قيد مالي للعربون
        const effectiveShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : candidate.date;
        const trx: Transaction = {
          id: 'TRX-ADV-' + Math.random().toString(36).substr(2, 9),
          date: `${candidate.date}T${candidate.time}:00`,
          shiftDate: effectiveShiftDate,
          type: 'in',
          amount: candidate.advanceAmount,
          category: 'مقدم حجز',
          description: `دفعة مقدمة / عربون مستورد لحجز #${candidate.id} - العميل: ${candidate.clientName}`,
          treasury: treasuryObj?.id || 'cash',
          createdBy: currentUser?.name || 'استيراد إكسل',
          userId: currentUser?.id,
          userName: currentUser?.name || 'استيراد إكسل',
          branchId: effectiveBranchId,
          salonId: settings.salonId
        };
        newTransactionsList.push(trx);
        try {
          await DB.saveTransaction(trx);
        } catch (e) {
          console.warn('Failed to save advance transaction:', e);
        }
      }

      // تجهيز كائن الحجز
      const booking: Booking = {
        id: candidate.id.startsWith('B-') ? candidate.id : `B-${candidate.id}`,
        bookingCode: candidate.id,
        clientName: candidate.clientName,
        phone: candidate.clientPhone,
        date: candidate.date,
        time: candidate.time,
        status: candidate.status,
        services: candidate.services,
        advancePayments: advances,
        totalAmount: candidate.totalAmount,
        notes: candidate.notes,
        branchId: effectiveBranchId,
        source: 'excel_import'
      };

      newBookingsList.push(booking);
      try {
        await DB.saveBooking(booking, settings.salonId);
      } catch (e) {
        console.error('Error saving imported booking:', e);
      }

      // إضافة العميل إذا كان جديداً
      if (candidate.isNewClient && candidate.clientPhone) {
        const clientAlreadyAdded = newClientsList.some(c => c.phone === candidate.clientPhone);
        if (!clientAlreadyAdded) {
          const newClient: Client = {
            id: 'cli-' + Math.random().toString(36).substr(2, 9),
            name: candidate.clientName,
            phone: candidate.clientPhone,
            isVip: false,
            loyaltyPoints: 0,
            cashback: 0,
            lastVisit: candidate.date,
            createdAt: new Date().toISOString(),
            notes: 'تمت إضافته تلقائياً عبر استيراد الحجوزات السابقة من إكسل'
          };
          newClientsList.push(newClient);
          try {
            await DB.saveClient(newClient, settings.salonId);
          } catch (e) {
            console.warn('Error saving new client from booking:', e);
          }
        }
      }
    }

    setIsImporting(false);
    onImportComplete(newBookingsList, newClientsList, newTransactionsList);
    onClose();
    alert(`🎉 تم استيراد ${newBookingsList.length} حجز بنجاح ومزامنتها مع قاعدة البيانات!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs font-sans overflow-hidden" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">سحب الحجوزات من ملف إكسل</h3>
                <span className="bg-emerald-400/20 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300/30">
                  نظام الورقتين المعتمد
                </span>
              </div>
              <p className="text-emerald-100 text-xs mt-0.5">
                استيراد رأس الحجز وتفاصيل الخدمات والربط التلقائي بالفنيين والعملاء والعربون
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadBookingsTemplate(settings.currency || 'ر.س')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/25 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="تنزيل ملف إكسل نموذجي معبأ بأمثلة صحيحة"
            >
              <Download size={14} />
              <span>تحميل ملف العينة المعتمد</span>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-slate-50/60">
          
          {/* File Picker Zone */}
          <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-400 transition-all text-center">
            <input
              type="file"
              id="bookings-excel-upload"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isReading || isImporting}
              className="hidden"
            />
            <label 
              htmlFor="bookings-excel-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2 py-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                {isReading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">
                  {fileName ? `الملف المحدد: ${fileName}` : 'اضغط لاختيار ملف إكسل الحجوزات أو اسحبه هنا'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم الملفات ذات الورقتين (ورقة رأس الحجز + ورقة تفاصيل الحجز) بصيغة .xlsx
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

          {/* Statistics Bar (If data parsed) */}
          {candidates.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-bold block">إجمالي الحجوزات</span>
                <span className="text-lg font-black text-slate-900">{stats.total}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[11px] text-emerald-700 font-bold block">حجوزات جديدة</span>
                <span className="text-lg font-black text-emerald-800">{stats.newBookings}</span>
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 shadow-2xs">
                <span className="text-[11px] text-amber-700 font-bold block">مكررة بالنظام</span>
                <span className="text-lg font-black text-amber-800">{stats.existing}</span>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 shadow-2xs">
                <span className="text-[11px] text-blue-700 font-bold block">إجمالي الخدمات</span>
                <span className="text-lg font-black text-blue-800">{stats.totalServices}</span>
              </div>
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 shadow-2xs">
                <span className="text-[11px] text-purple-700 font-bold block">عملاء جدد</span>
                <span className="text-lg font-black text-purple-800">{stats.newClientsCount}</span>
              </div>
              <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 shadow-2xs">
                <span className="text-[11px] text-indigo-700 font-bold block">مجموع العربون</span>
                <span className="text-sm font-black text-indigo-900">{stats.totalAdvances} {settings.currency}</span>
              </div>
              <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-700 font-bold block">إجمالي المبالغ</span>
                <span className="text-sm font-black text-slate-900">{stats.totalAmount} {settings.currency}</span>
              </div>
            </div>
          )}

          {/* Options & Search Toolbar */}
          {candidates.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>تخطي الحجوزات المكررة المسجلة مسبقاً ({stats.existing})</span>
                </label>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="بحث برقم الحجز، العميل، الخدمة..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          )}

          {/* Progress Bar (during bulk import) */}
          {isImporting && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-emerald-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>جارٍ استيراد الحجوزات والمزامنة السحابية...</span>
                </span>
                <span>{importProgress.current} من {importProgress.total}</span>
              </div>
              <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / Math.max(1, importProgress.total)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Preview Table */}
          {candidates.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">رقم الحجز</th>
                      <th className="py-2.5 px-3">التاريخ والوقت</th>
                      <th className="py-2.5 px-3">العميل والجوال</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3 text-center">الخدمات ({stats.totalServices})</th>
                      <th className="py-2.5 px-3">العربون</th>
                      <th className="py-2.5 px-3">الإجمالي</th>
                      <th className="py-2.5 px-3 text-center">المطابقة والتفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCandidates.map((c) => {
                      const isExpanded = expandedBookingId === c.id;
                      const hasErr = c.validationErrors.length > 0;

                      return (
                        <React.Fragment key={c.id}>
                          <tr className={`hover:bg-slate-50 transition-colors ${c.isExisting ? 'bg-amber-50/30' : ''} ${hasErr ? 'bg-rose-50/40' : ''}`}>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {c.id}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800">{c.date}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{c.time}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{c.clientName}</span>
                                {c.isNewClient && (
                                  <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                                    جديد
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">{c.clientPhone}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                c.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                                c.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {c.status === 'completed' ? 'مكتمل' :
                                 c.status === 'cancelled' ? 'ملغي' :
                                 c.status === 'pending' ? 'انتظار' : 'مؤكد'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => setExpandedBookingId(isExpanded ? null : c.id)}
                                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                <Scissors size={12} className="text-emerald-600" />
                                <span>{c.services.length} خدمة</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-indigo-700">
                              {c.advanceAmount > 0 ? `${c.advanceAmount} ${settings.currency}` : '--'}
                            </td>
                            <td className="py-2.5 px-3 font-black text-slate-900">
                              {c.totalAmount} {settings.currency}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {hasErr ? (
                                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-bold" title={c.validationErrors.join(', ')}>
                                  <AlertCircle size={11} /> خطأ بالبيانات
                                </span>
                              ) : c.isExisting ? (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  <AlertTriangle size={11} /> مسجل مسبقاً
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  <CheckCircle2 size={11} /> جاهز للاستيراد
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Service Details */}
                          {isExpanded && (
                            <tr className="bg-slate-100/70">
                              <td colSpan={8} className="p-3">
                                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5">
                                    <span>تفاصيل خدمات الحجز #{c.id}</span>
                                    {c.notes && <span className="text-[11px] text-slate-500 font-normal">ملاحظات: {c.notes}</span>}
                                  </div>
                                  {c.services.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-1">لا توجد أسطر خدمات مرفقة في الورقة الثانية لهذا الحجز.</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {c.services.map((srv, sIdx) => (
                                        <div key={sIdx} className="bg-slate-50 border border-slate-200/80 p-2 rounded-lg flex items-center justify-between text-xs">
                                          <div>
                                            <span className="font-bold text-slate-800 block">{srv.serviceName}</span>
                                            <span className="text-[10px] text-slate-500">الفني: {srv.technicianName}</span>
                                          </div>
                                          <span className="font-black text-emerald-700">{srv.price} {settings.currency}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="text-xs text-slate-500">
            {candidates.length > 0 && (
              <span>
                سيتم استيراد <strong className="text-emerald-700">{candidates.filter(c => !c.validationErrors.length && (!skipDuplicates || !c.isExisting)).length}</strong> حجز من إجمالي <strong>{candidates.length}</strong>
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
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={16} />}
              <span>تأكيد سحب الحجوزات وحفظها في قاعدة البيانات</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
