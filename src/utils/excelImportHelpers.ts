import * as XLSX from 'xlsx';

// ============================================================
// 📊 مساعدات استيراد ومعالجة ملفات إكسل الذكية (SmartCut Excel Helpers)
// مصممة للعمل أوفلاين بالكامل مع الالتزام التام بـ Zero-Bug Policy
// ============================================================

/**
 * تحويل الأرقام المشرقية/الفارسية إلى أرقام إنجليزية قياسية
 */
export const normalizeDigits = (val: string | number): string => {
  if (val === undefined || val === null) return '';
  const str = String(val);
  const easternDigits: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return str.replace(/[٠-٩۰-۹]/g, d => easternDigits[d] || d);
};

/**
 * دالة التنظيف المالي الشاملة:
 * تجرد القيمة من رموز العملات، فواصل الآلاف، والأقواس وتحولها إلى رقم آمن
 */
export const safeParseNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  let str = normalizeDigits(val).trim();
  if (!str) return 0;

  // إزالة رموز ونصوص العملات الشائعة وما بين الأقواس
  str = str.replace(/\([^)]*\)/g, ''); // إزالة ما بين الأقواس مثل (ج.م) أو (SAR)
  str = str.replace(/(?:ج\.م|ر\.س|SAR|EGP|USD|\$|AED|KWD|BHD|OMR|QAR|ريال|جنيه|درهم|دينار|دولار)/gi, '');
  
  // إزالة المسافات
  str = str.replace(/\s+/g, '');

  // معالجة فواصل الآلاف والعلامة العشرية
  // مثال: 1,250.50 -> 1250.50 | 1.250,50 -> 1250.50 | 1,250 -> 1250
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf(',') < str.indexOf('.')) {
      // 1,250.50
      str = str.replace(/,/g, '');
    } else {
      // 1.250,50
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (str.includes(',')) {
    // إذا كان بعد الفاصلة أكثر من رقمين وكانت فاصلة وحيدة ومكونة من 3 أرقام -> فاصلة آلاف
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace(/,/g, '');
    } else if (parts.length > 2) {
      str = str.replace(/,/g, '');
    } else {
      // فاصلة عشرية أوروبية / عربية
      str = str.replace(',', '.');
    }
  }

  // إزالة أي رموز غير الأرقام والنقطة والعلامة السالبة
  str = str.replace(/[^0-9.-]/g, '');

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
};

/**
 * تنظيف عناوين الأعمدة في الإكسل لمطابقتها بمرونة
 */
