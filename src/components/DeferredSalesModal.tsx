import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Building,
  CheckSquare,
  Square,
  Calculator,
  RotateCcw,
  Check,
  Filter,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { MonthIndex, ClientBranchSchedule, BirTransactionRow, SalesDeferralState } from '../types/branchVat';

interface DeferredSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTransactions: Array<
    BirTransactionRow & {
      monthIndex: MonthIndex;
      monthLabel: string;
      monthName: string;
      branchName: string;
      branchId: string;
    }
  >;
  branches: ClientBranchSchedule[];
  deferralState: SalesDeferralState;
  onSave: (newState: SalesDeferralState) => void;
  totalActualTaxableSales: number;
  totalActualOutputTax: number;
}

export const DeferredSalesModal: React.FC<DeferredSalesModalProps> = ({
  isOpen,
  onClose,
  allTransactions,
  branches,
  deferralState,
  onSave,
  totalActualTaxableSales,
  totalActualOutputTax,
}) => {
  const [activeTab, setActiveTab] = useState<'specific' | 'manual'>('specific');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(deferralState.deferredCustomerKeys || []);
  const [manualTaxable, setManualTaxable] = useState<string>(
    deferralState.manualTaxableSales ? deferralState.manualTaxableSales.toString() : ''
  );
  const [manualVatDue, setManualVatDue] = useState<string>(
    deferralState.manualVatDue ? deferralState.manualVatDue.toString() : ''
  );
  const [prevQuarterHideAmount, setPrevQuarterHideAmount] = useState<string>(
    deferralState.previousQuarterHideAmount ? deferralState.previousQuarterHideAmount.toString() : ''
  );
  const [prevQuarterHideOutputTax, setPrevQuarterHideOutputTax] = useState<string>(
    deferralState.previousQuarterHideOutputTax ? deferralState.previousQuarterHideOutputTax.toString() : ''
  );

  // Filters for Specific Companies tab
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<'all' | string>('all');
  const [monthFilter, setMonthFilter] = useState<'all' | 1 | 2 | 3>('all');

  const formatPHP = (val: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  // Helper to generate unique key for a transaction
  const getTxKey = (tx: (typeof allTransactions)[0]) => {
    return `${tx.branchId}_${tx.monthIndex}_${tx.tin || 'NOTIN'}_${tx.rowNum}`;
  };

  // Bi-directional calculations for manual inputs
  const handleVatDueChange = (valStr: string) => {
    setManualVatDue(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      // Work back to get Taxable Sales: Taxable = VAT Due / 0.12
      const computedTaxable = num / 0.12;
      setManualTaxable(computedTaxable.toFixed(2));
    } else {
      setManualTaxable('');
    }
  };

  const handleTaxableChange = (valStr: string) => {
    setManualTaxable(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      // Work out to get VAT Due: VAT Due = Taxable * 0.12
      const computedVat = num * 0.12;
      setManualVatDue(computedVat.toFixed(2));
    } else {
      setManualVatDue('');
    }
  };

  const handlePrevQuarterHideTaxableChange = (valStr: string) => {
    setPrevQuarterHideAmount(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      setPrevQuarterHideOutputTax((num * 0.12).toFixed(2));
    } else {
      setPrevQuarterHideOutputTax('');
    }
  };

  const handlePrevQuarterHideOutputTaxChange = (valStr: string) => {
    setPrevQuarterHideOutputTax(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      setPrevQuarterHideAmount((num / 0.12).toFixed(2));
    } else {
      setPrevQuarterHideAmount('');
    }
  };

  // Toggle selection for a specific customer transaction
  const handleToggleKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Filtered transactions for the specific companies list
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (monthFilter !== 'all' && tx.monthIndex !== monthFilter) return false;
      if (branchFilter !== 'all' && tx.branchId !== branchFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = tx.registeredName?.toLowerCase().includes(q);
        const matchTin = tx.tin?.toLowerCase().includes(q);
        const matchBranch = tx.branchName?.toLowerCase().includes(q);
        return Boolean(matchName || matchTin || matchBranch);
      }
      return true;
    });
  }, [allTransactions, monthFilter, branchFilter, searchQuery]);

  // Select all filtered
  const handleSelectAllFiltered = () => {
    const keysToAdd = filteredTransactions.map(getTxKey);
    setSelectedKeys((prev) => Array.from(new Set([...prev, ...keysToAdd])));
  };

  // Clear filtered selection
  const handleDeselectAllFiltered = () => {
    const keysToRemove = new Set(filteredTransactions.map(getTxKey));
    setSelectedKeys((prev) => prev.filter((k) => !keysToRemove.has(k)));
  };

  // Compute specific deferral totals from selected keys
  const selectedSpecificTotals = useMemo(() => {
    const selectedKeySet = new Set(selectedKeys);
    return allTransactions.reduce(
      (acc, tx) => {
        if (selectedKeySet.has(getTxKey(tx))) {
          acc.taxable += tx.taxableAmount || 0;
          acc.outputTax += tx.taxAmount || 0;
          acc.count += 1;
        }
        return acc;
      },
      { taxable: 0, outputTax: 0, count: 0 }
    );
  }, [allTransactions, selectedKeys]);

  const numManualTaxable = parseFloat(manualTaxable) || 0;
  const numManualVatDue = parseFloat(manualVatDue) || 0;

  // Grand combined deferrals
  const grandTotalDeferredTaxable = selectedSpecificTotals.taxable + numManualTaxable;
  const grandTotalDeferredOutputTax = selectedSpecificTotals.outputTax + numManualVatDue;

  // Adjusted new basis
  const newBasisTaxable = Math.max(0, totalActualTaxableSales - grandTotalDeferredTaxable);
  const newBasisOutputTax = Math.max(0, totalActualOutputTax - grandTotalDeferredOutputTax);

  const numPrevQuarterHideAmount = parseFloat(prevQuarterHideAmount) || 0;
  const numPrevQuarterHideOutputTax = parseFloat(prevQuarterHideOutputTax) || 0;

  const handleSave = () => {
    onSave({
      deferredCustomerKeys: selectedKeys,
      manualTaxableSales: numManualTaxable,
      manualVatDue: numManualVatDue,
      previousQuarterHideAmount: numPrevQuarterHideAmount,
      previousQuarterHideOutputTax: numPrevQuarterHideOutputTax,
    });
    onClose();
  };

  const handleClearAll = () => {
    setSelectedKeys([]);
    setManualTaxable('');
    setManualVatDue('');
    setPrevQuarterHideAmount('');
    setPrevQuarterHideOutputTax('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-violet-500/30 text-violet-300 border border-violet-400/40">
                Sales Adjustments
              </span>
              <span className="text-xs text-slate-300">New Basis of Sales Calculation</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-1 text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-violet-400" />
              Deferred Sales & VAT Due Management
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Exclude specific customer sales from the current quarter, or enter a manual Taxable Sales / VAT Due deferral amount. Manual amounts are automatically pro-rated across branches.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 sm:px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('specific')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'specific'
                ? 'border-violet-600 text-violet-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Specific Companies (Combined Sales Data)</span>
            {selectedKeys.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-violet-100 text-violet-800 text-[10px] font-extrabold">
                {selectedKeys.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'manual'
                ? 'border-violet-600 text-violet-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Manual VAT Due / Taxable Sales Deferral</span>
            {(numManualTaxable > 0 || numManualVatDue > 0) && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'specific' ? (
            <div className="space-y-3">
              {/* Instructions and Controls */}
              <div className="bg-violet-50/60 p-3 rounded-xl border border-violet-100 text-xs text-violet-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold">Select individual companies to defer:</span> Sales from selected entities will be excluded from the current quarter's sales balance.
                </div>
                <div className="font-semibold text-slate-800">
                  {selectedKeys.length} item(s) selected ({formatPHP(selectedSpecificTotals.taxable)} Taxable / {formatPHP(selectedSpecificTotals.outputTax)} Output VAT)
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search company name, TIN, branch..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="py-1.5 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="all">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={monthFilter}
                    onChange={(e) =>
                      setMonthFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 1 | 2 | 3))
                    }
                    className="py-1.5 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="all">All Months</option>
                    <option value="1">1st Month</option>
                    <option value="2">2nd Month</option>
                    <option value="3">3rd Month</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-2.5 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 cursor-pointer"
                  >
                    Select Filtered
                  </button>

                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Deselect Filtered
                  </button>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs max-h-[340px]">
                {allTransactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50">
                    <p className="font-semibold text-slate-700">No Combined Sales transactions loaded yet.</p>
                    <p className="mt-1 text-slate-500">
                      Upload SLSP Sales Excel/CSV files in the Branch VAT Schedule to view and defer specific individual customers.
                    </p>
                    <p className="mt-2 text-violet-700 font-medium">
                      You can also use the "Manual VAT Due / Taxable Sales Deferral" tab above to defer an aggregate amount directly.
                    </p>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50">
                    No transactions match the search filters.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="py-2.5 px-3">Registered Name</th>
                        <th className="py-2.5 px-2">TIN</th>
                        <th className="py-2.5 px-2">Branch</th>
                        <th className="py-2.5 px-2">Month</th>
                        <th className="py-2.5 px-3 text-right">Taxable Sales</th>
                        <th className="py-2.5 px-3 text-right">Output VAT (12%)</th>
                        <th className="py-2.5 px-3 text-right">Gross Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredTransactions.map((tx) => {
                        const key = getTxKey(tx);
                        const isSelected = selectedKeys.includes(key);
                        return (
                          <tr
                            key={key}
                            onClick={() => handleToggleKey(key)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-violet-50/70 hover:bg-violet-100/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-violet-700 inline-block" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 inline-block" />
                              )}
                            </td>
                            <td className="py-2 px-3 font-sans font-medium text-slate-900 max-w-[220px] truncate">
                              <span className={isSelected ? 'font-bold text-violet-950' : ''}>
                                {tx.registeredName || 'Unknown Customer'}
                              </span>
                              {isSelected && (
                                <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-violet-200 text-violet-800 uppercase">
                                  Deferred
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-slate-700">{tx.tin || '—'}</td>
                            <td className="py-2 px-2 font-sans text-slate-600 truncate max-w-[130px]">
                              {tx.branchName}
                            </td>
                            <td className="py-2 px-2 font-sans text-slate-600">{tx.monthLabel}</td>
                            <td className="py-2 px-3 text-right font-semibold text-slate-900">
                              {formatPHP(tx.taxableAmount)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-violet-700">
                              {formatPHP(tx.taxAmount)}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500">
                              {formatPHP(tx.grossAmount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto py-2">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  Bi-directional Deferral Calculation:
                </div>
                <p>
                  • If you enter <strong>VAT Due to be deferred</strong>, the system works back (divided by 0.12) to calculate the corresponding <strong>Taxable Sales</strong>.
                </p>
                <p>
                  • If you enter <strong>Taxable Sales to be deferred</strong>, the system works out (multiplied by 0.12) to calculate the corresponding <strong>VAT Due</strong>.
                </p>
                <p className="pt-1 text-slate-600 italic">
                  The deferred amount will adjust the total taxable sales & output tax and be pro-rated across branches according to their sales shares.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Field 1: VAT Due */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-violet-900">
                    VAT Due (Output Tax) to Defer (₱)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Input output tax to be deferred (e.g. 12,000.00)
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
                      value={manualVatDue}
                      onChange={(e) => handleVatDueChange(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                {/* Field 2: Taxable Sales */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                    Taxable Sales to Defer (₱)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Input taxable sales to be deferred (e.g. 100,000.00)
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
                      value={manualTaxable}
                      onChange={(e) => handleTaxableChange(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">Quick Presets:</span>
                {[5000, 10000, 25000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleTaxableChange(amt.toString())}
                    className="px-2 py-1 text-xs bg-slate-100 hover:bg-violet-100 text-slate-700 hover:text-violet-800 rounded font-mono transition-colors cursor-pointer"
                  >
                    ₱{amt.toLocaleString()} Taxable
                  </button>
                ))}
                {(numManualTaxable > 0 || numManualVatDue > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualTaxable('');
                      setManualVatDue('');
                    }}
                    className="px-2 py-1 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 rounded font-medium transition-colors cursor-pointer"
                  >
                    Clear Manual
                  </button>
                )}
              </div>

              {/* Section: Previous Quarter Hide Amount */}
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      Previous Quarter Hide Amount (Deferred from Prior Quarter)
                    </span>
                    {numPrevQuarterHideAmount > 0 && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        Tracked for Reconciliation
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Enter the previous quarter's hide amount (uncollected / deferred sales or output tax) to be included in the Summary of Deferrals & Variance Reconciliation report.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Previous Quarter Hide Taxable Sales (₱)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={prevQuarterHideAmount}
                          onChange={(e) => handlePrevQuarterHideTaxableChange(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Previous Quarter Hide VAT Due (₱)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={prevQuarterHideOutputTax}
                          onChange={(e) => handlePrevQuarterHideOutputTaxChange(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Consolidated Impact Preview Box */}
          <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-violet-400" />
                Computation Summary & New Basis of Sales
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {selectedKeys.length} Company(ies) Deferred • Manual: {formatPHP(numManualTaxable)}
                {numPrevQuarterHideAmount > 0 && ` • Prev Qtr Hide: ${formatPHP(numPrevQuarterHideAmount)}`}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              {/* Taxable Sales Impact */}
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/70 space-y-1.5">
                <div className="flex justify-between text-slate-300 font-sans">
                  <span>Actual Taxable Sales:</span>
                  <span className="font-mono font-medium text-white">{formatPHP(totalActualTaxableSales)}</span>
                </div>
                <div className="flex justify-between text-rose-400 font-sans">
                  <span>Less Total Deferred Taxable:</span>
                  <span className="font-mono font-bold">-{formatPHP(grandTotalDeferredTaxable)}</span>
                </div>
                <div className="border-t border-slate-700 pt-1.5 flex justify-between text-emerald-400 font-bold text-sm">
                  <span className="font-sans">New Basis (Taxable Sales):</span>
                  <span>{formatPHP(newBasisTaxable)}</span>
                </div>
              </div>

              {/* Output VAT Impact */}
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/70 space-y-1.5">
                <div className="flex justify-between text-slate-300 font-sans">
                  <span>Actual Output VAT:</span>
                  <span className="font-mono font-medium text-white">{formatPHP(totalActualOutputTax)}</span>
                </div>
                <div className="flex justify-between text-rose-400 font-sans">
                  <span>Less Total Deferred Output Tax:</span>
                  <span className="font-mono font-bold">-{formatPHP(grandTotalDeferredOutputTax)}</span>
                </div>
                <div className="border-t border-slate-700 pt-1.5 flex justify-between text-violet-300 font-bold text-sm">
                  <span className="font-sans">New Basis (Output VAT):</span>
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
            <span>Clear All Deferrals</span>
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
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Deferral ({formatPHP(grandTotalDeferredTaxable)})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
