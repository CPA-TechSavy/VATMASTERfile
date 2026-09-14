import React, { useState, useEffect, useMemo } from 'react';
import {
  ClientProfile,
  Data1701Q,
  Data1702Q,
  Data2550Q,
  Data2551Q,
  Data1601C,
  Data1601EQ,
  Data1701Annual,
  Data1702Annual,
  Quarter,
} from './types/tax';
import {
  DEFAULT_CLIENTS,
  INITIAL_DATA_1701Q,
  INITIAL_DATA_1702Q,
  INITIAL_DATA_2550Q,
  INITIAL_DATA_2551Q,
  INITIAL_DATA_1601C,
  INITIAL_DATA_1601EQ,
} from './data/defaultClients';
import { ClientHeader } from './components/ClientHeader';
import { getRealTimeTaxPeriod, calculate1701Q, calculate1702Q } from './utils/taxCalculations';
import { ClientModal } from './components/ClientModal';
import { Form1701QView } from './components/Form1701QView';
import { Form1702QView } from './components/Form1702QView';
import { Form2550QView } from './components/Form2550QView';
import { Form2551QView } from './components/Form2551QView';
import { Form1601CView } from './components/Form1601CView';
import { Form1601EQView } from './components/Form1601EQView';
import { Form1701AnnualView } from './components/Form1701AnnualView';
import { Form1702AnnualView } from './components/Form1702AnnualView';
import { FilingSummaryView } from './components/FilingSummaryView';
import { TaxDeadlineCalendar } from './components/TaxDeadlineCalendar';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  FileCheck,
  CalendarDays,
  Calculator,
  Building,
  Receipt,
  Percent,
  Users,
  Layers,
  Sparkles,
  RotateCcw,
  Lock,
  AlertCircle,
  Trash2,
  X,
  Plus,
} from 'lucide-react';

type FormTab =
  | 'summary'
  | 'calendar'
  | '1701Q'
  | '1702Q'
  | '2550Q'
  | '2551Q'
  | '1601C'
  | '1601EQ'
  | '1701Annual'
  | '1702Annual'
  | 'annual';

const STORAGE_KEY_CLIENTS = 'bir_app_clients_v2';
const STORAGE_KEY_DATA = 'bir_app_data_v2';

