import React from 'react';
import {
  ClientProfile,
  Data1701Q,
  Data1702Q,
  Data2550Q,
  Data2551Q,
  Data1601C,
  Data1601EQ,
  Quarter,
} from '../types/tax';
import {
  calculate1701Q,
  calculate1702Q,
  calculate2550Q,
  calculate2551Q,
  calculate1601C,
  calculate1601EQ,
} from '../utils/taxCalculations';
import { formatPHP } from '../utils/formatters';
import {
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  AlertCircle,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';

interface FilingSummaryViewProps {
  client: ClientProfile;
  quarter: Quarter;
  month: number;
  year: number;
  data1701Q?: Data1701Q;
  data1702Q?: Data1702Q;
  data2550Q?: Data2550Q;
  data2551Q?: Data2551Q;
  data1601C?: Data1601C;
  data1601EQ?: Data1601EQ;
  onOpenCalendar?: () => void;
  onNavigateToTab?: (tab: '1701Q' | '1702Q' | '2550Q' | '2551Q' | '1601C' | '1601EQ') => void;
  submittedStatusMap?: Record<string, boolean>;
  onToggleSubmission?: (key: string) => void;
}

export interface RequiredBirFormItem {
  idKey: string;
  tabKey: '1701Q' | '1702Q' | '2550Q' | '2551Q' | '1601C' | '1601EQ';
  formCode: string;
  formName: string;
  description: string;
  filingPeriodStatus: string;
  dueDate: string;
  netPayable: number;
  taxBase: number;
  taxDue: number;
  credits: number;
  isSubmitted: boolean;
}

export interface LockedBirFormItem {
  formCode: string;
  formName: string;
  reason: string;
  lockedInTab: boolean;
}

/**
 * Calculates human-readable statutory due date for a specific BIR form based on eOPT Act (RA 11976).
 */
export function getFormStatutoryDueDate(
  form: '1701Q' | '1702Q' | '2550Q' | '2551Q' | '1601C' | '1601EQ',
  quarter: Quarter,
  month: number,
  year: number
): string {
  switch (form) {
    case '1701Q':
      // Individual quarterly income tax: May 15 (Q1), Aug 15 (Q2), Nov 15 (Q3)
      if (quarter === 'Q1') return `May 15, ${year}`;
      if (quarter === 'Q2') return `August 15, ${year}`;
      if (quarter === 'Q3') return `November 15, ${year}`;
      return `April 15, ${year + 1} (Annual Form 1701)`;

    case '1702Q':
      // Corporate quarterly income tax: 60 days after quarter close
      if (quarter === 'Q1') return `May 30, ${year}`;
      if (quarter === 'Q2') return `August 29, ${year}`;
      if (quarter === 'Q3') return `November 29, ${year}`;
      return `April 15, ${year + 1} (Annual Form 1702-RT)`;

    case '2550Q':
      // Quarterly VAT: 25th of month following quarter close
      if (quarter === 'Q1') return `April 25, ${year}`;
      if (quarter === 'Q2') return `July 25, ${year}`;
      if (quarter === 'Q3') return `October 25, ${year}`;
      return `January 25, ${year + 1}`;

    case '2551Q':
      // Quarterly Percentage Tax: 25th of month following quarter close
      if (quarter === 'Q1') return `April 25, ${year}`;
      if (quarter === 'Q2') return `July 25, ${year}`;
      if (quarter === 'Q3') return `October 25, ${year}`;
      return `January 25, ${year + 1}`;

    case '1601C': {
      // 10th day of the following month
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      return `${monthNames[nextMonth - 1]} 10, ${nextYear}`;
    }

    case '1601EQ': {
      // 1601-EQ is due last day of month following quarter close
      if (quarter === 'Q1') return `April 30, ${year}`;
      if (quarter === 'Q2') return `July 31, ${year}`;
      if (quarter === 'Q3') return `October 31, ${year}`;
      return `January 31, ${year + 1}`;
    }
  }
}

export const FilingSummaryView: React.FC<FilingSummaryViewProps> = ({
  client,
  quarter,
  month,
  year,
  data1701Q,
  data1702Q,
  data2550Q,
  data2551Q,
  data1601C,
  data1601EQ,
  onOpenCalendar,
  onNavigateToTab,
  submittedStatusMap = {},
  onToggleSubmission,
}) => {
  const isCorpOrPartnership =
    client.classification === 'Corporation' ||
    client.classification === 'Non-Stock' ||
    client.classification === 'Partnership';
  const isSingle = client.classification === 'Single';
  const isVat = client.vatStatus === 'vat-registered';
  const isWithholding = client.isWithholdingAgent;

  // Form Calculations
  const res1701Q = data1701Q ? calculate1701Q(data1701Q) : null;
  const res1702Q = data1702Q ? calculate1702Q(data1702Q) : null;
  const res2550Q = data2550Q ? calculate2550Q(data2550Q) : null;
  const res2551Q = data2551Q ? calculate2551Q(data2551Q) : null;
  const res1601C = data1601C ? calculate1601C(data1601C) : null;
  const res1601EQ = data1601EQ ? calculate1601EQ(data1601EQ) : null;

  // Month Names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const currentMonthLabel = monthNames[month - 1];

  // 1. List of BIR Forms NEEDED to Submit of the Client
  const requiredForms: RequiredBirFormItem[] = [];

  // Income Tax: 1701Q (Single) vs 1702Q (Corporation / Non-Stock / Partnership)
  if (isSingle) {
    const idKey = `${client.id}_${year}_${quarter}_1701Q`;
    requiredForms.push({
      idKey,
      tabKey: '1701Q',
      formCode: 'BIR Form 1701Q',
      formName: 'Quarterly Income Tax Return for Individuals',
      description: `Individual Income Tax (${data1701Q?.taxRegime === '8_percent' ? '8% Flat Rate' : 'Graduated Rates'})`,
      filingPeriodStatus: `${quarter} ${year} (Quarterly)`,
      dueDate: getFormStatutoryDueDate('1701Q', quarter, month, year),
      netPayable: res1701Q ? Math.max(0, res1701Q.netTaxPayable) : 0,
      taxBase: res1701Q?.netTaxableIncome || 0,
      taxDue: res1701Q?.taxDue || 0,
      credits: res1701Q?.totalTaxCredits || 0,
      isSubmitted: !!submittedStatusMap[idKey],
    });
  } else if (isCorpOrPartnership) {
    const idKey = `${client.id}_${year}_${quarter}_1702Q`;
    requiredForms.push({
      idKey,
      tabKey: '1702Q',
      formCode: 'BIR Form 1702Q',
      formName: 'Quarterly Income Tax Return for Corporations and Partnerships',
      description: `Corporate Income Tax (${res1702Q?.appliedTaxType || 'Regular Rate'})`,
      filingPeriodStatus: `${quarter} ${year} (Quarterly)`,
      dueDate: getFormStatutoryDueDate('1702Q', quarter, month, year),
      netPayable: res1702Q ? Math.max(0, res1702Q.netTaxPayable) : 0,
      taxBase: res1702Q?.netTaxableIncome || 0,
      taxDue: res1702Q?.taxDue || 0,
      credits: res1702Q?.totalTaxCredits || 0,
      isSubmitted: !!submittedStatusMap[idKey],
    });
  }

  // Business Tax: 2550Q (VAT) vs 2551Q (Percentage Tax Non-VAT)
  if (isVat) {
    const idKey = `${client.id}_${year}_${quarter}_2550Q`;
    requiredForms.push({
      idKey,
      tabKey: '2550Q',
      formCode: 'BIR Form 2550Q',
      formName: 'Quarterly Value-Added Tax Return',
      description: '12% Value-Added Tax (Output VAT less Input VAT & Credits)',
      filingPeriodStatus: `${quarter} ${year} (Quarterly)`,
      dueDate: getFormStatutoryDueDate('2550Q', quarter, month, year),
      netPayable: res2550Q ? Math.max(0, res2550Q.netVatPayable) : 0,
      taxBase: res2550Q?.vatableSales || 0,
      taxDue: res2550Q?.outputTax || 0,
      credits: (res2550Q?.totalAvailableInputTax || 0) + (res2550Q?.totalTaxCredits || 0),
      isSubmitted: !!submittedStatusMap[idKey],
    });
  } else {
    const idKey = `${client.id}_${year}_${quarter}_2551Q`;
    requiredForms.push({
      idKey,
      tabKey: '2551Q',
      formCode: 'BIR Form 2551Q',
      formName: 'Quarterly Percentage Tax Return',
      description: `Non-VAT Percentage Tax (${res2551Q?.taxRatePercent || 3}%)`,
      filingPeriodStatus: `${quarter} ${year} (Quarterly)`,
      dueDate: getFormStatutoryDueDate('2551Q', quarter, month, year),
      netPayable: res2551Q ? Math.max(0, res2551Q.netPercentageTaxPayable) : 0,
      taxBase: res2551Q?.taxableSales || 0,
      taxDue: res2551Q?.taxDue || 0,
      credits: res2551Q?.totalTaxCredits || 0,
      isSubmitted: !!submittedStatusMap[idKey],
    });
  }

  // Withholding Taxes: 1601-C and 0619-E / 1601-EQ (only if isWithholdingAgent)
  if (isWithholding) {
    const idKey1601C = `${client.id}_${year}_M${month}_1601C`;
    requiredForms.push({
      idKey: idKey1601C,
      tabKey: '1601C',
      formCode: 'BIR Form 1601-C',
      formName: 'Monthly Remittance Return of Income Taxes Withheld on Compensation',
      description: 'Payroll Withholding Tax on Compensation',
      filingPeriodStatus: `Month ${month} (${currentMonthLabel} ${year})`,
      dueDate: getFormStatutoryDueDate('1601C', quarter, month, year),
      netPayable: res1601C ? Math.max(0, res1601C.netTaxRemitted) : 0,
      taxBase: res1601C?.taxableCompensation || 0,
      taxDue: res1601C?.taxRequiredWithheld || 0,
      credits: res1601C?.priorRemittance || 0,
      isSubmitted: !!submittedStatusMap[idKey1601C],
    });

    const isMonthlyEwt = data1601EQ?.isMonthly ?? false;
    const idKey1601EQ = isMonthlyEwt
      ? `${client.id}_${year}_M${month}_0619E`
      : `${client.id}_${year}_${quarter}_1601EQ`;
    requiredForms.push({
      idKey: idKey1601EQ,
      tabKey: '1601EQ',
      formCode: isMonthlyEwt ? 'BIR Form 0619-E' : 'BIR Form 1601-EQ',
      formName: isMonthlyEwt
        ? 'Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded)'
        : 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)',
      description: isMonthlyEwt ? 'Monthly Expanded Withholding Tax (EWT)' : 'Quarterly Expanded Withholding Tax (EWT)',
      filingPeriodStatus: isMonthlyEwt ? `Month ${month} (${currentMonthLabel} ${year})` : `${quarter} ${year} (Quarterly)`,
      dueDate: getFormStatutoryDueDate('1601EQ', quarter, month, year),
      netPayable: res1601EQ ? Math.max(0, res1601EQ.netAmountPayable) : 0,
      taxBase: res1601EQ?.totalTaxBase || 0,
      taxDue: res1601EQ?.totalTaxWithheld || 0,
      credits: (res1601EQ?.priorMonthTaxRemitted || 0) + (res1601EQ?.overpaymentPreviousPeriod || 0),
      isSubmitted: !!submittedStatusMap[idKey1601EQ],
    });
  }

  // 2. List of BIR Forms NOT NEEDED / LOCKED for this Client
  const lockedForms: LockedBirFormItem[] = [];

  if (isSingle) {
    lockedForms.push({
      formCode: 'BIR Form 1702Q',
      formName: 'Corporate Quarterly Income Tax',
      reason: `Client is registered as "${client.classification}" (Individual). Files Form 1701Q instead.`,
      lockedInTab: true,
    });
  } else {
    lockedForms.push({
      formCode: 'BIR Form 1701Q',
      formName: 'Individual Quarterly Income Tax',
      reason: `Client is registered as "${client.classification}" (Juridical Entity). Files Form 1702Q instead.`,
      lockedInTab: true,
    });
  }

  if (isVat) {
    lockedForms.push({
      formCode: 'BIR Form 2551Q',
      formName: 'Quarterly Percentage Tax (Non-VAT)',
      reason: 'Client is registered as VAT-Registered (12%). Files Form 2550Q instead.',
      lockedInTab: true,
    });
  } else {
    lockedForms.push({
      formCode: 'BIR Form 2550Q',
      formName: 'Quarterly Value-Added Tax (VAT)',
      reason: 'Client is registered as Non-VAT. Files Form 2551Q (3% Percentage Tax) instead.',
      lockedInTab: true,
    });
  }

  if (!isWithholding) {
    lockedForms.push({
      formCode: 'BIR Form 1601-C',
      formName: 'Withholding Tax on Compensation',
      reason: 'Client profile has withholding agent status turned off (no compensation withholding obligations).',
      lockedInTab: true,
    });
    lockedForms.push({
      formCode: 'BIR Form 0619-E / 1601-EQ',
      formName: 'Expanded Withholding Tax (EWT)',
      reason: 'Client profile has withholding agent status turned off (no expanded withholding obligations).',
      lockedInTab: true,
    });
  }

  const totalPayableAllForms = requiredForms.reduce((sum, f) => sum + f.netPayable, 0);
  const totalSubmittedCount = requiredForms.filter((f) => f.isSubmitted).length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-indigo-500 text-white rounded">
              Client Filing Schedule
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {quarter} {year} • Month {month} ({currentMonthLabel})
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1">{client.registeredName}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenCalendar && (
            <button
              id="summary-open-calendar-btn"
              onClick={onOpenCalendar}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-xs transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Tax Deadlines Calendar</span>
            </button>
          )}

          <button
            id="print-summary-btn"
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium bg-white text-slate-900 hover:bg-slate-100 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span>Print / Save Schedule</span>
          </button>
        </div>
      </div>

      {/* Main Document Card */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs space-y-6">
        {/* Document Header */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                  Required BIR Forms
                </span>
                <span className="text-xs font-medium text-slate-500">
                  eOPT Law (RA 11976)
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1.5">
                List of BIR Forms Needed to Submit of the Client
              </h1>
              <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono">
                <span>Taxpayer: <strong className="text-slate-900 font-sans">{client.registeredName}</strong></span>
                <span>TIN: {client.tin}</span>
                <span>RDO: {client.rdo}</span>
                <span>Classification: <strong className="text-slate-900 font-sans">{client.classification}</strong></span>
                <span>Registration: <strong className="text-slate-900 font-sans">{client.vatStatus === 'vat-registered' ? 'VAT-Registered' : 'Non-VAT'}</strong></span>
              </div>
            </div>

            <div className="sm:text-right bg-slate-50 p-3 rounded-lg border border-slate-200 shrink-0">
              <div className="text-xs text-slate-500 font-mono">Filing Progress</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {totalSubmittedCount} of {requiredForms.length} Submitted
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {totalSubmittedCount === requiredForms.length ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1 justify-end">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All Returns Filed
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">
                    {requiredForms.length - totalSubmittedCount} Pending Filing
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Table: List of BIR Forms Needed to Submit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              <span>Mandatory Returns for {client.tradeName} ({quarter} {year})</span>
            </h3>
            <span className="text-xs text-slate-500 print:hidden">
              Click submission badge to toggle status
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">BIR Form</th>
                  <th className="py-3 px-4">Tax Description</th>
                  <th className="py-3 px-4">Status on Quarter / Month Needed to File</th>
                  <th className="py-3 px-4">Statutory Due Date</th>
                  <th className="py-3 px-4 text-right">Net Tax Due (PHP)</th>
                  <th className="py-3 px-4 text-center">Submission Status</th>
                  <th className="py-3 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {requiredForms.map((item) => (
                  <tr key={item.idKey} className="hover:bg-slate-50/70 transition-colors">
                    {/* BIR Form */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        <span className="text-sm">{item.formCode}</span>
                      </div>
                    </td>

                    {/* Tax Description */}
                    <td className="py-3.5 px-4 font-sans text-slate-700 max-w-xs">
                      <div className="font-medium text-slate-800">{item.formName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                    </td>

                    {/* Status on what quarter or month needed to file */}
                    <td className="py-3.5 px-4 font-sans text-slate-700">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-800 border border-slate-200 inline-block">
                        {item.filingPeriodStatus}
                      </span>
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-4 font-sans text-slate-900">
                      <div className="font-bold flex items-center gap-1.5 text-slate-900">
                        <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{item.dueDate}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">eOPT Compliance</div>
                    </td>

                    {/* Net Tax Due */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-sm">
                      {formatPHP(item.netPayable)}
                    </td>

                    {/* Status whether it was submitted or not */}
                    <td className="py-3.5 px-4 text-center font-sans">
                      <button
                        type="button"
                        onClick={() => onToggleSubmission && onToggleSubmission(item.idKey)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                          item.isSubmitted
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                        }`}
                        title="Click to toggle submission status"
                      >
                        {item.isSubmitted ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Submitted</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            <span>Not Submitted</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Quick Link to Form */}
                    <td className="py-3.5 px-4 text-center font-sans print:hidden">
                      {onNavigateToTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateToTab(item.tabKey)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-mono">
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-right font-bold text-slate-800 font-sans">
                    Total Consolidated Net Tax Payable for {quarter} {year}:
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-base text-slate-900">
                    {formatPHP(totalPayableAllForms)}
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-center text-xs text-slate-500 font-sans">
                    {totalSubmittedCount} of {requiredForms.length} filed
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Excluded / Locked Forms for this Client */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Non-Applicable & Locked BIR Forms for this Client</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Locked in Tab Navigation
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Based on the client's tax classification (<strong>{client.classification}</strong>) and registration status, the following BIR forms are <strong>not needed</strong> and have been locked in the top navigation tabs to avoid filing mistakes or confusion:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {lockedForms.map((lf, idx) => (
              <div
                key={idx}
                className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-start gap-2.5"
              >
                <div className="p-1 rounded bg-slate-100 text-slate-500 shrink-0 mt-0.5">
                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{lf.formCode}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                      Locked
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">{lf.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* eOPT Compliance Notice */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 text-xs text-indigo-950">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Ease of Paying Taxes (eOPT) Act Compliance (Republic Act No. 11976)</div>
            <p className="text-indigo-900 leading-relaxed">
              Tax returns can now be filed and taxes paid electronically or manually at any Authorized Agent Bank (AAB), Revenue District Office (RDO), or authorized tax software portal without the imposition of wrong-venue surcharges. Output VAT and input VAT are now accounted for on an invoice/accrual basis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
