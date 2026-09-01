/**
 * Universal Excel & CSV Exporter with full Arabic UTF-8 BOM support
 */

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
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

import * as XLSX from 'xlsx';

export function exportToExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  try {
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'البيانات');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } catch (error) {
    console.error('Failed to export XLSX:', error);
    exportToCSV(filename, headers, rows);
  }
}