export default function App() {
  // Clients state - initialized to clean slate (no demo clients)
  const [clients, setClients] = useState<ClientProfile[]>(() => {
    // Purge legacy v1 demo data if present
    try {
      localStorage.removeItem('bir_app_clients_v1');
      localStorage.removeItem('bir_app_data_v1_1701Q');
      localStorage.removeItem('bir_app_data_v1_1702Q');
      localStorage.removeItem('bir_app_data_v1_2550Q');
      localStorage.removeItem('bir_app_data_v1_2551Q');
      localStorage.removeItem('bir_app_data_v1_1601C');
      localStorage.removeItem('bir_app_data_v1_1601EQ');
      localStorage.removeItem('bir_submitted_returns');
      ['client-1', 'client-2', 'client-3', 'client-4', 'client-5'].forEach((id) => {
        localStorage.removeItem(`bir_branch_schedule_${id}`);
      });
    } catch {}

    const saved = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (c: any) => !['client-1', 'client-2', 'client-3', 'client-4', 'client-5'].includes(c.id)
          );
        }
      } catch (e) {
        console.error('Failed to parse saved clients', e);
      }
    }
    return DEFAULT_CLIENTS;
  });

  const [activeClientId, setActiveClientId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed[0]?.id &&
          !['client-1', 'client-2', 'client-3', 'client-4', 'client-5'].includes(parsed[0].id)
        ) {
          return parsed[0].id;
        }
      } catch {}
    }
    return '';
  });

  // Active period - follows the real time date
  const [year, setYear] = useState<number>(() => getRealTimeTaxPeriod().year);
  const [quarter, setQuarter] = useState<Quarter>(() => getRealTimeTaxPeriod().quarter);
  const [month, setMonth] = useState<number>(() => getRealTimeTaxPeriod().month);

  // Active tab
  const [activeTab, setActiveTab] = useState<FormTab>('summary');

  // Modal state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<ClientProfile | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientProfile | null>(null);
  const [deleteClientError, setDeleteClientError] = useState<string | null>(null);

  // Helper to migrate legacy un-quartered data keys (e.g. "client-1") to "client-1_2026_Q1"
  // so data is strictly isolated by quarter and does not leak into newly selected quarters
  const sanitizeQuarterMap = <T,>(map: Record<string, T>, defaultPeriodSuffix: string): Record<string, T> => {
    const cleaned: Record<string, T> = {};
    for (const [key, val] of Object.entries(map)) {
      if (key.includes('_Q') || key.includes('_M')) {
        cleaned[key] = val;
      } else {
        // Place into default period (e.g. 2026_Q1) if not already explicitly keyed
        const isolatedKey = `${key}_${defaultPeriodSuffix}`;
        if (!cleaned[isolatedKey]) {
          cleaned[isolatedKey] = val;
        }
      }
    }
    return cleaned;
  };

  // Per-client calculation data
  const [data1701QMap, setData1701QMap] = useState<Record<string, Data1701Q>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_DATA}_1701Q`);
      return saved ? sanitizeQuarterMap(JSON.parse(saved), '2026_Q1') : sanitizeQuarterMap(INITIAL_DATA_1701Q, '2026_Q1');
    } catch {
      return sanitizeQuarterMap(INITIAL_DATA_1701Q, '2026_Q1');
    }
  });

  const [data1702QMap, setData1702QMap] = useState<Record<string, Data1702Q>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_DATA}_1702Q`);
      return saved ? sanitizeQuarterMap(JSON.parse(saved), '2026_Q1') : sanitizeQuarterMap(INITIAL_DATA_1702Q, '2026_Q1');
    } catch {
      return sanitizeQuarterMap(INITIAL_DATA_1702Q, '2026_Q1');
    }
  });

  const [data2550QMap, setData2550QMap] = useState<Record<string, Data2550Q>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_DATA}_2550Q`);
      return saved ? sanitizeQuarterMap(JSON.parse(saved), '2026_Q1') : sanitizeQuarterMap(INITIAL_DATA_2550Q, '2026_Q1');
    } catch {
      return sanitizeQuarterMap(INITIAL_DATA_2550Q, '2026_Q1');
    }
  });

  const [data2551QMap, setData2551QMap] = useState<Record<string, Data2551Q>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_DATA}_2551Q`);
      return saved ? sanitizeQuarterMap(JSON.parse(saved), '2026_Q1') : sanitizeQuarterMap(INITIAL_DATA_2551Q, '2026_Q1');
    } catch {
      return sanitizeQuarterMap(INITIAL_DATA_2551Q, '2026_Q1');
    }
  });

  const [data1601CMap, setData1601CMap] = useState<Record<string, Data1601C>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_DATA}_1601C`);
      return saved ? sanitizeQuarterMap(JSON.parse(saved), '2026_M1') : sanitizeQuarterMap(INITIAL_DATA_1601C, '2026_M1');
    } catch {
      return sanitizeQuarterMap(INITIAL_DATA_1601C, '2026_M1');
    }
  });

  const [data1601EQMap, setData1601EQMap] = useState<Record<string, Data1601EQ>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_DATA}_1601EQ`);
      return saved ? sanitizeQuarterMap(JSON.parse(saved), '2026_Q1') : sanitizeQuarterMap(INITIAL_DATA_1601EQ, '2026_Q1');
    } catch {
      return sanitizeQuarterMap(INITIAL_DATA_1601EQ, '2026_Q1');
    }
  });

  const [data1701AnnualMap, setData1701AnnualMap] = useState<Record<string, Data1701Annual>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_DATA}_1701Annual`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [data1702AnnualMap, setData1702AnnualMap] = useState<Record<string, Data1702Annual>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_DATA}_1702Annual`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_DATA}_1701Q`, JSON.stringify(data1701QMap));
  }, [data1701QMap]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_DATA}_1702Q`, JSON.stringify(data1702QMap));
  }, [data1702QMap]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_DATA}_2550Q`, JSON.stringify(data2550QMap));
  }, [data2550QMap]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_DATA}_2551Q`, JSON.stringify(data2551QMap));
  }, [data2551QMap]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_DATA}_1601C`, JSON.stringify(data1601CMap));
  }, [data1601CMap]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_DATA}_1601EQ`, JSON.stringify(data1601EQMap));
  }, [data1601EQMap]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_DATA}_1701Annual`, JSON.stringify(data1701AnnualMap));
  }, [data1701AnnualMap]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_DATA}_1702Annual`, JSON.stringify(data1702AnnualMap));
  }, [data1702AnnualMap]);

  // Current client
  const activeClient: ClientProfile | null = clients.find((c) => c.id === activeClientId) || clients[0] || null;

  const isSingle = activeClient?.classification === 'Single';
  const isCorp = activeClient ? !isSingle : false;
  const isVat = activeClient?.vatStatus === 'vat-registered';
  const isWithholding = !!activeClient?.isWithholdingAgent;

  // Track submission statuses for BIR returns (key: clientId_year_period_form)
  const [submittedReturns, setSubmittedReturns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('bir_submitted_returns');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleToggleSubmission = (key: string) => {
    setSubmittedReturns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('bir_submitted_returns', JSON.stringify(updated));
      return updated;
    });
  };

  // Locked Tab Notice
  const [lockedTabNotice, setLockedTabNotice] = useState<string | null>(null);

  // Tab lock logic based on Filing Schedule & Summary requirements
  const getTabLockInfo = (tab: FormTab): { locked: boolean; reason?: string } => {
    if (!activeClient) return { locked: false };
    if (tab === '1701Q' && !isSingle) {
      return {
        locked: true,
        reason: `BIR Form 1701Q is locked. ${activeClient.tradeName} is classified as "${activeClient.classification}" and must file BIR Form 1702Q instead.`,
      };
    }
    if (tab === '1702Q' && isSingle) {
      return {
        locked: true,
        reason: `BIR Form 1702Q is locked. ${activeClient.tradeName} is a Single Proprietorship and must file BIR Form 1701Q instead.`,
      };
    }
    if (tab === '2550Q' && !isVat) {
      return {
        locked: true,
        reason: `BIR Form 2550Q (12% VAT) is locked. ${activeClient.tradeName} is Non-VAT and must file BIR Form 2551Q (Percentage Tax) instead.`,
      };
    }
    if (tab === '2551Q' && isVat) {
      return {
        locked: true,
        reason: `BIR Form 2551Q (Percentage Tax) is locked. ${activeClient.tradeName} is VAT-Registered and must file BIR Form 2550Q (12% VAT) instead.`,
      };
    }
    if (tab === '1601C' && !isWithholding) {
      return {
        locked: true,
        reason: `BIR Form 1601-C is locked. ${activeClient.tradeName} does not have withholding agent status enabled.`,
      };
    }
    if (tab === '1601EQ' && !isWithholding) {
      return {
        locked: true,
        reason: `BIR Form 0619-E / 1601-EQ is locked. ${activeClient.tradeName} does not have withholding agent status enabled.`,
      };
    }
    if (tab === '1701Annual' && !isSingle) {
      return {
        locked: true,
        reason: `BIR Form 1701 (Annual ITR) is locked. ${activeClient.tradeName} is classified as "${activeClient.classification}" and must file BIR Form 1702-RT (Annual) instead.`,
      };
    }
    if (tab === '1702Annual' && isSingle) {
      return {
        locked: true,
        reason: `BIR Form 1702-RT (Annual ITR) is locked. ${activeClient.tradeName} is a Single Proprietorship and must file BIR Form 1701 (Annual) instead.`,
      };
    }
    return { locked: false };
  };

  const handleSelectTab = (tab: FormTab) => {
    const lock = getTabLockInfo(tab);
    if (lock.locked) {
      setLockedTabNotice(lock.reason || 'This form is locked for this client.');
      setTimeout(() => setLockedTabNotice(null), 6000);
      return;
    }
    setLockedTabNotice(null);
    setActiveTab(tab);
  };

  // Ensure active tab stays consistent with active client status
  useEffect(() => {
    if (!activeClient) return;
    const lock = getTabLockInfo(activeTab);
    if (lock.locked) {
      if (activeTab === '2551Q' && isVat) {
        setActiveTab('2550Q');
      } else if (activeTab === '2550Q' && !isVat) {
        setActiveTab('2551Q');
      } else if (activeTab === '1701Q' && !isSingle) {
        setActiveTab('1702Q');
      } else if (activeTab === '1702Q' && isSingle) {
        setActiveTab('1701Q');
      } else if (activeTab === '1701Annual' && !isSingle) {
        setActiveTab('1702Annual');
      } else if (activeTab === '1702Annual' && isSingle) {
        setActiveTab('1701Annual');
      } else if ((activeTab === '1601C' || activeTab === '1601EQ') && !isWithholding) {
        setActiveTab('summary');
      }
    }
  }, [activeClientId, isVat, isSingle, isWithholding, activeTab]);

  // Factory functions for fresh, clean form data when entering a new quarter
  const createClean1701Q = (): Data1701Q => ({
    taxRegime: 'graduated',
    taxpayerType: 'pure_business',
    deductionMethod: 'osd',
    grossSalesCurrentQuarter: 0,
    nonOperatingIncome: 0,
    grossSalesPriorQuarters: 0,
    costOfSales: 0,
    operatingExpenses: 0,
    priorYearExcessCredits: 0,
    quarterlyTaxPaidPriorQuarters: 0,
    cwt2307Credits: 0,
    otherTaxCredits: 0,
  });

  const createClean1702Q = (): Data1702Q => ({
    rateOption: 'regular_25',
    isMCOptional: true,
    grossSales: 0,
    costOfSales: 0,
    operatingExpenses: 0,
    nonOperatingIncome: 0,
    priorYearExcessCredits: 0,
    priorQuarterTaxPaid: 0,
    cwt2307Credits: 0,
    otherTaxCredits: 0,
  });

  const createClean2550Q = (): Data2550Q => ({
    vatableSales: 0,
    salesToGovernment: 0,
    zeroRatedSales: 0,
    vatExemptSales: 0,
    inputPurchasesGoods: 0,
    inputPurchasesServices: 0,
    inputCapitalGoods: 0,
    inputImportations: 0,
    priorQuarterExcessInputVat: 0,
    withheldVat2307Govt: 0,
    withheldVat2307Private: 0,
    priorPaymentsThisQuarter: 0,
  });

  const createClean2551Q = (): Data2551Q => ({
    atcCode: 'PT010',
    taxRatePercent: 3,
    grossSalesCurrentQuarter: 0,
    exemptSales: 0,
    vatableSales: 0,
    salesToGovernment: 0,
    zeroRatedSales: 0,
    vatExemptSales: 0,
    cwt2307Credits: 0,
    priorQuarterTaxPaid: 0,
  });

  const createClean1601C = (): Data1601C => ({
    totalGrossCompensation: 0,
    minimumWageEarners: 0,
    statutoryContributions: 0,
    thirteenthMonthAndDeMinimis: 0,
    otherNonTaxableCompensation: 0,
    taxWithheldAdjustments: 0,
    taxRemittedPreviously: 0,
  });

  const createClean1601EQ = (): Data1601EQ => ({
    isMonthly: true,
    priorMonthTaxRemitted: 0,
    overpaymentPreviousPeriod: 0,
    lineItems: [
      {
        id: 'ewt-1',
        atc: 'WI157',
        description: 'Rent on Real Property (5%)',
        ratePercent: 5,
        taxBase: 0,
      },
    ],
  });

  const createClean1701Annual = (): Data1701Annual => ({
    taxRegime: 'graduated',
    taxpayerType: 'pure_business',
    deductionMethod: 'osd',
    grossSales: 0,
    costOfSales: 0,
    operatingExpenses: 0,
    nonOperatingIncome: 0,
    priorYearExcessCredits: 0,
    quarterlyTaxPaidQ1: 0,
    quarterlyTaxPaidQ2: 0,
    quarterlyTaxPaidQ3: 0,
    cwt2307Credits: 0,
    otherTaxCredits: 0,
    optForInstallment: false,
  });

  const createClean1702Annual = (): Data1702Annual => ({
    rateOption: 'regular_25',
    isMCOptional: true,
    grossSales: 0,
    salesReturnsDiscounts: 0,
    costOfSales: 0,
    nonOperatingIncome: 0,
    deductionMethod: 'osd',
    operatingExpenses: 0,
    priorYearExcessCredits: 0,
    quarterlyTaxPaidQ1: 0,
    quarterlyTaxPaidQ2: 0,
    quarterlyTaxPaidQ3: 0,
    cwt2307Credits: 0,
    excessMCITPriorYears: 0,
    otherTaxCredits: 0,
  });

  // Client data keys strictly per quarter and month so data in Q1 is cleared when moving to Q2
  const currentQuarterKey = activeClient ? `${activeClient.id}_${year}_${quarter}` : `default_${year}_${quarter}`;
  const currentMonthKey = activeClient ? `${activeClient.id}_${year}_M${month}` : `default_${year}_M${month}`;
  const currentAnnualKey = activeClient ? `${activeClient.id}_${year}` : `default_${year}`;

  // Raw forms for the selected quarter
  const raw2550Q = (activeClient && data2550QMap[currentQuarterKey]) || createClean2550Q();
  const raw2551Q = (activeClient && data2551QMap[currentQuarterKey]) || createClean2551Q();

  // Automatic Gross Sales synchronization:
  // Determine which form (2550Q or 2551Q) is not locked for the client:
  // VAT registered -> 2550Q is not locked (2551Q is locked)
  // Non-VAT -> 2551Q is not locked (2550Q is locked)
  const isVatRegistered = activeClient?.vatStatus === 'vat-registered';
  const unlockedSalesForm: '2550Q' | '2551Q' = isVatRegistered ? '2550Q' : '2551Q';

  const combinedSales2550Q =
    (Number(raw2550Q.vatableSales) || 0) +
    (Number(raw2550Q.salesToGovernment) || 0) +
    (Number(raw2550Q.zeroRatedSales) || 0) +
    (Number(raw2550Q.vatExemptSales) || 0);

  const hasBreakdown2551Q =
    raw2551Q.vatableSales !== undefined ||
    raw2551Q.salesToGovernment !== undefined ||
    raw2551Q.zeroRatedSales !== undefined ||
    raw2551Q.vatExemptSales !== undefined;

  const combinedSales2551Q = hasBreakdown2551Q
    ? (Number(raw2551Q.vatableSales) || 0) +
      (Number(raw2551Q.salesToGovernment) || 0) +
      (Number(raw2551Q.zeroRatedSales) || 0) +
      (Number(raw2551Q.vatExemptSales !== undefined ? raw2551Q.vatExemptSales : raw2551Q.exemptSales) || 0)
    : (Number(raw2551Q.grossSalesCurrentQuarter) || 0);

  const unlockedCombinedSales = isVatRegistered ? combinedSales2550Q : combinedSales2551Q;

  const salesSourceInfo = {
    formName: unlockedSalesForm,
    combinedSales: unlockedCombinedSales,
    isVat: isVatRegistered,
  };

  const raw1702Q = (activeClient && data1702QMap[currentQuarterKey]) || createClean1702Q();
  const raw1701Q = (activeClient && data1701QMap[currentQuarterKey]) || createClean1701Q();

  // In case of Corporation, Gross Sales in 1702Q automatically reflects Combined Sales in 2550Q or 2551Q (unlocked form)
  const current1702Q: Data1702Q = useMemo(() => {
    if (!activeClient) return raw1702Q;
    if (activeClient.classification === 'Corporation') {
      return {
        ...raw1702Q,
        grossSales: unlockedCombinedSales,
      };
    }
    return raw1702Q;
  }, [raw1702Q, activeClient?.classification, unlockedCombinedSales]);

  // Same for Single Proprietorship, Gross Sales in 1701Q automatically reflects Combined Sales in 2550Q or 2551Q (unlocked form)
  const current1701Q: Data1701Q = useMemo(() => {
    if (!activeClient) return raw1701Q;
    if (activeClient.classification === 'Single') {
      return {
        ...raw1701Q,
        grossSalesCurrentQuarter: unlockedCombinedSales,
      };
    }
    return raw1701Q;
  }, [raw1701Q, activeClient?.classification, unlockedCombinedSales]);

  const current2550Q = raw2550Q;
  const current2551Q = raw2551Q;
  const current1601C = (activeClient && data1601CMap[currentMonthKey]) || createClean1601C();

  // 1601EQ / 0619E Multi-Mode Period Data (Month 1, Month 2, Month 3, and Quarter Combined)
  const [ewtPeriodMode, setEwtPeriodMode] = useState<'m1' | 'm2' | 'm3' | 'quarter'>('quarter');

  const monthsForQuarter: Record<Quarter, [number, number, number]> = {
    Q1: [1, 2, 3],
    Q2: [4, 5, 6],
    Q3: [7, 8, 9],
    Q4: [10, 11, 12],
  };

  const quarterMonths = monthsForQuarter[quarter];
  const m1Num = quarterMonths[0];
  const m2Num = quarterMonths[1];
  const m3Num = quarterMonths[2];

  const m1Key = activeClient ? `${activeClient.id}_${year}_M${m1Num}` : `default_${year}_M${m1Num}`;
  const m2Key = activeClient ? `${activeClient.id}_${year}_M${m2Num}` : `default_${year}_M${m2Num}`;
  const m3Key = activeClient ? `${activeClient.id}_${year}_M${m3Num}` : `default_${year}_M${m3Num}`;

  const month1Data = (activeClient && data1601EQMap[m1Key]) || { ...createClean1601EQ(), isMonthly: true };
  const month2Data = (activeClient && data1601EQMap[m2Key]) || { ...createClean1601EQ(), isMonthly: true };
  const month3Data = (activeClient && data1601EQMap[m3Key]) || { ...createClean1601EQ(), isMonthly: true };
  const quarterCombinedData = (activeClient && data1601EQMap[currentQuarterKey]) || { ...createClean1601EQ(), isMonthly: false };

  const current1601EQ =
    ewtPeriodMode === 'm1'
      ? month1Data
      : ewtPeriodMode === 'm2'
      ? month2Data
      : ewtPeriodMode === 'm3'
      ? month3Data
      : quarterCombinedData;

  const handleUpdate1601EQ = (updated: Data1601EQ) => {
    const targetKey =
      ewtPeriodMode === 'm1'
        ? m1Key
        : ewtPeriodMode === 'm2'
        ? m2Key
        : ewtPeriodMode === 'm3'
        ? m3Key
        : currentQuarterKey;

    setData1601EQMap((prev) => ({
      ...prev,
      [targetKey]: updated,
    }));
  };

  const handleConsolidateMonths = () => {
    if (!activeClient) return;
    const allLines: typeof month1Data.lineItems = [];
    const pushLines = (items: typeof month1Data.lineItems, monthLabel: string) => {
      (items || []).forEach((item) => {
        if (item.taxBase > 0) {
          allLines.push({
            ...item,
            id: `ewt-c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            description: `${item.description} (${monthLabel})`,
          });
        }
      });
    };
    pushLines(month1Data.lineItems || [], `Month ${m1Num}`);
    pushLines(month2Data.lineItems || [], `Month ${m2Num}`);
    pushLines(month3Data.lineItems || [], `Month ${m3Num}`);

    const m1Withheld = (month1Data.lineItems || []).reduce((sum, i) => sum + i.taxBase * (i.ratePercent / 100), 0);
    const m2Withheld = (month2Data.lineItems || []).reduce((sum, i) => sum + i.taxBase * (i.ratePercent / 100), 0);

    const consolidatedQuarter: Data1601EQ = {
      ...quarterCombinedData,
      isMonthly: false,
      lineItems: allLines.length > 0 ? allLines : quarterCombinedData.lineItems,
      priorMonthTaxRemitted: m1Withheld + m2Withheld,
    };

    setData1601EQMap((prev) => ({
      ...prev,
      [currentQuarterKey]: consolidatedQuarter,
    }));
    setEwtPeriodMode('quarter');
  };

  // Annual ITR (1701 for Single vs 1702-RT for Corporation)
  const raw1701Annual = (activeClient && data1701AnnualMap[currentAnnualKey]) || createClean1701Annual();
  const raw1702Annual = (activeClient && data1702AnnualMap[currentAnnualKey]) || createClean1702Annual();

  // Summary of Q1-Q4 for 1701
  const quarters1701Summary = useMemo(() => {
    if (!activeClient) {
      return {
        q1Sales: 0,
        q2Sales: 0,
        q3Sales: 0,
        q4Sales: 0,
        q1TaxPaid: 0,
        q2TaxPaid: 0,
        q3TaxPaid: 0,
        totalCwt: 0,
        sourceForm: unlockedSalesForm,
        totalSales: 0,
      };
    }

    // Helper to get combined sales for a quarter from the unlocked sales form (2550Q for VAT, 2551Q for Non-VAT)
    const getQuarterlySalesFromUnlockedForm = (q: Quarter): number => {
      const qKey = `${activeClient.id}_${year}_${q}`;
      if (isVatRegistered) {
        // 2550Q is NOT locked
        const data2550 = (q === quarter ? raw2550Q : data2550QMap[qKey]) || {
          vatableSales: 0,
          salesToGovernment: 0,
          zeroRatedSales: 0,
          vatExemptSales: 0,
        };
        return (
          (Number(data2550.vatableSales) || 0) +
          (Number(data2550.salesToGovernment) || 0) +
          (Number(data2550.zeroRatedSales) || 0) +
          (Number(data2550.vatExemptSales) || 0)
        );
      } else {
        // 2551Q is NOT locked
        const data2551 = (q === quarter ? raw2551Q : data2551QMap[qKey]) || {
          grossSalesCurrentQuarter: 0,
          exemptSales: 0,
        };
        const hasBreakdown =
          data2551.vatableSales !== undefined ||
          data2551.salesToGovernment !== undefined ||
          data2551.zeroRatedSales !== undefined ||
          data2551.vatExemptSales !== undefined;

        if (hasBreakdown) {
          return (
            (Number(data2551.vatableSales) || 0) +
            (Number(data2551.salesToGovernment) || 0) +
            (Number(data2551.zeroRatedSales) || 0) +
            (Number(
              data2551.vatExemptSales !== undefined
                ? data2551.vatExemptSales
                : data2551.exemptSales
            ) || 0)
          );
        }
        return Number(data2551.grossSalesCurrentQuarter) || 0;
      }
    };

    const q1SalesVal = getQuarterlySalesFromUnlockedForm('Q1');
    const q2SalesVal = getQuarterlySalesFromUnlockedForm('Q2');
    const q3SalesVal = getQuarterlySalesFromUnlockedForm('Q3');
    const q4SalesVal = getQuarterlySalesFromUnlockedForm('Q4');
    const totalSalesVal = q1SalesVal + q2SalesVal + q3SalesVal + q4SalesVal;

    const getQ = (q: Quarter) => (q === quarter ? raw1701Q : data1701QMap[`${activeClient.id}_${year}_${q}`]);
    const q1 = getQ('Q1');
    const q2 = getQ('Q2');
    const q3 = getQ('Q3');
    const q4 = getQ('Q4');

    const calc1701QPaid = (qData?: Data1701Q): number => {
      if (!qData) return 0;
      const res = calculate1701Q(qData);
      return res.netTaxPayable > 0 ? Math.round(res.netTaxPayable) : 0;
    };

    return {
      q1Sales: q1SalesVal,
      q2Sales: q2SalesVal,
      q3Sales: q3SalesVal,
      q4Sales: q4SalesVal,
      totalSales: totalSalesVal,
      sourceForm: unlockedSalesForm,
      q1TaxPaid: calc1701QPaid(q1),
      q2TaxPaid: calc1701QPaid(q2),
      q3TaxPaid: calc1701QPaid(q3),
      totalCwt:
        (Number(q1?.cwt2307Credits) || 0) +
        (Number(q2?.cwt2307Credits) || 0) +
        (Number(q3?.cwt2307Credits) || 0) +
        (Number(q4?.cwt2307Credits) || 0),
    };
  }, [
    activeClient,
    year,
    data1701QMap,
    quarter,
    raw1701Q,
    isVatRegistered,
    raw2550Q,
    data2550QMap,
    raw2551Q,
    data2551QMap,
    unlockedSalesForm,
  ]);

  // Summary of Q1-Q4 for 1702
  const quarters1702Summary = useMemo(() => {
    if (!activeClient) {
      return {
        q1Sales: 0,
        q2Sales: 0,
        q3Sales: 0,
        q4Sales: 0,
        q1TaxPaid: 0,
        q2TaxPaid: 0,
        q3TaxPaid: 0,
        totalCwt: 0,
        sourceForm: unlockedSalesForm,
        totalSales: 0,
      };
    }

    // Helper to get combined sales for a quarter from the unlocked sales form (2550Q for VAT, 2551Q for Non-VAT)
    const getQuarterlySalesFromUnlockedForm = (q: Quarter): number => {
      const qKey = `${activeClient.id}_${year}_${q}`;
      if (isVatRegistered) {
        // 2550Q is NOT locked
        const data2550 = (q === quarter ? raw2550Q : data2550QMap[qKey]) || {
          vatableSales: 0,
          salesToGovernment: 0,
          zeroRatedSales: 0,
          vatExemptSales: 0,
        };
        return (
          (Number(data2550.vatableSales) || 0) +
          (Number(data2550.salesToGovernment) || 0) +
          (Number(data2550.zeroRatedSales) || 0) +
          (Number(data2550.vatExemptSales) || 0)
        );
      } else {
        // 2551Q is NOT locked
        const data2551 = (q === quarter ? raw2551Q : data2551QMap[qKey]) || {
          grossSalesCurrentQuarter: 0,
          exemptSales: 0,
        };
        const hasBreakdown =
          data2551.vatableSales !== undefined ||
          data2551.salesToGovernment !== undefined ||
          data2551.zeroRatedSales !== undefined ||
          data2551.vatExemptSales !== undefined;

        if (hasBreakdown) {
          return (
            (Number(data2551.vatableSales) || 0) +
            (Number(data2551.salesToGovernment) || 0) +
            (Number(data2551.zeroRatedSales) || 0) +
            (Number(
              data2551.vatExemptSales !== undefined
                ? data2551.vatExemptSales
                : data2551.exemptSales
            ) || 0)
          );
        }
        return Number(data2551.grossSalesCurrentQuarter) || 0;
      }
    };

    const q1SalesVal = getQuarterlySalesFromUnlockedForm('Q1');
    const q2SalesVal = getQuarterlySalesFromUnlockedForm('Q2');
    const q3SalesVal = getQuarterlySalesFromUnlockedForm('Q3');
    const q4SalesVal = getQuarterlySalesFromUnlockedForm('Q4');
    const totalSalesVal = q1SalesVal + q2SalesVal + q3SalesVal + q4SalesVal;

    const getQ = (q: Quarter) => (q === quarter ? raw1702Q : data1702QMap[`${activeClient.id}_${year}_${q}`]);
    const q1 = getQ('Q1');
    const q2 = getQ('Q2');
    const q3 = getQ('Q3');
    const q4 = getQ('Q4');

    const calc1702QPaid = (qData?: Data1702Q): number => {
      if (!qData) return 0;
      const res = calculate1702Q(qData);
      return res.netTaxPayable > 0 ? Math.round(res.netTaxPayable) : 0;
    };

    return {
      q1Sales: q1SalesVal,
      q2Sales: q2SalesVal,
      q3Sales: q3SalesVal,
      q4Sales: q4SalesVal,
      totalSales: totalSalesVal,
      sourceForm: unlockedSalesForm,
      q1TaxPaid: calc1702QPaid(q1),
      q2TaxPaid: calc1702QPaid(q2),
      q3TaxPaid: calc1702QPaid(q3),
      totalCwt:
        (Number(q1?.cwt2307Credits) || 0) +
        (Number(q2?.cwt2307Credits) || 0) +
        (Number(q3?.cwt2307Credits) || 0) +
        (Number(q4?.cwt2307Credits) || 0),
    };
  }, [
    activeClient,
    year,
    data1702QMap,
    quarter,
    raw1702Q,
    isVatRegistered,
    raw2550Q,
    data2550QMap,
    raw2551Q,
    data2551QMap,
    unlockedSalesForm,
  ]);

  const handleAutoPull1701Quarters = () => {
    // Consolidate Combined Sales from unlocked form (2550Q or 2551Q) across Q1-Q4 as Gross Sales in 1701
    const totalSales =
      quarters1701Summary.q1Sales +
      quarters1701Summary.q2Sales +
      quarters1701Summary.q3Sales +
      quarters1701Summary.q4Sales;

    setData1701AnnualMap((prev) => ({
      ...prev,
      [currentAnnualKey]: {
        ...raw1701Annual,
        grossSales: totalSales,
        quarterlyTaxPaidQ1: quarters1701Summary.q1TaxPaid,
        quarterlyTaxPaidQ2: quarters1701Summary.q2TaxPaid,
        quarterlyTaxPaidQ3: quarters1701Summary.q3TaxPaid,
        cwt2307Credits: quarters1701Summary.totalCwt,
      },
    }));
  };

  const handleAutoPull1702Quarters = () => {
    // Consolidate Combined Sales from unlocked form (2550Q or 2551Q) across Q1-Q4 as Gross Sales in 1702
    const totalSales =
      quarters1702Summary.q1Sales +
      quarters1702Summary.q2Sales +
      quarters1702Summary.q3Sales +
      quarters1702Summary.q4Sales;

    setData1702AnnualMap((prev) => ({
      ...prev,
      [currentAnnualKey]: {
        ...raw1702Annual,
        grossSales: totalSales,
        quarterlyTaxPaidQ1: quarters1702Summary.q1TaxPaid,
        quarterlyTaxPaidQ2: quarters1702Summary.q2TaxPaid,
        quarterlyTaxPaidQ3: quarters1702Summary.q3TaxPaid,
        cwt2307Credits: quarters1702Summary.totalCwt,
      },
    }));
  };

  // Multi-year data for comparative financial statements & trends
  const allYears1702Data: Record<number, Data1702Annual> = useMemo(() => {
    if (!activeClient) return {};
    const map: Record<number, Data1702Annual> = {};
    Object.keys(data1702AnnualMap).forEach((key) => {
      if (key.startsWith(`${activeClient.id}_`)) {
        const yearStr = key.replace(`${activeClient.id}_`, '');
        const y = parseInt(yearStr, 10);
        if (!isNaN(y) && data1702AnnualMap[key]) {
          map[y] = data1702AnnualMap[key];
        }
      }
    });
    // Include current year data
    map[year] = raw1702Annual;

    // Provide realistic historical benchmarks if not explicitly created yet
    const curSales = raw1702Annual.grossSales || 18500000;
    const curCost = raw1702Annual.costOfSales || curSales * 0.58;
    const curExp = raw1702Annual.operatingExpenses || curSales * 0.22;

    if (!map[year - 1]) {
      map[year - 1] = {
        rateOption: raw1702Annual.rateOption || 'regular_25',
        isMCOptional: false,
        grossSales: Math.round(curSales * 0.88),
        salesReturnsDiscounts: 0,
        costOfSales: Math.round(curCost * 0.90),
        nonOperatingIncome: 50000,
        deductionMethod: 'itemized',
        operatingExpenses: Math.round(curExp * 0.92),
        priorYearExcessCredits: 0,
        quarterlyTaxPaidQ1: 0,
        quarterlyTaxPaidQ2: 0,
        quarterlyTaxPaidQ3: 0,
        cwt2307Credits: 0,
        excessMCITPriorYears: 0,
        otherTaxCredits: 0,
      };
    }
    if (!map[year - 2]) {
      const py1Sales = map[year - 1]?.grossSales || curSales * 0.88;
      map[year - 2] = {
        rateOption: 'regular_25',
        isMCOptional: false,
        grossSales: Math.round(py1Sales * 0.85),
        salesReturnsDiscounts: 0,
        costOfSales: Math.round(curCost * 0.80),
        nonOperatingIncome: 35000,
        deductionMethod: 'itemized',
        operatingExpenses: Math.round(curExp * 0.84),
        priorYearExcessCredits: 0,
        quarterlyTaxPaidQ1: 0,
        quarterlyTaxPaidQ2: 0,
        quarterlyTaxPaidQ3: 0,
        cwt2307Credits: 0,
        excessMCITPriorYears: 0,
        otherTaxCredits: 0,
      };
    }
    if (!map[year - 3]) {
      const py2Sales = map[year - 2]?.grossSales || curSales * 0.75;
      map[year - 3] = {
        rateOption: 'regular_25',
        isMCOptional: false,
        grossSales: Math.round(py2Sales * 0.86),
        salesReturnsDiscounts: 0,
        costOfSales: Math.round(curCost * 0.70),
        nonOperatingIncome: 25000,
        deductionMethod: 'itemized',
        operatingExpenses: Math.round(curExp * 0.78),
        priorYearExcessCredits: 0,
        quarterlyTaxPaidQ1: 0,
        quarterlyTaxPaidQ2: 0,
        quarterlyTaxPaidQ3: 0,
        cwt2307Credits: 0,
        excessMCITPriorYears: 0,
        otherTaxCredits: 0,
      };
    }
    return map;
  }, [data1702AnnualMap, activeClient, year, raw1702Annual]);

  const handleUpdateHistorical1702Year = (histYear: number, updatedData: Data1702Annual) => {
    if (!activeClient) return;
    setData1702AnnualMap((prev) => ({
      ...prev,
      [`${activeClient.id}_${histYear}`]: updatedData,
    }));
  };

  // Multi-Year Historical Data for Form 1701 (Individual Annual Return)
  const allYears1701Data = useMemo(() => {
    const map: Record<number, Data1701Annual> = {};
    if (!activeClient) return map;

    // Load any saved year statements
    [year - 3, year - 2, year - 1, year].forEach((y) => {
      const k = `${activeClient.id}_${y}`;
      if (data1701AnnualMap[k]) {
        map[y] = data1701AnnualMap[k];
      }
    });

    map[year] = raw1701Annual;

    const curSales = raw1701Annual.grossSales || 1800000;
    const curCost = raw1701Annual.costOfSales || curSales * 0.40;
    const curExp = raw1701Annual.operatingExpenses || curSales * 0.25;

    if (!map[year - 1]) {
      map[year - 1] = {
        taxRegime: raw1701Annual.taxRegime || 'graduated',
        taxpayerType: 'pure_business',
        deductionMethod: raw1701Annual.deductionMethod || 'osd',
        grossSales: Math.round(curSales * 0.88),
        salesReturnsDiscounts: 0,
        costOfSales: Math.round(curCost * 0.90),
        nonOperatingIncome: 30000,
        operatingExpenses: Math.round(curExp * 0.92),
        priorYearExcessCredits: 0,
        quarterlyTaxPaidQ1: 0,
        quarterlyTaxPaidQ2: 0,
        quarterlyTaxPaidQ3: 0,
        cwt2307Credits: 0,
        otherTaxCredits: 0,
        optForInstallment: false,
      };
    }
    if (!map[year - 2]) {
      const py1Sales = map[year - 1]?.grossSales || curSales * 0.88;
      map[year - 2] = {
        taxRegime: 'graduated',
        taxpayerType: 'pure_business',
        deductionMethod: 'osd',
        grossSales: Math.round(py1Sales * 0.85),
        salesReturnsDiscounts: 0,
        costOfSales: Math.round(curCost * 0.80),
        nonOperatingIncome: 20000,
        operatingExpenses: Math.round(curExp * 0.84),
        priorYearExcessCredits: 0,
        quarterlyTaxPaidQ1: 0,
        quarterlyTaxPaidQ2: 0,
        quarterlyTaxPaidQ3: 0,
        cwt2307Credits: 0,
        otherTaxCredits: 0,
        optForInstallment: false,
      };
    }
    if (!map[year - 3]) {
      const py2Sales = map[year - 2]?.grossSales || curSales * 0.75;
      map[year - 3] = {
        taxRegime: 'graduated',
        taxpayerType: 'pure_business',
        deductionMethod: 'osd',
        grossSales: Math.round(py2Sales * 0.86),
        salesReturnsDiscounts: 0,
        costOfSales: Math.round(curCost * 0.70),
        nonOperatingIncome: 15000,
        operatingExpenses: Math.round(curExp * 0.78),
        priorYearExcessCredits: 0,
        quarterlyTaxPaidQ1: 0,
        quarterlyTaxPaidQ2: 0,
        quarterlyTaxPaidQ3: 0,
        cwt2307Credits: 0,
        otherTaxCredits: 0,
        optForInstallment: false,
      };
    }
    return map;
  }, [data1701AnnualMap, activeClient, year, raw1701Annual]);

  const handleUpdateHistorical1701Year = (histYear: number, updatedData: Data1701Annual) => {
    if (!activeClient) return;
    setData1701AnnualMap((prev) => ({
      ...prev,
      [`${activeClient.id}_${histYear}`]: updatedData,
    }));
  };

  // 1601-C Yearly Data across all 12 months for Cumulative calculation
  const yearly1601CData = useMemo(() => {
    const map: Record<number, Data1601C> = {};
    if (!activeClient) return map;
    for (let m = 1; m <= 12; m++) {
      const k = `${activeClient.id}_${year}_M${m}`;
      if (data1601CMap[k]) {
        map[m] = data1601CMap[k];
      }
    }
    if (current1601C) {
      map[month] = current1601C;
    }
    return map;
  }, [data1601CMap, activeClient, year, month, current1601C]);

  // 1601-EQ & 0619-E Yearly Data across all months and quarters for Cumulative calculation
  const yearly1601EQData = useMemo(() => {
    const map: Record<string, Data1601EQ> = {};
    if (!activeClient) return map;
    for (let m = 1; m <= 12; m++) {
      const mk = `${activeClient.id}_${year}_M${m}`;
      if (data1601EQMap[mk]) map[`M${m}`] = data1601EQMap[mk];
    }
    (['Q1', 'Q2', 'Q3', 'Q4'] as Quarter[]).forEach((q) => {
      const qk = `${activeClient.id}_${year}_${q}`;
      if (data1601EQMap[qk]) map[q] = data1601EQMap[qk];
    });
    return map;
  }, [data1601EQMap, activeClient, year]);

  // Client actions
  const handleSaveClient = (saved: ClientProfile) => {
    if (clients.some((c) => c.id === saved.id)) {
      setClients(clients.map((c) => (c.id === saved.id ? saved : c)));
    } else {
      setClients([...clients, saved]);
      setActiveClientId(saved.id);
    }

    const cIsSingle = saved.classification === 'Single';
    const cIsVat = saved.vatStatus === 'vat-registered';
    const cIsWithholding = saved.isWithholdingAgent;

    if (activeTab === '1701Q' && !cIsSingle) setActiveTab('1702Q');
    else if (activeTab === '1702Q' && cIsSingle) setActiveTab('1701Q');
    else if (activeTab === '1701Annual' && !cIsSingle) setActiveTab('1702Annual');
    else if (activeTab === '1702Annual' && cIsSingle) setActiveTab('1701Annual');
    else if (activeTab === '2550Q' && !cIsVat) setActiveTab('2551Q');
    else if (activeTab === '2551Q' && cIsVat) setActiveTab('2550Q');
    else if ((activeTab === '1601C' || activeTab === '1601EQ') && !cIsWithholding) setActiveTab('summary');
  };

  const handleOpenAddClient = () => {
    setClientToEdit(null);
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = () => {
    if (!activeClient) return;
    setClientToEdit(activeClient);
    setIsClientModalOpen(true);
  };

  const handleDeleteClient = (clientIdToDelete?: string) => {
    const idToDelete = clientIdToDelete || activeClientId;
    if (!idToDelete) return;
    const target = clients.find((c) => c.id === idToDelete) || activeClient;
    if (target) {
      setClientToDelete(target);
    }
  };

  const handleConfirmDeleteClient = () => {
    if (!clientToDelete) return;
    const idToDelete = clientToDelete.id;
    const remainingClients = clients.filter((c) => c.id !== idToDelete);
    setClients(remainingClients);

    // Clean up filings
    const next1701Q = { ...data1701QMap };
    delete next1701Q[idToDelete];
    setData1701QMap(next1701Q);

    const next1702Q = { ...data1702QMap };
    delete next1702Q[idToDelete];
    setData1702QMap(next1702Q);

    const next2550Q = { ...data2550QMap };
    delete next2550Q[idToDelete];
    setData2550QMap(next2550Q);

    const next2551Q = { ...data2551QMap };
    delete next2551Q[idToDelete];
    setData2551QMap(next2551Q);

    const next1601C = { ...data1601CMap };
    delete next1601C[idToDelete];
    setData1601CMap(next1601C);

    const next1601EQ = { ...data1601EQMap };
    delete next1601EQ[idToDelete];
    setData1601EQMap(next1601EQ);

    const next1701Annual = { ...data1701AnnualMap };
    Object.keys(next1701Annual).forEach((k) => {
      if (k.startsWith(`${idToDelete}_`)) delete next1701Annual[k];
    });
    setData1701AnnualMap(next1701Annual);

    const next1702Annual = { ...data1702AnnualMap };
    Object.keys(next1702Annual).forEach((k) => {
      if (k.startsWith(`${idToDelete}_`)) delete next1702Annual[k];
    });
    setData1702AnnualMap(next1702Annual);

    if (activeClientId === idToDelete) {
      setActiveClientId(remainingClients[0]?.id || '');
    }
    setClientToDelete(null);
  };

  const handleResetData = () => {
    if (window.confirm('Reset all client calculations and restore a clean slate?')) {
      setClients([]);
      setActiveClientId('');
      setData1701QMap({});
      setData1702QMap({});
      setData2550QMap({});
      setData2551QMap({});
      setData1601CMap({});
      setData1601EQMap({});
      setData1701AnnualMap({});
      setData1702AnnualMap({});
      localStorage.clear();
    }
  };

  const handleExportData = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      clients,
      data1701QMap,
      data1702QMap,
      data2550QMap,
      data2551QMap,
      data1601CMap,
      data1601EQMap,
      data1701AnnualMap,
      data1702AnnualMap,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BIR_Tax_Portfolio_${year}_${quarter}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.clients) {
          setClients(parsed.clients);
          if (parsed.clients[0]) setActiveClientId(parsed.clients[0].id);
        }
        if (parsed.data1701QMap) setData1701QMap(parsed.data1701QMap);
        if (parsed.data1702QMap) setData1702QMap(parsed.data1702QMap);
        if (parsed.data2550QMap) setData2550QMap(parsed.data2550QMap);
        if (parsed.data2551QMap) setData2551QMap(parsed.data2551QMap);
        if (parsed.data1601CMap) setData1601CMap(parsed.data1601CMap);
        if (parsed.data1601EQMap) setData1601EQMap(parsed.data1601EQMap);
        if (parsed.data1701AnnualMap) setData1701AnnualMap(parsed.data1701AnnualMap);
        if (parsed.data1702AnnualMap) setData1702AnnualMap(parsed.data1702AnnualMap);
        alert('Tax portfolio imported successfully!');
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Sticky Client & Period Header */}
      <ClientHeader
        clients={clients}
        activeClient={activeClient}
        onSelectClient={(c) => {
          setActiveClientId(c.id);
          // If current tab is not applicable to the newly selected client, route intelligently
          const cIsSingle = c.classification === 'Single';
          const cIsVat = c.vatStatus === 'vat-registered';
          const cIsWithholding = c.isWithholdingAgent;

          if (activeTab === '1701Q' && !cIsSingle) setActiveTab('1702Q');
          else if (activeTab === '1702Q' && cIsSingle) setActiveTab('1701Q');
          else if (activeTab === '1701Annual' && !cIsSingle) setActiveTab('1702Annual');
          else if (activeTab === '1702Annual' && cIsSingle) setActiveTab('1701Annual');
          else if (activeTab === '2550Q' && !cIsVat) setActiveTab('2551Q');
          else if (activeTab === '2551Q' && cIsVat) setActiveTab('2550Q');
          else if ((activeTab === '1601C' || activeTab === '1601EQ') && !cIsWithholding) setActiveTab('summary');
        }}
        onOpenAddClient={handleOpenAddClient}
        onOpenEditClient={handleOpenEditClient}
        onDeleteClient={() => handleDeleteClient(activeClientId)}
        quarter={quarter}
        onSelectQuarter={(q) => {
          setQuarter(q);
          const quarterMonthMap: Record<Quarter, number[]> = {
            Q1: [1, 2, 3],
            Q2: [4, 5, 6],
            Q3: [7, 8, 9],
            Q4: [10, 11, 12],
          };
          if (!quarterMonthMap[q].includes(month)) {
            setMonth(quarterMonthMap[q][0]);
          }
        }}
        month={month}
        onSelectMonth={(m) => {
          setMonth(m);
          if (m >= 1 && m <= 3) setQuarter('Q1');
          else if (m >= 4 && m <= 6) setQuarter('Q2');
          else if (m >= 7 && m <= 9) setQuarter('Q3');
          else setQuarter('Q4');
        }}
        year={year}
        onSelectYear={setYear}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onOpenCalendar={() => setActiveTab('calendar')}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Navigation Tabs for Different BIR Forms */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 print:hidden">
          {/* Summary Tab */}
          <button
            id="tab-summary-btn"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'summary'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Filing Schedule & Summary</span>
          </button>

          {/* Tax Deadline Calendar Tab */}
          <button
            id="tab-calendar-btn"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'calendar'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-indigo-300" />
            <span>Tax Deadline Calendar</span>
          </button>

          {/* Form 1701Q (Individual) */}
          {(() => {
            const lock = getTabLockInfo('1701Q');
            return (
              <button
                id="tab-1701q-btn"
                onClick={() => handleSelectTab('1701Q')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lock.locked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : activeTab === '1701Q'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
                title={lock.locked ? lock.reason : 'Open BIR Form 1701Q'}
              >
                {lock.locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Calculator className="w-3.5 h-3.5" />}
                <span>1701Q</span>
                {lock.locked ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded font-mono font-medium">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-normal opacity-80 hidden sm:inline">(Individual)</span>
                )}
              </button>
            );
          })()}

          {/* Form 1702Q (Corporate) */}
          {(() => {
            const lock = getTabLockInfo('1702Q');
            return (
              <button
                id="tab-1702q-btn"
                onClick={() => handleSelectTab('1702Q')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lock.locked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : activeTab === '1702Q'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
                title={lock.locked ? lock.reason : 'Open BIR Form 1702Q'}
              >
                {lock.locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Building className="w-3.5 h-3.5" />}
                <span>1702Q</span>
                {lock.locked ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded font-mono font-medium">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-normal opacity-80 hidden sm:inline">(Corporate)</span>
                )}
              </button>
            );
          })()}

          {/* Form 2550Q (VAT) */}
          {(() => {
            const lock = getTabLockInfo('2550Q');
            return (
              <button
                id="tab-2550q-btn"
                onClick={() => handleSelectTab('2550Q')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lock.locked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : activeTab === '2550Q'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
                title={lock.locked ? lock.reason : 'Open BIR Form 2550Q'}
              >
                {lock.locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Receipt className="w-3.5 h-3.5" />}
                <span>2550Q</span>
                {lock.locked ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded font-mono font-medium">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-normal opacity-80 hidden sm:inline">(VAT 12%)</span>
                )}
              </button>
            );
          })()}

          {/* Form 2551Q (Percentage Tax) */}
          {(() => {
            const lock = getTabLockInfo('2551Q');
            return (
              <button
                id="tab-2551q-btn"
                onClick={() => handleSelectTab('2551Q')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lock.locked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : activeTab === '2551Q'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
                title={lock.locked ? lock.reason : 'Open BIR Form 2551Q'}
              >
                {lock.locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Percent className="w-3.5 h-3.5" />}
                <span>2551Q</span>
                {lock.locked ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded font-mono font-medium">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-normal opacity-80 hidden sm:inline">(Non-VAT 3%)</span>
                )}
              </button>
            );
          })()}

          {/* Form 1601-C (Compensation Withholding) */}
          {(() => {
            const lock = getTabLockInfo('1601C');
            return (
              <button
                id="tab-1601c-btn"
                onClick={() => handleSelectTab('1601C')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lock.locked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : activeTab === '1601C'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
                title={lock.locked ? lock.reason : 'Open BIR Form 1601-C'}
              >
                {lock.locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Users className="w-3.5 h-3.5" />}
                <span>1601-C</span>
                {lock.locked ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded font-mono font-medium">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-normal opacity-80 hidden sm:inline">(Payroll WTax)</span>
                )}
              </button>
            );
          })()}

          {/* Form 0619-E / 1601-EQ (Expanded Withholding) */}
          {(() => {
            const lock = getTabLockInfo('1601EQ');
            return (
              <button
                id="tab-1601eq-btn"
                onClick={() => handleSelectTab('1601EQ')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lock.locked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : activeTab === '1601EQ'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
                title={lock.locked ? lock.reason : 'Open BIR Form 0619-E / 1601-EQ'}
              >
                {lock.locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Layers className="w-3.5 h-3.5" />}
                <span>0619-E / 1601-EQ</span>
                {lock.locked ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded font-mono font-medium">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-normal opacity-80 hidden sm:inline">(EWT)</span>
                )}
              </button>
            );
          })()}

          {/* Form 1701 (Annual Income Tax Return for Individuals / Single Proprietorship) */}
          {(() => {
            const lock = getTabLockInfo('1701Annual');
            return (
              <button
                id="tab-1701annual-btn"
                onClick={() => handleSelectTab('1701Annual')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lock.locked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : activeTab === '1701Annual'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
                title={lock.locked ? lock.reason : 'Open BIR Form 1701 (Annual ITR for Single / Individuals)'}
              >
                {lock.locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <FileCheck className="w-3.5 h-3.5 text-blue-500" />}
                <span>1701 (Annual)</span>
                {lock.locked ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded font-mono font-medium">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-normal opacity-80 hidden sm:inline">(Single/Indiv)</span>
                )}
              </button>
            );
          })()}

          {/* Form 1702-RT (Annual Income Tax Return for Corporations and Partnerships) */}
          {(() => {
            const lock = getTabLockInfo('1702Annual');
            return (
              <button
                id="tab-1702annual-btn"
                onClick={() => handleSelectTab('1702Annual')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  lock.locked
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                    : activeTab === '1702Annual'
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
                title={lock.locked ? lock.reason : 'Open BIR Form 1702-RT (Annual ITR for Corporations)'}
              >
                {lock.locked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <FileCheck className="w-3.5 h-3.5 text-indigo-500" />}
                <span>1702-RT (Annual)</span>
                {lock.locked ? (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded font-mono font-medium">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] font-normal opacity-80 hidden sm:inline">(Corporate)</span>
                )}
              </button>
            );
          })()}
        </div>

        {/* Locked Tab Notification Alert */}
        {lockedTabNotice && (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium">{lockedTabNotice}</span>
            </div>
            <button
              onClick={() => setLockedTabNotice(null)}
              className="text-amber-700 hover:text-amber-950 font-bold px-2 py-0.5 rounded hover:bg-amber-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab View Contents */}
        {!activeClient && activeTab !== 'calendar' ? (
          <div className="flex items-center justify-center py-24">
            <button
              id="clean-slate-add-client-btn"
              onClick={handleOpenAddClient}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Add First Client</span>
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'summary' && activeClient && (
              <FilingSummaryView
                client={activeClient}
                quarter={quarter}
                month={month}
                year={year}
                data1701Q={current1701Q}
                data1702Q={current1702Q}
                data2550Q={current2550Q}
                data2551Q={current2551Q}
                data1601C={current1601C}
                data1601EQ={current1601EQ}
                data1701Annual={raw1701Annual}
                data1702Annual={raw1702Annual}
                onOpenCalendar={() => setActiveTab('calendar')}
                onNavigateToTab={(tab) => handleSelectTab(tab)}
                submittedStatusMap={submittedReturns}
                onToggleSubmission={handleToggleSubmission}
              />
            )}

            {activeTab === 'calendar' && (
              <TaxDeadlineCalendar
                activeClient={activeClient}
                selectedYear={year}
                selectedMonth={month}
                onSelectYear={setYear}
                onSelectMonth={setMonth}
                onNavigateToForm={(tab) => handleSelectTab(tab)}
              />
            )}

            {activeTab === '1701Q' && activeClient && (
              <Form1701QView
                client={activeClient}
                quarter={quarter}
                year={year}
                data={current1701Q}
                salesSourceInfo={salesSourceInfo}
                onChange={(updated) =>
                  setData1701QMap((prev) => ({
                    ...prev,
                    [currentQuarterKey]: updated,
                  }))
                }
              />
            )}

            {activeTab === '1702Q' && activeClient && (
              <Form1702QView
                client={activeClient}
                quarter={quarter}
                year={year}
                data={current1702Q}
                salesSourceInfo={salesSourceInfo}
                onChange={(updated) =>
                  setData1702QMap((prev) => ({
                    ...prev,
                    [currentQuarterKey]: updated,
                  }))
                }
              />
            )}

            {activeTab === '2550Q' && activeClient && (
              <Form2550QView
                client={activeClient}
                quarter={quarter}
                year={year}
                data={current2550Q}
                onChange={(updated) =>
                  setData2550QMap((prev) => ({
                    ...prev,
                    [currentQuarterKey]: updated,
                  }))
                }
              />
            )}

            {activeTab === '2551Q' && activeClient && (
              <Form2551QView
                client={activeClient}
                quarter={quarter}
                year={year}
                data={current2551Q}
                onChange={(updated) =>
                  setData2551QMap((prev) => ({
                    ...prev,
                    [currentQuarterKey]: updated,
                  }))
                }
              />
            )}

            {activeTab === '1601C' && activeClient && (
              <Form1601CView
                client={activeClient}
                month={month}
                year={year}
                data={current1601C}
                onSelectMonth={setMonth}
                yearlyData={yearly1601CData}
                onChange={(updated) =>
                  setData1601CMap((prev) => ({
                    ...prev,
                    [currentMonthKey]: updated,
                  }))
                }
              />
            )}

            {activeTab === '1601EQ' && activeClient && (
              <Form1601EQView
                client={activeClient}
                periodLabel={
                  ewtPeriodMode === 'quarter'
                    ? `${quarter} ${year} (Quarterly 1601-EQ)`
                    : `Month ${ewtPeriodMode === 'm1' ? m1Num : ewtPeriodMode === 'm2' ? m2Num : m3Num}, ${year} (Monthly 0619-E)`
                }
                data={current1601EQ}
                quarter={quarter}
                month={month}
                year={year}
                activePeriodMode={ewtPeriodMode}
                onSelectPeriodMode={setEwtPeriodMode}
                month1Data={month1Data}
                month2Data={month2Data}
                month3Data={month3Data}
                quarterCombinedData={quarterCombinedData}
                yearlyData={yearly1601EQData}
                onConsolidateMonths={handleConsolidateMonths}
                onChange={handleUpdate1601EQ}
              />
            )}

            {(activeTab === '1701Annual' || (activeTab === 'annual' && isSingle)) && activeClient && (
              <Form1701AnnualView
                client={activeClient}
                year={year}
                data={raw1701Annual}
                onChange={(updated) =>
                  setData1701AnnualMap((prev) => ({
                    ...prev,
                    [currentAnnualKey]: updated,
                  }))
                }
                onAutoPullQuarters={handleAutoPull1701Quarters}
                quartersDataSummary={quarters1701Summary}
                allYearsData={allYears1701Data}
                onUpdateHistoricalYear={handleUpdateHistorical1701Year}
              />
            )}

            {(activeTab === '1702Annual' || (activeTab === 'annual' && !isSingle)) && activeClient && (
              <Form1702AnnualView
                client={activeClient}
                year={year}
                data={raw1702Annual}
                onChange={(updated) =>
                  setData1702AnnualMap((prev) => ({
                    ...prev,
                    [currentAnnualKey]: updated,
                  }))
                }
                onAutoPullQuarters={handleAutoPull1702Quarters}
                quartersDataSummary={quarters1702Summary}
                allYearsData={allYears1702Data}
                onUpdateHistoricalYear={handleUpdateHistorical1702Year}
              />
            )}
          </>
        )}
      </main>

      {/* Footer / Quick Status */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-3 px-4 sm:px-6 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            {activeClient ? (
              <>Client: <strong className="text-slate-800">{activeClient.tradeName}</strong> ({activeClient.tin}) • Tax Period: {quarter} {year}</>
            ) : (
              <>Client: <span className="text-slate-500 font-medium">None (Clean Slate)</span> • Tax Period: {quarter} {year}</>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              id="reset-defaults-btn"
              onClick={handleResetData}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Reset all clients to a clean slate"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Clean Slate</span>
            </button>
            <span>NIRC • Ease of Paying Taxes (eOPT) Act (RA 11976)</span>
          </div>
        </div>
      </footer>

      {/* Client Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        onDelete={(id) => handleDeleteClient(id)}
        clientToEdit={clientToEdit}
      />

      {/* Delete Client Confirmation Modal */}
      {clientToDelete && (
        <div
          id="delete-client-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setClientToDelete(null)}
        >
          <div
            id="delete-client-modal"
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-800">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-950">Delete Client Profile</h3>
                  <p className="text-[11px] text-rose-700">Permanent Client Removal</p>
                </div>
              </div>
              <button
                type="button"
                id="close-delete-client-modal-btn"
                onClick={() => setClientToDelete(null)}
                className="p-1 rounded-md text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 block">Client Trade Name</span>
                  <span className="text-sm font-bold text-slate-900 truncate block">{clientToDelete.tradeName}</span>
                  <span className="text-xs text-slate-500 font-mono">TIN: {clientToDelete.tin}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-900">{clientToDelete.tradeName}</strong>?
                This will permanently delete this client and all associated tax return calculations (1701Q, 1702Q, 2550Q, 2551Q, 1601-C, 1601-EQ).
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="cancel-delete-client-btn"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-client-btn"
                onClick={handleConfirmDeleteClient}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Client</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Error Modal */}
      {deleteClientError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setDeleteClientError(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-bold text-sm text-slate-900">Cannot Delete Client</h3>
            </div>
            <p className="text-xs text-slate-600">{deleteClientError}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDeleteClientError(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Offline Status Indicator */}
      <OfflineIndicator />
    </div>
  );
}
