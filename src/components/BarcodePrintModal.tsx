import React, { useState } from 'react';
import { Product, AppSettings } from '../types';
import { Printer, X, Tag, Check, Copy } from 'lucide-react';

interface BarcodePrintModalProps {
  product: Product;
  settings: AppSettings;
  onClose: () => void;
}

export function BarcodePrintModal({ product, settings, onClose }: BarcodePrintModalProps) {
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<'38x25' | '50x30' | '40x30'>('38x25');
  const [showPrice, setShowPrice] = useState(true);
  const [showSalonName, setShowSalonName] = useState(true);

  const barcodeValue = product.barcode || product.id.replace(/\D/g, '').padEnd(12, '0').substring(0, 12) || '123456789012';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=500');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const labelsHtml = Array.from({ length: printCopies }).map(() => `
      <div class="barcode-label size-${labelSize}">
        ${showSalonName ? `<div class="salon-name">${settings.salonName || 'Smart Cut'}</div>` : ''}
        <div class="product-name">${product.name}</div>
        <div class="barcode-graphic">
          <svg class="barcode-svg" jsbarcode-format="CODE128" jsbarcode-value="${barcodeValue}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold"></svg>
        </div>
        <div class="barcode-number">${barcodeValue}</div>
        ${showPrice ? `<div class="product-price">${product.sellPrice.toLocaleString()} ${settings.currency}</div>` : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>طباعة باركود - ${product.name}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: ${labelSize === '38x25' ? '38mm 25mm' : labelSize === '50x30' ? '50mm 30mm' : '40mm 30mm'};
              margin: 0;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .barcode-label {
              width: ${labelSize === '38x25' ? '38mm' : labelSize === '50x30' ? '50mm' : '40mm'};
              height: ${labelSize === '38x25' ? '25mm' : labelSize === '50x30' ? '30mm' : '30mm'};
              box-sizing: border-box;
              padding: 1.5mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-after: always;
              overflow: hidden;
            }
            .salon-name {
              font-size: 7pt;
              font-weight: bold;
              color: #333;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .product-name {
              font-size: 8pt;
              font-weight: 900;
              color: #000;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
              margin: 0.5mm 0;
            }
            .barcode-graphic {
              width: 95%;
              display: flex;
              justify-content: center;
            }
            .barcode-svg {
              width: 100% !important;
              height: 9mm !important;
            }
            .barcode-number {
              font-size: 6.5pt;
              font-family: monospace;
              letter-spacing: 1px;
              font-weight: bold;
              color: #000;
            }
            .product-price {
              font-size: 8pt;
              font-weight: 900;
              color: #000;
              margin-top: 0.5mm;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              JsBarcode(".barcode-svg").init();
              setTimeout(function() {
                window.print();
                window.close();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
            <Printer size={20} className="text-blue-600" />
            <span>طباعة ملصق الباركود للمنتج</span>
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 font-bold text-lg p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Label Preview Card */}
          <div className="bg-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center">
            <div className="text-[11px] font-bold text-slate-400 mb-2">معاينة ملصق الباركود:</div>
            <div className="bg-white border border-slate-300 rounded-xl p-3.5 shadow-xs flex flex-col items-center text-center w-56">
              {showSalonName && (
                <div className="text-[10px] font-bold text-slate-500 truncate w-full">{settings.salonName || 'Smart Cut'}</div>
              )}
              <div className="text-xs font-black text-slate-900 truncate w-full mt-0.5">{product.name}</div>
              
              {/* Mock Barcode visual */}
              <div className="my-2 flex flex-col items-center">
                <div className="flex gap-[2px] h-9 items-center justify-center px-2">
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1].map((w, i) => (
                    <div key={i} className="bg-black h-full" style={{ width: `${w}px` }}></div>
                  ))}
                </div>
                <div className="text-[10px] font-mono font-bold tracking-widest text-slate-700 mt-1">{barcodeValue}</div>
              </div>

              {showPrice && (
                <div className="text-xs font-black text-slate-900 border-t border-slate-100 pt-1 w-full">
                  السعر: {product.sellPrice.toLocaleString()} {settings.currency}
                </div>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">مقاس الملصق</label>
              <select
                value={labelSize}
                onChange={e => setLabelSize(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="38x25">38 × 25 مم (قياسي)</option>
                <option value="40x30">40 × 30 مم</option>
                <option value="50x30">50 × 30 مم (كبير)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">عدد النسخ</label>
              <input
                type="number"
                min="1"
                max="100"
                value={printCopies}
                onChange={e => setPrintCopies(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={e => setShowPrice(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>إظهار السعر على الملصق</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showSalonName}
                onChange={e => setShowSalonName(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>إظهار اسم الصالون</span>
            </label>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Printer size={16} />
              <span>طباعة الباركود الآن ({printCopies})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
