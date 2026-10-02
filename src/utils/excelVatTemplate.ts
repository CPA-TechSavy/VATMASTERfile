import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { ClientProfile, Quarter } from '../types/tax';
import { getRealTimeTaxPeriod } from './taxCalculations';
import {
  BirTransactionRow,
  BirUploadedFileRecord,
  MonthIndex,
} from '../types/branchVat';

/**
 * Downloads pre-formatted Excel template (.xlsx) adhering strictly to BIR SLSP / VAT Relief specifications:
 *
 * Title Header:
 * - A1: "[Sales | Purchases] - [Quarter] - [Month or Consolidated]"
 * - A6: "TIN: [Client TIN]"
 * - A7: "OWNER'S NAME: [Client Registered Name]"
 * - A8: "OWNER'S TRADE NAME: [Client Trade Name]"
 *
 * Column Headers (Rows 11-12):
 * - A11:A12 TAXABLE MONTH (Merged, Wrap text, Center aligned, Bold)
 * - B11:B12 TAXPAYER IDENTIFICATION NUMBER (Merged, Wrap text, Center aligned, Bold - Transferred from B11:B13)
 * - C11:C12 REGISTERED NAME (Merged, Wrap text, Center aligned, Bold)
 * - D11:D12 SUPPLIER'S ADDRESS / CUSTOMER'S ADDRESS (Merged, Wrap text, Center aligned, Bold)
 * - E11:E12 AMOUNT OF GROSS PURCHASE / SALES (Merged, Wrap text, Center aligned, Bold)
 * - F11:F12 AMOUNT OF EXEMPT PURCHASE / SALES (Merged, Wrap text, Center aligned, Bold)
 * - G11:G12 AMOUNT OF ZERO-RATED PURCHASE / SALES (Merged, Wrap text, Center aligned, Bold)
 * - H11:H12 AMOUNT OF TAXABLE PURCHASE / SALES (Merged, Wrap text, Center aligned, Bold)
 * - I11:I12 AMOUNT OF PURCHASE / SALE OF SERVICES (Merged, Wrap text, Center aligned, Bold)
 * - J11:J12 AMOUNT OF PURCHASE / SALE OF CAPITAL GOODS (Merged, Wrap text, Center aligned, Bold)
 * - K11:K12 AMOUNT OF PURCHASE / SALE OF GOODS OTHER THAN CAPITAL GOODS (Merged, Wrap text, Center aligned, Bold)
 * - L11:L12 AMOUNT OF INPUT TAX / OUTPUT TAX (Merged, Wrap text, Center aligned, Bold)
 * - M11:M12 AMOUNT OF GROSS TAXABLE PURCHASE / SALES (Merged, Wrap text, Center aligned, Bold)
 *
 * Bold: Entire row 11 and 12 bolded
 *
 * Column Identifiers (Row 14):
 * - (1), (2), (3), (5), (6), (7), (8), (9), (10), (11), (12), (13), (14)
 *
 * Data Entry Area:
 * - Rows 15 to 1998: Empty rows reserved for transaction entry
 *
 * Summary & Footer:
 * - A1999: "Grand Total :"
 * - E1999:M1999: Sum fields initialized to 0 with SUM(E15:E1998) formulas
 * - A2001: "END OF REPORT"
 */
