import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { ClientProfile } from '../types/tax';
import { SawtRecord, SawtSummary } from '../types/sawt';
import { parseNumber } from './formatters';

// Target Column as per Rule 1: Focus strictly on Column I (Index 8 / 9th column)
export const TARGET_COL_I = 8;

/**
 * Checks if a cell value is a formatting border or line of dashes
 * (e.g. "------------------", "==================", "---", "===").
 */
export function isFormattingBorder(val: any): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  return /^[-=_*#\s]{2,}$/.test(str);
}

/**
 * Safely extracts a numeric value from a cell:
 * - Returns null if the value is empty, a formatting border/dash, or non-numeric.
 * - Handles currency symbols (₱, P, $), commas, and whitespace.
 */
export function extractCleanNumeric(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;

  // Rule 4 requirement: Ignore formatting borders/dashes (e.g., "------------------", "==================")
  if (isFormattingBorder(str)) return null;

  // Strip currency signs (₱, P, $) and outer whitespace
  const withoutCurrency = str.replace(/[₱P$]/gi, '').trim();
  // Strip commas and any inner whitespace
  const cleaned = withoutCurrency.replace(/,/g, '').replace(/\s+/g, '');

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export interface SawtExtractionResult {
  totalCwt: number | null;
  totalGross: number | null;
  method: 'grand_total_row' | 'fallback_summary_total' | 'sum_of_transactions';
  details: string;
  targetColI: number;
  grandTotalRowIndex: number;
  endOfReportRowIndex: number;
}

/**
 * Executes the user's specific rules for extracting the SAWT Grand Total:
 * Rule 1: Locate Target Column: Focus strictly on Column I (Index 8 / 9th column), which contains "AMOUNT OF TAX WITHHELD".
 * Rule 2: Locate Target Row: Scan Column A (or across the row) for the label containing "Grand Total" or "Grand Total :".
 * Rule 3: Extract Value: Return the numeric value located at the intersection of the "Grand Total" row and Column I.
 * Rule 4: Fallback Logic (if row label is missing):
 *    - Filter Column I for numeric values.
 *    - Ignore formatting borders/dashes (e.g., "------------------", "==================").
 *    - Locate the standalone summary total located directly below the main transaction data and before "END OF REPORT".
 */
export function extractGrandTotalFromSawt(rawRows: any[][]): SawtExtractionResult {
  let grandTotalRowIndex = -1;
  let endOfReportRowIndex = -1;

  // Scan all rows to locate target rows
  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    // Detect "END OF REPORT"
    const rowStr = row.map((c) => String(c || '').trim()).join(' ').toUpperCase();
    if (rowStr.includes('END OF REPORT') || rowStr.includes('END OF FILE')) {
      endOfReportRowIndex = r;
    }

    // Rule 2: Scan Column A (or across the row) for the label containing "Grand Total" or "Grand Total :"
    if (grandTotalRowIndex === -1) {
      const colA = String(row[0] || '').trim().toLowerCase();
      if (/grand\s*total/i.test(colA)) {
        grandTotalRowIndex = r;
      } else {
        const hasGrandTotal = row.some((cell) => {
          const s = String(cell || '').trim().toLowerCase();
          return /grand\s*total/i.test(s);
        });
        if (hasGrandTotal) {
          grandTotalRowIndex = r;
        }
      }
    }
  }

  // Rule 3: Return the numeric value located at the intersection of the "Grand Total" row and Column I (Index 8)
  if (grandTotalRowIndex !== -1) {
    const row = rawRows[grandTotalRowIndex];
    const valColI = row ? extractCleanNumeric(row[TARGET_COL_I]) : null;
    const valGrossColG = row && row.length > 6 ? extractCleanNumeric(row[6]) : null;

    if (valColI !== null) {
      return {
        totalCwt: Math.round(valColI * 100) / 100,
        totalGross: valGrossColG !== null ? Math.round(valGrossColG * 100) / 100 : null,
        method: 'grand_total_row',
        details: `Extracted directly from Column I (Index 8: AMOUNT OF TAX WITHHELD) intersecting 'Grand Total' row (Row ${grandTotalRowIndex + 1}).`,
        targetColI: TARGET_COL_I,
        grandTotalRowIndex,
        endOfReportRowIndex,
      };
    }

    // If Column I was empty (e.g. shifted column in custom spreadsheet), look across row for numeric cell
    for (let c = row.length - 1; c >= 0; c--) {
      const numVal = extractCleanNumeric(row[c]);
      if (numVal !== null) {
        const colLetter = String.fromCharCode(65 + c);
        return {
          totalCwt: Math.round(numVal * 100) / 100,
          totalGross: valGrossColG !== null ? Math.round(valGrossColG * 100) / 100 : null,
          method: 'grand_total_row',
          details: `Extracted from 'Grand Total' row (Row ${grandTotalRowIndex + 1}), Column ${colLetter}.`,
          targetColI: c,
          grandTotalRowIndex,
          endOfReportRowIndex,
        };
      }
    }
  }

  // Rule 4: Fallback Logic (if row label is missing):
  // Filter Column I for numeric values, ignore formatting borders/dashes,
  // and locate the standalone summary total located directly below the main transaction data (Row 16 onwards) and before "END OF REPORT".
  const minSearchRow = rawRows.length > 15 ? 15 : 0;
  if (endOfReportRowIndex !== -1) {
    for (let r = endOfReportRowIndex - 1; r >= minSearchRow; r--) {
      const row = rawRows[r];
      if (!row) continue;
      const numVal = extractCleanNumeric(row[TARGET_COL_I]);
      if (numVal !== null) {
        const valGrossColG = row.length > 6 ? extractCleanNumeric(row[6]) : null;
        return {
          totalCwt: Math.round(numVal * 100) / 100,
          totalGross: valGrossColG !== null ? Math.round(valGrossColG * 100) / 100 : null,
          method: 'fallback_summary_total',
          details: `Fallback: Located standalone summary total in Column I (Row ${r + 1}) directly before 'END OF REPORT' (Row ${endOfReportRowIndex + 1}).`,
          targetColI: TARGET_COL_I,
          grandTotalRowIndex: r,
          endOfReportRowIndex,
        };
      }
    }
  }

  // If no "END OF REPORT", locate the bottommost standalone summary total in Column I below main transactions
  for (let r = rawRows.length - 1; r >= minSearchRow; r--) {
    const row = rawRows[r];
    if (!row) continue;
    const numVal = extractCleanNumeric(row[TARGET_COL_I]);
    if (numVal !== null) {
      const valGrossColG = row.length > 6 ? extractCleanNumeric(row[6]) : null;
      return {
        totalCwt: Math.round(numVal * 100) / 100,
        totalGross: valGrossColG !== null ? Math.round(valGrossColG * 100) / 100 : null,
        method: 'fallback_summary_total',
        details: `Fallback: Located standalone summary total in Column I (Row ${r + 1}) below main transactions.`,
        targetColI: TARGET_COL_I,
        grandTotalRowIndex: r,
        endOfReportRowIndex: -1,
      };
    }
  }

  return {
    totalCwt: null,
    totalGross: null,
    method: 'sum_of_transactions',
    details: 'Row label not found; computed by summing individual transaction lines in Column I.',
    targetColI: TARGET_COL_I,
    grandTotalRowIndex: -1,
    endOfReportRowIndex,
  };
}