export const cleanHeaderKey = (key: string): string => {
  if (!key) return '';
  let str = String(key).trim();
  // إزالة ما بين الأقواس مثل (ج.م)
  str = str.replace(/\([^)]*\)/g, '');
  // إزالة الرموز وعلامات الترقيم
  str = str.replace(/[:*#_/\-\\]/g, ' ');
  // تطبيع الهمزات والألف والتاء المربوطة
  str = str.replace(/[أإآ]/g, 'ا')
           .replace(/ة/g, 'ه')
           .replace(/ى/g, 'ي');
  // تقليص المسافات المتكررة
  return str.replace(/\s+/g, ' ').trim().toLowerCase();
};

/**
 * فحص تطابق اسم العمود مع مجموعة من الكلمات المفتاحية
 */
export const matchHeaderKey = (header: string, keywords: string[]): boolean => {
  const cleaned = cleanHeaderKey(header);
  return keywords.some(kw => {
    const cleanKw = cleanHeaderKey(kw);
    return cleaned === cleanKw || cleaned.includes(cleanKw) || cleanKw.includes(cleaned);
  });
};

/**
 * استخراج قيمة حقل من كائن الصف بالإكسل بالبحث عبر قائمة مسميات مرنة
 */
export const getRowValueByKeywords = (row: any, keywords: string[], defaultValue: any = ''): any => {
  if (!row || typeof row !== 'object') return defaultValue;
  const keys = Object.keys(row);
  for (const k of keys) {
    if (matchHeaderKey(k, keywords)) {
      const val = row[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return val;
      }
    }
  }
  return defaultValue;
};

/**
 * تحويل أرقام وتواريخ الإكسل المتنوعة إلى صيغة تاريخ ووقت موحدة (ISO أو YYYY-MM-DDTHH:mm:ss)
 */
export const parseExcelDate = (val: any, defaultTime = '12:00'): string => {
  if (val === undefined || val === null || val === '') {
    const today = new Date().toISOString().split('T')[0];
    return `${today}T${defaultTime}:00`;
  }

  // 1. معالجة الأرقام التسلسلية للإكسل (Excel Serial Date Numbers مثل 45200)
  if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (num > 1000 && num < 100000) {
      // Excel epoch: 1899-12-30
      const totalSeconds = Math.round((num - 25569) * 86400);
      const d = new Date(totalSeconds * 1000);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');
      const timePart = (hh === '00' && mm === '00') ? `${defaultTime}:00` : `${hh}:${mm}:${ss}`;
      return `${y}-${m}-${day}T${timePart}`;
    }
  }

  // 2. إذا كانت القيمة كائن Date أصلي
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      const today = new Date().toISOString().split('T')[0];
      return `${today}T${defaultTime}:00`;
    }
    // فحص ما إذا كان التاريخ منتصف الليل UTC لمنع إزاحة اليوم في المناطق الزمنية
    const isUtcMidnight = val.getUTCHours() === 0 && val.getUTCMinutes() === 0 && val.getUTCSeconds() === 0;
    const y = isUtcMidnight ? val.getUTCFullYear() : val.getFullYear();
    const m = String((isUtcMidnight ? val.getUTCMonth() : val.getMonth()) + 1).padStart(2, '0');
    const d = String(isUtcMidnight ? val.getUTCDate() : val.getDate()).padStart(2, '0');
    const hh = isUtcMidnight ? (defaultTime ? defaultTime.split(':')[0].padStart(2, '0') : '12') : String(val.getHours()).padStart(2, '0');
    const mm = isUtcMidnight ? (defaultTime ? defaultTime.split(':')[1].padStart(2, '0') : '00') : String(val.getMinutes()).padStart(2, '0');
    const ss = '00';
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  }

  // 3. معالجة النصوص
  let str = normalizeDigits(val).trim();
  
  // استخراج الوقت إن وجد (صباحاً/مساءً أو 24 ساعة)
  let extractedTime = defaultTime;
  const isPM = /م|pm|مساء/i.test(str);
  const isAM = /ص|am|صباح/i.test(str);
  
  // استخراج وقت بصيغة HH:mm أو HH:mm:ss
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const seconds = timeMatch[3] || '00';
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    extractedTime = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  } else {
    extractedTime = `${defaultTime}:00`;
  }

  // تنظيف السلسلة من نصوص الوقت للتركيز على التاريخ
  const dateStrOnly = str.replace(/[م|ص|am|pm|مساء|صباح]/gi, '')
                         .replace(/\d{1,2}:\d{2}(?::\d{2})?/, '')
                         .trim();

  // فحص الصيغ: YYYY-MM-DD أو YYYY/MM/DD
  const ymdMatch = dateStrOnly.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, '0');
    const d = String(ymdMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}T${extractedTime.length === 5 ? extractedTime + ':00' : extractedTime}`;
  }

  // فحص الصيغ: DD-MM-YYYY أو DD/MM/YYYY أو MM/DD/YYYY
  const dmyMatch = dateStrOnly.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];
    let d = p1;
    let m = p2;
    // إذا كان p1 <= 12 و p2 > 12، فهذا نسق أمريكي MM/DD/YYYY
    if (p1 <= 12 && p2 > 12) {
      m = p1;
      d = p2;
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${extractedTime.length === 5 ? extractedTime + ':00' : extractedTime}`;
  }

  // تجربة Date.parse المدمجة كـ Fallback
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T${extractedTime.length === 5 ? extractedTime + ':00' : extractedTime}`;
  }

  const today = new Date().toISOString().split('T')[0];
  return `${today}T${extractedTime.length === 5 ? extractedTime + ':00' : extractedTime}`;
};

/**
 * قراءة ملف إكسل مكون من ورقتين عمل (مثل الفواتير أو الحجوزات)
 */
export const readTwoSheetExcel = async (
  file: File
): Promise<{ headerRows: any[]; detailRows: any[]; sheetNames: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellText: false });
        const sheetNames = workbook.SheetNames;

        if (sheetNames.length === 0) {
          throw new Error('الملف فارغ ولا يحتوي على أي أوراق عمل.');
        }

        const sheet1 = workbook.Sheets[sheetNames[0]];
        const headerRows = XLSX.utils.sheet_to_json(sheet1, { defval: '' });

        let detailRows: any[] = [];
        if (sheetNames.length > 1) {
          const sheet2 = workbook.Sheets[sheetNames[1]];
          detailRows = XLSX.utils.sheet_to_json(sheet2, { defval: '' });
        }

        resolve({ headerRows, detailRows, sheetNames });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * قراءة ملف إكسل مكون من ورقة عمل واحدة
 */
export const readSingleSheetExcel = async (
  file: File
): Promise<{ rows: any[]; sheetName: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellText: false });
        const sheetNames = workbook.SheetNames;

        if (sheetNames.length === 0) {
          throw new Error('الملف فارغ ولا يحتوي على أي أوراق عمل.');
        }

        const sheet = workbook.Sheets[sheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve({ rows, sheetName: sheetNames[0] });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * تنزيل قالب عينة جاهز بصيغة .xlsx منسق باتجاه RTL مع عينات بيانات واقعية
 */
export const downloadExcelTemplate = (
  filename: string,
  sheets: { name: string; headers: string[]; sampleRows: any[][] }[]
) => {
  const wb = XLSX.utils.book_new();

  sheets.forEach(sheetConfig => {
    const aoa = [sheetConfig.headers, ...sheetConfig.sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // تفعيل اتجاه اليمين لليسار (RTL) للورقة
    ws['!views'] = [{ RTL: true }];

    // تحديد عرض الأعمدة التلقائي لتناسب النصوص العربية
    ws['!cols'] = sheetConfig.headers.map((h, i) => {
      let maxLen = h.length;
      sheetConfig.sampleRows.forEach(row => {
        const cellVal = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
        if (cellVal.length > maxLen) maxLen = cellVal.length;
      });
      return { wch: Math.max(maxLen + 6, 16) };
    });

    XLSX.utils.book_append_sheet(wb, ws, sheetConfig.name.substring(0, 31)); // أقصى طول لاسم الورقة 31 حرف
  });

  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, finalName);
};