export async function downloadBirSlspExcelTemplate({
  type,
  quarter,
  monthLabel,
  client,
  branchName,
  includeSampleRow = false,
  formType,
}: {
  type: 'Sales' | 'Purchases';
  quarter: Quarter;
  monthLabel: '1st Month' | '2nd Month' | '3rd Month' | 'Consolidated';
  client?: ClientProfile | null;
  branchName?: string;
  includeSampleRow?: boolean;
  formType?: '2550Q' | '2551Q';
}) {
  const is2551Q = formType === '2551Q' || (!formType && client?.vatStatus === 'non-vat');
  const isPurchases = type === 'Purchases';
  const companyName = client ? (client.registeredName || client.tradeName || 'Taxpayer').trim() : 'Taxpayer';
  const cleanClient = companyName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const cleanBranch = branchName ? `_${branchName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}` : '';
  const filePrefix = is2551Q ? `BIR_2551Q_${type}_` : `BIR_${type}_`;
  const fileName = `${filePrefix}${quarter}_${monthLabel.replace(/\s+/g, '_')}_${cleanClient}${cleanBranch}.xlsx`;
  const sheetName = `${type}_${quarter}_${monthLabel.replace(/\s+/g, '')}`.slice(0, 31);

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'BIR Tax Return Calculator';
    wb.created = new Date();

    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    // 1. Title section
    const titleA1 = `${type} - ${quarter} - ${monthLabel}`;
    ws.getCell('A1').value = titleA1;
    ws.getCell('A1').font = { bold: true, size: 12, name: 'Calibri' };

    if (branchName) {
      ws.getCell('A2').value = `BRANCH / LINE OF BUSINESS: ${branchName}`;
      ws.getCell('A2').font = { bold: true, size: 10, name: 'Calibri' };
    }

    ws.getCell('A6').value = `TIN: ${client?.tin || '000-000-000-000'}`;
    ws.getCell('A6').font = { bold: true, size: 11, name: 'Calibri' };

    ws.getCell('A7').value = `OWNER'S NAME: ${client ? (client.registeredName || client.tradeName) : 'Registered Taxpayer'}`;
    ws.getCell('A7').font = { bold: true, size: 11, name: 'Calibri' };

    ws.getCell('A8').value = `OWNER'S TRADE NAME: ${client ? (client.tradeName || client.registeredName) : 'Trade Name'}`;
    ws.getCell('A8').font = { bold: true, size: 11, name: 'Calibri' };

    // 2. Column Headers
    // A11:A12 through K11:K12 (for 2551Q) or M11:M12 (for 2550Q)
    // In 2551Q, Column L and M are fully removed since there is no Output Tax under Percentage Tax
    const headers: { col: string; text: string }[] = isPurchases
      ? [
          { col: 'A', text: 'TAXABLE MONTH' },
          { col: 'B', text: 'TAXPAYER IDENTIFICATION NUMBER' },
          { col: 'C', text: 'REGISTERED NAME' },
          { col: 'D', text: "SUPPLIER'S ADDRESS" },
          { col: 'E', text: 'INVOICE / REFERENCE NO.' },
          { col: 'F', text: 'DESCRIPTION OF GOODS / SERVICES' },
          { col: 'G', text: 'AMOUNT OF EXEMPT PURCHASE' },
          { col: 'H', text: 'AMOUNT OF ZERO-RATED PURCHASE' },
          { col: 'I', text: 'PURCHASE OF SERVICES' },
          { col: 'J', text: 'PURCHASE OF CAPITAL GOODS' },
          { col: 'K', text: 'GOODS OTHER THAN CAPITAL GOODS' },
          { col: 'L', text: 'VATABLE PURCHASES (GOODS OTHER THAN CAPITAL GOODS)' },
          { col: 'M', text: 'AMOUNT OF INPUT TAX' },
          { col: 'N', text: 'AMOUNT OF GROSS TAXABLE PURCHASE / GROSS PURCHASES' },
        ]
      : [
          { col: 'A', text: 'TAXABLE MONTH' },
          { col: 'B', text: 'TAXPAYER IDENTIFICATION NUMBER' },
          { col: 'C', text: 'REGISTERED NAME' },
          { col: 'D', text: "CUSTOMER'S ADDRESS" },
          { col: 'E', text: 'AMOUNT OF GROSS SALES' },
          { col: 'F', text: 'AMOUNT OF EXEMPT SALES' },
          { col: 'G', text: 'AMOUNT OF ZERO-RATED SALES' },
          { col: 'H', text: 'AMOUNT OF TAXABLE SALES' },
          { col: 'I', text: 'AMOUNT OF SALE OF SERVICES' },
          { col: 'J', text: 'AMOUNT OF SALE OF CAPITAL GOODS' },
          { col: 'K', text: 'AMOUNT OF SALE OF GOODS OTHER THAN CAPITAL GOODS' },
          ...(!is2551Q
            ? [
                { col: 'L', text: 'AMOUNT OF OUTPUT TAX' },
                { col: 'M', text: 'AMOUNT OF GROSS TAXABLE SALES' },
              ]
            : []),
        ];

    // Set row height and bold entire row 11 and 12
    const row11 = ws.getRow(11);
    const row12 = ws.getRow(12);
    row11.height = 28;
    row12.height = 28;
    row11.font = { bold: true, size: 10, name: 'Calibri' };
    row12.font = { bold: true, size: 10, name: 'Calibri' };

    headers.forEach(({ col, text }) => {
      ws.mergeCells(`${col}11:${col}12`);

      const topCell = ws.getCell(`${col}11`);
      topCell.value = text;
      topCell.font = { bold: true, size: 10, name: 'Calibri' };
      topCell.alignment = {
        wrapText: true,
        horizontal: 'center',
        vertical: 'middle',
      };

      const bottomCell = ws.getCell(`${col}12`);
      bottomCell.font = { bold: true, size: 10, name: 'Calibri' };
      bottomCell.alignment = {
        wrapText: true,
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    // 3. Field Column Identifiers (Row 14)
    const identifiers = isPurchases
      ? ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)', '(14)']
      : is2551Q
      ? ['(1)', '(2)', '(3)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)']
      : ['(1)', '(2)', '(3)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)', '(14)'];

    const row14 = ws.getRow(14);
    row14.height = 20;
    headers.forEach(({ col }, idx) => {
      const cell = ws.getCell(`${col}14`);
      cell.value = identifiers[idx];
      cell.font = { bold: true, size: 9, name: 'Calibri' };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // 4. Data Entry Area (Rows 15 to 1998)
    // Blank template ready for user transaction entry (no pre-existing sample data)
    if (includeSampleRow) {
      // Intentionally kept clean without pre-existing sample rows per user requirement
    }

    // 5. Report Summary & Footer
    // Cell A1999 – Grand Total label (Grand Total :)
    const cellA1999 = ws.getCell('A1999');
    cellA1999.value = 'Grand Total :';
    cellA1999.font = { bold: true, size: 10, name: 'Calibri' };

    // Grand total sum fields
    const numCols = isPurchases
      ? ['G', 'H', 'L', 'M', 'N']
      : is2551Q
      ? ['E', 'F', 'G', 'H', 'I', 'J', 'K']
      : ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

    numCols.forEach((col) => {
      const cell = ws.getCell(`${col}1999`);
      cell.value = { formula: `SUM(${col}15:${col}1998)`, result: 0 };
      cell.font = { bold: true, size: 10, name: 'Calibri' };
      cell.numFmt = '#,##0.00';
    });

    // Cell A2001 – End of report marker (END OF REPORT)
    const cellA2001 = ws.getCell('A2001');
    cellA2001.value = 'END OF REPORT';
    cellA2001.font = { bold: true, size: 10, name: 'Calibri' };

    // Column widths for optimal readability
    const baseColumns = [
      { key: 'A', width: 18 }, // A: TAXABLE MONTH
      { key: 'B', width: 26 }, // B: TIN
      { key: 'C', width: 34 }, // C: REGISTERED NAME
      { key: 'D', width: 38 }, // D: ADDRESS
      { key: 'E', width: 22 }, // E: GROSS / REF
      { key: 'F', width: 20 }, // F: EXEMPT / DESC
      { key: 'G', width: 20 }, // G: ZERO-RATED / EXEMPT
      { key: 'H', width: 22 }, // H: TAXABLE / ZERO-RATED
      { key: 'I', width: 22 }, // I: SERVICES
      { key: 'J', width: 22 }, // J: CAPITAL GOODS
      { key: 'K', width: 26 }, // K: GOODS OTHER THAN CAPITAL
    ];

    if (isPurchases) {
      baseColumns.push(
        { key: 'L', width: 26 }, // L: VATABLE PURCHASES
        { key: 'M', width: 20 }, // M: INPUT TAX
        { key: 'N', width: 26 }  // N: GROSS PURCHASES
      );
    } else if (!is2551Q) {
      baseColumns.push(
        { key: 'L', width: 20 }, // L: TAX
        { key: 'M', width: 24 }  // M: GROSS TAXABLE
      );
    }

    ws.columns = baseColumns;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('ExcelJS workbook write failed, falling back to XLSX generator:', error);
    // Fallback generator using XLSX
    const ws: XLSX.WorkSheet = {};
    const setCell = (r: number, c: number, value: string | number, formula?: string) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (formula !== undefined) {
        ws[ref] = { t: 'n', v: typeof value === 'number' ? value : 0, f: formula };
      } else if (typeof value === 'number') {
        ws[ref] = { t: 'n', v: value };
      } else {
        ws[ref] = { t: 's', v: value };
      }
    };

    setCell(0, 0, `${type} - ${quarter} - ${monthLabel}`);
    if (branchName) setCell(1, 0, `BRANCH / LINE OF BUSINESS: ${branchName}`);
    setCell(5, 0, `TIN: ${client?.tin || '000-000-000-000'}`);
    setCell(6, 0, `OWNER'S NAME: ${client ? (client.registeredName || client.tradeName) : 'Registered Taxpayer'}`);
    setCell(7, 0, `OWNER'S TRADE NAME: ${client ? (client.tradeName || client.registeredName) : 'Trade Name'}`);

    const headerTexts = [
      'TAXABLE MONTH',
      'TAXPAYER IDENTIFICATION NUMBER',
      'REGISTERED NAME',
      isPurchases ? "SUPPLIER'S ADDRESS" : "CUSTOMER'S ADDRESS",
      isPurchases ? 'AMOUNT OF GROSS PURCHASE' : 'AMOUNT OF GROSS SALES',
      isPurchases ? 'AMOUNT OF EXEMPT PURCHASE' : 'AMOUNT OF EXEMPT SALES',
      isPurchases ? 'AMOUNT OF ZERO-RATED PURCHASE' : 'AMOUNT OF ZERO-RATED SALES',
      isPurchases ? 'AMOUNT OF TAXABLE PURCHASE' : 'AMOUNT OF TAXABLE SALES',
      isPurchases ? 'AMOUNT OF PURCHASE OF SERVICES' : 'AMOUNT OF SALE OF SERVICES',
      isPurchases ? 'AMOUNT OF PURCHASE OF CAPITAL GOODS' : 'AMOUNT OF SALE OF CAPITAL GOODS',
      isPurchases ? 'AMOUNT OF PURCHASE OF GOODS OTHER THAN CAPITAL GOODS' : 'AMOUNT OF SALE OF GOODS OTHER THAN CAPITAL GOODS',
      ...(!is2551Q
        ? [
            isPurchases ? 'AMOUNT OF INPUT TAX' : 'AMOUNT OF OUTPUT TAX',
            isPurchases ? 'AMOUNT OF GROSS TAXABLE PURCHASE' : 'AMOUNT OF GROSS TAXABLE SALES',
          ]
        : []),
    ];

    headerTexts.forEach((text, c) => {
      setCell(10, c, text);
      setCell(11, c, text);
    });

    const identifiers = is2551Q
      ? ['(1)', '(2)', '(3)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)']
      : ['(1)', '(2)', '(3)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)', '(14)'];
    identifiers.forEach((id, c) => setCell(13, c, id));

    if (includeSampleRow) {
      // Intentionally kept clean without pre-existing sample rows per user requirement
    }

    setCell(1998, 0, 'Grand Total :');
    const numCols = is2551Q
      ? ['E', 'F', 'G', 'H', 'I', 'J', 'K']
      : ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

    numCols.forEach((letter, i) => {
      setCell(1998, 4 + i, 0, `SUM(${letter}15:${letter}1998)`);
    });
    setCell(2000, 0, 'END OF REPORT');

    ws['!ref'] = is2551Q ? 'A1:K2001' : 'A1:M2001';
    ws['!merges'] = [
      { s: { r: 10, c: 0 }, e: { r: 11, c: 0 } }, // A11:A12
      { s: { r: 10, c: 1 }, e: { r: 11, c: 1 } }, // B11:B12
      { s: { r: 10, c: 2 }, e: { r: 11, c: 2 } }, // C11:C12
      { s: { r: 10, c: 3 }, e: { r: 11, c: 3 } }, // D11:D12
      { s: { r: 10, c: 4 }, e: { r: 11, c: 4 } }, // E11:E12
      { s: { r: 10, c: 5 }, e: { r: 11, c: 5 } }, // F11:F12
      { s: { r: 10, c: 6 }, e: { r: 11, c: 6 } }, // G11:G12
      { s: { r: 10, c: 7 }, e: { r: 11, c: 7 } }, // H11:H12
      { s: { r: 10, c: 8 }, e: { r: 11, c: 8 } }, // I11:I12
      { s: { r: 10, c: 9 }, e: { r: 11, c: 9 } }, // J11:J12
      { s: { r: 10, c: 10 }, e: { r: 11, c: 10 } }, // K11:K12
      ...(!is2551Q
        ? [
            { s: { r: 10, c: 11 }, e: { r: 11, c: 11 } }, // L11:L12
            { s: { r: 10, c: 12 }, e: { r: 11, c: 12 } }, // M11:M12
          ]
        : []),
    ];

    ws['!cols'] = is2551Q
      ? [
          { wch: 18 },
          { wch: 26 },
          { wch: 34 },
          { wch: 38 },
          { wch: 22 },
          { wch: 20 },
          { wch: 20 },
          { wch: 22 },
          { wch: 22 },
          { wch: 22 },
          { wch: 26 },
        ]
      : [
          { wch: 18 },
          { wch: 26 },
          { wch: 34 },
          { wch: 38 },
          { wch: 22 },
          { wch: 20 },
          { wch: 20 },
          { wch: 22 },
          { wch: 22 },
          { wch: 22 },
          { wch: 26 },
          { wch: 20 },
          { wch: 24 },
        ];

    const wbFallback = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbFallback, ws, sheetName);
    XLSX.writeFile(wbFallback, fileName);
  }
}

/**
 * Parses numeric cell values safely
 */
export function parseCellNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, '').replace(/₱/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Extracts a numeric value from a worksheet cell safely handling numbers, formatted text, and formulas.
 */
function getCellNumericValue(ws: XLSX.WorkSheet, r: number, colLetter: string): number {
  const cellRef = `${colLetter}${r + 1}`;
  const cell = ws[cellRef];
  if (!cell) return 0;
  if (typeof cell.v === 'number') {
    return isNaN(cell.v) ? 0 : cell.v;
  }
  if (cell.v !== undefined && cell.v !== null) {
    const parsed = parseCellNumber(cell.v);
    if (!isNaN(parsed) && parsed !== 0) return parsed;
  }
  if (cell.w !== undefined && cell.w !== null) {
    const parsed = parseCellNumber(cell.w);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Extracts a numeric value from a cell, falling back to summing the column above if the formula was uncomputed.
 */
function getCellNumericWithFallback(ws: XLSX.WorkSheet, r: number, colLetter: string, startRow = 14): number {
  let val = getCellNumericValue(ws, r, colLetter);
  if (val === 0 && ws[`${colLetter}${r + 1}`]?.f) {
    let sum = 0;
    for (let rowIdx = startRow; rowIdx < r; rowIdx++) {
      sum += getCellNumericValue(ws, rowIdx, colLetter);
    }
    if (sum > 0) val = sum;
  }
  return val;
}

/**
 * Locates the row index containing "Grand Total" or "Grand Total :" in any cell.
 */
function locateGrandTotalRow(ws: XLSX.WorkSheet): number {
  const candidateRows: Set<number> = new Set();

  // 1. Scan via Object.keys for fast, unbounded discovery across all sheet cells
  for (const cellKey of Object.keys(ws)) {
    if (cellKey.startsWith('!')) continue;
    const cell = ws[cellKey];
    if (!cell) continue;
    const text = String(cell.w ?? cell.v ?? '').trim().toLowerCase();
    const norm = text.replace(/[:\s]+/g, ' ').trim();
    if (
      norm === 'grand total' ||
      norm.startsWith('grand total') ||
      norm.includes('grand total')
    ) {
      try {
        const decoded = XLSX.utils.decode_cell(cellKey);
        candidateRows.add(decoded.r);
      } catch {
        // ignore
      }
    }
  }

  // 2. Fallback scan via worksheet range if Object.keys was empty
  if (candidateRows.size === 0) {
    const range = ws['!ref']
      ? XLSX.utils.decode_range(ws['!ref'])
      : { s: { r: 0, c: 0 }, e: { r: 2500, c: 26 } };
    const maxR = Math.max(range.e.r, 2000);
    const maxC = Math.max(range.e.c, 25);

    for (let r = 0; r <= maxR; r++) {
      for (let c = 0; c <= maxC; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellRef];
        if (cell && (cell.v !== undefined || cell.w !== undefined)) {
          const text = String(cell.w ?? cell.v ?? '').trim().toLowerCase();
          const norm = text.replace(/[:\s]+/g, ' ').trim();
          if (
            norm === 'grand total' ||
            norm.startsWith('grand total') ||
            norm.includes('grand total')
          ) {
            candidateRows.add(r);
            break;
          }
        }
      }
    }
  }

  const sortedCandidates = Array.from(candidateRows).sort((a, b) => a - b);
  if (sortedCandidates.length === 0) {
    return 1998; // Default to row 1999 (0-indexed 1998)
  }

  // If multiple candidates, pick the one with financial values in L, M, N, G, or H (from bottom up)
  for (let i = sortedCandidates.length - 1; i >= 0; i--) {
    const rCand = sortedCandidates[i];
    const valL = getCellNumericValue(ws, rCand, 'L');
    const valM = getCellNumericValue(ws, rCand, 'M');
    const valN = getCellNumericValue(ws, rCand, 'N');
    const valG = getCellNumericValue(ws, rCand, 'G');
    const valH = getCellNumericValue(ws, rCand, 'H');
    if (valL > 0 || valM > 0 || valN > 0 || valG > 0 || valH > 0) {
      return rCand;
    }
  }

  return sortedCandidates[sortedCandidates.length - 1];
}

/**
 * Parses uploaded BIR SLSP / VAT Relief Excel or CSV file according to specification:
 * - Reads header A1, A6, A7, A8
 * - For Purchases (Consolidated or Per Branch):
 *   1. Locates the row containing the text "Grand Total" or "Grand Total :".
 *   2. On that specific Grand Total row, extracts financial values from:
 *      - Column L: VATable Purchases (Goods Other Than Capital Goods / Taxable Purchases)
 *      - Column M: Input Tax
 *      - Column N: Gross Taxable Purchases / Gross Purchases
 *      - Column G: Exempt Purchases
 *      - Column H: Zero-Rated Purchases
 *   3. Applies conditional formatting/filtering rules:
 *      - Column L Value -> Assigns to "VATable Purchases"
 *      - Column M Value -> Assigns to "Input Tax"
 *      - Column N Value -> Assigns to "Gross Purchases"
 *      - Column G Value:
 *        * IF Column G > 0: Reflects under "Exempt Purchases"
 *        * IF Column G == 0 (or empty): Does NOT list or reflect "Exempt Purchases"
 *      - Column H Value:
 *        * IF Column H > 0: Reflects under "Zero-Rated Purchases"
 *        * IF Column H == 0 (or empty): Does NOT list or reflect "Zero-Rated Purchases"
 */
export function parseBirSlspExcelFile(
  buffer: ArrayBuffer,
  fileName: string,
  expectedType?: 'sales' | 'purchases',
  expectedMonth?: MonthIndex | 'consolidated',
  branchId?: string,
  branchName?: string,
  expectedQuarter: Quarter = getRealTimeTaxPeriod().quarter
): BirUploadedFileRecord {
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: true, cellHTML: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Read header metadata if present
  const cellA1 = ws['A1'] ? String(ws['A1'].v || '').trim() : '';
  const cellA6 = ws['A6'] ? String(ws['A6'].v || '').trim() : '';
  const cellA7 = ws['A7'] ? String(ws['A7'].v || '').trim() : '';
  const cellA8 = ws['A8'] ? String(ws['A8'].v || '').trim() : '';

  // Determine fileType
  let detectedType: 'sales' | 'purchases' = expectedType || 'sales';
  const a1Lower = cellA1.toLowerCase();
  const fileNameLower = fileName.toLowerCase();

  if (a1Lower.includes('purchase') || fileNameLower.includes('purchase')) {
    detectedType = 'purchases';
  } else if (a1Lower.includes('sale') || fileNameLower.includes('sale')) {
    detectedType = 'sales';
  }

  // Determine quarter
  let detectedQuarter: Quarter = expectedQuarter;
  if (a1Lower.includes('q1') || fileNameLower.includes('q1')) detectedQuarter = 'Q1';
  else if (a1Lower.includes('q2') || fileNameLower.includes('q2')) detectedQuarter = 'Q2';
  else if (a1Lower.includes('q3') || fileNameLower.includes('q3')) detectedQuarter = 'Q3';
  else if (a1Lower.includes('q4') || fileNameLower.includes('q4')) detectedQuarter = 'Q4';

  // Determine month
  let detectedMonth: MonthIndex | 'consolidated' = expectedMonth || 1;
  if (a1Lower.includes('consolidated') || fileNameLower.includes('consolidated')) {
    detectedMonth = 'consolidated';
  } else if (a1Lower.includes('3rd') || a1Lower.includes('month 3') || fileNameLower.includes('m3') || fileNameLower.includes('month_3') || fileNameLower.includes('month3')) {
    detectedMonth = 3;
  } else if (a1Lower.includes('2nd') || a1Lower.includes('month 2') || fileNameLower.includes('m2') || fileNameLower.includes('month_2') || fileNameLower.includes('month2')) {
    detectedMonth = 2;
  } else if (a1Lower.includes('1st') || a1Lower.includes('month 1') || fileNameLower.includes('m1') || fileNameLower.includes('month_1') || fileNameLower.includes('month1')) {
    detectedMonth = 1;
  }

  const transactions: BirTransactionRow[] = [];
  const isPurchases = detectedType === 'purchases';

  let totals = {
    grossAmount: 0,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 0,
    servicesAmount: 0,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 0,
    grossTaxableAmount: 0,
  };

  if (isPurchases) {
    // ==========================================
    // PURCHASES PARSING LOGIC (Consolidated or Per Branch)
    // ==========================================
    // 1. Locate the row containing "Grand Total" or "Grand Total :"
    const grandTotalRow = locateGrandTotalRow(ws);

    // 2. On that specific Grand Total row, extract the financial values from:
    //    - Column L: VATable Purchases (Goods Other Than Capital Goods / Taxable Purchases)
    //    - Column M: Input Tax
    //    - Column N: Gross Taxable Purchases / Gross Purchases
    //    - Column G: Exempt Purchases
    //    - Column H: Zero-Rated Purchases
    const valColL = getCellNumericWithFallback(ws, grandTotalRow, 'L');
    const valColM = getCellNumericWithFallback(ws, grandTotalRow, 'M');
    const valColN = getCellNumericWithFallback(ws, grandTotalRow, 'N');
    const valColG = getCellNumericWithFallback(ws, grandTotalRow, 'G');
    const valColH = getCellNumericWithFallback(ws, grandTotalRow, 'H');

    // 3. Apply conditional formatting/filtering rules:
    //    - Column L Value -> Assign to "VATable Purchases"
    //    - Column M Value -> Assign to "Input Tax"
    //    - Column N Value -> Assign to "Gross Purchases"
    //    - Column G Value:
    //      * IF Column G > 0: Reflect the amount under "Exempt Purchases".
    //      * IF Column G == 0 (or empty): Do NOT list or reflect "Exempt Purchases".
    //    - Column H Value:
    //      * IF Column H > 0: Reflect the amount under "Zero-Rated Purchases".
    //      * IF Column H == 0 (or empty): Do NOT list or reflect "Zero-Rated Purchases".
    const vatablePurchases = valColL;
    const inputTax = valColM;
    const exemptPurchases = valColG > 0 ? valColG : 0;
    const zeroRatedPurchases = valColH > 0 ? valColH : 0;
    const grossPurchases = valColN > 0
      ? valColN
      : (vatablePurchases + inputTax + exemptPurchases + zeroRatedPurchases);

    totals = {
      grossAmount: grossPurchases,
      taxableAmount: vatablePurchases, // VATable Purchases
      taxAmount: inputTax,             // Input Tax
      exemptAmount: exemptPurchases,   // Exempt Purchases (> 0 only)
      zeroRatedAmount: zeroRatedPurchases, // Zero-Rated Purchases (> 0 only)
      goodsOtherThanCapitalAmount: vatablePurchases,
      servicesAmount: 0,
      capitalGoodsAmount: 0,
      grossTaxableAmount: valColN > 0 ? valColN : (vatablePurchases + inputTax),
    };

    // Scan line items from row 15 (index 14) up to the Grand Total row
    for (let r = 14; r < grandTotalRow; r++) {
      const cellA = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      const cellB = ws[XLSX.utils.encode_cell({ r, c: 1 })];
      const cellC = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      const cellD = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      const cellG = ws[XLSX.utils.encode_cell({ r, c: 6 })];
      const cellH = ws[XLSX.utils.encode_cell({ r, c: 7 })];
      const cellL = ws[XLSX.utils.encode_cell({ r, c: 11 })];
      const cellM = ws[XLSX.utils.encode_cell({ r, c: 12 })];
      const cellN = ws[XLSX.utils.encode_cell({ r, c: 13 })];

      const tinVal = cellB ? String(cellB.w ?? cellB.v ?? '').trim() : '';
      const nameVal = cellC ? String(cellC.w ?? cellC.v ?? '').trim() : '';
      const txExempt = parseCellNumber(cellG?.v ?? cellG?.w);
      const txZero = parseCellNumber(cellH?.v ?? cellH?.w);
      const txVatable = parseCellNumber(cellL?.v ?? cellL?.w);
      const txInputTax = parseCellNumber(cellM?.v ?? cellM?.w);
      const txGross = parseCellNumber(cellN?.v ?? cellN?.w) || (txVatable + txInputTax + (txExempt > 0 ? txExempt : 0) + (txZero > 0 ? txZero : 0));

      if (tinVal || nameVal || txGross > 0 || txVatable > 0 || txInputTax > 0 || txExempt > 0 || txZero > 0) {
        if (
          tinVal.toLowerCase().includes('taxpayer') ||
          nameVal.toLowerCase().includes('registered') ||
          tinVal.toLowerCase().includes('grand total') ||
          nameVal.toLowerCase().includes('grand total')
        ) {
          continue;
        }

        transactions.push({
          rowNum: r + 1,
          taxableMonth: cellA ? String(cellA.w ?? cellA.v ?? '').trim() : '',
          tin: tinVal,
          registeredName: nameVal,
          address: cellD ? String(cellD.w ?? cellD.v ?? '').trim() : '',
          grossAmount: txGross,
          exemptAmount: txExempt > 0 ? txExempt : 0,
          zeroRatedAmount: txZero > 0 ? txZero : 0,
          taxableAmount: txVatable,
          servicesAmount: 0,
          capitalGoodsAmount: 0,
          goodsOtherThanCapitalAmount: txVatable,
          taxAmount: txInputTax,
          grossTaxableAmount: txGross,
        });
      }
    }

    // Fallback: If grand total row had zero across all columns but transaction rows were entered
    if (totals.taxableAmount === 0 && totals.taxAmount === 0 && totals.grossAmount === 0 && transactions.length > 0) {
      const txSumL = transactions.reduce((acc, t) => acc + t.taxableAmount, 0);
      const txSumM = transactions.reduce((acc, t) => acc + t.taxAmount, 0);
      const txSumN = transactions.reduce((acc, t) => acc + t.grossAmount, 0);
      const txSumG = transactions.reduce((acc, t) => acc + t.exemptAmount, 0);
      const txSumH = transactions.reduce((acc, t) => acc + t.zeroRatedAmount, 0);

      totals = {
        grossAmount: txSumN,
        taxableAmount: txSumL,
        taxAmount: txSumM,
        exemptAmount: txSumG > 0 ? txSumG : 0,
        zeroRatedAmount: txSumH > 0 ? txSumH : 0,
        goodsOtherThanCapitalAmount: txSumL,
        servicesAmount: 0,
        capitalGoodsAmount: 0,
        grossTaxableAmount: txSumN || (txSumL + txSumM),
      };
    }
  } else {
    // ==========================================
    // SALES PARSING LOGIC
    // ==========================================
    for (let r = 14; r <= 1997; r++) {
      const cellA = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      const cellB = ws[XLSX.utils.encode_cell({ r, c: 1 })];
      const cellC = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      const cellD = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      const cellE = ws[XLSX.utils.encode_cell({ r, c: 4 })];
      const cellF = ws[XLSX.utils.encode_cell({ r, c: 5 })];
      const cellG = ws[XLSX.utils.encode_cell({ r, c: 6 })];
      const cellH = ws[XLSX.utils.encode_cell({ r, c: 7 })];
      const cellI = ws[XLSX.utils.encode_cell({ r, c: 8 })];
      const cellJ = ws[XLSX.utils.encode_cell({ r, c: 9 })];
      const cellK = ws[XLSX.utils.encode_cell({ r, c: 10 })];
      const cellL = ws[XLSX.utils.encode_cell({ r, c: 11 })];
      const cellM = ws[XLSX.utils.encode_cell({ r, c: 12 })];

      const gross = parseCellNumber(cellE?.v ?? cellE?.w);
      const exempt = parseCellNumber(cellF?.v ?? cellF?.w);
      const zeroRated = parseCellNumber(cellG?.v ?? cellG?.w);
      const taxable = parseCellNumber(cellH?.v ?? cellH?.w);
      const services = parseCellNumber(cellI?.v ?? cellI?.w);
      const capital = parseCellNumber(cellJ?.v ?? cellJ?.w);
      const goodsOther = parseCellNumber(cellK?.v ?? cellK?.w);
      const tax = parseCellNumber(cellL?.v ?? cellL?.w);
      const grossTaxable = parseCellNumber(cellM?.v ?? cellM?.w);

      const tinVal = cellB ? String(cellB.v || cellB.w || '').trim() : '';
      const nameVal = cellC ? String(cellC.v || cellC.w || '').trim() : '';

      if (
        tinVal ||
        nameVal ||
        gross > 0 ||
        taxable > 0 ||
        tax > 0 ||
        exempt > 0 ||
        zeroRated > 0
      ) {
        if (
          tinVal.toLowerCase().includes('taxpayer') ||
          nameVal.toLowerCase().includes('registered') ||
          tinVal.toLowerCase().includes('grand total') ||
          nameVal.toLowerCase().includes('grand total')
        ) {
          continue;
        }

        transactions.push({
          rowNum: r + 1,
          taxableMonth: cellA ? String(cellA.v || cellA.w || '').trim() : '',
          tin: tinVal,
          registeredName: nameVal,
          address: cellD ? String(cellD.v || cellD.w || '').trim() : '',
          grossAmount: gross,
          exemptAmount: exempt,
          zeroRatedAmount: zeroRated,
          taxableAmount: taxable,
          servicesAmount: services,
          capitalGoodsAmount: capital,
          goodsOtherThanCapitalAmount: goodsOther,
          taxAmount: tax,
          grossTaxableAmount: grossTaxable,
        });
      }
    }

    if (transactions.length > 0) {
      totals = transactions.reduce(
        (acc, t) => ({
          grossAmount: acc.grossAmount + t.grossAmount,
          exemptAmount: acc.exemptAmount + t.exemptAmount,
          zeroRatedAmount: acc.zeroRatedAmount + t.zeroRatedAmount,
          taxableAmount: acc.taxableAmount + t.taxableAmount,
          servicesAmount: acc.servicesAmount + t.servicesAmount,
          capitalGoodsAmount: acc.capitalGoodsAmount + t.capitalGoodsAmount,
          goodsOtherThanCapitalAmount: acc.goodsOtherThanCapitalAmount + t.goodsOtherThanCapitalAmount,
          taxAmount: acc.taxAmount + t.taxAmount,
          grossTaxableAmount: acc.grossTaxableAmount + t.grossTaxableAmount,
        }),
        {
          grossAmount: 0,
          exemptAmount: 0,
          zeroRatedAmount: 0,
          taxableAmount: 0,
          servicesAmount: 0,
          capitalGoodsAmount: 0,
          goodsOtherThanCapitalAmount: 0,
          taxAmount: 0,
          grossTaxableAmount: 0,
        }
      );
    }

    // Check Row 1999 directly for Sales
    const row1999E = parseCellNumber(ws['E1999']?.v ?? ws['E1999']?.w);
    const row1999F = parseCellNumber(ws['F1999']?.v ?? ws['F1999']?.w);
    const row1999G = parseCellNumber(ws['G1999']?.v ?? ws['G1999']?.w);
    const row1999H = parseCellNumber(ws['H1999']?.v ?? ws['H1999']?.w);
    const row1999I = parseCellNumber(ws['I1999']?.v ?? ws['I1999']?.w);
    const row1999J = parseCellNumber(ws['J1999']?.v ?? ws['J1999']?.w);
    const row1999K = parseCellNumber(ws['K1999']?.v ?? ws['K1999']?.w);
    const row1999L = parseCellNumber(ws['L1999']?.v ?? ws['L1999']?.w);
    const row1999M = parseCellNumber(ws['M1999']?.v ?? ws['M1999']?.w);

    if (
      row1999E > 0 ||
      row1999H > 0 ||
      row1999L > 0 ||
      row1999F > 0 ||
      row1999G > 0
    ) {
      if (totals.taxableAmount === 0 && totals.taxAmount === 0 && totals.grossAmount === 0) {
        totals = {
          grossAmount: row1999E || (row1999H + row1999L + row1999F + row1999G),
          exemptAmount: row1999F,
          zeroRatedAmount: row1999G,
          taxableAmount: row1999H,
          servicesAmount: row1999I,
          capitalGoodsAmount: row1999J,
          goodsOtherThanCapitalAmount: row1999K,
          taxAmount: row1999L,
          grossTaxableAmount: row1999M || (row1999H + row1999L),
        };
      } else {
        if (totals.exemptAmount === 0 && row1999F > 0) totals.exemptAmount = row1999F;
        if (totals.zeroRatedAmount === 0 && row1999G > 0) totals.zeroRatedAmount = row1999G;
        if (totals.taxAmount === 0 && row1999L > 0) totals.taxAmount = row1999L;
        if (totals.taxableAmount === 0 && row1999H > 0) totals.taxableAmount = row1999H;
        if (totals.grossAmount === 0 && row1999E > 0) totals.grossAmount = row1999E;
      }
    }
  }

  // If tax was not explicitly entered but taxable amount was, compute 12% for convenience
  if (totals.taxAmount === 0 && totals.taxableAmount > 0) {
    totals.taxAmount = Math.round(totals.taxableAmount * 0.12 * 100) / 100;
  }
  if (totals.grossAmount === 0 && totals.taxableAmount > 0) {
    totals.grossAmount = totals.taxableAmount + totals.exemptAmount + totals.zeroRatedAmount;
  }

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fileType: detectedType,
    quarter: detectedQuarter,
    month: detectedMonth,
    branchId,
    branchName,
    fileName,
    uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tinHeader: cellA6,
    ownerNameHeader: cellA7,
    tradeNameHeader: cellA8,
    rowCount: transactions.length || (totals.taxableAmount > 0 ? 1 : 0),
    totals,
    transactions,
  };
}

/**
 * Legacy support for downloadVatExcelTemplate so any previous references continue working
 */
export function downloadVatExcelTemplate(clientTradeName: string, quarter: string, year: number) {
  const dummyClient: ClientProfile = {
    id: 'client',
    tradeName: clientTradeName,
    registeredName: clientTradeName,
    tin: '000-000-000-000',
    rdo: 'RDO 044',
    classification: 'Corporation',
    vatStatus: 'vat-registered',
    isWithholdingAgent: true,
  };

  downloadBirSlspExcelTemplate({
    type: 'Sales',
    quarter: (quarter as Quarter) || getRealTimeTaxPeriod().quarter,
    monthLabel: '1st Month',
    client: dummyClient,
    includeSampleRow: false,
  });
}
