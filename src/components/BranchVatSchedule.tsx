import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ClientProfile, Quarter, Data2550Q } from '../types/tax';
import {
  ClientBranchSchedule,
  BirUploadedFileRecord,
  PurchasesReportingMode,
  MonthIndex,
  BirTransactionRow,
  SalesDeferralState,
} from '../types/branchVat';
import {
  downloadBirSlspExcelTemplate,
  parseBirSlspExcelFile,
} from '../utils/excelVatTemplate';
import { formatPHP } from '../utils/formatters';
import { exportMultiBranchAnd2550QPdf, exportVatComparisonPdf } from '../utils/pdfExport';
import { getPriorQuarterExcessInputVat } from '../utils/taxCalculations';
import { DeferredSalesModal } from './DeferredSalesModal';
import { CombinedPurchasesModal, CombinedPurchasesRow } from './CombinedPurchasesModal';
import {
  Building,
  Plus,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Table,
  Check,
  RotateCcw,
  Eye,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Loader2,
  Search,
  Calculator,
  Landmark,
  CheckSquare,
  Square,
  Filter,
  Sparkles,
  Tag,
  CheckCheck,
} from 'lucide-react';

interface BranchVatScheduleProps {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  formType: '2550Q' | '2551Q';
  data2550Q?: Data2550Q;
  onSync2550Q?: (data: {
    vatableSales: number;
    salesToGovernment?: number;
    zeroRatedSales: number;
    vatExemptSales: number;
    inputPurchasesGoods: number;
    inputPurchasesServices: number;
    inputCapitalGoods: number;
    priorQuarterExcessInputVat?: number;
  }) => void;
  onSync2551Q?: (data: {
    grossSales: number;
    exemptSales: number;
    vatableSales?: number;
    salesToGovernment?: number;
    zeroRatedSales?: number;
    vatExemptSales?: number;
  }) => void;
  onBranchScheduleChange?: (state: {
    branches: ClientBranchSchedule[];
    purchasesMode: PurchasesReportingMode;
    consolidatedPurchasesFile?: BirUploadedFileRecord;
    deferralState?: SalesDeferralState;
    schedule1Computed?: {
      vatableSales: number;
      salesToGovernment: number;
      zeroRatedSales: number;
      vatExemptSales: number;
      inputPurchasesGoods: number;
      priorQuarterExcessInputVat?: number;
    };
  }) => void;
}

const getMonthLabelsForQuarter = (quarter: Quarter): { index: MonthIndex; label: string; name: string }[] => {
  switch (quarter) {
    case 'Q1':
      return [
        { index: 1, label: '1st Month', name: 'January' },
        { index: 2, label: '2nd Month', name: 'February' },
        { index: 3, label: '3rd Month', name: 'March' },
      ];
    case 'Q2':
      return [
        { index: 1, label: '1st Month', name: 'April' },
        { index: 2, label: '2nd Month', name: 'May' },
        { index: 3, label: '3rd Month', name: 'June' },
      ];
    case 'Q3':
      return [
        { index: 1, label: '1st Month', name: 'July' },
        { index: 2, label: '2nd Month', name: 'August' },
        { index: 3, label: '3rd Month', name: 'September' },
      ];
    case 'Q4':
      return [
        { index: 1, label: '1st Month', name: 'October' },
        { index: 2, label: '2nd Month', name: 'November' },
        { index: 3, label: '3rd Month', name: 'December' },
      ];
  }
};

