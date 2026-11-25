"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Delete, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/booking-link/panel-sheet"
import { parseAmount, todayLocal } from "@/lib/budget"
import { cn } from "@/lib/utils"

const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(new Date(2026, index, 1)))
const fieldClass = "flex min-h-12 w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-background px-3 py-3 text-left text-sm outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"

export function BudgetDateField({ label, value, onChange, monthOnly = false, heading, min, optional = false }: { label: string; value: string; onChange: (value: string) => void; monthOnly?: boolean; heading?: string; min?: string; optional?: boolean }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState("")
  const [choosingMonth, setChoosingMonth] = useState(false)
  const visibleMonth = view || todayLocal().slice(0, 7)
  const [year, month] = visibleMonth.split("-").map(Number)
  const monthKey = (index: number) => `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`
  function move(offset: number) {
    const next = new Date(`${visibleMonth}-01T12:00:00`)
    next.setMonth(next.getMonth() + offset)
    setView(`${String(next.getFullYear()).padStart(4, "0")}-${String(next.getMonth() + 1).padStart(2, "0")}`)
  }
  function choose(next: string) { onChange(next); setOpen(false) }
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const days = new Date(year, month, 0).getDate()
  const display = value ? new Intl.DateTimeFormat("tr-TR", { ...(monthOnly ? {} : { day: "numeric" as const }), month: "long", year: "numeric" }).format(new Date(`${value}${monthOnly ? "-01" : ""}T12:00:00`)) : optional ? "Bitiş yok" : "Seç"
  const trigger = (
    <button type="button" aria-label={`${label}: ${display}`} aria-haspopup="dialog" aria-expanded={open}
      className={heading ? "-ml-3 inline-flex items-center gap-2 rounded-xl px-3 py-1 text-xl font-bold tracking-tight outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:text-2xl" : fieldClass}
      onClick={() => { setView((value || todayLocal()).slice(0, 7)); setChoosingMonth(monthOnly); setOpen(true) }}>
      {heading ? <>{heading} {value && months[Number(value.slice(5, 7)) - 1]}<ChevronDown aria-hidden className="size-4 text-muted-foreground" /></> : <><span className="min-w-0 break-words">{display}</span><CalendarDays className="size-4 shrink-0 text-muted-foreground" /></>}
    </button>
  )
  return (
    <div className="grid min-w-0 gap-2">
      {heading ? <h1>{trigger}</h1> : <><span className="text-sm font-medium">{label}</span>{trigger}</>}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{label}</SheetTitle><SheetDescription>{monthOnly ? "Bir ay seçtiğinde kaydedilir." : "Bir gün seçtiğinde kaydedilir."}</SheetDescription></SheetHeader>
          {heading && value !== todayLocal().slice(0, 7) && <Button variant="ghost" className="mb-3 self-start rounded-full" onClick={() => choose(todayLocal().slice(0, 7))}>Bu aya dön</Button>}
          {optional && <Button type="button" variant="outline" className="mb-4 rounded-full" onClick={() => choose("")}>Bitiş olmadan devam et</Button>}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label={choosingMonth ? "Önceki yıl" : "Önceki ay"} disabled={year <= 1 && (choosingMonth || month === 1)} onClick={() => choosingMonth ? setView(`${String(year - 1).padStart(4, "0")}-${String(month).padStart(2, "0")}`) : move(-1)}><ChevronLeft /></Button>
              <Button type="button" variant="ghost" className="rounded-full capitalize" onClick={() => setChoosingMonth(true)}>{choosingMonth ? year : `${months[month - 1]} ${year}`}</Button>
              <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label={choosingMonth ? "Sonraki yıl" : "Sonraki ay"} disabled={year >= 9999 && (choosingMonth || month === 12)} onClick={() => choosingMonth ? setView(`${year + 1}-${String(month).padStart(2, "0")}`) : move(1)}><ChevronRight /></Button>
            </div>
            {choosingMonth ? <div className="grid grid-cols-3 gap-2">{months.map((name, index) => <Button key={name} type="button" variant={value.slice(0, 7) === monthKey(index) ? "default" : "ghost"} className="h-12 min-w-0 rounded-xl px-1 capitalize" disabled={Boolean(min && monthKey(index) < min.slice(0, 7))} onClick={() => { if (monthOnly) choose(monthKey(index)); else { setView(monthKey(index)); setChoosingMonth(false) } }}>{name}</Button>)}</div> : <div className="grid grid-cols-7 gap-1">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => <span key={day} className="py-2 text-center text-xs text-muted-foreground">{day}</span>)}
              {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
              {Array.from({ length: days }, (_, index) => { const day = `${visibleMonth}-${String(index + 1).padStart(2, "0")}`; return <Button key={day} type="button" aria-label={new Intl.DateTimeFormat("tr-TR", { dateStyle: "full" }).format(new Date(`${day}T12:00:00`))} aria-pressed={value === day} variant={value === day ? "default" : "ghost"} disabled={Boolean(min && day < min)} className="aspect-square h-auto min-w-0 rounded-full p-0" onClick={() => choose(day)}>{index + 1}</Button> })}
            </div>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function BudgetAmountField({ value, onChange, label = "Tutar (₺)", allowZero = false }: { value: string; onChange: (value: string) => void; label?: string; allowZero?: boolean }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const repeated = useRef(false)
  function stopHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    if (repeatTimer.current) clearInterval(repeatTimer.current)
  }
  useEffect(() => () => stopHold(), [])
  const canConfirm = parseAmount(draft) !== null || (allowZero && /^0+(?:,0{0,2})?$/.test(draft))
  function press(key: string) {
    if (key === "delete") { setDraft((previous) => previous.slice(0, -1)); return }
    setDraft((previous) => { const next = key === "," && !previous ? "0," : (previous === "0" && key !== "," ? key : previous + key); return /^\d{0,10}(?:,\d{0,2})?$/.test(next) ? next : previous })
  }
  function confirm() { if (canConfirm) { onChange(draft); setOpen(false) } }
  function keyboard(event: KeyboardEvent) {
    if (/^\d$/.test(event.key) || [",", ".", "Backspace", "Delete", "Enter"].includes(event.key)) {
      event.preventDefault()
      if (event.key === "Enter") confirm()
      else press(["Backspace", "Delete"].includes(event.key) ? "delete" : event.key === "." ? "," : event.key)
    }
  }
  return <div className="grid min-w-0 gap-2">
    <span className="text-sm font-medium">{label}</span>
    <button type="button" aria-label={`${label}: ${value || "0,00"} lira`} aria-haspopup="dialog" aria-expanded={open} className={fieldClass} onClick={() => { setDraft(value.replace(".", ",")); setOpen(true) }}><span className={cn("tabular-nums", !value && "text-muted-foreground")}>{value || "0,00"} ₺</span><Hash className="size-4 text-muted-foreground" /></button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent onKeyDown={keyboard}>
        <SheetHeader><SheetTitle>{label}</SheetTitle><SheetDescription>Tuşlarla tutarı yaz, tamamladığında onayla.</SheetDescription></SheetHeader>
        <output aria-live="polite" className="mb-6 block break-all rounded-2xl bg-muted/40 px-4 py-6 text-right text-3xl font-semibold tabular-nums">{(draft || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}<span className="ml-2 text-xl text-muted-foreground">₺</span></output>
        <div className="grid grid-cols-3 gap-2">{["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "delete"].map((key) => <Button key={key} type="button" variant="secondary" aria-label={key === "delete" ? "Son rakamı sil" : key === "," ? "Ondalık ayırıcı" : key} className="h-14 rounded-2xl text-xl" onPointerDown={(event) => { if (key !== "delete" || event.button !== 0) return; stopHold(); repeated.current = false; event.currentTarget.setPointerCapture(event.pointerId); holdTimer.current = setTimeout(() => { repeated.current = true; press("delete"); repeatTimer.current = setInterval(() => press("delete"), 80) }, 380) }} onPointerUp={stopHold} onPointerCancel={stopHold} onLostPointerCapture={stopHold} onClick={(event) => { if (key === "delete" && event.detail > 0 && repeated.current) { repeated.current = false; return }; press(key) }}>{key === "delete" ? <Delete className="size-5" /> : key}</Button>)}</div>
        <Button type="button" className="mt-5 h-12 w-full rounded-full" disabled={!canConfirm} onClick={confirm}>Tamam</Button>
      </SheetContent>
    </Sheet>
  </div>
}
