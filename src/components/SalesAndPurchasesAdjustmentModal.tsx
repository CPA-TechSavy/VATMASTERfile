import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  Check,
  TrendingUp,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ClientBranchSchedule,
  SalesAndPurchasesAdjustmentState,
  CombinedPurchasesItem,
} from '../types/branchVat';
import { ClientProfile, Quarter } from '../types/tax';

interface SalesAndPurchasesAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: ClientProfile;
  year?: number;
  quarter?: Quarter;
  allPurchasesTransactions?: CombinedPurchasesItem[];
  adjustmentState: SalesAndPurchasesAdjustmentState;
  onSave: (newState: SalesAndPurchasesAdjustmentState) => void;
  totalActualTaxableSales: number;
  totalActualOutputTax: number;
  totalActualTaxablePurchases?: number;
  totalActualInputTax?: number;
  branches?: ClientBranchSchedule[];
}

export const SalesAndPurchasesAdjustmentModal: React.FC<SalesAndPurchasesAdjustmentModalProps> = ({
  isOpen,
  onClose,
  quarter = 'Q2' as Quarter,
  adjustmentState,
  onSave,
  totalActualTaxableSales,
  totalActualOutputTax,
}) => {
  // Sales Increase State
  const [increaseTaxable, setIncreaseTaxable] = useState<string>(
    adjustmentState.increaseTaxableSales ? adjustmentState.increaseTaxableSales.toString() : ''
  );
  const [increaseOutputTax, setIncreaseOutputTax] = useState<string>(
    adjustmentState.increaseOutputTax ? adjustmentState.increaseOutputTax.toString() : ''
  );
  const [notes, setNotes] = useState<string>(adjustmentState.notes || '');

  const formatPHP = (val: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // Bi-directional calculations for Sales Increase
  const handleIncreaseTaxableChange = (valStr: string) => {
    setIncreaseTaxable(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      setIncreaseOutputTax((num * 0.12).toFixed(2));
    } else {
      setIncreaseOutputTax('');
    }
  };

  const handleIncreaseOutputTaxChange = (valStr: string) => {
    setIncreaseOutputTax(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      setIncreaseTaxable((num / 0.12).toFixed(2));
    } else {
      setIncreaseTaxable('');
    }
  };

  const numIncreaseTaxable = parseFloat(increaseTaxable) || 0;
  const numIncreaseOutputTax = parseFloat(increaseOutputTax) || 0;

  // New Basis Calculations
  const newBasisTaxableSales = totalActualTaxableSales + numIncreaseTaxable;
  const newBasisOutputTax = totalActualOutputTax + numIncreaseOutputTax;

  const handleSave = () => {
    onSave({
      increaseTaxableSales: numIncreaseTaxable,
      increaseOutputTax: numIncreaseOutputTax,
      decreaseTaxablePurchases: 0,
      decreaseInputTax: 0,
      reducedPurchaseKeys: [],
      specificPurchasesTaxable: 0,
      specificPurchasesInputTax: 0,
      notes: notes.trim(),
    });
    onClose();
  };

  const handleClearAll = () => {
    setIncreaseTaxable('');
    setIncreaseOutputTax('');
    setNotes('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Sales Adjustment (+)
              </span>
              <span className="text-xs text-slate-300 font-medium">{quarter} VAT Compliance</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-1 text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Increase Sales Adjustment
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Add taxable sales and output tax to this quarter's tax compliance declaration.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Additional Taxable Sales &amp; Output Tax
              </span>
              <p className="text-[11px] text-emerald-800">
                Enter the amount of taxable sales you want to ADD to this quarter. Output tax automatically calculates at 12% (and vice-versa).
              </p>
            </div>
            {numIncreaseTaxable > 0 && (
              <div className="font-bold text-xs bg-emerald-100 border border-emerald-300 text-emerald-900 px-2.5 py-1 rounded-lg shrink-0">
                +{formatPHP(numIncreaseTaxable)} Sales (+{formatPHP(numIncreaseOutputTax)} VAT)
              </div>
            )}
          </div>

          {/* Dual Bi-directional Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Field 1: Taxable Sales to Increase */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                <span>Taxable Sales to Increase (₱)</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-semibold">
                  Col H (+)
                </span>
              </label>
              <p className="text-[11px] text-slate-500">
                Input additional taxable sales (e.g. 50,000.00)
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                  ₱
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={increaseTaxable}
                  onChange={(e) => handleIncreaseTaxableChange(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Field 2: Output VAT to Increase */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center justify-between">
                <span>VAT Due / Output Tax (12%) to Increase (₱)</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-semibold">
                  Col L (+)
                </span>
              </label>
              <p className="text-[11px] text-slate-500">
                Input additional output VAT (e.g. 6,000.00)
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                  ₱
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={increaseOutputTax}
                  onChange={(e) => handleIncreaseOutputTaxChange(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Quick presets for Sales */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Quick Presets:</span>
            {[5000, 10000, 25000, 50000, 100000, 250000, 500000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleIncreaseTaxableChange(amt.toString())}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded font-mono transition-colors cursor-pointer"
              >
                +₱{amt.toLocaleString()}
              </button>
            ))}
            {(numIncreaseTaxable > 0 || numIncreaseOutputTax > 0) && (
              <button
                type="button"
                onClick={() => {
                  setIncreaseTaxable('');
                  setIncreaseOutputTax('');
                }}
                className="px-2.5 py-1 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 rounded font-medium transition-colors cursor-pointer"
              >
                Clear Sales
              </button>
            )}
          </div>

          {/* Optional Memo / Reference Note */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Adjustment Note or Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Unbilled Qtr Sales / Audit adjustment / Target compliance optimization"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Live Computation & Impact Preview */}
          <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                Live Computation Summary &amp; New Basis
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Sales Addition: +{formatPHP(numIncreaseTaxable)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              {/* Taxable Sales */}
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/70 space-y-1">
                <div className="text-[10px] font-sans text-slate-400 uppercase font-semibold">
                  Taxable Sales (Col H)
                </div>
                <div className="flex justify-between text-slate-300 font-sans text-[11px]">
                  <span>Actual:</span>
                  <span className="font-mono">{formatPHP(totalActualTaxableSales)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-sans text-[11px]">
                  <span>+ Increase:</span>
                  <span className="font-mono font-bold">+{formatPHP(numIncreaseTaxable)}</span>
                </div>
                <div className="border-t border-slate-700 pt-1 flex justify-between text-emerald-300 font-bold">
                  <span className="font-sans">New Basis:</span>
                  <span>{formatPHP(newBasisTaxableSales)}</span>
                </div>
              </div>

              {/* Output VAT */}
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/70 space-y-1">
                <div className="text-[10px] font-sans text-slate-400 uppercase font-semibold">
                  Output VAT (12% Col L)
                </div>
                <div className="flex justify-between text-slate-300 font-sans text-[11px]">
                  <span>Actual:</span>
                  <span className="font-mono">{formatPHP(totalActualOutputTax)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-sans text-[11px]">
                  <span>+ Increase:</span>
                  <span className="font-mono font-bold">+{formatPHP(numIncreaseOutputTax)}</span>
                </div>
                <div className="border-t border-slate-700 pt-1 flex justify-between text-teal-300 font-bold">
                  <span className="font-sans">New Basis:</span>
                  <span>{formatPHP(newBasisOutputTax)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="apply-sales-adjustment-btn"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                Apply Sales Increase (+{formatPHP(numIncreaseTaxable)})
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const IncreaseSalesModal = SalesAndPurchasesAdjustmentModal;
