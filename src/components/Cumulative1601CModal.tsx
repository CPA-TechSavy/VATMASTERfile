import React, { useState, useMemo } from 'react';
import { Data1601C, ClientProfile } from '../types/tax';
import { calculate1601C } from '../utils/taxCalculations';
import { formatPHP } from '../utils/formatters';
import {
  X,
  Calculator,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';

interface Cumulative1601CModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  year: number;
  currentMonth: number;
  yearlyData?: Record<number, Data1601C>;
  currentData: Data1601C;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const Cumulative1601CModal: React.FC<Cumulative1601CModalProps> = ({
  isOpen,
  onClose,
  client,
  year,
  currentMonth,
  yearlyData = {},
  currentData,
}) => {
  const [viewScope, setViewScope] = useState<'ytd' | 'fullYear'>('ytd');

  // Compute metrics for each of the 12 months
  const monthlyCalculations = useMemo(() => {
    let runningCumulative = 0;
    let runningGross = 0;
    let runningTaxable = 0;
    let runningTaxWithheld = 0;

    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const dataForMonth: Data1601C =
        monthNum === currentMonth
          ? currentData
          : yearlyData[monthNum] || {
              totalGrossCompensation: 0,
              minimumWageEarners: 0,
              otherNonTaxableCompensation: 0,
              taxRequiredWithheld: 0,
              taxWithheldAdjustments: 0,
              taxRemittedPreviously: 0,
            };

      const result = calculate1601C(dataForMonth);
      const netRemitted = Math.max(0, result.netTaxRemitted);

      runningCumulative += netRemitted;
      runningGross += result.totalGrossCompensation;
      runningTaxable += result.taxableCompensation;
      runningTaxWithheld += result.taxRequiredWithheld;

      return {
        monthNum,
        monthName: MONTH_NAMES[i],
        data: dataForMonth,
        result,
        netRemitted,
        runningCumulative,
        runningGross,
        runningTaxable,
        runningTaxWithheld,
        isCurrent: monthNum === currentMonth,
        isPastOrCurrent: monthNum <= currentMonth,
        hasData:
          result.totalGrossCompensation > 0 ||
          result.taxRequiredWithheld > 0 ||
          monthNum === currentMonth,
      };
    });
  }, [yearlyData, currentData, currentMonth]);

  if (!isOpen) return null;

  // Selected rows based on viewScope (YTD vs Full Year)
  const displayedRows =
    viewScope === 'ytd'
      ? monthlyCalculations.filter((m) => m.monthNum <= currentMonth)
      : monthlyCalculations;

  // YTD summaries (Month 1 to currentMonth)
  const ytdData = monthlyCalculations[currentMonth - 1] || monthlyCalculations[0];
  const ytdNetRemitted = ytdData.runningCumulative;
  const ytdGrossCompensation = ytdData.runningGross;
  const ytdTaxableCompensation = ytdData.runningTaxable;
  const ytdTaxWithheld = ytdData.runningTaxWithheld;

  // Full Year summaries
  const fullYearData = monthlyCalculations[11];
  const fullYearNetRemitted = fullYearData.runningCumulative;
  const fullYearGross = fullYearData.runningGross;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  BIR Form 1601-C: Cumulative Remittance Breakdown
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full">
                  TY {year}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {client.registeredName} ({client.tin}) • Tracking progressive monthly withholding tax on compensation
              </p>
            </div>
          </div>
          <button
            id="close-cumulative-1601c-btn"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                YTD Net Tax Remitted
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
                {formatPHP(ytdNetRemitted)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Through {MONTH_NAMES[currentMonth - 1]} (Month {currentMonth})</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                YTD Gross Compensation
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatPHP(ytdGrossCompensation)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Total salaries and benefits paid YTD
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                YTD Taxable Compensation
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {formatPHP(ytdTaxableCompensation)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Subject to withholding tax brackets
              </div>
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
                Full-Year Cumulative
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-950 mt-1">
                {formatPHP(fullYearNetRemitted)}
              </div>
              <div className="text-[11px] text-indigo-700 mt-1">
                Total recorded across 12 months
              </div>
            </div>
          </div>

          {/* Scope Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Display Range:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setViewScope('ytd')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewScope === 'ytd'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Year-to-Date (Months 1–{currentMonth})
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('fullYear')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewScope === 'fullYear'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full Year (Months 1–12)
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Active Filing Period: <strong>{MONTH_NAMES[currentMonth - 1]} {year}</strong></span>
            </div>
          </div>

          {/* Cumulative Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-3">Month / Period</th>
                    <th className="py-2.5 px-3 text-right">Gross Compensation</th>
                    <th className="py-2.5 px-3 text-right">Non-Taxable</th>
                    <th className="py-2.5 px-3 text-right">Taxable Comp.</th>
                    <th className="py-2.5 px-3 text-right">Tax Withheld</th>
                    <th className="py-2.5 px-3 text-right">Adjustments / Prior</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900">Net Tax Remitted</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-800 bg-emerald-50/50">
                      Cumulative Remitted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {displayedRows.map((row) => (
                    <tr
                      key={row.monthNum}
                      className={`transition-colors ${
                        row.isCurrent
                          ? 'bg-emerald-50/60 font-semibold text-emerald-950'
                          : row.monthNum <= currentMonth
                          ? 'hover:bg-slate-50 text-slate-800'
                          : 'text-slate-400 hover:bg-slate-50/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{row.monthName}</span>
                          {row.isCurrent && (
                            <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[10px] font-bold">
                              Current
                            </span>
                          )}
                          {!row.isCurrent && row.monthNum < currentMonth && (
                            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[10px]">
                              Past
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">{formatPHP(row.result.totalGrossCompensation)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-700">
                        {row.result.totalNonTaxableCompensation > 0
                          ? `-${formatPHP(row.result.totalNonTaxableCompensation, false)}`
                          : '₱0.00'}
                      </td>
                      <td className="py-2.5 px-3 text-right">{formatPHP(row.result.taxableCompensation)}</td>
                      <td className="py-2.5 px-3 text-right">{formatPHP(row.result.taxRequiredWithheld)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {row.result.priorRemittance > 0 || row.result.adjustments !== 0
                          ? formatPHP(row.result.adjustments - row.result.priorRemittance)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatPHP(row.netRemitted)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-900 bg-emerald-50/40">
                        {formatPHP(row.runningCumulative)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900 font-mono">
                    <td className="py-3 px-3 font-sans">
                      {viewScope === 'ytd' ? `YTD Total (Months 1–${currentMonth})` : 'Full Year Total (12 Months)'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {formatPHP(viewScope === 'ytd' ? ytdGrossCompensation : fullYearGross)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-800">
                      —
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {formatPHP(viewScope === 'ytd' ? ytdTaxableCompensation : fullYearData.runningTaxable)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {formatPHP(viewScope === 'ytd' ? ytdTaxWithheld : fullYearData.runningTaxWithheld)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      —
                    </td>
                    <td className="py-3 px-3 text-right text-slate-900 font-bold">
                      {formatPHP(viewScope === 'ytd' ? ytdNetRemitted : fullYearNetRemitted)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-900 font-bold bg-emerald-100/60">
                      {formatPHP(viewScope === 'ytd' ? ytdNetRemitted : fullYearNetRemitted)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Note: Cumulative values reflect submitted and draft monthly 1601-C compensation returns.
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
