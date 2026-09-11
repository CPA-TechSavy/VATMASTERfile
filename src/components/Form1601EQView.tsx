import React, { useState } from 'react';
import { Data1601EQ, ClientProfile, EwtLineItem, Quarter } from '../types/tax';
import { calculate1601EQ } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Layers,
  Save,
  CheckCircle2,
  Sparkles,
  Calendar,
  Check,
  Calculator,
} from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { Cumulative0619EModal } from './Cumulative0619EModal';

interface Form1601EQViewProps {
  client: ClientProfile;
  quarter: Quarter;
  month: number;
  year: number;
  data: Data1601EQ;
  onChange: (updated: Data1601EQ) => void;
  // Combined monthly/quarterly data
  month1Data?: Data1601EQ;
  month2Data?: Data1601EQ;
  month3Data?: Data1601EQ;
  quarterCombinedData?: Data1601EQ;
  yearlyData?: Record<string, Data1601EQ>;
  activePeriodMode: 'm1' | 'm2' | 'm3' | 'quarter';
  onSelectPeriodMode: (mode: 'm1' | 'm2' | 'm3' | 'quarter') => void;
  onConsolidateMonths?: () => void;
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

const QUARTER_MONTH_NAMES: Record<Quarter, [string, string, string]> = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
};

