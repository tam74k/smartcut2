import React, { useState, useEffect, useRef } from 'react';
import { Product, AppSettings } from '../types';
import { Printer } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface BarcodePrintModalProps {
  product: Product;
  settings: AppSettings;
  onClose: () => void;
}

export type LabelSizeKey = '38x25' | '40x30' | '50x25' | '50x30' | '58x40' | '60x40';

export interface LabelSizeConfig {
  key: LabelSizeKey;
  label: string;
  widthMm: number;
  heightMm: number;
  paddingMm: string;
  graphicWidthMm: number;
  baseBarcodeHeightMm: number;
  barWidth: number;
  salonFontSizePt: number;
  nameFontSizePt: number;
  codeFontSizePt: number;
  priceFontSizePt: number;
  previewWidthPx: number;
  previewHeightPx: number;
}

export const LABEL_SIZES: Record<LabelSizeKey, LabelSizeConfig> = {
  '38x25': {
    key: '38x25',
    label: '38 × 25 مم (قياسي صغير)',
    widthMm: 38,
    heightMm: 25,
    paddingMm: '0.8mm 1.2mm',
    graphicWidthMm: 34.5,
    baseBarcodeHeightMm: 11,
    barWidth: 1.6,
    salonFontSizePt: 6.5,
    nameFontSizePt: 8,
    codeFontSizePt: 7.5,
    priceFontSizePt: 8.5,
    previewWidthPx: 215,
    previewHeightPx: 142,
  },
  '40x30': {
    key: '40x30',
    label: '40 × 30 مم (قياسي)',
    widthMm: 40,
    heightMm: 30,
    paddingMm: '1mm 1.5mm',
    graphicWidthMm: 36,
    baseBarcodeHeightMm: 14,
    barWidth: 1.8,
    salonFontSizePt: 7.5,
    nameFontSizePt: 9,
    codeFontSizePt: 8,
    priceFontSizePt: 9.5,
    previewWidthPx: 220,
    previewHeightPx: 165,
  },
  '50x25': {
    key: '50x25',
    label: '50 × 25 مم (عريض منخفض)',
    widthMm: 50,
    heightMm: 25,
    paddingMm: '0.8mm 2mm',
    graphicWidthMm: 45,
    baseBarcodeHeightMm: 11.5,
    barWidth: 2.0,
    salonFontSizePt: 7.5,
    nameFontSizePt: 8.5,
    codeFontSizePt: 8,
    priceFontSizePt: 9,
    previewWidthPx: 250,
    previewHeightPx: 125,
  },
  '50x30': {
    key: '50x30',
    label: '50 × 30 مم (متوسط شائع)',
    widthMm: 50,
    heightMm: 30,
    paddingMm: '1mm 2mm',
    graphicWidthMm: 45,
    baseBarcodeHeightMm: 14.5,
    barWidth: 2.0,
    salonFontSizePt: 8,
    nameFontSizePt: 9.5,
    codeFontSizePt: 8.5,
    priceFontSizePt: 10,
    previewWidthPx: 240,
    previewHeightPx: 144,
  },
  '58x40': {
    key: '58x40',
    label: '58 × 40 مم (كبير)',
    widthMm: 58,
    heightMm: 40,
    paddingMm: '1.5mm 2.5mm',
    graphicWidthMm: 52,
    baseBarcodeHeightMm: 19,
    barWidth: 2.2,
    salonFontSizePt: 8.5,
    nameFontSizePt: 10.5,
    codeFontSizePt: 9.5,
    priceFontSizePt: 11,
    previewWidthPx: 235,
    previewHeightPx: 162,
  },
  '60x40': {
    key: '60x40',
    label: '60 × 40 مم (كبير جداً)',
    widthMm: 60,
    heightMm: 40,
    paddingMm: '1.5mm 2.5mm',
    graphicWidthMm: 54,
    baseBarcodeHeightMm: 20,
    barWidth: 2.2,
    salonFontSizePt: 9,
    nameFontSizePt: 11,
    codeFontSizePt: 10,
    priceFontSizePt: 11.5,
    previewWidthPx: 240,
    previewHeightPx: 160,
  },
};

