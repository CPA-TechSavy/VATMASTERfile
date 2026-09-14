import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ClientProfile, Quarter, Data2550Q, Data1702Annual, Data1701Annual } from '../types/tax';
import { ClientBranchSchedule, PurchasesReportingMode, BirUploadedFileRecord, BirTransactionRow } from '../types/branchVat';
import { calculate2550Q, Result2550Q, computeMonthlyQuarterBreakdown, computeGraduatedTax } from './taxCalculations';
import { DeferredClientRecord, QuarterlyDeferralDetail } from './deferralTracker';

interface PdfExportOptions {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  branches?: ClientBranchSchedule[];
  purchasesMode?: PurchasesReportingMode;
  consolidatedPurchasesFile?: BirUploadedFileRecord | null;
  aggregatedTotals?: {
    salesColF: number;
    salesColG: number;
    salesColH: number;
    salesColL: number;
    purchasesColF: number;
    purchasesColG: number;
    purchasesColH: number;
    purchasesColL: number;
  };
  branchRows?: Array<{
    name: string;
    salesColF: number;
    salesColG: number;
    salesColH: number;
    salesColL: number;
    purchasesColF: number;
    purchasesColG: number;
    purchasesColH: number;
    purchasesColL: number;
    netVat: number;
  }>;
  data2550Q?: Data2550Q;
  result2550Q?: Result2550Q;
  isAdjustedMode?: boolean;
}

// Format numbers with strict ₱ symbol, tabular formatting and 2 decimal places
function formatPdfCurrency(amount: number | undefined | null, showZeroDash = false): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return showZeroDash ? '—' : '₱ 0.00';
  }
  if (showZeroDash && Math.abs(amount) < 0.001) {
    return '—';
  }
  const formatted = Math.abs(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (amount < 0) {
    return `(₱ ${formatted})`;
  }
  return `₱ ${formatted}`;
}

