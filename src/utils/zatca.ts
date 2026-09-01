/**
 * ZATCA (Fatoora) Phase 1 & Phase 2 QR Code TLV (Tag-Length-Value) Base64 Encoder
 * Compliant with the Saudi Zakat, Tax and Customs Authority requirements.
 */

function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function getTlvTag(tagNumber: number, tagValue: string): Uint8Array {
  const valueBytes = stringToUint8Array(tagValue);
  const length = valueBytes.length;
  const tagBytes = new Uint8Array(2 + length);
  tagBytes[0] = tagNumber;
  tagBytes[1] = length;
  tagBytes.set(valueBytes, 2);
  return tagBytes;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, val) => acc + val.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface ZatcaInvoiceData {
  sellerName: string;
  vatRegistrationNumber: string;
  timestamp: string; // ISO 8601 string or YYYY-MM-DDTHH:mm:ss
  invoiceTotal: number | string;
  vatTotal: number | string;
}

export function generateZatcaQrBase64(data: ZatcaInvoiceData): string {
  try {
    const formattedTimestamp = data.timestamp.includes('T')
      ? data.timestamp
      : new Date(data.timestamp).toISOString();

    const tlvArray = [
      getTlvTag(1, data.sellerName || 'صالون سمارت كت'),
      getTlvTag(2, data.vatRegistrationNumber || '300000000000003'),
      getTlvTag(3, formattedTimestamp),
      getTlvTag(4, Number(data.invoiceTotal || 0).toFixed(2)),
      getTlvTag(5, Number(data.vatTotal || 0).toFixed(2))
    ];

    const concatenated = concatUint8Arrays(tlvArray);
    return uint8ArrayToBase64(concatenated);
  } catch (error) {
    console.error('Error generating ZATCA QR:', error);
    return '';
  }
}
