import JsBarcode from 'jsbarcode';

export interface BarcodeSvgOptions {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}

/**
 * Generates an SVG string representation of a CODE128 barcode.
 * Works seamlessly in browser / Vite / Electron environments.
 */
export function generateBarcodeSvgString(value: string, options?: BarcodeSvgOptions): string {
  if (typeof document === 'undefined' || !value) return '';
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, value.trim(), {
      format: 'CODE128',
      width: options?.width || 1.35,
      height: options?.height || 34,
      displayValue: options?.displayValue ?? true,
      font: 'Cairo, monospace',
      fontSize: options?.fontSize || 10,
      margin: 2,
      textMargin: 2,
      background: 'transparent',
      lineColor: '#000000'
    });
    svg.setAttribute('style', 'max-width: 100%; height: auto; margin: 0 auto; display: block;');
    return svg.outerHTML;
  } catch (err) {
    console.warn('Barcode generation error for value:', value, err);
    return '';
  }
}
