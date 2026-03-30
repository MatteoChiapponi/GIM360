"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  DAY_LABELS_SHORT,
  MONTH_NAMES,
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  fromDateStr,
  getMonthCalendarDays,
  getScheduleTimeForDay,
  getWeekDays,
  getWeekEnd,
  getWeekStart,
  isAfterDay,
  isSameDay,
  toDateStr,
} from "./calendar-helpers"

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleInfo = {
  weekDays: string[]
  startTime: string
  endTime: string
}

type AttendanceRecord = {
  id: string
  groupId: string
  date: string
  detail: {
    students: { studentId: string; studentName: string; present: boolean; markedByUserId: string; markedByName: string }[]
  } | null
  takenByUserId: string | null
  takenByName: string | null
  group: {
    id: string
    name: string
    schedules: ScheduleInfo[]
  }
}

type Props = {
  gymId: string
  onSelectRecord: (record: AttendanceRecord) => void
  refreshKey: number
  /**
   * "any-taken" (default, trainer): verde si al menos una clase tiene asistencia cargada.
   * "all-taken" (owner): verde solo si TODAS las clases del día tienen asistencia; naranja si alguna falta.
   */
  statusMode?: "any-taken" | "all-taken"
}

// ─── Cell status helper ────────────────────────────────────────────────────────

/** true = green, false = orange, null = no classes */
function getDayStatus(records: AttendanceRecord[], mode: "any-taken" | "all-taken"): boolean | null {
  if (records.length === 0) return null
  if (mode === "all-taken") return records.every((r) => r.detail !== null)
  return records.some((r) => r.detail !== null)
}

// ─── Cell background by status ────────────────────────────────────────────────

function cellBg(taken: boolean | null, isSelected: boolean, disabled: boolean): string {
  if (disabled) return ""
  if (isSelected) return "!bg-[#111110] hover:!bg-[#111110]"
  if (taken === true) return "bg-emerald-200 hover:bg-emerald-300"
  if (taken === false) return "bg-amber-200 hover:bg-amber-300"
  return "hover:bg-[#F0EFEB] active:bg-[#E8E7E3]"
}