/**
 * Parses an uploaded SAWT (Summary Alphanumeric Tax Table) Excel or CSV file.
 * Strictly adheres to the 4 extraction rules for identifying the Grand Total CWT.
 */
export function parseSawtExcelFile(buffer: ArrayBuffer | Uint8Array, fileName: string): SawtSummary {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded file does not contain any readable sheets.');
  }

  // Find sheet: prefer sheet named 'SAWT', '2307', 'Summary', or first sheet
  const targetSheetName =
    workbook.SheetNames.find((name) =>
      /sawt|2307|cwt|withholding/i.test(name)
    ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${targetSheetName}" could not be read.`);
  }

  // Convert to 2D array (preserve empty rows so row index accurately aligns with Excel 1-based row numbers)
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: true,
  });

  if (rawRows.length < 2) {
    throw new Error('The uploaded spreadsheet has no data rows.');
  }

  // Execute extraction rules for the Grand Total CWT
  const extraction = extractGrandTotalFromSawt(rawRows);

  // Find header row by matching keywords in rows 1 to 15 (indices 0 to 14)
  let headerRowIndex = -1;
  let colIndex = {
    seq: 0,
    period: 1,
    tin: 2,
    name: 3,
    atc: 4,
    nature: 5,
    gross: 6,
    rate: 7,
    cwt: TARGET_COL_I, // Strictly Column I (Index 8)
  };

  const maxHeaderScan = Math.min(rawRows.length, 15);
  for (let r = 0; r < maxHeaderScan; r++) {
    const row = rawRows[r].map((cell) => String(cell || '').trim().toLowerCase());

    const tinIdx = row.findIndex((c) =>
      c.includes('tin') || c.includes('taxpayer identification') || c.includes('payor tin')
    );
    const nameIdx = row.findIndex((c) =>
      c.includes('registered name') ||
      c.includes('payor') ||
      c.includes('withholding agent') ||
      c.includes('name of payor') ||
      c.includes('company') ||
      c.includes('customer')
    );
    const cwtIdx = row.findIndex((c) =>
      c.includes('tax withheld') ||
      c.includes('amount of tax withheld') ||
      c.includes('cwt') ||
      c.includes('creditable') ||
      c.includes('withholding tax') ||
      c.includes('tax credit') ||
      c.includes('2307')
    );

    if (tinIdx !== -1 && (nameIdx !== -1 || cwtIdx !== -1)) {
      headerRowIndex = r;
      colIndex.tin = tinIdx;
      colIndex.name = nameIdx !== -1 ? nameIdx : 3;
      colIndex.cwt = cwtIdx !== -1 ? cwtIdx : TARGET_COL_I;

      // Map other columns
      row.forEach((cellText, idx) => {
        if (idx === tinIdx || idx === nameIdx || idx === colIndex.cwt) return;

        if (cellText.includes('seq') || cellText.includes('no.') || cellText === '#') {
          colIndex.seq = idx;
        } else if (
          cellText.includes('quarter') || cellText.includes('period') || cellText.includes('month') || cellText.includes('date')
        ) {
          colIndex.period = idx;
        } else if (cellText.includes('atc') || cellText.includes('tax code') || cellText.includes('alpha')) {
          colIndex.atc = idx;
        } else if (
          cellText.includes('nature') || cellText.includes('description') || cellText.includes('particulars') || cellText.includes('income payment')
        ) {
          colIndex.nature = idx;
        } else if (
          cellText.includes('gross') ||
          cellText.includes('tax base') ||
          cellText.includes('amount of income') ||
          cellText.includes('income amount') ||
          cellText.includes('taxable amount') ||
          cellText.includes('amount')
        ) {
          colIndex.gross = idx;
        } else if (cellText.includes('rate') || cellText.includes('%') || cellText.includes('percent')) {
          colIndex.rate = idx;
        }
      });
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  const records: SawtRecord[] = [];
  const uniquePayors = new Set<string>();
  const quarterlyBreakdown = {
    Q1: { gross: 0, cwt: 0, count: 0 },
    Q2: { gross: 0, cwt: 0, count: 0 },
    Q3: { gross: 0, cwt: 0, count: 0 },
    Q4: { gross: 0, cwt: 0, count: 0 },
    unspecified: { gross: 0, cwt: 0, count: 0 },
  };
  const atcBreakdown: Record<string, { description: string; gross: number; cwt: number; count: number }> = {};

  let sumLineItemsCwt = 0;
  let sumLineItemsGross = 0;

  // Start the capture of data in Row 16 (0-based index 15 in Excel)
  // If the sheet has fewer than 16 rows, fall back to row immediately after detected header
  const DATA_START_ROW_INDEX = 15; // Excel Row 16
  const startRowIndex = rawRows.length > DATA_START_ROW_INDEX
    ? DATA_START_ROW_INDEX
    : Math.max(0, headerRowIndex + 1);

  for (let r = startRowIndex; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    // Skip formatting borders/dashes (e.g., "------------------", "==================")
    if (row.every((cell) => cell === '' || isFormattingBorder(cell))) {
      continue;
    }
    if (isFormattingBorder(row[0])) {
      continue;
    }

    // Skip the detected Grand Total row and "END OF REPORT" row
    if (r === extraction.grandTotalRowIndex || r === extraction.endOfReportRowIndex) {
      continue;
    }

    const rowStr = row.map((c) => String(c || '').trim()).join(' ').toUpperCase();
    if (
      rowStr.includes('GRAND TOTAL') ||
      rowStr.includes('TOTAL :') ||
      rowStr.includes('END OF REPORT') ||
      rowStr.includes('END OF FILE') ||
      rowStr.startsWith('TOTAL') ||
      rowStr.includes('SUB-TOTAL')
    ) {
      continue;
    }

    const tinVal = colIndex.tin !== -1 ? String(row[colIndex.tin] || '').trim() : '';
    const nameVal = colIndex.name !== -1 ? String(row[colIndex.name] || '').trim() : '';
    const periodVal = colIndex.period !== -1 ? String(row[colIndex.period] || '').trim() : '';
    const atcVal = colIndex.atc !== -1 ? String(row[colIndex.atc] || '').trim().toUpperCase() : 'WC158';
    const natureVal = colIndex.nature !== -1 ? String(row[colIndex.nature] || '').trim() : 'Income Payment / Professional / Services';

    // Focus strictly on Column I (Index 8) for CWT, with fallback to colIndex.cwt
    const cwtCell = row[TARGET_COL_I] !== undefined ? row[TARGET_COL_I] : row[colIndex.cwt];
    const grossCell = colIndex.gross !== -1 ? row[colIndex.gross] : row[6];
    const rateCell = colIndex.rate !== -1 ? row[colIndex.rate] : row[7];

    const grossAmount = extractCleanNumeric(grossCell) ?? parseNumber(grossCell);
    let taxRate = extractCleanNumeric(rateCell) ?? parseNumber(rateCell);
    let cwtAmount = extractCleanNumeric(cwtCell) ?? parseNumber(cwtCell);

    // If rate was entered as decimal (e.g. 0.02 instead of 2), convert to percentage
    if (taxRate > 0 && taxRate <= 0.25) {
      taxRate = taxRate * 100;
    }

    // If CWT is 0 or missing, but gross and rate are present, calculate CWT
    if (cwtAmount === 0 && grossAmount > 0 && taxRate > 0) {
      cwtAmount = Math.round((grossAmount * (taxRate / 100)) * 100) / 100;
    }

    // Must have at least a TIN or Payor Name or positive CWT/Gross
    if (!tinVal && !nameVal && cwtAmount === 0 && grossAmount === 0) {
      continue;
    }

    // Clean format TIN
    const cleanTin = tinVal.replace(/[^0-9]/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{0,5})/, '$1-$2-$3-$4').replace(/-+$/, '');
    const seqVal = colIndex.seq !== -1 && row[colIndex.seq] ? parseInt(String(row[colIndex.seq]), 10) : records.length + 1;

    const record: SawtRecord = {
      id: `sawt_${records.length + 1}_${Date.now()}`,
      seqNo: isNaN(seqVal) ? records.length + 1 : seqVal,
      taxablePeriod: periodVal || undefined,
      payorTin: cleanTin || tinVal || '000-000-000-000',
      payorName: nameVal || 'WITHHOLDING AGENT / PAYOR',
      atcCode: atcVal || 'WC158',
      description: natureVal || 'Withholding Tax at Source (Form 2307)',
      grossAmount: Math.round(grossAmount * 100) / 100,
      taxRate: taxRate || (grossAmount > 0 && cwtAmount > 0 ? Math.round((cwtAmount / grossAmount) * 100) : 2),
      cwtAmount: Math.round(cwtAmount * 100) / 100,
    };

    records.push(record);
    sumLineItemsCwt += record.cwtAmount;
    sumLineItemsGross += record.grossAmount;
    uniquePayors.add(record.payorTin + record.payorName);

    // Quarter allocation
    const periodLower = (record.taxablePeriod || '').toLowerCase();
    if (periodLower.includes('q1') || periodLower.includes('first') || /01|02|03/.test(periodLower)) {
      quarterlyBreakdown.Q1.gross += record.grossAmount;
      quarterlyBreakdown.Q1.cwt += record.cwtAmount;
      quarterlyBreakdown.Q1.count += 1;
    } else if (periodLower.includes('q2') || periodLower.includes('second') || /04|05|06/.test(periodLower)) {
      quarterlyBreakdown.Q2.gross += record.grossAmount;
      quarterlyBreakdown.Q2.cwt += record.cwtAmount;
      quarterlyBreakdown.Q2.count += 1;
    } else if (periodLower.includes('q3') || periodLower.includes('third') || /07|08|09/.test(periodLower)) {
      quarterlyBreakdown.Q3.gross += record.grossAmount;
      quarterlyBreakdown.Q3.cwt += record.cwtAmount;
      quarterlyBreakdown.Q3.count += 1;
    } else if (periodLower.includes('q4') || periodLower.includes('fourth') || /10|11|12/.test(periodLower)) {
      quarterlyBreakdown.Q4.gross += record.grossAmount;
      quarterlyBreakdown.Q4.cwt += record.cwtAmount;
      quarterlyBreakdown.Q4.count += 1;
    } else {
      quarterlyBreakdown.unspecified.gross += record.grossAmount;
      quarterlyBreakdown.unspecified.cwt += record.cwtAmount;
      quarterlyBreakdown.unspecified.count += 1;
    }

    // ATC allocation
    const atc = record.atcCode || 'OTHER';
    if (!atcBreakdown[atc]) {
      atcBreakdown[atc] = {
        description: record.description,
        gross: 0,
        cwt: 0,
        count: 0,
      };
    }
    atcBreakdown[atc].gross += record.grossAmount;
    atcBreakdown[atc].cwt += record.cwtAmount;
    atcBreakdown[atc].count += 1;
  }

  // Determine final Grand Total CWT:
  // Rule 3: The extracted value from intersection of "Grand Total" row and Column I takes absolute precedence.
  // Rule 4: Fallback summary total in Column I before "END OF REPORT".
  // If neither was found, use sum of valid line items.
  const finalTotalCwt =
    extraction.totalCwt !== null
      ? extraction.totalCwt
      : Math.round(sumLineItemsCwt * 100) / 100;

  const finalTotalGross =
    extraction.totalGross !== null
      ? extraction.totalGross
      : Math.round(sumLineItemsGross * 100) / 100;

  // If file was a consolidated summary without individual transactions, create a summary line
  if (records.length === 0) {
    if (finalTotalCwt > 0) {
      records.push({
        id: `sawt_consolidated_${Date.now()}`,
        seqNo: 1,
        taxablePeriod: 'Full Year',
        payorTin: '000-000-000-000',
        payorName: 'CONSOLIDATED BIR FORM 2307 PAYORS',
        atcCode: 'CONSOLIDATED',
        description: 'Creditable Withholding Tax (Extracted from Column I Grand Total)',
        grossAmount: finalTotalGross,
        taxRate: 0,
        cwtAmount: finalTotalCwt,
        transactionCount: 1,
      });
      uniquePayors.add('CONSOLIDATED');
    } else {
      throw new Error('No valid Form 2307 / SAWT records or numeric Grand Total in Column I found in the uploaded file.');
    }
  }

  // Request 1: Summarize into one entry all the Customers with the same TIN number
  const rawRecords = [...records];
  const tinGroups = new Map<string, SawtRecord[]>();

  records.forEach((rec) => {
    // Normalize TIN for grouping key
    const rawDigits = (rec.payorTin || '').replace(/[^0-9]/g, '');
    const key = rawDigits.length >= 9 ? rec.payorTin.trim() : (rec.payorTin.trim() || rec.payorName.trim());
    if (!tinGroups.has(key)) {
      tinGroups.set(key, []);
    }
    tinGroups.get(key)!.push(rec);
  });

  const consolidatedRecords: SawtRecord[] = [];
  let seqCounter = 1;

  tinGroups.forEach((groupRecords, tinKey) => {
    const totalGross = groupRecords.reduce((sum, r) => sum + r.grossAmount, 0);
    const totalCwt = groupRecords.reduce((sum, r) => sum + r.cwtAmount, 0);

    // Pick most descriptive registered name
    const bestName =
      groupRecords
        .map((r) => r.payorName)
        .filter((n) => n && !n.includes('PAYOR') && n !== 'WITHHOLDING AGENT / PAYOR')
        .sort((a, b) => b.length - a.length)[0] ||
      groupRecords[0].payorName;

    // Collect distinct periods (e.g. Q1, Q2)
    const periods = Array.from(
      new Set(groupRecords.map((r) => r.taxablePeriod).filter(Boolean))
    ).join(', ');

    // Collect distinct ATCs
    const atcs = Array.from(new Set(groupRecords.map((r) => r.atcCode).filter(Boolean))).join(', ');

    // Collect distinct descriptions
    const descriptions = Array.from(new Set(groupRecords.map((r) => r.description).filter(Boolean))).join('; ');

    // Calculate effective average rate
    const effRate =
      totalGross > 0
        ? Math.round((totalCwt / totalGross) * 10000) / 100
        : (groupRecords[0].taxRate || 2);

    consolidatedRecords.push({
      id: `sawt_tin_${seqCounter}_${Date.now()}`,
      seqNo: seqCounter++,
      taxablePeriod: periods || 'Full Year',
      payorTin: groupRecords[0].payorTin || tinKey,
      payorName: bestName,
      atcCode: atcs || 'WC158',
      description:
        groupRecords.length > 1
          ? `Consolidated (${groupRecords.length} Form 2307s) • ${descriptions}`
          : descriptions,
      grossAmount: Math.round(totalGross * 100) / 100,
      taxRate: effRate,
      cwtAmount: Math.round(totalCwt * 100) / 100,
      transactionCount: groupRecords.length,
      rawTransactions: groupRecords,
    });
  });

  return {
    fileName,
    uploadDate: new Date().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    totalCwtAmount: finalTotalCwt,
    totalGrossAmount: finalTotalGross,
    totalRecords: rawRecords.length,
    uniquePayorsCount: consolidatedRecords.length,
    records: consolidatedRecords,
    rawRecords,
    quarterlyBreakdown,
    atcBreakdown,
    extractionMethod: extraction.method,
    extractionDetails: extraction.details,
    grandTotalRowIndex: extraction.grandTotalRowIndex,
    dataStartRow: startRowIndex + 1,
  };
}


