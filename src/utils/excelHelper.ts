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
