import React, { useState, useMemo } from 'react';
import { Data1601EQ, ClientProfile, Quarter } from '../types/tax';
import { calculate1601EQ } from '../utils/taxCalculations';
import { formatPHP } from '../utils/formatters';
import {
  X,
  Calculator,
  Calendar,
  Layers,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

interface Cumulative0619EModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  year: number;
  quarter: Quarter;
  currentMonth: number;
  activePeriodMode: 'm1' | 'm2' | 'm3' | 'quarter';
  month1Data?: Data1601EQ;
  month2Data?: Data1601EQ;
  month3Data?: Data1601EQ;
  quarterCombinedData?: Data1601EQ;
  yearlyData?: Record<string, Data1601EQ>;
}

const QUARTER_MONTH_NAMES: Record<Quarter, [string, string, string]> = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
};

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export const Cumulative0619EModal: React.FC<Cumulative0619EModalProps> = ({
  isOpen,
  onClose,
  client,
  year,
  quarter,
  currentMonth,
  activePeriodMode,
  month1Data,
  month2Data,
  month3Data,
  quarterCombinedData,
  yearlyData = {},
}) => {
  const [viewScope, setViewScope] = useState<'quarter' | 'year'>('quarter');

  const qMonths = QUARTER_MONTH_NAMES[quarter] || ['Month 1', 'Month 2', 'Month 3'];

  // Quarter Breakdown (Month 1 0619-E, Month 2 0619-E, Month 3 1601-EQ)
  const quarterRows = useMemo(() => {
    const m1 = month1Data ? calculate1601EQ(month1Data) : calculate1601EQ({} as any);
    const m2 = month2Data ? calculate1601EQ(month2Data) : calculate1601EQ({} as any);
    const m3 = month3Data ? calculate1601EQ(month3Data) : calculate1601EQ({} as any);

    const m1Net = Math.max(0, m1.netAmountPayable);
    const m2Net = Math.max(0, m2.netAmountPayable);
    const m3Net = Math.max(0, m3.netAmountPayable);

    const qCombined = quarterCombinedData
      ? calculate1601EQ(quarterCombinedData)
      : null;

    return [
      {
        id: 'm1',
        formBadge: 'Form 0619-E',
        periodLabel: `${qMonths[0]} (Month 1)`,
        taxBase: m1.totalTaxBase,
        taxWithheld: m1.totalTaxWithheld,
        priorRemitted: month1Data?.priorMonthTaxRemitted || 0,
        netRemitted: m1Net,
        runningCumulative: m1Net,
        isCurrent: activePeriodMode === 'm1',
        itemCount: month1Data?.lineItems?.length || 0,
      },
      {
        id: 'm2',
        formBadge: 'Form 0619-E',
        periodLabel: `${qMonths[1]} (Month 2)`,
        taxBase: m2.totalTaxBase,
        taxWithheld: m2.totalTaxWithheld,
        priorRemitted: month2Data?.priorMonthTaxRemitted || 0,
        netRemitted: m2Net,
        runningCumulative: m1Net + m2Net,
        isCurrent: activePeriodMode === 'm2',
        itemCount: month2Data?.lineItems?.length || 0,
      },
      {
        id: 'm3',
        formBadge: 'Form 1601-EQ',
        periodLabel: `${qMonths[2]} (Quarter Return)`,
        taxBase: qCombined?.totalTaxBase || (m1.totalTaxBase + m2.totalTaxBase + m3.totalTaxBase),
        taxWithheld: qCombined?.totalTaxWithheld || (m1.totalTaxWithheld + m2.totalTaxWithheld + m3.totalTaxWithheld),
        priorRemitted: m1Net + m2Net,
        netRemitted: qCombined
          ? Math.max(0, qCombined.netAmountPayable)
          : Math.max(0, (m3.totalTaxWithheld)),
        runningCumulative:
          qCombined
            ? (m1Net + m2Net + Math.max(0, qCombined.netAmountPayable))
            : (m1Net + m2Net + m3Net),
        isCurrent: activePeriodMode === 'm3' || activePeriodMode === 'quarter',
        itemCount: quarterCombinedData?.lineItems?.length || month3Data?.lineItems?.length || 0,
      },
    ];
  }, [month1Data, month2Data, month3Data, quarterCombinedData, qMonths, activePeriodMode]);

  // Full-Year breakdown calculations across all quarters
  const fullYearData = useMemo(() => {
    let runningCumulativeYear = 0;
    const rows: {
      quarter: Quarter;
      period: string;
      formName: string;
      taxBase: number;
      taxWithheld: number;
      netRemitted: number;
      runningCumulative: number;
      isCurrentQuarter: boolean;
    }[] = [];

    QUARTERS.forEach((q) => {
      const qMonthNames = QUARTER_MONTH_NAMES[q];
      const m1Num = q === 'Q1' ? 1 : q === 'Q2' ? 4 : q === 'Q3' ? 7 : 10;
      const m2Num = m1Num + 1;

      const dM1 = yearlyData[`M${m1Num}`];
      const dM2 = yearlyData[`M${m2Num}`];
      const dQ = yearlyData[q];

      const cM1 = dM1 ? calculate1601EQ(dM1) : null;
      const cM2 = dM2 ? calculate1601EQ(dM2) : null;
      const cQ = dQ ? calculate1601EQ(dQ) : null;

      const netM1 = cM1 ? Math.max(0, cM1.netAmountPayable) : 0;
      const netM2 = cM2 ? Math.max(0, cM2.netAmountPayable) : 0;
      const netQ = cQ ? Math.max(0, cQ.netAmountPayable) : 0;

      // Add M1 0619-E
      runningCumulativeYear += netM1;
      rows.push({
        quarter: q,
        period: `${qMonthNames[0]} (M1)`,
        formName: 'Form 0619-E',
        taxBase: cM1?.totalTaxBase || 0,
        taxWithheld: cM1?.totalTaxWithheld || 0,
        netRemitted: netM1,
        runningCumulative: runningCumulativeYear,
        isCurrentQuarter: q === quarter,
      });

      // Add M2 0619-E
      runningCumulativeYear += netM2;
      rows.push({
        quarter: q,
        period: `${qMonthNames[1]} (M2)`,
        formName: 'Form 0619-E',
        taxBase: cM2?.totalTaxBase || 0,
        taxWithheld: cM2?.totalTaxWithheld || 0,
        netRemitted: netM2,
        runningCumulative: runningCumulativeYear,
        isCurrentQuarter: q === quarter,
      });

      // Add 1601-EQ
      runningCumulativeYear += netQ;
      rows.push({
        quarter: q,
        period: `${q} Consolidated`,
        formName: 'Form 1601-EQ',
        taxBase: cQ?.totalTaxBase || 0,
        taxWithheld: cQ?.totalTaxWithheld || 0,
        netRemitted: netQ,
        runningCumulative: runningCumulativeYear,
        isCurrentQuarter: q === quarter,
      });
    });

    return { rows, totalRemittedYear: runningCumulativeYear };
  }, [yearlyData, quarter]);

  if (!isOpen) return null;

  const currentQuarterCumulativeRemitted = quarterRows[2]?.runningCumulative || 0;
  const currentQuarterTaxBase = quarterRows[2]?.taxBase || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  BIR Form 0619-E / 1601-EQ: Cumulative Remittance Breakdown
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-teal-100 text-teal-800 border border-teal-200 rounded-full">
                  {quarter} {year}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {client.registeredName} ({client.tin}) • Expanded Withholding Tax (EWT) progressive remittances
              </p>
            </div>
          </div>
          <button
            id="close-cumulative-0619e-btn"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                {quarter} Cumulative Remitted
              </div>
              <div className="text-2xl font-bold font-mono text-teal-950 mt-1">
                {formatPHP(currentQuarterCumulativeRemitted)}
              </div>
              <div className="text-[11px] text-teal-700 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>M1 + M2 0619-E + 1601-EQ</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                {quarter} Total Tax Base
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatPHP(currentQuarterTaxBase)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Total EWT expenses & purchases subject to withholding
              </div>
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
                Taxable Year Full Remitted
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-950 mt-1">
                {formatPHP(fullYearData.totalRemittedYear)}
              </div>
              <div className="text-[11px] text-indigo-700 mt-1">
                Cumulative across all quarters in TY {year}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Current Active Mode
              </div>
              <div className="text-base font-bold text-slate-800 mt-1">
                {activePeriodMode === 'm1'
                  ? `0619-E (${qMonths[0]})`
                  : activePeriodMode === 'm2'
                  ? `0619-E (${qMonths[1]})`
                  : `1601-EQ (${quarter})`}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Positioned in active quarterly schedule
              </div>
            </div>
          </div>

          {/* Toggle View: Current Quarter vs Full Year */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">View Scope:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setViewScope('quarter')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewScope === 'quarter'
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Current Quarter ({quarter}) Months
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('year')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewScope === 'year'
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full Year ({year}) All Quarters
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Filing Year: <strong>{year}</strong> • Current Quarter: <strong>{quarter}</strong></span>
            </div>
          </div>

          {/* Table View */}
          {viewScope === 'quarter' ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Form & Period</th>
                      <th className="py-2.5 px-3 text-center">ATC Line Items</th>
                      <th className="py-2.5 px-3 text-right">Total Tax Base</th>
                      <th className="py-2.5 px-3 text-right">Total Tax Withheld</th>
                      <th className="py-2.5 px-3 text-right">Prior 0619-E Remitted</th>
                      <th className="py-2.5 px-3 text-right font-bold text-slate-900">Net Tax Remitted</th>
                      <th className="py-2.5 px-3 text-right font-bold text-teal-800 bg-teal-50/50">
                        Cumulative Remitted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {quarterRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          row.isCurrent
                            ? 'bg-teal-50/60 font-semibold text-teal-950'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-semibold text-[10px]">
                              {row.formBadge}
                            </span>
                            <span className="font-medium text-slate-900">{row.periodLabel}</span>
                            {row.isCurrent && (
                              <span className="px-1.5 py-0.2 bg-teal-600 text-white rounded text-[10px] font-bold">
                                Active Mode
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans text-slate-600">
                          {row.itemCount} line item{row.itemCount === 1 ? '' : 's'}
                        </td>
                        <td className="py-2.5 px-3 text-right">{formatPHP(row.taxBase)}</td>
                        <td className="py-2.5 px-3 text-right">{formatPHP(row.taxWithheld)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {row.priorRemitted > 0 ? `-${formatPHP(row.priorRemitted, false)}` : '₱0.00'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatPHP(row.netRemitted)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-teal-900 bg-teal-50/40">
                          {formatPHP(row.runningCumulative)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900 font-mono">
                      <td colSpan={2} className="py-3 px-3 font-sans">
                        {quarter} Cumulative Remittance Total
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {formatPHP(currentQuarterTaxBase)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {formatPHP(quarterRows[2]?.taxWithheld || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">—</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatPHP(currentQuarterCumulativeRemitted)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-teal-900 bg-teal-100/60">
                        {formatPHP(currentQuarterCumulativeRemitted)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Quarter & Period</th>
                      <th className="py-2.5 px-3">BIR Form</th>
                      <th className="py-2.5 px-3 text-right">Tax Base</th>
                      <th className="py-2.5 px-3 text-right">Tax Withheld</th>
                      <th className="py-2.5 px-3 text-right font-bold text-slate-900">Net Tax Remitted</th>
                      <th className="py-2.5 px-3 text-right font-bold text-teal-800 bg-teal-50/50">
                        Cumulative Remitted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {fullYearData.rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          row.isCurrentQuarter
                            ? 'bg-teal-50/40 text-slate-900'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{row.quarter}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-700">{row.period}</span>
                            {row.isCurrentQuarter && (
                              <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 border border-teal-300 rounded text-[10px]">
                                Current Quarter
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-medium text-slate-700">
                            {row.formName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">{formatPHP(row.taxBase)}</td>
                        <td className="py-2.5 px-3 text-right">{formatPHP(row.taxWithheld)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatPHP(row.netRemitted)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-teal-900 bg-teal-50/40">
                          {formatPHP(row.runningCumulative)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900 font-mono">
                      <td colSpan={4} className="py-3 px-3 font-sans">
                        Full-Year Total Cumulative Remittance (TY {year})
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatPHP(fullYearData.totalRemittedYear)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-teal-900 bg-teal-100/60">
                        {formatPHP(fullYearData.totalRemittedYear)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Note: 0619-E monthly payments are credited against the quarterly 1601-EQ tax remittance.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
