import React, { useState } from 'react';
import { Data1701Q, ClientProfile, Quarter } from '../types/tax';
import { calculate1701Q } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import { Calculator, AlertTriangle } from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';

interface Form1701QViewProps {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  data: Data1701Q;
  onChange: (updated: Data1701Q) => void;
}

export const Form1701QView: React.FC<Form1701QViewProps> = ({
  client,
  quarter,
  year,
  data,
  onChange,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);

  const result = calculate1701Q(data);

  const updateField = (field: keyof Data1701Q, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Form Header & Quick Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-indigo-500 text-white rounded">
              BIR Form 1701Q
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {quarter} {year} • Individual Income Tax
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1">{client.tradeName}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="open-penalties-1701q-btn"
            onClick={() => setShowPenalties(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Late Penalties</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Inputs vs Calculation Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs Section (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Regime Selection */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tax Regime & Deduction Scheme
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tax Calculation Rate
                </label>
                <select
                  id="regime-1701q-select"
                  value={data.taxRegime}
                  onChange={(e) => updateField('taxRegime', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="8_percent">8% Flat Income Tax (Sec 24A / EOPT)</option>
                  <option value="graduated">Graduated Rates (Tax Code / EOPT Law)</option>
                </select>
              </div>

              {data.taxRegime === '8_percent' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Taxpayer Income Source
                  </label>
                  <select
                    id="taxpayer-type-1701q-select"
                    value={data.taxpayerType}
                    onChange={(e) => updateField('taxpayerType', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="pure_business">Pure Business / Professional (₱250k Exemption)</option>
                    <option value="mixed_income">Mixed Income Earner (No ₱250k Exemption)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Method of Deduction
                  </label>
                  <select
                    id="deduction-method-1701q-select"
                    value={data.deductionMethod}
                    onChange={(e) => updateField('deductionMethod', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="osd">OSD - Optional Standard Deduction (40%)</option>
                    <option value="itemized">Itemized Deductions (Actual Expenses)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Revenues / Sales Data */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Part IV: Computation of Gross Income
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700 font-medium">
                  Gross Sales / Receipts (This Quarter)
                </label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="gross-sales-cq-1701q"
                    type="number"
                    value={data.grossSalesCurrentQuarter || ''}
                    onChange={(e) => updateField('grossSalesCurrentQuarter', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">
                  Gross Sales / Receipts (Prior Quarters)
                </label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="gross-sales-pq-1701q"
                    type="number"
                    value={data.grossSalesPriorQuarters || ''}
                    onChange={(e) => updateField('grossSalesPriorQuarters', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">
                  Non-Operating & Other Taxable Income
                </label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="non-op-1701q"
                    type="number"
                    value={data.nonOperatingIncome || ''}
                    onChange={(e) => updateField('nonOperatingIncome', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* If Itemized Deductions selected under Graduated */}
            {data.taxRegime === 'graduated' && data.deductionMethod === 'itemized' && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="text-xs font-semibold text-slate-600">Itemized Allowable Deductions:</div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-sm text-slate-700">Cost of Sales / Services</label>
                  <div className="relative w-full sm:w-60">
                    <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                    <input
                      id="cost-of-sales-1701q"
                      type="number"
                      value={data.costOfSales || ''}
                      onChange={(e) => updateField('costOfSales', parseNumber(e.target.value))}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-sm text-slate-700">Allowable Operating Expenses</label>
                  <div className="relative w-full sm:w-60">
                    <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                    <input
                      id="operating-expenses-1701q"
                      type="number"
                      value={data.operatingExpenses || ''}
                      onChange={(e) => updateField('operatingExpenses', parseNumber(e.target.value))}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Tax Credits & Payments */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Part V: Tax Credits & Payments (Deductions from Tax Due)
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700">BIR Form 2307 Creditable Withholding Tax</div>
                  <div className="text-xs text-slate-400">SAWT quarterly certificates</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="cwt2307-1701q"
                    type="number"
                    value={data.cwt2307Credits || ''}
                    onChange={(e) => updateField('cwt2307Credits', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Tax Payments for Prior Quarters</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="pq-payments-1701q"
                    type="number"
                    value={data.quarterlyTaxPaidPriorQuarters || ''}
                    onChange={(e) => updateField('quarterlyTaxPaidPriorQuarters', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Year's Excess Credits</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="py-credits-1701q"
                    type="number"
                    value={data.priorYearExcessCredits || ''}
                    onChange={(e) => updateField('priorYearExcessCredits', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Other Tax Credits / Tax Reliefs</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="other-credits-1701q"
                    type="number"
                    value={data.otherTaxCredits || ''}
                    onChange={(e) => updateField('otherTaxCredits', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Computation Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1701Q Tax Computation Breakdown
              </div>
              <span className="text-xs font-mono text-slate-500">Auto-Computed</span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Gross Revenues</span>
                <span className="font-mono font-medium">{formatPHP(result.totalGrossRevenues)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span className="truncate pr-2">Less: {result.deductionType}</span>
                <span className="font-mono font-medium text-amber-700">
                  -{formatPHP(result.allowableDeductions, false)}
                </span>
              </div>

              <div className="flex justify-between text-slate-900 font-semibold pt-2 border-t border-slate-200">
                <span>Net Taxable Income</span>
                <span className="font-mono">{formatPHP(result.netTaxableIncome)}</span>
              </div>

              <div className="flex justify-between text-slate-700 pt-1">
                <span>Tax Due (Rate Applied)</span>
                <span className="font-mono font-semibold">{formatPHP(result.taxDue)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Total Tax Credits / Payments</span>
                <span className="font-mono font-medium text-emerald-700">
                  -{formatPHP(result.totalTaxCredits, false)}
                </span>
              </div>

              {/* Net Payable Banner */}
              <div
                className={`p-4 rounded-xl mt-4 border ${
                  result.isOverpayment
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {result.isOverpayment ? 'Excess Credit / Overpayment' : 'Net Tax Payable (To BIR)'}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatPHP(Math.abs(result.netTaxPayable))}
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  {result.isOverpayment
                    ? 'Carried over to next quarter or available for refund'
                    : 'Due on statutory quarterly deadline'}
                </div>
              </div>
            </div>

            {/* BIR Form Box Guide */}
            <div className="text-xs bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 text-slate-600">
              <div className="font-semibold text-slate-800">BIR Form 1701Q Box Guide:</div>
              <div className="flex justify-between">
                <span>Part IV Line 26 (Total Gross)</span>
                <span className="font-mono">{formatPHP(result.boxBreakdown.lineTotalGross)}</span>
              </div>
              <div className="flex justify-between">
                <span>Part IV Line 33 (Tax Due)</span>
                <span className="font-mono">{formatPHP(result.boxBreakdown.lineTaxDue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Part V Line 34 (Tax Credits)</span>
                <span className="font-mono">{formatPHP(result.boxBreakdown.lineTotalCredits)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Part V Line 35 (Tax Payable)</span>
                <span className="font-mono">{formatPHP(Math.max(0, result.netTaxPayable))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PenaltiesModal
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        basicTaxDue={result.netTaxPayable}
        formName={`BIR Form 1701Q (${quarter} ${year})`}
      />
    </div>
  );
};
