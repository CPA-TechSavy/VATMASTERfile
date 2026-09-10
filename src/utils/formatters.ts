/**
 * Formats a number to Philippine Peso currency display
 */
export function formatPHP(value: number, includeSymbol = true): string {
  if (isNaN(value) || value === null || value === undefined) {
    return includeSymbol ? '₱0.00' : '0.00';
  }

  const formatted = Math.abs(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const prefix = value < 0 ? `(${includeSymbol ? '₱' : ''}${formatted})` : `${includeSymbol ? '₱' : ''}${formatted}`;
  return prefix;
}

/**
 * Clean TIN input to 000-000-000-000 format
 */
export function formatTIN(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 12);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 9));
  if (digits.length > 9) parts.push(digits.slice(9, 12));
  return parts.join('-');
}

/**
 * Parse input string or number safely
 */
export function parseNumber(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