export const Form1601EQView: React.FC<Form1601EQViewProps> = ({
  client,
  quarter,
  month,
  year,
  data,
  onChange,
  month1Data,
  month2Data,
  month3Data,
  quarterCombinedData,
  yearlyData,
  activePeriodMode,
  onSelectPeriodMode,
  onConsolidateMonths,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const quarterMonths = QUARTER_MONTH_NAMES[quarter] || ['Month 1', 'Month 2', 'Month 3'];

  // Calculate results for current active data
  const result = calculate1601EQ(data);

  // Pre-calculate month 1, 2, 3 results for consolidation view
  const m1Result = month1Data ? calculate1601EQ(month1Data) : null;
  const m2Result = month2Data ? calculate1601EQ(month2Data) : null;
  const m3Result = month3Data ? calculate1601EQ(month3Data) : null;

  const totalMonthlyRemittedM1M2 = (m1Result?.totalTaxWithheld || 0) + (m2Result?.totalTaxWithheld || 0);

  const isQuarterView = activePeriodMode === 'quarter';

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

  const handleSave = () => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSaveStatus(`Saved at ${timestamp}`);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Form identity labels
  const currentMonthName =
    activePeriodMode === 'm1'
      ? quarterMonths[0]
      : activePeriodMode === 'm2'
      ? quarterMonths[1]
      : activePeriodMode === 'm3'
      ? quarterMonths[2]
      : `${quarter} Consolidated`;

  const formBadge = isQuarterView ? 'BIR Form 1601-EQ' : 'BIR Form 0619-E';
  const formTitle = isQuarterView
    ? `Quarterly Remittance Return of Withholding Tax (Expanded) • ${quarter} ${year}`
    : `Monthly Remittance Form of Withholding Tax (Expanded) • ${currentMonthName} ${year}`;
  const dueNotice = isQuarterView
    ? 'Due on or before the last day of the month following the quarter'
    : 'Due on or before the 10th day of the following month';

  return (
    <div className="space-y-6">
      {/* Top Combined Period Switcher (Month 1, Month 2, Month 3, and Combined Quarter) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-600 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-slate-800">0619-E (Monthly) & 1601-EQ (Quarterly):</span>
            <span className="text-slate-500 ml-1">Select period for {quarter} {year}</span>
          </div>
        </div>

        {/* 4 Mode Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            id="ewt-period-m1-btn"
            onClick={() => onSelectPeriodMode('m1')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activePeriodMode === 'm1'
                ? 'bg-teal-700 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Month 1: {quarterMonths[0]}</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-black/20">0619-E</span>
          </button>

          <button
            id="ewt-period-m2-btn"
            onClick={() => onSelectPeriodMode('m2')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activePeriodMode === 'm2'
                ? 'bg-teal-700 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Month 2: {quarterMonths[1]}</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-black/20">0619-E</span>
          </button>

          <button
            id="ewt-period-m3-btn"
            onClick={() => onSelectPeriodMode('m3')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activePeriodMode === 'm3'
                ? 'bg-teal-700 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Month 3: {quarterMonths[2]}</span>
          </button>

          <button
            id="ewt-period-quarter-btn"
            onClick={() => onSelectPeriodMode('quarter')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activePeriodMode === 'quarter'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
            }`}
          >
            <span>{quarter} Combined</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-teal-600 text-white">1601-EQ</span>
          </button>
        </div>
      </div>

      {/* Main Form Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-xs font-bold bg-teal-600 text-white rounded">
              {formBadge}
            </span>
            <span className="text-xs text-slate-300 font-mono">{formTitle}</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded">
              {dueNotice}
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1">
            {client.registeredName} ({client.tin})
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isQuarterView && onConsolidateMonths && (
            <button
              id="consolidate-months-ewt-btn"
              onClick={onConsolidateMonths}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors shadow-xs"
              title="Consolidate Month 1, Month 2, and Month 3 line items into this Quarterly Return"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Consolidate M1-M3 Lines</span>
            </button>
          )}

          <button
            id="open-penalties-ewt-btn"
            onClick={() => setShowPenalties(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Late Penalties</span>
          </button>

          <button
            id="save-ewt-period-btn"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-xs"
          >
            {saveStatus ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveStatus || `Save ${currentMonthName} Data`}</span>
          </button>
        </div>
      </div>

      {/* If in Quarterly 1601-EQ view: Show Combined Monthly Summary Table */}
      {isQuarterView && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-700" />
              <span>Quarterly EWT Consolidation Schedule ({quarterMonths.join(', ')})</span>
            </div>
            <span className="text-xs text-teal-700 font-semibold">
              BIR Form 1601-EQ Consolidation
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-teal-200 text-teal-900 font-semibold">
                  <th className="py-2 px-3">Period</th>
                  <th className="py-2 px-3">BIR Form</th>
                  <th className="py-2 px-3 text-right">Tax Base</th>
                  <th className="py-2 px-3 text-right">Taxes Withheld</th>
                  <th className="py-2 px-3 text-right">Remitted via 0619-E</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Month 1: {quarterMonths[0]}</td>
                  <td className="py-2 px-3 font-mono text-teal-800">0619-E</td>
                  <td className="py-2 px-3 text-right font-mono">{formatPHP(m1Result?.totalTaxBase || 0, false)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">{formatPHP(m1Result?.totalTaxWithheld || 0, false)}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-700">
                    {formatPHP(m1Result?.totalTaxWithheld || 0, false)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => onSelectPeriodMode('m1')}
                      className="text-[11px] text-teal-700 hover:text-teal-900 underline font-medium cursor-pointer"
                    >
                      View M1
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Month 2: {quarterMonths[1]}</td>
                  <td className="py-2 px-3 font-mono text-teal-800">0619-E</td>
                  <td className="py-2 px-3 text-right font-mono">{formatPHP(m2Result?.totalTaxBase || 0, false)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">{formatPHP(m2Result?.totalTaxWithheld || 0, false)}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-700">
                    {formatPHP(m2Result?.totalTaxWithheld || 0, false)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => onSelectPeriodMode('m2')}
                      className="text-[11px] text-teal-700 hover:text-teal-900 underline font-medium cursor-pointer"
                    >
                      View M2
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-3 font-medium text-slate-800">Month 3: {quarterMonths[2]}</td>
                  <td className="py-2 px-3 font-mono text-teal-800">Quarter Close</td>
                  <td className="py-2 px-3 text-right font-mono">{formatPHP(m3Result?.totalTaxBase || 0, false)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">{formatPHP(m3Result?.totalTaxWithheld || 0, false)}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-400">-</td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => onSelectPeriodMode('m3')}
                      className="text-[11px] text-teal-700 hover:text-teal-900 underline font-medium cursor-pointer"
                    >
                      View M3
                    </button>
                  </td>
                </tr>

                <tr className="bg-teal-100/70 font-bold text-slate-900">
                  <td className="py-2 px-3">Total for {quarter}</td>
                  <td className="py-2 px-3 font-mono text-teal-900">1601-EQ Consolidated</td>
                  <td className="py-2 px-3 text-right font-mono">
                    {formatPHP(
                      (m1Result?.totalTaxBase || 0) + (m2Result?.totalTaxBase || 0) + (m3Result?.totalTaxBase || 0),
                      false
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-teal-900">
                    {formatPHP(
                      (m1Result?.totalTaxWithheld || 0) + (m2Result?.totalTaxWithheld || 0) + (m3Result?.totalTaxWithheld || 0),
                      false
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-800">
                    {formatPHP(totalMonthlyRemittedM1M2, false)}
                  </td>
                  <td className="py-2 px-3 text-center text-[11px] text-teal-900 font-semibold">
                    Combined
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Grid Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Expanded Withholding Tax Lines (ATC Breakdown)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {isQuarterView
                    ? `Full Quarterly Items for 1601-EQ (${quarter})`
                    : `Active Remittance Items for ${currentMonthName} (Form 0619-E)`}
                </div>
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

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs text-slate-400 py-1 mr-1">Quick Add:</span>
              {COMMON_ATC_PRESETS.slice(0, 4).map((p) => (
                <button
                  key={p.atc}
                  id={`preset-${p.atc}`}
                  onClick={() => handleAddLine(p)}
                  className="px-2 py-0.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded transition-colors"
                >
                  {p.atc} ({p.rate}%)
                </button>
              ))}
            </div>

            {/* Table of items */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-2 px-2 w-20">ATC Code</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-2 text-center w-16">Rate</th>
                    <th className="py-2 px-3 text-right w-36">Tax Base (₱)</th>
                    <th className="py-2 px-3 text-right w-32">Tax Withheld (₱)</th>
                    <th className="py-2 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.lineBreakdowns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No withholding lines added yet. Click &quot;Add Line&quot; or select a quick preset.
                      </td>
                    </tr>
                  ) : (
                    result.lineBreakdowns.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-2 font-mono">
                          <input
                            type="text"
                            value={line.atc}
                            onChange={(e) => handleUpdateLine(line.id, 'atc', e.target.value)}
                            className="w-full px-1.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-mono uppercase"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => handleUpdateLine(line.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
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
                        <td className="py-2 px-3 text-right font-semibold text-slate-900 font-mono">
                          {formatPHP(line.taxWithheld, false)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
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
                  {isQuarterView
                    ? 'Total Taxes Remitted in Form 0619-E (Month 1 + Month 2)'
                    : 'Tax Remitted in Previous Return / Adjustment'}
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
                {isQuarterView && totalMonthlyRemittedM1M2 > 0 && (
                  <button
                    onClick={() => onChange({ ...data, priorMonthTaxRemitted: totalMonthlyRemittedM1M2 })}
                    className="text-[11px] text-teal-700 hover:underline mt-1 block cursor-pointer"
                  >
                    Auto-fill M1+M2 Remitted: ₱{formatPHP(totalMonthlyRemittedM1M2, false)}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Overpayment Carried Over from Previous Quarter/Period
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

        {/* Right Summary Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {isQuarterView ? 'Quarterly 1601-EQ Summary' : 'Monthly 0619-E Summary'}
              </div>
              <span className="text-xs font-mono text-teal-700 font-semibold">{currentMonthName}</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Tax Base:</span>
                <span className="font-mono font-medium">{formatPHP(result.totalTaxBase)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-semibold">
                <span>Total Taxes Withheld:</span>
                <span className="font-mono">{formatPHP(result.totalTaxWithheld)}</span>
              </div>

              {(data.priorMonthTaxRemitted > 0 || data.overpaymentPreviousPeriod > 0) && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  {data.priorMonthTaxRemitted > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Less: Form 0619-E Remitted:</span>
                      <span className="font-mono text-emerald-700">
                        -{formatPHP(data.priorMonthTaxRemitted, false)}
                      </span>
                    </div>
                  )}
                  {data.overpaymentPreviousPeriod > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Less: Previous Overpayment:</span>
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
                  {isQuarterView
                    ? 'Net Quarterly Tax Required to be Remitted'
                    : 'Net Monthly Tax Required to be Remitted'}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {formatPHP(Math.max(0, result.netAmountPayable))}
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  {isQuarterView
                    ? `Form 1601-EQ deadline: Last day of month following ${quarter}`
                    : `Form 0619-E deadline: On or before 10th of following month`}
                </div>
              </div>

              {/* Cumulative Amount Button right under NET TAX REQUIRED TO BE REMITTED */}
              <button
                id="btn-cumulative-amount-0619e"
                type="button"
                onClick={() => setShowCumulative(true)}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                title="View Cumulative Amount and monthly withholding tax progression"
              >
                <Calculator className="w-4 h-4" />
                <span>View Cumulative Amount</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <Cumulative0619EModal
        isOpen={showCumulative}
        onClose={() => setShowCumulative(false)}
        client={client}
        year={year}
        quarter={quarter}
        currentMonth={month}
        activePeriodMode={activePeriodMode}
        month1Data={month1Data}
        month2Data={month2Data}
        month3Data={month3Data}
        quarterCombinedData={quarterCombinedData}
        yearlyData={yearlyData}
      />

      <PenaltiesModal
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        basicTaxDue={result.netAmountPayable}
        formName={`${formBadge} (${currentMonthName} ${year})`}
      />
    </div>
  );
};
