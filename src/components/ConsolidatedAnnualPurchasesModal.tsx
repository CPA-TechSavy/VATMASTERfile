import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  ShoppingBag,
  Building2,
  Calendar,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowUpDown,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { Quarter, ClientProfile } from '../types/tax';
import { BirTransactionRow } from '../types/branchVat';
import { formatPHP, parseNumber } from '../utils/formatters';

export interface QuarterlyPurchaseRecord extends BirTransactionRow {
  quarter: Quarter;
  quarterLabel: string;
  branchName?: string;
  sourceType?: 'uploaded_slsp' | 'manual_entry' | 'ewt_expense';
}

export interface CombinedSupplierRow {
  registeredName: string;
  tin: string;
  address: string;
  totalGrossAmount: number;
  totalTaxableAmount: number;
  totalInputTax: number;
  totalExemptAmount: number;
  totalZeroRatedAmount: number;
  totalGoodsAmount: number;
  totalServicesAmount: number;
  transactionCount: number;
  quarters: Quarter[];
  quarterlyBreakdown: Record<Quarter, { gross: number; taxable: number; inputTax: number; count: number }>;
  transactions: QuarterlyPurchaseRecord[];
}

interface ConsolidatedAnnualPurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  year: number;
}

// Sample benchmark vendor purchases for Philippine corporate / individual tax filings
const SAMPLE_BENCHMARK_PURCHASES: Omit<QuarterlyPurchaseRecord, 'rowNum'>[] = [
  // MERALCO
  {
    taxableMonth: '01/2026',
    tin: '000-101-528-000',
    registeredName: 'MANILA ELECTRIC COMPANY (MERALCO)',
    address: 'Ortigas Ave, Pasig City, Metro Manila',
    grossAmount: 145600,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 130000,
    servicesAmount: 130000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 15600,
    grossTaxableAmount: 130000,
    quarter: 'Q1',
    quarterLabel: 'Q1 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '04/2026',
    tin: '000-101-528-000',
    registeredName: 'MANILA ELECTRIC COMPANY (MERALCO)',
    address: 'Ortigas Ave, Pasig City, Metro Manila',
    grossAmount: 156800,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 140000,
    servicesAmount: 140000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 16800,
    grossTaxableAmount: 140000,
    quarter: 'Q2',
    quarterLabel: 'Q2 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '07/2026',
    tin: '000-101-528-000',
    registeredName: 'MANILA ELECTRIC COMPANY (MERALCO)',
    address: 'Ortigas Ave, Pasig City, Metro Manila',
    grossAmount: 162400,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 145000,
    servicesAmount: 145000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 17400,
    grossTaxableAmount: 145000,
    quarter: 'Q3',
    quarterLabel: 'Q3 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '10/2026',
    tin: '000-101-528-000',
    registeredName: 'MANILA ELECTRIC COMPANY (MERALCO)',
    address: 'Ortigas Ave, Pasig City, Metro Manila',
    grossAmount: 151200,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 135000,
    servicesAmount: 135000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 16200,
    grossTaxableAmount: 135000,
    quarter: 'Q4',
    quarterLabel: 'Q4 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },

  // PLDT
  {
    taxableMonth: '02/2026',
    tin: '000-112-921-000',
    registeredName: 'PLDT INC.',
    address: 'Ramon Cojuangco Bldg, Makati Ave, Makati City',
    grossAmount: 56000,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 50000,
    servicesAmount: 50000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 6000,
    grossTaxableAmount: 50000,
    quarter: 'Q1',
    quarterLabel: 'Q1 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '05/2026',
    tin: '000-112-921-000',
    registeredName: 'PLDT INC.',
    address: 'Ramon Cojuangco Bldg, Makati Ave, Makati City',
    grossAmount: 58240,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 52000,
    servicesAmount: 52000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 6240,
    grossTaxableAmount: 52000,
    quarter: 'Q2',
    quarterLabel: 'Q2 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '08/2026',
    tin: '000-112-921-000',
    registeredName: 'PLDT INC.',
    address: 'Ramon Cojuangco Bldg, Makati Ave, Makati City',
    grossAmount: 56000,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 50000,
    servicesAmount: 50000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 6000,
    grossTaxableAmount: 50000,
    quarter: 'Q3',
    quarterLabel: 'Q3 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '11/2026',
    tin: '000-112-921-000',
    registeredName: 'PLDT INC.',
    address: 'Ramon Cojuangco Bldg, Makati Ave, Makati City',
    grossAmount: 56000,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 50000,
    servicesAmount: 50000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 6000,
    grossTaxableAmount: 50000,
    quarter: 'Q4',
    quarterLabel: 'Q4 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },

  // PETRON
  {
    taxableMonth: '03/2026',
    tin: '000-168-801-000',
    registeredName: 'PETRON CORPORATION',
    address: 'San Miguel Ave, Mandaluyong City',
    grossAmount: 89600,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 80000,
    servicesAmount: 0,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 80000,
    taxAmount: 9600,
    grossTaxableAmount: 80000,
    quarter: 'Q1',
    quarterLabel: 'Q1 2026',
    branchName: 'Logistics',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '06/2026',
    tin: '000-168-801-000',
    registeredName: 'PETRON CORPORATION',
    address: 'San Miguel Ave, Mandaluyong City',
    grossAmount: 112000,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 100000,
    servicesAmount: 0,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 100000,
    taxAmount: 12000,
    grossTaxableAmount: 100000,
    quarter: 'Q2',
    quarterLabel: 'Q2 2026',
    branchName: 'Logistics',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '09/2026',
    tin: '000-168-801-000',
    registeredName: 'PETRON CORPORATION',
    address: 'San Miguel Ave, Mandaluyong City',
    grossAmount: 95200,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 85000,
    servicesAmount: 0,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 85000,
    taxAmount: 10200,
    grossTaxableAmount: 85000,
    quarter: 'Q3',
    quarterLabel: 'Q3 2026',
    branchName: 'Logistics',
    sourceType: 'manual_entry',
  },

  // SM PRIME HOLDINGS / LEASING
  {
    taxableMonth: '02/2026',
    tin: '000-482-124-000',
    registeredName: 'SM PRIME HOLDINGS, INC.',
    address: 'JW Diokno Blvd, MOA Complex, Pasay City',
    grossAmount: 280000,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 250000,
    servicesAmount: 250000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 30000,
    grossTaxableAmount: 250000,
    quarter: 'Q1',
    quarterLabel: 'Q1 2026',
    branchName: 'Branch 1',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '05/2026',
    tin: '000-482-124-000',
    registeredName: 'SM PRIME HOLDINGS, INC.',
    address: 'JW Diokno Blvd, MOA Complex, Pasay City',
    grossAmount: 280000,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 250000,
    servicesAmount: 250000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 30000,
    grossTaxableAmount: 250000,
    quarter: 'Q2',
    quarterLabel: 'Q2 2026',
    branchName: 'Branch 1',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '08/2026',
    tin: '000-482-124-000',
    registeredName: 'SM PRIME HOLDINGS, INC.',
    address: 'JW Diokno Blvd, MOA Complex, Pasay City',
    grossAmount: 280000,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 250000,
    servicesAmount: 250000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 30000,
    grossTaxableAmount: 250000,
    quarter: 'Q3',
    quarterLabel: 'Q3 2026',
    branchName: 'Branch 1',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '11/2026',
    tin: '000-482-124-000',
    registeredName: 'SM PRIME HOLDINGS, INC.',
    address: 'JW Diokno Blvd, MOA Complex, Pasay City',
    grossAmount: 280000,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 250000,
    servicesAmount: 250000,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 0,
    taxAmount: 30000,
    grossTaxableAmount: 250000,
    quarter: 'Q4',
    quarterLabel: 'Q4 2026',
    branchName: 'Branch 1',
    sourceType: 'manual_entry',
  },

  // OFFICE WAREHOUSE
  {
    taxableMonth: '01/2026',
    tin: '004-891-230-000',
    registeredName: 'OFFICE WAREHOUSE, INC.',
    address: 'Deca Homes, Mandaluyong City',
    grossAmount: 33600,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 30000,
    servicesAmount: 0,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 30000,
    taxAmount: 3600,
    grossTaxableAmount: 30000,
    quarter: 'Q1',
    quarterLabel: 'Q1 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },
  {
    taxableMonth: '07/2026',
    tin: '004-891-230-000',
    registeredName: 'OFFICE WAREHOUSE, INC.',
    address: 'Deca Homes, Mandaluyong City',
    grossAmount: 42560,
    exemptAmount: 0,
    zeroRatedAmount: 0,
    taxableAmount: 38000,
    servicesAmount: 0,
    capitalGoodsAmount: 0,
    goodsOtherThanCapitalAmount: 38000,
    taxAmount: 4560,
    grossTaxableAmount: 38000,
    quarter: 'Q3',
    quarterLabel: 'Q3 2026',
    branchName: 'Head Office',
    sourceType: 'manual_entry',
  },
];

export const ConsolidatedAnnualPurchasesModal: React.FC<ConsolidatedAnnualPurchasesModalProps> = ({
  isOpen,
  onClose,
  client,
  year,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [quarterFilter, setQuarterFilter] = useState<'all' | Quarter>('all');
  const [sortBy, setSortBy] = useState<'amount_desc' | 'amount_asc' | 'name_asc' | 'txns_desc'>('amount_desc');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'combined' | 'transactions'>('combined');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Supplier form state
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierTin, setNewSupplierTin] = useState('');
  const [newSupplierQuarter, setNewSupplierQuarter] = useState<Quarter>('Q1');
  const [newSupplierAmount, setNewSupplierAmount] = useState('');
  const [newSupplierTax, setNewSupplierTax] = useState('');

  // Collect purchases across all 4 quarters from localStorage schedules + sample benchmarks
  const [manualCustomPurchases, setManualCustomPurchases] = useState<QuarterlyPurchaseRecord[]>(() => {
    try {
      const k = `bir_annual_purchases_${client.id}_${year}`;
      const saved = localStorage.getItem(k);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // Save custom purchases to localStorage
  const handleSaveCustomPurchases = (updated: QuarterlyPurchaseRecord[]) => {
    setManualCustomPurchases(updated);
    try {
      const k = `bir_annual_purchases_${client.id}_${year}`;
      localStorage.setItem(k, JSON.stringify(updated));
    } catch (e) {}
  };

  // Aggregated all raw purchases across Q1..Q4
  const allQuarterPurchases = useMemo(() => {
    const list: QuarterlyPurchaseRecord[] = [];
    const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

    quarters.forEach((q) => {
      try {
        const scheduleKey = `bir_branch_schedule_${client.id}_${year}_${q}`;
        const saved = localStorage.getItem(scheduleKey);
        if (saved) {
          const parsed = JSON.parse(saved);

          // Consolidated purchases file
          if (parsed.consolidatedPurchasesFile?.transactions) {
            parsed.consolidatedPurchasesFile.transactions.forEach((tx: BirTransactionRow) => {
              list.push({
                ...tx,
                quarter: q,
                quarterLabel: `${q} ${year}`,
                branchName: 'Consolidated Schedule',
                sourceType: 'uploaded_slsp',
              });
            });
          }

          // Per-branch purchases files
          if (Array.isArray(parsed.branches)) {
            parsed.branches.forEach((b: any) => {
              if (b?.purchasesFiles) {
                [1, 2, 3].forEach((mIdx) => {
                  const f = b.purchasesFiles[`month${mIdx}`];
                  if (f && Array.isArray(f.transactions)) {
                    f.transactions.forEach((tx: BirTransactionRow) => {
                      list.push({
                        ...tx,
                        quarter: q,
                        quarterLabel: `${q} ${year}`,
                        branchName: b.name || `Branch ${b.id}`,
                        sourceType: 'uploaded_slsp',
                      });
                    });
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.error(`Failed to read branch schedule for ${q}`, err);
      }
    });

    // Add manual custom purchases
    manualCustomPurchases.forEach((p) => list.push(p));

    // If no purchases exist at all, include sample benchmark vendors to demonstrate multi-quarter aggregation
    if (list.length === 0) {
      SAMPLE_BENCHMARK_PURCHASES.forEach((sp, idx) => {
        list.push({
          ...sp,
          rowNum: idx + 1,
        });
      });
    }

    return list;
  }, [client.id, year, manualCustomPurchases]);

  // COMBINE PURCHASES BY REGISTERED NAME
  const combinedSuppliers = useMemo(() => {
    const map = new Map<string, CombinedSupplierRow>();

    allQuarterPurchases.forEach((tx) => {
      const rawName = (tx.registeredName || 'UNNAMED SUPPLIER').trim();
      const normalizedKey = rawName.toUpperCase().replace(/\s+/g, ' ');

      const existing = map.get(normalizedKey);
      const gross = Number(tx.grossAmount) || Number(tx.taxableAmount) || 0;
      const taxable = Number(tx.taxableAmount) || 0;
      const inputTax = Number(tx.taxAmount) || Math.round(taxable * 0.12);
      const exempt = Number(tx.exemptAmount) || 0;
      const zeroRated = Number(tx.zeroRatedAmount) || 0;
      const goods = Number(tx.goodsOtherThanCapitalAmount || tx.capitalGoodsAmount) || 0;
      const services = Number(tx.servicesAmount) || 0;

      if (existing) {
        existing.totalGrossAmount += gross;
        existing.totalTaxableAmount += taxable;
        existing.totalInputTax += inputTax;
        existing.totalExemptAmount += exempt;
        existing.totalZeroRatedAmount += zeroRated;
        existing.totalGoodsAmount += goods;
        existing.totalServicesAmount += services;
        existing.transactionCount += 1;

        if (!existing.quarters.includes(tx.quarter)) {
          existing.quarters.push(tx.quarter);
          existing.quarters.sort();
        }

        const qb = existing.quarterlyBreakdown[tx.quarter];
        if (qb) {
          qb.gross += gross;
          qb.taxable += taxable;
          qb.inputTax += inputTax;
          qb.count += 1;
        }

        if (tx.tin && !existing.tin) existing.tin = tx.tin;
        if (tx.address && !existing.address) existing.address = tx.address;

        existing.transactions.push(tx);
      } else {
        map.set(normalizedKey, {
          registeredName: rawName,
          tin: tx.tin || '',
          address: tx.address || '',
          totalGrossAmount: gross,
          totalTaxableAmount: taxable,
          totalInputTax: inputTax,
          totalExemptAmount: exempt,
          totalZeroRatedAmount: zeroRated,
          totalGoodsAmount: goods,
          totalServicesAmount: services,
          transactionCount: 1,
          quarters: [tx.quarter],
          quarterlyBreakdown: {
            Q1: { gross: tx.quarter === 'Q1' ? gross : 0, taxable: tx.quarter === 'Q1' ? taxable : 0, inputTax: tx.quarter === 'Q1' ? inputTax : 0, count: tx.quarter === 'Q1' ? 1 : 0 },
            Q2: { gross: tx.quarter === 'Q2' ? gross : 0, taxable: tx.quarter === 'Q2' ? taxable : 0, inputTax: tx.quarter === 'Q2' ? inputTax : 0, count: tx.quarter === 'Q2' ? 1 : 0 },
            Q3: { gross: tx.quarter === 'Q3' ? gross : 0, taxable: tx.quarter === 'Q3' ? taxable : 0, inputTax: tx.quarter === 'Q3' ? inputTax : 0, count: tx.quarter === 'Q3' ? 1 : 0 },
            Q4: { gross: tx.quarter === 'Q4' ? gross : 0, taxable: tx.quarter === 'Q4' ? taxable : 0, inputTax: tx.quarter === 'Q4' ? inputTax : 0, count: tx.quarter === 'Q4' ? 1 : 0 },
          },
          transactions: [tx],
        });
      }
    });

    let list = Array.from(map.values());

    // Apply Quarter filter
    if (quarterFilter !== 'all') {
      list = list.filter((s) => s.quarters.includes(quarterFilter));
    }

    // Apply Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.registeredName.toLowerCase().includes(q) ||
          s.tin.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
      );
    }

    // Apply Sort
    list.sort((a, b) => {
      if (sortBy === 'amount_desc') return b.totalGrossAmount - a.totalGrossAmount;
      if (sortBy === 'amount_asc') return a.totalGrossAmount - b.totalGrossAmount;
      if (sortBy === 'name_asc') return a.registeredName.localeCompare(b.registeredName);
      if (sortBy === 'txns_desc') return b.transactionCount - a.transactionCount;
      return 0;
    });

    return list;
  }, [allQuarterPurchases, quarterFilter, searchQuery, sortBy]);

  // Overall totals
  const overallTotals = useMemo(() => {
    return combinedSuppliers.reduce(
      (acc, s) => {
        acc.totalGross += s.totalGrossAmount;
        acc.totalTaxable += s.totalTaxableAmount;
        acc.totalInputTax += s.totalInputTax;
        acc.totalTxns += s.transactionCount;
        return acc;
      },
      { totalGross: 0, totalTaxable: 0, totalInputTax: 0, totalTxns: 0 }
    );
  }, [combinedSuppliers]);

  // Handle adding custom purchase item
  const handleAddSupplierPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    const gross = parseNumber(newSupplierAmount);
    const taxable = gross / 1.12;
    const inputTax = newSupplierTax ? parseNumber(newSupplierTax) : gross - taxable;

    const newRecord: QuarterlyPurchaseRecord = {
      rowNum: manualCustomPurchases.length + 1,
      taxableMonth: `${newSupplierQuarter} ${year}`,
      tin: newSupplierTin.trim(),
      registeredName: newSupplierName.trim().toUpperCase(),
      address: '',
      grossAmount: gross,
      exemptAmount: 0,
      zeroRatedAmount: 0,
      taxableAmount: taxable,
      servicesAmount: 0,
      capitalGoodsAmount: 0,
      goodsOtherThanCapitalAmount: taxable,
      taxAmount: inputTax,
      grossTaxableAmount: taxable,
      quarter: newSupplierQuarter,
      quarterLabel: `${newSupplierQuarter} ${year}`,
      branchName: 'Manual Entry',
      sourceType: 'manual_entry',
    };

    handleSaveCustomPurchases([...manualCustomPurchases, newRecord]);
    setNewSupplierName('');
    setNewSupplierTin('');
    setNewSupplierAmount('');
    setNewSupplierTax('');
    setShowAddModal(false);
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'Registered Name',
      'TIN',
      'Quarters',
      'Total Transactions',
      'Q1 Gross',
      'Q2 Gross',
      'Q3 Gross',
      'Q4 Gross',
      'Total Taxable Amount',
      'Total Input Tax',
      'Combined Total Purchases',
    ];

    const rows = combinedSuppliers.map((s) => [
      `"${s.registeredName.replace(/"/g, '""')}"`,
      `"${s.tin}"`,
      `"${s.quarters.join(', ')}"`,
      s.transactionCount,
      s.quarterlyBreakdown.Q1.gross.toFixed(2),
      s.quarterlyBreakdown.Q2.gross.toFixed(2),
      s.quarterlyBreakdown.Q3.gross.toFixed(2),
      s.quarterlyBreakdown.Q4.gross.toFixed(2),
      s.totalTaxableAmount.toFixed(2),
      s.totalInputTax.toFixed(2),
      s.totalGrossAmount.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Consolidated_Purchases_${client.tin}_TY${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Consolidated List of Purchases from Quarters (Q1–Q4)
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-full">
                  TY {year}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Combined by Registered Name
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {client.registeredName} ({client.tin}) • Purchases with identical supplier names combined across quarters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="export-purchases-csv-btn"
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Export consolidated purchases table to CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              id="close-consolidated-purchases-btn"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
                Combined Gross Purchases
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-950 mt-1">
                {formatPHP(overallTotals.totalGross)}
              </div>
              <div className="text-[11px] text-indigo-700 mt-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Aggregated across all 4 quarters</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Total Input Tax (VAT)
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
                {formatPHP(overallTotals.totalInputTax)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                Creditable VAT on domestic purchases
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Unique Suppliers
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {combinedSuppliers.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Distinct registered business names
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Total Transactions
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {overallTotals.totalTxns}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Quarterly purchase vouchers & invoices
              </div>
            </div>
          </div>

          {/* Controls Bar: Search, Filters, Sort */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  id="search-purchases-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Registered Name, TIN, or Address..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Quarter Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  id="filter-quarter-select"
                  value={quarterFilter}
                  onChange={(e) => setQuarterFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="all">All Quarters (Q1–Q4)</option>
                  <option value="Q1">Quarter 1 Only</option>
                  <option value="Q2">Quarter 2 Only</option>
                  <option value="Q3">Quarter 3 Only</option>
                  <option value="Q4">Quarter 4 Only</option>
                </select>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  id="sort-purchases-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="amount_desc">Highest Combined Amount</option>
                  <option value="amount_asc">Lowest Combined Amount</option>
                  <option value="name_asc">Supplier Name (A to Z)</option>
                  <option value="txns_desc">Most Transactions</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('combined')}
                  className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                    viewMode === 'combined'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Combined Suppliers
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('transactions')}
                  className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                    viewMode === 'transactions'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Invoices ({allQuarterPurchases.length})
                </button>
              </div>

              <button
                type="button"
                id="btn-add-purchase-item"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
                title="Add a supplier purchase voucher"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Purchase</span>
              </button>
            </div>
          </div>

          {/* Main Table Content */}
          {viewMode === 'combined' ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Supplier Registered Name & TIN</th>
                      <th className="py-2.5 px-3 text-center">Quarters</th>
                      <th className="py-2.5 px-3 text-center">Invoices</th>
                      <th className="py-2.5 px-3 text-right">Q1 Amount</th>
                      <th className="py-2.5 px-3 text-right">Q2 Amount</th>
                      <th className="py-2.5 px-3 text-right">Q3 Amount</th>
                      <th className="py-2.5 px-3 text-right">Q4 Amount</th>
                      <th className="py-2.5 px-3 text-right font-medium text-emerald-800">Total Input VAT</th>
                      <th className="py-2.5 px-3 text-right font-bold text-indigo-950 bg-indigo-50/70">
                        Combined Amount
                      </th>
                      <th className="py-2.5 px-2 text-center w-12">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {combinedSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                          No purchases found matching the current search or filters.
                        </td>
                      </tr>
                    ) : (
                      combinedSuppliers.map((supplier) => {
                        const isExpanded = expandedSupplier === supplier.registeredName;
                        return (
                          <React.Fragment key={supplier.registeredName}>
                            <tr
                              className={`transition-colors hover:bg-slate-50/80 ${
                                isExpanded ? 'bg-indigo-50/30' : ''
                              }`}
                            >
                              <td className="py-3 px-3 font-sans">
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span>{supplier.registeredName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    TIN: {supplier.tin || 'N/A'}
                                    {supplier.address && (
                                      <span className="font-sans text-slate-400 ml-2 truncate max-w-[240px] inline-block align-bottom">
                                        • {supplier.address}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center font-sans">
                                <div className="flex items-center justify-center gap-1">
                                  {(['Q1', 'Q2', 'Q3', 'Q4'] as Quarter[]).map((q) => {
                                    const hasQ = supplier.quarters.includes(q);
                                    return (
                                      <span
                                        key={q}
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                          hasQ
                                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                            : 'bg-slate-100 text-slate-300'
                                        }`}
                                      >
                                        {q}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center font-sans text-slate-600">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[11px]">
                                  {supplier.transactionCount}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-right text-slate-600">
                                {supplier.quarterlyBreakdown.Q1.gross > 0
                                  ? formatPHP(supplier.quarterlyBreakdown.Q1.gross)
                                  : '—'}
                              </td>

                              <td className="py-3 px-3 text-right text-slate-600">
                                {supplier.quarterlyBreakdown.Q2.gross > 0
                                  ? formatPHP(supplier.quarterlyBreakdown.Q2.gross)
                                  : '—'}
                              </td>

                              <td className="py-3 px-3 text-right text-slate-600">
                                {supplier.quarterlyBreakdown.Q3.gross > 0
                                  ? formatPHP(supplier.quarterlyBreakdown.Q3.gross)
                                  : '—'}
                              </td>

                              <td className="py-3 px-3 text-right text-slate-600">
                                {supplier.quarterlyBreakdown.Q4.gross > 0
                                  ? formatPHP(supplier.quarterlyBreakdown.Q4.gross)
                                  : '—'}
                              </td>

                              <td className="py-3 px-3 text-right font-medium text-emerald-800">
                                {formatPHP(supplier.totalInputTax)}
                              </td>

                              <td className="py-3 px-3 text-right font-bold text-indigo-950 bg-indigo-50/50">
                                {formatPHP(supplier.totalGrossAmount)}
                              </td>

                              <td className="py-3 px-2 text-center font-sans">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSupplier(isExpanded ? null : supplier.registeredName)
                                  }
                                  className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                  title="Expand individual invoices breakdown"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-indigo-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Sub-table of Invoices for this Supplier */}
                            {isExpanded && (
                              <tr className="bg-slate-50/90">
                                <td colSpan={10} className="p-4">
                                  <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                      <span>
                                        Quarterly Transactions Breakdown for {supplier.registeredName} ({supplier.transactions.length} record{supplier.transactions.length === 1 ? '' : 's'})
                                      </span>
                                      <span className="text-slate-500 font-normal">
                                        Combined Total: <strong className="font-mono text-indigo-900">{formatPHP(supplier.totalGrossAmount)}</strong>
                                      </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-[11px] text-left border-collapse">
                                        <thead>
                                          <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                                            <th className="py-1.5 px-2">Quarter / Month</th>
                                            <th className="py-1.5 px-2">Branch / Schedule</th>
                                            <th className="py-1.5 px-2 text-right">Taxable Amount</th>
                                            <th className="py-1.5 px-2 text-right">Input Tax (12%)</th>
                                            <th className="py-1.5 px-2 text-right font-semibold text-slate-900">
                                              Gross Total
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {supplier.transactions.map((tx, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                              <td className="py-1.5 px-2 font-sans">
                                                <span className="px-1.5 py-0.2 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded font-semibold text-[10px] mr-1.5">
                                                  {tx.quarter}
                                                </span>
                                                <span className="text-slate-700">{tx.taxableMonth || tx.quarterLabel}</span>
                                              </td>
                                              <td className="py-1.5 px-2 font-sans text-slate-600">
                                                {tx.branchName || 'Head Office'}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-slate-700">
                                                {formatPHP(tx.taxableAmount || 0)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-emerald-700">
                                                {formatPHP(tx.taxAmount || 0)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right font-bold text-slate-900">
                                                {formatPHP(tx.grossAmount || tx.taxableAmount || 0)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 font-mono">
                      <td className="py-3 px-3 font-sans">
                        Total Consolidated Purchases ({combinedSuppliers.length} Suppliers)
                      </td>
                      <td className="py-3 px-3 text-center font-sans text-xs text-slate-500">
                        Q1–Q4
                      </td>
                      <td className="py-3 px-3 text-center font-sans text-xs">
                        {overallTotals.totalTxns} txns
                      </td>
                      <td className="py-3 px-3 text-right">
                        {formatPHP(
                          combinedSuppliers.reduce((sum, s) => sum + s.quarterlyBreakdown.Q1.gross, 0)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {formatPHP(
                          combinedSuppliers.reduce((sum, s) => sum + s.quarterlyBreakdown.Q2.gross, 0)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {formatPHP(
                          combinedSuppliers.reduce((sum, s) => sum + s.quarterlyBreakdown.Q3.gross, 0)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {formatPHP(
                          combinedSuppliers.reduce((sum, s) => sum + s.quarterlyBreakdown.Q4.gross, 0)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-800">
                        {formatPHP(overallTotals.totalInputTax)}
                      </td>
                      <td className="py-3 px-3 text-right text-indigo-950 font-extrabold bg-indigo-100/70 text-sm">
                        {formatPHP(overallTotals.totalGross)}
                      </td>
                      <td className="py-3 px-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* All Individual Invoices Table */
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Quarter</th>
                      <th className="py-2.5 px-3">Month / Date</th>
                      <th className="py-2.5 px-3">Supplier Registered Name</th>
                      <th className="py-2.5 px-3">TIN</th>
                      <th className="py-2.5 px-3">Branch / Location</th>
                      <th className="py-2.5 px-3 text-right">Taxable Purchases</th>
                      <th className="py-2.5 px-3 text-right">Input Tax</th>
                      <th className="py-2.5 px-3 text-right font-bold text-slate-900">Gross Purchases</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {allQuarterPurchases.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-sans">
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded font-semibold text-[10px]">
                            {tx.quarter}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600">{tx.taxableMonth}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                          {tx.registeredName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{tx.tin || '—'}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-500">{tx.branchName || 'Head Office'}</td>
                        <td className="py-2.5 px-3 text-right">{formatPHP(tx.taxableAmount || 0)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700">{formatPHP(tx.taxAmount || 0)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatPHP(tx.grossAmount || tx.taxableAmount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 font-mono">
                      <td colSpan={5} className="py-3 px-3 font-sans">
                        Full-Year Total Purchases ({allQuarterPurchases.length} Invoices)
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {formatPHP(
                          allQuarterPurchases.reduce((sum, tx) => sum + (Number(tx.taxableAmount) || 0), 0)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-800 font-mono">
                        {formatPHP(
                          allQuarterPurchases.reduce((sum, tx) => sum + (Number(tx.taxAmount) || 0), 0)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-indigo-950 font-bold font-mono">
                        {formatPHP(
                          allQuarterPurchases.reduce(
                            (sum, tx) => sum + (Number(tx.grossAmount) || Number(tx.taxableAmount) || 0),
                            0
                          )
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Note: All quarterly purchases with the same Registered Name are consolidated into a combined annual sum.
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

      {/* Add Supplier Purchase Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">Add Supplier Purchase Voucher</h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSupplierPurchase} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Supplier Registered Name *
                </label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="e.g. MANILA ELECTRIC COMPANY"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Entries with the same name are automatically consolidated together.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Supplier TIN</label>
                  <input
                    type="text"
                    value={newSupplierTin}
                    onChange={(e) => setNewSupplierTin(e.target.value)}
                    placeholder="000-000-000-000"
                    className="w-full px-3 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Quarter *</label>
                  <select
                    value={newSupplierQuarter}
                    onChange={(e) => setNewSupplierQuarter(e.target.value as Quarter)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="Q1">Quarter 1</option>
                    <option value="Q2">Quarter 2</option>
                    <option value="Q3">Quarter 3</option>
                    <option value="Q4">Quarter 4</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Gross Amount (₱) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={newSupplierAmount}
                    onChange={(e) => setNewSupplierAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-right"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Input VAT (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSupplierTax}
                    onChange={(e) => setNewSupplierTax(e.target.value)}
                    placeholder="Auto 12%"
                    className="w-full px-3 py-1.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
                >
                  Add Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
