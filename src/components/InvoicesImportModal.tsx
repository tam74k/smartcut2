import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  X, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Users, DollarSign,
  Receipt, Scissors, Tag, Info, ArrowRight, Eye
} from 'lucide-react';
import { AppSettings, Invoice, InvoiceItem, Client, Employee, ServiceItem, Product } from '../types';
import { readTwoSheetExcelFile, downloadInvoicesTemplate, parseExcelDate } from '../utils/excelHelper';
import { DB } from '../services/db';

interface InvoicesImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  existingInvoices: Invoice[];
  onImportComplete: (newInvoices: Invoice[], newClients: Client[]) => void;
  clients?: Client[];
  employees?: Employee[];
  services?: ServiceItem[];
  products?: Product[];
  activeBranchId?: string;
  currentUser?: any;
}

interface ParsedInvoiceCandidate {
  id: string;
  date: string;
  clientName: string;
  clientPhone: string;
  paymentMethod: string;
  discount: number;
  status: 'completed' | 'unpaid' | 'cancelled';
  notes: string;
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  isExisting: boolean;
  isNewClient: boolean;
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

function extractItemUnitPrice(dRow: any): number {
  if (!dRow || typeof dRow !== 'object') return 0;

  const exactKeys = [
    'سعر الوحدة', 'سعر الوحده', 'سعر الوحدة (ر.س)', 'سعر الوحده (ر.س)', 'سعر الوحدة (ج.م)', 'سعر الوحده (ج.م)',
    'سعر الخدمة', 'سعر الخدمه', 'سعر الخدمة (ر.س)', 'سعر الخدمه (ر.س)', 'سعر الخدمة (ج.م)', 'سعر الخدمه (ج.م)',
    'سعر المنتج', 'سعر المنتج (ر.س)', 'سعر المنتج (ج.م)',
    'السعر', 'السعر (ر.س)', 'السعر (ج.م)', 'سعر',
    'المبلغ', 'المبلغ (ر.س)', 'المبلغ (ج.م)', 'القيمة', 'القيمه',
    'Unit Price', 'Price', 'UnitPrice', 'price', 'amount', 'Amount'
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

    if (cleanKey.includes('خصم') || cleanKey.includes('كمي') || cleanKey.includes('عدد')) continue;

    if (
      cleanKey.includes('سعر الوحده') ||
      cleanKey.includes('سعر الخدمه') ||
      cleanKey.includes('سعر المنتج') ||
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

function extractInvoiceHeaderTotal(hRow: any): number {
  if (!hRow || typeof hRow !== 'object') return 0;

  const exactKeys = [
    'إجمالي الفاتورة', 'اجمالي الفاتورة', 'اجمالي الفاتوره', 'إجمالي الفاتوره',
    'إجمالي الفاتورة (ر.س)', 'اجمالي الفاتورة (ر.س)', 'اجمالي الفاتوره (ر.س)', 'إجمالي الفاتوره (ر.س)',
    'إجمالي الفاتورة (ج.م)', 'اجمالي الفاتورة (ج.م)', 'اجمالي الفاتوره (ج.م)', 'إجمالي الفاتوره (ج.م)',
    'إجمالي المبلغ', 'اجمالي المبلغ', 'إجمالي المبلغ (ر.س)', 'اجمالي المبلغ (ر.س)', 'إجمالي المبلغ (ج.م)', 'اجمالي المبلغ (ج.م)',
    'المبلغ الإجمالي', 'المبلغ الاجمالي', 'المبلغ الإجمالي (ر.س)', 'المبلغ الاجمالي (ر.س)', 'المبلغ الإجمالي (ج.م)', 'المبلغ الاجمالي (ج.م)',
    'صافي الفاتورة', 'صافي الفاتوره', 'صافي الفاتورة (ر.س)', 'صافي الفاتوره (ر.س)', 'صافي الفاتورة (ج.م)', 'صافي الفاتوره (ج.م)',
    'قيمة الفاتورة', 'قيمة الفاتوره', 'قيمة الفاتورة (ر.س)', 'قيمة الفاتوره (ر.س)', 'قيمة الفاتورة (ج.م)', 'قيمة الفاتوره (ج.م)',
    'المبلغ', 'المبلغ (ر.س)', 'المبلغ (ج.م)', 'الإجمالي', 'الاجمالي', 'المجموع', 'المجموع (ر.س)', 'المجموع (ج.م)',
    'Total', 'Total Amount', 'Invoice Total', 'Grand Total', 'Net Total', 'Amount'
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
      cleanKey.includes('رقم') || 
      cleanKey.includes('ضريب') ||
      cleanKey.includes('كمي') ||
      cleanKey.includes('عدد')
    ) {
      continue;
    }

    if (
      cleanKey.includes('اجمالي الفاتوره') || 
      cleanKey.includes('اجمالي المبلغ') || 
      cleanKey.includes('المبلغ الاجمالي') || 
      cleanKey.includes('صافي الفاتوره') || 
      cleanKey.includes('قيمه الفاتوره') || 
      cleanKey.includes('اجمالي') || 
      cleanKey.includes('مجموع') || 
      cleanKey === 'مبلغ' || 
      cleanKey === 'المبلغ' || 
      cleanKey === 'total' || 
      cleanKey === 'invoice total' || 
      cleanKey === 'total amount' || 
      cleanKey === 'grand total' || 
      cleanKey === 'net total' || 
      cleanKey === 'amount'
    ) {
      const num = safeParseNumber(val);
      if (num > 0) return num;
    }
  }

  return 0;
}

export function InvoicesImportModal({
  isOpen,
  onClose,
  settings,
  existingInvoices = [],
  onImportComplete,
  clients = [],
  employees = [],
  services = [],
  products = [],
  activeBranchId,
  currentUser
}: InvoicesImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [readError, setReadError] = useState<string | null>(null);
  
  // Data parsed from excel
  const [candidates, setCandidates] = useState<ParsedInvoiceCandidate[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Handle file selection and multi-sheet reading
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
      const { headerRows, detailRows, sheetNames, headerSheetName, detailSheetName } = await readTwoSheetExcelFile(selectedFile);

      if (!headerRows || headerRows.length === 0) {
        throw new Error(`ورقة العمل "${headerSheetName}" فارغة أو لا تحتوي على صفوف رأس الفاتورة.`);
      }

      // 1. فهرسة تفاصيل الفواتير بحسب رقم الفاتورة
      const detailsByInvoiceId = new Map<string, any[]>();
      detailRows.forEach((row: any) => {
        const invIdRaw = String(
          row['رقم الفاتورة'] || 
          row['رقم الفاتوره'] || 
          row['Invoice Number'] || 
          row['Invoice No'] || 
          row['Invoice ID'] || 
          row['invoiceId'] || 
          row['id'] || ''
        ).trim();

        if (!invIdRaw) return;
        const key = invIdRaw.toUpperCase();
        if (!detailsByInvoiceId.has(key)) {
          detailsByInvoiceId.set(key, []);
        }
        detailsByInvoiceId.get(key)!.push(row);
      });

      // قائمة أرقام الفواتير الموجودة حالياً في النظام
      const existingIds = new Set(existingInvoices.map(i => i.id.trim().toUpperCase()));
      const existingClientPhones = new Set(
        clients.filter(c => c.phone).map(c => c.phone.replace(/\D/g, ''))
      );

      // 2. تحليل وتجهيز كل فاتورة من ورقة رأس الفاتورة
      const parsedList: ParsedInvoiceCandidate[] = [];

      headerRows.forEach((hRow: any, idx: number) => {
        const errors: string[] = [];

        // استخراج رقم الفاتورة
        let rawId = String(
          hRow['رقم الفاتورة'] || 
          hRow['رقم الفاتوره'] || 
          hRow['الفاتورة'] || 
          hRow['Invoice Number'] || 
          hRow['Invoice No'] || 
          hRow['Invoice ID'] || 
          hRow['invoiceId'] || 
          hRow['id'] || ''
        ).trim();

        if (!rawId) {
          rawId = `INV-IMP-${Date.now().toString().slice(-6)}-${idx + 1}`;
          errors.push('لم يتم العثور على رقم فاتورة، تم توليد رقم تلقائي.');
        }

        const normId = rawId.toUpperCase();
        const isExisting = existingIds.has(normId);

        // استخراج التاريخ
        const rawDate = hRow['تاريخ الفاتورة'] || hRow['التاريخ'] || hRow['تاريخ'] || hRow['Date'] || hRow['Invoice Date'] || hRow['date'];
        const invoiceDate = parseExcelDate(rawDate);

        // العميل
        const clientName = String(
          hRow['اسم العميل'] || 
          hRow['العميل'] || 
          hRow['Customer Name'] || 
          hRow['Client Name'] || 
          hRow['clientName'] || ''
        ).trim() || 'عميل نقدي';

        const clientPhone = String(
          hRow['رقم هاتف العميل'] || 
          hRow['رقم الهاتف'] || 
          hRow['الجوال'] || 
          hRow['رقم الجوال'] || 
          hRow['هاتف العميل'] || 
          hRow['Phone'] || 
          hRow['Mobile'] || 
          hRow['clientPhone'] || ''
        ).trim();

        const cleanPhone = clientPhone.replace(/\D/g, '');
        const isNewClient = Boolean(cleanPhone && !existingClientPhones.has(cleanPhone) && clientName !== 'عميل نقدي');

        // طريقة الدفع والخزينة
        const rawPayMethod = String(
          hRow['طريقة الدفع'] || 
          hRow['الخزينة'] || 
          hRow['الدفع'] || 
          hRow['Payment Method'] || 
          hRow['Treasury'] || ''
        ).trim();

        // مطابقة طريقة الدفع مع الخزائن المتاحة في النظام
        let matchedTreasuryId = settings.treasuries.find(t => !t.isMain)?.id || settings.treasuries[0]?.id || 'cash';
        if (rawPayMethod) {
          const lowerPay = rawPayMethod.toLowerCase();
          const foundT = settings.treasuries.find(t => 
            t.name.toLowerCase().includes(lowerPay) || 
            lowerPay.includes(t.name.toLowerCase()) || 
            t.id.toLowerCase() === lowerPay
          );
          if (foundT) {
            matchedTreasuryId = foundT.id;
          }
        }

        // الخصم
        const rawDiscount = safeParseNumber(hRow['قيمة الخصم'] || hRow['الخصم'] || hRow['Discount'] || hRow['discount'] || 0);
        const discount = Math.max(0, rawDiscount);

        // الحالة
        const rawStatus = String(hRow['حالة الفاتورة'] || hRow['الحالة'] || hRow['Status'] || hRow['status'] || '').trim().toLowerCase();
        let status: 'completed' | 'unpaid' | 'cancelled' = 'completed';
        if (rawStatus.includes('غير') || rawStatus.includes('unpaid') || rawStatus.includes('معلق')) {
          status = 'unpaid';
        } else if (rawStatus.includes('ملغ') || rawStatus.includes('cancel')) {
          status = 'cancelled';
        }

        // ملاحظات
        const notes = String(hRow['ملاحظات'] || hRow['البيان'] || hRow['Notes'] || hRow['notes'] || '').trim();

        // 3. بنود الفاتورة من الورقة الثانية
        const relatedDetailRows = detailsByInvoiceId.get(normId) || [];
        const invoiceItems: InvoiceItem[] = [];

        if (relatedDetailRows.length > 0) {
          relatedDetailRows.forEach((dRow, dIdx) => {
            const rawItemName = String(
              dRow['اسم الخدمة أو المنتج'] || 
              dRow['اسم الخدمة'] || 
              dRow['اسم المنتج'] || 
              dRow['الصنف'] || 
              dRow['الخدمة'] || 
              dRow['المنتج'] || 
              dRow['Item Name'] || 
              dRow['Service Name'] || 
              dRow['name'] || ''
            ).trim() || 'خدمة سابقة';

            const rawType = String(dRow['النوع (خدمة / منتج)'] || dRow['النوع'] || dRow['نوع البند'] || dRow['Type'] || '').trim().toLowerCase();
            const isProduct = rawType.includes('منتج') || rawType.includes('product') || products.some(p => p.name.trim().toLowerCase() === rawItemName.toLowerCase());
            const itemType: 'service' | 'product' = isProduct ? 'product' : 'service';

            const qty = Math.max(1, safeParseNumber(dRow['الكمية'] || dRow['العدد'] || dRow['Quantity'] || dRow['Qty'] || 1) || 1);
            const unitPrice = extractItemUnitPrice(dRow);
            const lineDiscount = Math.max(0, safeParseNumber(dRow['خصم البند'] || dRow['خصم'] || dRow['Line Discount'] || 0) || 0);
            const effectivePrice = Math.max(0, unitPrice - (lineDiscount / qty));

            // مطابقة الفني / الموظف
            const rawEmpName = String(
              dRow['اسم الموظف / الفني'] || 
              dRow['اسم الموظف'] || 
              dRow['الفني'] || 
              dRow['الموظف'] || 
              dRow['Employee'] || 
              dRow['Technician'] || ''
            ).trim();

            let matchedEmpId: string | undefined = undefined;
            let matchedEmpName = rawEmpName || 'فني الصالون';

            if (rawEmpName) {
              const foundEmp = employees.find(e => 
                e.name.trim().toLowerCase() === rawEmpName.toLowerCase() ||
                e.name.toLowerCase().includes(rawEmpName.toLowerCase()) ||
                rawEmpName.toLowerCase().includes(e.name.toLowerCase())
              );
              if (foundEmp) {
                matchedEmpId = foundEmp.id;
                matchedEmpName = foundEmp.name;
              }
            }

            // مطابقة الخدمة أو المنتج لربط الـ itemId
            let matchedItemId: string | undefined = undefined;
            if (isProduct) {
              const pMatch = products.find(p => p.name.trim().toLowerCase() === rawItemName.toLowerCase());
              if (pMatch) matchedItemId = pMatch.id;
            } else {
              const sMatch = services.find(s => s.name.trim().toLowerCase() === rawItemName.toLowerCase());
              if (sMatch) matchedItemId = sMatch.id;
            }

            invoiceItems.push({
              id: `${normId}-${dIdx + 1}`,
              itemId: matchedItemId,
              type: itemType,
              serviceName: rawItemName,
              technicianName: matchedEmpName,
              employeeId: matchedEmpId,
              quantity: qty,
              price: effectivePrice
            });
          });
        } else {
          // في حال لم يكن هناك تفاصيل لهذه الفاتورة في الورقة الثانية، نفحص هل الإجمالي محدد في ورقة الرأس
          const rawHeaderTotal = extractInvoiceHeaderTotal(hRow);

          if (rawHeaderTotal > 0) {
            invoiceItems.push({
              id: `${normId}-1`,
              type: 'service',
              serviceName: 'خدمات سابقة عامة',
              technicianName: 'فني الصالون',
              quantity: 1,
              price: Math.max(0, rawHeaderTotal + discount)
            });
          } else {
            errors.push('لا توجد بنود تفصيلية في الورقة الثانية، تم إدراج بند افتراضي بمبلغ صفر.');
            invoiceItems.push({
              id: `${normId}-1`,
              type: 'service',
              serviceName: 'خدمات سابقة عامة',
              technicianName: 'فني الصالون',
              quantity: 1,
              price: 0
            });
          }
        }

        // الحسابات المالية التلقائية
        let subtotal = invoiceItems.reduce((sum, it) => sum + (it.price * (it.quantity || 1)), 0);
        const rawHeaderTotal = extractInvoiceHeaderTotal(hRow);

        if (rawHeaderTotal > 0) {
          if (invoiceItems.length === 0) {
            invoiceItems.push({
              id: `${normId}-1`,
              type: 'service',
              serviceName: 'خدمات سابقة عامة',
              technicianName: 'فني الصالون',
              quantity: 1,
              price: Math.max(0, rawHeaderTotal + discount)
            });
            subtotal = Math.max(0, rawHeaderTotal + discount);
          } else if (subtotal === 0) {
            invoiceItems[0].price = Math.max(0, rawHeaderTotal + discount);
            subtotal = Math.max(0, rawHeaderTotal + discount);
          }
        }

        const total = rawHeaderTotal > 0 ? rawHeaderTotal : Math.max(0, subtotal - discount);
        if (subtotal === 0 && total > 0) {
          subtotal = total + discount;
          if (invoiceItems.length > 0 && invoiceItems[0].price === 0) {
            invoiceItems[0].price = subtotal;
          }
        }
        const vatRate = settings.vatEnabled ? (settings.vatRate || 15) : 0;
        const vatAmount = settings.vatEnabled ? (total - (total / (1 + vatRate / 100))) : 0;

        parsedList.push({
          id: rawId,
          date: invoiceDate,
          clientName,
          clientPhone,
          paymentMethod: matchedTreasuryId,
          discount,
          status,
          notes,
          items: invoiceItems,
          subtotal: Number(subtotal.toFixed(2)),
          vatAmount: Number(vatAmount.toFixed(2)),
          total: Number(total.toFixed(2)),
          isExisting,
          isNewClient,
          validationErrors: errors
        });
      });

      setCandidates(parsedList);
    } catch (err: any) {
      console.error('Error parsing excel file:', err);
      setReadError(err?.message || 'تعذر قراءة ملف الإكسل. يرجى التأكد من مطابقة الملف لنموذج العينة المعتمد.');
    } finally {
      setIsReading(false);
    }
  };

  // الإحصائيات بعد التحليل
  const stats = useMemo(() => {
    const totalInvoices = candidates.length;
    const existingCount = candidates.filter(c => c.isExisting).length;
    const newClientsCount = candidates.filter(c => c.isNewClient).length;
    const toImportList = skipDuplicates ? candidates.filter(c => !c.isExisting) : candidates;
    const totalLines = toImportList.reduce((s, c) => s + c.items.length, 0);
    const totalRevenue = toImportList.reduce((s, c) => s + (c.status === 'completed' ? c.total : 0), 0);

    return {
      totalInvoices,
      existingCount,
      newClientsCount,
      toImportCount: toImportList.length,
      totalLines,
      totalRevenue
    };
  }, [candidates, skipDuplicates]);

  // التصفية في جدول المعاينة
  const filteredCandidates = useMemo(() => {
    if (!searchFilter.trim()) return candidates;
    const q = searchFilter.toLowerCase().trim();
    return candidates.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q) ||
      c.clientPhone.includes(q) ||
      c.items.some(it => it.serviceName.toLowerCase().includes(q) || it.technicianName.toLowerCase().includes(q))
    );
  }, [candidates, searchFilter]);

