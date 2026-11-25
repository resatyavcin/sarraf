"use client";

import { useRef, useState, type ReactNode } from "react";

export function BudgetCards({ children }: { children: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const [drag, setDrag] = useState(0);
  const gesture = useRef<{ x: number; y: number; horizontal: boolean } | null>(null);
  const suppressClick = useRef(false);
  const labels = ["Harcanabilir kalan", "Bu ay biriktirdiğin"];
  return <div className="w-full min-w-0 space-y-1">
    <div role="region" aria-label="Aylık bütçe kartları" aria-roledescription="kaydırılabilir kartlar" tabIndex={0}
      className="w-full min-w-0 touch-pan-y overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); setActive(event.key === "ArrowRight" ? 1 : 0); } }}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; suppressClick.current = false; gesture.current = { x: event.clientX, y: event.clientY, horizontal: false }; }}
      onPointerMove={event => {
        const start = gesture.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.horizontal && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { gesture.current = null; return; }
        if (!start.horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { start.horizontal = true; event.currentTarget.setPointerCapture(event.pointerId); }
        if (start.horizontal) { suppressClick.current = true; setDrag((active === 0 && dx > 0) || (active === 1 && dx < 0) ? dx * 0.2 : dx); }
      }}
      onPointerUp={event => { const start = gesture.current; if (start?.horizontal) { const dx = event.clientX - start.x; if (Math.abs(dx) >= 35) setActive(dx < 0 ? 1 : 0); } gesture.current = null; setDrag(0); }}
      onPointerCancel={() => { gesture.current = null; setDrag(0); }}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      <div className={`flex w-full gap-3 ${drag ? "" : "transition-transform duration-300 motion-reduce:transition-none"}`} style={{ transform: `translate3d(calc(-${active * 100}% - ${active * 12}px + ${drag}px), 0, 0)` }}>
        {children.map((child, index) => <div key={labels[index]} className="w-full min-w-0 flex-none" inert={index !== active} aria-hidden={index !== active}>{child}</div>)}
      </div>
    </div>
    <div role="group" aria-label="Gösterilecek kart" className="flex justify-center gap-1">{labels.map((label, index) => <button key={label} type="button" aria-label={`${label} kartını göster`} aria-current={active === index ? "true" : undefined} onClick={() => setActive(index)} className="flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={`h-1.5 rounded-full transition-all motion-reduce:transition-none ${active === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} /></button>)}</div>
  </div>;
}
