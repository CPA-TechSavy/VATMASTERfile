import React, { useState } from 'react';
import {
  X,
  BookOpen,
  FileText,
  ShieldCheck,
  ExternalLink,
  Receipt,
  Scale,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
  ArrowRight,
  Info,
} from 'lucide-react';

interface EoptSalesGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'gross-sales' | 'exempt-sales' | 'key-details' | 'references';

export const EoptSalesGuideModal: React.FC<EoptSalesGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('gross-sales');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div
        id="eopt-sales-guide-modal"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white flex items-start justify-between gap-3 border-b border-amber-500/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500 text-slate-950 rounded uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Republic Act No. 11976 (eOPT Act)
              </span>
              <span className="text-xs text-amber-200 font-mono">
                RR 3-2024 • RR 7-2024 • RR 8-2024 • BIR Form 2551Q
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              eOPT Law Guidelines: Gross Sales, Exemptions & Percentage Tax Rules
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Statutory guidance on tax base determination for BIR Form 2551Q under the Ease of Paying Taxes Act.
            </p>
          </div>

          <button
            type="button"
            id="close-eopt-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-5 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('gross-sales')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'gross-sales'
                ? 'border-amber-600 text-amber-950 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Receipt className="w-4 h-4 text-amber-600" />
            <span>1. What Includes as Gross Sales</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exempt-sales')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'exempt-sales'
                ? 'border-amber-600 text-amber-950 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>2. What Sales are Exempt</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('key-details')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'key-details'
                ? 'border-amber-600 text-amber-950 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Scale className="w-4 h-4 text-blue-600" />
            <span>3. Key Important Details under eOPT</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'references'
                ? 'border-amber-600 text-amber-950 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <ExternalLink className="w-4 h-4 text-purple-600" />
            <span>4. References & Official Links</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
          {/* TAB 1: WHAT INCLUDES AS GROSS SALES */}
          {activeTab === 'gross-sales' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-xs sm:text-sm uppercase tracking-wide text-amber-900">
                    The Landmark eOPT Shift: Invoicing & Accrual Basis for Services
                  </div>
                  <p className="text-xs text-amber-900/90 leading-normal">
                    Under RA 11976 (Ease of Paying Taxes Act) amending Sections 106 and 108 of the National Internal Revenue Code (NIRC), <strong>Gross Sales</strong> is now the uniform tax base for <em>both sales of goods and sales of services</em>. The previous cash-collection rule (Gross Receipts upon Official Receipt) for services has been completely replaced by an <strong>accrual / billing basis upon issuance of the Sales Invoice (SI)</strong>.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    What MUST Be Included in Gross Sales:
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-600 list-disc list-inside">
                    <li>
                      <strong>Total Contract Price / Billed Amount:</strong> The total money or consideration agreed upon for goods sold or services rendered during the quarter.
                    </li>
                    <li>
                      <strong>Charges for Materials & Supplies:</strong> Any materials, parts, or ancillary supplies bundled with the service.
                    </li>
                    <li>
                      <strong>Service Fees & Delivery Charges:</strong> Handling, delivery, processing, and other service markups charged to the buyer.
                    </li>
                    <li>
                      <strong>Deposits Applied as Consideration:</strong> Advance deposits or retainer fees applied against actual billings.
                    </li>
                    <li>
                      <strong>Accrued Sales on Issued Invoices:</strong> All sales invoiced during the calendar quarter, regardless of whether customer payment has been collected yet.
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-xs sm:text-sm">
                    <Receipt className="w-4 h-4 text-amber-600" />
                    Sole Principal Invoicing Requirement:
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-600 list-disc list-inside">
                    <li>
                      <strong>Sales Invoice (SI) Only:</strong> Under RR 7-2024, the Sales Invoice is the <em>sole principal evidence</em> of sales of goods and services.
                    </li>
                    <li>
                      <strong>Official Receipts (OR) Demoted:</strong> ORs are now treated as supplementary documents only (valid for cash auditing, but not as primary evidence of sale).
                    </li>
                    <li>
                      <strong>Billed = Taxable:</strong> Tax liability arises at the moment the Sales Invoice is issued or when services are completed, whichever comes first.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs text-blue-950">
                <div className="font-bold flex items-center gap-2 text-blue-900 text-xs sm:text-sm">
                  <Scale className="w-4 h-4 text-blue-700" />
                  Allowable Deductions from Gross Sales:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div className="p-2.5 bg-white rounded-lg border border-blue-100">
                    <strong className="text-slate-900 block mb-1">1. Sales Discounts Granted at Time of Sale:</strong>
                    Prompt/trade discounts actually granted at the time of transaction and clearly indicated on the face of the Sales Invoice may be deducted from gross sales.
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-blue-100">
                    <strong className="text-slate-900 block mb-1">2. Sales Returns & Allowances:</strong>
                    Properly documented returned merchandise, canceled service orders, or price allowances covered by a valid Credit Memorandum.
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-blue-100 sm:col-span-2">
                    <strong className="text-slate-900 block mb-1">3. Uncollected Invoiced Receivables (Bad Debts Recovery under RR 3-2024):</strong>
                    Output percentage tax paid on uncollected receivables for sales invoiced on or after eOPT&apos;s effectivity may be deducted / credited against gross taxable sales in the subsequent quarter when proven uncollectible despite due demand, subject to BIR regulatory conditions.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHAT SALES ARE EXEMPT */}
          {activeTab === 'exempt-sales' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs sm:text-sm uppercase tracking-wide text-emerald-900">
                    Statutory Exempt Sales under Section 109 & Section 116 of the Tax Code
                  </div>
                  <p className="text-xs text-emerald-900/90 mt-1 leading-normal">
                    Exempt sales are reported in Line 14 of BIR Form 2551Q and subtracted from Gross Sales to arrive at Taxable Base Sales. They are NOT subject to the 3% Percentage Tax.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                      1
                    </span>
                    Agricultural & Marine Food Products
                  </div>
                  <p className="text-slate-600">
                    Sale of agricultural and marine food products in their original state, livestock and poultry of a kind generally used as, or yielding or producing foods for human consumption; breeding stock and genetic materials therefor.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                      2
                    </span>
                    Educational Institutions
                  </div>
                  <p className="text-slate-600">
                    Educational services rendered by private educational institutions, duly accredited by DepEd, CHED, or TESDA, and government educational institutions.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                      3
                    </span>
                    Medical, Dental & Hospital Services
                  </div>
                  <p className="text-slate-600">
                    Medical, dental, hospital and veterinary services, except those rendered by practicing professionals (which remain taxable under general percentage tax or income tax).
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                      4
                    </span>
                    Employer-Employee Services
                  </div>
                  <p className="text-slate-600">
                    Services rendered by individuals pursuant to an employer-employee relationship (subject to withholding tax on compensation, reported in Form 1601-C, not 2551Q).
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                      5
                    </span>
                    Senior Citizen & PWD Statutory Discounts
                  </div>
                  <p className="text-slate-600">
                    The 20% statutory discount granted to Senior Citizens (RA 9994) and Persons with Disabilities (RA 10754) on qualifying medicines, meals, and professional services.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                      6
                    </span>
                    Essential Prescription Medicines
                  </div>
                  <p className="text-slate-600">
                    Sales of prescription medicines and medical devices for diabetes, high cholesterol, hypertension, cancer, mental illness, tuberculosis, and kidney diseases as certified by the FDA.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 sm:col-span-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[11px]">
                      ★
                    </span>
                    Section 116 Non-VAT Registration Exemption (₱3,000,000 Threshold)
                  </div>
                  <p className="text-slate-600">
                    Taxpayers whose annual gross sales do not exceed the statutory threshold of <strong>₱3,000,000.00</strong> under Tax Code Section 116 are exempt from the 12% Value-Added Tax (VAT), and are subject only to the 3% Percentage Tax filed quarterly under this <strong>BIR Form 2551Q</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: KEY IMPORTANT DETAILS */}
          {activeTab === 'key-details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Micro Taxpayer Relief */}
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      Micro Taxpayer Protections (Gross &lt; ₱3M)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Under Section 21 of the NIRC as amended by eOPT (RA 11976), non-VAT taxpayers with gross sales under ₱3,000,000 are formally classified as <strong>Micro Taxpayers</strong>:
                  </p>
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200/80">
                      <span className="text-slate-700">Late Surcharge Rate:</span>
                      <strong className="text-emerald-700 font-mono">10% (slashed from 25%)</strong>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200/80">
                      <span className="text-slate-700">Late Interest Rate:</span>
                      <strong className="text-emerald-700 font-mono">Legal Rate (6% p.a., cut 50%)</strong>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200/80">
                      <span className="text-slate-700">Compromise Penalty:</span>
                      <strong className="text-emerald-700 font-mono">50% discount on BIR matrix</strong>
                    </div>
                  </div>
                </div>

                {/* File & Pay Anywhere */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      File & Pay Anywhere Nationwide
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    eOPT abolished Section 248(A)(2) of the Tax Code!
                  </p>
                  <ul className="space-y-2 pt-1 text-xs text-slate-700">
                    <li className="p-2 bg-white rounded-lg border border-blue-200/80">
                      <strong>Zero Wrong-Venue Surcharges:</strong> Taxpayers are no longer penalized with a 25% surcharge for paying or filing outside their home RDO.
                    </li>
                    <li className="p-2 bg-white rounded-lg border border-blue-200/80">
                      <strong>Any Authorized Agent Bank (AAB):</strong> You may file and pay at any AAB, RDO, or accredited electronic channel anywhere in the Philippines.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Books & 8% Income Tax Option */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-600" />
                    5-Year Books of Accounts Retention
                  </h4>
                  <p className="text-slate-600">
                    eOPT reduced the required retention period for business books of accounts, sales invoices, and accounting registers from <strong>10 years down to 5 years</strong> from the deadline of filing the annual tax return.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-600" />
                    8% Flat Income Tax vs 3% 2551Q Option
                  </h4>
                  <p className="text-slate-600">
                    Under the Tax Code (TRAIN & eOPT), pure self-employed individuals with gross annual sales ≤ ₱3,000,000 may opt for the <strong>8% flat income tax in Form 1701Q</strong>. If chosen, they are <em>entirely exempt from filing Form 2551Q</em> and paying 3% percentage tax.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OFFICIAL REFERENCES & LINKS */}
          {activeTab === 'references' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-950 text-xs flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-purple-700 shrink-0" />
                <span>
                  Below are the authoritative legal sources, implementing regulations, and portals from the Bureau of Internal Revenue (BIR) and the Official Gazette:
                </span>
              </div>

              <div className="space-y-3">
                <a
                  href="https://www.bir.gov.ph/index.php/tax-information/ease-of-paying-taxes.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between p-3.5 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all group"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 group-hover:text-amber-800 text-xs sm:text-sm flex items-center gap-2">
                      <span>BIR Ease of Paying Taxes (eOPT) Act Main Portal</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Official portal covering Republic Act No. 11976 briefings, FAQs, implementation circulars, and announcements.
                    </p>
                    <span className="text-[11px] text-amber-700 font-mono block">
                      bir.gov.ph/index.php/tax-information/ease-of-paying-taxes.html
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 shrink-0 mt-1" />
                </a>

                <a
                  href="https://www.bir.gov.ph/images/bir_files/internal_guidelines/RR%20No.%203-2024.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between p-3.5 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all group"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 group-hover:text-amber-800 text-xs sm:text-sm flex items-center gap-2">
                      <span>BIR Revenue Regulations No. 3-2024 (VAT & Percentage Tax)</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Implements the amendments on Title IV (VAT) and Title V (Percentage Taxes) under RA 11976, detailing Gross Sales accrual basis and bad debts recovery.
                    </p>
                    <span className="text-[11px] text-amber-700 font-mono block">
                      bir.gov.ph/images/bir_files/internal_guidelines/RR%20No.%203-2024.pdf
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 shrink-0 mt-1" />
                </a>

                <a
                  href="https://www.bir.gov.ph/images/bir_files/internal_guidelines/RR%20No.%207-2024.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between p-3.5 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all group"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 group-hover:text-amber-800 text-xs sm:text-sm flex items-center gap-2">
                      <span>BIR Revenue Regulations No. 7-2024 (Invoicing & Registration)</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Guidelines on the Sales Invoice as sole principal document, stamping/conversion of old ORs, and invoicing rules.
                    </p>
                    <span className="text-[11px] text-amber-700 font-mono block">
                      bir.gov.ph/images/bir_files/internal_guidelines/RR%20No.%207-2024.pdf
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 shrink-0 mt-1" />
                </a>

                <a
                  href="https://www.bir.gov.ph/index.php/tax-information/percentage-tax.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between p-3.5 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all group"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 group-hover:text-amber-800 text-xs sm:text-sm flex items-center gap-2">
                      <span>BIR Form 2551Q Overview & Statutory Tax Rates</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Official BIR guidance on who are required to file 2551Q, deadline (25th of the month following quarter close), and Section 116 rates.
                    </p>
                    <span className="text-[11px] text-amber-700 font-mono block">
                      bir.gov.ph/index.php/tax-information/percentage-tax.html
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 shrink-0 mt-1" />
                </a>

                <a
                  href="https://www.officialgazette.gov.ph/2024/01/05/republic-act-no-11976/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between p-3.5 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all group"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 group-hover:text-amber-800 text-xs sm:text-sm flex items-center gap-2">
                      <span>Official Gazette: Republic Act No. 11976 Full Text</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Complete statutory text of the Ease of Paying Taxes Act as signed by the President on January 5, 2024.
                    </p>
                    <span className="text-[11px] text-amber-700 font-mono block">
                      officialgazette.gov.ph/2024/01/05/republic-act-no-11976/
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 shrink-0 mt-1" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Updated in accordance with BIR Revenue Regulations 2024–2026</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
            >
              Close Guidelines
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
