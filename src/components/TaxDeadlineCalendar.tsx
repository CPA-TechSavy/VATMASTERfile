import React, { useState, useMemo } from 'react';
import { ClientProfile, Quarter } from '../types/tax';
import { TaxDeadlineItem, TaxCategory } from '../types/deadline';
import {
  getBirDeadlinesForMonth,
  isDeadlineApplicableToClient,
  calculateDeadlineStatus,
} from '../utils/taxDeadlines';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Download,
  Printer,
  Filter,
  ArrowRight,
  FileText,
  Info,
  CalendarDays,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface TaxDeadlineCalendarProps {
  activeClient: ClientProfile | null;
  selectedYear: number;
  selectedMonth: number; // 1-12
  onSelectYear: (year: number) => void;
  onSelectMonth: (month: number) => void;
  onNavigateToForm?: (tab: '1701Q' | '1702Q' | '2550Q' | '2551Q' | '1601C' | '1601EQ') => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TaxDeadlineCalendar: React.FC<TaxDeadlineCalendarProps> = ({
  activeClient,
  selectedYear,
  selectedMonth,
  onSelectYear,
  onSelectMonth,
  onNavigateToForm,
}) => {
  // Filter toggle: only active client vs all
  const [clientFilterOnly, setClientFilterOnly] = useState(true);
  // View mode: grid vs timeline agenda
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  // Selected day for inspect drawer
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  // Selected single deadline for modal
  const [activeModalDeadline, setActiveModalDeadline] = useState<TaxDeadlineItem | null>(null);

  // Today's real local date
  const today = new Date();
  const currentRealYear = today.getFullYear();
  const currentRealMonth = today.getMonth() + 1;
  const currentRealDay = today.getDate();

  const availableYears = useMemo(() => {
    const start = Math.min(2023, currentRealYear - 2);
    const end = Math.max(currentRealYear + 2, 2027);
    const list: number[] = [];
    for (let y = start; y <= end; y++) {
      list.push(y);
    }
    return list;
  }, [currentRealYear]);

  // Get all deadlines for the selected month and year
  const allMonthDeadlines = useMemo(() => {
    return getBirDeadlinesForMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Filtered list based on active client
  const displayedDeadlines = useMemo(() => {
    if (!clientFilterOnly || !activeClient) return allMonthDeadlines;
    return allMonthDeadlines.filter((d) => isDeadlineApplicableToClient(d, activeClient));
  }, [allMonthDeadlines, clientFilterOnly, activeClient]);

  // Map deadlines by statutory day and actual deadline day for calendar rendering
  const deadlinesByDay = useMemo(() => {
    const map = new Map<number, TaxDeadlineItem[]>();
    for (const d of displayedDeadlines) {
      // Find actual date's day of month
      const actualDay = parseInt(d.actualDeadlineDate.split('-')[2], 10);
      const list = map.get(actualDay) || [];
      list.push(d);
      map.set(actualDay, list);
    }
    return map;
  }, [displayedDeadlines]);

  // Calendar matrix calculations
  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay();
    const daysInCurrentMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const daysInPrevMonth = new Date(selectedYear, selectedMonth - 1, 0).getDate();

    const cells: {
      dayNumber: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isToday: boolean;
      isWeekend: boolean;
      deadlines: TaxDeadlineItem[];
    }[] = [];

    // Prepend trailing days of previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i;
      const prevM = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevY = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const dateStr = `${prevY}-${pad(prevM)}-${pad(prevDay)}`;
      cells.push({
        dayNumber: prevDay,
        isCurrentMonth: false,
        dateStr,
        isToday: false,
        isWeekend: false,
        deadlines: [],
      });
    }

    // Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const dateStr = `${selectedYear}-${pad(selectedMonth)}-${pad(day)}`;
      const dayOfWeek = new Date(selectedYear, selectedMonth - 1, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday =
        selectedYear === currentRealYear &&
        selectedMonth === currentRealMonth &&
        day === currentRealDay;

      cells.push({
        dayNumber: day,
        isCurrentMonth: true,
        dateStr,
        isToday,
        isWeekend,
        deadlines: deadlinesByDay.get(day) || [],
      });
    }

    // Append leading days of next month to fill complete grid of 35 or 42
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextM = selectedMonth === 12 ? 1 : selectedMonth + 1;
      const nextY = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const dateStr = `${nextY}-${pad(nextM)}-${pad(day)}`;
      cells.push({
        dayNumber: day,
        isCurrentMonth: false,
        dateStr,
        isToday: false,
        isWeekend: false,
        deadlines: [],
      });
    }

    return cells;
  }, [selectedYear, selectedMonth, deadlinesByDay, currentRealYear, currentRealMonth, currentRealDay]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      onSelectYear(selectedYear - 1);
      onSelectMonth(12);
    } else {
      onSelectMonth(selectedMonth - 1);
    }
    setSelectedDayNumber(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      onSelectYear(selectedYear + 1);
      onSelectMonth(1);
    } else {
      onSelectMonth(selectedMonth + 1);
    }
    setSelectedDayNumber(null);
  };

  const handleJumpToToday = () => {
    onSelectYear(currentRealYear);
    onSelectMonth(currentRealMonth);
    setSelectedDayNumber(currentRealDay);
  };

  // Export to iCal (.ics) format
  const handleExportIcs = () => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BIR Tax Return Calculator//PH Tax Calendar v1.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ].join('\r\n');

    for (const d of displayedDeadlines) {
      const [y, m, day] = d.actualDeadlineDate.split('-').map(Number);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const dtStr = `${y}${pad(m)}${pad(day)}`;

      icsContent += '\r\n' + [
        'BEGIN:VEVENT',
        `UID:${d.id}@birtaxcalculator.local`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${dtStr}`,
        `SUMMARY:BIR Filing Deadline: ${d.formCode}`,
        `DESCRIPTION:${d.title}\\n\\nPeriod: ${d.periodCovered}\\nChannel: ${d.submissionChannel}\\nLegal Basis: ${d.legalBasis}\\nDescription: ${d.description}`,
        'STATUS:CONFIRMED',
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      ].join('\r\n');
    }

    icsContent += '\r\nEND:VCALENDAR';

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BIR_Deadlines_${selectedYear}_${MONTH_NAMES[selectedMonth - 1]}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper styling for category badges
  const getCategoryStyles = (category: TaxCategory) => {
    switch (category) {
      case 'income_tax':
        return {
          pill: 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200',
          dot: 'bg-indigo-600',
          border: 'border-l-indigo-600',
          label: 'Income Tax',
        };
      case 'vat':
        return {
          pill: 'bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-200',
          dot: 'bg-violet-600',
          border: 'border-l-violet-600',
          label: 'Value-Added Tax',
        };
      case 'percentage_tax':
        return {
          pill: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
          dot: 'bg-amber-600',
          border: 'border-l-amber-600',
          label: 'Percentage Tax',
        };
      case 'withholding_tax':
        return {
          pill: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
          dot: 'bg-emerald-600',
          border: 'border-l-emerald-600',
          label: 'Withholding Tax',
        };
      case 'annual_compliance':
        return {
          pill: 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200',
          dot: 'bg-rose-600',
          border: 'border-l-rose-600',
          label: 'Annual Compliance',
        };
    }
  };

  // Get active day details if selected
  const activeDayDeadlines = selectedDayNumber ? deadlinesByDay.get(selectedDayNumber) || [] : [];

  return (
    <div className="space-y-6">
      {/* Top Controls Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Month & Year Title with Navigation */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <CalendarDays className="w-5 h-5 text-indigo-400" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  BIR Compliance Calendar
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
                  NIRC & EOPT Act
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </h2>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Month Navigation */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                id="cal-prev-month-btn"
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                id="cal-today-btn"
                onClick={handleJumpToToday}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
              >
                Today
              </button>

              <button
                id="cal-next-month-btn"
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Month Selector */}
            <select
              id="cal-month-select"
              value={selectedMonth}
              onChange={(e) => {
                onSelectMonth(parseInt(e.target.value));
                setSelectedDayNumber(null);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>

            {/* Direct Year Selector */}
            <select
              id="cal-year-select"
              value={selectedYear}
              onChange={(e) => {
                onSelectYear(parseInt(e.target.value));
                setSelectedDayNumber(null);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              title="Select Calendar Year"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr} {yr === currentRealYear ? '• Today' : ''}
                </option>
              ))}
            </select>

            {/* View Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
              <button
                id="cal-grid-view-btn"
                onClick={() => setViewMode('calendar')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grid
              </button>
              <button
                id="cal-agenda-view-btn"
                onClick={() => setViewMode('agenda')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'agenda'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Agenda List
              </button>
            </div>

            {/* Export iCal (.ics) */}
            <button
              id="export-ics-btn"
              onClick={handleExportIcs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-xs transition-colors"
              title="Add this month's deadlines to Google Calendar / Outlook"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Export .ics</span>
            </button>

            {/* Print Button */}
            <button
              id="print-calendar-btn"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Client Profile Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Filing Scope:
            </span>

            {activeClient ? (
              <button
                id="filter-client-only-btn"
                onClick={() => setClientFilterOnly(true)}
                className={`px-2.5 py-1 rounded-md transition-colors border font-medium ${
                  clientFilterOnly
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Only for {activeClient.tradeName} ({displayedDeadlines.length} Due)
              </button>
            ) : null}

            <button
              id="filter-all-deadlines-btn"
              onClick={() => setClientFilterOnly(false)}
              className={`px-2.5 py-1 rounded-md transition-colors border font-medium ${
                !clientFilterOnly || !activeClient
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All BIR Deadlines ({allMonthDeadlines.length})
            </button>
          </div>

          {/* Active Client Context Tip */}
          {activeClient && (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>Client:</span>
              <strong className="text-slate-800">{activeClient.registeredName}</strong>
              <span className="text-slate-400 font-mono">({activeClient.classification})</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area: Grid View or Agenda View */}
      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid (2 cols on desktop) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center py-2.5">
              {WEEKDAY_NAMES.map((name, i) => (
                <div
                  key={name}
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    i === 0 || i === 6 ? 'text-rose-600' : 'text-slate-600'
                  }`}
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 min-h-[520px]">
              {calendarCells.map((cell, idx) => {
                const isSelected = selectedDayNumber === cell.dayNumber && cell.isCurrentMonth;
                const hasDeadlines = cell.deadlines.length > 0;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (cell.isCurrentMonth) {
                        setSelectedDayNumber(cell.dayNumber === selectedDayNumber ? null : cell.dayNumber);
                      }
                    }}
                    className={`relative p-2 flex flex-col justify-between min-h-[95px] transition-colors cursor-pointer select-none ${
                      !cell.isCurrentMonth
                        ? 'bg-slate-50/50 text-slate-300 opacity-60'
                        : cell.isToday
                        ? 'bg-indigo-50/40'
                        : isSelected
                        ? 'bg-indigo-50/60 ring-2 ring-indigo-500 ring-inset'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Day number header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          cell.isToday
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : hasDeadlines && cell.isCurrentMonth
                            ? 'bg-slate-900 text-white'
                            : cell.isWeekend
                            ? 'text-slate-400'
                            : 'text-slate-700'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Weekend shift indicator badge */}
                      {cell.deadlines.some((d) => d.isWeekendShifted) && (
                        <span
                          title="Statutory deadline shifted from weekend/holiday to this business day"
                          className="text-[10px] text-amber-600 font-semibold flex items-center"
                        >
                          <Clock className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    {/* Deadline Pills */}
                    <div className="mt-1 space-y-1 overflow-y-auto max-h-[85px]">
                      {cell.deadlines.map((d) => {
                        const style = getCategoryStyles(d.category);
                        return (
                          <button
                            key={d.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModalDeadline(d);
                            }}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-semibold truncate block border transition-colors ${style.pill}`}
                            title={`${d.formCode}: ${d.title} (Click for details)`}
                          >
                            <span className="truncate">{d.formCode}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Day Inspector & Month Summary */}
          <div className="space-y-4">
            {/* If a day is selected, show Day Inspector Card */}
            {selectedDayNumber && activeDayDeadlines.length > 0 ? (
              <div className="bg-white border-2 border-indigo-500 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 font-mono">
                      Day Inspector
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {MONTH_NAMES[selectedMonth - 1]} {selectedDayNumber}, {selectedYear}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedDayNumber(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-2.5">
                  {activeDayDeadlines.map((d) => {
                    const status = calculateDeadlineStatus(d.actualDeadlineDate);
                    const style = getCategoryStyles(d.category);

                    return (
                      <div
                        key={d.id}
                        className={`p-3 rounded-lg border bg-slate-50/70 space-y-2 border-l-4 ${style.border}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-xs">{d.formCode}</h4>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${status.badgeColor}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-snug">{d.title}</p>

                        <div className="text-[11px] text-slate-500 font-mono">
                          Period: {d.periodCovered}
                        </div>

                        {d.isWeekendShifted && (
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{d.shiftedReason}</span>
                          </div>
                        )}

                        <div className="pt-1 flex items-center justify-between">
                          <button
                            onClick={() => setActiveModalDeadline(d)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            <span>Full Requirements</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          {d.targetAppTab && onNavigateToForm && (
                            <button
                              onClick={() => onNavigateToForm(d.targetAppTab as any)}
                              className="px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                            >
                              Open Calculator
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : selectedDayNumber ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-center space-y-2">
                <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-700">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedDayNumber}, {selectedYear}
                </h4>
                <p className="text-xs text-slate-500">
                  No statutory BIR filing deadlines fall on this date.
                </p>
                <button
                  onClick={() => setSelectedDayNumber(null)}
                  className="text-xs text-indigo-600 hover:underline pt-1 inline-block"
                >
                  View All Month Deadlines
                </button>
              </div>
            ) : null}

            {/* Month Overview Summary Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Upcoming Deadlines ({displayedDeadlines.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {MONTH_NAMES[selectedMonth - 1]}
                </span>
              </div>

              {displayedDeadlines.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No BIR filing deadlines apply to this client profile for {MONTH_NAMES[selectedMonth - 1]}.
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedDeadlines.map((d) => {
                    const status = calculateDeadlineStatus(d.actualDeadlineDate);
                    const style = getCategoryStyles(d.category);
                    const dayNum = parseInt(d.actualDeadlineDate.split('-')[2], 10);

                    return (
                      <div
                        key={d.id}
                        onClick={() => setActiveModalDeadline(d)}
                        className={`p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-all cursor-pointer bg-slate-50/50 hover:bg-slate-50 border-l-4 ${style.border}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-mono font-bold flex items-center justify-center">
                              {dayNum}
                            </span>
                            <span className="font-bold text-xs text-slate-900">{d.formCode}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${status.badgeColor}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 mt-1 line-clamp-1">{d.title}</div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>{d.periodCovered}</span>
                          <span className="text-indigo-600 font-sans font-medium flex items-center gap-0.5">
                            Details <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legend / Category Guide */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                Tax Classification Color Legend
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>Income Tax (1701Q/1702Q)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                  <span>VAT (2550Q 12%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  <span>Percentage Tax (2551Q)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>Withholding (1601C/0619E)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Agenda / Timeline View */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-base font-bold text-slate-900">
              Chronological Tax Filing Agenda • {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive list of statutory deadlines, required forms, legal basis, and filing methods.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {displayedDeadlines.map((d) => {
              const status = calculateDeadlineStatus(d.actualDeadlineDate);
              const style = getCategoryStyles(d.category);
              const dayNum = parseInt(d.actualDeadlineDate.split('-')[2], 10);

              return (
                <div
                  key={d.id}
                  className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Day badge */}
                    <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0 shadow-xs">
                      <span className="text-lg font-bold leading-tight">{dayNum}</span>
                      <span className="text-[10px] uppercase font-mono text-slate-300">
                        {MONTH_NAMES[selectedMonth - 1].slice(0, 3)}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{d.formCode}</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded border ${status.badgeColor}`}
                        >
                          {status.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded border ${style.pill}`}
                        >
                          {style.label}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-800">{d.title}</h4>

                      <p className="text-xs text-slate-600 max-w-2xl">{d.description}</p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1 font-mono">
                        <span>Period: <strong className="text-slate-700">{d.periodCovered}</strong></span>
                        <span>Channel: <strong className="text-slate-700">{d.submissionChannel}</strong></span>
                        <span>Basis: <strong className="text-slate-700">{d.legalBasis}</strong></span>
                      </div>

                      {d.isWeekendShifted && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2 max-w-xl">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{d.shiftedReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-end gap-2 shrink-0 self-end md:self-start">
                    <button
                      onClick={() => setActiveModalDeadline(d)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Requirements</span>
                    </button>

                    {d.targetAppTab && onNavigateToForm && (
                      <button
                        onClick={() => onNavigateToForm(d.targetAppTab as any)}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <span>Calculate Now</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Philippine Annual & Quarterly Tax Milestones Guide Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Statutory Philippine BIR Compliance Timetable (EOPT Act RA 11976 Rules)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Q1 Milestones */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">
              Q1 Return Deadlines
            </div>
            <div className="text-slate-600 space-y-0.5">
              <div>• <strong>Apr 25:</strong> 2550Q (VAT) & 2551Q</div>
              <div>• <strong>Apr 30:</strong> 1601-EQ & eAFS</div>
              <div>• <strong>May 15:</strong> 1701Q (Individuals)</div>
              <div>• <strong>May 30:</strong> 1702Q (Corporations)</div>
            </div>
          </div>

          {/* Q2 Milestones */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">
              Q2 Return Deadlines
            </div>
            <div className="text-slate-600 space-y-0.5">
              <div>• <strong>Jul 25:</strong> 2550Q (VAT) & 2551Q</div>
              <div>• <strong>Jul 31:</strong> 1601-EQ (Q2 EWT)</div>
              <div>• <strong>Aug 15:</strong> 1701Q (Individuals)</div>
              <div>• <strong>Aug 29:</strong> 1702Q (Corporations)</div>
            </div>
          </div>

          {/* Q3 Milestones */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">
              Q3 Return Deadlines
            </div>
            <div className="text-slate-600 space-y-0.5">
              <div>• <strong>Oct 25:</strong> 2550Q (VAT) & 2551Q</div>
              <div>• <strong>Oct 31:</strong> 1601-EQ (Q3 EWT)</div>
              <div>• <strong>Nov 15:</strong> 1701Q (Individuals)</div>
              <div>• <strong>Nov 29:</strong> 1702Q (Corporations)</div>
            </div>
          </div>

          {/* Q4 & Annual Milestones */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">
              Q4 & Annual Milestones
            </div>
            <div className="text-slate-600 space-y-0.5">
              <div>• <strong>Jan 25:</strong> 2550Q & 2551Q (Q4)</div>
              <div>• <strong>Jan 31:</strong> 1604-C & 2316 Issue</div>
              <div>• <strong>Feb 28:</strong> 1604-E & 2316 Sub.</div>
              <div>• <strong>Apr 15:</strong> Annual ITR (1701/1702)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Deadline Details Modal */}
      {activeModalDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold bg-slate-900 text-white rounded">
                    {activeModalDeadline.formCode}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Statutory Day: {activeModalDeadline.statutoryDay}th
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {activeModalDeadline.title}
                </h3>
              </div>

              <button
                onClick={() => setActiveModalDeadline(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Status & Dates */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono">Final Filing Deadline:</span>
                <strong className="text-slate-900 text-sm font-mono">
                  {activeModalDeadline.actualDeadlineDate}
                </strong>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono">Tax Period Covered:</span>
                <span className="text-slate-700 font-semibold">
                  {activeModalDeadline.periodCovered}
                </span>
              </div>

              {activeModalDeadline.isWeekendShifted && (
                <div className="pt-2 border-t border-slate-200 text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong>Weekend / Holiday Shift:</strong>
                    <div>{activeModalDeadline.shiftedReason}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Description & Legal Basis */}
            <div className="space-y-3 text-xs text-slate-600">
              <div>
                <div className="font-semibold text-slate-900 mb-1">Description:</div>
                <p>{activeModalDeadline.description}</p>
              </div>

              <div>
                <div className="font-semibold text-slate-900 mb-1">Mandatory Attachments:</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {(activeModalDeadline.attachments || []).map((att, i) => (
                    <li key={i}>{att}</li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">Filing Channel:</span>
                  <span className="text-slate-800 font-sans text-xs">
                    {activeModalDeadline.submissionChannel}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Legal Authority:</span>
                  <span className="text-slate-800 font-sans text-xs">
                    {activeModalDeadline.legalBasis}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveModalDeadline(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>

              {activeModalDeadline.targetAppTab && onNavigateToForm && (
                <button
                  onClick={() => {
                    const tab = activeModalDeadline.targetAppTab;
                    setActiveModalDeadline(null);
                    if (tab) onNavigateToForm(tab as any);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span>Open {activeModalDeadline.formCode} Calculator</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
