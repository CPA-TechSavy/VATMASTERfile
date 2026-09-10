import React, { useState } from 'react';
import { Data1601C, ClientProfile } from '../types/tax';
import { calculate1601C } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import { AlertTriangle, Users } from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';

interface Form1601CViewProps {
  client: ClientProfile;
  month: number;
  year: number;
  data: Data1601C;
  onChange: (updated: Data1601C) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const Form1601CView: React.FC<Form1601CViewProps> = ({
  client,
  month,
  year,
  data,
  onChange,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);

  const result = calculate1601C(data);

  const updateField = (field: keyof Data1601C, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-600 text-white rounded">
              BIR Form 1601-C
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {MONTH_NAMES[month - 1]} {year} • Monthly Remittance (Compensation Withholding)
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            {client.registeredName}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="open-penalties-1601c-btn"
            onClick={() => setShowPenalties(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Late Penalties</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Gross Compensation */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Part II: Total Gross Compensation
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-sm text-slate-700 font-medium">Total Gross Compensation Paid</label>
                <div className="text-xs text-slate-400">Total payroll including allowances, overtime, bonuses</div>
              </div>
              <div className="relative w-full sm:w-60">
                <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                <input
                  id="gross-comp-1601c"
                  type="number"
                  value={data.totalGrossCompensation || ''}
                  onChange={(e) => updateField('totalGrossCompensation', parseNumber(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Statutory Non-Taxable Compensation */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Statutory Non-Taxable / Exempt Compensation
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700">Statutory Minimum Wage Earners</label>
                  <div className="text-xs text-slate-400">SMW employees basic & holiday/overtime/hazard pay</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="smw-comp-1601c"
                    type="number"
                    value={data.minimumWageEarners || ''}
                    onChange={(e) => updateField('minimumWageEarners', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700">Statutory Contributions (Employee Share)</label>
                  <div className="text-xs text-slate-400">SSS, PhilHealth, Pag-IBIG, Union Dues</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="statutory-contrib-1601c"
                    type="number"
                    value={data.statutoryContributions || ''}
                    onChange={(e) => updateField('statutoryContributions', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-sm text-slate-700">13th Month Pay & De Minimis Benefits</label>
                  <div className="text-xs text-slate-400">Non-taxable portion (up to ₱90,000 threshold)</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="thirteenth-month-1601c"
                    type="number"
                    value={data.thirteenthMonthAndDeMinimis || ''}
                    onChange={(e) => updateField('thirteenthMonthAndDeMinimis', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Other Non-Taxable Compensation</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="other-nontax-1601c"
                    type="number"
                    value={data.otherNonTaxableCompensation || ''}
                    onChange={(e) => updateField('otherNonTaxableCompensation', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Adjustments */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tax Adjustments & Previous Remittances
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Tax Adjustments (Prior Months)</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="adjustments-1601c"
                    type="number"
                    value={data.taxWithheldAdjustments || ''}
                    onChange={(e) => updateField('taxWithheldAdjustments', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Tax Remitted in Previous Return (if amended)</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="prev-remitted-1601c"
                    type="number"
                    value={data.taxRemittedPreviously || ''}
                    onChange={(e) => updateField('taxRemittedPreviously', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1601-C Remittance Summary
              </div>
              <span className="text-xs font-mono text-slate-500">Auto-Computed</span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Gross Compensation</span>
                <span className="font-mono font-medium">{formatPHP(result.totalGrossCompensation)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Less: Non-Taxable Compensation</span>
                <span className="font-mono font-medium text-amber-700">
                  -{formatPHP(result.totalNonTaxableCompensation, false)}
                </span>
              </div>

              <div className="flex justify-between text-slate-900 font-semibold pt-1 border-t border-slate-200">
                <span>Taxable Compensation</span>
                <span className="font-mono">{formatPHP(result.taxableCompensation)}</span>
              </div>

              <div className="flex justify-between text-slate-700 pt-1">
                <span>Tax Required to be Withheld</span>
                <span className="font-mono font-semibold">{formatPHP(result.taxRequiredWithheld)}</span>
              </div>

              {result.adjustments !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax Adjustments</span>
                  <span className="font-mono font-medium">{formatPHP(result.adjustments)}</span>
                </div>
              )}

              {result.priorRemittance > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Less: Previous Remittance</span>
                  <span className="font-mono font-medium text-emerald-700">
                    -{formatPHP(result.priorRemittance, false)}
                  </span>
                </div>
              )}

              {/* Net Payable Banner */}
              <div className="p-4 rounded-xl mt-4 border bg-emerald-50 border-emerald-200 text-emerald-950">
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  Net Tax Required to be Remitted
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatPHP(Math.max(0, result.netTaxRemitted))}
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  Due on or before the 10th day of the following month (eFPS on schedule)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PenaltiesModal
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        basicTaxDue={result.netTaxRemitted}
        formName={`BIR Form 1601-C (${MONTH_NAMES[month - 1]} ${year})`}
      />
    </div>
  );
};
