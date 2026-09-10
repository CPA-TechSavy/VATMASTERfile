import React, { useState } from 'react';
import { X, AlertCircle, Calculator } from 'lucide-react';
import { PenaltiesData } from '../types/tax';
import { calculatePenalties } from '../utils/taxCalculations';
import { formatPHP } from '../utils/formatters';

interface PenaltiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  basicTaxDue: number;
  formName: string;
}

export const PenaltiesModal: React.FC<PenaltiesModalProps> = ({
  isOpen,
  onClose,
  basicTaxDue,
  formName,
}) => {
  const [penalties, setPenalties] = useState<PenaltiesData>({
    daysLate: 30,
    includeSurcharge: true,
    includeInterest: true,
    includeCompromise: true,
  });

  if (!isOpen) return null;

  const validTax = Math.max(0, basicTaxDue);
  const result = calculatePenalties(validTax, penalties);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        id="penalties-modal-card"
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-semibold">BIR Late Filing / Penalty Calculator</h2>
          </div>
          <button
            id="close-penalties-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-amber-800 hover:text-amber-950 hover:bg-amber-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">{formName}</div>
              <div className="text-sm font-semibold text-slate-800">Basic Tax Due to BIR</div>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {formatPHP(validTax)}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Days Elapsed Past Statutory Due Date
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="days-late-input"
                  type="number"
                  min="1"
                  max="3650"
                  value={penalties.daysLate || ''}
                  onChange={(e) =>
                    setPenalties({ ...penalties, daysLate: parseInt(e.target.value) || 0 })
                  }
                  className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                />
                <span className="text-xs text-slate-500">
                  Approx. {(penalties.daysLate / 30).toFixed(1)} month(s)
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2 border-t border-slate-100">
              <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                <span className="flex items-center gap-2">
                  <input
                    id="penalty-surcharge-toggle"
                    type="checkbox"
                    checked={penalties.includeSurcharge}
                    onChange={(e) =>
                      setPenalties({ ...penalties, includeSurcharge: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>25% Surcharge (Sec. 248)</span>
                </span>
                <span className="font-mono font-medium text-slate-800">
                  {formatPHP(result.surcharge)}
                </span>
              </label>

              <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                <span className="flex items-center gap-2">
                  <input
                    id="penalty-interest-toggle"
                    type="checkbox"
                    checked={penalties.includeInterest}
                    onChange={(e) =>
                      setPenalties({ ...penalties, includeInterest: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>12% p.a. Deficiency Interest (EOPT Act / Sec. 249)</span>
                </span>
                <span className="font-mono font-medium text-slate-800">
                  {formatPHP(result.interest)}
                </span>
              </label>

              <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                <span className="flex items-center gap-2">
                  <input
                    id="penalty-compromise-toggle"
                    type="checkbox"
                    checked={penalties.includeCompromise}
                    onChange={(e) =>
                      setPenalties({ ...penalties, includeCompromise: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Compromise Penalty (BIR Schedule)</span>
                </span>
                <span className="font-mono font-medium text-slate-800">
                  {formatPHP(result.compromise)}
                </span>
              </label>
            </div>
          </div>

          <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-amber-900">
              <span>Total Penalties</span>
              <span className="font-mono font-semibold">{formatPHP(result.totalPenalties)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-amber-950 pt-2 border-t border-amber-200">
              <span>Total Amount Payable to BIR</span>
              <span className="text-base font-mono text-amber-900">
                {formatPHP(result.totalAmountPayable)}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="done-penalties-btn"
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
