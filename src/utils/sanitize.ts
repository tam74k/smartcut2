/**
 * Smart Cut V2 - Security Sanitization Utilities
 * Prevents Cross-Site Scripting (XSS) in Thermal Printing and WebViews
 */

/**
 * Escapes sensitive HTML characters from untrusted strings to prevent XSS.
 * Safe for Arabic text, numbers, emojis, and standard symbols.
 */
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  const text = String(str);
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  return text.replace(/[&<>"'`]/g, char => htmlEscapes[char] || char);
}

/**
 * Sanitizes URLs to prevent javascript: or data: URI execution in href or src attributes.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^(?:(?:https?|mailto|tel):|\/|data:image\/)/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}