// ─── Chevron SVG ──────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#C8C7C3]" aria-hidden="true">
      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttendanceCalendar({ gymId, onSelectRecord, refreshKey, statusMode = "any-taken" }: Props) {
  const todayRef = useRef<Date>(null!)
  if (!todayRef.current) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    todayRef.current = d
  }

  const [viewMode, setViewMode] = useState<"week" | "month">("week")
  const [anchorDate, setAnchorDate] = useState<Date>(() => getWeekStart(todayRef.current))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [rangeRecords, setRangeRecords] = useState<AttendanceRecord[]>([])
  const [loadingRange, setLoadingRange] = useState(false)

  // ── Compute visible range ──
  const { rangeFrom, rangeTo } = useMemo(() => {
    const today = todayRef.current
    let from: Date, to: Date

    if (viewMode === "week") {
      from = anchorDate
      to = getWeekEnd(anchorDate)
    } else {
      const monthDays = getMonthCalendarDays(anchorDate.getFullYear(), anchorDate.getMonth())
      from = monthDays[0].date
      to = monthDays[monthDays.length - 1].date
    }

    // Clamp end to today
    if (isAfterDay(to, today)) to = new Date(today)

    return { rangeFrom: from, rangeTo: to }
  }, [viewMode, anchorDate])

  // ── Fetch records for range ──
  useEffect(() => {
    const fromStr = toDateStr(rangeFrom)
    const toStr = toDateStr(rangeTo)
    if (fromStr > toStr) {
      setRangeRecords([])
      return
    }

    setLoadingRange(true)
    fetch(`/api/attendance?gymId=${gymId}&date=${fromStr}&dateTo=${toStr}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AttendanceRecord[]) => setRangeRecords(data))
      .catch(() => setRangeRecords([]))
      .finally(() => setLoadingRange(false))
  }, [gymId, rangeFrom, rangeTo, refreshKey])

  // ── recordsByDate map ──
  const recordsByDate = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {}
    for (const r of rangeRecords) {
      const d = r.date.substring(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(r)
    }
    return map
  }, [rangeRecords])

  // ── Navigation ──
  const today = todayRef.current

  const canGoNext = useMemo(() => {
    if (viewMode === "week") {
      // Can go next if the Monday of next week is on or before today
      const nextWeekStart = new Date(anchorDate)
      nextWeekStart.setDate(anchorDate.getDate() + 7)
      return !isAfterDay(nextWeekStart, today)
    } else {
      // Can go next if the 1st of next month is on or before today
      const nextMonthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1)
      return !isAfterDay(nextMonthStart, today)
    }
  }, [viewMode, anchorDate, today])

  function goBack() {
    setSelectedDate(null)
    setAnchorDate((prev) => {
      if (viewMode === "week") {
        const d = new Date(prev)
        d.setDate(prev.getDate() - 7)
        return d
      } else {
        return new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
      }
    })
  }

  function goNext() {
    if (!canGoNext) return
    setSelectedDate(null)
    setAnchorDate((prev) => {
      if (viewMode === "week") {
        const d = new Date(prev)
        d.setDate(prev.getDate() + 7)
        return d
      } else {
        return new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
      }
    })
  }

  function goToday() {
    setSelectedDate(null)
    if (viewMode === "week") {
      setAnchorDate(getWeekStart(today))
    } else {
      setAnchorDate(new Date(today.getFullYear(), today.getMonth(), 1))
    }
  }

  function switchView(mode: "week" | "month") {
    setSelectedDate(null)
    setViewMode(mode)
    if (mode === "week") {
      setAnchorDate(getWeekStart(anchorDate))
    } else {
      setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1))
    }
  }

  // ── Selected date records ──
  const selectedDateRecords = useMemo(() => {
    if (!selectedDate) return []
    return recordsByDate[toDateStr(selectedDate)] ?? []
  }, [selectedDate, recordsByDate])

  // ── Period label ──
  const periodLabel =
    viewMode === "week"
      ? formatWeekLabel(anchorDate)
      : formatMonthLabel(anchorDate.getFullYear(), anchorDate.getMonth())

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <section className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-[#F0EFEB]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Historial</p>
          {/* View toggle */}
          <div className="flex rounded-md overflow-hidden border border-[#E5E4E0] text-xs font-medium">
            <button
              type="button"
              onClick={() => switchView("week")}
              className={[
                "px-3 py-1 min-h-[28px] transition-colors",
                viewMode === "week" ? "bg-[#111110] text-white" : "bg-white text-[#68685F] hover:bg-[#F7F6F3]",
              ].join(" ")}
            >
              Sem
            </button>
            <button
              type="button"
              onClick={() => switchView("month")}
              className={[
                "px-3 py-1 min-h-[28px] border-l border-[#E5E4E0] transition-colors",
                viewMode === "month" ? "bg-[#111110] text-white" : "bg-white text-[#68685F] hover:bg-[#F7F6F3]",
              ].join(" ")}
            >
              Mes
            </button>
          </div>
        </div>

        {/* Navigation row */}
        <div className="flex items-center justify-between mt-3 mb-1">
          <button
            type="button"
            onClick={goBack}
            className="cursor-pointer flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg hover:bg-[#F0EFEB] text-[#68685F] hover:text-[#111110] transition-colors"
            aria-label="Período anterior"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#111110]">{periodLabel}</span>
            {loadingRange && (
              <div className="h-3 w-3 rounded-full border border-[#C8C7C3] border-t-transparent animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToday}
              className="cursor-pointer px-2 py-1 min-h-[36px] text-xs font-medium text-[#68685F] hover:text-[#111110] rounded-lg hover:bg-[#F0EFEB] transition-colors"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className={[
                "flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg transition-colors",
                canGoNext
                  ? "cursor-pointer hover:bg-[#F0EFEB] text-[#68685F] hover:text-[#111110]"
                  : "opacity-30 cursor-not-allowed text-[#C8C7C3]",
              ].join(" ")}
              aria-label="Período siguiente"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M7 4L12 9L7 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar body */}
      <div className="px-3 py-3">
        {viewMode === "week" ? (
          <WeekStrip
            weekStart={anchorDate}
            today={today}
            selectedDate={selectedDate}
            recordsByDate={recordsByDate}
            statusMode={statusMode}
            onSelectDate={setSelectedDate}
          />
        ) : (
          <MonthGrid
            year={anchorDate.getFullYear()}
            month={anchorDate.getMonth()}
            today={today}
            selectedDate={selectedDate}
            recordsByDate={recordsByDate}
            statusMode={statusMode}
            onSelectDate={setSelectedDate}
          />
        )}
      </div>

      {/* Selected day records */}
      {selectedDate && (
        <div className="border-t border-[#F0EFEB] px-4 pb-4 pt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
            {formatDayLabel(selectedDate)}
          </p>

          {selectedDateRecords.length === 0 ? (
            <div className="rounded-xl border border-[#E5E4E0] bg-[#FAFAF9] px-5 py-8 text-center">
              <p className="text-sm text-[#68685F]">No hay clases registradas este día.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDateRecords.map((record) => {
                const time = getScheduleTimeForDay(record.group.schedules, selectedDate)
                const hasTaken = record.detail !== null
                const presentCount = hasTaken ? record.detail!.students.filter((s) => s.present).length : 0
                const totalCount = hasTaken ? record.detail!.students.length : 0

                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => onSelectRecord(record)}
                    className="cursor-pointer w-full text-left rounded-xl border border-[#E5E4E0] bg-white px-4 py-4 min-h-[72px] flex items-center justify-between gap-3 hover:bg-[#FAFAF9] active:bg-[#F0EFEB] transition-colors"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-medium text-sm text-[#111110] truncate">{record.group.name}</span>
                      {time && <span className="text-xs font-mono text-[#68685F]">{time}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasTaken ? (
                        <>
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-medium text-emerald-700 font-mono">
                            {presentCount}/{totalCount}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="h-2 w-2 rounded-full bg-[#C8C7C3]" />
                          <span className="text-xs font-medium text-[#A5A49D]">Sin tomar</span>
                        </>
                      )}
                      <ChevronRight />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Week Strip ───────────────────────────────────────────────────────────────

function WeekStrip({
  weekStart,
  today,
  selectedDate,
  recordsByDate,
  statusMode,
  onSelectDate,
}: {
  weekStart: Date
  today: Date
  selectedDate: Date | null
  recordsByDate: Record<string, AttendanceRecord[]>
  statusMode: "any-taken" | "all-taken"
  onSelectDate: (d: Date) => void
}) {
  const days = getWeekDays(weekStart)

  return (
    <div className="grid grid-cols-7 gap-0.5">
      {days.map((date, i) => {
        const dateStr = toDateStr(date)
        const isFuture = isAfterDay(date, today)
        const isToday = isSameDay(date, today)
        const isSelected = selectedDate ? isSameDay(date, selectedDate) : false
        const dayRecs = recordsByDate[dateStr] ?? []
        const taken = getDayStatus(dayRecs, statusMode)

        return (
          <button
            key={i}
            type="button"
            disabled={isFuture}
            onClick={() => !isFuture && onSelectDate(date)}
            className={[
              "flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg min-h-[64px] transition-colors",
              isFuture ? "opacity-25 cursor-not-allowed" : "cursor-pointer",
              cellBg(taken, isSelected, isFuture),
            ].join(" ")}
          >
            <span
              className={[
                "text-[10px] font-semibold",
                isSelected ? "text-white/60" : "text-[#A5A49D]",
              ].join(" ")}
            >
              {DAY_LABELS_SHORT[i]}
            </span>
            <span
              className={[
                "text-sm font-semibold leading-none",
                isSelected ? "text-white" : isToday ? "text-emerald-600" : "text-[#111110]",
              ].join(" ")}
            >
              {date.getDate()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({
  year,
  month,
  today,
  selectedDate,
  recordsByDate,
  statusMode,
  onSelectDate,
}: {
  year: number
  month: number
  today: Date
  selectedDate: Date | null
  recordsByDate: Record<string, AttendanceRecord[]>
  statusMode: "any-taken" | "all-taken"
  onSelectDate: (d: Date) => void
}) {
  const cells = getMonthCalendarDays(year, month)

  return (
    <div className="grid grid-cols-7 gap-0.5">
      {/* Header */}
      {DAY_LABELS_SHORT.map((label, i) => (
        <div key={i} className="text-center text-[10px] font-semibold text-[#A5A49D] py-1">
          {label}
        </div>
      ))}

      {/* Cells */}
      {cells.map(({ date, isCurrentMonth }, i) => {
        const dateStr = toDateStr(date)
        const isFuture = isAfterDay(date, today)
        const isToday = isSameDay(date, today)
        const isSelected = selectedDate ? isSameDay(date, selectedDate) : false
        const disabled = !isCurrentMonth || isFuture
        const dayRecs = isCurrentMonth ? (recordsByDate[dateStr] ?? []) : []
        const taken = getDayStatus(dayRecs, statusMode)

        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onSelectDate(date)}
            className={[
              "flex flex-col items-center justify-center aspect-square rounded-lg transition-colors",
              disabled ? "opacity-25 cursor-default" : "cursor-pointer",
              cellBg(taken, isSelected, disabled),
            ].join(" ")}
          >
            <span
              className={[
                "text-xs font-semibold leading-none",
                isSelected ? "text-white" : isToday ? "text-emerald-600" : "text-[#111110]",
              ].join(" ")}
            >
              {date.getDate()}
            </span>
          </button>
        )
      })}
    </div>
  )
}
