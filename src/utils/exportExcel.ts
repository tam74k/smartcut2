import { AuthService } from '../services/auth';
import * as XLSX from 'xlsx';

/**
 * Checks whether the current user has permission to export data to Excel
 */
export function checkCanExportExcel(): boolean {
  if (!AuthService.canDo('export_excel')) {
    alert('عذراً، لا تملك صلاحية تصدير البيانات إلى Excel. يرجى التواصل مع إدارة النظام لمنحك الإذن.');
    return false;
  }
  return true;
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  if (!checkCanExportExcel()) return;
  try {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          const str = String(cell ?? '').replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      )
    ].join('\r\n');

    // Add UTF-8 BOM (\uFEFF) so Excel opens Arabic properly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export CSV:', error);
    alert('حدث خطأ أثناء تصدير الملف');
  }
}

export function exportToExcel(
  filenameOrData: any, 
  sheetNameOrFilename?: string | any[][], 
  headers?: string[], 
  rows?: (string | number)[][]
) {
  if (!checkCanExportExcel()) return;
  try {
    let filename = 'تقرير';
    let sheetName = 'البيانات';
    let ws: XLSX.WorkSheet;

    // Pattern 1: exportToExcel(filename, sheetName, headers, rows)
    if (typeof filenameOrData === 'string' && typeof sheetNameOrFilename === 'string' && headers && rows) {
      filename = filenameOrData;
      sheetName = sheetNameOrFilename;
      const data = [headers, ...rows];
      ws = XLSX.utils.aoa_to_sheet(data);
    }
    // Pattern 2: exportToExcel(filename, arrayOfArrays)
    else if (typeof filenameOrData === 'string' && Array.isArray(sheetNameOrFilename)) {
      filename = filenameOrData;
      sheetName = 'البيانات';
      ws = XLSX.utils.aoa_to_sheet(sheetNameOrFilename);
    }
    // Pattern 3: exportToExcel(filename, headers, rows) - 3 args
    else if (typeof filenameOrData === 'string' && Array.isArray(sheetNameOrFilename) && Array.isArray(headers)) {
      filename = filenameOrData;
      sheetName = 'البيانات';
      ws = XLSX.utils.aoa_to_sheet([sheetNameOrFilename as any, ...(headers as any)]);
    }
    // Pattern 4: exportToExcel(arrayOfArrays, filename)
    else if (Array.isArray(filenameOrData) && Array.isArray(filenameOrData[0])) {
      filename = typeof sheetNameOrFilename === 'string' ? sheetNameOrFilename : 'تقرير';
      sheetName = 'البيانات';
      ws = XLSX.utils.aoa_to_sheet(filenameOrData);
    }
    // Pattern 5: exportToExcel(arrayOfObjects, filename)
    else if (Array.isArray(filenameOrData)) {
      filename = typeof sheetNameOrFilename === 'string' ? sheetNameOrFilename : 'تقرير';
      sheetName = 'البيانات';
      ws = XLSX.utils.json_to_sheet(filenameOrData);
    }
    // Pattern 6: Fallback if headers and rows are present
    else if (headers && rows) {
      filename = typeof filenameOrData === 'string' ? filenameOrData : 'تقرير';
      ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    }
    else {
      filename = typeof filenameOrData === 'string' ? filenameOrData : 'تقرير';
      ws = XLSX.utils.aoa_to_sheet([['لا توجد بيانات']]);
    }

    // Set RTL view on sheet if supported
    if (!ws['!views']) {
      ws['!views'] = [{ RTL: true }];
    }

    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename.replace(/\.xlsx$/, '')}.xlsx`);
  } catch (error) {
    console.error('Failed to export XLSX:', error);
    if (headers && rows) {
      exportToCSV(typeof filenameOrData === 'string' ? filenameOrData : 'تقرير', headers, rows);
    } else if (typeof filenameOrData === 'string' && Array.isArray(sheetNameOrFilename) && sheetNameOrFilename.length > 0) {
      const [h, ...r] = sheetNameOrFilename;
      exportToCSV(filenameOrData, h, r);
    } else {
      alert('حدث خطأ أثناء تصدير الملف');
    }
  }
}

/**
 * Exports an HTML table directly to an Excel file, preserving:
 * - Colspans and rowspans as merged cells
 * - Multi-level headers, grouped columns, and footers
 * - Right-to-Left (RTL) worksheet layout
 * - Custom column widths
 */
export function exportTableToExcel(
  tableElement: HTMLTableElement | string, 
  filename: string, 
  sheetName: string = 'الكشف اليومي'
): boolean {
  if (!checkCanExportExcel()) return false;
  try {
    const el = typeof tableElement === 'string' 
      ? document.getElementById(tableElement) as HTMLTableElement 
      : tableElement;

    if (!el) {
      console.warn('Table element not found for exportTableToExcel');
      return false;
    }

    const wb = XLSX.utils.table_to_book(el, { sheet: sheetName, raw: false });
    const ws = wb.Sheets[sheetName];
    if (ws) {
      // Ensure RTL view
      ws['!views'] = [{ RTL: true }];

      // Set decent minimum column widths
      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        const cols = [];
        for (let c = 0; c <= range.e.c; c++) {
          cols.push({ wch: 14 });
        }
        ws['!cols'] = cols;
      }
    }
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, `${filename.replace(/\.xlsx$/, '')}.xlsx`);
    return true;
  } catch (err) {
    console.error('Failed to export table to Excel:', err);
    return false;
  }
}
