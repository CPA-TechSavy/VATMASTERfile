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
}: {
  type: 'Sales' | 'Purchases';
  quarter: Quarter;
  monthLabel: '1st Month' | '2nd Month' | '3rd Month' | 'Consolidated';
  client: ClientProfile;
  branchName?: string;
  includeSampleRow?: boolean;
}) {
  const isPurchases = type === 'Purchases';
  const companyName = (client.registeredName || client.tradeName || 'Taxpayer').trim();
  const cleanClient = companyName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const cleanBranch = branchName ? `_${branchName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}` : '';
  const fileName = `BIR_${type}_${quarter}_${monthLabel.replace(/\s+/g, '_')}_${cleanClient}${cleanBranch}.xlsx`;
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

    ws.getCell('A6').value = `TIN: ${client.tin}`;
    ws.getCell('A6').font = { bold: true, size: 11, name: 'Calibri' };

    ws.getCell('A7').value = `OWNER'S NAME: ${client.registeredName || client.tradeName}`;
    ws.getCell('A7').font = { bold: true, size: 11, name: 'Calibri' };

    ws.getCell('A8').value = `OWNER'S TRADE NAME: ${client.tradeName || client.registeredName}`;
    ws.getCell('A8').font = { bold: true, size: 11, name: 'Calibri' };

    // 2. Column Headers
    // A11:A12 through M11:M12: Merge cell, wrap text, align center
    // B11:B12: transferred from B11:B13 to B11:B12
    // Bold the entire row of 11 and 12
    const headers: { col: string; text: string }[] = [
      { col: 'A', text: 'TAXABLE MONTH' },
      { col: 'B', text: 'TAXPAYER IDENTIFICATION NUMBER' },
      { col: 'C', text: 'REGISTERED NAME' },
      { col: 'D', text: isPurchases ? "SUPPLIER'S ADDRESS" : "CUSTOMER'S ADDRESS" },
      { col: 'E', text: isPurchases ? 'AMOUNT OF GROSS PURCHASE' : 'AMOUNT OF GROSS SALES' },
      { col: 'F', text: isPurchases ? 'AMOUNT OF EXEMPT PURCHASE' : 'AMOUNT OF EXEMPT SALES' },
      { col: 'G', text: isPurchases ? 'AMOUNT OF ZERO-RATED PURCHASE' : 'AMOUNT OF ZERO-RATED SALES' },
      { col: 'H', text: isPurchases ? 'AMOUNT OF TAXABLE PURCHASE' : 'AMOUNT OF TAXABLE SALES' },
      { col: 'I', text: isPurchases ? 'AMOUNT OF PURCHASE OF SERVICES' : 'AMOUNT OF SALE OF SERVICES' },
      { col: 'J', text: isPurchases ? 'AMOUNT OF PURCHASE OF CAPITAL GOODS' : 'AMOUNT OF SALE OF CAPITAL GOODS' },
      { col: 'K', text: isPurchases ? 'AMOUNT OF PURCHASE OF GOODS OTHER THAN CAPITAL GOODS' : 'AMOUNT OF SALE OF GOODS OTHER THAN CAPITAL GOODS' },
      { col: 'L', text: isPurchases ? 'AMOUNT OF INPUT TAX' : 'AMOUNT OF OUTPUT TAX' },
      { col: 'M', text: isPurchases ? 'AMOUNT OF GROSS TAXABLE PURCHASE' : 'AMOUNT OF GROSS TAXABLE SALES' },
    ];

    // Set row height and bold entire row 11 and 12
    const row11 = ws.getRow(11);
    const row12 = ws.getRow(12);
    row11.height = 28;
    row12.height = 28;
    row11.font = { bold: true, size: 10, name: 'Calibri' };
    row12.font = { bold: true, size: 10, name: 'Calibri' };

    headers.forEach(({ col, text }) => {
      // Merge cell range: e.g., A11:A12, B11:B12, C11:C12, ... M11:M12
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
    const identifiers = ['(1)', '(2)', '(3)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)', '(14)'];
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

    // Cells E1999:M1999 – Grand total sum fields
    const numCols = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
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
    ws.columns = [
      { key: 'A', width: 18 }, // A: TAXABLE MONTH
      { key: 'B', width: 26 }, // B: TIN
      { key: 'C', width: 34 }, // C: REGISTERED NAME
      { key: 'D', width: 38 }, // D: ADDRESS
      { key: 'E', width: 22 }, // E: GROSS
      { key: 'F', width: 20 }, // F: EXEMPT
      { key: 'G', width: 20 }, // G: ZERO-RATED
      { key: 'H', width: 22 }, // H: TAXABLE
      { key: 'I', width: 22 }, // I: SERVICES
      { key: 'J', width: 22 }, // J: CAPITAL GOODS
      { key: 'K', width: 26 }, // K: GOODS OTHER THAN CAPITAL
      { key: 'L', width: 20 }, // L: TAX
      { key: 'M', width: 24 }, // M: GROSS TAXABLE
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
    setCell(5, 0, `TIN: ${client.tin}`);
    setCell(6, 0, `OWNER'S NAME: ${client.registeredName || client.tradeName}`);
    setCell(7, 0, `OWNER'S TRADE NAME: ${client.tradeName || client.registeredName}`);

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
      isPurchases ? 'AMOUNT OF INPUT TAX' : 'AMOUNT OF OUTPUT TAX',
      isPurchases ? 'AMOUNT OF GROSS TAXABLE PURCHASE' : 'AMOUNT OF GROSS TAXABLE SALES',
    ];

    headerTexts.forEach((text, c) => {
      setCell(10, c, text);
      setCell(11, c, text);
    });

    const identifiers = ['(1)', '(2)', '(3)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)', '(14)'];
    identifiers.forEach((id, c) => setCell(13, c, id));

    if (includeSampleRow) {
      // Intentionally kept clean without pre-existing sample rows per user requirement
    }

    setCell(1998, 0, 'Grand Total :');
    ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].forEach((letter, i) => {
      setCell(1998, 4 + i, 0, `SUM(${letter}15:${letter}1998)`);
    });
    setCell(2000, 0, 'END OF REPORT');

    ws['!ref'] = 'A1:M2001';
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
      { s: { r: 10, c: 11 }, e: { r: 11, c: 11 } }, // L11:L12
      { s: { r: 10, c: 12 }, e: { r: 11, c: 12 } }, // M11:M12
    ];

    ws['!cols'] = [
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
 * Parses uploaded BIR SLSP / VAT Relief Excel or CSV file according to specification:
 * - Reads header A1, A6, A7, A8
 * - Reads transaction rows 15-1998
 * - Reads Grand Total row 1999
 * - Falls back cleanly to header-detection if a custom or non-standard format is uploaded
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

  // 1. Scan rows 15 through 1998 for transaction rows
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

    const gross = parseCellNumber(cellE?.v);
    const exempt = parseCellNumber(cellF?.v);
    const zeroRated = parseCellNumber(cellG?.v);
    const taxable = parseCellNumber(cellH?.v);
    const services = parseCellNumber(cellI?.v);
    const capital = parseCellNumber(cellJ?.v);
    const goodsOther = parseCellNumber(cellK?.v);
    const tax = parseCellNumber(cellL?.v);
    const grossTaxable = parseCellNumber(cellM?.v);

    const tinVal = cellB ? String(cellB.v || '').trim() : '';
    const nameVal = cellC ? String(cellC.v || '').trim() : '';

    // Check if row has substantive data
    if (
      tinVal ||
      nameVal ||
      gross > 0 ||
      taxable > 0 ||
      tax > 0 ||
      exempt > 0 ||
      zeroRated > 0
    ) {
      // Avoid header repeats or summary strings
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
        taxableMonth: cellA ? String(cellA.v || '').trim() : '',
        tin: tinVal,
        registeredName: nameVal,
        address: cellD ? String(cellD.v || '').trim() : '',
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

  // 2. Read Grand Total from Row 1999 (r: 1998) or calculate from transactions
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

  // Check Row 1999 directly
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
  } else if (transactions.length === 0) {
      // Fallback: Check if user uploaded a generic table (starting from row 1)
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      for (const row of rawRows) {
        const entries = Object.entries(row);
        let gross = 0;
        let taxable = 0;
        let exempt = 0;
        let zero = 0;
        let tax = 0;
        let goods = 0;
        let services = 0;
        let capital = 0;

        for (const [key, val] of entries) {
          const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (k.includes('gross')) gross = parseCellNumber(val);
          else if (k.includes('taxable') && !k.includes('gross')) taxable = parseCellNumber(val);
          else if (k.includes('exempt')) exempt = parseCellNumber(val);
          else if (k.includes('zero')) zero = parseCellNumber(val);
          else if (k.includes('inputtax') || k.includes('outputtax') || k.includes('taxamount') || k === 'tax') tax = parseCellNumber(val);
          else if (k.includes('goods') && !k.includes('capital')) goods = parseCellNumber(val);
          else if (k.includes('service')) services = parseCellNumber(val);
          else if (k.includes('capital')) capital = parseCellNumber(val);
          else if (k.includes('sales') && taxable === 0) taxable = parseCellNumber(val);
          else if (k.includes('purchase') && taxable === 0) taxable = parseCellNumber(val);
        }

        if (gross > 0 || taxable > 0 || tax > 0 || exempt > 0) {
          totals.grossAmount += gross || taxable;
          totals.taxableAmount += taxable;
          totals.exemptAmount += exempt;
          totals.zeroRatedAmount += zero;
          totals.taxAmount += tax || taxable * 0.12;
          totals.goodsOtherThanCapitalAmount += goods;
          totals.servicesAmount += services;
          totals.capitalGoodsAmount += capital;
          totals.grossTaxableAmount += taxable + (tax || taxable * 0.12);
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