export async function exportMultiBranchAnd2550QPdf({
  client,
  quarter,
  year,
  branches: incomingBranches,
  purchasesMode: incomingPurchasesMode,
  consolidatedPurchasesFile: incomingConsolidatedPurchasesFile,
  aggregatedTotals: incomingAggregatedTotals,
  branchRows: incomingBranchRows,
  data2550Q,
  result2550Q,
  isAdjustedMode,
}: PdfExportOptions): Promise<void> {
  // Load saved branch schedule from localStorage if not directly passed
  let branches = incomingBranches;
  let purchasesMode = incomingPurchasesMode || 'consolidated';
  let consolidatedPurchasesFile = incomingConsolidatedPurchasesFile;
  if (!branches || branches.length === 0) {
    try {
      const storageKey = `bir_branch_schedule_${client.id}_${year}_${quarter}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.branches && parsed.branches.length > 0) {
          branches = parsed.branches;
        }
        if (parsed.purchasesMode) {
          purchasesMode = parsed.purchasesMode;
        }
        if (!consolidatedPurchasesFile && parsed.consolidatedPurchasesFile) {
          consolidatedPurchasesFile = parsed.consolidatedPurchasesFile;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!branches || branches.length === 0) {
    branches = [
      {
        id: 'branch-main',
        name: `${client.tradeName} (Main Branch)`,
        salesFiles: {},
        purchasesFiles: {},
      },
    ];
  }

  // Fallback / default 2550Q data if not directly provided
  let effective2550QData = data2550Q;
  if (!effective2550QData) {
    try {
      const savedMap = localStorage.getItem('bir_calc_data_2550Q');
      if (savedMap) {
        const parsed = JSON.parse(savedMap);
        if (parsed[client.id]) {
          effective2550QData = parsed[client.id];
        }
      }
    } catch {
      // ignore
    }
  }

  // Calculate or fallback aggregated totals
  let aggregatedTotals = incomingAggregatedTotals;
  if (!aggregatedTotals) {
    let salesColF = 0;
    let salesColG = 0;
    let salesColH = 0;
    let salesColL = 0;
    let purchasesColF = 0;
    let purchasesColG = 0;
    let purchasesColH = 0;
    let purchasesColL = 0;

    branches.forEach((b) => {
      [b.salesFiles.month1, b.salesFiles.month2, b.salesFiles.month3].forEach((f) => {
        if (f) {
          salesColF += f.totals.exemptAmount || 0;
          salesColG += f.totals.zeroRatedAmount || 0;
          salesColH += f.totals.taxableAmount || 0;
          salesColL += f.totals.taxAmount || 0;
        }
      });
      if (purchasesMode === 'per-branch' && b.purchasesFiles) {
        [b.purchasesFiles.month1, b.purchasesFiles.month2, b.purchasesFiles.month3].forEach((f) => {
          if (f) {
            purchasesColF += f.totals.exemptAmount || 0;
            purchasesColG += f.totals.zeroRatedAmount || 0;
            purchasesColH += f.totals.taxableAmount || 0;
            purchasesColL += f.totals.taxAmount || 0;
          }
        });
      }
    });

    if (purchasesMode === 'consolidated' && consolidatedPurchasesFile?.totals) {
      purchasesColF = consolidatedPurchasesFile.totals.exemptAmount || 0;
      purchasesColG = consolidatedPurchasesFile.totals.zeroRatedAmount || 0;
      purchasesColH = consolidatedPurchasesFile.totals.taxableAmount || 0;
      purchasesColL = consolidatedPurchasesFile.totals.taxAmount || 0;
    }

    // If branches didn't have totals but 2550Q data is present, align them
    if (salesColH === 0 && effective2550QData) {
      salesColF = effective2550QData.vatExemptSales || 0;
      salesColG = effective2550QData.zeroRatedSales || 0;
      salesColH = effective2550QData.vatableSales || 0;
      salesColL = salesColH * 0.12;
      purchasesColH = effective2550QData.inputPurchasesGoods || 0;
      purchasesColL = purchasesColH * 0.12;
    }

    aggregatedTotals = {
      salesColF,
      salesColG,
      salesColH,
      salesColL,
      purchasesColF,
      purchasesColG,
      purchasesColH,
      purchasesColL,
    };
  }

  // If still not available, populate from aggregatedTotals
  if (!effective2550QData) {
    effective2550QData = {
      vatableSales: aggregatedTotals.salesColH,
      salesToGovernment: 0,
      zeroRatedSales: aggregatedTotals.salesColG,
      vatExemptSales: aggregatedTotals.salesColF,
      inputPurchasesGoods: aggregatedTotals.purchasesColH,
      inputPurchasesServices: 0,
      inputCapitalGoods: 0,
      inputImportations: 0,
      priorQuarterExcessInputVat: 0,
      withheldVat2307Govt: 0,
      withheldVat2307Private: 0,
      priorPaymentsThisQuarter: 0,
    };
  }

  const effectiveResult = result2550Q || calculate2550Q(effective2550QData);

  // Statutory deadline
  let statutoryDueDate = '';
  if (client.taxableYearType === 'fiscal' && client.fiscalYearEndMonth && client.fiscalYearEndMonth !== 12) {
    const endMonth = client.fiscalYearEndMonth;
    const q1End = ((endMonth - 1 + 3) % 12) + 1;
    const q2End = ((endMonth - 1 + 6) % 12) + 1;
    const q3End = ((endMonth - 1 + 9) % 12) + 1;
    const qEnds: Record<Quarter, number> = { Q1: q1End, Q2: q2End, Q3: q3End, Q4: endMonth };
    const qDueMonth = (qEnds[quarter] % 12) + 1;
    const mNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    statutoryDueDate = `${mNames[qDueMonth - 1]} 25, ${year}`;
  } else {
    const quarterDueDates: Record<Quarter, string> = {
      Q1: `April 25, ${year}`,
      Q2: `July 25, ${year}`,
      Q3: `October 25, ${year}`,
      Q4: `January 25, ${year + 1}`,
    };
    statutoryDueDate = quarterDueDates[quarter];
  }
  const generatedTimestamp = new Date().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Create an off-screen container for crisp rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.color = '#0f172a';
  container.style.boxSizing = 'border-box';

  // Branch rows (either passed as adjusted rows or computed directly from branches)
  const branchRows = incomingBranchRows && incomingBranchRows.length > 0
    ? incomingBranchRows
    : branches.map((b) => {
        let salesColF = 0;
        let salesColG = 0;
        let salesColH = 0;
        let salesColL = 0;
        [b.salesFiles?.month1, b.salesFiles?.month2, b.salesFiles?.month3].forEach((f) => {
          if (f) {
            salesColF += f.totals?.exemptAmount || 0;
            salesColG += f.totals?.zeroRatedAmount || 0;
            salesColH += f.totals?.taxableAmount || 0;
            salesColL += f.totals?.taxAmount || 0;
          }
        });

        let purchasesColF = 0;
        let purchasesColG = 0;
        let purchasesColH = 0;
        let purchasesColL = 0;
        if (purchasesMode === 'per-branch' && b.purchasesFiles) {
          [b.purchasesFiles?.month1, b.purchasesFiles?.month2, b.purchasesFiles?.month3].forEach((f) => {
            if (f) {
              purchasesColF += f.totals?.exemptAmount || 0;
              purchasesColG += f.totals?.zeroRatedAmount || 0;
              purchasesColH += f.totals?.taxableAmount || 0;
              purchasesColL += f.totals?.taxAmount || 0;
            }
          });
        }

        const netVat = purchasesMode === 'per-branch' ? salesColL - purchasesColL : salesColL;
        return {
          name: b.name,
          salesColF,
          salesColG,
          salesColH,
          salesColL,
          purchasesColF,
          purchasesColG,
          purchasesColH,
          purchasesColL,
          netVat,
        };
      });

  // Calculate monthly breakdown across all branches (consolidating Taxable, Exempt, Zero-Rated Sales & Purchases, Output and Input Tax)
  const { monthlyBreakdown, quarterTotals } = computeMonthlyQuarterBreakdown({
    quarter,
    branches,
    purchasesMode,
    consolidatedPurchasesFile,
  });

  // Build HTML for Page 1 and Page 2
  container.innerHTML = `
    <!-- PAGE 1: VAT TABLE -->
    <div id="pdf-page-1" style="width: 1120px; min-height: 792px; padding: 28px 36px; background-color: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Official BIR Header -->
        <div style="border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569;">
              Bureau of Internal Revenue
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px; letter-spacing: -0.01em;">
              ${client.registeredName || client.tradeName || 'Taxpayer'}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
              Quarterly VAT Multi-Branch Aggregation Schedule • Pursuant to RR No. 16-2005 as amended & RA 11976 (eOPT Act)
            </div>
          </div>
          <div style="text-align: right; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Tax Period</div>
            <div style="font-size: 15px; font-weight: 800; color: #1e1b4b; margin-top: 1px;">${quarter} ${year}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Due: ${statutoryDueDate}</div>
          </div>
        </div>

        <!-- Taxpayer Profile Grid (Only TIN and Form Type) -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px;">
          <div>
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Taxpayer Identification No. (TIN)</div>
            <div style="font-weight: 700; font-family: monospace; color: #0f172a; font-size: 12.5px; margin-top: 1px;">${client.tin}</div>
            <div style="font-size: 10px; color: #475569; margin-top: 1px;">RDO: ${client.rdo} • Classification: ${client.classification}</div>
          </div>
          <div>
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Form Type</div>
            <div style="font-weight: 700; color: #4338ca; font-size: 11.5px; margin-top: 1px;">BIR Form 2550Q (VAT)</div>
            <div style="font-size: 10px; color: #059669; margin-top: 1px;">Status: Validated (${client.vatStatus === 'vat-registered' ? 'VAT Registered' : 'Non-VAT'})</div>
          </div>
        </div>

        <!-- Section 1 Title -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b;">
            1. VAT TABLE (${quarter} ${year} Consolidated)
          </div>
          <div style="font-size: 10px; color: #64748b; font-style: italic;">
            Amounts in Philippine Peso (PHP) • Strictly orthogonal alignment
          </div>
        </div>

        <!-- Multi-Branch Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px;">
          <thead>
            <tr style="border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8;">
              <th rowspan="2" style="padding: 7px 8px; text-align: left; background-color: #f1f5f9; color: #1e293b; font-weight: 700; border-right: 1px solid #cbd5e1; width: 18%;">
                Branch / Line of Business
              </th>
              <th colspan="4" style="padding: 5px 8px; text-align: center; background-color: #ede9fe; color: #3b0764; font-weight: 700; border-right: 1px solid #cbd5e1;">
                SALES & RECEIPTS (OUTPUT TAX)
              </th>
              <th colspan="4" style="padding: 5px 8px; text-align: center; background-color: #fef3c7; color: #78350f; font-weight: 700; border-right: 1px solid #cbd5e1;">
                PURCHASES & INPUT TAX
              </th>
              <th rowspan="2" style="padding: 7px 8px; text-align: right; background-color: #f1f5f9; color: #1e293b; font-weight: 700; width: 12%;">
                Net VAT Due / (Credit)
              </th>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #94a3b8; font-size: 9px;">
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0; width: 8.5%;">Exempt</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0; width: 8.5%;">Zero-Rated</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #1e293b; border-right: 1px solid #e2e8f0; width: 9%;">Taxable (12%)</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 700; color: #5b21b6; background-color: #f3e8ff; border-right: 1px solid #cbd5e1; width: 9%;">Output VAT</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0; width: 8.5%;">Exempt</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0; width: 8.5%;">Zero-Rated</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 600; color: #1e293b; border-right: 1px solid #e2e8f0; width: 9%;">Taxable (12%)</th>
              <th style="padding: 4px 6px; text-align: right; font-weight: 700; color: #92400e; background-color: #fef9c3; border-right: 1px solid #cbd5e1; width: 9%;">Input VAT</th>
            </tr>
          </thead>
          <tbody>
            ${(branchRows && branchRows.length > 0
              ? branchRows.map((b, idx) => {
                  const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                  return `
                    <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 5px 8px; font-weight: 600; color: #0f172a; border-right: 1px solid #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${b.name}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${formatPdfCurrency(b.salesColF, true)}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${formatPdfCurrency(b.salesColG, true)}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${formatPdfCurrency(b.salesColH)}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #5b21b6; background-color: #faf5ff; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                        ${formatPdfCurrency(b.salesColL)}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${purchasesMode === 'per-branch' ? formatPdfCurrency(b.purchasesColF, true) : '—'}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${purchasesMode === 'per-branch' ? formatPdfCurrency(b.purchasesColG, true) : '—'}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                        ${purchasesMode === 'per-branch' ? formatPdfCurrency(b.purchasesColH) : '—'}
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #92400e; background-color: #fffbeb; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                        ${purchasesMode === 'per-branch' ? formatPdfCurrency(b.purchasesColL) : '—'}
                      </td>
                      <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${b.netVat >= 0 ? '#0f172a' : '#0369a1'}; white-space: nowrap;">
                        ${formatPdfCurrency(b.netVat)}
                      </td>
                    </tr>
                  `;
                })
              : branches
                  .map((b, idx) => {
                    const sFiles = [b.salesFiles.month1, b.salesFiles.month2, b.salesFiles.month3].filter(Boolean);
                    const bSalesF = sFiles.reduce((acc, f) => acc + (f?.totals.exemptAmount || 0), 0);
                    const bSalesG = sFiles.reduce((acc, f) => acc + (f?.totals.zeroRatedAmount || 0), 0);
                    const bSalesH = sFiles.reduce((acc, f) => acc + (f?.totals.taxableAmount || 0), 0);
                    const bSalesL = sFiles.reduce((acc, f) => acc + (f?.totals.taxAmount || 0), 0);

                    const pFiles =
                      purchasesMode === 'per-branch'
                        ? [b.purchasesFiles?.month1, b.purchasesFiles?.month2, b.purchasesFiles?.month3].filter(Boolean)
                        : [];
                    const bPurchF = pFiles.reduce((acc, f) => acc + (f?.totals.exemptAmount || 0), 0);
                    const bPurchG = pFiles.reduce((acc, f) => acc + (f?.totals.zeroRatedAmount || 0), 0);
                    const bPurchH = pFiles.reduce((acc, f) => acc + (f?.totals.taxableAmount || 0), 0);
                    const bPurchL = pFiles.reduce((acc, f) => acc + (f?.totals.taxAmount || 0), 0);

                    const bNetVat = bSalesL - bPurchL;
                    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

                    return `
                      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 5px 8px; font-weight: 600; color: #0f172a; border-right: 1px solid #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${b.name}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${formatPdfCurrency(bSalesF, true)}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${formatPdfCurrency(bSalesG, true)}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${formatPdfCurrency(bSalesH)}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #5b21b6; background-color: #faf5ff; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                          ${formatPdfCurrency(bSalesL)}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bPurchF, true) : '—'}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bPurchG, true) : '—'}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bPurchH) : '—'}
                        </td>
                        <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #92400e; background-color: #fffbeb; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bPurchL) : '—'}
                        </td>
                        <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${bNetVat >= 0 ? '#0f172a' : '#0369a1'}; white-space: nowrap;">
                          ${purchasesMode === 'per-branch' ? formatPdfCurrency(bNetVat) : formatPdfCurrency(bSalesL)}
                        </td>
                      </tr>
                    `;
                  })
            ).join('')}

            ${
              purchasesMode === 'consolidated'
                ? `
              <tr style="background-color: #fffbeb; border-bottom: 1px solid #fde68a;">
                <td style="padding: 5px 8px; font-weight: 600; color: #78350f; font-style: italic; border-right: 1px solid #cbd5e1;">
                  Consolidated Purchases
                </td>
                <td style="padding: 5px 6px; text-align: right; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 5px 6px; text-align: right; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 5px 6px; text-align: right; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 5px 6px; text-align: right; color: #94a3b8; border-right: 1px solid #cbd5e1;">—</td>
                <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColF, true)}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-family: monospace; color: #475569; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColG, true)}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; white-space: nowrap;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColH)}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #92400e; background-color: #fef08a; border-right: 1px solid #cbd5e1; white-space: nowrap;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColL)}
                </td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #b45309; white-space: nowrap;">
                  (${formatPdfCurrency(aggregatedTotals.purchasesColL)})
                </td>
              </tr>
            `
                : ''
            }

            <!-- Grand Totals Row -->
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: 700; border-top: 2px solid #0f172a; font-size: 10px;">
              <td style="padding: 7px 8px; text-transform: uppercase; letter-spacing: 0.05em; border-right: 1px solid #334155; white-space: nowrap;">
                Grand Total (${quarter} ${year})
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #cbd5e1; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #cbd5e1; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #ffffff; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #c4b5fd; background-color: #2e1065; border-right: 1px solid #4c1d95; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColL)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #cbd5e1; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.purchasesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #cbd5e1; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.purchasesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #ffffff; border-right: 1px solid #334155; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.purchasesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #fde047; background-color: #451a03; border-right: 1px solid #78350f; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.purchasesColL)}
              </td>
              <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #38bdf8; white-space: nowrap;">
                ${formatPdfCurrency(aggregatedTotals.salesColL - aggregatedTotals.purchasesColL)}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Consolidated Sales, Purchases & VAT Due Table (Single-Row Combined Summary across all Branches and Months) -->
        <div style="margin-top: 10px; background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.04em;">
              Consolidated Sales & Purchases Summary (${quarter}) • Combined Basis
            </div>
            <div style="font-size: 9px; color: #475569; font-style: italic;">
              Combined Sales from all Branches less ${purchasesMode === 'per-branch' ? 'Combined Per-Branch Purchases' : 'Consolidated Purchases'} = VAT Due
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff;">
                <th rowspan="2" style="padding: 6px 8px; text-align: left; border-right: 1px solid #334155; width: 15%;">Consolidation Basis</th>
                <th colspan="4" style="padding: 4px 6px; text-align: center; border-right: 1px solid #334155; background-color: #1e1b4b; color: #e0e7ff;">
                  COMBINED SALES (ALL BRANCHES & MONTHS)
                </th>
                <th colspan="4" style="padding: 4px 6px; text-align: center; border-right: 1px solid #334155; background-color: #451a03; color: #fef08a;">
                  LESS: ${purchasesMode === 'per-branch' ? 'COMBINED PURCHASES (PER-BRANCH)' : 'CONSOLIDATED PURCHASES'}
                </th>
                <th rowspan="2" style="padding: 6px 8px; text-align: right; background-color: #0369a1; color: #ffffff; width: 12%;">
                  VAT DUE
                </th>
              </tr>
              <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Taxable (12%)</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Zero-Rated</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Exempt</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #94a3b8; background-color: #ede9fe; color: #4338ca;">Output Tax</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Taxable (12%)</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Zero-Rated</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #cbd5e1;">Exempt</th>
                <th style="padding: 3px 5px; text-align: right; border-right: 1px solid #94a3b8; background-color: #fef3c7; color: #b45309;">Input Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #ffffff; border-bottom: 2px solid #0f172a; font-weight: 700;">
                <td style="padding: 8px 8px; font-weight: 800; color: #0f172a; border-right: 1px solid #cbd5e1;">
                  Combined All Branches (${quarter}) • ${purchasesMode === 'per-branch' ? 'Combined Purchases' : 'Consolidated Purchases'}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; border-right: 1px solid #e2e8f0;">
                  ${formatPdfCurrency(aggregatedTotals.salesColH)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; color: #64748b; border-right: 1px solid #e2e8f0;">
                  ${formatPdfCurrency(aggregatedTotals.salesColG)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; color: #64748b; border-right: 1px solid #cbd5e1;">
                  ${formatPdfCurrency(aggregatedTotals.salesColF)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; font-weight: 900; color: #4338ca; background-color: #f5f3ff; border-right: 1px solid #94a3b8;">
                  ${formatPdfCurrency(aggregatedTotals.salesColL)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; border-right: 1px solid #e2e8f0;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColH)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; color: #64748b; border-right: 1px solid #e2e8f0;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColG)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; color: #64748b; border-right: 1px solid #cbd5e1;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColF)}
                </td>
                <td style="padding: 8px 5px; text-align: right; font-family: monospace; font-weight: 900; color: #b45309; background-color: #fffbeb; border-right: 1px solid #94a3b8;">
                  ${formatPdfCurrency(aggregatedTotals.purchasesColL)}
                </td>
                <td style="padding: 8px 8px; text-align: right; font-family: monospace; font-weight: 900; font-size: 11px; color: ${aggregatedTotals.salesColL - aggregatedTotals.purchasesColL >= 0 ? '#047857' : '#0369a1'}; background-color: ${aggregatedTotals.salesColL - aggregatedTotals.purchasesColL >= 0 ? '#ecfdf5' : '#f0f9ff'};">
                  ${formatPdfCurrency(aggregatedTotals.salesColL - aggregatedTotals.purchasesColL)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Page 1 Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
        <div>
          <strong>Philippine Tax Compliance Automation</strong> • Republic Act No. 11976 (eOPT Act) • RR 16-2005 / SLSP Specification
        </div>
        <div>
          Generated: ${generatedTimestamp} • <strong>Page 1 of 2 (Multi-Branch Aggregation)</strong>
        </div>
      </div>
    </div>

    <!-- PAGE 2: Schedule 1 to 3 and 2550Q VAT Summary -->
    <div id="pdf-page-2" style="width: 1120px; min-height: 792px; padding: 28px 36px; background-color: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Official BIR Form 2550Q Return Header -->
        <div style="border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569;">
              Bureau of Internal Revenue • Quarterly Value-Added Tax Return
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px; letter-spacing: -0.01em;">
              ${client.registeredName || client.tradeName || 'Taxpayer'}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
              BIR Form 2550Q: Schedules 1 to 3 & VAT Summary • TIN: ${client.tin} • RDO: ${client.rdo}
            </div>
          </div>
          <div style="text-align: right; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Tax Period</div>
            <div style="font-size: 15px; font-weight: 800; color: #1e1b4b; margin-top: 1px;">${quarter} ${year}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Due Date: ${statutoryDueDate}</div>
          </div>
        </div>

        <!-- Two-Column Landscape Grid for Schedules & 2550Q VAT Summary -->
        <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; align-items: start;">
          <!-- Left Column: Schedule 1 & Schedule 2 -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Schedule 1: Sales / Receipts (Output Tax) -->
            <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #ede9fe; padding: 6px 10px; border-bottom: 1px solid #ddd6fe; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #3b0764; letter-spacing: 0.04em;">
                  Schedule 1: Sales / Receipts (Output Tax)
                </span>
                <span style="font-size: 10px; font-weight: 600; color: #5b21b6;">Part IV - Line 15 to 19</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">15A. Vatable Sales / Receipts (12%)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; width: 35%;">
                      ${formatPdfCurrency(effective2550QData.vatableSales)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #5b21b6; width: 28%; background-color: #faf5ff;">
                      ${formatPdfCurrency(effective2550QData.vatableSales * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">15B. Sales to Government (12%)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.salesToGovernment)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #5b21b6; background-color: #faf5ff;">
                      ${formatPdfCurrency(effective2550QData.salesToGovernment * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">15C. Zero-Rated Sales (0%)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.zeroRatedSales)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #94a3b8; background-color: #faf5ff;">
                      ₱ 0.00
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">15D. VAT-Exempt Sales</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.vatExemptSales)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #94a3b8; background-color: #faf5ff;">
                      ₱ 0.00
                    </td>
                  </tr>
                  <tr style="background-color: #f5f3ff; font-weight: 700; border-top: 1px solid #ddd6fe;">
                    <td style="padding: 6px 10px; color: #3b0764;">Total Sales / Output Tax (Line 16 / 19B)</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #1e1b4b;">
                      ${formatPdfCurrency(effectiveResult.totalSales)}
                    </td>
                    <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #4c1d95; background-color: #ede9fe;">
                      ${formatPdfCurrency(effectiveResult.outputTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Schedule 2: Allowable Input Tax on Purchases (12%) -->
            <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #fef3c7; padding: 6px 10px; border-bottom: 1px solid #fde68a; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #78350f; letter-spacing: 0.04em;">
                  Schedule 2: Allowable Input Tax on Purchases (12%)
                </span>
                <span style="font-size: 10px; font-weight: 600; color: #92400e;">Part IV - Line 20</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">20A. Domestic Purchases of Goods</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569; width: 35%;">
                      ${formatPdfCurrency(effective2550QData.inputPurchasesGoods)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 600; color: #78350f; width: 28%; background-color: #fffbeb;">
                      ${formatPdfCurrency(effective2550QData.inputPurchasesGoods * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">20B. Domestic Purchases of Services</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.inputPurchasesServices)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 600; color: #78350f; background-color: #fffbeb;">
                      ${formatPdfCurrency(effective2550QData.inputPurchasesServices * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">20C. Capital Goods Purchases</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #475569;">
                      ${formatPdfCurrency(effective2550QData.inputCapitalGoods)}
                    </td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 600; color: #78350f; background-color: #fffbeb;">
                      ${formatPdfCurrency(effective2550QData.inputCapitalGoods * 0.12)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">20D. Prior Quarter's Excess Input Tax</td>
                    <td style="padding: 5px 10px; text-align: right; color: #94a3b8;">—</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #0284c7; background-color: #f0f9ff;">
                      ${formatPdfCurrency(effective2550QData.priorQuarterExcessInputVat)}
                    </td>
                  </tr>
                  <tr style="background-color: #fefce8; font-weight: 700; border-top: 1px solid #fde68a;">
                    <td style="padding: 6px 10px; color: #713f12;" colspan="2">Total Available Input Tax (Line 20)</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #854d0e; background-color: #fef08a;">
                      ${formatPdfCurrency(effectiveResult.totalAvailableInputTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Right Column: Schedule 3 & 2550Q VAT Summary -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Schedule 3: Tax Credits & Withholding VAT -->
            <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #f1f5f9; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1e293b; letter-spacing: 0.04em;">
                  Schedule 3: Tax Credits & Withholding VAT
                </span>
                <span style="font-size: 10px; font-weight: 600; color: #475569;">Part IV - Line 22</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">22A. VAT Withheld on Sales to Govt (BIR Form 2307, 5%)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #047857;">
                      ${formatPdfCurrency(effective2550QData.withheldVat2307Govt)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">22B. Other Creditable VAT Withheld (Form 2307 Private)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #047857;">
                      ${formatPdfCurrency(effective2550QData.withheldVat2307Private)}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 5px 10px; color: #334155;">22C. Prior Payments Made (Monthly 2550M Returns)</td>
                    <td style="padding: 5px 10px; text-align: right; font-family: monospace; color: #047857;">
                      ${formatPdfCurrency(effective2550QData.priorPaymentsThisQuarter)}
                    </td>
                  </tr>
                  <tr style="background-color: #ecfdf5; font-weight: 700; border-top: 1px solid #a7f3d0;">
                    <td style="padding: 6px 10px; color: #065f46;">Total Tax Credits & Payments (Line 22)</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #047857;">
                      ${formatPdfCurrency(effectiveResult.totalTaxCredits)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 2550Q VAT Summary Box (Featured Computation Box) -->
            <div style="background-color: #0f172a; color: #ffffff; border-radius: 8px; padding: 12px 16px; border: 1px solid #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #f8fafc;">
                  2550Q VAT SUMMARY COMPUTATION
                </div>
                <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">BIR FORM 2550Q</div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; color: #cbd5e1;">
                  <span>Line 19B. Total Output Tax Due (12%)</span>
                  <span style="font-family: monospace; font-weight: 600; color: #ffffff;">${formatPdfCurrency(effectiveResult.outputTax)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #cbd5e1;">
                  <span>Line 20. Less: Total Available Input Tax</span>
                  <span style="font-family: monospace; font-weight: 600; color: #fde047;">(${formatPdfCurrency(effectiveResult.totalAvailableInputTax)})</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #e2e8f0; font-weight: 600; padding-top: 4px; border-top: 1px dashed #334155;">
                  <span>Line 21. Net VAT Payable (Excess Input Tax)</span>
                  <span style="font-family: monospace; color: #ffffff;">${formatPdfCurrency(effectiveResult.outputTax - effectiveResult.totalAvailableInputTax)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: #cbd5e1;">
                  <span>Line 22. Less: Total Tax Credits / Payments</span>
                  <span style="font-family: monospace; font-weight: 600; color: #6ee7b7;">(${formatPdfCurrency(effectiveResult.totalTaxCredits)})</span>
                </div>

                <!-- Final Net Tax Result Banner -->
                <div style="margin-top: 6px; padding: 10px 12px; background-color: ${effectiveResult.isExcessInputVat ? '#0c4a6e' : '#064e3b'}; border: 1px solid ${effectiveResult.isExcessInputVat ? '#0284c7' : '#059669'}; border-radius: 6px;">
                  <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${effectiveResult.isExcessInputVat ? '#bae6fd' : '#a7f3d0'};">
                    ${effectiveResult.isExcessInputVat ? 'Line 23. EXCESS INPUT VAT (CREDIT TO SUCCEEDING QUARTER)' : 'Line 23. NET VAT STILL PAYABLE (TO BIR)'}
                  </div>
                  <div style="font-size: 20px; font-weight: 800; font-family: monospace; color: #ffffff; margin-top: 2px;">
                    ${effectiveResult.isExcessInputVat ? formatPdfCurrency(effectiveResult.excessInputTax) : formatPdfCurrency(Math.max(0, effectiveResult.netVatPayable))}
                  </div>
                  <div style="font-size: 9px; color: ${effectiveResult.isExcessInputVat ? '#e0f2fe' : '#d1fae5'}; margin-top: 2px;">
                    ${effectiveResult.isExcessInputVat ? 'Automatically carried over as prior quarter excess credit' : `Remit on or before statutory quarterly deadline (${statutoryDueDate})`}
                  </div>
                </div>
              </div>
            </div>

            <!-- Taxpayer Certification & Signature Box -->
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; background-color: #f8fafc; font-size: 9px; color: #475569;">
              <div style="font-weight: 700; text-transform: uppercase; color: #1e293b; margin-bottom: 2px;">
                Taxpayer / Authorized Representative Certification
              </div>
              <p style="margin: 0 0 6px 0; line-height: 1.35;">
                I declare under the penalties of perjury that this schedule and return summary have been examined by me and to the best of my knowledge and belief, are true, correct, and complete pursuant to the provisions of the National Internal Revenue Code (NIRC) and regulations.
              </p>
              <div style="display: flex; justify-content: space-between; border-top: 1px dotted #94a3b8; padding-top: 6px; margin-top: 4px;">
                <span>Taxpayer / Representative Signature</span>
                <span>Date: ________________________</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Page 2 Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
        <div>
          <strong>BIR Form 2550Q (Quarterly VAT)</strong> • Electronic Filing & Payment System (eFPS) / eOPT Integration
        </div>
        <div>
          Generated: ${generatedTimestamp} • <strong>Page 2 of 2 (Schedules 1-3 & 2550Q VAT Summary)</strong>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const page1El = container.querySelector('#pdf-page-1') as HTMLElement;
    const page2El = container.querySelector('#pdf-page-2') as HTMLElement;

    if (!page1El || !page2El) {
      throw new Error('Failed to find generated PDF page elements');
    }

    // Capture Page 1 at high scale (scale: 2 for 192 DPI crisp resolution)
    const canvas1 = await html2canvas(page1El, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Capture Page 2 at high scale
    const canvas2 = await html2canvas(page2El, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Initialize Landscape A4 PDF (297mm x 210mm)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;

    // Add Page 1
    const imgData1 = canvas1.toDataURL('image/png');
    pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

    // Add Page 2
    pdf.addPage('a4', 'landscape');
    const imgData2 = canvas2.toDataURL('image/png');
    pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

    // File name
    const companyName = (client.registeredName || client.tradeName || 'Taxpayer')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const fileName = `BIR_2550Q_MultiBranch_Summary_${companyName}_${quarter}_${year}.pdf`;

    pdf.save(fileName);
  } finally {
    // Always clean up the temporary off-screen container
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export interface VatComparisonPdfOptions {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  branches: ClientBranchSchedule[];
  purchasesMode: PurchasesReportingMode;
  consolidatedPurchasesFile?: BirUploadedFileRecord | null;
  branchCalculations: Array<{
    branch: ClientBranchSchedule;
    actualSalesF: number;
    actualSalesG: number;
    actualSalesH: number;
    actualSalesL: number;
    bPurchF: number;
    bPurchG: number;
    bPurchH: number;
    bPurchL: number;
    actualNetVat: number;
    adjustedSalesF: number;
    adjustedSalesG: number;
    adjustedSalesH: number;
    adjustedSalesL: number;
    adjustedNetVat: number;
    totalBranchDefTaxable: number;
    totalBranchDefOutputTax: number;
    proRatedManualTaxable: number;
    proRatedManualOutputTax: number;
  }>;
  actualTotals: {
    salesColF: number;
    salesColG: number;
    salesColH: number;
    salesColL: number;
    purchasesColF: number;
    purchasesColG: number;
    purchasesColH: number;
    purchasesColL: number;
    netVatPayable: number;
  };
  adjustedTotals: {
    salesColF: number;
    salesColG: number;
    salesColH: number;
    salesColL: number;
    purchasesColF: number;
    purchasesColG: number;
    purchasesColH: number;
    purchasesColL: number;
    netVatPayable: number;
  };
  deferredCustomersList?: Array<
    BirTransactionRow & {
      monthIndex: number;
      monthLabel: string;
      monthName: string;
      branchName: string;
      branchId: string;
    }
  >;
  manualDefTaxable?: number;
  manualDefOutputTax?: number;
  totalDeferredTaxable?: number;
  totalDeferredOutputTax?: number;
  previousQuarterHideAmount?: number;
  previousQuarterHideOutputTax?: number;
}

export async function exportVatComparisonPdf({
  client,
  quarter,
  year,
  branches,
  purchasesMode,
  branchCalculations,
  actualTotals,
  adjustedTotals,
  deferredCustomersList = [],
  manualDefTaxable = 0,
  manualDefOutputTax = 0,
  totalDeferredTaxable = 0,
  totalDeferredOutputTax = 0,
  previousQuarterHideAmount = 0,
  previousQuarterHideOutputTax = 0,
}: VatComparisonPdfOptions): Promise<void> {
  const quarterDueDates: Record<Quarter, string> = {
    Q1: `April 25, ${year}`,
    Q2: `July 25, ${year}`,
    Q3: `October 25, ${year}`,
    Q4: `January 25, ${year + 1}`,
  };
  const statutoryDueDate = quarterDueDates[quarter];
  const generatedTimestamp = new Date().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const hasActiveDeferral =
    totalDeferredTaxable > 0 ||
    totalDeferredOutputTax > 0 ||
    deferredCustomersList.length > 0 ||
    manualDefTaxable > 0 ||
    manualDefOutputTax > 0;

  const effectiveTotalDefTaxable = totalDeferredTaxable || 0;
  const effectiveTotalDefOutputTax = totalDeferredOutputTax || 0;
  const effectiveManualTaxable = manualDefTaxable || 0;
  const effectiveManualOutputTax = manualDefOutputTax || 0;
  const effectivePrevQuarterHideAmount = previousQuarterHideAmount || 0;
  const effectivePrevQuarterHideOutputTax =
    previousQuarterHideOutputTax || (effectivePrevQuarterHideAmount > 0 ? effectivePrevQuarterHideAmount * 0.12 : 0);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  container.style.color = '#0f172a';
  container.style.boxSizing = 'border-box';

  // Deferrals detailed rows (up to 4 on page 1, or full list)
  const isMultiPageDeferrals = deferredCustomersList.length > 4;
  const page1DeferralItems = isMultiPageDeferrals ? deferredCustomersList.slice(0, 3) : deferredCustomersList;

  const renderDeferredRows = (list: typeof deferredCustomersList) =>
    list
      .map(
        (tx, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8px; background-color: ${i % 2 === 0 ? '#ffffff' : '#faf5ff'};">
        <td style="padding: 3px 6px; font-weight: 600; color: #334155;">${tx.branchName || 'Main'}</td>
        <td style="padding: 3px 6px; color: #0f172a; font-weight: 600; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${tx.registeredName || 'Unnamed Customer'}
        </td>
        <td style="padding: 3px 6px; font-family: monospace; color: #475569;">${tx.tin || 'N/A'}</td>
        <td style="padding: 3px 6px; color: #64748b;">${tx.monthLabel || `${tx.monthIndex} Month`}</td>
        <td style="padding: 3px 6px; text-align: right; font-weight: 600; color: #6b21a8;">${formatPdfCurrency(tx.taxableAmount || 0)}</td>
        <td style="padding: 3px 6px; text-align: right; font-weight: 700; color: #7c3aed;">${formatPdfCurrency(tx.taxAmount || 0)}</td>
        <td style="padding: 3px 6px; text-align: center; color: #9333ea; font-size: 7.5px; font-weight: 700;">DEFERRED</td>
      </tr>
    `
      )
      .join('');

  // Page 1 HTML
  const page1Html = `
    <div class="pdf-comparison-page" id="pdf-comp-page-1" style="width: 1120px; min-height: 792px; padding: 20px 28px; background-color: #ffffff; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; border-radius: 8px; background: linear-gradient(135deg, #1e1b4b, #312e81); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; border: 1px solid #4338ca;">
            BIR
          </div>
          <div>
            <div style="font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.08em;">
              Bureau of Internal Revenue
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; margin-top: 1px;">
              ${client.registeredName || client.tradeName || 'Taxpayer'}
            </div>
            <div style="font-size: 9.5px; color: #64748b; font-weight: 500;">
              Quarterly VAT Multi-Branch Comparison Schedule • Actual Basis vs. Adjusted Basis (Deferred Sales & VAT Due Reconciliation)
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; text-align: right;">
            <div style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">Tax Period</div>
            <div style="font-size: 13px; font-weight: 800; color: #1e1b4b;">${quarter} ${year}</div>
            <div style="font-size: 8.5px; color: #64748b;">Due: ${statutoryDueDate}</div>
          </div>
        </div>
      </div>

      <!-- Taxpayer Profile Grid (Only TIN and Form Type) -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 9px;">
        <div>
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Taxpayer Identification No. (TIN)</div>
          <div style="font-weight: 700; font-family: monospace; color: #0f172a; font-size: 11px; margin-top: 1px;">${client.tin}</div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 1px;">RDO: ${client.rdo} • Classification: ${client.classification}</div>
        </div>
        <div>
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em;">Form Type</div>
          <div style="font-weight: 700; color: #4338ca; font-size: 10px; margin-top: 1px;">BIR Form 2550Q (Quarterly VAT)</div>
          <div style="font-size: 8.5px; color: #059669; margin-top: 1px;">Status: Validated (${client.vatStatus === 'vat-registered' ? 'VAT Registered' : 'Non-VAT'})</div>
        </div>
      </div>

      <!-- TABLE 1: ACTUAL COMPUTATION -->
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 7px; height: 7px; border-radius: 2px; background-color: #2563eb;"></div>
            <div style="font-size: 10px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.04em;">
              1. ACTUAL COMPUTATION
            </div>
          </div>
          <div style="font-size: 8px; color: #64748b; font-style: italic;">
            Direct unadjusted rollup from uploaded monthly 2550Q / SLSP files
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; table-layout: fixed;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff;">
              <th rowspan="2" style="padding: 6px 8px; text-align: left; border-right: 1px solid #334155; width: 10.5%; font-size: 9.5px; font-weight: 800; text-transform: uppercase; vertical-align: middle; white-space: nowrap;">Consolidation Basis</th>
              <th colspan="4" style="padding: 5px 6px; text-align: center; border-right: 1px solid #334155; background-color: #1e1b4b; color: #e0e7ff; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                ACTUAL SALES
              </th>
              <th colspan="4" style="padding: 5px 6px; text-align: center; border-right: 1px solid #334155; background-color: #451a03; color: #fef08a; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                ACTUAL PURCHASES
              </th>
              <th rowspan="2" style="padding: 6px 8px; text-align: right; background-color: #0369a1; color: #ffffff; width: 12.5%; font-size: 9.5px; font-weight: 800; text-transform: uppercase; vertical-align: middle; white-space: nowrap;">
                ACTUAL VAT DUE
              </th>
            </tr>
            <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: 700; font-size: 9px; border-bottom: 1px solid #cbd5e1;">
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Taxable (12%)</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Zero-Rated</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Exempt</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #94a3b8; background-color: #ede9fe; color: #4338ca; vertical-align: middle; white-space: nowrap;">Output Tax</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Taxable (12%)</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Zero-Rated</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">Exempt</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #94a3b8; background-color: #fef3c7; color: #b45309; vertical-align: middle; white-space: nowrap;">Input Tax</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #ffffff; border-bottom: 2px solid #0f172a; font-weight: 700;">
              <td style="padding: 7px 8px; font-weight: 800; font-size: 11px; color: #0f172a; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">
                Actual
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.salesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.salesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.salesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: #4338ca; background-color: #f5f3ff; border-right: 1px solid #94a3b8; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.salesColL)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.purchasesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.purchasesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #cbd5e1; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.purchasesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: #b45309; background-color: #fffbeb; border-right: 1px solid #94a3b8; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.purchasesColL)}
              </td>
              <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: ${actualTotals.netVatPayable >= 0 ? '#047857' : '#0369a1'}; background-color: ${actualTotals.netVatPayable >= 0 ? '#ecfdf5' : '#f0f9ff'}; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(actualTotals.netVatPayable)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- TABLE 2: ADJUSTED COMPUTATION -->
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 7px; height: 7px; border-radius: 2px; background-color: #7c3aed;"></div>
            <div style="font-size: 10px; font-weight: 800; color: #581c87; text-transform: uppercase; letter-spacing: 0.04em;">
              2. ADJUSTED COMPUTATION
            </div>
          </div>
          <div style="font-size: 8px; color: #6b21a8; font-weight: 600;">
            Adjusted for deferred uncollected sales / VAT pursuant to RR 16-2005
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #d8b4fe; border-radius: 4px; overflow: hidden; table-layout: fixed;">
          <thead>
            <tr style="background-color: #3b0764; color: #ffffff;">
              <th rowspan="2" style="padding: 6px 8px; text-align: left; border-right: 1px solid #581c87; width: 10.5%; font-size: 9.5px; font-weight: 800; text-transform: uppercase; vertical-align: middle; white-space: nowrap;">Consolidation Basis</th>
              <th colspan="4" style="padding: 5px 6px; text-align: center; border-right: 1px solid #581c87; background-color: #4c1d95; color: #f5d0fe; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                ADJUSTED SALES
              </th>
              <th colspan="4" style="padding: 5px 6px; text-align: center; border-right: 1px solid #581c87; background-color: #451a03; color: #fef08a; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;">
                ADJUSTED PURCHASES
              </th>
              <th rowspan="2" style="padding: 6px 8px; text-align: right; background-color: #581c87; color: #ffffff; width: 12.5%; font-size: 9.5px; font-weight: 800; text-transform: uppercase; vertical-align: middle; white-space: nowrap;">
                ADJUSTED VAT DUE
              </th>
            </tr>
            <tr style="background-color: #f3e8ff; color: #581c87; font-weight: 700; font-size: 9px; border-bottom: 1px solid #d8b4fe;">
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Taxable (12%)</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Zero-Rated</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Exempt</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #c084fc; background-color: #f3e8ff; color: #6b21a8; vertical-align: middle; white-space: nowrap;">Output Tax</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Taxable (12%)</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Zero-Rated</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #e9d5ff; vertical-align: middle; white-space: nowrap;">Exempt</th>
              <th style="width: 9.6%; padding: 4.5px 5px; text-align: right; border-right: 1px solid #c084fc; background-color: #fef3c7; color: #b45309; vertical-align: middle; white-space: nowrap;">Input Tax</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #ffffff; border-bottom: 2px solid #3b0764; font-weight: 700;">
              <td style="padding: 7px 8px; font-weight: 800; font-size: 11px; color: #3b0764; border-right: 1px solid #d8b4fe; vertical-align: middle; white-space: nowrap;">
                Adjusted
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #f3e8ff; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.salesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #f3e8ff; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.salesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #d8b4fe; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.salesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: #6b21a8; background-color: #faf5ff; border-right: 1px solid #c084fc; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.salesColL)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #f3e8ff; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.purchasesColH)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #f3e8ff; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.purchasesColG)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 700; color: #64748b; border-right: 1px solid #d8b4fe; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.purchasesColF)}
              </td>
              <td style="padding: 7px 6px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: #b45309; background-color: #fffbeb; border-right: 1px solid #c084fc; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.purchasesColL)}
              </td>
              <td style="padding: 7px 8px; text-align: right; font-family: monospace; font-size: 10px; font-weight: 800; color: ${adjustedTotals.netVatPayable >= 0 ? '#4338ca' : '#dc2626'}; background-color: ${adjustedTotals.netVatPayable >= 0 ? '#f5f3ff' : '#fef2f2'}; vertical-align: middle; white-space: nowrap;">
                ${formatPdfCurrency(adjustedTotals.netVatPayable)}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Comparison Variance Strip -->
        <div style="background: linear-gradient(90deg, #f5f3ff, #faf5ff); border: 1px dashed #c084fc; border-radius: 4px; padding: 5px 10px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px;">
          <span style="font-weight: 800; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.04em;">
            Variance Summary (Actual vs. Adjusted):
          </span>
          <div style="display: flex; gap: 14px; font-weight: 700;">
            <span style="color: #475569;">
              Taxable Sales Diff: <strong style="color: #7c3aed; font-family: monospace; font-size: 9.5px;">-${formatPdfCurrency(actualTotals.salesColH - adjustedTotals.salesColH)}</strong>
            </span>
            <span style="color: #475569;">
              Output VAT Diff: <strong style="color: #7c3aed; font-family: monospace; font-size: 9.5px;">-${formatPdfCurrency(actualTotals.salesColL - adjustedTotals.salesColL)}</strong>
            </span>
            <span style="color: #475569;">
              Net VAT Payable Impact: <strong style="color: #4338ca; font-family: monospace; font-size: 9.5px;">-${formatPdfCurrency(actualTotals.netVatPayable - adjustedTotals.netVatPayable)}</strong>
            </span>
          </div>
        </div>
      </div>

      <!-- BOTTOM SECTION: SUMMARY OF THE DEFERRALS -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 7px; height: 7px; border-radius: 2px; background-color: #059669;"></div>
            <div style="font-size: 10px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.04em;">
              3. Summary of Deferrals & Variance Reconciliation
            </div>
          </div>
          <div style="font-size: 8px; color: #047857; font-weight: 600;">
            ${hasActiveDeferral || effectivePrevQuarterHideAmount > 0 ? `${deferredCustomersList.length} transaction(s) + adjustments active` : 'No active deferrals (Identical)'}
          </div>
        </div>

        <!-- Deferral Metric Cards (4 cards: Total Deferred Taxable, Output VAT, Prev Qtr Hide, Specific Customer Txns) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px;">
          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 5px 8px;">
            <div style="font-size: 7px; font-weight: 700; color: #7c3aed; text-transform: uppercase;">Total Deferred Taxable</div>
            <div style="font-size: 10.5px; font-weight: 800; color: #581c87; margin-top: 1px;">${formatPdfCurrency(effectiveTotalDefTaxable)}</div>
          </div>
          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 5px 8px;">
            <div style="font-size: 7px; font-weight: 700; color: #7c3aed; text-transform: uppercase;">Total Deferred Output VAT</div>
            <div style="font-size: 10.5px; font-weight: 800; color: #6b21a8; margin-top: 1px;">${formatPdfCurrency(effectiveTotalDefOutputTax)}</div>
          </div>
          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; padding: 5px 8px;">
            <div style="font-size: 7px; font-weight: 700; color: #4338ca; text-transform: uppercase;">Prev Qtr Hide Amount</div>
            <div style="font-size: 10.5px; font-weight: 800; color: #312e81; margin-top: 1px;">${formatPdfCurrency(effectivePrevQuarterHideAmount)}</div>
            <div style="font-size: 6.5px; color: #4338ca; font-weight: 600;">VAT: ${formatPdfCurrency(effectivePrevQuarterHideOutputTax)}</div>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px 8px;">
            <div style="font-size: 7px; font-weight: 700; color: #475569; text-transform: uppercase;">Specific Customer Txns</div>
            <div style="font-size: 10.5px; font-weight: 800; color: #0f172a; margin-top: 1px;">${deferredCustomersList.length} item(s)</div>
          </div>
        </div>

        <!-- Previous Quarter Hide Amount Banner if present -->
        ${
          effectivePrevQuarterHideAmount > 0
            ? `
          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; padding: 5px 9px; margin-bottom: 5px; font-size: 8px; color: #312e81; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="color: #1e1b4b;">Previous Quarter Hide Amount (Prior Period Carried Over):</strong>
              <span style="font-family: monospace; font-weight: 700; color: #4338ca; margin-left: 4px;">
                ₱ ${formatPdfCurrency(effectivePrevQuarterHideAmount)}
              </span>
              <span style="color: #4338ca; margin-left: 4px; font-weight: 600;">
                (Corresponding Output Tax: ₱ ${formatPdfCurrency(effectivePrevQuarterHideOutputTax)})
              </span>
            </div>
            <div style="font-size: 7.5px; color: #4338ca; font-style: italic;">
              Tracked for variance reconciliation across quarterly filings
            </div>
          </div>
        `
            : ''
        }

        ${
          page1DeferralItems.length > 0
            ? `
          <!-- Itemized Customer Deferrals Table -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e9d5ff; border-radius: 4px; overflow: hidden; margin-top: 4px;">
            <thead>
              <tr style="background-color: #6b21a8; color: #ffffff; font-size: 7.5px; text-transform: uppercase;">
                <th style="padding: 3px 6px; text-align: left; width: 18%;">Branch</th>
                <th style="padding: 3px 6px; text-align: left; width: 28%;">Customer Name</th>
                <th style="padding: 3px 6px; text-align: left; width: 16%;">Customer TIN</th>
                <th style="padding: 3px 6px; text-align: left; width: 12%;">Month</th>
                <th style="padding: 3px 6px; text-align: right; width: 13%;">Taxable Excluded</th>
                <th style="padding: 3px 6px; text-align: right; width: 13%;">Output VAT Deferred</th>
              </tr>
            </thead>
            <tbody>
              ${renderDeferredRows(page1DeferralItems)}
            </tbody>
          </table>
          ${
            isMultiPageDeferrals
              ? `<div style="font-size: 7.5px; color: #7c3aed; font-style: italic; margin-top: 2px;">* Showing 3 of ${deferredCustomersList.length} deferred customer transactions. Full schedule continues on Page 2.</div>`
              : ''
          }
        `
            : hasActiveDeferral
            ? `
          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 6px 10px; font-size: 8px; color: #6b21a8;">
            <strong>Manual Pro-Rated Deferral Active:</strong> Taxable Sales of ₱ ${formatPdfCurrency(effectiveManualTaxable)} and Output VAT of ₱ ${formatPdfCurrency(effectiveManualOutputTax)} have been pro-rated across branches based on taxable sales ratio.
          </div>
        `
            : `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; font-size: 8px; color: #475569; text-align: center;">
            No sales or output tax deferrals were applied for this quarter. The Actual and Adjusted VAT schedules reflect identical figures.
          </div>
        `
        }
      </div>

      <!-- Footer -->
      <div style="margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #94a3b8;">
        <div>BIR Multi-Branch Reconciliation Report • RR 16-2005 & RA 11976 eOPT Compliant</div>
        <div>Generated: ${generatedTimestamp} • Page 1 of ${isMultiPageDeferrals ? '2' : '1'}</div>
      </div>
    </div>
  `;

  // Page 2 (if multi-page deferrals exist)
  let page2Html = '';
  if (isMultiPageDeferrals) {
    page2Html = `
      <div class="pdf-comparison-page" id="pdf-comp-page-2" style="width: 1120px; min-height: 792px; padding: 20px 28px; background-color: #ffffff; box-sizing: border-box;">
        <!-- Compact Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px;">
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">SCHEDULE OF DEFERRED SALES & OUTPUT TAX (FULL ITEMIZED BREAKDOWN)</div>
            <div style="font-size: 8.5px; color: #64748b;">${client.registeredName || client.tradeName} • TIN: ${client.tin} • ${quarter} ${year}</div>
          </div>
          <div style="font-size: 8.5px; color: #475569; font-weight: 600;">Total Deferred: ${formatPdfCurrency(effectiveTotalDefTaxable)} (${deferredCustomersList.length} transactions)</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
          <thead>
            <tr style="background-color: #3b0764; color: #ffffff; font-size: 8px; text-transform: uppercase;">
              <th style="padding: 4px 6px; text-align: left; width: 16%;">Branch</th>
              <th style="padding: 4px 6px; text-align: left; width: 30%;">Customer / Buyer Name</th>
              <th style="padding: 4px 6px; text-align: left; width: 16%;">Customer TIN</th>
              <th style="padding: 4px 6px; text-align: left; width: 12%;">Month</th>
              <th style="padding: 4px 6px; text-align: right; width: 13%;">Taxable Amount</th>
              <th style="padding: 4px 6px; text-align: right; width: 13%;">Output VAT Deferred</th>
            </tr>
          </thead>
          <tbody>
            ${renderDeferredRows(deferredCustomersList)}
          </tbody>
        </table>

        <!-- Pro-rating summary -->
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; font-size: 8.5px;">
          <div style="font-weight: 800; color: #1e1b4b; text-transform: uppercase; margin-bottom: 4px;">Branch Pro-Rating Allocation Notes:</div>
          <div style="color: #475569; line-height: 1.5;">
            Customer-specific deferrals are matched directly with their designated branch source filings. Any general manual deferral amount is proportionally allocated based on each branch's base taxable sales ratio.
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 16px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #94a3b8;">
          <div>BIR Multi-Branch Reconciliation Report • Page 2 of 2</div>
          <div>Generated: ${generatedTimestamp}</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = page1Html + page2Html;
  document.body.appendChild(container);

  try {
    const pageEls = container.querySelectorAll('.pdf-comparison-page');
    if (pageEls.length === 0) {
      throw new Error('Failed to create PDF comparison pages');
    }

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;

    for (let i = 0; i < pageEls.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'landscape');
      }

      const canvas = await html2canvas(pageEls[i] as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    const companyName = (client.registeredName || client.tradeName || 'Taxpayer')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const fileName = `BIR_VAT_Comparison_Actual_vs_Adjusted_${companyName}_${quarter}_${year}.pdf`;

    pdf.save(fileName);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export interface DeferredPdfExportOptions {
  client: ClientProfile;
  year: number;
  currentQuarter: Quarter;
  deferredClients: DeferredClientRecord[];
  quarterlyBreakdown?: QuarterlyDeferralDetail[];
  accumulatedPriorTaxable?: number;
  accumulatedPriorVatDue?: number;
}

export async function exportDeferredClientsListPdf(options: DeferredPdfExportOptions): Promise<void> {
  const {
    client,
    year,
    currentQuarter,
    deferredClients,
    quarterlyBreakdown = [],
    accumulatedPriorTaxable = 0,
    accumulatedPriorVatDue = 0,
  } = options;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    const totalSpecificTaxable = deferredClients.reduce((sum, c) => sum + (c.taxableAmount || 0), 0);
    const totalSpecificVatDue = deferredClients.reduce((sum, c) => sum + (c.taxAmount || 0), 0);

    const clientRowsHtml = deferredClients.length > 0
      ? deferredClients
          .map(
            (c, i) => `
          <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 7px 10px; font-size: 10px; text-align: center; color: #64748b;">${i + 1}</td>
            <td style="padding: 7px 10px; font-size: 10px; font-weight: 700; color: #4338ca; text-align: center;">${c.quarter} ${c.year}</td>
            <td style="padding: 7px 10px; font-size: 10px; color: #475569;">${c.branchName}</td>
            <td style="padding: 7px 10px; font-size: 10.5px; font-weight: 600; color: #0f172a;">${c.registeredName}</td>
            <td style="padding: 7px 10px; font-size: 10px; font-family: monospace; color: #334155;">${c.tin || 'N/A'}</td>
            <td style="padding: 7px 10px; font-size: 10px; font-family: monospace; text-align: right; color: #0f172a;">${formatPdfCurrency(c.taxableAmount || 0)}</td>
            <td style="padding: 7px 10px; font-size: 10px; font-family: monospace; text-align: right; font-weight: 700; color: #4338ca;">${formatPdfCurrency(c.taxAmount || 0)}</td>
            <td style="padding: 7px 10px; font-size: 9px; text-align: center;">
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background-color: #ede9fe; color: #6d28d9; font-weight: 700;">DEFERRED</span>
            </td>
          </tr>
        `
          )
          .join('')
      : `
        <tr>
          <td colspan="8" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 11px;">
            No specific client sales deferred from the start of taxable year ${year} up to ${currentQuarter}.
          </td>
        </tr>
      `;

    const quarterlyBreakdownHtml = quarterlyBreakdown
      .map(
        (qb) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
          <td style="padding: 6px 10px; font-weight: 700; color: #1e1b4b;">${qb.quarter} ${qb.year}</td>
          <td style="padding: 6px 10px; text-align: center; color: #475569;">${qb.clientCount} clients</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #334155;">${formatPdfCurrency(qb.specificTaxable)}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #334155;">${formatPdfCurrency(qb.specificVatDue)}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #334155;">${formatPdfCurrency(qb.manualTaxable)}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; color: #334155;">${formatPdfCurrency(qb.manualVatDue)}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">${formatPdfCurrency(qb.totalTaxable)}</td>
          <td style="padding: 6px 10px; text-align: right; font-family: monospace; font-weight: 800; color: #4338ca;">${formatPdfCurrency(qb.totalVatDue)}</td>
        </tr>
      `
      )
      .join('');

    container.innerHTML = `
      <div id="pdf-deferred-clients-page" style="width: 1120px; min-height: 792px; padding: 28px 36px; background-color: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <!-- Header -->
          <div style="border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569;">
                Bureau of Internal Revenue
              </div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px; letter-spacing: -0.01em;">
                ${client.registeredName || client.tradeName || 'Taxpayer'}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
                Schedule of Deferred Clients &amp; Output Tax • Taxable Year ${year} (Beginning of Taxable Year Q1 to ${currentQuarter})
              </div>
            </div>
            <div style="text-align: right; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Taxable Year</div>
              <div style="font-size: 15px; font-weight: 800; color: #1e1b4b; margin-top: 1px;">${year} (YTD ${currentQuarter})</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Form: BIR Form 2550Q Deferral Log</div>
            </div>
          </div>

          <!-- Taxpayer Profile -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; font-size: 11px;">
            <div>
              <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b;">Taxpayer Identification No. (TIN)</div>
              <div style="font-weight: 700; font-family: monospace; color: #0f172a; font-size: 12.5px; margin-top: 1px;">${client.tin}</div>
            </div>
            <div>
              <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b;">Revenue District Office</div>
              <div style="font-weight: 600; color: #1e293b; font-size: 11px; margin-top: 1px;">${client.rdo}</div>
            </div>
            <div>
              <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b;">Cumulative Period</div>
              <div style="font-weight: 700; color: #4338ca; font-size: 11px; margin-top: 1px;">Q1 ${year} - ${currentQuarter} ${year}</div>
            </div>
          </div>

          <!-- Summary Metric Cards -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;">
            <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px 12px;">
              <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #6d28d9;">Specific Clients Deferred</div>
              <div style="font-size: 16px; font-weight: 800; color: #4c1d95; margin-top: 2px;">${deferredClients.length}</div>
              <div style="font-size: 9px; color: #7c3aed;">Across all branches (YTD)</div>
            </div>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px;">
              <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #475569;">Specific Taxable Sales</div>
              <div style="font-size: 15px; font-weight: 800; font-family: monospace; color: #0f172a; margin-top: 2px;">${formatPdfCurrency(totalSpecificTaxable)}</div>
              <div style="font-size: 9px; color: #64748b;">Total deferred taxable base</div>
            </div>
            <div style="background-color: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 10px 12px;">
              <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #5b21b6;">Specific VAT Due Deferral</div>
              <div style="font-size: 15px; font-weight: 800; font-family: monospace; color: #5b21b6; margin-top: 2px;">${formatPdfCurrency(totalSpecificVatDue)}</div>
              <div style="font-size: 9px; color: #7c3aed;">12% Output Tax deferred</div>
            </div>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px 12px;">
              <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #065f46;">Prior Quarters Running Balance</div>
              <div style="font-size: 15px; font-weight: 800; font-family: monospace; color: #047857; margin-top: 2px;">${formatPdfCurrency(accumulatedPriorTaxable)}</div>
              <div style="font-size: 9px; color: #059669;">VAT Due: ${formatPdfCurrency(accumulatedPriorVatDue)}</div>
            </div>
          </div>

          <!-- Deferred Clients Table -->
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 14px;">
            <div style="background-color: #1e1b4b; color: #ffffff; padding: 8px 12px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between;">
              <span>Deferred Customers List (Taxable Year ${year}: Q1 to ${currentQuarter})</span>
              <span>${deferredClients.length} Records</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-size: 9px; text-transform: uppercase; font-weight: 700; color: #475569;">
                  <th style="padding: 7px 10px; width: 35px; text-align: center;">#</th>
                  <th style="padding: 7px 10px; width: 75px; text-align: center;">Quarter</th>
                  <th style="padding: 7px 10px; width: 140px;">Branch</th>
                  <th style="padding: 7px 10px;">Registered Customer Name</th>
                  <th style="padding: 7px 10px; width: 120px;">TIN</th>
                  <th style="padding: 7px 10px; width: 130px; text-align: right;">Taxable Sales (Col H)</th>
                  <th style="padding: 7px 10px; width: 120px; text-align: right;">VAT Due (Col L)</th>
                  <th style="padding: 7px 10px; width: 75px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${clientRowsHtml}
              </tbody>
              <tfoot>
                <tr style="background-color: #f8fafc; border-top: 2px solid #0f172a; font-weight: 800; font-size: 10.5px;">
                  <td colspan="5" style="padding: 8px 10px; text-align: right; text-transform: uppercase; color: #0f172a;">Total Specific Deferrals (YTD):</td>
                  <td style="padding: 8px 10px; font-family: monospace; text-align: right; color: #0f172a;">${formatPdfCurrency(totalSpecificTaxable)}</td>
                  <td style="padding: 8px 10px; font-family: monospace; text-align: right; color: #4338ca;">${formatPdfCurrency(totalSpecificVatDue)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Quarterly Breakdown if multiple quarters -->
          ${
            quarterlyBreakdown.length > 0
              ? `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 12px;">
              <div style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 6px 12px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #475569;">
                Taxable Year ${year} Cumulative Quarterly Summary
              </div>
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0; font-size: 8.5px; text-transform: uppercase; font-weight: 700; color: #64748b;">
                    <th style="padding: 5px 10px;">Quarter</th>
                    <th style="padding: 5px 10px; text-align: center;">Clients</th>
                    <th style="padding: 5px 10px; text-align: right;">Specific Taxable</th>
                    <th style="padding: 5px 10px; text-align: right;">Specific VAT</th>
                    <th style="padding: 5px 10px; text-align: right;">Manual Taxable</th>
                    <th style="padding: 5px 10px; text-align: right;">Manual VAT</th>
                    <th style="padding: 5px 10px; text-align: right;">Total Taxable</th>
                    <th style="padding: 5px 10px; text-align: right;">Total VAT Due</th>
                  </tr>
                </thead>
                <tbody>
                  ${quarterlyBreakdownHtml}
                </tbody>
              </table>
            </div>
          `
              : ''
          }
        </div>

        <!-- Footer & Signatures -->
        <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div>Generated from BIR Multi-Branch Tax Filing System • Republic Act No. 11976 (eOPT Act)</div>
            <div>Report Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <div style="display: flex; gap: 40px; text-align: center;">
            <div>
              <div style="width: 160px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px;"></div>
              <div>Prepared By / Taxpayer</div>
            </div>
            <div>
              <div style="width: 160px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px;"></div>
              <div>Certified Correct (Accountant)</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const pageEl = container.querySelector('#pdf-deferred-clients-page') as HTMLElement;
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');

    const cleanCompName = (client.registeredName || client.tradeName || 'Taxpayer')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    pdf.save(`BIR_Deferred_Clients_${cleanCompName}_${year}_${currentQuarter}.pdf`);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export interface ComparativeVariancePdfOptions {
  client?: ClientProfile;
  currentYear: number;
  selectedPriorYear?: number;
  currentData: Data1702Annual | Data1701Annual;
  allYearsData?: Record<number, Data1702Annual | Data1701Annual>;
  formType?: '1701' | '1702';
}

interface MetricSet {
  year: number;
  grossSales: number;
  salesReturns: number;
  netSales: number;
  costOfSales: number;
  grossProfit: number;
  nonOperating: number;
  totalGrossIncome: number;
  deductions: number;
  netTaxableIncome: number;
  taxRatePercent: number;
  taxDue: number;
  netIncomeAfterTax: number;
  grossMarginPct: number;
  opExpenseRatioPct: number;
  effectiveTaxRatePct: number;
  netMarginPct: number;
}

function computeMetricsForPdf(
  year: number,
  data?: Data1702Annual | Data1701Annual,
  formType?: '1701' | '1702'
): MetricSet {
  const grossSales = Number(data?.grossSales) || 0;
  const salesReturns = Number((data as any)?.salesReturnsDiscounts) || 0;
  const netSales = Math.max(0, grossSales - salesReturns);
  const costOfSales = Number(data?.costOfSales) || 0;
  const grossProfit = Math.max(0, netSales - costOfSales);
  const nonOperating = Number(data?.nonOperatingIncome) || 0;
  const is1701 = formType === '1701' || (data && 'taxRegime' in data);

  let deductions = 0;
  let taxDue = 0;
  let netTaxableIncome = 0;
  let ratePercent = 0;

  if (is1701) {
    const d1701 = data as Data1701Annual;
    const totalGross = netSales + nonOperating;
    if (d1701?.taxRegime === '8_percent') {
      deductions = d1701?.taxpayerType === 'pure_business' ? 250000 : 0;
      netTaxableIncome = Math.max(0, totalGross - deductions);
      taxDue = netTaxableIncome * 0.08;
      ratePercent = 8;
    } else {
      if (d1701?.deductionMethod === 'osd') {
        deductions = netSales * 0.40;
        netTaxableIncome = Math.max(0, totalGross - deductions);
      } else {
        deductions = Number(d1701?.operatingExpenses) || 0;
        netTaxableIncome = Math.max(0, grossProfit + nonOperating - deductions);
      }
      taxDue = computeGraduatedTax(netTaxableIncome);
      ratePercent = netTaxableIncome > 0 ? (taxDue / netTaxableIncome) * 100 : 0;
    }
  } else {
    const d1702 = data as Data1702Annual;
    const totalGrossIncome = grossProfit + nonOperating;
    deductions = Number(d1702?.operatingExpenses) || 0;
    if (d1702?.deductionMethod === 'osd') {
      deductions = totalGrossIncome * 0.40;
    }
    netTaxableIncome = Math.max(0, totalGrossIncome - deductions);
    const rate = d1702?.rateOption === 'msme_20' ? 0.20 : 0.25;
    const ncit = netTaxableIncome * rate;
    const mcit = d1702?.isMCOptional ? totalGrossIncome * 0.02 : 0;
    taxDue = Math.max(ncit, mcit);
    ratePercent = rate * 100;
  }

  const netIncomeAfterTax = Math.max(0, netTaxableIncome - taxDue);
  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const opExpenseRatioPct = netSales > 0 ? (deductions / netSales) * 100 : 0;
  const effectiveTaxRatePct = netTaxableIncome > 0 ? (taxDue / netTaxableIncome) * 100 : 0;
  const netMarginPct = netSales > 0 ? (netIncomeAfterTax / netSales) * 100 : 0;

  return {
    year,
    grossSales,
    salesReturns,
    netSales,
    costOfSales,
    grossProfit,
    nonOperating,
    totalGrossIncome: is1701 ? netSales + nonOperating : grossProfit + nonOperating,
    deductions,
    netTaxableIncome,
    taxRatePercent: ratePercent,
    taxDue,
    netIncomeAfterTax,
    grossMarginPct,
    opExpenseRatioPct,
    effectiveTaxRatePct,
    netMarginPct,
  };
}

export async function exportComparativeVariancePdf({
  client,
  currentYear,
  selectedPriorYear = currentYear - 1,
  currentData,
  allYearsData = {},
  formType,
}: ComparativeVariancePdfOptions): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1120px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-1000';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const is1701 = formType === '1701' || (currentData && 'taxRegime' in currentData);

  // Compute metrics for prior 3 years and current year
  const priorYears = [currentYear - 3, currentYear - 2, currentYear - 1];
  const metricsMap: Record<number, MetricSet> = {};

  priorYears.forEach((y) => {
    metricsMap[y] = computeMetricsForPdf(y, allYearsData[y], is1701 ? '1701' : '1702');
  });
  metricsMap[currentYear] = computeMetricsForPdf(currentYear, currentData, is1701 ? '1701' : '1702');

  const curr = metricsMap[currentYear];
  const selPrior = metricsMap[selectedPriorYear] || metricsMap[currentYear - 1];
  const baseYear = currentYear - 3;
  const base = metricsMap[baseYear];

  // Helper for variance calculation
  const calcVar = (currVal: number, priorVal: number) => {
    const diff = currVal - priorVal;
    const pct = priorVal !== 0 ? (diff / Math.abs(priorVal)) * 100 : 0;
    return { diff, pct };
  };

  const salesVar = calcVar(curr.grossSales, selPrior.grossSales);
  const netSalesVar = calcVar(curr.netSales, selPrior.netSales);
  const costVar = calcVar(curr.costOfSales, selPrior.costOfSales);
  const gpVar = calcVar(curr.grossProfit, selPrior.grossProfit);
  const dedVar = calcVar(curr.deductions, selPrior.deductions);
  const ntiVar = calcVar(curr.netTaxableIncome, selPrior.netTaxableIncome);
  const taxVar = calcVar(curr.taxDue, selPrior.taxDue);
  const netIncVar = calcVar(curr.netIncomeAfterTax, selPrior.netIncomeAfterTax);

  // Cumulative vs Base Year
  const netSalesCum = calcVar(curr.netSales, base.netSales);
  const gpCum = calcVar(curr.grossProfit, base.grossProfit);
  const ntiCum = calcVar(curr.netTaxableIncome, base.netTaxableIncome);
  const taxCum = calcVar(curr.taxDue, base.taxDue);
  const netIncCum = calcVar(curr.netIncomeAfterTax, base.netIncomeAfterTax);

  const formatDiffCol = (diff: number, isCost = false) => {
    const isGood = isCost ? diff <= 0 : diff >= 0;
    const color = isGood ? '#047857' : '#b91c1c';
    const sign = diff >= 0 ? '+' : '-';
    return `<span style="font-family: monospace; font-weight: 700; color: ${color};">${sign}${formatPdfCurrency(Math.abs(diff))}</span>`;
  };

  const formatPctCol = (pct: number, isCost = false) => {
    if (!isFinite(pct) || isNaN(pct)) return '<span style="color: #94a3b8;">—</span>';
    const isGood = isCost ? pct <= 0 : pct >= 0;
    const bg = isGood ? '#ecfdf5' : '#fff1f2';
    const color = isGood ? '#065f46' : '#9f1239';
    const sign = pct >= 0 ? '+' : '';
    return `<span style="display: inline-block; padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 9px; font-weight: 700; background-color: ${bg}; color: ${color};">${sign}${pct.toFixed(1)}%</span>`;
  };

  // Resolve individual expense accounts composing Cost of Goods Sold and Ordinary Allowable Deductions
  interface ResolvedExpenseSubRow {
    accountName: string;
    currAmount: number;
    selPriorAmount: number;
    prev2Amount: number;
    baseAmount: number;
  }

  // Helper to find or estimate historical amount for a specific expense account
  const getHistoricalAccountAmount = (
    year: number,
    accountName: string,
    breakdownKey: 'costOfSalesBreakdown' | 'itemizedDeductionsBreakdown',
    totalCategoryAmount: number,
    currentTotalAmount: number,
    currentAccountAmount: number,
    clientPrefix: 'cogs' | 'opex'
  ): number => {
    const yrData = allYearsData[year];
    if (yrData && Array.isArray(yrData[breakdownKey]) && yrData[breakdownKey].length > 0) {
      const match = yrData[breakdownKey].find(
        (a: any) => a.accountName && a.accountName.toLowerCase().trim() === accountName.toLowerCase().trim()
      );
      if (match) return match.amount || 0;
    }
    // Check localStorage fallback for that historical year
    if (client?.id) {
      try {
        const saved = localStorage.getItem(`bir_${clientPrefix}_breakdown_${client.id}_${year}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const match = parsed.find(
              (a: any) => a.accountName && a.accountName.toLowerCase().trim() === accountName.toLowerCase().trim()
            );
            if (match) return match.amount || 0;
          }
        }
      } catch (e) {}
    }
    // Proportional estimate if prior total category amount exists
    if (currentTotalAmount > 0 && totalCategoryAmount > 0 && currentAccountAmount > 0) {
      return Math.round((currentAccountAmount / currentTotalAmount) * totalCategoryAmount);
    }
    return 0;
  };

  // 1. Gather COGS accounts
  let rawCogsBreakdown = currentData?.costOfSalesBreakdown || [];
  if ((!rawCogsBreakdown || rawCogsBreakdown.length === 0) && client?.id) {
    try {
      const saved = localStorage.getItem(`bir_cogs_breakdown_${client.id}_${currentYear}`);
      if (saved) rawCogsBreakdown = JSON.parse(saved);
    } catch (e) {}
  }
  if ((!rawCogsBreakdown || rawCogsBreakdown.length === 0) && curr.costOfSales > 0) {
    rawCogsBreakdown = [
      { id: 'cogs_primary', accountName: 'Merchandise Purchases / Direct Materials', amount: curr.costOfSales },
    ];
  }

  const resolvedCogsRows: ResolvedExpenseSubRow[] = (rawCogsBreakdown || []).map((acc: any) => ({
    accountName: acc.accountName || 'Itemized Direct Cost',
    currAmount: acc.amount || 0,
    selPriorAmount: getHistoricalAccountAmount(
      selectedPriorYear,
      acc.accountName,
      'costOfSalesBreakdown',
      selPrior.costOfSales,
      curr.costOfSales,
      acc.amount || 0,
      'cogs'
    ),
    prev2Amount: getHistoricalAccountAmount(
      currentYear - 2,
      acc.accountName,
      'costOfSalesBreakdown',
      metricsMap[currentYear - 2].costOfSales,
      curr.costOfSales,
      acc.amount || 0,
      'cogs'
    ),
    baseAmount: getHistoricalAccountAmount(
      baseYear,
      acc.accountName,
      'costOfSalesBreakdown',
      base.costOfSales,
      curr.costOfSales,
      acc.amount || 0,
      'cogs'
    ),
  }));

  // 2. Gather Deductions accounts
  let rawDedBreakdown = currentData?.itemizedDeductionsBreakdown || [];
  if ((!rawDedBreakdown || rawDedBreakdown.length === 0) && client?.id) {
    try {
      const saved = localStorage.getItem(`bir_opex_breakdown_${client.id}_${currentYear}`);
      if (saved) rawDedBreakdown = JSON.parse(saved);
    } catch (e) {}
  }
  if ((!rawDedBreakdown || rawDedBreakdown.length === 0) && curr.deductions > 0) {
    rawDedBreakdown = [
      { id: 'opex_primary', accountName: 'Miscellaneous Operating Deductions', amount: curr.deductions },
    ];
  }

  const resolvedDedRows: ResolvedExpenseSubRow[] = (rawDedBreakdown || []).map((acc: any) => ({
    accountName: acc.accountName || 'Itemized Operating Expense',
    currAmount: acc.amount || 0,
    selPriorAmount: getHistoricalAccountAmount(
      selectedPriorYear,
      acc.accountName,
      'itemizedDeductionsBreakdown',
      selPrior.deductions,
      curr.deductions,
      acc.amount || 0,
      'opex'
    ),
    prev2Amount: getHistoricalAccountAmount(
      currentYear - 2,
      acc.accountName,
      'itemizedDeductionsBreakdown',
      metricsMap[currentYear - 2].deductions,
      curr.deductions,
      acc.amount || 0,
      'opex'
    ),
    baseAmount: getHistoricalAccountAmount(
      baseYear,
      acc.accountName,
      'itemizedDeductionsBreakdown',
      base.deductions,
      curr.deductions,
      acc.amount || 0,
      'opex'
    ),
  }));

  // Sub-row HTML renderer
  const renderSubRowsHtml = (rows: ResolvedExpenseSubRow[], rowBg = '#fbfcfe') => {
    if (!rows || rows.length === 0) return '';
    return rows
      .map((r) => {
        const itemVar = calcVar(r.currAmount, r.selPriorAmount);
        return `
          <tr style="border-bottom: 1px dashed #e2e8f0; background-color: ${rowBg}; font-size: 8px;">
            <td style="padding: 2.5px 8px 2.5px 32px; color: #475569; font-weight: 500;">
              <span style="color: #94a3b8; margin-right: 5px; font-weight: bold;">↳</span>${r.accountName}
            </td>
            <td style="padding: 2.5px 8px; text-align: right; font-family: monospace; color: #64748b;">
              (${formatPdfCurrency(r.baseAmount, true)})
            </td>
            <td style="padding: 2.5px 8px; text-align: right; font-family: monospace; color: #64748b;">
              (${formatPdfCurrency(r.prev2Amount, true)})
            </td>
            <td style="padding: 2.5px 8px; text-align: right; font-family: monospace; color: #475569; background-color: #f8fafc;">
              (${formatPdfCurrency(r.selPriorAmount, true)})
            </td>
            <td style="padding: 2.5px 8px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; background-color: #f0f9ff;">
              (${formatPdfCurrency(r.currAmount, true)})
            </td>
            <td style="padding: 2.5px 8px; text-align: right;">
              ${r.selPriorAmount > 0 ? formatDiffCol(itemVar.diff, true) : '<span style="color: #94a3b8; font-size: 8px;">—</span>'}
            </td>
            <td style="padding: 2.5px 8px; text-align: right;">
              ${r.selPriorAmount > 0 ? formatPctCol(itemVar.pct, true) : '<span style="color: #94a3b8; font-size: 8px;">—</span>'}
            </td>
          </tr>
        `;
      })
      .join('');
  };

  const cleanCompName = (client?.registeredName || client?.tradeName || 'Taxpayer')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  container.innerHTML = `
    <div id="pdf-variance-statement-page" style="width: 1120px; min-height: 792px; padding: 22px 30px; background-color: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Official BIR Comparative Header -->
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #475569;">
              ${is1701 ? 'Republic of the Philippines • Bureau of Internal Revenue • Form 1701 (Individuals & Sole Proprietors)' : 'Republic of the Philippines • Bureau of Internal Revenue • Form 1702-RT (Corporations)'}
            </div>
            <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 1px; letter-spacing: -0.01em;">
              ${client?.registeredName || client?.tradeName || (is1701 ? 'INDIVIDUAL TAXPAYER' : 'CORPORATE TAXPAYER')}
            </div>
            <div style="font-size: 10.5px; font-weight: 600; color: #1e40af; margin-top: 1px;">
              STATEMENT OF COMPREHENSIVE INCOME & MULTI-YEAR TAX VARIANCE ANALYSIS
            </div>
            <div style="font-size: 9px; color: #64748b; margin-top: 1px;">
              TIN: <strong style="color: #0f172a; font-family: monospace;">${client?.tin || '000-000-000-000'}</strong> • 
              RDO: <strong style="color: #0f172a;">${client?.rdo || '043'}</strong> • 
              Classification: <strong style="color: #0f172a;">${client?.classification || (is1701 ? 'Individual' : 'Corporation (Regular)')}</strong> • 
              Tax Regime: <strong style="color: #047857;">${is1701 ? ((currentData as Data1701Annual).taxRegime === '8_percent' ? '8% Flat Rate (TRAIN Act)' : 'Graduated Tax Rates (TRAIN / EOPT Act)') : ((currentData as Data1702Annual).rateOption === 'msme_20' ? 'MSME 20% (CREATE Act)' : 'Regular Corporate 25% (CREATE Act)')}</strong>
            </div>
          </div>
          <div style="text-align: right; background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px 14px;">
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.05em;">Current Taxable Year</div>
            <div style="font-size: 16px; font-weight: 900; color: #1e1b4b;">TY ${currentYear}</div>
            <div style="font-size: 8.5px; color: #475569;">Benchmark Period: TY ${baseYear} - TY ${currentYear}</div>
            <div style="font-size: 8.5px; color: #0284c7; font-weight: 600; margin-top: 1px;">Primary Focus: TY ${selectedPriorYear} vs. TY ${currentYear}</div>
          </div>
        </div>

        <!-- 4 Summary KPI Variance Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px;">
          <!-- Card 1: Net Sales -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748b;">TY ${currentYear} Net Sales</div>
            <div style="font-size: 13.5px; font-weight: 800; font-family: monospace; color: #0f172a; margin-top: 1px;">
              ${formatPdfCurrency(curr.netSales)}
            </div>
            <div style="font-size: 8.5px; color: #475569; margin-top: 2px; display: flex; justify-content: space-between;">
              <span>vs TY ${selectedPriorYear}:</span>
              <span>${formatDiffCol(netSalesVar.diff)} (${netSalesVar.pct >= 0 ? '+' : ''}${netSalesVar.pct.toFixed(1)}%)</span>
            </div>
          </div>

          <!-- Card 2: Gross Profit -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748b;">TY ${currentYear} Gross Profit</div>
            <div style="font-size: 13.5px; font-weight: 800; font-family: monospace; color: #1e3a8a; margin-top: 1px;">
              ${formatPdfCurrency(curr.grossProfit)}
            </div>
            <div style="font-size: 8.5px; color: #475569; margin-top: 2px; display: flex; justify-content: space-between;">
              <span>Margin: <strong>${curr.grossMarginPct.toFixed(1)}%</strong></span>
              <span>${formatDiffCol(gpVar.diff)} (${gpVar.pct >= 0 ? '+' : ''}${gpVar.pct.toFixed(1)}%)</span>
            </div>
          </div>

          <!-- Card 3: Net Taxable Income -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748b;">TY ${currentYear} Taxable Income</div>
            <div style="font-size: 13.5px; font-weight: 800; font-family: monospace; color: #0f172a; margin-top: 1px;">
              ${formatPdfCurrency(curr.netTaxableIncome)}
            </div>
            <div style="font-size: 8.5px; color: #475569; margin-top: 2px; display: flex; justify-content: space-between;">
              <span>vs TY ${selectedPriorYear}:</span>
              <span>${formatDiffCol(ntiVar.diff)} (${ntiVar.pct >= 0 ? '+' : ''}${ntiVar.pct.toFixed(1)}%)</span>
            </div>
          </div>

          <!-- Card 4: Corporate Tax Due -->
          <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 8px 10px;">
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #6b21a8;">TY ${currentYear} Tax Provision</div>
            <div style="font-size: 13.5px; font-weight: 900; font-family: monospace; color: #4c1d95; margin-top: 1px;">
              ${formatPdfCurrency(curr.taxDue)}
            </div>
            <div style="font-size: 8.5px; color: #581c87; margin-top: 2px; display: flex; justify-content: space-between;">
              <span>Effective: <strong>${curr.effectiveTaxRatePct.toFixed(1)}%</strong></span>
              <span>${taxVar.diff >= 0 ? '+' : ''}${formatPdfCurrency(taxVar.diff)} (${taxVar.pct >= 0 ? '+' : ''}${taxVar.pct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        <!-- Comprehensive Multi-Year Variance Matrix Table (Without CUM VAR and CUM %) -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.04em;">
                <th style="padding: 6px 10px; text-align: left; width: 32%;">Statement Account / Return Line Item</th>
                <th style="padding: 6px 8px; text-align: right; font-family: monospace; width: 11%;">TY ${baseYear}</th>
                <th style="padding: 6px 8px; text-align: right; font-family: monospace; width: 11%;">TY ${currentYear - 2}</th>
                <th style="padding: 6px 8px; text-align: right; font-family: monospace; width: 12%; background-color: #1e293b;">TY ${selectedPriorYear}</th>
                <th style="padding: 6px 8px; text-align: right; font-family: monospace; width: 14%; background-color: #1e3a8a; color: #eff6ff; font-weight: 800;">TY ${currentYear} (Current)</th>
                <th style="padding: 6px 8px; text-align: right; font-family: monospace; width: 12%; background-color: #0f172a;">YoY Var (₱)</th>
                <th style="padding: 6px 8px; text-align: right; font-family: monospace; width: 8%; background-color: #0f172a;">YoY %</th>
              </tr>
            </thead>
            <tbody>
              <!-- Gross Sales -->
              <tr style="border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
                <td style="padding: 4px 10px; font-weight: 700; color: #1e293b;">Gross Sales / Revenues / Receipts</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #475569;">${formatPdfCurrency(base.grossSales)}</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #475569;">${formatPdfCurrency(metricsMap[currentYear - 2].grossSales)}</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #1e293b; background-color: #f8fafc;">${formatPdfCurrency(selPrior.grossSales)}</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; background-color: #eff6ff;">${formatPdfCurrency(curr.grossSales)}</td>
                <td style="padding: 4px 8px; text-align: right;">${formatDiffCol(salesVar.diff)}</td>
                <td style="padding: 4px 8px; text-align: right;">${formatPctCol(salesVar.pct)}</td>
              </tr>

              <!-- Sales Returns -->
              <tr style="border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 8.5px;">
                <td style="padding: 3px 10px; padding-left: 18px;">Less: Sales Returns & Discounts</td>
                <td style="padding: 3px 8px; text-align: right; font-family: monospace;">(${formatPdfCurrency(base.salesReturns, false)})</td>
                <td style="padding: 3px 8px; text-align: right; font-family: monospace;">(${formatPdfCurrency(metricsMap[currentYear - 2].salesReturns, false)})</td>
                <td style="padding: 3px 8px; text-align: right; font-family: monospace; background-color: #f8fafc;">(${formatPdfCurrency(selPrior.salesReturns, false)})</td>
                <td style="padding: 3px 8px; text-align: right; font-family: monospace; background-color: #eff6ff;">(${formatPdfCurrency(curr.salesReturns, false)})</td>
                <td style="padding: 3px 8px; text-align: right; font-family: monospace; color: #94a3b8;">—</td>
                <td style="padding: 3px 8px; text-align: right; font-family: monospace; color: #94a3b8;">—</td>
              </tr>

              <!-- Net Sales -->
              <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 700;">
                <td style="padding: 4px 10px; color: #0f172a;">Net Sales / Revenues</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #334155;">${formatPdfCurrency(base.netSales)}</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #334155;">${formatPdfCurrency(metricsMap[currentYear - 2].netSales)}</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #0f172a; background-color: #f1f5f9;">${formatPdfCurrency(selPrior.netSales)}</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #1e3a8a; background-color: #e0f2fe;">${formatPdfCurrency(curr.netSales)}</td>
                <td style="padding: 4px 8px; text-align: right;">${formatDiffCol(netSalesVar.diff)}</td>
                <td style="padding: 4px 8px; text-align: right;">${formatPctCol(netSalesVar.pct)}</td>
              </tr>

              <!-- Cost of Goods Sold -->
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 10px; padding-left: 18px; color: #334155; font-weight: 600;">
                  Less: Cost of Goods Sold / Services
                  ${resolvedCogsRows.length > 0 ? `<span style="font-size: 7.5px; font-weight: 500; color: #64748b; margin-left: 4px;">(${resolvedCogsRows.length} itemized ${resolvedCogsRows.length === 1 ? 'account' : 'accounts'})</span>` : ''}
                </td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #475569;">(${formatPdfCurrency(base.costOfSales, false)})</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #475569;">(${formatPdfCurrency(metricsMap[currentYear - 2].costOfSales, false)})</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #334155; background-color: #f8fafc;">(${formatPdfCurrency(selPrior.costOfSales, false)})</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a; background-color: #eff6ff;">(${formatPdfCurrency(curr.costOfSales, false)})</td>
                <td style="padding: 4px 8px; text-align: right;">${formatDiffCol(costVar.diff, true)}</td>
                <td style="padding: 4px 8px; text-align: right;">${formatPctCol(costVar.pct, true)}</td>
              </tr>
              ${renderSubRowsHtml(resolvedCogsRows, '#f8fafc')}

              <!-- Gross Profit -->
              <tr style="border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; background-color: #f0fdf4; font-weight: 800;">
                <td style="padding: 5px 10px; color: #065f46;">Gross Profit (Operating Margin)</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #047857;">${formatPdfCurrency(base.grossProfit)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #047857;">${formatPdfCurrency(metricsMap[currentYear - 2].grossProfit)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #065f46; background-color: #dcfce7;">${formatPdfCurrency(selPrior.grossProfit)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #064e3b; background-color: #bbf7d0;">${formatPdfCurrency(curr.grossProfit)}</td>
                <td style="padding: 5px 8px; text-align: right;">${formatDiffCol(gpVar.diff)}</td>
                <td style="padding: 5px 8px; text-align: right;">${formatPctCol(gpVar.pct)}</td>
              </tr>

              <!-- Operating Deductions -->
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 10px; padding-left: 18px; color: #334155; font-weight: 600;">
                  Less: Allowable Deductions (Itemized / OSD)
                  ${resolvedDedRows.length > 0 ? `<span style="font-size: 7.5px; font-weight: 500; color: #64748b; margin-left: 4px;">(${resolvedDedRows.length} itemized ${resolvedDedRows.length === 1 ? 'account' : 'accounts'})</span>` : ''}
                </td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #475569;">(${formatPdfCurrency(base.deductions, false)})</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #475569;">(${formatPdfCurrency(metricsMap[currentYear - 2].deductions, false)})</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; color: #334155; background-color: #f8fafc;">(${formatPdfCurrency(selPrior.deductions, false)})</td>
                <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a; background-color: #eff6ff;">(${formatPdfCurrency(curr.deductions, false)})</td>
                <td style="padding: 4px 8px; text-align: right;">${formatDiffCol(dedVar.diff, true)}</td>
                <td style="padding: 4px 8px; text-align: right;">${formatPctCol(dedVar.pct, true)}</td>
              </tr>
              ${renderSubRowsHtml(resolvedDedRows, '#faf5ff')}

              <!-- Net Taxable Income -->
              <tr style="border-bottom: 1px solid #cbd5e1; background-color: #eff6ff; font-weight: 700;">
                <td style="padding: 5px 10px; color: #1e3a8a;">Net Taxable Income (Tax Base)</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #1e40af;">${formatPdfCurrency(base.netTaxableIncome)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #1e40af;">${formatPdfCurrency(metricsMap[currentYear - 2].netTaxableIncome)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #1e3a8a; background-color: #dbeafe;">${formatPdfCurrency(selPrior.netTaxableIncome)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #172554; background-color: #bfdbfe;">${formatPdfCurrency(curr.netTaxableIncome)}</td>
                <td style="padding: 5px 8px; text-align: right;">${formatDiffCol(ntiVar.diff)}</td>
                <td style="padding: 5px 8px; text-align: right;">${formatPctCol(ntiVar.pct)}</td>
              </tr>

              <!-- Tax Rate Row -->
              <tr style="border-bottom: 1px solid #f1f5f9; font-size: 8.5px; color: #64748b;">
                <td style="padding: 2.5px 10px; padding-left: 18px;">${is1701 ? 'Effective Individual Income Tax Rate' : 'Applicable Corporate Tax Rate'}</td>
                <td style="padding: 2.5px 8px; text-align: right; font-family: monospace;">${base.taxRatePercent.toFixed(1)}%</td>
                <td style="padding: 2.5px 8px; text-align: right; font-family: monospace;">${metricsMap[currentYear - 2].taxRatePercent.toFixed(1)}%</td>
                <td style="padding: 2.5px 8px; text-align: right; font-family: monospace; background-color: #f8fafc;">${selPrior.taxRatePercent.toFixed(1)}%</td>
                <td style="padding: 2.5px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #1e3a8a; background-color: #eff6ff;">${curr.taxRatePercent.toFixed(1)}%</td>
                <td style="padding: 2.5px 8px; text-align: right; font-family: monospace; color: #94a3b8;">—</td>
                <td style="padding: 2.5px 8px; text-align: right; font-family: monospace; color: #94a3b8;">—</td>
              </tr>

              <!-- Tax Due -->
              <tr style="border-bottom: 1px solid #cbd5e1; background-color: #faf5ff; font-weight: 800;">
                <td style="padding: 5px 10px; color: #581c87;">${is1701 ? 'Provision for Individual Income Tax Due' : 'Provision for Corporate Income Tax Due'}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #6b21a8;">${formatPdfCurrency(base.taxDue)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #6b21a8;">${formatPdfCurrency(metricsMap[currentYear - 2].taxDue)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #581c87; background-color: #f3e8ff;">${formatPdfCurrency(selPrior.taxDue)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #3b0764; background-color: #e9d5ff;">${formatPdfCurrency(curr.taxDue)}</td>
                <td style="padding: 5px 8px; text-align: right;">${formatDiffCol(taxVar.diff, true)}</td>
                <td style="padding: 5px 8px; text-align: right;">${formatPctCol(taxVar.pct, true)}</td>
              </tr>

              <!-- Net Income After Tax -->
              <tr style="border-bottom: 2px solid #0f172a; background-color: #f1f5f9; font-weight: 900;">
                <td style="padding: 5px 10px; color: #0f172a;">Net Income After Income Tax</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #0f172a;">${formatPdfCurrency(base.netIncomeAfterTax)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #0f172a;">${formatPdfCurrency(metricsMap[currentYear - 2].netIncomeAfterTax)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; color: #0f172a; background-color: #e2e8f0;">${formatPdfCurrency(selPrior.netIncomeAfterTax)}</td>
                <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #1e3a8a; background-color: #bae6fd;">${formatPdfCurrency(curr.netIncomeAfterTax)}</td>
                <td style="padding: 5px 8px; text-align: right;">${formatDiffCol(netIncVar.diff)}</td>
                <td style="padding: 5px 8px; text-align: right;">${formatPctCol(netIncVar.pct)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Key Ratios & Statutory Disclosure Box -->
        <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 12px; margin-bottom: 10px;">
          <!-- Financial & Tax Ratios Schedule -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px;">
            <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 4px;">
              Key Financial & Tax Operating Ratios Comparison
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
              <thead>
                <tr style="border-bottom: 1px solid #cbd5e1; color: #64748b;">
                  <th style="text-align: left; padding: 2px 0;">Financial Indicator</th>
                  <th style="text-align: right; padding: 2px 4px;">TY ${baseYear}</th>
                  <th style="text-align: right; padding: 2px 4px;">TY ${currentYear - 2}</th>
                  <th style="text-align: right; padding: 2px 4px;">TY ${selectedPriorYear}</th>
                  <th style="text-align: right; padding: 2px 4px; font-weight: 800; color: #1e3a8a;">TY ${currentYear}</th>
                  <th style="text-align: right; padding: 2px 0;">YoY Spread</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 2.5px 0; color: #1e293b; font-weight: 600;">Gross Profit Margin</td>
                  <td style="text-align: right; font-family: monospace;">${base.grossMarginPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace;">${metricsMap[currentYear - 2].grossMarginPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace;">${selPrior.grossMarginPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 700; color: #047857;">${curr.grossMarginPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 600;">${(curr.grossMarginPct - selPrior.grossMarginPct) >= 0 ? '+' : ''}${(curr.grossMarginPct - selPrior.grossMarginPct).toFixed(1)}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 2.5px 0; color: #1e293b; font-weight: 600;">Operating Expense Ratio</td>
                  <td style="text-align: right; font-family: monospace;">${base.opExpenseRatioPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace;">${metricsMap[currentYear - 2].opExpenseRatioPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace;">${selPrior.opExpenseRatioPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 700; color: #1e293b;">${curr.opExpenseRatioPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 600;">${(curr.opExpenseRatioPct - selPrior.opExpenseRatioPct) >= 0 ? '+' : ''}${(curr.opExpenseRatioPct - selPrior.opExpenseRatioPct).toFixed(1)}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 2.5px 0; color: #1e293b; font-weight: 600;">Effective Corporate Tax Rate</td>
                  <td style="text-align: right; font-family: monospace;">${base.effectiveTaxRatePct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace;">${metricsMap[currentYear - 2].effectiveTaxRatePct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace;">${selPrior.effectiveTaxRatePct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 700; color: #6b21a8;">${curr.effectiveTaxRatePct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 600;">${(curr.effectiveTaxRatePct - selPrior.effectiveTaxRatePct) >= 0 ? '+' : ''}${(curr.effectiveTaxRatePct - selPrior.effectiveTaxRatePct).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 0; color: #1e293b; font-weight: 600;">Net Profit Margin (After Tax)</td>
                  <td style="text-align: right; font-family: monospace;">${base.netMarginPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace;">${metricsMap[currentYear - 2].netMarginPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace;">${selPrior.netMarginPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 700; color: #0284c7;">${curr.netMarginPct.toFixed(1)}%</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 600;">${(curr.netMarginPct - selPrior.netMarginPct) >= 0 ? '+' : ''}${(curr.netMarginPct - selPrior.netMarginPct).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Statutory & Notes Box -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 8px; color: #475569; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-weight: 800; text-transform: uppercase; color: #1e293b; margin-bottom: 2px;">
                Statutory Regulatory References & Notes
              </div>
              <ul style="margin: 0; padding-left: 14px; line-height: 1.4;">
                <li>${is1701 ? 'Governed by National Internal Revenue Code (NIRC) Sec. 24(A) as amended by TRAIN Act (RA 10963) & EOPT Act (RA 11976).' : 'Governed by National Internal Revenue Code (NIRC) Sec. 27(A) as amended by CREATE Act (RA 11534).'}</li>
                <li>Deduction Method: <strong>${currentData.deductionMethod === 'osd' ? 'Optional Standard Deduction (40%)' : 'Ordinary Allowable Itemized Deductions (NIRC Sec. 34)'}</strong>.</li>
                <li>Ease of Paying Taxes (eOPT) Act (RA 11976) compliance applies to filing periods and classification thresholds.</li>
                <li>Amounts derived from taxpayer books and annual income tax return (${is1701 ? 'BIR Form 1701' : 'BIR Form 1702-RT'}).</li>
              </ul>
            </div>
            <div style="font-style: italic; color: #64748b; margin-top: 4px;">
              * Confidential comparative audit working paper for internal review and BIR tax filing records.
            </div>
          </div>
        </div>
      </div>

      <!-- Footer & Signatures Block -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 8.5px; color: #64748b; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div><strong>BIR Tax Return Calculator & Variance Engine</strong> • Republic Act No. 11976 (eOPT Act) & RA 11534 (CREATE Act)</div>
          <div>Report Generated: ${reportDate} • Document Reference: ${is1701 ? `BIR-1701-VAR-${currentYear}` : `BIR-1702RT-VAR-${currentYear}`}</div>
        </div>
        <div style="display: flex; gap: 36px; text-align: center;">
          <div>
            <div style="width: 150px; border-bottom: 1px solid #94a3b8; margin-bottom: 3px;"></div>
            <div style="font-weight: 700; color: #0f172a;">${client?.registeredName ? 'Authorized Signatory' : 'Taxpayer / Finance Head'}</div>
            <div style="font-size: 7.5px; color: #64748b;">Prepared By / Taxpayer</div>
          </div>
          <div>
            <div style="width: 150px; border-bottom: 1px solid #94a3b8; margin-bottom: 3px;"></div>
            <div style="font-weight: 700; color: #0f172a;">Certified Public Accountant</div>
            <div style="font-size: 7.5px; color: #64748b;">Certified Correct (Auditor / Tax Agent)</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const pageEl = container.querySelector('#pdf-variance-statement-page') as HTMLElement;
    if (!pageEl) {
      throw new Error('Failed to locate PDF variance statement container element');
    }

    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdfWidth = 297;
    const computedHeight = (canvas.height * pdfWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: computedHeight > 210 ? [pdfWidth, computedHeight] : 'a4',
      compress: true,
    });

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.max(210, computedHeight), undefined, 'FAST');

    pdf.save(`${is1701 ? 'BIR_1701' : 'BIR_1702'}_Comparative_Variance_${cleanCompName}_TY${currentYear}.pdf`);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

// -----------------------------------------------------------------------------
// Official BIR Consolidated Purchases (Q1–Q4) Schedule PDF Export
// -----------------------------------------------------------------------------
export interface ConsolidatedPurchasesPdfOptions {
  client: ClientProfile;
  year: number;
  suppliers: Array<{
    registeredName: string;
    tin: string;
    address?: string;
    totalGrossAmount: number;
    totalTaxableAmount: number;
    totalInputTax: number;
    costType?: 'direct_cost' | 'operating_expense' | 'unclassified';
    expenseAccount?: string;
    quarterlyBreakdown?: {
      Q1: { gross: number; taxable: number; inputTax: number; count: number };
      Q2: { gross: number; taxable: number; inputTax: number; count: number };
      Q3: { gross: number; taxable: number; inputTax: number; count: number };
      Q4: { gross: number; taxable: number; inputTax: number; count: number };
    };
  }>;
  classificationTotals: {
    directCostGross: number;
    directCostTaxable: number;
    opexGross: number;
    opexTaxable: number;
    unclassifiedGross: number;
  };
  overallTotals: {
    totalGrossAmount: number;
    totalTaxableAmount: number;
    totalInputTax: number;
  };
}

export async function exportConsolidatedPurchasesPdf(options: ConsolidatedPurchasesPdfOptions): Promise<void> {
  const { client, year, suppliers, classificationTotals, overallTotals } = options;

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1180px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-1000';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const cleanCompName = (client?.registeredName || client?.tradeName || 'Taxpayer')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const supplierRowsHtml = suppliers.length === 0
    ? `<tr><td colspan="10" style="padding: 16px; text-align: center; color: #64748b; font-style: italic;">No consolidated purchases recorded for TY ${year}.</td></tr>`
    : suppliers
        .map((s, idx) => {
          const isDirect = s.costType === 'direct_cost';
          const isOpex = s.costType === 'operating_expense';
          const badgeBg = isDirect ? '#eff6ff' : isOpex ? '#faf5ff' : '#f1f5f9';
          const badgeColor = isDirect ? '#1e40af' : isOpex ? '#6b21a8' : '#475569';
          const badgeLabel = isDirect ? 'Direct Cost' : isOpex ? 'Operating Exp' : 'Unclassified';

          const q1 = s.quarterlyBreakdown?.Q1?.gross || 0;
          const q2 = s.quarterlyBreakdown?.Q2?.gross || 0;
          const q3 = s.quarterlyBreakdown?.Q3?.gross || 0;
          const q4 = s.quarterlyBreakdown?.Q4?.gross || 0;

          return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8.5px; ${idx % 2 === 1 ? 'background-color: #fafbfc;' : ''}">
              <td style="padding: 4px 6px; text-align: center; color: #94a3b8; font-family: monospace;">${idx + 1}</td>
              <td style="padding: 4px 8px; font-weight: 600; color: #0f172a;">
                <div>${s.registeredName}</div>
                <div style="font-size: 7.5px; font-family: monospace; color: #64748b;">TIN: ${s.tin || 'N/A'}</div>
              </td>
              <td style="padding: 4px 6px; text-align: center;">
                <span style="display: inline-block; padding: 1.5px 5px; border-radius: 4px; font-size: 8px; font-weight: 700; background-color: ${badgeBg}; color: ${badgeColor};">
                  ${badgeLabel}
                </span>
              </td>
              <td style="padding: 4px 8px; color: #334155; font-size: 8px;">
                ${s.expenseAccount || '<span style="color: #94a3b8;">Unspecified</span>'}
              </td>
              <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: #475569;">${formatPdfCurrency(q1, true)}</td>
              <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: #475569;">${formatPdfCurrency(q2, true)}</td>
              <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: #475569;">${formatPdfCurrency(q3, true)}</td>
              <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: #475569;">${formatPdfCurrency(q4, true)}</td>
              <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 600; color: #0f172a; background-color: #f8fafc;">
                ${formatPdfCurrency(s.totalTaxableAmount)}
              </td>
              <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 600; color: #047857; background-color: #f0fdf4;">
                ${formatPdfCurrency(s.totalInputTax)}
              </td>
              <td style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #1e3a8a; background-color: #eff6ff;">
                ${formatPdfCurrency(s.totalGrossAmount)}
              </td>
            </tr>
          `;
        })
        .join('');

  container.innerHTML = `
    <div id="pdf-consolidated-purchases-page" style="width: 1180px; min-height: 800px; padding: 22px 30px; background-color: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- BIR Header -->
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #1e40af;">
              REPUBLIC OF THE PHILIPPINES • BUREAU OF INTERNAL REVENUE
            </div>
            <div style="font-size: 15px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px; margin: 1px 0;">
              ANNUAL CONSOLIDATED PURCHASES & SUPPLIER SCHEDULE (Q1–Q4)
            </div>
            <div style="font-size: 9.5px; color: #475569;">
              Combined Quarterly Summary of Local Purchases, Expense Classifications & Input Taxes
            </div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; padding: 3px 9px; background-color: #0f172a; color: #ffffff; font-size: 11px; font-weight: 900; border-radius: 4px; font-family: monospace;">
              TAXABLE YEAR ${year}
            </div>
            <div style="font-size: 8.5px; color: #64748b; margin-top: 3px;">
              Form 1701 / 1702-RT Deduction Schedule
            </div>
          </div>
        </div>

        <!-- Taxpayer Identity Strip -->
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; margin-bottom: 12px; display: grid; grid-template-columns: 2fr 1.2fr 1.2fr 1fr; gap: 8px; font-size: 9px;">
          <div>
            <div style="font-size: 7.5px; text-transform: uppercase; font-weight: 700; color: #64748b;">Taxpayer Registered Name</div>
            <div style="font-weight: 800; color: #0f172a; font-size: 10px;">${client.registeredName || 'N/A'}</div>
          </div>
          <div>
            <div style="font-size: 7.5px; text-transform: uppercase; font-weight: 700; color: #64748b;">Taxpayer Identification No. (TIN)</div>
            <div style="font-family: monospace; font-weight: 800; color: #1e3a8a;">${client.tin}</div>
          </div>
          <div>
            <div style="font-size: 7.5px; text-transform: uppercase; font-weight: 700; color: #64748b;">Tax Classification / VAT Status</div>
            <div style="font-weight: 700; color: #047857;">VAT-Registered Taxpayer • 12% Input Tax</div>
          </div>
          <div>
            <div style="font-size: 7.5px; text-transform: uppercase; font-weight: 700; color: #64748b;">Total Suppliers</div>
            <div style="font-weight: 800; color: #0f172a;">${suppliers.length} Combined Entity(ies)</div>
          </div>
        </div>

        <!-- 4 KPI Summary Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 7px 10px;">
            <div style="font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #1e40af;">Total Combined Gross Purchases</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #172554; margin: 2px 0;">
              ${formatPdfCurrency(overallTotals.totalGrossAmount)}
            </div>
            <div style="font-size: 7.5px; color: #3b82f6;">All invoices across Q1–Q4 combined</div>
          </div>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 7px 10px;">
            <div style="font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #15803d;">Direct Cost / COGS (Net of VAT)</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #14532d; margin: 2px 0;">
              ${formatPdfCurrency(classificationTotals.directCostTaxable)}
            </div>
            <div style="font-size: 7.5px; color: #16a34a;">Reflected in Part II Cost of Sales</div>
          </div>

          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 7px 10px;">
            <div style="font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #7e22ce;">Operating Expenses (Net of VAT)</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #581c87; margin: 2px 0;">
              ${formatPdfCurrency(classificationTotals.opexTaxable)}
            </div>
            <div style="font-size: 7.5px; color: #9333ea;">Reflected in Part II Itemized Deductions</div>
          </div>

          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 7px 10px;">
            <div style="font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #047857;">Total Creditable Input Tax (12%)</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #064e3b; margin: 2px 0;">
              ${formatPdfCurrency(overallTotals.totalInputTax)}
            </div>
            <div style="font-size: 7.5px; color: #059669;">Claimable on Quarterly 2550Q Returns</div>
          </div>
        </div>

        <!-- Consolidated Table -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff; font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px;">
                <th style="padding: 5px 6px; text-align: center; width: 28px;">#</th>
                <th style="padding: 5px 8px; text-align: left;">Supplier Registered Name & TIN</th>
                <th style="padding: 5px 6px; text-align: center; width: 85px;">Classification</th>
                <th style="padding: 5px 8px; text-align: left; width: 140px;">Expense Account</th>
                <th style="padding: 5px 6px; text-align: right; width: 68px;">Q1 Gross</th>
                <th style="padding: 5px 6px; text-align: right; width: 68px;">Q2 Gross</th>
                <th style="padding: 5px 6px; text-align: right; width: 68px;">Q3 Gross</th>
                <th style="padding: 5px 6px; text-align: right; width: 68px;">Q4 Gross</th>
                <th style="padding: 5px 8px; text-align: right; width: 85px; background-color: #1e293b;">Net Taxable</th>
                <th style="padding: 5px 8px; text-align: right; width: 80px; background-color: #064e3b;">Input VAT (12%)</th>
                <th style="padding: 5px 8px; text-align: right; width: 90px; background-color: #1e3a8a;">Total Gross</th>
              </tr>
            </thead>
            <tbody>
              ${supplierRowsHtml}

              <!-- Overall Totals Row -->
              <tr style="border-top: 2px solid #0f172a; background-color: #f1f5f9; font-weight: 900; font-size: 9px;">
                <td style="padding: 6px 6px; text-align: center;">Σ</td>
                <td style="padding: 6px 8px; color: #0f172a;">GRAND TOTALS (Q1–Q4 CONSOLIDATED)</td>
                <td style="padding: 6px 6px; text-align: center; color: #475569;">${suppliers.length} Suppliers</td>
                <td style="padding: 6px 8px; color: #64748b;">Annual Purchases Schedule</td>
                <td style="padding: 6px 6px; text-align: right; font-family: monospace;">—</td>
                <td style="padding: 6px 6px; text-align: right; font-family: monospace;">—</td>
                <td style="padding: 6px 6px; text-align: right; font-family: monospace;">—</td>
                <td style="padding: 6px 6px; text-align: right; font-family: monospace;">—</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #0f172a; background-color: #e2e8f0;">
                  ${formatPdfCurrency(overallTotals.totalTaxableAmount)}
                </td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #065f46; background-color: #bbf7d0;">
                  ${formatPdfCurrency(overallTotals.totalInputTax)}
                </td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #1e3a8a; background-color: #bae6fd;">
                  ${formatPdfCurrency(overallTotals.totalGrossAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Statutory Footnote -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 8px; color: #475569; margin-bottom: 10px;">
          <div><strong>BIR Compliance & Audit Note:</strong> In Philippine tax practice, input VAT credited on quarterly VAT returns (BIR Form 2550Q) is excluded from annual deductible income tax expenses. The Net Taxable amounts above represent allowable deductions for Cost of Goods Sold/Services (NIRC Sec. 34/27) and Ordinary Allowable Itemized Deductions. All transactions are supported by official VAT invoices/receipts compliant with the Ease of Paying Taxes (eOPT) Act (RA 11976).</div>
        </div>
      </div>

      <!-- Signatures Footer -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 8.5px; color: #64748b; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div><strong>BIR Tax Return Calculator & Consolidated Purchases Schedule</strong> • RA 11976 (eOPT Act)</div>
          <div>Report Generated: ${reportDate} • Document Reference: BIR-PURCHASES-TY${year}-${cleanCompName}</div>
        </div>
        <div style="display: flex; gap: 36px; text-align: center;">
          <div>
            <div style="width: 150px; border-bottom: 1px solid #94a3b8; margin-bottom: 3px;"></div>
            <div style="font-weight: 700; color: #0f172a;">${client.registeredName ? 'Authorized Signatory' : 'Taxpayer / Finance Head'}</div>
            <div style="font-size: 7.5px; color: #64748b;">Prepared By / Taxpayer</div>
          </div>
          <div>
            <div style="width: 150px; border-bottom: 1px solid #94a3b8; margin-bottom: 3px;"></div>
            <div style="font-weight: 700; color: #0f172a;">Certified Public Accountant</div>
            <div style="font-size: 7.5px; color: #64748b;">Certified Correct (Auditor / Tax Agent)</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const pageEl = container.querySelector('#pdf-consolidated-purchases-page') as HTMLElement;
    if (!pageEl) {
      throw new Error('Failed to locate PDF consolidated purchases container element');
    }

    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdfWidth = 297;
    const computedHeight = (canvas.height * pdfWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: computedHeight > 210 ? [pdfWidth, computedHeight] : 'a4',
      compress: true,
    });

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.max(210, computedHeight), undefined, 'FAST');

    pdf.save(`BIR_Consolidated_Purchases_${cleanCompName}_TY${year}.pdf`);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}