function estimateCode128Modules(value: string): number {
  const isNumeric = /^\d+$/.test(value);
  if (isNumeric) {
    const pairs = Math.ceil(value.length / 2);
    return 37 + pairs * 11;
  }
  return 37 + value.length * 11;
}

function generateBarcodeSvgString(
  value: string,
  graphicWidthMm: number,
  barcodeHeightMm: number,
  barWidth: number
): string {
  const modules = estimateCode128Modules(value);
  const nativeWidth = modules * barWidth;
  const nativeHeight = Math.max(30, Math.round((nativeWidth * barcodeHeightMm) / graphicWidthMm));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, value, {
      format: 'CODE128',
      width: barWidth,
      height: nativeHeight,
      displayValue: false,
      margin: 0,
    });
  } catch {
    JsBarcode(svg, value.replace(/[^\w-]/g, '') || '123456789012', {
      format: 'CODE128',
      width: barWidth,
      height: nativeHeight,
      displayValue: false,
      margin: 0,
    });
  }

  svg.setAttribute('class', 'barcode-svg');
  return svg.outerHTML;
}

export function BarcodePrintModal({ product, settings, onClose }: BarcodePrintModalProps) {
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<LabelSizeKey>('38x25');
  const [showPrice, setShowPrice] = useState(true);
  const [showSalonName, setShowSalonName] = useState(true);
  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  const barcodeValue = product.barcode || product.id.replace(/\D/g, '').padEnd(12, '0').substring(0, 12) || '123456789012';
  const currentConfig = LABEL_SIZES[labelSize] || LABEL_SIZES['38x25'];

  let effectiveBarcodeHeight = currentConfig.baseBarcodeHeightMm;
  if (!showSalonName) {
    effectiveBarcodeHeight += currentConfig.heightMm >= 40 ? 3.5 : currentConfig.heightMm >= 30 ? 2.5 : 2;
  }
  if (!showPrice) {
    effectiveBarcodeHeight += currentConfig.heightMm >= 40 ? 4 : currentConfig.heightMm >= 30 ? 3 : 2.5;
  }
  effectiveBarcodeHeight = Math.min(currentConfig.heightMm - 6.5, effectiveBarcodeHeight);

  // Render live preview SVG
  useEffect(() => {
    if (!previewSvgRef.current) return;
    try {
      const modules = estimateCode128Modules(barcodeValue);
      const nativeWidth = modules * currentConfig.barWidth;
      const nativeHeight = Math.max(30, Math.round((nativeWidth * effectiveBarcodeHeight) / currentConfig.graphicWidthMm));

      while (previewSvgRef.current.firstChild) {
        previewSvgRef.current.removeChild(previewSvgRef.current.firstChild);
      }

      JsBarcode(previewSvgRef.current, barcodeValue, {
        format: 'CODE128',
        width: currentConfig.barWidth,
        height: nativeHeight,
        displayValue: false,
        margin: 0,
      });
    } catch (err) {
      console.error('Barcode preview render error:', err);
    }
  }, [barcodeValue, labelSize, showSalonName, showPrice, effectiveBarcodeHeight, currentConfig]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=500,height=600');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const barcodeSvgHtml = generateBarcodeSvgString(
      barcodeValue,
      currentConfig.graphicWidthMm,
      effectiveBarcodeHeight,
      currentConfig.barWidth
    );

    const labelsHtml = Array.from({ length: printCopies }).map(() => `
      <div class="barcode-label">
        ${showSalonName ? `<div class="salon-name">${settings.salonName || 'Smart Cut'}</div>` : ''}
        <div class="product-name" title="${product.name}">${product.name}</div>
        <div class="barcode-graphic">
          ${barcodeSvgHtml}
        </div>
        <div class="barcode-number">${barcodeValue}</div>
        ${showPrice ? `<div class="product-price">${product.sellPrice.toLocaleString()} ${settings.currency}</div>` : ''}
      </div>
    `).join('');

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>طباعة باركود - ${product.name}</title>
          <style>
            @page {
              size: ${currentConfig.widthMm}mm ${currentConfig.heightMm}mm;
              margin: 0mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              width: ${currentConfig.widthMm}mm;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              text-rendering: optimizeLegibility;
              -webkit-font-smoothing: antialiased;
            }
            .barcode-label {
              width: ${currentConfig.widthMm}mm;
              height: ${currentConfig.heightMm}mm;
              max-width: ${currentConfig.widthMm}mm;
              max-height: ${currentConfig.heightMm}mm;
              padding: ${currentConfig.paddingMm};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              overflow: hidden;
              page-break-after: always;
              break-after: page;
            }
            .barcode-label:last-child {
              page-break-after: avoid;
              break-after: avoid;
            }
            .salon-name {
              font-size: ${currentConfig.salonFontSizePt}pt;
              font-weight: 700;
              color: #333;
              width: 100%;
              max-width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.1;
            }
            .product-name {
              font-size: ${currentConfig.nameFontSizePt}pt;
              font-weight: 800;
              color: #000;
              width: 100%;
              max-width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.15;
            }
            .barcode-graphic {
              width: 100%;
              max-width: ${currentConfig.graphicWidthMm}mm;
              height: ${effectiveBarcodeHeight}mm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto;
              overflow: hidden;
            }
            .barcode-svg {
              width: 100% !important;
              height: 100% !important;
              max-height: ${effectiveBarcodeHeight}mm !important;
              display: block;
            }
            .barcode-number {
              font-size: ${currentConfig.codeFontSizePt}pt;
              font-family: "Courier New", Courier, monospace;
              letter-spacing: 1.5px;
              font-weight: 700;
              color: #000;
              line-height: 1;
              white-space: nowrap;
            }
            .product-price {
              font-size: ${currentConfig.priceFontSizePt}pt;
              font-weight: 900;
              color: #000;
              line-height: 1.1;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() {
                  window.close();
                }, 400);
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const previewBarcodeHeightPx = Math.round((effectiveBarcodeHeight / currentConfig.heightMm) * (currentConfig.previewHeightPx - 50));

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
            className="text-slate-400 hover:text-red-500 font-bold text-lg p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Label Preview Card */}
          <div className="bg-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center">
            <div className="flex items-center justify-between w-full max-w-[270px] mb-2 px-1">
              <span className="text-[11px] font-bold text-slate-500">معاينة واقعية للملصق:</span>
              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {currentConfig.widthMm} × {currentConfig.heightMm} مم
              </span>
            </div>

            <div 
              className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-2.5 shadow-sm flex flex-col items-center justify-between text-center transition-all duration-200"
              style={{
                width: `${currentConfig.previewWidthPx}px`,
                height: `${currentConfig.previewHeightPx}px`,
                maxHeight: `${currentConfig.previewHeightPx}px`,
              }}
            >
              {showSalonName && (
                <div className="text-[10px] font-bold text-slate-500 truncate w-full leading-tight">
                  {settings.salonName || 'Smart Cut'}
                </div>
              )}
              
              <div className="text-xs font-black text-slate-900 truncate w-full leading-tight">
                {product.name}
              </div>
              
              {/* Real Barcode graphic */}
              <div 
                className="w-full flex items-center justify-center overflow-hidden my-0.5"
                style={{ height: `${Math.max(30, previewBarcodeHeightPx)}px` }}
              >
                <svg ref={previewSvgRef} className="w-full h-full max-w-full" style={{ maxHeight: '100%' }} />
              </div>

              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-800 leading-none">
                {barcodeValue}
              </div>

              {showPrice && (
                <div className="text-xs font-black text-slate-900 border-t border-slate-100 pt-0.5 w-full leading-tight">
                  {product.sellPrice.toLocaleString()} {settings.currency}
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 mt-2 font-medium text-center">
              * يملأ الباركود مساحة الملصق بالكامل مع وضوح فائق للمسح الضوئي
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">مقاس الملصق (الليبل)</label>
              <select
                value={labelSize}
                onChange={e => setLabelSize(e.target.value as LabelSizeKey)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                {Object.values(LABEL_SIZES).map(cfg => (
                  <option key={cfg.key} value={cfg.key}>
                    {cfg.label}
                  </option>
                ))}
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

