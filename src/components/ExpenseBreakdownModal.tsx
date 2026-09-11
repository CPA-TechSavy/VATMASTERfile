import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calculator, Check, AlertCircle } from 'lucide-react';
import { ExpenseAccountItem } from '../types/tax';
import { formatPHP } from '../utils/formatters';

interface ExpenseBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'cogs' | 'itemized';
  currentAmount: number;
  initialItems?: ExpenseAccountItem[];
  onApply: (items: ExpenseAccountItem[], total: number) => void;
}

const COMMON_COGS_ACCOUNTS = [
  'Merchandise Purchases / Raw Materials',
  'Direct Labor & Production Wages',
  'Manufacturing / Project Overhead',
  'Subcontracted & Outsourced Services',
  'Freight-In & Handling Costs',
  'Operating Site / Machinery Rental',
  'Direct Supplies & Consumables',
  'Depreciation of Plant & Equipment',
  'Factory Utilities (Power, Water, Gas)',
  'Other Direct Operational Costs',
];

const COMMON_ITEMIZED_ACCOUNTS = [
  'Salaries, Wages & Allowances',
  '13th Month Pay & Employee Benefits',
  'SSS, PhilHealth & Pag-IBIG Contributions',
  'Office Rent & Facilities Lease',
  'Taxes & Licenses (Mayor\'s Permit, LGU)',
  'Professional & Legal / Audit Fees',
  'Electricity, Water & Utilities',
  'Internet & Telecommunications',
  'Depreciation & Amortization',
  'Repairs & Maintenance (IT & Office)',
  'Representation & Entertainment',
  'Advertising & Marketing Expenses',
  'Transportation & Travel Expenses',
  'Office Supplies & Stationeries',
  'Insurance Premiums',
  'Fuel, Oil & Lubricants',
  'Bank Service Charges',
  'Miscellaneous Operating Expenses',
];

export const ExpenseBreakdownModal: React.FC<ExpenseBreakdownModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
  currentAmount,
  initialItems = [],
  onApply,
}) => {
  const [items, setItems] = useState<ExpenseAccountItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (initialItems && initialItems.length > 0) {
        setItems(initialItems);
      } else if (currentAmount > 0) {
        // Prepopulate a line with current amount if no items exist
        setItems([
          {
            id: 'item_1',
            accountName: type === 'cogs' ? 'Cost of Goods Sold (Unitemized)' : 'Operating Expenses (Unitemized)',
            amount: currentAmount,
          },
        ]);
      } else {
        setItems([
          {
            id: 'item_1',
            accountName: type === 'cogs' ? 'Merchandise Purchases / Raw Materials' : 'Salaries, Wages & Allowances',
            amount: 0,
          },
        ]);
      }
    }
  }, [isOpen, initialItems, currentAmount, type]);

  if (!isOpen) return null;

  const totalAmount = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const diff = totalAmount - currentAmount;

  const handleAddItem = (accountName = '') => {
    const newItem: ExpenseAccountItem = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      accountName,
      amount: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof ExpenseAccountItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleSaveAndApply = () => {
    // Filter out items without an account name or 0 amount if empty
    const validItems = items.filter((it) => it.accountName.trim() !== '' || it.amount > 0);
    onApply(validItems, totalAmount);
    onClose();
  };

  const commonList = type === 'cogs' ? COMMON_COGS_ACCOUNTS : COMMON_ITEMIZED_ACCOUNTS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 rounded">
                {type === 'cogs' ? 'Cost of Sales' : 'Schedule 6 Deductions'}
              </span>
              <span className="text-xs text-slate-500 font-medium">Itemized Accounts Breakdown</span>
            </div>
            <h3 className="text-base font-bold text-slate-800 mt-1">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Add Suggestions */}
        <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100/60">
          <div className="text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
            <span>Quick-add standard BIR expense accounts:</span>
            <span className="text-slate-400 font-normal">Click to insert account row</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {commonList.slice(0, 8).map((acc) => (
              <button
                key={acc}
                type="button"
                onClick={() => handleAddItem(acc)}
                className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-900 border border-blue-200/80 rounded-md transition-colors text-left flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-blue-500 shrink-0" />
                <span>{acc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Item Rows List */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Calculator className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-medium">No expense accounts added yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Click "Add Account Line" or select from the standard account buttons above.
              </p>
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Account</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1 border-b border-slate-100">
                <div className="col-span-7 sm:col-span-8">Expense Account Title / Description</div>
                <div className="col-span-4 sm:col-span-3 text-right">Amount (PHP)</div>
                <div className="col-span-1 text-center">Action</div>
              </div>

              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center bg-slate-50/60 p-2 rounded-lg border border-slate-200/80 hover:border-slate-300 transition-colors"
                >
                  <div className="col-span-7 sm:col-span-8">
                    <input
                      type="text"
                      value={item.accountName}
                      onChange={(e) => handleUpdateItem(item.id, 'accountName', e.target.value)}
                      placeholder="e.g. Raw Materials, Office Rent, Wages"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-medium text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-3 relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">₱</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount || ''}
                      onChange={(e) =>
                        handleUpdateItem(item.id, 'amount', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono text-right bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="Delete account line"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border border-blue-200/70"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Account Line</span>
                </button>
                <span className="text-[11px] text-slate-500 font-mono">
                  {items.length} {items.length === 1 ? 'account line' : 'account lines'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary & Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Itemized Breakdown:</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-slate-900">
                {formatPHP(totalAmount)}
              </span>
              {currentAmount > 0 && Math.abs(diff) > 0.01 && (
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                    diff > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                  title="Difference compared to currently entered amount on return"
                >
                  <AlertCircle className="w-3 h-3" />
                  {diff > 0 ? `+${formatPHP(diff)}` : `-${formatPHP(Math.abs(diff))}`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply & Sync to Return</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