export const BranchVatSchedule: React.FC<BranchVatScheduleProps> = ({
  client,
  quarter,
  year,
  formType,
  data2550Q,
  onSync2550Q,
  onSync2551Q,
  onBranchScheduleChange,
}) => {
  const isNonVat = client.vatStatus === 'non-vat' || formType === '2551Q';
  const isVat = !isNonVat && formType === '2550Q';
  const monthList = getMonthLabelsForQuarter(quarter);
  const storageKey = `bir_branch_schedule_${client.id}_${year}_${quarter}`;

  // Combined Quarterly Sales Modal state
  const [showCombinedSalesModal, setShowCombinedSalesModal] = useState(false);
  const [showCombinedPurchasesModal, setShowCombinedPurchasesModal] = useState(false);
  const [combinedSalesFilterMonth, setCombinedSalesFilterMonth] = useState<'all' | 1 | 2 | 3>('all');
  const [combinedSalesSearchQuery, setCombinedSalesSearchQuery] = useState('');
  const [combinedSalesBranchFilter, setCombinedSalesBranchFilter] = useState<'all' | string>('all');
  const [combinedSalesCustomerFilter, setCombinedSalesCustomerFilter] = useState<string>('all');
  const [combinedSalesTagFilter, setCombinedSalesTagFilter] = useState<'all' | 'govt' | '2307' | 'both' | 'none'>('all');
  const [checklistFeedbackMsg, setChecklistFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Sales Checklist state: Government Sales & 2307 Certificates (persisted per client/quarter)
  const [governmentSalesKeys, setGovernmentSalesKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.governmentSalesKeys)) return parsed.governmentSalesKeys;
        if (parsed.salesChecklist?.governmentSalesKeys) return parsed.salesChecklist.governmentSalesKeys;
      }
    } catch (e) {
      console.error('Failed to load government sales keys', e);
    }
    return [];
  });

  const [has2307SalesKeys, setHas2307SalesKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.has2307SalesKeys)) return parsed.has2307SalesKeys;
        if (parsed.salesChecklist?.has2307SalesKeys) return parsed.salesChecklist.has2307SalesKeys;
      }
    } catch (e) {
      console.error('Failed to load 2307 sales keys', e);
    }
    return [];
  });

  // Branches state
  const [branches, setBranches] = useState<ClientBranchSchedule[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.branches && parsed.branches.length > 0) return parsed.branches;
      }
    } catch (e) {
      console.error('Failed to load branch schedule', e);
    }
    return [
      {
        id: 'branch-main',
        name: client.tradeName ? `${client.tradeName} - Main Office` : 'Main Branch / Head Office',
        salesFiles: {},
        purchasesFiles: {},
      },
    ];
  });

  // Client Branch structure: Has branches vs. Single unit (no branches)
  const [hasBranches, setHasBranches] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.hasBranches === 'boolean') return parsed.hasBranches;
      }
    } catch (e) {}
    if (typeof client.hasBranches === 'boolean') return client.hasBranches;
    return false;
  });

  useEffect(() => {
    if (typeof client.hasBranches === 'boolean') {
      setHasBranches(client.hasBranches);
    }
  }, [client.id, client.hasBranches]);

  // Purchases Mode state: 'consolidated' or 'per-branch'
  const [purchasesMode, setPurchasesMode] = useState<PurchasesReportingMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.purchasesMode) return parsed.purchasesMode;
      }
    } catch (e) {
      console.error('Failed to load purchases mode', e);
    }
    return 'consolidated';
  });

  // Consolidated purchases file (if purchasesMode === 'consolidated')
  const [consolidatedPurchasesFile, setConsolidatedPurchasesFile] = useState<BirUploadedFileRecord | undefined>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.consolidatedPurchasesFile) return parsed.consolidatedPurchasesFile;
      }
    } catch (e) {
      console.error('Failed to load consolidated purchases', e);
    }
    return undefined;
  });

  // Sales Deferral State (Specific customer exclusions & manual taxable / VAT due deferrals)
  const [deferralState, setDeferralState] = useState<SalesDeferralState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.deferralState) return parsed.deferralState;
      }
    } catch (e) {
      console.error('Failed to load deferral state', e);
    }
    return {
      deferredCustomerKeys: [],
      manualTaxableSales: 0,
      manualVatDue: 0,
    };
  });

  const [showDeferralModal, setShowDeferralModal] = useState(false);
  const [summaryViewMode, setSummaryViewMode] = useState<'actual' | 'adjusted'>('actual');

  // UI state
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string>(branches[0]?.id || 'branch-main');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchName, setEditingBranchName] = useState<string>('');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<BirUploadedFileRecord | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<ClientBranchSchedule | null>(null);

  // Horizontal branch tab scrolling ref & state
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingComparisonPdf, setIsExportingComparisonPdf] = useState(false);

  const checkScrollState = () => {
    const el = tabsContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
  };

  useEffect(() => {
    checkScrollState();
    const el = tabsContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollState);
    window.addEventListener('resize', checkScrollState);
    return () => {
      el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [branches.length]);

  // Auto scroll active tab into view when activeBranchId changes
  useEffect(() => {
    if (activeBranchId && tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector(`[data-branch-id="${activeBranchId}"]`);
      if (activeEl) {
        (activeEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    checkScrollState();
  }, [activeBranchId, branches.length]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = 240;
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScrollState, 200);
    }
  };

  // Hidden file input handling
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentUploadTarget = useRef<{
    fileType: 'sales' | 'purchases';
    branchId?: string;
    monthIndex?: MonthIndex | 'consolidated';
  } | null>(null);

  // Keep ref to onBranchScheduleChange to prevent infinite loop from parent re-renders
  const onBranchScheduleChangeRef = useRef(onBranchScheduleChange);
  useEffect(() => {
    onBranchScheduleChangeRef.current = onBranchScheduleChange;
  }, [onBranchScheduleChange]);

  const lastEmittedScheduleStateRef = useRef<string>('');

  // Save to localStorage whenever branches, purchasesMode, consolidatedPurchasesFile, hasBranches, deferralState, or checklist tags change
  useEffect(() => {
    try {
      const payload = {
        branches,
        purchasesMode,
        consolidatedPurchasesFile,
        hasBranches,
        deferralState,
        governmentSalesKeys,
        has2307SalesKeys,
      };
      const serialized = JSON.stringify(payload);
      localStorage.setItem(storageKey, serialized);

      // Only invoke callback if serialized data actually changed
      if (lastEmittedScheduleStateRef.current !== serialized) {
        lastEmittedScheduleStateRef.current = serialized;
        onBranchScheduleChangeRef.current?.({
          branches,
          purchasesMode,
          consolidatedPurchasesFile,
          deferralState,
        });
      }
    } catch (e) {
      console.error('Failed to persist branch schedule', e);
    }
  }, [branches, purchasesMode, consolidatedPurchasesFile, hasBranches, deferralState, governmentSalesKeys, has2307SalesKeys, storageKey]);

  // Sync activeBranchId if list changes
  useEffect(() => {
    if (!branches.some((b) => b.id === activeBranchId) && branches.length > 0) {
      setActiveBranchId(branches[0].id);
    }
  }, [branches, activeBranchId]);

  // Handle Add Branch
  const handleAddBranch = () => {
    const newIndex = branches.length + 1;
    const newBranch: ClientBranchSchedule = {
      id: `branch-${Date.now()}`,
      name: `Branch ${newIndex} - Line of Business`,
      salesFiles: {},
      purchasesFiles: {},
    };
    setBranches([...branches, newBranch]);
    setActiveBranchId(newBranch.id);
    setSyncSuccessMsg(`Added new branch "${newBranch.name}".`);
  };

  // Handle Remove / Delete Branch via in-app confirmation modal
  const handleRemoveBranch = (id: string) => {
    const branchToRemove = branches.find((b) => b.id === id);
    if (branchToRemove) {
      setBranchToDelete(branchToRemove);
    }
  };

  const handleConfirmDeleteBranch = () => {
    if (!branchToDelete) return;
    const targetId = branchToDelete.id;
    const targetName = branchToDelete.name;

    if (branches.length <= 1) {
      // If deleting the only branch in the schedule, reset it to a clean blank branch
      const resetBranch: ClientBranchSchedule = {
        id: `branch-${Date.now()}`,
        name: hasBranches ? 'Branch 1 - Main Office' : 'Main Branch / Head Office',
        salesFiles: {},
        purchasesFiles: {},
      };
      setBranches([resetBranch]);
      setActiveBranchId(resetBranch.id);
      setSyncSuccessMsg(`Branch "${targetName}" data and uploaded files have been deleted.`);
    } else {
      const updated = branches.filter((b) => b.id !== targetId);
      setBranches(updated);
      if (activeBranchId === targetId && updated.length > 0) {
        setActiveBranchId(updated[0].id);
      }
      setSyncSuccessMsg(`Branch "${targetName}" has been successfully deleted.`);
    }
    setBranchToDelete(null);
  };

  // Handle Edit Branch Name directly
  const handleUpdateBranchName = (id: string, newName: string) => {
    setBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name: newName } : b))
    );
  };

  // Handle Rename Branch via modal/inline
  const handleSaveRename = (id: string) => {
    if (!editingBranchName.trim()) {
      setEditingBranchId(null);
      return;
    }
    handleUpdateBranchName(id, editingBranchName.trim());
    setEditingBranchId(null);
  };

  // Handle Download Template
  const handleDownloadTemplate = (
    type: 'Sales' | 'Purchases',
    monthIndex: MonthIndex | 'consolidated',
    branchName?: string
  ) => {
    const monthLabel =
      monthIndex === 'consolidated'
        ? 'Consolidated'
        : monthIndex === 1
        ? '1st Month'
        : monthIndex === 2
        ? '2nd Month'
        : '3rd Month';

    downloadBirSlspExcelTemplate({
      type,
      quarter,
      monthLabel,
      client,
      branchName,
      includeSampleRow: false,
      formType,
    });
  };

  // Trigger File Upload Dialog
  const triggerFileUpload = (
    fileType: 'sales' | 'purchases',
    monthIndex: MonthIndex | 'consolidated',
    branchId?: string
  ) => {
    currentUploadTarget.current = { fileType, monthIndex, branchId };
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle File Input Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadTarget.current) return;

    const { fileType, monthIndex, branchId } = currentUploadTarget.current;
    setUploadErrorMsg(null);
    setSyncSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const currentBranch = branches.find((b) => b.id === branchId);
        const parsed = parseBirSlspExcelFile(
          buffer,
          file.name,
          fileType,
          monthIndex,
          branchId,
          currentBranch?.name,
          quarter
        );

        if (fileType === 'purchases' && monthIndex === 'consolidated') {
          setConsolidatedPurchasesFile(parsed);
          setSyncSuccessMsg(`Loaded Consolidated Purchases Excel (${parsed.rowCount} record(s))`);
        } else if (branchId) {
          const monthKey = monthIndex === 1 ? 'month1' : monthIndex === 2 ? 'month2' : 'month3';
          setBranches((prev) =>
            prev.map((b) => {
              if (b.id !== branchId) return b;
              if (fileType === 'sales') {
                return {
                  ...b,
                  salesFiles: {
                    ...b.salesFiles,
                    [monthKey]: parsed,
                  },
                };
              } else {
                return {
                  ...b,
                  purchasesFiles: {
                    ...(b.purchasesFiles || {}),
                    [monthKey]: parsed,
                  },
                };
              }
            })
          );
          setSyncSuccessMsg(
            `Loaded ${fileType === 'sales' ? 'Sales' : 'Purchases'} Excel for Month ${monthIndex} (${parsed.rowCount} record(s))`
          );
        }
      } catch (err: any) {
        console.error('Error parsing file', err);
        setUploadErrorMsg(`Failed to parse Excel file: ${err.message || 'Invalid format'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Remove Uploaded File
  const handleRemoveFile = (
    fileType: 'sales' | 'purchases',
    monthIndex: MonthIndex | 'consolidated',
    branchId?: string
  ) => {
    if (fileType === 'purchases' && monthIndex === 'consolidated') {
      setConsolidatedPurchasesFile(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSyncSuccessMsg('Consolidated Purchases document deleted. You can now upload the correct document.');
      return;
    }
    if (!branchId) return;
    const monthKey = monthIndex === 1 ? 'month1' : monthIndex === 2 ? 'month2' : 'month3';

    setBranches((prev) =>
      prev.map((b) => {
        if (b.id !== branchId) return b;
        if (fileType === 'sales') {
          const updated = { ...b.salesFiles };
          delete updated[monthKey];
          return { ...b, salesFiles: updated };
        } else {
          const updated = { ...(b.purchasesFiles || {}) };
          delete updated[monthKey];
          return { ...b, purchasesFiles: updated };
        }
      })
    );

    if (fileInputRef.current) fileInputRef.current.value = '';
    setSyncSuccessMsg(
      `Deleted ${fileType === 'sales' ? 'Sales' : 'Purchases'} ${monthIndex === 'consolidated' ? 'Consolidated' : `Month ${monthIndex}`} document. You can now upload the correct document.`
    );
  };

  // Aggregated Sales Transactions for the Entire Quarter across branches
  const allQuarterSalesTransactions = useMemo(() => {
    const list: Array<
      BirTransactionRow & {
        monthIndex: MonthIndex;
        monthLabel: string;
        monthName: string;
        branchName: string;
        branchId: string;
      }
    > = [];

    (branches || []).forEach((b) => {
      ([1, 2, 3] as const).forEach((mIdx) => {
        const file = b?.salesFiles?.[`month${mIdx}`];
        if (file && Array.isArray(file.transactions) && file.transactions.length > 0) {
          const mInfo = monthList.find((m) => m.index === mIdx);
          file.transactions.forEach((tx) => {
            list.push({
              ...tx,
              monthIndex: mIdx,
              monthLabel: mInfo?.label || `${mIdx} Month`,
              monthName: mInfo?.name || '',
              branchName: b.name,
              branchId: b.id,
            });
          });
        }
      });
    });

    return list;
  }, [branches, monthList]);

  // Aggregated Purchases Transactions across branches in the quarter (for Per-Branch purchases)
  const allQuarterPurchasesTransactions = useMemo(() => {
    const list: CombinedPurchasesRow[] = [];

    (branches || []).forEach((b) => {
      const pf = b?.purchasesFiles;
      if (!pf) return;
      ([1, 2, 3] as const).forEach((mIdx) => {
        const file = pf[`month${mIdx}`];
        if (file && Array.isArray(file.transactions) && file.transactions.length > 0) {
          const mInfo = monthList.find((m) => m.index === mIdx);
          file.transactions.forEach((tx) => {
            list.push({
              ...tx,
              monthIndex: mIdx,
              monthLabel: mInfo?.label || `${mIdx} Month`,
              monthName: mInfo?.name || '',
              branchName: b.name,
              branchId: b.id,
            });
          });
        }
      });
    });

    return list;
  }, [branches, monthList]);

  const totalQuarterPurchasesRowCount = allQuarterPurchasesTransactions.length;

  // Unique key helper for sales transactions
  const getSalesTxKey = (tx: {
    branchId: string;
    monthIndex: number;
    tin?: string;
    rowNum: number;
  }) => {
    return `${tx.branchId}_${tx.monthIndex}_${tx.tin || 'NOTIN'}_${tx.rowNum}`;
  };

  const governmentKeySet = useMemo(() => new Set(governmentSalesKeys), [governmentSalesKeys]);
  const has2307KeySet = useMemo(() => new Set(has2307SalesKeys), [has2307SalesKeys]);

  // Specific Deferrals from selected keys
  const deferredCustomersList = useMemo(() => {
    if (!deferralState.deferredCustomerKeys || deferralState.deferredCustomerKeys.length === 0) {
      return [];
    }
    const keySet = new Set(deferralState.deferredCustomerKeys);
    return allQuarterSalesTransactions.filter((tx) => {
      const txKey = getSalesTxKey(tx);
      return keySet.has(txKey);
    });
  }, [allQuarterSalesTransactions, deferralState.deferredCustomerKeys]);

  // Per-branch specific deferrals (distinguishing Government vs Regular Sales)
  const specificDeferralByBranch = useMemo(() => {
    const map: Record<
      string,
      {
        taxable: number;
        outputTax: number;
        exempt: number;
        zeroRated: number;
        count: number;
        specGovTaxable: number;
        specGovOutputTax: number;
        specRegularTaxable: number;
        specRegularOutputTax: number;
      }
    > = {};

    (branches || []).forEach((b) => {
      map[b.id] = {
        taxable: 0,
        outputTax: 0,
        exempt: 0,
        zeroRated: 0,
        count: 0,
        specGovTaxable: 0,
        specGovOutputTax: 0,
        specRegularTaxable: 0,
        specRegularOutputTax: 0,
      };
    });

    deferredCustomersList.forEach((tx) => {
      if (!map[tx.branchId]) {
        map[tx.branchId] = {
          taxable: 0,
          outputTax: 0,
          exempt: 0,
          zeroRated: 0,
          count: 0,
          specGovTaxable: 0,
          specGovOutputTax: 0,
          specRegularTaxable: 0,
          specRegularOutputTax: 0,
        };
      }
      const tAmt = tx.taxableAmount || 0;
      const vAmt = tx.taxAmount || 0;
      const txKey = getSalesTxKey(tx);
      const isGov = governmentKeySet.has(txKey);

      map[tx.branchId].taxable += tAmt;
      map[tx.branchId].outputTax += vAmt;
      map[tx.branchId].exempt += tx.exemptAmount || 0;
      map[tx.branchId].zeroRated += tx.zeroRatedAmount || 0;
      map[tx.branchId].count += 1;

      if (isGov) {
        map[tx.branchId].specGovTaxable += tAmt;
        map[tx.branchId].specGovOutputTax += vAmt;
      } else {
        map[tx.branchId].specRegularTaxable += tAmt;
        map[tx.branchId].specRegularOutputTax += vAmt;
      }
    });

    return map;
  }, [branches, deferredCustomersList, governmentKeySet]);

  // Total specific deferrals
  const totalSpecificDeferred = useMemo(() => {
    let taxable = 0;
    let outputTax = 0;
    let exempt = 0;
    let zeroRated = 0;
    let count = 0;
    let govTaxable = 0;
    let govOutputTax = 0;
    let regularTaxable = 0;
    let regularOutputTax = 0;

    deferredCustomersList.forEach((tx) => {
      const txKey = getSalesTxKey(tx);
      const isGov = governmentKeySet.has(txKey);
      const tAmt = tx.taxableAmount || 0;
      const vAmt = tx.taxAmount || 0;

      taxable += tAmt;
      outputTax += vAmt;
      exempt += tx.exemptAmount || 0;
      zeroRated += tx.zeroRatedAmount || 0;
      count += 1;

      if (isGov) {
        govTaxable += tAmt;
        govOutputTax += vAmt;
      } else {
        regularTaxable += tAmt;
        regularOutputTax += vAmt;
      }
    });

    return {
      taxable,
      outputTax,
      exempt,
      zeroRated,
      count,
      govTaxable,
      govOutputTax,
      regularTaxable,
      regularOutputTax,
    };
  }, [deferredCustomersList, governmentKeySet]);

  const manualDefTaxable = deferralState.manualTaxableSales || 0;
  const manualDefOutputTax = deferralState.manualVatDue || 0;

  const totalDeferredTaxable = totalSpecificDeferred.taxable + manualDefTaxable;
  const totalDeferredOutputTax = totalSpecificDeferred.outputTax + manualDefOutputTax;

  const hasActiveDeferral =
    totalDeferredTaxable > 0 || totalDeferredOutputTax > 0 || deferredCustomersList.length > 0;

  // Aggregate Actual Totals across all branches
  // Per BIR SLSP: Row 1999 Column E = Gross, F = Exempt, G = Zero-Rated, H = Taxable (exclusive of VAT), L = Output/Input Tax
  // Aggregation summary reflects only Columns F, G, H, and L
  const aggregatedTotals = React.useMemo(() => {
    let salesColF = 0; // Column F: Exempt Sales
    let salesColG = 0; // Column G: Zero-Rated Sales
    let salesColH = 0; // Column H: Taxable Sales (Exclusive of VAT)
    let salesColL = 0; // Column L: Output Tax (VAT on Sales)
    let salesGross = 0;

    let purchasesColF = 0; // Column F: Exempt Purchases
    let purchasesColG = 0; // Column G: Zero-Rated Purchases
    let purchasesColH = 0; // Column H: Taxable Purchases (Exclusive of VAT)
    let purchasesColL = 0; // Column L: Input Tax (VAT on Purchases)
    let purchasesGross = 0;

    // Sum Sales across all branches & all months
    branches.forEach((branch) => {
      [branch.salesFiles.month1, branch.salesFiles.month2, branch.salesFiles.month3].forEach((f) => {
        if (f) {
          salesGross += f.totals.grossAmount || 0;
          salesColF += f.totals.exemptAmount || 0;
          salesColG += f.totals.zeroRatedAmount || 0;
          salesColH += f.totals.taxableAmount || 0;
          salesColL += f.totals.taxAmount || 0;
        }
      });
    });

    // Sum Purchases
    if (purchasesMode === 'consolidated') {
      if (consolidatedPurchasesFile) {
        purchasesGross += consolidatedPurchasesFile.totals.grossAmount || 0;
        purchasesColF += consolidatedPurchasesFile.totals.exemptAmount || 0;
        purchasesColG += consolidatedPurchasesFile.totals.zeroRatedAmount || 0;
        purchasesColH += consolidatedPurchasesFile.totals.taxableAmount || 0;
        purchasesColL += consolidatedPurchasesFile.totals.taxAmount || 0;
      }
    } else {
      branches.forEach((branch) => {
        const pf = branch.purchasesFiles;
        if (pf) {
          [pf.month1, pf.month2, pf.month3].forEach((f) => {
            if (f) {
              purchasesGross += f.totals.grossAmount || 0;
              purchasesColF += f.totals.exemptAmount || 0;
              purchasesColG += f.totals.zeroRatedAmount || 0;
              purchasesColH += f.totals.taxableAmount || 0;
              purchasesColL += f.totals.taxAmount || 0;
            }
          });
        }
      });
    }

    const netVatPayable = salesColL - purchasesColL;

    return {
      salesColF,
      salesColG,
      salesColH,
      salesColL,
      salesGross,
      purchasesColF,
      purchasesColG,
      purchasesColH,
      purchasesColL,
      purchasesGross,
      netVatPayable,
    };
  }, [branches, purchasesMode, consolidatedPurchasesFile]);

  // Base Sales to Government from Combined Sales Data (all transactions checked under Sales to Government)
  const actualGovSales = useMemo(() => {
    return allQuarterSalesTransactions.reduce((acc, tx) => {
      const txKey = getSalesTxKey(tx);
      return acc + (governmentKeySet.has(txKey) ? (tx.taxableAmount || 0) : 0);
    }, 0);
  }, [allQuarterSalesTransactions, governmentKeySet]);

  const actualGovOutputTax = useMemo(() => {
    return allQuarterSalesTransactions.reduce((acc, tx) => {
      const txKey = getSalesTxKey(tx);
      return acc + (governmentKeySet.has(txKey) ? (tx.taxAmount || 0) : 0);
    }, 0);
  }, [allQuarterSalesTransactions, governmentKeySet]);

  // Base Regular Vatable Sales (taxable sales not marked as Government)
  const actualRegularVatableSales = Math.max(0, aggregatedTotals.salesColH - actualGovSales);
  const actualRegularOutputTax = Math.max(0, aggregatedTotals.salesColL - actualGovOutputTax);

  // Deferral Logic per User Rule:
  // 1. Sales to Government:
  //    "Sales to Government shall not be affected by the said deferrals, only those that are not Sales to Government,
  //     Zero Rated and VAT Exempt Sales shall be deducted by deferral, in case of generic deferral wherein there is
  //     no specific customer to be deferred. Otherwise if such sale from the government agency has been deferred
  //     in specific deferral then such sale is being deferred."
  const adjustedGovSales = Math.max(0, actualGovSales - totalSpecificDeferred.govTaxable);
  const adjustedGovOutputTax = Math.max(0, actualGovOutputTax - totalSpecificDeferred.govOutputTax);

  // 2. Adjusted Grand Total Vatable Sales (Regular Vatable Sales):
  //    Generic manual deferral deducts ONLY from regular vatable sales (excluding Government, Zero Rated, Exempt).
  const adjustedRegularVatableSales = Math.max(
    0,
    actualRegularVatableSales - totalSpecificDeferred.regularTaxable - manualDefTaxable
  );
  const adjustedRegularOutputTax = Math.max(
    0,
    actualRegularOutputTax - totalSpecificDeferred.regularOutputTax - manualDefOutputTax
  );

  // 3. Zero-Rated Sales:
  //    Based on combined sales data, unaffected by generic deferrals
  const adjustedZeroRatedSales = Math.max(0, aggregatedTotals.salesColG - totalSpecificDeferred.zeroRated);

  // 4. VAT-Exempt Sales:
  //    Based on combined sales data, unaffected by generic deferrals
  const adjustedVatExemptSales = Math.max(0, aggregatedTotals.salesColF - totalSpecificDeferred.exempt);

  // Branch-level Calculations & Pro-Rating of Deferrals
  // - Sales to Government are isolated from generic deferrals
  // - Generic manual taxable sales / VAT Due deferral is pro-rated across branches strictly based on their regular taxable sales
  const branchCalculations = useMemo(() => {
    const rawBranches = (branches || []).map((b) => {
      const sFiles = [b.salesFiles?.month1, b.salesFiles?.month2, b.salesFiles?.month3].filter(Boolean);
      const actualSalesF = sFiles.reduce((acc, f) => acc + (f?.totals?.exemptAmount || 0), 0);
      const actualSalesG = sFiles.reduce((acc, f) => acc + (f?.totals?.zeroRatedAmount || 0), 0);
      const actualSalesH = sFiles.reduce((acc, f) => acc + (f?.totals?.taxableAmount || 0), 0);
      const actualSalesL = isVat
        ? sFiles.reduce((acc, f) => acc + (f?.totals?.taxAmount || 0), 0)
        : (actualSalesF + actualSalesG + actualSalesH) * 0.03;

      // Government sales in this branch
      let branchGovTaxable = 0;
      let branchGovOutputTax = 0;
      ([1, 2, 3] as const).forEach((mIdx) => {
        const f = b.salesFiles?.[`month${mIdx}`];
        if (f && Array.isArray(f.transactions)) {
          f.transactions.forEach((tx) => {
            const txKey = getSalesTxKey({
              branchId: b.id,
              monthIndex: mIdx,
              tin: tx.tin,
              rowNum: tx.rowNum,
            });
            if (governmentKeySet.has(txKey)) {
              branchGovTaxable += tx.taxableAmount || 0;
              branchGovOutputTax += tx.taxAmount || 0;
            }
          });
        }
      });

      const branchRegularTaxable = Math.max(0, actualSalesH - branchGovTaxable);
      const branchRegularOutputTax = Math.max(0, actualSalesL - branchGovOutputTax);

      const pFiles =
        purchasesMode === 'per-branch'
          ? [b.purchasesFiles?.month1, b.purchasesFiles?.month2, b.purchasesFiles?.month3].filter(Boolean)
          : [];
      const bPurchF = pFiles.reduce((acc, f) => acc + (f?.totals?.exemptAmount || 0), 0);
      const bPurchG = pFiles.reduce((acc, f) => acc + (f?.totals?.zeroRatedAmount || 0), 0);
      const bPurchH = pFiles.reduce((acc, f) => acc + (f?.totals?.taxableAmount || 0), 0);
      const bPurchL = pFiles.reduce((acc, f) => acc + (f?.totals?.taxAmount || 0), 0);

      const spec = specificDeferralByBranch[b.id] || {
        taxable: 0,
        outputTax: 0,
        exempt: 0,
        zeroRated: 0,
        count: 0,
        specGovTaxable: 0,
        specGovOutputTax: 0,
        specRegularTaxable: 0,
        specRegularOutputTax: 0,
      };

      return {
        branch: b,
        actualSalesF,
        actualSalesG,
        actualSalesH,
        actualSalesL,
        branchGovTaxable,
        branchGovOutputTax,
        branchRegularTaxable,
        branchRegularOutputTax,
        bPurchF,
        bPurchG,
        bPurchH,
        bPurchL,
        specTaxable: spec.taxable,
        specOutputTax: spec.outputTax,
        specExempt: spec.exempt,
        specZeroRated: spec.zeroRated,
        specGovTaxable: spec.specGovTaxable,
        specGovOutputTax: spec.specGovOutputTax,
        specRegularTaxable: spec.specRegularTaxable,
        specRegularOutputTax: spec.specRegularOutputTax,
        specCount: spec.count,
      };
    });

    // Sum of net regular taxable across branches available to absorb generic deferrals
    const sumBaseRegularTaxable = rawBranches.reduce(
      (acc, rb) => acc + Math.max(0, rb.branchRegularTaxable - rb.specRegularTaxable),
      0
    );
    const totalActualRegularTaxable = rawBranches.reduce((acc, rb) => acc + rb.branchRegularTaxable, 0);

    return rawBranches.map((rb) => {
      const baseRegularTaxable = Math.max(0, rb.branchRegularTaxable - rb.specRegularTaxable);
      let manualRatio = 0;
      if (sumBaseRegularTaxable > 0) {
        manualRatio = baseRegularTaxable / sumBaseRegularTaxable;
      } else if (totalActualRegularTaxable > 0) {
        manualRatio = rb.branchRegularTaxable / totalActualRegularTaxable;
      } else if (rawBranches.length > 0) {
        manualRatio = 1 / rawBranches.length;
      }

      // Generic deferrals pro-rated ONLY against regular vatable sales
      const proRatedManualTaxable = manualDefTaxable * manualRatio;
      const proRatedManualOutputTax = manualDefOutputTax * manualRatio;

      // Adjusted government sales (affected only by specific government deferrals)
      const adjustedGovTaxable = Math.max(0, rb.branchGovTaxable - rb.specGovTaxable);
      const adjustedGovOutputTax = Math.max(0, rb.branchGovOutputTax - rb.specGovOutputTax);

      // Adjusted regular vatable sales (reduced by specific regular deferral and pro-rated manual generic deferral)
      const adjustedRegularTaxable = Math.max(
        0,
        rb.branchRegularTaxable - rb.specRegularTaxable - proRatedManualTaxable
      );
      const adjustedRegularOutputTax = Math.max(
        0,
        rb.branchRegularOutputTax - rb.specRegularOutputTax - proRatedManualOutputTax
      );

      // Total adjusted taxable sales (Col H) & output tax (Col L)
      const adjustedSalesH = adjustedRegularTaxable + adjustedGovTaxable;
      const adjustedSalesL = adjustedRegularOutputTax + adjustedGovOutputTax;
      const adjustedSalesF = Math.max(0, rb.actualSalesF - rb.specExempt);
      const adjustedSalesG = Math.max(0, rb.actualSalesG - rb.specZeroRated);

      const totalBranchDefTaxable = rb.specTaxable + proRatedManualTaxable;
      const totalBranchDefOutputTax = rb.specOutputTax + proRatedManualOutputTax;

      const actualNetVat = rb.actualSalesL - rb.bPurchL;
      const adjustedNetVat = adjustedSalesL - rb.bPurchL;

      return {
        ...rb,
        proRatedManualTaxable,
        proRatedManualOutputTax,
        totalBranchDefTaxable,
        totalBranchDefOutputTax,
        adjustedGovTaxable,
        adjustedGovOutputTax,
        adjustedRegularTaxable,
        adjustedRegularOutputTax,
        adjustedSalesF,
        adjustedSalesG,
        adjustedSalesH,
        adjustedSalesL,
        actualNetVat,
        adjustedNetVat,
      };
    });
  }, [
    branches,
    isVat,
    purchasesMode,
    specificDeferralByBranch,
    manualDefTaxable,
    manualDefOutputTax,
    governmentKeySet,
  ]);

  // Adjusted Totals (Aggregation rollup reflecting deferrals)
  const adjustedTotals = useMemo(() => {
    let salesColF = 0;
    let salesColG = 0;
    let salesColH = 0;
    let salesColL = 0;

    branchCalculations.forEach((b) => {
      salesColF += b.adjustedSalesF;
      salesColG += b.adjustedSalesG;
      salesColH += b.adjustedSalesH;
      salesColL += b.adjustedSalesL;
    });

    const purchasesColF = aggregatedTotals.purchasesColF;
    const purchasesColG = aggregatedTotals.purchasesColG;
    const purchasesColH = aggregatedTotals.purchasesColH;
    const purchasesColL = aggregatedTotals.purchasesColL;
    const purchasesGross = aggregatedTotals.purchasesGross;

    const netVatPayable = salesColL - purchasesColL;

    return {
      salesColF,
      salesColG,
      salesColH,
      salesColL,
      purchasesColF,
      purchasesColG,
      purchasesColH,
      purchasesColL,
      purchasesGross,
      netVatPayable,
    };
  }, [branchCalculations, aggregatedTotals]);

  // Active totals based on summaryViewMode ('actual' vs 'adjusted')
  const displayTotals = summaryViewMode === 'adjusted' ? adjustedTotals : aggregatedTotals;

  // Active category breakdowns for BIR Schedule 1
  const displayVatableSales =
    summaryViewMode === 'adjusted' ? adjustedRegularVatableSales : actualRegularVatableSales;
  const displayGovSales = summaryViewMode === 'adjusted' ? adjustedGovSales : actualGovSales;
  const displayZeroRatedSales =
    summaryViewMode === 'adjusted' ? adjustedZeroRatedSales : aggregatedTotals.salesColG;
  const displayVatExemptSales =
    summaryViewMode === 'adjusted' ? adjustedVatExemptSales : aggregatedTotals.salesColF;

  // Computed Prior Quarter's Excess Input Tax (based on previous Quarter VAT Due only if negative, otherwise 0)
  const priorQuarterExcessInfo = useMemo(
    () => getPriorQuarterExcessInputVat(client.id, quarter, year),
    [client.id, quarter, year]
  );

  // Handle Sync to Active Form
  const handleSyncToForm = () => {
    if (isVat && onSync2550Q) {
      onSync2550Q({
        vatableSales: displayVatableSales,
        salesToGovernment: displayGovSales,
        zeroRatedSales: displayZeroRatedSales,
        vatExemptSales: displayVatExemptSales,
        inputPurchasesGoods: displayTotals.purchasesColH,
        inputPurchasesServices: 0,
        inputCapitalGoods: 0,
        priorQuarterExcessInputVat: priorQuarterExcessInfo.excessInputVat,
      });
      setSyncSuccessMsg(
        `Successfully synced from all Data to BIR Form 2550Q Schedules 1 & 2! Output Taxable Sales: ${formatPHP(
          displayTotals.salesColH
        )} | Purchases: ${formatPHP(displayTotals.purchasesColH)} | Prior Quarter Excess Input Tax: ${formatPHP(
          priorQuarterExcessInfo.excessInputVat
        )}.`
      );
    } else if (!isVat && onSync2551Q) {
      const totalGrossSales = displayTotals.salesColF + displayTotals.salesColG + displayTotals.salesColH;
      onSync2551Q({
        grossSales: totalGrossSales,
        exemptSales: displayTotals.salesColF,
        vatableSales: displayVatableSales,
        salesToGovernment: displayGovSales,
        zeroRatedSales: displayZeroRatedSales,
        vatExemptSales: displayVatExemptSales,
      });
      setSyncSuccessMsg(
        `Successfully synced from all Data to BIR Form 2551Q! Gross Sales: ${formatPHP(
          totalGrossSales
        )} | Vatable/Taxable: ${formatPHP(displayVatableSales)} | Govt: ${formatPHP(displayGovSales)} | Zero-Rated: ${formatPHP(displayZeroRatedSales)} | Exempt: ${formatPHP(displayVatExemptSales)}.`
      );
    }
    setTimeout(() => setSyncSuccessMsg(null), 4500);
  };

  // Synchronize computed Schedule 1 and 2 data to parent component
  useEffect(() => {
    if (onBranchScheduleChange) {
      onBranchScheduleChange({
        branches,
        purchasesMode,
        consolidatedPurchasesFile: consolidatedPurchasesFile || undefined,
        deferralState,
        schedule1Computed: {
          vatableSales: displayVatableSales,
          salesToGovernment: displayGovSales,
          zeroRatedSales: displayZeroRatedSales,
          vatExemptSales: displayVatExemptSales,
          inputPurchasesGoods: displayTotals.purchasesColH,
          priorQuarterExcessInputVat: priorQuarterExcessInfo.excessInputVat,
        },
      });
    }
  }, [
    branches,
    purchasesMode,
    consolidatedPurchasesFile,
    deferralState,
    displayVatableSales,
    displayGovSales,
    displayZeroRatedSales,
    displayVatExemptSales,
    displayTotals.purchasesColH,
    priorQuarterExcessInfo.excessInputVat,
    onBranchScheduleChange,
  ]);

  // Handle PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const branchRowsForPdf = branchCalculations.map((b) => ({
        name: b.branch.name,
        salesColF: summaryViewMode === 'adjusted' ? b.adjustedSalesF : b.actualSalesF,
        salesColG: summaryViewMode === 'adjusted' ? b.adjustedSalesG : b.actualSalesG,
        salesColH: summaryViewMode === 'adjusted' ? b.adjustedSalesH : b.actualSalesH,
        salesColL: summaryViewMode === 'adjusted' ? b.adjustedSalesL : b.actualSalesL,
        purchasesColF: b.bPurchF,
        purchasesColG: b.bPurchG,
        purchasesColH: b.bPurchH,
        purchasesColL: b.bPurchL,
        netVat: summaryViewMode === 'adjusted' ? b.adjustedNetVat : b.actualNetVat,
      }));

      await exportMultiBranchAnd2550QPdf({
        client,
        quarter,
        year,
        branches,
        purchasesMode,
        aggregatedTotals: displayTotals,
        branchRows: branchRowsForPdf,
        isAdjustedMode: summaryViewMode === 'adjusted',
        data2550Q,
      });
      setSyncSuccessMsg(
        `Multi-Branch Aggregation & 2550Q VAT Summary PDF (${summaryViewMode === 'adjusted' ? 'Adjusted Basis' : 'Actual Basis'}) generated and downloaded successfully.`
      );
      setTimeout(() => setSyncSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Failed to export PDF', err);
      setUploadErrorMsg('Failed to generate PDF. Please try again.');
      setTimeout(() => setUploadErrorMsg(null), 5000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle Comparison PDF Export (Actual vs Adjusted + Deferrals Summary)
  const handleExportComparisonPdf = async () => {
    try {
      setIsExportingComparisonPdf(true);
      await exportVatComparisonPdf({
        client,
        quarter,
        year,
        branches,
        purchasesMode,
        consolidatedPurchasesFile,
        branchCalculations,
        actualTotals: aggregatedTotals,
        adjustedTotals,
        deferredCustomersList,
        manualDefTaxable,
        manualDefOutputTax,
        totalDeferredTaxable,
        totalDeferredOutputTax,
        previousQuarterHideAmount: deferralState.previousQuarterHideAmount || 0,
        previousQuarterHideOutputTax: deferralState.previousQuarterHideOutputTax || 0,
      });
      setSyncSuccessMsg(
        'VAT Comparison Schedule PDF (Actual vs. Adjusted with Deferrals Summary) generated and downloaded successfully.'
      );
      setTimeout(() => setSyncSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Failed to export VAT comparison PDF', err);
      setUploadErrorMsg('Failed to generate VAT Comparison PDF. Please try again.');
      setTimeout(() => setUploadErrorMsg(null), 5000);
    } finally {
      setIsExportingComparisonPdf(false);
    }
  };

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  const totalQuarterSalesRowCount = useMemo(() => {
    return allQuarterSalesTransactions.length;
  }, [allQuarterSalesTransactions]);

  // Unique Customer list across all quarter sales transactions for dropdown filtering
  const uniqueCustomerList = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; totalGross: number; totalTaxable: number; govtCount: number; cert2307Count: number }
    >();

    allQuarterSalesTransactions.forEach((tx) => {
      const cleanName = (tx.registeredName || '').trim();
      const key = cleanName.toLowerCase() || 'unnamed';
      const displayName = cleanName || 'Unnamed Customer / Individual';
      const txKey = getSalesTxKey(tx);
      const isGov = governmentKeySet.has(txKey);
      const is2307 = has2307KeySet.has(txKey);

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalGross += tx.grossAmount || 0;
        existing.totalTaxable += tx.taxableAmount || 0;
        if (isGov) existing.govtCount += 1;
        if (is2307) existing.cert2307Count += 1;
      } else {
        map.set(key, {
          name: displayName,
          count: 1,
          totalGross: tx.grossAmount || 0,
          totalTaxable: tx.taxableAmount || 0,
          govtCount: isGov ? 1 : 0,
          cert2307Count: is2307 ? 1 : 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allQuarterSalesTransactions, governmentKeySet, has2307KeySet]);

  // Totals for all quarter transactions marked as Government Sales
  const governmentSalesSummary = useMemo(() => {
    let count = 0;
    let taxable = 0;
    let outputTax = 0;
    let gross = 0;
    allQuarterSalesTransactions.forEach((tx) => {
      if (governmentKeySet.has(getSalesTxKey(tx))) {
        count += 1;
        taxable += tx.taxableAmount || 0;
        outputTax += tx.taxAmount || 0;
        gross += tx.grossAmount || 0;
      }
    });
    return {
      count,
      taxable,
      outputTax,
      gross,
      withheld5Pct: taxable * 0.05, // 5% Standard Final Withholding VAT
    };
  }, [allQuarterSalesTransactions, governmentKeySet]);

  // Totals for all quarter transactions marked as having Form 2307 Certificates
  const has2307SalesSummary = useMemo(() => {
    let count = 0;
    let taxable = 0;
    let outputTax = 0;
    let gross = 0;
    allQuarterSalesTransactions.forEach((tx) => {
      if (has2307KeySet.has(getSalesTxKey(tx))) {
        count += 1;
        taxable += tx.taxableAmount || 0;
        outputTax += tx.taxAmount || 0;
        gross += tx.grossAmount || 0;
      }
    });
    return {
      count,
      taxable,
      outputTax,
      gross,
    };
  }, [allQuarterSalesTransactions, has2307KeySet]);

  // Filtered Combined Sales with Customer Name, Month, Branch, Checklist Tag, and Search filter
  const filteredCombinedSales = useMemo(() => {
    return allQuarterSalesTransactions.filter((tx) => {
      const txKey = getSalesTxKey(tx);

      // Month filter
      if (combinedSalesFilterMonth !== 'all' && tx.monthIndex !== combinedSalesFilterMonth) {
        return false;
      }
      // Branch filter
      if (combinedSalesBranchFilter !== 'all' && tx.branchId !== combinedSalesBranchFilter) {
        return false;
      }
      // Customer filter
      if (combinedSalesCustomerFilter !== 'all') {
        const txName = (tx.registeredName || '').trim().toLowerCase();
        if (txName !== combinedSalesCustomerFilter.trim().toLowerCase()) {
          return false;
        }
      }
      // Status tag filter
      if (combinedSalesTagFilter === 'govt' && !governmentKeySet.has(txKey)) {
        return false;
      }
      if (combinedSalesTagFilter === '2307' && !has2307KeySet.has(txKey)) {
        return false;
      }
      if (combinedSalesTagFilter === 'both' && (!governmentKeySet.has(txKey) || !has2307KeySet.has(txKey))) {
        return false;
      }
      if (combinedSalesTagFilter === 'none' && (governmentKeySet.has(txKey) || has2307KeySet.has(txKey))) {
        return false;
      }
      // Free text search query
      if (combinedSalesSearchQuery.trim()) {
        const q = combinedSalesSearchQuery.toLowerCase();
        const matchName = tx.registeredName?.toLowerCase().includes(q);
        const matchTin = tx.tin?.toLowerCase().includes(q);
        const matchAddr = tx.address?.toLowerCase().includes(q);
        return Boolean(matchName || matchTin || matchAddr);
      }
      return true;
    });
  }, [
    allQuarterSalesTransactions,
    combinedSalesFilterMonth,
    combinedSalesBranchFilter,
    combinedSalesCustomerFilter,
    combinedSalesTagFilter,
    combinedSalesSearchQuery,
    governmentKeySet,
    has2307KeySet,
  ]);

  const combinedSalesTotals = useMemo(() => {
    return filteredCombinedSales.reduce(
      (acc, tx) => ({
        grossAmount: acc.grossAmount + (tx.grossAmount || 0),
        exemptAmount: acc.exemptAmount + (tx.exemptAmount || 0),
        zeroRatedAmount: acc.zeroRatedAmount + (tx.zeroRatedAmount || 0),
        taxableAmount: acc.taxableAmount + (tx.taxableAmount || 0),
        taxAmount: acc.taxAmount + (tx.taxAmount || 0),
      }),
      { grossAmount: 0, exemptAmount: 0, zeroRatedAmount: 0, taxableAmount: 0, taxAmount: 0 }
    );
  }, [filteredCombinedSales]);

  // Counts of checked rows within currently filtered transactions
  const filteredGovtCheckedCount = useMemo(() => {
    return filteredCombinedSales.filter((tx) => governmentKeySet.has(getSalesTxKey(tx))).length;
  }, [filteredCombinedSales, governmentKeySet]);

  const isAllFilteredGovtChecked =
    filteredCombinedSales.length > 0 && filteredGovtCheckedCount === filteredCombinedSales.length;
  const isSomeFilteredGovtChecked =
    filteredGovtCheckedCount > 0 && filteredGovtCheckedCount < filteredCombinedSales.length;

  const filtered2307CheckedCount = useMemo(() => {
    return filteredCombinedSales.filter((tx) => has2307KeySet.has(getSalesTxKey(tx))).length;
  }, [filteredCombinedSales, has2307KeySet]);

  const isAllFiltered2307Checked =
    filteredCombinedSales.length > 0 && filtered2307CheckedCount === filteredCombinedSales.length;
  const isSomeFiltered2307Checked =
    filtered2307CheckedCount > 0 && filtered2307CheckedCount < filteredCombinedSales.length;

  // Individual toggle handlers
  const toggleGovernmentKey = (key: string) => {
    setGovernmentSalesKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggle2307Key = (key: string) => {
    setHas2307SalesKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Bulk actions on filtered transactions
  const handleToggleAllFilteredGovernment = (check: boolean) => {
    const keysInFilter = filteredCombinedSales.map(getSalesTxKey);
    if (check) {
      setGovernmentSalesKeys((prev) => Array.from(new Set([...prev, ...keysInFilter])));
      setChecklistFeedbackMsg({
        text: `Checked ${keysInFilter.length} transaction(s) as Government sales.`,
        type: 'success',
      });
    } else {
      const toRemove = new Set(keysInFilter);
      setGovernmentSalesKeys((prev) => prev.filter((k) => !toRemove.has(k)));
      setChecklistFeedbackMsg({
        text: `Unchecked ${keysInFilter.length} transaction(s) from Government sales.`,
        type: 'info',
      });
    }
  };

  const handleToggleAllFiltered2307 = (check: boolean) => {
    const keysInFilter = filteredCombinedSales.map(getSalesTxKey);
    if (check) {
      setHas2307SalesKeys((prev) => Array.from(new Set([...prev, ...keysInFilter])));
      setChecklistFeedbackMsg({
        text: `Checked ${keysInFilter.length} transaction(s) as having Form 2307 Certificates.`,
        type: 'success',
      });
    } else {
      const toRemove = new Set(keysInFilter);
      setHas2307SalesKeys((prev) => prev.filter((k) => !toRemove.has(k)));
      setChecklistFeedbackMsg({
        text: `Unchecked ${keysInFilter.length} transaction(s) from 2307 Certificates.`,
        type: 'info',
      });
    }
  };

  const handleCheckAllFilteredBoth = () => {
    const keysInFilter = filteredCombinedSales.map(getSalesTxKey);
    setGovernmentSalesKeys((prev) => Array.from(new Set([...prev, ...keysInFilter])));
    setHas2307SalesKeys((prev) => Array.from(new Set([...prev, ...keysInFilter])));
    setChecklistFeedbackMsg({
      text: `Checked all ${keysInFilter.length} filtered transaction(s) as BOTH Government & 2307 Certificates.`,
      type: 'success',
    });
  };

  // Smart Auto-detection for Government entities
  const handleAutoDetectGovernment = () => {
    const govtKeywords = [
      'govt',
      'government',
      'deped',
      'department of',
      'dept of',
      'dpwh',
      'doh',
      'dost',
      'dswd',
      'dilg',
      'dotr',
      'bureau of',
      'bir',
      'boc',
      'municipality of',
      'city of',
      'province of',
      'barangay',
      'brgy',
      'state university',
      'lgu',
      'gocc',
      'gsis',
      'sss',
      'philhealth',
      'pag-ibig',
      'commission on',
      'national food authority',
      'neda',
      'hospital of',
      'memorial medical',
    ];

    const detectedKeys: string[] = [];
    allQuarterSalesTransactions.forEach((tx) => {
      const name = (tx.registeredName || '').toLowerCase();
      const isGov = govtKeywords.some((kw) => name.includes(kw));
      if (isGov) {
        detectedKeys.push(getSalesTxKey(tx));
      }
    });

    if (detectedKeys.length > 0) {
      setGovernmentSalesKeys((prev) => Array.from(new Set([...prev, ...detectedKeys])));
      setChecklistFeedbackMsg({
        text: `Auto-detected and tagged ${detectedKeys.length} Government transaction(s).`,
        type: 'success',
      });
    } else {
      setChecklistFeedbackMsg({
        text: `No standard government agency keywords found in customer names. You can filter by customer and check manually.`,
        type: 'info',
      });
    }
  };

  const handleClearAllChecklistTags = () => {
    setGovernmentSalesKeys([]);
    setHas2307SalesKeys([]);
    setChecklistFeedbackMsg({
      text: `Cleared all Government and Form 2307 tags for this quarter.`,
      type: 'info',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Section Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
                Multi-Branch & Line of Business Schedule
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-200 border border-violet-500/30">
                {quarter} {year}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">
              {client.tradeName} — Branch Monthly Excel Filings
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick sync button */}
          <button
            id="sync-branch-totals-btn"
            onClick={handleSyncToForm}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors shadow-xs"
            title={
              isVat
                ? 'Transfer aggregated figures directly into BIR Form 2550Q Schedules 1 and 2'
                : 'Transfer aggregated sales figures directly into BIR Form 2551Q'
            }
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Sync from all Data</span>
          </button>

          {/* Toggle expand/collapse */}
          <button
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
            title={isSectionOpen ? 'Collapse Section' : 'Expand Section'}
          >
            {isSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isSectionOpen && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Notifications */}
          {syncSuccessMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{syncSuccessMsg}</span>
            </div>
          )}

          {uploadErrorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{uploadErrorMsg}</span>
            </div>
          )}

          {/* Top Control Bar: Branch Structure Toggle, Branch Counter & Add Branch + Purchases Mode Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            {/* Branch Structure Selection (No branch vs. Has branches) & Add Branch */}
            <div className={`${isVat ? 'lg:col-span-6' : 'lg:col-span-12'} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-violet-600" />
                  <span>Branch Structure</span>
                </div>
                <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    id="branch-structure-no-btn"
                    onClick={() => setHasBranches(false)}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      !hasBranches
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Client operates as a single business unit or head office with no separate branches"
                  >
                    No Branch (Single Unit)
                  </button>
                  <button
                    type="button"
                    id="branch-structure-yes-btn"
                    onClick={() => setHasBranches(true)}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      hasBranches
                        ? 'bg-violet-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Client operates with multiple branches or distinct lines of business"
                  >
                    Has Branches ({branches.length})
                  </button>
                </div>
              </div>

              {/* Only show Add Branch button if client has branches */}
              {hasBranches && (
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    id="add-branch-btn"
                    onClick={handleAddBranch}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors shadow-2xs"
                    title="Add another branch or line of business to the quarterly schedule"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Branch</span>
                  </button>
                </div>
              )}
            </div>

            {/* Purchases Reporting Mode (Only for VAT Clients) */}
            {isVat && (
              <div className="lg:col-span-6 flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-200">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                  Purchases Filing Mode:
                </span>

                <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    id="purchases-mode-consolidated-btn"
                    onClick={() => setPurchasesMode('consolidated')}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      purchasesMode === 'consolidated'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Upload 1 consolidated Excel file for all purchases across all branches"
                  >
                    📦 Consolidated (1 File)
                  </button>
                  <button
                    type="button"
                    id="purchases-mode-per-branch-btn"
                    onClick={() => setPurchasesMode('per-branch')}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      purchasesMode === 'per-branch'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Upload separate monthly Excel files (Months 1, 2, 3) for each branch"
                  >
                    🏢 Per Branch (3 Files/Branch)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Consolidated Purchases Section (Shown when is VAT and Consolidated Purchases is Active) */}
          {isVat && purchasesMode === 'consolidated' && (
            <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Consolidated Purchases (Single Quarterly Reporting)
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Upload 1 Excel file covering all purchases across all branches for {quarter} {year}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="download-consolidated-purchases-template-btn"
                    onClick={() => handleDownloadTemplate('Purchases', 'consolidated')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                    title="Download pre-formatted Purchases Excel template with Cell A1: Purchases - [Quarter] - Consolidated"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-600" />
                    <span>Download Template</span>
                  </button>
                </div>
              </div>

              {/* Upload Card / Slot */}
              {consolidatedPurchasesFile ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-amber-300 rounded-lg shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{consolidatedPurchasesFile.fileName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-medium">
                          {consolidatedPurchasesFile.rowCount} row(s)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                        <span>Gross: {formatPHP(consolidatedPurchasesFile.totals.grossAmount)}</span>
                        <span>•</span>
                        <span>Taxable: {formatPHP(consolidatedPurchasesFile.totals.taxableAmount)}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">
                          Input Tax: {formatPHP(consolidatedPurchasesFile.totals.taxAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => setPreviewFile(consolidatedPurchasesFile)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                      title="View transaction rows"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => triggerFileUpload('purchases', 'consolidated')}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-md transition-colors"
                      title="Replace file"
                    >
                      <Upload className="w-3.5 h-3.5 text-violet-600" />
                      <span>Re-upload</span>
                    </button>
                    <button
                      onClick={() => handleRemoveFile('purchases', 'consolidated')}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                      title="Delete uploaded file so you can upload again"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => triggerFileUpload('purchases', 'consolidated')}
                  className="border-2 border-dashed border-amber-300 hover:border-amber-400 bg-white/60 hover:bg-white rounded-lg p-4 text-center cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 mx-auto text-amber-600 mb-1" />
                  <div className="text-xs font-semibold text-slate-800">
                    Upload Consolidated Purchases Excel (.xlsx)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Click to browse or drag and drop file adhering to BIR SLSP layout (A1: Purchases - {quarter} - Consolidated)
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Branch Tabs Header (Only displayed when client has branches) */}
          {hasBranches && (
            <div className="border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5">
                {/* Scroll Left Button */}
                <button
                  type="button"
                  id="scroll-branch-tabs-left-btn"
                  onClick={() => scrollTabs('left')}
                  disabled={!canScrollLeft}
                  className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                    canScrollLeft
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs cursor-pointer'
                      : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-40'
                  }`}
                  title="Scroll branch tabs left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Horizontally Scrollable Tabs Track */}
                <div
                  ref={tabsContainerRef}
                  onScroll={checkScrollState}
                  onWheel={(e) => {
                    if (tabsContainerRef.current) {
                      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        tabsContainerRef.current.scrollLeft += e.deltaY;
                      }
                    }
                  }}
                  className="flex items-center gap-2 overflow-x-auto py-1 px-1 scroll-smooth flex-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {branches.map((b) => {
                    const isActive = b.id === activeBranchId;
                    const salesCount = [b.salesFiles.month1, b.salesFiles.month2, b.salesFiles.month3].filter(Boolean).length;
                    const purchasesCount = purchasesMode === 'per-branch'
                      ? [b.purchasesFiles?.month1, b.purchasesFiles?.month2, b.purchasesFiles?.month3].filter(Boolean).length
                      : 0;

                    return (
                      <div key={b.id} data-branch-id={b.id} className="relative flex items-center group shrink-0">
                        {editingBranchId === b.id ? (
                          <div className="flex items-center gap-1 bg-white px-2 py-1 border border-violet-500 rounded-lg shadow-xs">
                            <input
                              type="text"
                              value={editingBranchName}
                              onChange={(e) => setEditingBranchName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(b.id)}
                              className="text-xs font-semibold text-slate-800 focus:outline-none w-36"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(b.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Save branch name"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingBranchId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <button
                              onClick={() => setActiveBranchId(b.id)}
                              onDoubleClick={() => {
                                setEditingBranchId(b.id);
                                setEditingBranchName(b.name);
                              }}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                isActive
                                  ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                              }`}
                              title="Click to switch active branch; Double click to rename"
                            >
                              <Building className="w-3.5 h-3.5" />
                              <span>{b.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                  salesCount === 3
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-200/70 text-slate-600'
                                }`}
                              >
                                {salesCount}/3 Sales
                                {isVat && purchasesMode === 'per-branch' ? ` • ${purchasesCount}/3 Purch` : ''}
                              </span>
                            </button>

                            {/* Delete Branch button on tab (if more than 1 branch) */}
                            {branches.length > 1 && (
                              <button
                                type="button"
                                id={`delete-branch-tab-btn-${b.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveBranch(b.id);
                                }}
                                className="ml-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title={`Delete branch "${b.name}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Scroll Right Button */}
                <button
                  type="button"
                  id="scroll-branch-tabs-right-btn"
                  onClick={() => scrollTabs('right')}
                  disabled={!canScrollRight}
                  className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                    canScrollRight
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs cursor-pointer'
                      : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-40'
                  }`}
                  title="Scroll branch tabs right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Active Branch Content & Name Editor */}
          <div className="space-y-6">
            {/* Editable Branch Name & Controls Header */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-xl">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor={`branch-name-${activeBranch.id}`}
                    className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Building className="w-3.5 h-3.5 text-violet-600" />
                    <span>{hasBranches ? 'Branch / Line of Business Name:' : 'Line of Business / Unit Name:'}</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id={`branch-name-${activeBranch.id}`}
                    value={activeBranch.name}
                    onChange={(e) => handleUpdateBranchName(activeBranch.id, e.target.value)}
                    placeholder="Enter branch or line of business name..."
                    className="w-full px-3 py-1.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-hidden transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start md:self-center">
                {/* Delete Active Branch button */}
                {hasBranches && (
                  <button
                    type="button"
                    id={`delete-active-branch-btn-${activeBranch.id}`}
                    onClick={() => handleRemoveBranch(activeBranch.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                    title={`Delete "${activeBranch.name}" and remove all its uploaded files`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete Branch</span>
                  </button>
                )}

                {/* Batch Download Templates for this branch */}
                <button
                  id={`download-all-sales-templates-${activeBranch.id}`}
                  onClick={() => {
                    monthList.forEach((m) => {
                      handleDownloadTemplate('Sales', m.index, activeBranch.name);
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                  title="Download all 3 monthly Sales Excel templates for this branch"
                >
                  <Download className="w-3.5 h-3.5 text-violet-600" />
                  <span>Download 3 Sales Templates</span>
                </button>
              </div>
            </div>

            {/* Sales Upload Slots: 3 Months */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block" />
                    SALES IN THE QUARTER
                  </div>
                  <button
                    type="button"
                    id="view-combined-quarter-sales-btn"
                    onClick={() => {
                      setCombinedSalesBranchFilter('all');
                      setCombinedSalesFilterMonth('all');
                      setCombinedSalesCustomerFilter('all');
                      setCombinedSalesTagFilter('all');
                      setCombinedSalesSearchQuery('');
                      setChecklistFeedbackMsg(null);
                      setShowCombinedSalesModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                    title="View combined 1st, 2nd, and 3rd month sales data popup"
                  >
                    <Layers className="w-3.5 h-3.5 text-violet-600" />
                    <span>View Combined Sales Data</span>
                    {totalQuarterSalesRowCount > 0 ? (
                      <span className="px-1.5 py-0.2 text-[10px] bg-violet-600 text-white font-mono font-bold rounded-full">
                        {totalQuarterSalesRowCount}
                      </span>
                    ) : (
                      <span className="text-[10px] text-violet-500 font-normal">(Popup)</span>
                    )}
                    {governmentSalesSummary.count > 0 && (
                      <span
                        className="px-1.5 py-0.2 text-[10px] bg-emerald-600 text-white font-bold rounded-full flex items-center gap-0.5"
                        title={`${governmentSalesSummary.count} tagged Government Sales`}
                      >
                        <Landmark className="w-2.5 h-2.5" />
                        {governmentSalesSummary.count}
                      </span>
                    )}
                    {has2307SalesSummary.count > 0 && (
                      <span
                        className="px-1.5 py-0.2 text-[10px] bg-amber-600 text-white font-bold rounded-full flex items-center gap-0.5"
                        title={`${has2307SalesSummary.count} tagged 2307 Certificates`}
                      >
                        <FileText className="w-2.5 h-2.5" />
                        {has2307SalesSummary.count}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {monthList.map((m) => {
                  const monthKey = m.index === 1 ? 'month1' : m.index === 2 ? 'month2' : 'month3';
                  const uploadedFile = activeBranch.salesFiles[monthKey];

                  return (
                    <div
                      key={m.index}
                      className={`p-4 rounded-xl border transition-all ${
                        uploadedFile
                          ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {m.label}
                          </span>
                          <h5 className="text-xs font-bold text-slate-900">{m.name}</h5>
                        </div>

                        <button
                          onClick={() => handleDownloadTemplate('Sales', m.index, activeBranch.name)}
                          className="flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-800 hover:underline"
                          title={`Download template for Sales - ${quarter} - ${m.label}`}
                        >
                          <Download className="w-3 h-3" />
                          <span>Template</span>
                        </button>
                      </div>

                      {uploadedFile ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-800 truncate max-w-[160px]" title={uploadedFile.fileName}>
                              {uploadedFile.fileName}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded-full font-mono">
                              {uploadedFile.rowCount} rows
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-lg border border-emerald-200 text-[11px] space-y-1">
                            <div className="flex justify-between text-slate-600">
                              <span>Gross Sales:</span>
                              <span className="font-mono font-medium">{formatPHP(uploadedFile.totals.grossAmount)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Taxable (12%):</span>
                              <span className="font-mono font-medium">{formatPHP(uploadedFile.totals.taxableAmount)}</span>
                            </div>
                            <div className="flex justify-between text-slate-900 font-semibold border-t border-slate-100 pt-1">
                              <span>Output Tax:</span>
                              <span className="font-mono text-emerald-700">{formatPHP(uploadedFile.totals.taxAmount)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={() => setPreviewFile(uploadedFile)}
                              className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1"
                              title="View file preview"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Data</span>
                            </button>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => triggerFileUpload('sales', m.index, activeBranch.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded border border-violet-200 transition-colors"
                                title="Re-upload replacement Sales Excel file"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Re-upload</span>
                              </button>
                              <button
                                onClick={() => handleRemoveFile('sales', m.index, activeBranch.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors"
                                title="Delete uploaded file so you can upload again"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => triggerFileUpload('sales', m.index, activeBranch.id)}
                          className="border border-dashed border-slate-300 hover:border-violet-500 rounded-lg p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-violet-50/30 transition-colors"
                        >
                          <Upload className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                          <div className="text-xs font-medium text-slate-700">
                            Upload Month {m.index} Sales
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Sales - {quarter} - {m.label} (.xlsx)
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Purchases Upload Slots (Only shown if is VAT and Purchases Mode is Per-Branch) */}
            {isVat && purchasesMode === 'per-branch' && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                      PURCHASES IN THE QUARTER
                    </div>

                    {/* View Combined Purchases Data Button */}
                    <button
                      type="button"
                      id="open-combined-purchases-modal-btn"
                      onClick={() => setShowCombinedPurchasesModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                      title="View combined purchases across all branches in the quarter"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      <span>View Combined Purchases Data</span>
                      {totalQuarterPurchasesRowCount > 0 ? (
                        <span className="px-1.5 py-0.2 text-[10px] bg-amber-600 text-white font-mono font-bold rounded-full">
                          {totalQuarterPurchasesRowCount}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-normal">(Popup)</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {monthList.map((m) => {
                    const monthKey = m.index === 1 ? 'month1' : m.index === 2 ? 'month2' : 'month3';
                    const uploadedFile = activeBranch.purchasesFiles?.[monthKey];

                    return (
                      <div
                        key={m.index}
                        className={`p-4 rounded-xl border transition-all ${
                          uploadedFile
                            ? 'bg-amber-50/40 border-amber-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {m.label} Purchases
                            </span>
                            <h5 className="text-xs font-bold text-slate-900">{m.name}</h5>
                          </div>

                          <button
                            onClick={() => handleDownloadTemplate('Purchases', m.index, activeBranch.name)}
                            className="flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline"
                            title={`Download template for Purchases - ${quarter} - ${m.label}`}
                          >
                            <Download className="w-3 h-3" />
                            <span>Template</span>
                          </button>
                        </div>

                        {uploadedFile ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-amber-900 truncate max-w-[160px]" title={uploadedFile.fileName}>
                                {uploadedFile.fileName}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-mono">
                                {uploadedFile.rowCount} rows
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-amber-200 text-[11px] space-y-1">
                              <div className="flex justify-between text-slate-600">
                                <span>Gross Purchases:</span>
                                <span className="font-mono font-medium">{formatPHP(uploadedFile.totals.grossAmount)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Goods / Services:</span>
                                <span className="font-mono font-medium">
                                  {formatPHP(uploadedFile.totals.goodsOtherThanCapitalAmount + uploadedFile.totals.servicesAmount)}
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-900 font-semibold border-t border-slate-100 pt-1">
                                <span>Input Tax:</span>
                                <span className="font-mono text-amber-700">{formatPHP(uploadedFile.totals.taxAmount)}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <button
                                onClick={() => setPreviewFile(uploadedFile)}
                                className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1"
                                title="View file preview"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View Data</span>
                              </button>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => triggerFileUpload('purchases', m.index, activeBranch.id)}
                                  className="flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors"
                                  title="Re-upload replacement Purchases Excel file"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>Re-upload</span>
                                </button>
                                <button
                                  onClick={() => handleRemoveFile('purchases', m.index, activeBranch.id)}
                                  className="flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors"
                                  title="Delete uploaded file so you can upload again"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => triggerFileUpload('purchases', m.index, activeBranch.id)}
                            className="border border-dashed border-slate-300 hover:border-amber-500 rounded-lg p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-amber-50/30 transition-colors"
                          >
                            <Upload className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                            <div className="text-xs font-medium text-slate-700">
                              Upload Month {m.index} Purchases
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Purchases - {quarter} - {m.label} (.xlsx)
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Consolidated Rollup Summary Table (VAT TABLE - Only for VAT Clients) */}
          {isVat && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-violet-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    VAT TABLE
                  </h4>
                </div>

                {/* Adjusted vs Actual Toggle Button to visualize difference */}
                <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    id="toggle-actual-view-btn"
                    onClick={() => setSummaryViewMode('actual')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      summaryViewMode === 'actual'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="View original actual figures directly aggregated from uploaded documents"
                  >
                    <span>Actual (Original)</span>
                  </button>
                  <button
                    type="button"
                    id="toggle-adjusted-view-btn"
                    onClick={() => setSummaryViewMode('adjusted')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      summaryViewMode === 'adjusted'
                        ? 'bg-violet-700 text-white font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="View adjusted figures reflecting customer and manual sales deferrals"
                  >
                    <span>Adjusted (Deferred)</span>
                    {hasActiveDeferral && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                          summaryViewMode === 'adjusted'
                            ? 'bg-white/25 text-white'
                            : 'bg-violet-100 text-violet-800'
                        }`}
                      >
                        Active
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Both Download Buttons Side by Side (Never stacking, Never changing position) */}
              <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                <button
                  type="button"
                  id="download-pdf-summary-btn"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  title="Download landscape PDF containing VAT TABLE, Schedules 1 to 3, and Form 2550Q VAT Summary"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download PDF Summary</span>
                    </>
                  )}
                </button>

                {/* Download VAT Comparison PDF (Actual vs Adjusted with Deferrals) */}
                <button
                  type="button"
                  id="download-comparison-pdf-btn"
                  onClick={handleExportComparisonPdf}
                  disabled={isExportingComparisonPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  title="Download Comparison PDF containing Actual VAT Table, Adjusted VAT Table, and Summary of Deferrals"
                >
                  {isExportingComparisonPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Comparison...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Comparison PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Horizontally scrollable aggregation table container */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
                <thead>
                  {/* Category Header Row */}
                  <tr className="border-b border-slate-200">
                    <th
                      rowSpan={2}
                      className="py-3 px-3.5 bg-slate-100 text-slate-800 font-bold border-r border-slate-200 w-52 sticky left-0 z-10"
                    >
                      Branch / Line of Business
                    </th>
                    <th
                      colSpan={4}
                      className="py-2 px-3 text-center bg-violet-100/90 text-violet-950 font-bold border-r border-violet-200"
                    >
                      SALES
                    </th>
                    <th
                      colSpan={4}
                      className="py-2 px-3 text-center bg-amber-100/90 text-amber-950 font-bold border-r border-amber-200"
                    >
                      PURCHASES
                    </th>
                    <th
                      rowSpan={2}
                      className="py-3 px-3.5 text-right bg-slate-100 text-slate-800 font-bold w-36"
                    >
                      Net VAT Due / (Payable)
                    </th>
                  </tr>

                  {/* Individual Column Sub-headers */}
                  <tr className="bg-slate-50 text-[11px] text-slate-700 font-semibold border-b border-slate-200">
                    {/* Sales Columns */}
                    <th className="py-2 px-2.5 text-right bg-violet-50/60 font-semibold border-r border-slate-200">
                      <span>Exempt Sales</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-violet-50/60 font-semibold border-r border-slate-200">
                      <span>Zero-Rated Sales</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-violet-50/60 font-semibold border-r border-slate-200">
                      <span>Taxable (Excl. VAT)</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-violet-100/50 font-bold text-violet-900 border-r border-violet-200">
                      <span>Output Tax (VAT)</span>
                    </th>

                    {/* Purchases Columns */}
                    <th className="py-2 px-2.5 text-right bg-amber-50/60 font-semibold border-r border-slate-200">
                      <span>Exempt Purchases</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-amber-50/60 font-semibold border-r border-slate-200">
                      <span>Zero-Rated Purch.</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-amber-50/60 font-semibold border-r border-slate-200">
                      <span>Taxable (Excl. VAT)</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-amber-100/50 font-bold text-amber-900 border-r border-amber-200">
                      <span>Input Tax (VAT)</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {branchCalculations.map((bCalc) => {
                    const b = bCalc.branch;
                    const bSalesF = summaryViewMode === 'adjusted' ? bCalc.adjustedSalesF : bCalc.actualSalesF;
                    const bSalesG = summaryViewMode === 'adjusted' ? bCalc.adjustedSalesG : bCalc.actualSalesG;
                    const bSalesH = summaryViewMode === 'adjusted' ? bCalc.adjustedSalesH : bCalc.actualSalesH;
                    const bSalesL = summaryViewMode === 'adjusted' ? bCalc.adjustedSalesL : bCalc.actualSalesL;

                    const bPurchF = bCalc.bPurchF;
                    const bPurchG = bCalc.bPurchG;
                    const bPurchH = bCalc.bPurchH;
                    const bPurchL = bCalc.bPurchL;

                    const branchNetVat = summaryViewMode === 'adjusted' ? bCalc.adjustedNetVat : bCalc.actualNetVat;

                    return (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        {/* Branch Name */}
                        <td className="py-2 px-3.5 font-medium text-slate-900 border-r border-slate-200 sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{b.name}</span>
                          </div>
                          {summaryViewMode === 'adjusted' && bCalc.totalBranchDefTaxable > 0 && (
                            <div className="text-[10px] text-violet-600 font-mono mt-0.5" title={`Specific: -${formatPHP(bCalc.specTaxable)}, Pro-rated: -${formatPHP(bCalc.proRatedManualTaxable)}`}>
                              -{formatPHP(bCalc.totalBranchDefTaxable)} deferred
                            </div>
                          )}
                        </td>

                        {/* Sales Columns */}
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                          {formatPHP(bSalesF)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                          {formatPHP(bSalesG)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-medium text-slate-900 border-r border-slate-200">
                          {formatPHP(bSalesH)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-violet-700 bg-violet-50/30 border-r border-violet-200">
                          {formatPHP(bSalesL)}
                        </td>

                        {/* Purchases Columns */}
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                          {purchasesMode === 'per-branch' ? formatPHP(bPurchF) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                          {purchasesMode === 'per-branch' ? formatPHP(bPurchG) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-medium text-slate-900 border-r border-slate-200">
                          {purchasesMode === 'per-branch' ? formatPHP(bPurchH) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-amber-700 bg-amber-50/30 border-r border-amber-200">
                          {purchasesMode === 'per-branch' ? formatPHP(bPurchL) : '—'}
                        </td>

                        {/* Net VAT */}
                        <td className="py-2 px-3.5 text-right font-mono font-semibold text-slate-900">
                          {purchasesMode === 'per-branch' ? formatPHP(branchNetVat) : formatPHP(bSalesL)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* If Consolidated Purchases is active, show consolidated purchases row */}
                  {purchasesMode === 'consolidated' && (
                    <tr className="bg-amber-50/40">
                      <td className="py-2.5 px-3.5 font-medium text-amber-950 flex items-center gap-1.5 italic border-r border-amber-200 sticky left-0 bg-amber-50/40 z-10">
                        <span>📦 Consolidated Purchases</span>
                      </td>

                      {/* Sales cols blank for consolidated purchases */}
                      <td className="py-2 px-2.5 text-right text-slate-400 border-r border-slate-200">—</td>
                      <td className="py-2 px-2.5 text-right text-slate-400 border-r border-slate-200">—</td>
                      <td className="py-2 px-2.5 text-right text-slate-400 border-r border-slate-200">—</td>
                      <td className="py-2 px-2.5 text-right text-slate-400 border-r border-violet-200">—</td>

                      {/* Purchases cols */}
                      <td className="py-2 px-2.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {formatPHP(aggregatedTotals.purchasesColF)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {formatPHP(aggregatedTotals.purchasesColG)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-medium text-slate-900 border-r border-slate-200">
                        {formatPHP(aggregatedTotals.purchasesColH)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-amber-800 bg-amber-100/40 border-r border-amber-200">
                        {formatPHP(aggregatedTotals.purchasesColL)}
                      </td>

                      {/* Net Effect */}
                      <td className="py-2 px-3.5 text-right font-mono font-semibold text-amber-900">
                        -{formatPHP(aggregatedTotals.purchasesColL)}
                      </td>
                    </tr>
                  )}

                  {/* Grand Total Row */}
                  <tr className="bg-slate-900 text-white font-bold">
                    <td className="py-3 px-3.5 uppercase tracking-wider text-xs border-r border-slate-800 sticky left-0 bg-slate-900 z-10">
                      Grand Total {summaryViewMode === 'adjusted' ? '(Adjusted)' : '(Actual)'}
                    </td>

                    {/* Sales Column F */}
                    <td className="py-3 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800">
                      {formatPHP(displayTotals.salesColF)}
                    </td>

                    {/* Sales Column G */}
                    <td className="py-3 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800">
                      {formatPHP(displayTotals.salesColG)}
                    </td>

                    {/* Sales Column H */}
                    <td className="py-3 px-2.5 text-right font-mono text-white text-sm border-r border-slate-800">
                      {formatPHP(displayTotals.salesColH)}
                    </td>

                    {/* Sales Column L (Output VAT) */}
                    <td className="py-3 px-2.5 text-right font-mono text-violet-300 text-sm bg-violet-950/60 border-r border-violet-800">
                      {formatPHP(displayTotals.salesColL)}
                    </td>

                    {/* Purchases Column F */}
                    <td className="py-3 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800">
                      {formatPHP(displayTotals.purchasesColF)}
                    </td>

                    {/* Purchases Column G */}
                    <td className="py-3 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800">
                      {formatPHP(displayTotals.purchasesColG)}
                    </td>

                    {/* Purchases Column H */}
                    <td className="py-3 px-2.5 text-right font-mono text-white text-sm border-r border-slate-800">
                      {formatPHP(displayTotals.purchasesColH)}
                    </td>

                    {/* Purchases Column L (Input VAT) */}
                    <td className="py-3 px-2.5 text-right font-mono text-amber-300 text-sm bg-amber-950/60 border-r border-amber-800">
                      {formatPHP(displayTotals.purchasesColL)}
                    </td>

                    {/* Net VAT Payable */}
                    <td className="py-3 px-3.5 text-right font-mono text-emerald-400 text-sm">
                      {formatPHP(displayTotals.netVatPayable)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deferred Sales & VAT Adjustments Section under the Multi-Branch Aggregation Summary Table */}
            <div className="mt-3 p-3.5 bg-gradient-to-r from-violet-50/70 via-slate-50 to-indigo-50/70 border border-violet-200/80 rounded-xl shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        Deferred Sales & VAT Due Adjustments
                      </span>
                      {hasActiveDeferral ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active Deferrals Applied
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-200/80 text-slate-700">
                          None Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    id="open-deferred-sales-btn"
                    onClick={() => setShowDeferralModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Deferred Adjustments</span>
                  </button>

                  {hasActiveDeferral && (
                    <button
                      type="button"
                      id="clear-deferrals-btn"
                      onClick={() =>
                        setDeferralState({
                          deferredCustomerKeys: [],
                          manualTaxableSales: 0,
                          manualVatDue: 0,
                        })
                      }
                      className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-300 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                      title="Clear all customer exclusions and manual deferrals"
                    >
                      Clear Deferrals
                    </button>
                  )}
                </div>
              </div>

              {/* Active Deferral Breakdown Cards */}
              {hasActiveDeferral && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-violet-100 shadow-2xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Deferred Taxable Sales
                    </span>
                    <span className="text-sm font-bold text-violet-700 font-mono">
                      {formatPHP(totalDeferredTaxable)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-violet-100 shadow-2xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Deferred VAT Due (12%)
                    </span>
                    <span className="text-sm font-bold text-violet-900 font-mono">
                      {formatPHP(totalDeferredOutputTax)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-violet-100 shadow-2xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Deferred Companies
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {deferredCustomersList.length} transaction{deferredCustomersList.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-violet-100 shadow-2xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Manual Pro-rated Sales
                    </span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      {formatPHP(manualDefTaxable)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* BIR Form 2550Q Schedule 1 & 2 Integration Breakdown Card */}
            {isVat && (
              <div className="mt-3 p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Table className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <span>BIR Form 2550Q Schedules 1 &amp; 2 Sync Summary</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-100 text-violet-800">
                          {summaryViewMode === 'adjusted' ? 'Adjusted Figures' : 'Actual Figures'}
                        </span>
                      </h4>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="sync-breakdown-to-2550q-btn"
                    onClick={handleSyncToForm}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
                    title="Sync all data to Form 2550Q Schedules 1 and 2"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Sync from all Data</span>
                  </button>
                </div>

                {/* Schedule 1 Breakdown */}
                <div>
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-600"></span>
                    <span>Schedule 1: Output Taxable Sales Breakdown</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Vatable Sales */}
                    <div className="p-3 bg-violet-50/70 border border-violet-200/80 rounded-lg">
                      <div className="text-[11px] font-bold text-violet-950 uppercase tracking-wide">
                        Vatable Sales / Receipts (12%)
                      </div>
                      <div className="text-lg font-bold font-mono text-violet-800 mt-1">
                        {formatPHP(displayVatableSales)}
                      </div>
                    </div>

                    {/* Sales to Government */}
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg">
                      <div className="text-[11px] font-bold text-emerald-950 uppercase tracking-wide flex items-center justify-between">
                        <span>Sales to Government (12%)</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-200 text-emerald-800 rounded-full">
                          {governmentSalesSummary.count} checked
                        </span>
                      </div>
                      <div className="text-lg font-bold font-mono text-emerald-800 mt-1">
                        {formatPHP(displayGovSales)}
                      </div>
                    </div>

                    {/* Zero-Rated Sales */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                        Zero-Rated Sales (0%)
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-700 mt-1">
                        {formatPHP(displayZeroRatedSales)}
                      </div>
                    </div>

                    {/* VAT-Exempt Sales */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                        VAT-Exempt Sales
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-700 mt-1">
                        {formatPHP(displayVatExemptSales)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Schedule 2 Breakdown */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    <span>Schedule 2: Purchases &amp; Allowable Input Tax Breakdown</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Domestic Purchases of Goods */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg">
                      <div className="text-[11px] font-bold text-blue-950 uppercase tracking-wide flex items-center justify-between">
                        <span>Domestic Purchases of Goods</span>
                        <span className="text-[10px] font-mono text-blue-700 font-semibold">
                          Input Tax: {formatPHP(displayTotals.purchasesColL)}
                        </span>
                      </div>
                      <div className="text-lg font-bold font-mono text-blue-800 mt-1">
                        {formatPHP(displayTotals.purchasesColH)}
                      </div>
                    </div>

                    {/* Prior Quarter's Excess Input Tax */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg">
                      <div className="text-[11px] font-bold text-amber-950 uppercase tracking-wide flex items-center justify-between">
                        <span>Prior Quarter's Excess Input Tax</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            priorQuarterExcessInfo.excessInputVat > 0
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {priorQuarterExcessInfo.excessInputVat > 0 ? 'Negative Prev VAT Due' : '₱0.00 (Not Negative)'}
                        </span>
                      </div>
                      <div className="text-lg font-bold font-mono text-amber-800 mt-1">
                        {formatPHP(priorQuarterExcessInfo.excessInputVat)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BIR Form 2551Q Sales Sync Summary Card (Only for Non-VAT Clients) */}
        {!isVat && (
          <div className="pt-4 border-t border-slate-200">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <span>BIR Form 2551Q Percentage Tax Sales Sync</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                        {quarter} {year}
                      </span>
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  id="sync-breakdown-to-2551q-btn"
                  onClick={handleSyncToForm}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
                  title="Sync gross and exempt sales to BIR Form 2551Q"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Sync to Form 2551Q</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Gross Sales
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-1">
                    {formatPHP(displayTotals.salesColF + displayTotals.salesColG + displayTotals.salesColH)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Aggregated from all monthly sales files
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Exempt Sales
                  </div>
                  <div className="text-base font-bold font-mono text-slate-700 mt-1">
                    {formatPHP(displayTotals.salesColF)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Non-taxable percentage tax sales
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                  <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                    Taxable Base Sales (3%)
                  </div>
                  <div className="text-base font-bold font-mono text-amber-900 mt-1">
                    {formatPHP(displayTotals.salesColH)}
                  </div>
                  <div className="text-[10px] text-amber-700 mt-0.5 font-medium">
                    Est. 3% Tax: {formatPHP(displayTotals.salesColH * 0.03)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Transaction Details Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-violet-600 text-white">
                    {previewFile.fileType.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {previewFile.fileName}
                  </span>
                </div>
                <h4 className="text-sm font-semibold mt-1">
                  BIR SLSP Sheet Preview ({previewFile.rowCount} record(s))
                </h4>
              </div>

              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Header TIN:</span>
                <span className="font-mono font-medium text-slate-900">{previewFile.tinHeader || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Owner Name:</span>
                <span className="font-medium text-slate-900 truncate block">{previewFile.ownerNameHeader || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Gross:</span>
                <span className="font-mono font-bold text-slate-900">{formatPHP(previewFile.totals.grossAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Tax:</span>
                <span className="font-mono font-bold text-violet-700">{formatPHP(previewFile.totals.taxAmount)}</span>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1">
              {previewFile.transactions && previewFile.transactions.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2 px-2">Row</th>
                      <th className="py-2 px-2">Month</th>
                      <th className="py-2 px-2">TIN</th>
                      <th className="py-2 px-3">Registered Name</th>
                      <th className="py-2 px-3">Address</th>
                      <th className="py-2 px-2 text-right">Gross</th>
                      <th className="py-2 px-2 text-right">Taxable</th>
                      <th className="py-2 px-2 text-right">Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewFile.transactions.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2 text-slate-400">{t.rowNum}</td>
                        <td className="py-1.5 px-2 text-slate-600">{t.taxableMonth || '—'}</td>
                        <td className="py-1.5 px-2 text-slate-800">{t.tin || '—'}</td>
                        <td className="py-1.5 px-3 font-sans text-slate-900 truncate max-w-[150px]">{t.registeredName}</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600 truncate max-w-[150px]">{t.address}</td>
                        <td className="py-1.5 px-2 text-right text-slate-800">{formatPHP(t.grossAmount)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-800">{formatPHP(t.taxableAmount)}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-violet-700">{formatPHP(t.taxAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No individual line items entered. Summary totals were read directly from Report Summary Row 1999.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Combined Quarterly Sales Modal */}
      {showCombinedSalesModal && (
        <div
          id="combined-sales-modal-backdrop"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6"
        >
          <div
            id="combined-sales-modal"
            className="bg-white rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-violet-950 text-white flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-violet-600 text-white tracking-wider">
                    COMBINED SALES REPORT
                  </span>
                  <span className="text-xs text-violet-200 font-medium">
                    {quarter} {year} • {client.registeredName || client.tradeName}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold mt-1 text-white flex items-center gap-2">
                  <span>Combined Sales in the Quarter</span>
                  <span className="text-xs font-normal text-slate-300 font-mono">
                    ({allQuarterSalesTransactions.length} total recorded transaction{allQuarterSalesTransactions.length === 1 ? '' : 's'})
                  </span>
                </h3>
              </div>

              <button
                type="button"
                id="close-combined-sales-modal-btn"
                onClick={() => setShowCombinedSalesModal(false)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Metrics Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Filtered Records:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {filteredCombinedSales.length}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  of {allQuarterSalesTransactions.length} total txns
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Total Gross Sales:</span>
                <span className="font-mono font-bold text-slate-900 text-sm truncate block" title={formatPHP(combinedSalesTotals.grossAmount)}>
                  {formatPHP(combinedSalesTotals.grossAmount)}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Taxable: {formatPHP(combinedSalesTotals.taxableAmount)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-violet-200 bg-violet-50/30">
                <span className="text-violet-700 block text-[11px] font-semibold">Output VAT (12%):</span>
                <span className="font-mono font-bold text-violet-700 text-sm truncate block" title={formatPHP(combinedSalesTotals.taxAmount)}>
                  {formatPHP(combinedSalesTotals.taxAmount)}
                </span>
                <span className="text-[10px] text-violet-600 block">
                  Quarterly 12% liability
                </span>
              </div>
              {/* Checklist Tag: Government Sales Card */}
              <div
                onClick={() => setCombinedSalesTagFilter(combinedSalesTagFilter === 'govt' ? 'all' : 'govt')}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  combinedSalesTagFilter === 'govt'
                    ? 'bg-emerald-100/70 border-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-emerald-50/50 hover:bg-emerald-100/50 border-emerald-200'
                }`}
                title="Click to filter by Government Sales"
              >
                <div className="flex items-center justify-between">
                  <span className="text-emerald-800 font-semibold text-[11px] flex items-center gap-1">
                    <Landmark className="w-3 h-3 text-emerald-700" />
                    Gov't Sales
                  </span>
                  <span className="px-1.5 py-0.2 bg-emerald-600 text-white font-mono text-[10px] font-bold rounded-full">
                    {governmentSalesSummary.count}
                  </span>
                </div>
                <div className="font-mono font-bold text-emerald-950 text-sm mt-0.5 truncate" title={formatPHP(governmentSalesSummary.taxable)}>
                  {formatPHP(governmentSalesSummary.taxable)}
                </div>
                <div className="text-[10px] text-emerald-700 truncate" title={`5% Withheld VAT: ${formatPHP(governmentSalesSummary.withheld5Pct)}`}>
                  5% Withheld: {formatPHP(governmentSalesSummary.withheld5Pct)}
                </div>
              </div>
              {/* Checklist Tag: Form 2307 Certificates Card */}
              <div
                onClick={() => setCombinedSalesTagFilter(combinedSalesTagFilter === '2307' ? 'all' : '2307')}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  combinedSalesTagFilter === '2307'
                    ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-500/20'
                    : 'bg-amber-50/50 hover:bg-amber-100/50 border-amber-200'
                }`}
                title="Click to filter by Sales with Form 2307"
              >
                <div className="flex items-center justify-between">
                  <span className="text-amber-800 font-semibold text-[11px] flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-700" />
                    2307 Certs
                  </span>
                  <span className="px-1.5 py-0.2 bg-amber-600 text-white font-mono text-[10px] font-bold rounded-full">
                    {has2307SalesSummary.count}
                  </span>
                </div>
                <div className="font-mono font-bold text-amber-950 text-sm mt-0.5 truncate" title={formatPHP(has2307SalesSummary.taxable)}>
                  {formatPHP(has2307SalesSummary.taxable)}
                </div>
                <div className="text-[10px] text-amber-700 truncate" title={`Output VAT: ${formatPHP(has2307SalesSummary.outputTax)}`}>
                  Output VAT: {formatPHP(has2307SalesSummary.outputTax)}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Exempt & 0-Rated:</span>
                <span className="font-mono font-bold text-slate-700 text-sm truncate block">
                  {formatPHP(combinedSalesTotals.exemptAmount + combinedSalesTotals.zeroRatedAmount)}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Ex: {formatPHP(combinedSalesTotals.exemptAmount)} • 0R: {formatPHP(combinedSalesTotals.zeroRatedAmount)}
                </span>
              </div>
            </div>

            {/* Filter Controls Toolbar */}
            <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Customer Filter Dropdown */}
                <div className="flex items-center gap-1.5 min-w-[210px] max-w-[320px]">
                  <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-violet-600" />
                    Customer:
                  </span>
                  <div className="relative flex-1">
                    <select
                      id="combined-sales-customer-filter"
                      value={combinedSalesCustomerFilter}
                      onChange={(e) => setCombinedSalesCustomerFilter(e.target.value)}
                      className="w-full px-2.5 py-1 bg-slate-50 hover:bg-white border border-slate-300 focus:border-violet-500 rounded-lg text-xs font-medium text-slate-800 cursor-pointer truncate transition-colors"
                    >
                      <option value="all">All Customers ({uniqueCustomerList.length})</option>
                      {uniqueCustomerList.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.count} txns{c.govtCount > 0 ? ` • ${c.govtCount} Gov` : ''}{c.cert2307Count > 0 ? ` • ${c.cert2307Count} 2307` : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                  {combinedSalesCustomerFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setCombinedSalesCustomerFilter('all')}
                      title="Clear customer filter"
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Month Filter Tabs */}
                <div className="flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCombinedSalesFilterMonth('all')}
                    className={`px-2 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                      combinedSalesFilterMonth === 'all'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All 3 Months
                  </button>
                  {monthList.map((m) => (
                    <button
                      key={m.index}
                      type="button"
                      onClick={() => setCombinedSalesFilterMonth(m.index)}
                      className={`px-2 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                        combinedSalesFilterMonth === m.index
                          ? 'bg-white text-slate-900 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Branch selector if multiple branches exist */}
                {branches.length > 1 && (
                  <select
                    value={combinedSalesBranchFilter}
                    onChange={(e) => setCombinedSalesBranchFilter(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="all">All Branches ({branches.length})</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Tag Filter Chips */}
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCombinedSalesTagFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      combinedSalesTagFilter === 'all'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Tags
                  </button>
                  <button
                    type="button"
                    onClick={() => setCombinedSalesTagFilter('govt')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      combinedSalesTagFilter === 'govt'
                        ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                        : 'text-emerald-800 hover:bg-emerald-100/60'
                    }`}
                  >
                    <Landmark className="w-2.5 h-2.5" />
                    Gov't ({governmentSalesSummary.count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCombinedSalesTagFilter('2307')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      combinedSalesTagFilter === '2307'
                        ? 'bg-amber-600 text-white font-bold shadow-2xs'
                        : 'text-amber-800 hover:bg-amber-100/60'
                    }`}
                  >
                    <FileText className="w-2.5 h-2.5" />
                    2307 ({has2307SalesSummary.count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCombinedSalesTagFilter('both')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      combinedSalesTagFilter === 'both'
                        ? 'bg-violet-600 text-white font-bold shadow-2xs'
                        : 'text-violet-800 hover:bg-violet-100/60'
                    }`}
                  >
                    Both
                  </button>
                  <button
                    type="button"
                    onClick={() => setCombinedSalesTagFilter('none')}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      combinedSalesTagFilter === 'none'
                        ? 'bg-slate-700 text-white font-bold shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Untagged
                  </button>
                </div>
              </div>

              {/* Search input */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, TIN, address..."
                  value={combinedSalesSearchQuery}
                  onChange={(e) => setCombinedSalesSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-violet-500 focus:bg-white"
                />
                {combinedSalesSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCombinedSalesSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Checklist Action Bar (Check all / uncheck based on filter) */}
            <div className="px-4 py-2 bg-gradient-to-r from-violet-50/70 via-slate-50 to-emerald-50/40 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
                  <CheckSquare className="w-4 h-4 text-violet-600" />
                  <span>Checklist Controls on Filtered ({filteredCombinedSales.length}):</span>
                </span>

                {/* Check / Uncheck All Government */}
                <div className="inline-flex rounded-lg shadow-2xs border border-emerald-300 overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAllFilteredGovernment(true)}
                    disabled={filteredCombinedSales.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
                    title="Check all filtered sales as Government"
                  >
                    <Landmark className="w-3 h-3" />
                    <span>Check All as Gov't</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllFilteredGovernment(false)}
                    disabled={filteredCombinedSales.length === 0}
                    className="px-2 py-1 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-50 border-l border-emerald-300 transition-colors cursor-pointer"
                    title="Uncheck Government for filtered sales"
                  >
                    Uncheck
                  </button>
                </div>

                {/* Check / Uncheck All 2307 Certificates */}
                <div className="inline-flex rounded-lg shadow-2xs border border-amber-300 overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAllFiltered2307(true)}
                    disabled={filteredCombinedSales.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
                    title="Check all filtered sales as having 2307 Certificate"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Check All as 2307</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllFiltered2307(false)}
                    disabled={filteredCombinedSales.length === 0}
                    className="px-2 py-1 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-900 disabled:opacity-50 border-l border-amber-300 transition-colors cursor-pointer"
                    title="Uncheck 2307 for filtered sales"
                  >
                    Uncheck
                  </button>
                </div>

                {/* Check Both */}
                <button
                  type="button"
                  onClick={handleCheckAllFilteredBoth}
                  disabled={filteredCombinedSales.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
                  title="Mark all filtered records as both Government and 2307"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Check Both</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Auto Detect Government Agencies */}
                <button
                  type="button"
                  onClick={handleAutoDetectGovernment}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Auto-scan customer names for government entities (DepEd, DPWH, LGU, City of, etc.)"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Auto-Detect Gov't</span>
                </button>

                {/* Reset all tags */}
                {(governmentSalesKeys.length > 0 || has2307SalesKeys.length > 0) && (
                  <button
                    type="button"
                    onClick={handleClearAllChecklistTags}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-300 hover:border-rose-300 rounded-lg transition-colors cursor-pointer"
                    title="Reset all Government & 2307 checklist marks"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear Tags</span>
                  </button>
                )}
              </div>
            </div>

            {/* Checklist Feedback Banner */}
            {checklistFeedbackMsg && (
              <div
                className={`px-4 py-1.5 text-xs flex items-center justify-between border-b transition-colors ${
                  checklistFeedbackMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-blue-50 text-blue-900 border-blue-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{checklistFeedbackMsg.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setChecklistFeedbackMsg(null)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Scrollable Transactions Table */}
            <div className="overflow-auto flex-1 min-h-[300px]">
              {filteredCombinedSales.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 z-10 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-8 text-slate-500">#</th>

                      {/* Government Checklist Header with Master Toggle */}
                      <th className="py-2 px-2 text-center w-24 bg-emerald-50/90 border-x border-emerald-200 text-emerald-900">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="checkbox"
                            checked={isAllFilteredGovtChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeFilteredGovtChecked;
                            }}
                            onChange={(e) => handleToggleAllFilteredGovernment(e.target.checked)}
                            title="Check / uncheck all filtered rows as Government Sales"
                            className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="flex items-center gap-0.5 text-[11px] font-bold">
                            <Landmark className="w-3 h-3 text-emerald-600" />
                            Gov't
                          </span>
                        </div>
                      </th>

                      {/* Form 2307 Checklist Header with Master Toggle */}
                      <th className="py-2 px-2 text-center w-24 bg-amber-50/90 border-r border-amber-200 text-amber-900">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="checkbox"
                            checked={isAllFiltered2307Checked}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeFiltered2307Checked;
                            }}
                            onChange={(e) => handleToggleAllFiltered2307(e.target.checked)}
                            title="Check / uncheck all filtered rows as having Form 2307 Certificates"
                            className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="flex items-center gap-0.5 text-[11px] font-bold">
                            <FileText className="w-3 h-3 text-amber-600" />
                            2307
                          </span>
                        </div>
                      </th>

                      <th className="py-2.5 px-2.5">Month</th>
                      {branches.length > 1 && <th className="py-2.5 px-3">Branch</th>}
                      <th className="py-2.5 px-2">Period</th>
                      <th className="py-2.5 px-2.5">Customer TIN</th>
                      <th className="py-2.5 px-3">Registered Name</th>
                      <th className="py-2.5 px-3">Address</th>
                      <th className="py-2.5 px-2 text-right">Gross Sales</th>
                      <th className="py-2.5 px-2 text-right">Exempt</th>
                      <th className="py-2.5 px-2 text-right">Zero-Rated</th>
                      <th className="py-2.5 px-2 text-right">Taxable (12%)</th>
                      <th className="py-2.5 px-2 text-right text-violet-700">Output VAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredCombinedSales.map((t, idx) => {
                      const txKey = getSalesTxKey(t);
                      const isGov = governmentKeySet.has(txKey);
                      const is2307 = has2307KeySet.has(txKey);

                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isGov && is2307
                              ? 'bg-violet-50/50 hover:bg-violet-100/50'
                              : isGov
                              ? 'bg-emerald-50/40 hover:bg-emerald-100/50'
                              : is2307
                              ? 'bg-amber-50/40 hover:bg-amber-100/50'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-2 px-2 text-center text-slate-400 font-sans text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Government Checkbox Cell */}
                          <td className="py-1.5 px-2 text-center bg-emerald-50/20 border-x border-emerald-100/70">
                            <label className="inline-flex items-center justify-center gap-1 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isGov}
                                onChange={() => toggleGovernmentKey(txKey)}
                                title="Mark as Government Sale"
                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span
                                className={`text-[9px] font-bold px-1 py-0.2 rounded transition-colors ${
                                  isGov ? 'bg-emerald-600 text-white' : 'text-slate-400'
                                }`}
                              >
                                Gov
                              </span>
                            </label>
                          </td>

                          {/* 2307 Checkbox Cell */}
                          <td className="py-1.5 px-2 text-center bg-amber-50/20 border-r border-amber-100/70">
                            <label className="inline-flex items-center justify-center gap-1 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={is2307}
                                onChange={() => toggle2307Key(txKey)}
                                title="Mark as having 2307 Certificate"
                                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                              />
                              <span
                                className={`text-[9px] font-bold px-1 py-0.2 rounded transition-colors ${
                                  is2307 ? 'bg-amber-600 text-white' : 'text-slate-400'
                                }`}
                              >
                                2307
                              </span>
                            </label>
                          </td>

                          <td className="py-2 px-2.5 font-sans">
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                t.monthIndex === 1
                                  ? 'bg-blue-100 text-blue-800'
                                  : t.monthIndex === 2
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-pink-100 text-pink-800'
                              }`}
                            >
                              {t.monthLabel}
                            </span>
                          </td>
                          {branches.length > 1 && (
                            <td className="py-2 px-3 font-sans text-slate-700 max-w-[130px] truncate" title={t.branchName}>
                              {t.branchName}
                            </td>
                          )}
                          <td className="py-2 px-2 text-slate-600">{t.taxableMonth || '—'}</td>
                          <td className="py-2 px-2.5 text-slate-800 font-medium">{t.tin || '—'}</td>
                          <td className="py-2 px-3 font-sans text-slate-900 font-medium max-w-[210px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="truncate" title={t.registeredName}>
                                {t.registeredName}
                              </span>
                              {isGov && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 text-[8.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded shrink-0">
                                  <Landmark className="w-2.5 h-2.5" />
                                  Gov't
                                </span>
                              )}
                              {is2307 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 text-[8.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded shrink-0">
                                  <FileText className="w-2.5 h-2.5" />
                                  2307
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600 truncate max-w-[150px]" title={t.address}>
                            {t.address || '—'}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-800">
                            {formatPHP(t.grossAmount)}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-600">
                            {t.exemptAmount ? formatPHP(t.exemptAmount) : '—'}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-600">
                            {t.zeroRatedAmount ? formatPHP(t.zeroRatedAmount) : '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-slate-900">
                            {formatPHP(t.taxableAmount)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-violet-700">
                            {formatPHP(t.taxAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Sticky Table Footer Totals */}
                  <tfoot className="sticky bottom-0 bg-slate-100 border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900 z-10">
                    <tr>
                      <td
                        colSpan={branches.length > 1 ? 9 : 8}
                        className="py-2.5 px-3 font-sans text-right uppercase tracking-wider text-slate-700"
                      >
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <span>
                            Combined Totals ({filteredCombinedSales.length} records):
                          </span>
                          {filteredGovtCheckedCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md">
                              <Landmark className="w-3 h-3 text-emerald-700" />
                              {filteredGovtCheckedCount} Gov't
                            </span>
                          )}
                          {filtered2307CheckedCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                              <FileText className="w-3 h-3 text-amber-700" />
                              {filtered2307CheckedCount} 2307
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-900">
                        {formatPHP(combinedSalesTotals.grossAmount)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-700">
                        {formatPHP(combinedSalesTotals.exemptAmount)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-700">
                        {formatPHP(combinedSalesTotals.zeroRatedAmount)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-900">
                        {formatPHP(combinedSalesTotals.taxableAmount)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-violet-700">
                        {formatPHP(combinedSalesTotals.taxAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="py-16 text-center text-slate-500 text-xs space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-slate-700 text-sm">
                    No Sales Transactions Found
                  </div>
                  <p className="text-slate-500 max-w-md mx-auto">
                    {allQuarterSalesTransactions.length === 0
                      ? `No sales files have been uploaded yet for 1st, 2nd, or 3rd month of ${quarter}. Upload your Excel files under SALES IN THE QUARTER to view combined transaction details here.`
                      : `No transactions matched your current search or filter criteria. Try resetting the customer or month filter, or clearing the search query.`}
                  </p>
                  {(combinedSalesCustomerFilter !== 'all' ||
                    combinedSalesTagFilter !== 'all' ||
                    combinedSalesFilterMonth !== 'all' ||
                    combinedSalesSearchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCombinedSalesCustomerFilter('all');
                        setCombinedSalesTagFilter('all');
                        setCombinedSalesFilterMonth('all');
                        setCombinedSalesSearchQuery('');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg transition-colors cursor-pointer mt-2"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset All Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                <span className="text-slate-400">Compliance Summary:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <Landmark className="w-3 h-3 text-emerald-600" />
                  {governmentSalesSummary.count} Government Sales ({formatPHP(governmentSalesSummary.taxable)} Taxable)
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <FileText className="w-3 h-3 text-amber-600" />
                  {has2307SalesSummary.count} with Form 2307 ({formatPHP(has2307SalesSummary.taxable)} Taxable)
                </span>
              </div>
              <button
                type="button"
                id="close-combined-sales-btn"
                onClick={() => setShowCombinedSalesModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Branch In-App Confirmation Modal */}
      {branchToDelete && (
        <div
          id="delete-branch-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setBranchToDelete(null)}
        >
          <div
            id="delete-branch-modal"
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-800">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-950">Delete Branch</h3>
                  <p className="text-[11px] text-rose-700">{quarter} {year} Schedule</p>
                </div>
              </div>
              <button
                type="button"
                id="close-delete-branch-modal-btn"
                onClick={() => setBranchToDelete(null)}
                className="p-1 rounded-md text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 block">Branch to Delete</span>
                  <span className="text-sm font-bold text-slate-900 truncate block">{branchToDelete.name}</span>
                </div>
              </div>

              {branches.length > 1 ? (
                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    Are you sure you want to delete this branch? This action will permanently remove{' '}
                    <strong className="text-slate-900">{branchToDelete.name}</strong> and all of its uploaded monthly Sales and Purchases files.
                  </p>
                  {(() => {
                    const salesCount = Object.keys(branchToDelete.salesFiles || {}).length;
                    const purchCount = Object.keys(branchToDelete.purchasesFiles || {}).length;
                    if (salesCount > 0 || purchCount > 0) {
                      return (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                          <span>
                            Warning: <strong>{salesCount} Sales</strong> {isVat && purchasesMode === 'per-branch' ? `and ${purchCount} Purchases ` : ''}file(s) associated with this branch will be permanently removed.
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    This is currently the <strong>only branch</strong> in this quarterly schedule. Deleting it will clear all uploaded monthly Sales and Purchases files and reset this branch to a clean blank state.
                  </p>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>All uploaded records for this branch will be cleared.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="cancel-delete-branch-btn"
                onClick={() => setBranchToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-branch-btn"
                onClick={handleConfirmDeleteBranch}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{branches.length > 1 ? 'Delete Branch' : 'Delete & Reset Branch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deferred Sales & VAT Adjustments Modal */}
      {showDeferralModal && (
        <DeferredSalesModal
          isOpen={showDeferralModal}
          onClose={() => setShowDeferralModal(false)}
          client={client}
          year={year}
          quarter={quarter}
          allTransactions={allQuarterSalesTransactions}
          branches={branches}
          deferralState={deferralState}
          onSave={(newState) => {
            setDeferralState(newState);
            setSummaryViewMode('adjusted');
            setShowDeferralModal(false);
            setSyncSuccessMsg('Sales and VAT Due deferral adjustments updated and applied to Multi-Branch Aggregation!');
            setTimeout(() => setSyncSuccessMsg(null), 4000);
          }}
          totalActualTaxableSales={aggregatedTotals.salesColH}
          totalActualOutputTax={aggregatedTotals.salesColL}
        />
      )}

      {/* Combined Purchases Modal (Per-Branch) */}
      <CombinedPurchasesModal
        isOpen={showCombinedPurchasesModal}
        onClose={() => setShowCombinedPurchasesModal(false)}
        client={client}
        quarter={quarter}
        year={year}
        branches={branches}
        allTransactions={allQuarterPurchasesTransactions}
      />
    </div>
  );
};
