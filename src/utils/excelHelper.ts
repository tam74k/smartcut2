import * as XLSX from 'xlsx';

/**
 * Universal helper for reading and generating .xlsx files
 */

export async function readExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * دالة قراءة ملف إكسل مكون من ورقتي عمل (رأس الفاتورة + تفاصيل الفاتورة)
 */
export async function readTwoSheetExcelFile(file: File): Promise<{
  headerRows: any[];
  detailRows: any[];
  sheetNames: string[];
  headerSheetName: string;
  detailSheetName: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetNames = workbook.SheetNames;

        if (sheetNames.length === 0) {
          throw new Error('الملف لا يحتوي على أي صفحات أو أوراق عمل.');
        }

        // الكشف الذكي عن ورقة الرأس وورقة التفاصيل
        let headerSheetIndex = 0;
        let detailSheetIndex = sheetNames.length > 1 ? 1 : 0;

        // فحص بالأسماء
        sheetNames.forEach((name, idx) => {
          const lower = name.toLowerCase().trim();
          if (lower.includes('رأس') || lower.includes('راس') || lower.includes('header') || lower.includes('invoices') || lower.includes('الفواتير')) {
            headerSheetIndex = idx;
          } else if (lower.includes('تفاصيل') || lower.includes('اسطر') || lower.includes('أسطر') || lower.includes('detail') || lower.includes('items') || lower.includes('lines') || lower.includes('بنود')) {
            detailSheetIndex = idx;
          }
        });

        // إذا تطابقوا وكان الملف يحوي ورقتين، نجعل الثانية للتفاصيل
        if (headerSheetIndex === detailSheetIndex && sheetNames.length > 1) {
          headerSheetIndex = 0;
          detailSheetIndex = 1;
        }

        const wsHeader = workbook.Sheets[sheetNames[headerSheetIndex]];
        const wsDetail = workbook.Sheets[sheetNames[detailSheetIndex]];

        const headerRows = XLSX.utils.sheet_to_json(wsHeader, { defval: '' });
        const detailRows = headerSheetIndex !== detailSheetIndex 
          ? XLSX.utils.sheet_to_json(wsDetail, { defval: '' }) 
          : [];

        resolve({
          headerRows,
          detailRows,
          sheetNames,
          headerSheetName: sheetNames[headerSheetIndex],
          detailSheetName: sheetNames[detailSheetIndex]
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * معالجة التواريخ من مختلف صيغ إكسل (أرقام تسلسلية، نصوص، كائنات Date)
 */
export function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString();

  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }

  // إذا كان رقماً تسلسلياً خاصاً بإكسل (Excel Serial Number)
  if (typeof val === 'number' && val > 1000) {
    try {
      const utcDays = Math.floor(val - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const fractionalDay = val - Math.floor(val) + 0.0000001;
      let totalSeconds = Math.floor(86400 * fractionalDay);
      const seconds = totalSeconds % 60;
      totalSeconds -= seconds;
      const hours = Math.floor(totalSeconds / (60 * 60));
      const minutes = Math.floor(totalSeconds / 60) % 60;
      dateInfo.setHours(hours, minutes, seconds);
      if (!isNaN(dateInfo.getTime())) return dateInfo.toISOString();
    } catch {}
  }

  const str = String(val).trim();
  // فحص تاريخ بصيغة YYYY-MM-DD أو YYYY/MM/DD
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) {
    const d = new Date(str.replace(/\//g, '-'));
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // فحص تاريخ بصيغة DD-MM-YYYY أو DD/MM/YYYY
  const parts = str.split(/[-/.]/);
  if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    const d = new Date(`${year}-${month}-${day}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

export function downloadXLSX(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'البيانات');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function downloadServicesTemplate() {
  const headers = [
    'اسم الخدمة',
    'اسم التصنيف',
    'السعر (ر.س)',
    'مدة التنفيذ (بالدقائق)',
    'نسبة الكاش باك (%)',
    'الحالة (نشط/غير نشط)'
  ];

  const sampleRows = [
    ['قص شعر كلاسيكي', 'شعر ورأس', 50, 25, 5, 'نشط'],
    ['حلاقة ذقن ملكية وسنفرة', 'ذقن وعناية', 40, 20, 5, 'نشط'],
    ['تنظيف بشرة بالبخار وماسك', 'عناية بالبشرة', 90, 35, 10, 'نشط'],
    ['صبغة شعر وسشوار', 'صبغات وعلاج', 120, 45, 0, 'نشط']
  ];

  downloadXLSX('نموذج_استيراد_الخدمات', 'الخدمات', headers, sampleRows);
}

export function downloadProductsTemplate() {
  const headers = [
    'اسم المنتج',
    'اسم التصنيف',
    'سعر البيع (ر.س)',
    'سعر التكلفة (ر.س)',
    'المخزون الافتتاحي',
    'حد إعادة الطلب',
    'نسبة عمولة البيع (%)',
    'الباركود'
  ];

  const sampleRows = [
    ['شامبو كرياتين علاجي 500 مل', 'مستحضرات عناية', 85, 45, 20, 5, 10, '628100100123'],
    ['واكس شعر مطفي قوي', 'تصفيف ومظهر', 45, 22, 30, 8, 5, '628100100456'],
    ['سيروم لحية بالأرجان 60 مل', 'عناية بالذقن', 65, 30, 15, 3, 8, '628100100789'],
    ['كريم صنفرة البشرة بالمشمش', 'عناية بالبشرة', 55, 25, 12, 4, 5, '628100100999']
  ];

  downloadXLSX('نموذج_استيراد_المنتجات', 'المنتجات', headers, sampleRows);
}

/**
 * تحميل نموذج إكسل متكامل لسحب الفواتير السابقة يتكون من ورقتي عمل:
 * 1. ورقة (رأس الفاتورة): رقم الفاتورة، التاريخ، العميل، الهاتف، طريقة الدفع، الخصم، الحالة، الملاحظات.
 * 2. ورقة (تفاصيل الفواتير): رقم الفاتورة، الخدمة/المنتج، النوع، الكمية، سعر الوحدة، الموظف المنفذ، خصم البند.
 */
export function downloadInvoicesTemplate(currency: string = 'ر.س') {
  const wb = XLSX.utils.book_new();

  // --- ورقة 1: رأس الفاتورة ---
  const headersSheet1 = [
    'رقم الفاتورة',
    'تاريخ الفاتورة',
    'اسم العميل',
    'رقم هاتف العميل',
    'طريقة الدفع',
    'قيمة الخصم',
    'حالة الفاتورة',
    'ملاحظات'
  ];

  const rowsSheet1 = [
    ['INV-1001', '2026-08-15 14:30', 'عبدالله الشمري', '0551234567', 'نقدي', 0, 'مكتملة', 'فاتورة سابقة - افتتاح'],
    ['INV-1002', '2026-08-15 16:15', 'خالد العتيبي', '0569876543', 'شبكة', 10, 'مكتملة', 'خصم عرض الصيف'],
    ['INV-1003', '2026-08-16 11:00', 'سعود الدوسري', '0503332211', 'تحويل بنكي', 0, 'مكتملة', 'حجز مسبق'],
    ['INV-1004', '2026-08-16 18:45', 'عميل نقدي', '0540001122', 'نقدي', 0, 'مكتملة', '']
  ];

  const ws1 = XLSX.utils.aoa_to_sheet([headersSheet1, ...rowsSheet1]);
  ws1['!cols'] = [
    { wch: 16 }, // رقم الفاتورة
    { wch: 20 }, // التاريخ
    { wch: 22 }, // اسم العميل
    { wch: 18 }, // الهاتف
    { wch: 16 }, // طريقة الدفع
    { wch: 14 }, // الخصم
    { wch: 16 }, // الحالة
    { wch: 28 }  // ملاحظات
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'رأس الفاتورة');

  // --- ورقة 2: تفاصيل الفواتير ---
  const headersSheet2 = [
    'رقم الفاتورة',
    'اسم الخدمة أو المنتج',
    'النوع (خدمة / منتج)',
    'الكمية',
    `سعر الوحدة (${currency})`,
    'اسم الموظف / الفني',
    'خصم البند'
  ];

  const rowsSheet2 = [
    // تفاصيل INV-1001
    ['INV-1001', 'قص شعر كلاسيكي', 'خدمة', 1, 50, 'أحمد صابر', 0],
    ['INV-1001', 'حلاقة ذقن ملكية', 'خدمة', 1, 40, 'أحمد صابر', 0],

    // تفاصيل INV-1002
    ['INV-1002', 'تنظيف بشرة وماسك', 'خدمة', 1, 90, 'حسام علي', 0],
    ['INV-1002', 'واكس شعر مطفي', 'منتج', 1, 45, 'حسام علي', 0],

    // تفاصيل INV-1003
    ['INV-1003', 'صبغة شعر وسشوار', 'خدمة', 1, 120, 'محمد كريم', 0],
    ['INV-1003', 'شامبو علاجي 500 مل', 'منتج', 1, 85, 'محمد كريم', 0],

    // تفاصيل INV-1004
    ['INV-1004', 'قص شعر أطفال', 'خدمة', 1, 35, 'أحمد صابر', 0]
  ];

  const ws2 = XLSX.utils.aoa_to_sheet([headersSheet2, ...rowsSheet2]);
  ws2['!cols'] = [
    { wch: 16 }, // رقم الفاتورة
    { wch: 28 }, // اسم الخدمة أو المنتج
    { wch: 18 }, // النوع
    { wch: 10 }, // الكمية
    { wch: 16 }, // سعر الوحدة
    { wch: 22 }, // اسم الموظف
    { wch: 12 }  // خصم البند
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'تفاصيل الفواتير');

  // تنزيل الملف
  XLSX.writeFile(wb, 'نموذج_سحب_فواتير_سابقة_ورقتين.xlsx');
}
