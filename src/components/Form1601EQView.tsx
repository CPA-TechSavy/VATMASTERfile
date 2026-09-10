import React, { useState } from 'react';
import { Data1601EQ, ClientProfile, EwtLineItem } from '../types/tax';
import { calculate1601EQ } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';

interface Form1601EQViewProps {
  client: ClientProfile;
  periodLabel: string;
  data: Data1601EQ;
  onChange: (updated: Data1601EQ) => void;
}

const COMMON_ATC_PRESETS = [
  { atc: 'WI100', description: 'Prof. Fees - Individual (5% if <= ₱3M)', rate: 5 },
  { atc: 'WI101', description: 'Prof. Fees - Individual (10% if > ₱3M)', rate: 10 },
  { atc: 'WC100', description: 'Prof. Fees - Juridical/Corp (10% or 15%)', rate: 10 },
  { atc: 'WI157', description: 'Rent on Real Property (5%)', rate: 5 },
  { atc: 'WI005', description: 'Contractors / Sub-contractors (2%)', rate: 2 },
  { atc: 'WB080', description: 'TWA - Purchase of Goods (1%)', rate: 1 },
  { atc: 'WB082', description: 'TWA - Purchase of Services (2%)', rate: 2 },
  { atc: 'WI160', description: 'Commissions / Brokers (10%)', rate: 10 },
];

