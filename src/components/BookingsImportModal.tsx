import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  X, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Users, DollarSign,
  Calendar, Scissors, Info, ArrowRight, Eye, Clock, ShieldCheck, MapPin
} from 'lucide-react';
import { AppSettings, Booking, BookingService, AdvancePayment, Client, Employee, ServiceItem, Transaction, Branch } from '../types';
import { readTwoSheetExcelFile, downloadBookingsTemplate, parseExcelDate, parseExcelTime, getTodayLocalDateString } from '../utils/excelHelper';
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
  location?: string;
  notes: string;
  advanceAmount: number;
  advanceTreasury: string;
  advances: AdvancePayment[];
  services: BookingService[];
  totalAmount: number;
  isExisting: boolean;
  isNewClient: boolean;
  validationErrors: string[];
}

function safeParseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/,/g, '')
    .trim();
  const match = str.match(/-?\d+(\.\d+)?/);
  if (match) {
    const parsed = parseFloat(match[0]);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function extractBookingItemPrice(dRow: any): number {
  if (!dRow || typeof dRow !== 'object') return 0;

  const exactKeys = [
    'سعر الخدمة', 'سعر الخدمه', 'سعر الخدمة (ر.س)', 'سعر الخدمه (ر.س)', 'سعر الخدمة (ج.م)', 'سعر الخدمه (ج.م)',
    'السعر', 'السعر (ر.س)', 'السعر (ج.م)', 'سعر',
    'المبلغ', 'المبلغ (ر.س)', 'المبلغ (ج.م)', 'القيمة', 'القيمه',
    'Price', 'price', 'Amount', 'amount', 'Service Price'
  ];

  for (const k of exactKeys) {
    if (dRow[k] !== undefined && dRow[k] !== null && dRow[k] !== '') {
      const num = safeParseNumber(dRow[k]);
      if (num > 0) return num;
    }
  }

  for (const key of Object.keys(dRow)) {
    const val = dRow[key];
    if (val === undefined || val === null || val === '') continue;

    const cleanKey = key.trim().toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ةه]/g, 'ه')
      .replace(/[\(\)\[\]\/\-\_]/g, ' ')
      .replace(/\s+/g, ' ');

    if (cleanKey.includes('خصم') || cleanKey.includes('عربون') || cleanKey.includes('كمي') || cleanKey.includes('عدد')) continue;

    if (
      cleanKey.includes('سعر الخدمه') ||
      cleanKey.includes('سعر') ||
      cleanKey === 'السعر' ||
      cleanKey.includes('price') ||
      cleanKey === 'amount'
    ) {
      const num = safeParseNumber(val);
      if (num > 0) return num;
    }
  }

  return 0;
}