  // تنفيذ عملية الاستيراد وحفظ البيانات سحابياً
  const handleExecuteImport = async () => {
    const targetCandidates = skipDuplicates ? candidates.filter(c => !c.isExisting) : candidates;
    if (targetCandidates.length === 0) {
      alert('لا توجد فواتير مؤهلة للاستيراد (قد تكون جميعها مكررة مع تفعيل خيار التخطي).');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: targetCandidates.length });

    try {
      const now = new Date().toISOString();
      const newClientsMap = new Map<string, Client>();
      const existingClientPhones = new Set(
        clients.filter(c => c.phone).map(c => c.phone.replace(/\D/g, ''))
      );

      // 1. معالجة وتجهيز العملاء الجدد
      targetCandidates.forEach(cand => {
        const cleanPhone = cand.clientPhone ? cand.clientPhone.replace(/\D/g, '') : '';
        if (cleanPhone && !existingClientPhones.has(cleanPhone) && !newClientsMap.has(cleanPhone) && cand.clientName !== 'عميل نقدي') {
          const newClient: Client = {
            id: 'CLI-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            salonId: settings.salonId,
            branchId: activeBranchId,
            name: cand.clientName,
            phone: cand.clientPhone,
            totalVisits: 1,
            totalSpent: cand.total,
            points: 0,
            cashback: 0,
            createdAt: cand.date || now
          };
          newClientsMap.set(cleanPhone, newClient);
        }
      });

      const newClientsList = Array.from(newClientsMap.values());
      // حفظ العملاء الجدد في قاعدة البيانات السحابية
      for (const cl of newClientsList) {
        try {
          await DB.saveClient(cl, settings.salonId);
        } catch (e) {
          console.warn('Failed to save client during excel import:', e);
        }
      }

      // 2. تحويل المرشحين إلى كائنات فواتير نهائية وحفظها في قاعدة البيانات
      const finalInvoices: Invoice[] = [];

      for (let i = 0; i < targetCandidates.length; i++) {
        const cand = targetCandidates[i];
        const cleanPhone = cand.clientPhone ? cand.clientPhone.replace(/\D/g, '') : '';
        const clientObj = clients.find(c => c.phone && c.phone.replace(/\D/g, '') === cleanPhone) || newClientsMap.get(cleanPhone);

        const newInv: Invoice = {
          id: cand.id,
          salonId: settings.salonId,
          branchId: activeBranchId,
          date: cand.date,
          clientName: cand.clientName,
          clientId: clientObj?.id,
          clientPhone: cand.clientPhone || undefined,
          subtotal: cand.subtotal,
          discount: cand.discount,
          vatAmount: cand.vatAmount,
          total: cand.total,
          status: cand.status,
          items: cand.items,
          paymentMethods: [{ amount: cand.total, treasuryId: cand.paymentMethod }],
          createdBy: currentUser?.name || 'استيراد إكسل',
          notes: cand.notes || undefined
        };

        // حفظ في قاعدة البيانات السحابية Supabase
        await DB.saveInvoice(newInv, settings.salonId);
        finalInvoices.push(newInv);

        setImportProgress({ current: i + 1, total: targetCandidates.length });
      }

      // إخطار الشاشة الرئيسية باكتمال الاستيراد
      onImportComplete(finalInvoices, newClientsList);
      alert(`🎉 تم بنجاح استيراد (${finalInvoices.length}) فاتورة سابقة و (${newClientsList.length}) عميل جديد إلى النظام وقاعدة البيانات السحابية!`);
      onClose();
    } catch (err: any) {
      console.error('Error during invoice batch import:', err);
      alert(`حدث خطأ أثناء حفظ الفواتير المستوردة: ${err?.message || err}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        
        {/* ترويسة النافذة */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-800 flex items-center gap-2">
                <span>سحب واستيراد فواتير سابقة من ملف إكسل</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ورقتين عمل (Header + Details)
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                استيراد سجل الفواتير والمبيعات السابقة بدقة متناهية وحفظها مباشرة في قاعدة البيانات السحابية
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="text-slate-400 hover:text-slate-700 font-bold text-lg p-2 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {/* جسم النافذة */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* شريط الإرشادات وتحميل ملف العينة المعتمد */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-emerald-900">
                  <Info size={16} className="text-emerald-600 shrink-0" />
                  <span>تنسيق ملف الإكسل المعتمد للاستيراد الخالي من الأخطاء:</span>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed space-y-1">
                  <p>• <strong>الورقة الأولى (رأس الفاتورة):</strong> تحتوي على رقم الفاتورة، التاريخ، العميل، الهاتف، طريقة الدفع، الخصم، الحالة، الملاحظات.</p>
                  <p>• <strong>الورقة الثانية (تفاصيل الفواتير):</strong> تحتوي على أسطر كل فاتورة مرتبطة بـ (رقم الفاتورة)، اسم الخدمة/المنتج، النوع، الكمية، سعر الوحدة، واسم الفني المنفذ.</p>
                  <p>• <strong>الربط التلقائي:</strong> سيتم احتساب إجمالي الفاتورة والضريبة تلقائياً وتسجيل العملاء الجدد في النظام تلقائياً.</p>
                </div>
              </div>

              <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-emerald-100">
                <button
                  type="button"
                  onClick={() => downloadInvoicesTemplate(settings.currency)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <Download size={15} />
                  <span>تحميل ملف العينة المعتمد (.xlsx)</span>
                </button>
                <span className="text-[10px] text-slate-400 font-semibold">مسبق التنسيق بورقتي عمل وعينات واقعية</span>
              </div>
            </div>
          </div>

          {/* منطقة سحب وإفلات / اختيار الملف */}
          {candidates.length === 0 ? (
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-8 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all">
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                disabled={isReading}
                className="hidden"
              />
              <label 
                htmlFor="excel-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-3 w-full h-full"
              >
                <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 text-emerald-600 flex items-center justify-center shadow-xs">
                  {isReading ? <RefreshCw size={28} className="animate-spin" /> : <Upload size={28} />}
                </div>

                <div>
                  <h4 className="font-black text-sm text-slate-800">
                    {isReading ? 'جاري فحص وقراءة ورقتي عمل الإكسل...' : 'اضغط لاختيار ملف الإكسل (.xlsx) أو اسحبه هنا'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">يدعم ملفات Microsoft Excel بصيغة (.xlsx أو .xls)</p>
                </div>

                {fileName && !isReading && (
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                    الملف المختار: {fileName}
                  </span>
                )}
              </label>

              {readError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2 max-w-lg mx-auto text-right">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{readError}</span>
                </div>
              )}
            </div>
          ) : (
            /* معاينة البيانات بعد التحليل بنجاح */
            <div className="space-y-4">
              
              {/* شريط الإحصائيات السريعة */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Receipt size={13} className="text-primary" />
                    <span>إجمالي الفواتير</span>
                  </div>
                  <div className="text-lg font-black text-slate-800 mt-1 font-mono">
                    {stats.totalInvoices}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Scissors size={13} className="text-emerald-600" />
                    <span>أسطر وبنود الخدمات</span>
                  </div>
                  <div className="text-lg font-black text-emerald-600 mt-1 font-mono">
                    {stats.totalLines}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <DollarSign size={13} className="text-blue-600" />
                    <span>إجمالي المبيعات</span>
                  </div>
                  <div className="text-lg font-black text-blue-600 mt-1 font-mono">
                    {stats.totalRevenue.toFixed(2)} <span className="text-xs font-normal text-slate-400 font-sans">{settings.currency}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Users size={13} className="text-purple-600" />
                    <span>عملاء جدد للتسجيل</span>
                  </div>
                  <div className="text-lg font-black text-purple-700 mt-1 font-mono">
                    +{stats.newClientsCount}
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border ${stats.existingCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <AlertTriangle size={13} className={stats.existingCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
                    <span>فواتير مسجلة مسبقاً</span>
                  </div>
                  <div className={`text-lg font-black mt-1 font-mono ${stats.existingCount > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
                    {stats.existingCount}
                  </div>
                </div>
              </div>

              {/* خيارات التعامل مع التكرار والبحث */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={skipDuplicates} 
                      onChange={e => setSkipDuplicates(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4 cursor-pointer"
                    />
                    <span>تخطي الفواتير الموجودة مسبقاً (موصى به لمنع تكرار الأرقام)</span>
                  </label>
                  {stats.existingCount > 0 && (
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      سيتم استيراد {stats.toImportCount} فقط
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="بحث في الفواتير المستوردة..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-emerald-500 font-bold w-48 sm:w-60"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setCandidates([]);
                      setFile(null);
                      setFileName('');
                      setReadError(null);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors shrink-0"
                  >
                    تغيير الملف
                  </button>
                </div>
              </div>

              {/* جدول معاينة الفواتير مع إمكانية فرد بنود كل فاتورة */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-80 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-10">#</th>
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">التاريخ والوقت</th>
                      <th className="p-3">العميل</th>
                      <th className="p-3">الهاتف</th>
                      <th className="p-3 text-center">عدد البنود</th>
                      <th className="p-3 text-left">الخصم</th>
                      <th className="p-3 text-left">الإجمالي الصافي</th>
                      <th className="p-3 text-center">الحالة</th>
                      <th className="p-3 text-center">معاينة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCandidates.map((cand, idx) => {
                      const isExpanded = expandedInvoiceId === cand.id;
                      const isSkipped = skipDuplicates && cand.isExisting;

                      return (
                        <React.Fragment key={cand.id + idx}>
                          <tr className={`transition-colors ${
                            isSkipped 
                              ? 'bg-slate-100/60 opacity-60' 
                              : cand.isExisting 
                              ? 'bg-amber-50/40 hover:bg-amber-50/80' 
                              : 'hover:bg-slate-50/80'
                          }`}>
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-mono font-black text-slate-900">
                              <span className="flex items-center gap-1.5">
                                <span>{cand.id}</span>
                                {cand.isExisting && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded border border-amber-200">
                                    موجودة مسبقاً
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-600 text-[11px]">
                              {new Date(cand.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="p-3 font-bold text-slate-800">
                              <span className="flex items-center gap-1">
                                <span>{cand.clientName}</span>
                                {cand.isNewClient && (
                                  <span className="text-[8px] font-bold px-1 bg-purple-50 text-purple-700 rounded border border-purple-200">
                                    جديد ✨
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-600" dir="ltr">
                              {cand.clientPhone || '-'}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px]">
                                {cand.items.length} بند
                              </span>
                            </td>
                            <td className="p-3 text-left font-mono font-bold text-rose-600">
                              {cand.discount > 0 ? `-${cand.discount.toFixed(2)}` : '-'}
                            </td>
                            <td className="p-3 text-left font-mono font-black text-emerald-700 text-xs">
                              {cand.total.toFixed(2)} {settings.currency}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                cand.status === 'completed' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : cand.status === 'unpaid'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {cand.status === 'completed' ? 'مسددة' : cand.status === 'unpaid' ? 'غير مسددة' : 'ملغاة'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedInvoiceId(isExpanded ? null : cand.id)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                                title="عرض أسطر وتفاصيل الفاتورة"
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                          </tr>

                          {/* تفاصيل أسطر الفاتورة المستوردة من الورقة الثانية */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={10} className="p-3">
                                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[11px] font-bold text-slate-500">
                                    <span>تفاصيل أسطر الفاتورة ({cand.id}):</span>
                                    <span>طريقة الدفع: {cand.paymentMethod}</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {cand.items.map((it, itIdx) => (
                                      <div key={itIdx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-slate-400 text-[10px]">#{itIdx + 1}</span>
                                          <div>
                                            <p className="font-bold text-slate-800">{it.serviceName}</p>
                                            <p className="text-[10px] text-slate-400 font-semibold">بواسطة: {it.technicianName}</p>
                                          </div>
                                        </div>
                                        <div className="text-left font-mono">
                                          <span className="text-emerald-700 font-bold">{it.price.toFixed(2)} {settings.currency}</span>
                                          {it.quantity && it.quantity > 1 && (
                                            <span className="text-[10px] text-slate-400 font-bold ml-1">x{it.quantity}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {cand.notes && (
                                    <div className="text-[11px] text-slate-500 pt-1">
                                      <strong>ملاحظات:</strong> {cand.notes}
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

        {/* أسفل النافذة وأزرار التنفيذ */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>يتم ربط وحفظ الفواتير مباشرة في قاعدة البيانات السحابية (Supabase) مع تحديث سجلات العملاء.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors"
            >
              إلغاء
            </button>

            {candidates.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting || stats.toImportCount === 0}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>جاري الاستيراد ({importProgress.current} من {importProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>تأكيد وسحب ({stats.toImportCount}) فاتورة الآن</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