/**
 * Generates and triggers download of an official-looking BIR SAWT Excel template (.xlsx)
 * with headers and 3 sample Form 2307 creditable tax withholding lines.
 */
export async function downloadSawtExcelTemplate(client: ClientProfile, year: number): Promise<void> {
  const cleanClient = (client.registeredName || 'TAXPAYER').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `BIR_SAWT_Form2307_${cleanClient}_TY${year}.xlsx`;

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'BIR Tax Return Calculator - SAWT Module';
    wb.created = new Date();

    const ws = wb.addWorksheet('SAWT Form 2307', {
      views: [{ showGridLines: true }],
    });

    // Title Section
    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'BUREAU OF INTERNAL REVENUE - SUMMARY ALPHANUMERIC TAX TABLE (SAWT)';
    titleCell.font = { bold: true, size: 13, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 24;

    ws.mergeCells('A2:I2');
    const subCell = ws.getCell('A2');
    subCell.value = `SCHEDULE OF CREDITABLE TAX WITHHELD AT SOURCE (BIR FORM 2307) - TAXABLE YEAR ${year}`;
    subCell.font = { bold: true, size: 10, color: { argb: 'FF475569' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    // Taxpayer Info
    ws.getCell('A4').value = 'PAYEE / TAXPAYER TIN:';
    ws.getCell('A4').font = { bold: true, size: 10 };
    ws.getCell('B4').value = client.tin;
    ws.getCell('B4').font = { bold: true, size: 10 };

    ws.getCell('A5').value = 'PAYEE REGISTERED NAME:';
    ws.getCell('A5').font = { bold: true, size: 10 };
    ws.getCell('B5').value = client.registeredName;
    ws.getCell('B5').font = { bold: true, size: 10 };

    ws.getCell('A6').value = 'TAX YEAR / PERIOD:';
    ws.getCell('A6').font = { bold: true, size: 10 };
    ws.getCell('B6').value = `Full Year ${year} (Q1 - Q4)`;
    ws.getCell('B6').font = { bold: true, size: 10 };

    // Instruction Box
    ws.mergeCells('A8:I8');
    const noteCell = ws.getCell('A8');
    noteCell.value =
      'Instructions: Enter each Certificate of Creditable Tax Withheld at Source (BIR Form 2307) received from customers/payors. Sum of Amount of Tax Withheld will populate Form 2307 CWT (Full Year).';
    noteCell.font = { italic: true, size: 9, color: { argb: 'FF334155' } };
    noteCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    // Schedule & Format Notes
    ws.getCell('A10').value = 'BIR FORM 1702-RT / 1702-EX / 1701 - CREDITABLE TAX WITHHELD (SCHEDULE 9 / FORM 2307)';
    ws.getCell('A10').font = { bold: true, size: 9, color: { argb: 'FF1E3A8A' } };

    ws.mergeCells('A12:I12');
    const rowNoteCell = ws.getCell('A12');
    rowNoteCell.value = 'DATA SPECIFICATION: Table headers are on Row 15. Form 2307 transaction data capture begins on Row 16 below. Amount of Tax Withheld is in Column I.';
    rowNoteCell.font = { bold: true, size: 9, color: { argb: 'FF0F766E' } };

    // Column Indicators (Row 14)
    const colIndicators = ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)'];
    const indRow = ws.getRow(14);
    indRow.values = colIndicators;
    indRow.height = 18;
    indRow.eachCell((cell) => {
      cell.font = { bold: true, size: 9, color: { argb: 'FF64748B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Table Headers (Row 15)
    // Column I (Index 8 / 9th column) is strictly "AMOUNT OF TAX WITHHELD"
    const headers = [
      'SEQ NO',
      'TAX PERIOD / QUARTER',
      'TAXPAYER IDENTIFICATION NUMBER (TIN)',
      'REGISTERED NAME OF WITHHOLDING AGENT / PAYOR',
      'ATC CODE',
      'NATURE OF INCOME PAYMENT / DESCRIPTION',
      'AMOUNT OF INCOME PAYMENT (GROSS TAX BASE)',
      'TAX RATE (%)',
      'AMOUNT OF TAX WITHHELD',
    ];

    const headerRow = ws.getRow(15);
    headerRow.values = headers;
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }, // Dark Navy Blue
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Sample Data Rows (Row 16 to 19 - Transaction data capture begins on Row 16)
    const sampleRows = [
      [
        1,
        'Q1',
        '102-345-678-000',
        'ACME COMMERCIAL CORP.',
        'WC158',
        'Professional & Management Consultancy Services',
        150000,
        2,
        3000,
      ],
      [
        2,
        'Q2',
        '204-567-890-000',
        'METRO LEASING & REALTY INC.',
        'WC100',
        'Rental of Real Property / Office Space',
        200000,
        5,
        10000,
      ],
      [
        3,
        'Q3',
        '305-678-901-000',
        'GLOBAL TRADING ENTERPRISES',
        'WC160',
        'Sale of Goods to Government / Top Withholding Agents',
        500000,
        1,
        5000,
      ],
      [
        4,
        'Q4',
        '406-789-012-000',
        'PACIFIC HEALTHCARE SYSTEMS',
        'WC158',
        'Consultancy & Technical Services',
        300000,
        2,
        6000,
      ],
    ];

    sampleRows.forEach((rowValues, index) => {
      const r = ws.getRow(16 + index);
      r.values = rowValues;
      r.height = 20;

      r.getCell(1).alignment = { horizontal: 'center' };
      r.getCell(2).alignment = { horizontal: 'center' };
      r.getCell(3).alignment = { horizontal: 'center' };
      r.getCell(4).alignment = { horizontal: 'left' };
      r.getCell(5).alignment = { horizontal: 'center' };
      r.getCell(6).alignment = { horizontal: 'left' };
      r.getCell(7).numFmt = '#,##0.00';
      r.getCell(7).alignment = { horizontal: 'right' };
      r.getCell(8).numFmt = '0.00"%"';
      r.getCell(8).alignment = { horizontal: 'right' };
      r.getCell(9).numFmt = '#,##0.00';
      r.getCell(9).alignment = { horizontal: 'right' };

      r.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    // Total Row (matches Rule 2 & Rule 3: Column A contains 'Grand Total :', Column I contains Amount of Tax Withheld)
    const totalRowNum = 16 + sampleRows.length; // Row 20
    const totalRow = ws.getRow(totalRowNum);
    totalRow.height = 24;
    ws.mergeCells(`A${totalRowNum}:F${totalRowNum}`);
    const totLabel = ws.getCell(`A${totalRowNum}`);
    totLabel.value = 'Grand Total :';
    totLabel.font = { bold: true, size: 10 };
    totLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totGrossCell = ws.getCell(`G${totalRowNum}`);
    totGrossCell.value = { formula: `SUM(G16:G${totalRowNum - 1})`, date1904: false };
    totGrossCell.numFmt = '#,##0.00';
    totGrossCell.font = { bold: true, size: 10 };
    totGrossCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const totCwtCell = ws.getCell(`I${totalRowNum}`);
    totCwtCell.value = { formula: `SUM(I16:I${totalRowNum - 1})`, date1904: false };
    totCwtCell.numFmt = '#,##0.00';
    totCwtCell.font = { bold: true, size: 10, color: { argb: 'FF047857' } }; // Emerald
    totCwtCell.alignment = { horizontal: 'right', vertical: 'middle' };

    totalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      };
    });

    // Formatting border and End of Report (Rule 4 fallback testing)
    const borderRowNum = totalRowNum + 1;
    const borderRow = ws.getRow(borderRowNum);
    ws.mergeCells(`A${borderRowNum}:I${borderRowNum}`);
    const borderCell = ws.getCell(`A${borderRowNum}`);
    borderCell.value = '================================================================================';
    borderCell.font = { size: 9, color: { argb: 'FF94A3B8' } };
    borderCell.alignment = { horizontal: 'center' };

    const endRowNum = borderRowNum + 1;
    const endRow = ws.getRow(endRowNum);
    ws.mergeCells(`A${endRowNum}:I${endRowNum}`);
    const endCell = ws.getCell(`A${endRowNum}`);
    endCell.value = '*** END OF REPORT ***';
    endCell.font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
    endCell.alignment = { horizontal: 'center' };

    // Column widths
    ws.columns = [
      { key: 'A', width: 10 }, // Seq
      { key: 'B', width: 16 }, // Period
      { key: 'C', width: 22 }, // TIN
      { key: 'D', width: 34 }, // Payor Name
      { key: 'E', width: 14 }, // ATC
      { key: 'F', width: 32 }, // Nature
      { key: 'G', width: 22 }, // Gross
      { key: 'H', width: 14 }, // Rate
      { key: 'I', width: 24 }, // CWT
    ];

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
  } catch (err) {
    console.error('Error generating SAWT Excel template:', err);
    throw err;
  }
}