function extractBookingHeaderTotal(hRow: any): number {
  if (!hRow || typeof hRow !== 'object') return 0;

  const exactKeys = [
    'إجمالي مبلغ الحجز', 'اجمالي مبلغ الحجز', 'إجمالي مبلغ الحجز (ر.س)', 'اجمالي مبلغ الحجز (ر.س)', 'إجمالي مبلغ الحجز (ج.م)', 'اجمالي مبلغ الحجز (ج.م)',
    'إجمالي الحجز', 'اجمالي الحجز', 'إجمالي الحجز (ر.س)', 'اجمالي الحجز (ر.س)', 'إجمالي الحجز (ج.م)', 'اجمالي الحجز (ج.م)',
    'المبلغ الإجمالي', 'المبلغ الاجمالي', 'المبلغ الإجمالي (ر.س)', 'المبلغ الاجمالي (ر.س)', 'المبلغ الإجمالي (ج.م)', 'المبلغ الاجمالي (ج.م)',
    'إجمالي المبلغ', 'اجمالي المبلغ', 'إجمالي المبلغ (ر.س)', 'اجمالي المبلغ (ر.س)', 'إجمالي المبلغ (ج.م)', 'اجمالي المبلغ (ج.م)',
    'المبلغ', 'المبلغ (ر.س)', 'المبلغ (ج.م)', 'المجموع', 'المجموع (ر.س)', 'المجموع (ج.م)', 'الإجمالي', 'الاجمالي',
    'Total', 'Total Amount', 'Booking Total', 'Grand Total', 'Amount'
  ];

  for (const k of exactKeys) {
    if (hRow[k] !== undefined && hRow[k] !== null && hRow[k] !== '') {
      const num = safeParseNumber(hRow[k]);
      if (num > 0) return num;
    }
  }

  for (const key of Object.keys(hRow)) {
    const val = hRow[key];
    if (val === undefined || val === null || val === '') continue;

    const cleanKey = key.trim().toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ةه]/g, 'ه')
      .replace(/[\(\)\[\]\/\-\_]/g, ' ')
      .replace(/\s+/g, ' ');

    if (
      cleanKey.includes('خصم') || 
      cleanKey.includes('عربون') || 
      cleanKey.includes('هاتف') || 
      cleanKey.includes('جوال') || 
      cleanKey.includes('تاريخ') || 
      cleanKey.includes('وقت') || 
      cleanKey.includes('رقم')
    ) {
      continue;
    }

    if (
      cleanKey.includes('اجمالي مبلغ الحجز') || 
      cleanKey.includes('اجمالي الحجز') || 
      cleanKey.includes('المبلغ الاجمالي') || 
      cleanKey.includes('اجمالي المبلغ') || 
      cleanKey.includes('اجمالي') || 
      cleanKey.includes('مجموع') || 
      cleanKey === 'مبلغ' || 
      cleanKey === 'المبلغ' || 
      cleanKey === 'total' || 
      cleanKey === 'booking total' || 
      cleanKey === 'total amount' || 
      cleanKey === 'amount'
    ) {
      const num = safeParseNumber(val);
      if (num > 0) return num;
    }
  }

  return 0;
}

