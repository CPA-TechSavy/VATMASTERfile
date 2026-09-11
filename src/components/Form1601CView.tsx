import React, { useState } from 'react';
import { Data1601C, ClientProfile } from '../types/tax';
import { calculate1601C } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import { AlertTriangle, Users, Save, CheckCircle2, Calendar, Calculator } from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { Cumulative1601CModal } from './Cumulative1601CModal';

interface Form1601CViewProps {
  client: ClientProfile;
  month: number;
  year: number;
  onSelectMonth?: (m: number) => void;
  data: Data1601C;
  onChange: (updated: Data1601C) => void;
  yearlyData?: Record<number, Data1601C>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const Form1601CView: React.FC<Form1601CViewProps> = ({
  client,
  month,
  year,
  onSelectMonth,
  data,
  onChange,
  yearlyData,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const result = calculate1601C(data);

  const updateField = (field: keyof Data1601C, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleSave = () => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSaveStatus(`Saved at ${timestamp}`);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 12-Month Switcher Bar for 1601-C */}
      {onSelectMonth && (
        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Monthly Return Schedule (TY {year}):</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {MONTH_NAMES.map((name, idx) => {
              const mNum = idx + 1;
              const isSelected = month === mNum;
              return (
                <button
                  key={mNum}
                  id={`1601c-month-pill-${mNum}`}
                  onClick={() => onSelectMonth(mNum)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={`${name} ${year}`}
                >
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-600 text-white rounded">
              BIR Form 1601-C
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {MONTH_NAMES[month - 1]} {year} • Monthly Remittance of Taxes Withheld on Compensation
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
              Due: 10th of following month
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            {client.registeredName} ({client.tin})
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

          <button
            id="save-1601c-btn"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-xs"
          >
            {saveStatus ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveStatus || `Save ${MONTH_NAMES[month - 1].slice(0, 3)} Data`}</span>
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

              {/* Cumulative Amount Button right under NET TAX REQUIRED TO BE REMITTED */}
              <button
                id="btn-cumulative-amount-1601c"
                type="button"
                onClick={() => setShowCumulative(true)}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                title="View Cumulative Amount and monthly withholding tax progression"
              >
                <Calculator className="w-4 h-4" />
                <span>View Cumulative Amount</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <Cumulative1601CModal
        isOpen={showCumulative}
        onClose={() => setShowCumulative(false)}
        client={client}
        year={year}
        currentMonth={month}
        yearlyData={yearlyData}
        currentData={data}
      />

      <PenaltiesModal
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        basicTaxDue={result.netTaxRemitted}
        formName={`BIR Form 1601-C (${MONTH_NAMES[month - 1]} ${year})`}
      />
    </div>
  );
};