export const Form1601EQView: React.FC<Form1601EQViewProps> = ({
  client,
  periodLabel,
  data,
  onChange,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);

  const result = calculate1601EQ(data);

  const handleToggleMode = (isMonthly: boolean) => {
    onChange({ ...data, isMonthly });
  };

  const handleUpdateLine = (id: string, field: keyof EwtLineItem, val: any) => {
    const items = data.lineItems || [];
    const updated = items.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    });
    onChange({ ...data, lineItems: updated });
  };

  const handleAddLine = (preset?: (typeof COMMON_ATC_PRESETS)[0]) => {
    const items = data.lineItems || [];
    const newItem: EwtLineItem = {
      id: `ewt-${Date.now()}`,
      atc: preset ? preset.atc : 'WI157',
      description: preset ? preset.description : 'Rent on Real Property (5%)',
      ratePercent: preset ? preset.rate : 5,
      taxBase: 0,
    };
    onChange({ ...data, lineItems: [...items, newItem] });
  };

  const handleRemoveLine = (id: string) => {
    const items = data.lineItems || [];
    onChange({ ...data, lineItems: items.filter((i) => i.id !== id) });
  };

  const formCode = data.isMonthly ? 'BIR Form 0619-E' : 'BIR Form 1601-EQ';
  const formSubtitle = data.isMonthly
    ? 'Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded)'
    : 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-teal-600 text-white rounded">
              {formCode}
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {periodLabel} • Expanded Withholding (EWT)
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1">{client.tradeName}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Monthly 0619-E vs Quarterly 1601-EQ */}
          <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              id="mode-0619e-btn"
              onClick={() => handleToggleMode(true)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                data.isMonthly ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              0619-E (Monthly)
            </button>
            <button
              id="mode-1601eq-btn"
              onClick={() => handleToggleMode(false)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                !data.isMonthly ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              1601-EQ (Quarterly)
            </button>
          </div>

          <button
            id="open-penalties-ewt-btn"
            onClick={() => setShowPenalties(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Late Penalties</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Expanded Withholding Tax Lines (ATC Breakdown)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{formSubtitle}</div>
              </div>

              <div className="flex gap-2">
                <button
                  id="add-ewt-custom-btn"
                  onClick={() => handleAddLine()}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line</span>
                </button>
              </div>
            </div>

            {/* Quick Preset Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
              <span className="text-xs text-slate-400 mr-1 self-center">Quick Add:</span>
              {COMMON_ATC_PRESETS.slice(0, 4).map((p) => (
                <button
                  key={p.atc}
                  type="button"
                  onClick={() => handleAddLine(p)}
                  className="px-2 py-0.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  +{p.atc} ({p.rate}%)
                </button>
              ))}
            </div>

            {/* Lines Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3 w-24">ATC Code</th>
                    <th className="py-2.5 px-3">Nature of Payment</th>
                    <th className="py-2.5 px-3 w-20 text-center">Rate</th>
                    <th className="py-2.5 px-3 w-36 text-right">Tax Base (₱)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Tax Withheld</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {result.lineBreakdowns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400 font-sans">
                        No EWT lines added yet. Click "Add Line" or a quick preset above.
                      </td>
                    </tr>
                  ) : (
                    result.lineBreakdowns.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={line.atc}
                            onChange={(e) => handleUpdateLine(line.id, 'atc', e.target.value)}
                            className="w-full px-2 py-1 uppercase text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => handleUpdateLine(line.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 font-sans text-xs bg-transparent border border-transparent hover:border-slate-200 focus:border-slate-300 focus:bg-white rounded"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={line.ratePercent}
                              onChange={(e) =>
                                handleUpdateLine(line.id, 'ratePercent', parseNumber(e.target.value))
                              }
                              className="w-12 px-1.5 py-1 text-center text-xs bg-slate-50 border border-slate-200 rounded font-mono"
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={line.taxBase || ''}
                            onChange={(e) =>
                              handleUpdateLine(line.id, 'taxBase', parseNumber(e.target.value))
                            }
                            placeholder="0.00"
                            className="w-full px-2 py-1 text-right text-xs bg-white border border-slate-200 rounded font-mono focus:ring-1 focus:ring-teal-500"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">
                          {formatPHP(line.taxWithheld, false)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Prior Remittance / Adjustments */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Tax Remitted in Previous Return / Month (if applicable)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="prior-month-tax-remitted"
                    type="number"
                    value={data.priorMonthTaxRemitted || ''}
                    onChange={(e) =>
                      onChange({ ...data, priorMonthTaxRemitted: parseNumber(e.target.value) })
                    }
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Overpayment Carried Over from Previous Period
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">₱</span>
                  <input
                    id="overpayment-prev-period"
                    type="number"
                    value={data.overpaymentPreviousPeriod || ''}
                    onChange={(e) =>
                      onChange({ ...data, overpaymentPreviousPeriod: parseNumber(e.target.value) })
                    }
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Summary */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Remittance Summary
              </div>
              <span className="text-xs font-mono text-slate-500">Auto-Computed</span>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Tax Base</span>
                <span className="font-mono font-medium">{formatPHP(result.totalTaxBase)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-semibold">
                <span>Total Taxes Withheld</span>
                <span className="font-mono">{formatPHP(result.totalTaxWithheld)}</span>
              </div>

              {(data.priorMonthTaxRemitted > 0 || data.overpaymentPreviousPeriod > 0) && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  {data.priorMonthTaxRemitted > 0 && (
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>Less: Prior Month Remitted</span>
                      <span className="font-mono text-emerald-700">
                        -{formatPHP(data.priorMonthTaxRemitted, false)}
                      </span>
                    </div>
                  )}
                  {data.overpaymentPreviousPeriod > 0 && (
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>Less: Previous Overpayment</span>
                      <span className="font-mono text-emerald-700">
                        -{formatPHP(data.overpaymentPreviousPeriod, false)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Net Remittance */}
              <div className="p-4 rounded-xl mt-4 border bg-teal-50 border-teal-200 text-teal-950">
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  Net Tax Required to be Remitted
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatPHP(Math.max(0, result.netAmountPayable))}
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  {data.isMonthly
                    ? '0619-E due on or before the 10th of following month'
                    : '1601-EQ due on or before the last day of month following the quarter'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PenaltiesModal
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        basicTaxDue={result.netAmountPayable}
        formName={`${formCode} (${periodLabel})`}
      />
    </div>
  );
};