function extractRowAdvances(row: any, bookingDate: string, bookingCode: string, treasuries: any[] = []): AdvancePayment[] {
  const result: AdvancePayment[] = [];

  const resolvePaymentMethodAndTreasury = (rawVal: any, defaultType: 'cash' | 'card') => {
    const val = String(rawVal || '').trim();
    const lower = val.toLowerCase()
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ةه]/g, 'ه');

    if (val) {
      // مطابقة مباشرة مع اسم أو معرف أي خزينة من إعدادات الصالون
      const matched = treasuries.find(t => 
        (t.id && t.id.toLowerCase() === lower) || 
        (t.name && t.name.trim().toLowerCase().replace(/[إأآا]/g, 'ا').replace(/[ةه]/g, 'ه') === lower)
      );
      if (matched) {
        const isCard = (matched.id && (matched.id.includes('card') || matched.id.includes('mada') || matched.id.includes('bank'))) || 
                       (matched.name && (matched.name.includes('شبكة') || matched.name.includes('مدى') || matched.name.includes('بنك') || matched.name.includes('تحويل')));
        return {
          treasuryId: matched.id,
          treasuryName: matched.name,
          paymentMethod: isCard ? 'card' : 'cash'
        };
      }

      if (
        lower.includes('شبك') || lower.includes('مدى') || lower.includes('بطاق') || 
        lower.includes('card') || lower.includes('mada') || lower.includes('bank') || 
        lower.includes('بنك') || lower.includes('تحويل') || lower.includes('فيزا') || 
        lower.includes('visa') || lower.includes('master') || lower.includes('انستاباي') || 
        lower.includes('instapay') || lower.includes('فودافون') || lower.includes('vodafone') || 
        lower.includes('فوري') || lower.includes('fawry') || lower.includes('stc')
      ) {
        const cardTreasury = treasuries.find(t => 
          t.id?.includes('card') || t.id?.includes('mada') || t.id?.includes('bank') || 
          t.name?.includes('شبكة') || t.name?.includes('مدى') || t.name?.includes('بنك')
        );
        return {
          treasuryId: cardTreasury?.id || 'card',
          treasuryName: cardTreasury?.name || (lower.includes('تحويل') || lower.includes('بنك') ? 'تحويل بنكي' : 'شبكة / مدى'),
          paymentMethod: 'card'
        };
      }

      if (
        lower.includes('كاش') || lower.includes('نقد') || lower.includes('درج') || 
        lower.includes('cash') || lower.includes('خزينه') || lower.includes('خزينة')
      ) {
        const cashTreasury = treasuries.find(t => 
          t.id === 'cash' || t.name?.includes('كاش') || t.name?.includes('درج') || t.name?.includes('نقد')
        ) || treasuries.find(t => !t.isMain);
        return {
          treasuryId: cashTreasury?.id || 'cash',
          treasuryName: cashTreasury?.name || 'كاش (الدرج)',
          paymentMethod: 'cash'
        };
      }
    }

    if (defaultType === 'card') {
      const cardTreasury = treasuries.find(t => t.id?.includes('card') || t.id?.includes('mada') || t.name?.includes('شبكة') || t.name?.includes('مدى'));
      return {
        treasuryId: cardTreasury?.id || 'card',
        treasuryName: cardTreasury?.name || 'شبكة / مدى',
        paymentMethod: 'card'
      };
    } else {
      const cashTreasury = treasuries.find(t => t.id === 'cash' || t.name?.includes('كاش') || t.name?.includes('درج')) || treasuries.find(t => !t.isMain) || treasuries[0];
      return {
        treasuryId: cashTreasury?.id || 'cash',
        treasuryName: cashTreasury?.name || 'كاش (الدرج)',
        paymentMethod: 'cash'
      };
    }
  };

  const findValue = (candidates: string[], isSingleMode: boolean = false) => {
    for (const key of Object.keys(row)) {
      const clean = key.trim().toLowerCase()
        .replace(/[إأآا]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[\(\)\[\]\/\-\_]/g, ' ')
        .replace(/\s+/g, ' ');

      if (isSingleMode && (/\b1\b|1|١|\b2\b|2|٢/.test(clean))) {
        continue;
      }

      for (const cand of candidates) {
        const cleanCand = cand.trim().toLowerCase()
          .replace(/[إأآا]/g, 'ا')
          .replace(/[ةه]/g, 'ه')
          .replace(/[\(\)\[\]\/\-\_]/g, ' ')
          .replace(/\s+/g, ' ');
        if (clean === cleanCand || clean.includes(cleanCand)) {
          const val = row[key];
          if (val !== undefined && val !== null && val !== '') return val;
        }
      }
    }
    return undefined;
  };

  // 1. عربون 1 وطريقة دفع 1
  const rawAdv1 = findValue([
    'عربون 1', 'عربون1', 'العربون 1', 'العربون1', 
    'قيمة عربون 1', 'قيمه عربون 1', 'قيمة العربون 1', 'قيمه العربون 1', 
    'مبلغ عربون 1', 'مبلغ العربون 1',
    'advance 1', 'deposit 1', 'advance payment 1', 'down payment 1'
  ]);
  const amt1 = safeParseNumber(rawAdv1);
  const rawMethod1 = findValue([
    'طريقة دفع 1', 'طريقه دفع 1', 'طريقة الدفع 1', 'طريقه الدفع 1', 
    'خزينة 1', 'خزينه 1', 'الخزينة 1', 'الخزينه 1', 
    'طريقة دفع عربون 1', 'طريقه دفع عربون 1',
    'payment method 1', 'treasury 1', 'method 1'
  ]);

  if (amt1 > 0) {
    const { treasuryId, treasuryName, paymentMethod } = resolvePaymentMethodAndTreasury(rawMethod1, 'cash');
    result.push({
      id: `ADV-${bookingCode || 'IMP'}-1-${Math.random().toString(36).substr(2, 6)}`,
      date: bookingDate,
      amount: amt1,
      treasuryId,
      treasuryName,
      paymentMethod
    });
  }

  // 2. عربون 2 وطريقة دفع 2
  const rawAdv2 = findValue([
    'عربون 2', 'عربون2', 'العربون 2', 'العربون2', 
    'قيمة عربون 2', 'قيمه عربون 2', 'قيمة العربون 2', 'قيمه العربون 2', 
    'مبلغ عربون 2', 'مبلغ العربون 2',
    'advance 2', 'deposit 2', 'advance payment 2', 'down payment 2'
  ]);
  const amt2 = safeParseNumber(rawAdv2);
  const rawMethod2 = findValue([
    'طريقة دفع 2', 'طريقه دفع 2', 'طريقة الدفع 2', 'طريقه الدفع 2', 
    'خزينة 2', 'خزينه 2', 'الخزينة 2', 'الخزينه 2', 
    'طريقة دفع عربون 2', 'طريقه دفع عربون 2',
    'payment method 2', 'treasury 2', 'method 2'
  ]);

  if (amt2 > 0) {
    const { treasuryId, treasuryName, paymentMethod } = resolvePaymentMethodAndTreasury(rawMethod2, 'card');
    result.push({
      id: `ADV-${bookingCode || 'IMP'}-2-${Math.random().toString(36).substr(2, 6)}`,
      date: bookingDate,
      amount: amt2,
      treasuryId,
      treasuryName,
      paymentMethod
    });
  }

  // 3. عربون مفرد تقليدي (في حال عدم وجود عربون 1 أو 2)
  if (result.length === 0) {
    const rawSingleAdv = findValue([
      'قيمة العربون', 'قيمه العربون', 'العربون', 'عربون', 
      'الدفعة المقدمة', 'الدفعه المقدمه', 'دفعة مقدمة', 'دفعه مقدمه',
      'advance', 'deposit', 'down payment'
    ], true);
    const singleAmt = safeParseNumber(rawSingleAdv);
    if (singleAmt > 0) {
      const rawSingleMethod = findValue([
        'الخزينة المستلمة للعربون', 'الخزينه المستلمه للعربون', 'الخزينة', 'الخزينه', 
        'طريقة الدفع', 'طريقه الدفع', 'طريقة دفع', 'طريقه دفع', 
        'treasury', 'payment method'
      ], true);
      const { treasuryId, treasuryName, paymentMethod } = resolvePaymentMethodAndTreasury(rawSingleMethod, 'cash');
      result.push({
        id: `ADV-${bookingCode || 'IMP'}-${Math.random().toString(36).substr(2, 6)}`,
        date: bookingDate,
        amount: singleAmt,
        treasuryId,
        treasuryName,
        paymentMethod
      });
    }
  }

  return result;
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
          row['رقم الجوال'] || 
          row['رقم جوال العميل'] || 
          row['الموبايل'] || 
          row['موبايل'] || 
          row['تليفون'] || 
          row['رقم التليفون'] || 
          row['Phone'] || 
          row['Mobile'] || ''
        ).trim().replace(/\D/g, '');

        // معالجة التاريخ والوقت (تجريد أي Timezone والاعتماد على YYYY-MM-DD محلي بحت)
        const rawDate = row['تاريخ الحجز (YYYY-MM-DD)'] || row['تاريخ الحجز'] || row['التاريخ'] || row['Date'] || row['Booking Date'];
        let dateParsed = '';
        try {
          dateParsed = parseExcelDate(rawDate);
        } catch {
          dateParsed = getTodayLocalDateString();
        }

        const rawTime = row['وقت الحجز (HH:mm)'] || 
          row['وقت الحجز'] || 
          row['الوقت'] || 
          row['Time'] || 
          row['Booking Time'] ||
          '10:00';
        const timeParsed = parseExcelTime(rawTime, '10:00');

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

        // مكان الحجز (اختياري)
        const locationRaw = String(
          row['مكان الحجز (اختياري)'] || 
          row['مكان الحجز'] || 
          row['المكان'] || 
          row['الموقع'] || 
          row['مكان'] || 
          row['Location'] || 
          row['Venue'] || ''
        ).trim();

        // العربون والخزينة (سحب عربون 1 وعربون 2 وطرق الدفع أو العربون المفرد)
        const rowAdvances = extractRowAdvances(row, dateParsed, rowIdRaw, settings.treasuries || []);
        const advAmt = rowAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
        const advTreasury = rowAdvances.length > 0 
          ? rowAdvances.map(a => `${a.treasuryName}: ${a.amount}`).join(' + ')
          : 'كاش (الدرج)';

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

          const price = extractBookingItemPrice(dRow);

          const techName = String(
            dRow['اسم الفني / الموظف (اختياري)'] ||
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

          // مطابقة الفني مع موظفي الصالون (يدعم اختيار افتراضي "غير محدد" واختياري)
          const isUnassignedTech = !techName || techName === 'غير محدد' || techName === '(غير محدد)';
          const matchedEmp = !isUnassignedTech ? employees.find(e => 
            e.name.trim().toLowerCase() === techName.toLowerCase()
          ) : null;

          bookingServices.push({
            id: 'BS-' + Math.random().toString(36).substr(2, 9),
            serviceId: matchedService ? matchedService.id : ('SRV-' + Math.random().toString(36).substr(2, 7)),
            serviceName: matchedService ? matchedService.name : sName,
            price: price,
            technicianId: matchedEmp ? matchedEmp.id : '',
            technicianName: matchedEmp ? matchedEmp.name : (isUnassignedTech ? 'غير محدد' : techName)
          });

          totalAmt += price;
        });

        // قراءة إجمالي الحجز من ورقة رأس الحجز إن وجد
        const rawHeaderTotal = extractBookingHeaderTotal(row);

        if (rawHeaderTotal > 0) {
          if (bookingServices.length === 0) {
            bookingServices.push({
              id: 'BS-' + Math.random().toString(36).substr(2, 9),
              serviceId: 'SRV-GEN',
              serviceName: 'خدمات حجز سابقة',
              price: rawHeaderTotal,
              technicianId: '',
              technicianName: 'غير محدد'
            });
            totalAmt = rawHeaderTotal;
          } else if (totalAmt === 0) {
            bookingServices[0].price = rawHeaderTotal;
            totalAmt = rawHeaderTotal;
          } else {
            totalAmt = rawHeaderTotal;
          }
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
          location: locationRaw || undefined,
          notes,
          advanceAmount: advAmt,
          advanceTreasury: advTreasury,
          advances: rowAdvances,
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

      // معالجة العربون والخزينة
      const apptTime = candidate.time && candidate.time.length === 5 ? `${candidate.time}:00` : (candidate.time || '10:00:00');
      const appointmentDateTime = `${candidate.date}T${apptTime}`;

      const advances: AdvancePayment[] = (candidate.advances && candidate.advances.length > 0)
        ? candidate.advances
        : [];

      // إذا كانت مصفوفة العرابين فارغة ولكن يوجد مبلغ عربون إجمالي
      if (advances.length === 0 && candidate.advanceAmount > 0) {
        advances.push({
          id: `ADV-${candidate.id}-${Math.random().toString(36).substr(2, 6)}`,
          date: candidate.date,
          amount: candidate.advanceAmount,
          treasuryId: 'cash',
          treasuryName: 'كاش (الدرج)',
          paymentMethod: 'cash'
        });
      }

      // إنشاء قيد مالي لكل عربون في الخزينة المعنية وتاريخ الوردية
      const effectiveShiftDate = (shiftData && shiftData.isOpen && shiftData.date) ? shiftData.date : candidate.date;
      for (const adv of advances) {
        if (adv.amount > 0) {
          const trx: Transaction = {
            id: 'TRX-' + (adv.id || Math.random().toString(36).substr(2, 9)),
            date: appointmentDateTime,
            shiftDate: effectiveShiftDate,
            type: 'in',
            amount: adv.amount,
            category: 'مقدم حجز',
            description: `دفعة مقدمة / عربون مستورد لحجز #${candidate.id} (${adv.treasuryName || adv.paymentMethod}) - العميل: ${candidate.clientName}`,
            treasury: adv.treasuryId || 'cash',
            paymentMethod: adv.paymentMethod || 'cash',
            createdBy: currentUser?.name || 'استيراد إكسل',
            userId: currentUser?.id,
            userName: currentUser?.name || 'استيراد إكسل',
            branchId: effectiveBranchId,
            salonId: settings.salonId,
            relatedBookingId: candidate.id.startsWith('B-') ? candidate.id : `B-${candidate.id}`
          };
          newTransactionsList.push(trx);
          try {
            await DB.saveTransaction(trx);
          } catch (e) {
            console.warn('Failed to save advance transaction:', e);
          }
        }
      }

      // تجهيز كائن الحجز مع تثبيت توقيت الموعد المحلي التام
      const booking: Booking = {
        id: candidate.id.startsWith('B-') ? candidate.id : `B-${candidate.id}`,
        salonId: settings.salonId,
        bookingCode: candidate.id,
        clientName: candidate.clientName,
        phone: candidate.clientPhone || '0000000000',
        date: candidate.date,
        time: candidate.time,
        status: candidate.status,
        location: candidate.location || undefined,
        services: candidate.services,
        advancePayments: advances,
        totalAmount: candidate.totalAmount,
        notes: candidate.notes,
        branchId: effectiveBranchId,
        source: 'pos',
        createdAt: appointmentDateTime
      };

      try {
        const saved = await DB.saveBooking(booking, settings.salonId);
        if (saved) {
          newBookingsList.push(booking);
        } else {
          console.error('Failed to save imported booking to DB:', booking.id);
        }
      } catch (e) {
        console.error('Error saving imported booking:', e);
      }

      // إضافة العميل إذا كان جديداً
      if (candidate.isNewClient && candidate.clientPhone) {
        const clientAlreadyAdded = newClientsList.some(c => c.phone === candidate.clientPhone);
        if (!clientAlreadyAdded) {
          const newClient: Client = {
            id: 'cli-' + Math.random().toString(36).substr(2, 9),
            salonId: settings.salonId,
            branchId: effectiveBranchId,
            name: candidate.clientName,
            phone: candidate.clientPhone,
            isVip: false,
            loyaltyPoints: 0,
            cashback: 0,
            lastVisit: candidate.date,
            createdAt: `${candidate.date}T12:00:00`,
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
    if (newBookingsList.length > 0) {
      alert(`🎉 تم استيراد ${newBookingsList.length} حجز بنجاح ومزامنتها مع قاعدة البيانات!`);
    } else {
      alert('⚠️ لم يتم حفظ أي حجز. يرجى التحقق من صحة البيانات وسجلات الأخطاء.');
    }
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

          {/* Guide / Instructions for Excel Structure */}
          {candidates.length === 0 && !isReading && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Info size={16} />
                  </div>
                  <h4 className="text-xs font-black text-slate-800">
                    دليل هيكل ملف الإكسل المعتمد لسحب الحجوزات:
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => downloadBookingsTemplate(settings.currency || 'ر.س')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <Download size={13} />
                  <span>تنزيل ملف العينة (.xlsx)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Sheet 1: Header */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                      <span>ورقة «رأس الحجز»</span>
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">البيانات العامة</span>
                  </div>
                  <ul className="text-slate-600 text-[11px] space-y-1 list-disc list-inside">
                    <li><strong className="text-slate-800">رقم الحجز:</strong> كود فريد لكل حجز (مثال: B-1001).</li>
                    <li><strong className="text-slate-800">تاريخ الحجز:</strong> بصيغة (YYYY-MM-DD).</li>
                    <li><strong className="text-slate-800">وقت الحجز:</strong> بصيغة (HH:mm) مثل 14:30.</li>
                    <li><strong className="text-slate-800">اسم وجوال العميل:</strong> لحفظ وربط العميل تلقائياً.</li>
                    <li><strong className="text-slate-800">حالة الحجز:</strong> (مؤكد / مكتمل / ملغي / انتظار).</li>
                    <li><strong className="text-indigo-600">مكان الحجز (اختياري):</strong> داخل الصالون، منزل العميل، فندق...</li>
                    <li><strong className="text-emerald-700">عربون 1 وطريقة دفع 1:</strong> المبلغ + طريقة الدفع (كاش/شبكة/تحويل).</li>
                    <li><strong className="text-emerald-700">عربون 2 وطريقة دفع 2:</strong> عربون إضافي اختياري بطريقة دفع مستقلة.</li>
                  </ul>
                </div>

                {/* Sheet 2: Details */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                      <span>ورقة «تفاصيل الحجز»</span>
                    </span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">الخدمات والفنيين</span>
                  </div>
                  <ul className="text-slate-600 text-[11px] space-y-1 list-disc list-inside">
                    <li><strong className="text-slate-800">رقم الحجز:</strong> نفس كود الحجز من الورقة الأولى للربط.</li>
                    <li><strong className="text-slate-800">اسم الخدمة:</strong> اسم الخدمة المطلوب تنفيذها.</li>
                    <li><strong className="text-slate-800">سعر الخدمة:</strong> القيمة المالية للخدمة.</li>
                    <li><strong className="text-indigo-600">اسم الفني / الموظف (اختياري):</strong> اسم الموظف المنفذ، ويمكن تركه فارغاً أو كتابة (غير محدد) ليتم اعتماده كحجز بدون فني محدد.</li>
                  </ul>
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800">
                    💡 <strong>ملاحظة هامة:</strong> يتم قراءة العرابين وتوزيعها تلقائياً على القيود المالية للخزائن، وخصمها من الفاتورة عند تحويل الحجز إلى POS.
                  </div>
                </div>
              </div>
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
                      <th className="py-2.5 px-3">مكان الحجز</th>
                      <th className="py-2.5 px-3 text-center">الخدمات ({stats.totalServices})</th>
                      <th className="py-2.5 px-3">العربون (1 و 2)</th>
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
                            <td className="py-2.5 px-3">
                              {c.location ? (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-200">
                                  <MapPin size={11} className="text-indigo-600" />
                                  <span>{c.location}</span>
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
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
                            <td className="py-2.5 px-3">
                              {c.advanceAmount > 0 ? (
                                <div>
                                  <div className="font-bold text-emerald-700">{c.advanceAmount} {settings.currency}</div>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {c.advances.map((adv, aIdx) => (
                                      <span key={aIdx} className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                                        ع{aIdx + 1}: {adv.amount} ({adv.treasuryName || adv.paymentMethod})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono">--</span>
                              )}
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
                              <td colSpan={9} className="p-3">
                                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-3">
                                      <span>تفاصيل خدمات الحجز #{c.id}</span>
                                      {c.location && (
                                        <span className="flex items-center gap-1 text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                          <MapPin size={12} />
                                          <span>مكان الحجز: {c.location}</span>
                                        </span>
                                      )}
                                    </div>
                                    {c.notes && <span className="text-[11px] text-slate-500 font-normal">ملاحظات: {c.notes}</span>}
                                  </div>

                                  {/* Services Cards */}
                                  {c.services.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-1">لا توجد أسطر خدمات مرفقة في الورقة الثانية لهذا الحجز.</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {c.services.map((srv, sIdx) => (
                                        <div key={sIdx} className="bg-slate-50 border border-slate-200/80 p-2 rounded-lg flex items-center justify-between text-xs">
                                          <div>
                                            <span className="font-bold text-slate-800 block">{srv.serviceName}</span>
                                            <span className="text-[10px] text-slate-500">
                                              الفني: <strong className={srv.technicianName === 'غير محدد' ? 'text-amber-600' : 'text-slate-700'}>{srv.technicianName}</strong>
                                            </span>
                                          </div>
                                          <span className="font-black text-emerald-700">{srv.price} {settings.currency}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Advances Breakdown Cards if advances exist */}
                                  {c.advances.length > 0 && (
                                    <div className="border-t border-slate-100 pt-2 flex flex-wrap items-center gap-2 text-xs">
                                      <span className="font-bold text-slate-700 text-[11px]">العرابين المقيدة:</span>
                                      {c.advances.map((adv, aIdx) => (
                                        <div key={aIdx} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5 font-bold">
                                          <span>عربون {aIdx + 1}:</span>
                                          <span className="font-mono">{adv.amount} {settings.currency}</span>
                                          <span className="text-slate-400">|</span>
                                          <span className="text-emerald-700 font-semibold">{adv.treasuryName || adv.paymentMethod}</span>
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
