import { TaxClassification, VatStatus } from './tax';

export type TaxCategory = 'income_tax' | 'vat' | 'percentage_tax' | 'withholding_tax' | 'annual_compliance';

export type DeadlineUrgency = 'overdue' | 'today' | 'upcoming' | 'normal';

export interface TaxDeadlineItem {
  id: string;
  formCode: string;
  title: string;
  category: TaxCategory;
  statutoryDay: number; // day of month (e.g. 10, 15, 25, 29, 30, 31)
  actualDeadlineDate: string; // YYYY-MM-DD (adjusted for weekends/holidays)
  statutoryDate: string; // YYYY-MM-DD
  isWeekendShifted: boolean;
  shiftedReason?: string;
  periodCovered: string;
  applicableTo: {
    individual?: boolean;
    corporate?: boolean;
    vatRegistered?: boolean;
    nonVat?: boolean;
    withholdingAgent?: boolean;
    all?: boolean;
  };
  attachments: string[];
  submissionChannel: string; // e.g. "eFPS / eBIRForms Offline"
  legalBasis: string;
  description: string;
  targetAppTab?: '1701Q' | '1702Q' | '2550Q' | '2551Q' | '1601C' | '1601EQ' | 'summary';
}

export interface CalendarDayCell {
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  deadlines: TaxDeadlineItem[];
}
